from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.routers import appointments as appointments_router
from app.scheduling import default_interval_days, parse_interval_days, suggest_days


def test_parse_interval_days_variants():
    assert parse_interval_days("TÁI KHÁM SAU 01 TUẦN HOẶC KHÁM NGAY KHI CÓ GÌ LẠ") == 7
    assert parse_interval_days("Tái khám lại sau 4 ngày\n- Siêu âm thai") == 4
    assert parse_interval_days("hẹn khám sau 2 tuần") == 14
    assert parse_interval_days("tái khám sau 1 tháng") == 30
    assert parse_interval_days("toa về: sắt, canxi mỗi ngày") is None
    assert parse_interval_days("") is None


def test_default_interval_follows_prenatal_schedule():
    assert default_interval_days(None) == 28
    assert default_interval_days(12) == 28
    assert default_interval_days(30) == 14
    assert default_interval_days(38) == 7


def test_suggest_days_prefers_ideal_but_avoids_crowded_day():
    today = date(2026, 7, 13)  # thứ 2
    ideal = date(2026, 7, 20)  # thứ 2 tuần sau
    capacity = 10
    # Ngày lý tưởng đã kín 9/10, hôm sau còn thưa.
    loads = {ideal: 9, ideal + timedelta(days=1): 1}
    candidates = suggest_days(ideal, today, loads, capacity=capacity, window_days=3)
    recommended = [c for c in candidates if c.recommended]
    assert len(recommended) == 1
    assert recommended[0].day == ideal + timedelta(days=1)
    # Chủ nhật (19/07/2026) không bao giờ xuất hiện.
    assert all(c.day.weekday() != 6 for c in candidates)


def test_suggest_days_never_recommends_full_day():
    today = date(2026, 7, 13)
    ideal = date(2026, 7, 20)
    loads = {ideal + timedelta(days=offset): 10 for offset in range(-3, 4)}
    loads[ideal + timedelta(days=2)] = 3
    candidates = suggest_days(ideal, today, loads, capacity=10, window_days=3)
    recommended = [c for c in candidates if c.recommended]
    assert recommended[0].day == ideal + timedelta(days=2)
    full_days = [c for c in candidates if c.label == "day"]
    assert full_days and all(not c.recommended for c in full_days)


def test_suggest_uses_ai_interval_for_record(monkeypatch):
    monkeypatch.setattr(appointments_router, "_database_or_none", lambda: None)
    monkeypatch.setattr(appointments_router, "_memory_appointments", [])
    monkeypatch.setattr(appointments_router, "_ai_interval", lambda safe_record: (5, "ĐTĐTK cần theo dõi sát"))
    client = TestClient(app)

    suggested = client.post(
        "/api/v1/appointments/suggest",
        json={"record": {"clinical_note": {"huong_xu_tri": "Tái khám sau 1 tuần"}, "diagnosis": {"mo_ta": "THAI 38 TUẦN"}}},
    )
    assert suggested.status_code == 200
    body = suggested.json()
    assert body["interval_days"] == 5
    assert body["interval_source"] == "ai"
    assert body["reason"] == "ĐTĐTK cần theo dõi sát"


def test_suggest_record_falls_back_to_plan_when_ai_unavailable(monkeypatch):
    monkeypatch.setattr(appointments_router, "_database_or_none", lambda: None)
    monkeypatch.setattr(appointments_router, "_memory_appointments", [])
    monkeypatch.setattr(appointments_router, "_ai_interval", lambda safe_record: None)
    client = TestClient(app)

    suggested = client.post(
        "/api/v1/appointments/suggest",
        json={"record": {"clinical_note": {"huong_xu_tri": "Tái khám lại sau 4 ngày"}, "diagnosis": {"mo_ta": "THAI 38 TUẦN"}}},
    )
    assert suggested.status_code == 200
    body = suggested.json()
    assert body["interval_days"] == 4
    assert body["interval_source"] == "treatment_plan"


def test_suggest_and_book_api_flow(monkeypatch):
    monkeypatch.setattr(appointments_router, "_database_or_none", lambda: None)
    monkeypatch.setattr(appointments_router, "_memory_appointments", [])
    client = TestClient(app)

    suggested = client.post(
        "/api/v1/appointments/suggest",
        json={"treatment_plan": "Tái khám lại sau 4 ngày", "pregnancy_weeks": 38},
    )
    assert suggested.status_code == 200
    body = suggested.json()
    assert body["interval_days"] == 4
    assert body["interval_source"] == "treatment_plan"
    recommended = [c for c in body["candidates"] if c["recommended"]]
    assert len(recommended) == 1

    booked = client.post(
        "/api/v1/appointments",
        json={"medical_id": "SIM-005", "patient_name": "BN Test", "date": recommended[0]["date"]},
    )
    assert booked.status_code == 201
    assert booked.json()["day_load"] == 1

    # Ngày vừa đặt giờ có 1 lịch trong daily-load.
    load = client.get("/api/v1/appointments/daily-load?days=14").json()
    day_entry = [d for d in load["days"] if d["date"] == recommended[0]["date"]]
    assert day_entry and day_entry[0]["load"] == 1


def test_book_rejects_sunday_and_full_day(monkeypatch):
    monkeypatch.setattr(appointments_router, "_database_or_none", lambda: None)
    monkeypatch.setattr(appointments_router, "_memory_appointments", [])
    monkeypatch.setattr(appointments_router, "_capacity", lambda: 1)
    client = TestClient(app)

    today = date.today()
    sunday = today + timedelta(days=(6 - today.weekday()) % 7 or 7)
    assert sunday.weekday() == 6
    rejected = client.post(
        "/api/v1/appointments",
        json={"medical_id": "SIM-001", "date": sunday.isoformat()},
    )
    assert rejected.status_code == 422

    weekday = sunday + timedelta(days=1)
    first = client.post("/api/v1/appointments", json={"medical_id": "SIM-001", "date": weekday.isoformat()})
    assert first.status_code == 201
    second = client.post("/api/v1/appointments", json={"medical_id": "SIM-002", "date": weekday.isoformat()})
    assert second.status_code == 409
