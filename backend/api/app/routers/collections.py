import base64
import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from bson import Binary, Decimal128, ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from app.auth import CurrentUser, get_current_user
from app.database import get_database

router = APIRouter(prefix="/collections", tags=["collections"])

ALLOWED_COLLECTIONS = (
    "ai_artifacts",
    "api_usage_events",
    "audit_logs",
    "clinical_notes",
    "clinical_record_versions",
    "clinical_records",
    "diagnoses",
    "documents",
    "encounters",
    "lab_reports",
    "lab_results",
    "lab_test_catalog",
    "patients",
    "practitioners",
    "rules_kham_thai",
    "rules_tu_van",
    "vital_signs",
)
ALLOWED_COLLECTION_SET = frozenset(ALLOWED_COLLECTIONS)
FIELD_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_.]{0,99}$")


def require_collection(collection_name: str):
    if collection_name not in ALLOWED_COLLECTION_SET:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
    return collection_name


def require_field(field: str) -> str:
    if not FIELD_PATTERN.fullmatch(field) or field.startswith("$"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Invalid field name")
    return field


def json_value(value: Any) -> Any:
    """Convert BSON-specific values without allowing custom encoders to leak internals."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, Decimal128):
        return str(value.to_decimal())
    if isinstance(value, Binary):
        return base64.b64encode(bytes(value)).decode("ascii")
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, (UUID, Decimal)):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return value


@router.get("")
def list_available_collections(
    _: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> dict[str, list[dict[str, Any]]]:
    existing = set(db.list_collection_names())
    return {
        "items": [
            {"name": name, "exists": name in existing}
            for name in ALLOWED_COLLECTIONS
        ]
    }


@router.get("/{collection_name}")
def list_collection_documents(
    collection_name: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100_000),
    sort_by: str = Query(default="_id", min_length=1, max_length=100),
    sort_order: Literal["asc", "desc"] = "desc",
    filter_field: str | None = Query(default=None, min_length=1, max_length=100),
    filter_value: str | None = Query(default=None, max_length=500),
    _: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> dict[str, Any]:
    collection_name = require_collection(collection_name)
    sort_by = require_field(sort_by)
    if (filter_field is None) != (filter_value is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="filter_field and filter_value must be provided together",
        )

    selector: dict[str, Any] = {}
    if filter_field is not None and filter_value is not None:
        selector[require_field(filter_field)] = filter_value

    collection = db[collection_name]
    direction = 1 if sort_order == "asc" else -1
    cursor = collection.find(selector).sort(sort_by, direction).skip(offset).limit(limit)
    items = [json_value(document) for document in cursor]
    return {
        "collection": collection_name,
        "items": items,
        "total": collection.count_documents(selector),
        "limit": limit,
        "offset": offset,
    }


@router.get("/{collection_name}/{document_id}")
def get_collection_document(
    collection_name: str,
    document_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Database = Depends(get_database),
) -> dict[str, Any]:
    collection_name = require_collection(collection_name)
    identifiers: list[dict[str, Any]] = [
        {"id": document_id},
        {"record_id": document_id},
    ]
    if ObjectId.is_valid(document_id):
        identifiers.append({"_id": ObjectId(document_id)})

    document = db[collection_name].find_one({"$or": identifiers})
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return json_value(document)
