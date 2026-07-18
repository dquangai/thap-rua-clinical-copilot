from fastapi.testclient import TestClient

from app import main
from app.main import app


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "clinical-api"


def test_ready_pings_database(monkeypatch):
    class Database:
        def command(self, command: str):
            assert command == "ping"
            return {"ok": 1}

    monkeypatch.setattr(main, "get_database", lambda: Database())
    response = TestClient(app).get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_ready_returns_503_when_database_is_unavailable(monkeypatch):
    def unavailable():
        raise RuntimeError("connection failed")

    monkeypatch.setattr(main, "get_database", unavailable)
    response = TestClient(app).get("/ready")
    assert response.status_code == 503


def test_patient_and_clinical_record_routes_are_public():
    schema = TestClient(app).get("/openapi.json").json()
    paths = schema["paths"]
    assert "/api/v1/patients/{patient_id}" in paths
    records = paths["/api/v1/patients/{patient_id}/clinical-records"]
    assert {"get", "post"}.issubset(records)
    record = paths["/api/v1/patients/{patient_id}/clinical-records/{record_id}"]
    assert {"get", "patch"}.issubset(record)
    for operations in (records, record):
        for operation in operations.values():
            assert "security" not in operation
