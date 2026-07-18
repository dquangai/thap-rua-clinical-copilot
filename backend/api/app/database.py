from functools import lru_cache

from fastapi import HTTPException, status
from pymongo import MongoClient
from pymongo.database import Database

from app.config import get_settings


@lru_cache
def get_database() -> Database:
    settings = get_settings()
    if not settings.mongodb_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB Atlas is not configured",
        )
    client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000, tz_aware=True)
    return client[settings.mongodb_database]


def ensure_indexes(db: Database) -> None:
    db.patients.create_index("medical_record_number", unique=True)
    db.clinical_records.create_index([("patient_id", 1), ("created_at", -1)])
    db.clinical_records.create_index(
        "record_id",
        unique=True,
        partialFilterExpression={"record_id": {"$type": "string"}},
    )
