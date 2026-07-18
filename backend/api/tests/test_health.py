from fastapi.testclient import TestClient

from app.main import app


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "clinical-api"


def test_clinical_record_reads_are_public_and_mutations_require_authentication():
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
