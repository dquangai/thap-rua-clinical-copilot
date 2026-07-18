from datetime import datetime, timezone
from unittest.mock import MagicMock

from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_current_user
from app.database import get_database
from app.main import app


def authenticated_client(database: MagicMock) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id="doctor-1",
        email="doctor@example.test",
    )
    app.dependency_overrides[get_database] = lambda: database
    return TestClient(app)


def clear_overrides() -> None:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_database, None)


def test_collection_routes_require_authentication():
    response = TestClient(app).get("/api/v1/collections")
    assert response.status_code == 401


def test_lists_allowed_collections_and_existing_state():
    database = MagicMock()
    database.list_collection_names.return_value = ["patients", "encounters"]
    client = authenticated_client(database)
    try:
        response = client.get("/api/v1/collections")
    finally:
        clear_overrides()

    assert response.status_code == 200
    items = {item["name"]: item["exists"] for item in response.json()["items"]}
    assert items["patients"] is True
    assert items["encounters"] is True
    assert items["audit_logs"] is False


def test_lists_documents_with_pagination_and_bson_conversion():
    database = MagicMock()
    collection = database.__getitem__.return_value
    document_id = ObjectId()
    cursor = collection.find.return_value
    cursor.sort.return_value.skip.return_value.limit.return_value = iter([
        {
            "_id": document_id,
            "id": "patient-1",
            "created_at": datetime(2026, 7, 18, tzinfo=timezone.utc),
        }
    ])
    collection.count_documents.return_value = 1
    client = authenticated_client(database)
    try:
        response = client.get("/api/v1/collections/patients?limit=10&offset=0")
    finally:
        clear_overrides()

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["_id"] == str(document_id)
    assert payload["items"][0]["created_at"] == "2026-07-18T00:00:00+00:00"
    database.__getitem__.assert_called_once_with("patients")


def test_rejects_unknown_collection_and_incomplete_filter():
    database = MagicMock()
    client = authenticated_client(database)
    try:
        unknown = client.get("/api/v1/collections/system_users")
        incomplete = client.get("/api/v1/collections/patients?filter_field=id")
    finally:
        clear_overrides()

    assert unknown.status_code == 404
    assert incomplete.status_code == 422


def test_gets_document_by_object_id():
    database = MagicMock()
    collection = database.__getitem__.return_value
    document_id = ObjectId()
    collection.find_one.return_value = {"_id": document_id, "kind": "report"}
    client = authenticated_client(database)
    try:
        response = client.get(f"/api/v1/collections/documents/{document_id}")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == {"_id": str(document_id), "kind": "report"}
