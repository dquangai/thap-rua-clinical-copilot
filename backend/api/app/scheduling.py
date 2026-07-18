"""Gợi ý lịch tái khám cân bằng tải phòng khám.

Logic thuần (không I/O) để dễ kiểm thử: phân tích khoảng tái khám từ hướng
xử trí, suy khoảng mặc định theo tuổi thai, và chấm điểm các ngày ứng viên
quanh ngày lý tưởng dựa trên số lịch đã đặt của từng ngày.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta

WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]

_UNIT_DAYS = {"ngay": 1, "tuan": 7, "thang": 30}
_INTERVAL_PATTERN = re.compile(
    r"(?:tai kham|hen kham|kham lai).{0,40}?sau\s*(\d{1,2})\s*(ngay|tuan|thang)"
)


def _ascii_lower(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).lower()


def parse_interval_days(treatment_plan: str) -> int | None:
    """Đọc 'tái khám sau N ngày/tuần/tháng' từ hướng xử trí; không thấy trả None."""
    match = _INTERVAL_PATTERN.search(_ascii_lower(treatment_plan or ""))
    if not match:
        return None
    return int(match.group(1)) * _UNIT_DAYS[match.group(2)]


def default_interval_days(pregnancy_weeks: int | None) -> int:
    """Tần suất khám thai chuẩn theo tuổi thai khi hướng xử trí không ghi rõ."""
    if pregnancy_weeks is None:
        return 28
    if pregnancy_weeks >= 36:
        return 7
    if pregnancy_weeks >= 28:
        return 14
    return 28


@dataclass(frozen=True)
class DayCandidate:
    day: date
    load: int
    capacity: int
    offset_days: int
    label: str
    recommended: bool


def _load_label(load: int, capacity: int) -> str:
    ratio = load / capacity if capacity else 1.0
    if ratio >= 1.0:
        return "day"  # đã đầy, không nhận thêm
    if ratio >= 0.75:
        return "dong"
    if ratio >= 0.4:
        return "vua"
    return "thua"


def _score(offset_days: int, load: int, capacity: int) -> float:
    # Lệch ít so với ngày lý tưởng là quan trọng nhất; sau đó ưu tiên ngày còn thưa.
    ratio = load / capacity if capacity else 1.0
    return abs(offset_days) * 1.0 + ratio * 3.0


def suggest_days(
    ideal: date,
    today: date,
    loads: dict[date, int],
    *,
    capacity: int,
    window_days: int = 3,
) -> list[DayCandidate]:
    """Trả về các ngày ứng viên quanh ngày lý tưởng, đánh dấu ngày đề xuất.

    Bỏ Chủ nhật và ngày đã qua; ngày đầy vẫn hiển thị (label "day") nhưng
    không bao giờ được đề xuất.
    """
    candidates: list[tuple[float, DayCandidate]] = []
    for offset in range(-window_days, window_days + 1):
        day = ideal + timedelta(days=offset)
        if day <= today or day.weekday() == 6:
            continue
        load = loads.get(day, 0)
        label = _load_label(load, capacity)
        candidates.append(
            (
                _score(offset, load, capacity),
                DayCandidate(day=day, load=load, capacity=capacity, offset_days=offset, label=label, recommended=False),
            )
        )
    if not candidates:
        return []
    open_days = [(score, item) for score, item in candidates if item.label != "day"]
    ranked = sorted(open_days or candidates, key=lambda pair: (pair[0], pair[1].day))
    best_day = ranked[0][1].day if open_days else None
    return [
        DayCandidate(**{**item.__dict__, "recommended": item.day == best_day})
        for _, item in sorted(candidates, key=lambda pair: pair[1].day)
    ]
