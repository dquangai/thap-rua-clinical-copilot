from datetime import datetime, timezone
from unittest.mock import MagicMock

from bson import ObjectId
from fastapi.testclient import TestClient

from app.database import get_database
from app.main import app


def client_with_database(database: MagicMock) -> TestClient:
    app.dependency_overrides[get_database] = lambda: database
    return TestClient(app)


def clear_overrides() -> None:
    app.dependency_overrides.pop(get_database, None)


def test_gets_tu_van_rules_with_pagination_and_bson_conversion():
    database = MagicMock()
    collection = database.__getitem__.return_value
    document_id = ObjectId()
    cursor = collection.find.return_value
    cursor.sort.return_value.skip.return_value.limit.return_value = iter([
        {
            "_id": document_id,
            "rule_id": "R08",
            "updated_at": datetime(2026, 7, 18, tzinfo=timezone.utc),
        }
    ])
    collection.count_documents.return_value = 1
    client = client_with_database(database)
    try:
        response = client.get("/api/v1/rules/tu-van?limit=10&offset=2")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json() == {
        "collection": "rules_tu_van",
        "items": [{
            "_id": str(document_id),
            "rule_id": "R08",
            "updated_at": "2026-07-18T00:00:00+00:00",
        }],
        "total": 1,
        "limit": 10,
        "offset": 2,
    }
    database.__getitem__.assert_called_once_with("rules_tu_van")


def test_gets_kham_thai_rules_from_expected_collection():
    database = MagicMock()
    collection = database.__getitem__.return_value
    cursor = collection.find.return_value
    cursor.sort.return_value.skip.return_value.limit.return_value = iter([
        {"rule_id": "R01", "severity": "MAJOR"}
    ])
    collection.count_documents.return_value = 1
    client = client_with_database(database)
    try:
        response = client.get("/api/v1/rules/kham-thai")
    finally:
        clear_overrides()

    assert response.status_code == 200
    assert response.json()["items"] == [{"rule_id": "R01", "severity": "MAJOR"}]
    database.__getitem__.assert_called_once_with("rules_kham_thai")


def test_rejects_invalid_rule_pagination():
    client = client_with_database(MagicMock())
    try:
        response = client.get("/api/v1/rules/tu-van?limit=201")
    finally:
        clear_overrides()

    assert response.status_code == 422
