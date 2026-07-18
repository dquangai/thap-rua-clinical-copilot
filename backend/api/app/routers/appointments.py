"""Lịch tái khám: gợi ý ngày cân bằng tải và đặt lịch.

Hệ thống chỉ đề xuất; bác sĩ là người chọn ngày và xác nhận. Lưu trữ dùng
MongoDB khi được cấu hình, ngược lại rơi về bộ nhớ tiến trình để demo local
không cần hạ tầng cloud.
"""
from __future__ import annotations

import json
import os
import sys
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.database import get_database
from app.scheduling import (
    WEEKDAY_LABELS,
    default_interval_days,
    load_label,
    parse_interval_days,
    suggest_days,
)

REPO_ROOT = Path(__file__).resolve().parents[4]
AI_PACKAGE_ROOT = REPO_ROOT / "backend" / "ai"
if str(AI_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_PACKAGE_ROOT))

from clinical_checker.config import Settings as CheckerSettings  # noqa: E402
from clinical_checker.pipeline import detect_gestational_age  # noqa: E402
from clinical_checker.privacy import (  # noqa: E402
    build_minimum_necessary_record,
    find_residual_pii,
)
from clinical_checker.provider import call_llm  # noqa: E402

ENV_PATH = REPO_ROOT / ".env"

router = APIRouter(prefix="/appointments", tags=["appointments"])

FOLLOW_UP_SYSTEM_PROMPT = (
    "Bạn là bác sĩ sản khoa lập kế hoạch tái khám dựa trên hồ sơ khám đã ẩn danh.\n"
    "Nhiệm vụ: quyết định SỐ NGÀY đến lần tái khám tiếp theo và lý do ngắn gọn.\n"
    "Nguyên tắc:\n"
    "- Nếu hướng xử trí đã ghi rõ thời điểm tái khám (VD 'tái khám sau 1 tuần') thì tôn trọng chỉ định đó.\n"
    "- Cân nhắc tuổi thai (lịch khám định kỳ: <28 tuần: 4 tuần/lần; 28-35 tuần: 2 tuần/lần; >=36 tuần: 1 tuần/lần)"
    " và bệnh lý kèm theo (đái tháo đường thai kỳ, tăng huyết áp, tiền sản giật, thiếu máu...): bệnh lý cần theo dõi"
    " sát thì rút ngắn hợp lý.\n"
    "- interval_days là số nguyên 1-42. Lý do viết 1 câu tiếng Việt, nêu căn cứ chính, không ghi thông tin định danh.\n"
    'Trả về JSON đúng định dạng: {"interval_days": <số nguyên>, "ly_do": "<1 câu>"}'
)


def _ai_interval(safe_record: dict[str, Any]) -> tuple[int, str] | None:
    """Hỏi LLM số ngày tái khám cho hồ sơ đã ẩn danh; lỗi/không cấu hình trả None."""
    settings = CheckerSettings.from_env(ENV_PATH)
    if not settings.api_key or settings.api_key == "replace_me":
        return None
    try:
        response = call_llm(
            settings,
            FOLLOW_UP_SYSTEM_PROMPT,
            "CLINICAL_RECORD:\n" + json.dumps(safe_record, ensure_ascii=False, sort_keys=True),
        )
        payload = json.loads(response.text)
        interval = int(payload["interval_days"])
        reason = str(payload.get("ly_do", "")).strip()
    except Exception:
        return None
    if not 1 <= interval <= 42:
        return None
    return interval, reason


def _capacity() -> int:
    return int(os.getenv("APPT_DAILY_CAPACITY", "30"))


def _window_days() -> int:
    return int(os.getenv("APPT_SEARCH_WINDOW_DAYS", "3"))


# Fallback trong bộ nhớ khi chưa cấu hình MongoDB (demo local).
_memory_lock = threading.Lock()
_memory_appointments: list[dict] = []


def _database_or_none():
    try:
        return get_database()
    except Exception:
        return None


def _count_by_date(db, start: date, end: date) -> dict[date, int]:
    counts: dict[date, int] = {}
    if db is not None:
        rows = db.appointments.find(
            {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}, {"_id": 0, "date": 1}
        )
        for row in rows:
            day = date.fromisoformat(row["date"])
            counts[day] = counts.get(day, 0) + 1
        return counts
    with _memory_lock:
        for row in _memory_appointments:
            day = date.fromisoformat(row["date"])
            if start <= day <= end:
                counts[day] = counts.get(day, 0) + 1
    return counts


