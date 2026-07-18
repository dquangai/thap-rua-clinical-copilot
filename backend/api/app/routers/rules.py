from typing import Any

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.database import get_database
from app.routers.collections import json_value

router = APIRouter(prefix="/rules", tags=["rules"])


def list_rules(
    collection_name: str,
    limit: int,
    offset: int,
    db: Database,
) -> dict[str, Any]:
    collection = db[collection_name]
    cursor = collection.find({}).sort("_id", 1).skip(offset).limit(limit)
    return {
        "collection": collection_name,
        "items": [json_value(document) for document in cursor],
        "total": collection.count_documents({}),
        "limit": limit,
        "offset": offset,
    }


@router.get("/tu-van")
def get_tu_van_rules(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100_000),
    db: Database = Depends(get_database),
) -> dict[str, Any]:
    return list_rules("rules_tu_van", limit, offset, db)


@router.get("/kham-thai")
def get_kham_thai_rules(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100_000),
    db: Database = Depends(get_database),
) -> dict[str, Any]:
    return list_rules("rules_kham_thai", limit, offset, db)
