from unittest.mock import MagicMock

from bson import ObjectId
from fastapi.testclient import TestClient

from app.database import get_database
from app.main import app


def test_lists_patients_using_current_mongodb_schema():
    database = MagicMock()
    patient_id = ObjectId()
    cursor = database.patients.find.return_value
    cursor.sort.return_value.limit.return_value = iter([
        {
            "_id": patient_id,
            "hospital_patient_code": "BN000004",
            "full_name": "PHẠM THÚY HẰNG",
            "date_of_birth": "1997-04-15",
            "gender": "female",
            "phone": "0965328741",
            "address": {
                "full_text": "Ấp Long Yên, Xã Long Thành Nam, Tỉnh Tây Ninh",
                "province": "Tây Ninh",
                "ward": "Long Thành Nam",
            },
            "created_at": "2026-07-17T10:00:00Z",
            "updated_at": "2026-07-17T10:00:00Z",
        }
    ])
    app.dependency_overrides[get_database] = lambda: database
    try:
        response = TestClient(app).get("/api/v1/patients")
    finally:
        app.dependency_overrides.pop(get_database, None)

    assert response.status_code == 200
    patient = response.json()[0]
    assert patient["id"] == str(patient_id)
    assert patient["medical_record_number"] == "BN000004"
    assert patient["sex"] == "FEMALE"
    assert patient["address"] == "Ấp Long Yên, Xã Long Thành Nam, Tỉnh Tây Ninh"


def test_get_patient_accepts_mongodb_object_id():
    database = MagicMock()
    patient_id = ObjectId()
    database.patients.find_one.return_value = {
        "_id": patient_id,
        "hospital_patient_code": "BN000004",
        "full_name": "Patient",
        "date_of_birth": None,
        "gender": "other",
        "phone": None,
        "address": None,
        "created_at": "2026-07-17T10:00:00Z",
        "updated_at": "2026-07-17T10:00:00Z",
    }
    app.dependency_overrides[get_database] = lambda: database
    try:
        response = TestClient(app).get(f"/api/v1/patients/{patient_id}")
    finally:
        app.dependency_overrides.pop(get_database, None)

    assert response.status_code == 200
    assert response.json()["id"] == str(patient_id)
    selector = database.patients.find_one.call_args.args[0]
    assert {"_id": patient_id} in selector["$or"]
