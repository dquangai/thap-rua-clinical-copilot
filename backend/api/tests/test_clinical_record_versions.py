from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_current_user
from app.database import get_database
from app.main import app
from tests.fake_mongo import FakeDatabase


def test_create_update_noop_conflict_diff_and_restore_versions():
    db = FakeDatabase(patients=[{"id": "patient-1"}])
    app.dependency_overrides[get_database] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="doctor-1",
        email="doctor@example.test",
        display_name="BS. Nguyễn Văn A",
    )
    try:
        client = TestClient(app)
        created_response = client.post(
            "/api/v1/patients/patient-1/clinical-records",
            json={"record_id": "HS-001", "diagnosis": {"icd10": "Z34.0"}},
        )
        assert created_response.status_code == 201
        created = created_response.json()
        record_id = created["id"]
        assert created["current_version"] == 1
        assert created["updated_by"]["display_name"] == "BS. Nguyễn Văn A"

        updated_response = client.patch(
            f"/api/v1/patients/patient-1/clinical-records/{record_id}",
            headers={"If-Match-Version": "1"},
            json={"diagnosis": {"icd10": "O24.4"}},
        )
        assert updated_response.status_code == 200
        assert updated_response.json()["current_version"] == 2

        noop_response = client.patch(
            f"/api/v1/patients/patient-1/clinical-records/{record_id}",
            headers={"If-Match-Version": "2"},
            json={"diagnosis": {"icd10": "O24.4"}},
        )
        assert noop_response.status_code == 200
        assert noop_response.json()["current_version"] == 2

        versions_response = client.get(
            f"/api/v1/patients/patient-1/clinical-records/{record_id}/versions"
        )
        assert versions_response.status_code == 200
        assert [item["version"] for item in versions_response.json()] == [2, 1]

        stale_response = client.patch(
            f"/api/v1/patients/patient-1/clinical-records/{record_id}",
            headers={"If-Match-Version": "1"},
            json={"diagnosis": {"icd10": "Z00.0"}},
        )
        assert stale_response.status_code == 409
        assert stale_response.json()["detail"]["code"] == "VERSION_CONFLICT"

        diff_response = client.get(
            f"/api/v1/patients/patient-1/clinical-records/{record_id}/versions/2/diff"
        )
        assert diff_response.status_code == 200
        assert diff_response.json()["changed_fields"] == ["diagnosis"]

        restored_response = client.post(
            f"/api/v1/patients/patient-1/clinical-records/{record_id}/versions/1/restore",
            json={"expected_version": 2},
        )
        assert restored_response.status_code == 200
        restored = restored_response.json()
        assert restored["current_version"] == 3
        assert restored["diagnosis"] == {"icd10": "Z34.0"}
        assert len(db.clinical_record_versions.rows) == 3
        assert db.clinical_record_versions.rows[-1]["restored_from_version"] == 1
    finally:
        app.dependency_overrides.clear()


def test_clinical_record_mutation_requires_doctor_identity():
    db = FakeDatabase(patients=[{"id": "patient-1"}])
    app.dependency_overrides[get_database] = lambda: db
    try:
        response = TestClient(app).post(
            "/api/v1/patients/patient-1/clinical-records",
            json={"diagnosis": {}},
        )
        assert response.status_code == 401
    finally:
        app.dependency_overrides.clear()
