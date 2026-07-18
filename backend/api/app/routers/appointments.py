"""Lịch tái khám: gợi ý ngày cân bằng tải và đặt lịch.

Hệ thống chỉ đề xuất; bác sĩ là người chọn ngày và xác nhận. Lưu trữ dùng
MongoDB khi được cấu hình, ngược lại rơi về bộ nhớ tiến trình để demo local
không cần hạ tầng cloud.
"""
from __future__ import annotations

import os
import threading
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.database import get_database
from app.scheduling import (
    WEEKDAY_LABELS,
    default_interval_days,
    parse_interval_days,
    suggest_days,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


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


def _insert(db, appointment: dict) -> None:
    if db is not None:
        db.appointments.insert_one({**appointment})
        return
    with _memory_lock:
        _memory_appointments.append(appointment)


class SuggestRequest(BaseModel):
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
    parsed = parse_interval_days(payload.treatment_plan)
    if parsed is not None:
        interval_days, interval_source = parsed, "treatment_plan"
    else:
        interval_days = default_interval_days(payload.pregnancy_weeks)
        interval_source = "pregnancy_weeks" if payload.pregnancy_weeks is not None else "default"

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