def _list_range(db, start: date, end: date) -> list[dict]:
    if db is not None:
        rows = db.appointments.find(
            {"date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}, {"_id": 0}
        )
        return list(rows)
    with _memory_lock:
        return [
            dict(row)
            for row in _memory_appointments
            if start <= date.fromisoformat(row["date"]) <= end
        ]


def _insert(db, appointment: dict) -> None:
    if db is not None:
        db.appointments.insert_one({**appointment})
        return
    with _memory_lock:
        _memory_appointments.append(appointment)


class SuggestRequest(BaseModel):
    # Hồ sơ tối thiểu (đã theo allowlist phía client) để AI phân tích từng ca.
    record: dict[str, Any] | None = None
    treatment_plan: str = ""
    pregnancy_weeks: int | None = Field(default=None, ge=4, le=45)


class BookRequest(BaseModel):
    medical_id: str = Field(min_length=1, max_length=40)
    patient_name: str = Field(default="", max_length=120)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    note: str = Field(default="", max_length=300)


def _candidate_payload(candidate) -> dict:
    return {
        "date": candidate.day.isoformat(),
        "weekday": WEEKDAY_LABELS[candidate.day.weekday()],
        "load": candidate.load,
        "capacity": candidate.capacity,
        "label": candidate.label,
        "recommended": candidate.recommended,
    }


@router.post("/suggest")
def suggest_follow_up(payload: SuggestRequest) -> dict:
    interval_days: int | None = None
    interval_source = "default"
    reason = ""

    treatment_plan = payload.treatment_plan
    pregnancy_weeks = payload.pregnancy_weeks
    if payload.record is not None:
        safe_record = build_minimum_necessary_record(payload.record)
        if CheckerSettings.from_env(ENV_PATH).pii_fail_closed and find_residual_pii(safe_record):
            raise HTTPException(status_code=422, detail="Phát hiện mẫu PII còn sót trong hồ sơ, đã hủy request")
        treatment_plan = treatment_plan or safe_record.get("clinical_note", {}).get("huong_xu_tri", "")
        if pregnancy_weeks is None:
            gestational = detect_gestational_age(safe_record)
            if gestational.get("detected"):
                pregnancy_weeks = gestational.get("weeks")
        ai_result = _ai_interval(safe_record)
        if ai_result is not None:
            interval_days, reason = ai_result
            interval_source = "ai"

    if interval_days is None:
        parsed = parse_interval_days(treatment_plan)
        if parsed is not None:
            interval_days, interval_source = parsed, "treatment_plan"
        else:
            interval_days = default_interval_days(pregnancy_weeks)
            interval_source = "pregnancy_weeks" if pregnancy_weeks is not None else "default"

    today = date.today()
    ideal = today + timedelta(days=interval_days)
    window = _window_days()
    db = _database_or_none()
    loads = _count_by_date(db, ideal - timedelta(days=window), ideal + timedelta(days=window))
    candidates = suggest_days(ideal, today, loads, capacity=_capacity(), window_days=window)
    if not candidates:
        raise HTTPException(status_code=409, detail="Không tìm được ngày trống quanh ngày hẹn lý tưởng")
    return {
        "interval_days": interval_days,
        "interval_source": interval_source,
        "reason": reason,
        "ideal_date": ideal.isoformat(),
        "capacity": _capacity(),
        "storage": "mongodb" if db is not None else "memory",
        "candidates": [_candidate_payload(c) for c in candidates],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def book_follow_up(payload: BookRequest) -> dict:
    day = date.fromisoformat(payload.date)
    if day <= date.today():
        raise HTTPException(status_code=422, detail="Ngày hẹn phải sau hôm nay")
    if day.weekday() == 6:
        raise HTTPException(status_code=422, detail="Phòng khám không nhận lịch Chủ nhật")
    db = _database_or_none()
    load = _count_by_date(db, day, day).get(day, 0)
    if load >= _capacity():
        raise HTTPException(status_code=409, detail="Ngày này đã đủ số lượt hẹn, vui lòng chọn ngày khác")
    appointment = {
        "id": str(uuid4()),
        "medical_id": payload.medical_id,
        "patient_name": payload.patient_name,
        "date": payload.date,
        "note": payload.note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _insert(db, appointment)
    return {
        "appointment": appointment,
        "day_load": load + 1,
        "capacity": _capacity(),
    }


@router.get("/schedule")
def schedule(days: int = 14) -> dict:
    """Lịch tái khám theo ngày kèm danh sách bệnh nhân — cho trang Lịch hẹn."""
    days = max(1, min(days, 60))
    today = date.today()
    end = today + timedelta(days=days - 1)
    db = _database_or_none()
    appointments = _list_range(db, today, end)
    by_day: dict[str, list[dict]] = {}
    for item in sorted(appointments, key=lambda row: row.get("created_at", "")):
        by_day.setdefault(item["date"], []).append(
            {
                "id": item.get("id", ""),
                "medical_id": item.get("medical_id", ""),
                "patient_name": item.get("patient_name", ""),
                "note": item.get("note", ""),
                "created_at": item.get("created_at", ""),
            }
        )
    capacity = _capacity()
    day_entries = []
    for offset in range(days):
        day = today + timedelta(days=offset)
        entries = by_day.get(day.isoformat(), [])
        day_entries.append(
            {
                "date": day.isoformat(),
                "weekday": WEEKDAY_LABELS[day.weekday()],
                "is_today": day == today,
                "is_sunday": day.weekday() == 6,
                "load": len(entries),
                "capacity": capacity,
                "label": load_label(len(entries), capacity),
                "appointments": entries,
            }
        )
    return {
        "capacity": capacity,
        "total": len(appointments),
        "storage": "mongodb" if db is not None else "memory",
        "days": day_entries,
    }


@router.get("/daily-load")
def daily_load(days: int = 14) -> dict:
    days = max(1, min(days, 60))
    today = date.today()
    end = today + timedelta(days=days)
    db = _database_or_none()
    counts = _count_by_date(db, today, end)
    return {
        "capacity": _capacity(),
        "days": [
            {
                "date": (today + timedelta(days=offset)).isoformat(),
                "weekday": WEEKDAY_LABELS[(today + timedelta(days=offset)).weekday()],
                "load": counts.get(today + timedelta(days=offset), 0),
            }
            for offset in range(1, days + 1)
        ],
    }
