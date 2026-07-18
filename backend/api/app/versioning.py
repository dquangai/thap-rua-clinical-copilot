from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError


RECORD_CONTENT_FIELDS = (
    "record_id",
    "visit",
    "vital_signs",
    "clinical_note",
    "diagnosis",
    "doctor",
    "signed_at",
)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def content_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def record_snapshot(document: dict[str, Any]) -> dict[str, Any]:
    return {field: document[field] for field in RECORD_CONTENT_FIELDS if field in document}


def changed_fields(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    return sorted(field for field in RECORD_CONTENT_FIELDS if before.get(field) != after.get(field))


def system_actor_snapshot() -> dict[str, str]:
    return {
        "user_id": "system",
        "display_name": "Clinical Copilot",
    }


def legacy_actor_snapshot(document: dict[str, Any]) -> dict[str, str]:
    return {
        "user_id": "legacy-import",
        "display_name": str(document.get("doctor") or "Dữ liệu trước versioning"),
    }


def ensure_versioned_record(db: Database, document: dict[str, Any]) -> dict[str, Any]:
    """Lazily backfill v1 so records created before versioning remain editable."""
    if document.get("current_version") and document.get("content_hash") and document.get("updated_by"):
        return document

    snapshot = record_snapshot(document)
    digest = content_hash(snapshot)
    actor = legacy_actor_snapshot(document)
    created_at = document.get("created_at") or datetime.now(timezone.utc)
    version_document = {
        "id": str(uuid4()),
        "record_id": document["id"],
        "patient_id": document["patient_id"],
        "version": 1,
        "snapshot": snapshot,
        "content_hash": digest,
        "changed_fields": sorted(snapshot),
        "created_by": actor,
        "created_at": created_at,
    }
    try:
        db.clinical_record_versions.insert_one(version_document)
    except DuplicateKeyError:
        pass

    db.clinical_records.update_one(
        {"id": document["id"], "patient_id": document["patient_id"], "current_version": {"$exists": False}},
        {"$set": {"current_version": 1, "content_hash": digest, "updated_by": actor}},
    )
    refreshed = db.clinical_records.find_one({"id": document["id"], "patient_id": document["patient_id"]})
    return refreshed or {**document, "current_version": 1, "content_hash": digest, "updated_by": actor}
