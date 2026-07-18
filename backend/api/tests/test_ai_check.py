import json

from fastapi.testclient import TestClient

from app.main import app

SAMPLE_RECORD = {
    "record_id": "TEST-001",
    "visit": {
        "visit_code": "KB170720260740",
        "visit_datetime": "2026-07-17T07:40:00",
        "reason": "KHÁM THAI ĐỊNH KÌ",
        "department": "Khoa Sản",
        "clinic": "Phòng khám thai",
    },
    "patient": {
        "full_name": "NGUYỄN THỊ MAI ANH",
        "age": 26,
        "gender": "Nữ",
        "phone": "0903214567",
        "address": "KP3, Phường Long Hoa, Tỉnh Tây Ninh",
    },
    "vital_signs": {"chieu_cao_cm": 158, "can_nang_kg": 50, "bmi": 20.03},
    "clinical_note": {
        "dien_bien": "Khám thai định kỳ, tim thai (+), bụng mềm",
        "huong_xu_tri": "Tái khám sau 4 tuần",
    },
    "diagnosis": {"icd10": "Z34.0", "mo_ta": "THAI 12 TUẦN 03 NGÀY"},
    "doctor": "BSCKI. Lê Thị Mỹ Hạnh",
    "signed_at": "2026-07-17T08:05:00",
}


def test_check_record_dry_run_redacts_pii():
    response = TestClient(app).post(
        "/api/v1/ai/check-record", json={"record": SAMPLE_RECORD, "dry_run": True}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["status"] == "dry_run"
    safe_record = body["safe_record"]
    assert "full_name" not in safe_record.get("patient", {})
    assert "phone" not in safe_record.get("patient", {})
    serialized = json.dumps(safe_record, ensure_ascii=False)
    assert "NGUYỄN THỊ MAI ANH" not in serialized
    assert "0903214567" not in serialized


def test_async_job_rejects_dry_run():
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/jobs", json={"record": SAMPLE_RECORD, "dry_run": True})
    assert response.status_code == 400


def test_unknown_async_job_returns_404():
    with TestClient(app) as client:
        response = client.get("/api/v1/ai/jobs/not-a-job")
    assert response.status_code == 404
