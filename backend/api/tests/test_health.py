from fastapi.testclient import TestClient

from app import main
from app.main import app


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "clinical-api"


def test_cors_preflight_allows_configured_frontend():
    response = TestClient(app).options(
        "/api/v1/ai/check-record",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_preflight_allows_render_frontend():
    origin = "https://thap-rua-clinical-copilot-1.onrender.com"
    response = TestClient(app).options(
        "/api/v1/ai/check-record",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


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


def test_clinical_record_reads_are_public_but_mutations_require_auth():
    schema = TestClient(app).get("/openapi.json").json()
    paths = schema["paths"]
    assert "/api/v1/patients/{patient_id}" in paths
    records = paths["/api/v1/patients/{patient_id}/clinical-records"]
    assert {"get", "post"}.issubset(records)
    record = paths["/api/v1/patients/{patient_id}/clinical-records/{record_id}"]
    assert {"get", "patch"}.issubset(record)
    assert "security" not in records["get"]
    assert "security" in records["post"]
    assert "security" not in record["get"]
    assert "security" in record["patch"]
