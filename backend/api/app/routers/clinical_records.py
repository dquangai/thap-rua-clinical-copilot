from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.schemas import (
    ClinicalRecord,
    ClinicalRecordCreate,
    ClinicalRecordDiff,
    ClinicalRecordRestore,
    ClinicalRecordUpdate,
    ClinicalRecordVersion,
)
from app.versioning import (
    RECORD_CONTENT_FIELDS,
    changed_fields,
    content_hash,
    ensure_versioned_record,
    record_snapshot,
    system_actor_snapshot,
)

router = APIRouter(prefix="/patients/{patient_id}/clinical-records", tags=["clinical-records"])


def public(document: dict | None) -> dict | None:
    if document:
        document.pop("_id", None)
    return document


def require_patient(patient_id: str, db: Database) -> None:
    if not db.patients.find_one({"id": patient_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Patient not found")


def require_record(patient_id: str, record_id: str, db: Database) -> dict[str, Any]:
    document = db.clinical_records.find_one({"id": record_id, "patient_id": patient_id})
    if not document:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    return ensure_versioned_record(db, document)


def version_document(
    record: dict[str, Any],
    *,
    version: int,
    snapshot: dict[str, Any],
    actor: dict[str, Any],
    before: dict[str, Any] | None,
    restored_from_version: int | None = None,
) -> dict[str, Any]:
    document = {
        "id": str(uuid4()),
        "record_id": record["id"],
        "patient_id": record["patient_id"],
        "version": version,
        "snapshot": deepcopy(snapshot),
        "content_hash": content_hash(snapshot),
        "changed_fields": sorted(snapshot) if before is None else changed_fields(before, snapshot),
        "created_by": actor,
        "created_at": datetime.now(timezone.utc),
    }
    if restored_from_version is not None:
        document["restored_from_version"] = restored_from_version
    return document


def conflict(expected: int, actual: int) -> HTTPException:
    return HTTPException(
        status_code=409,
        detail={
            "code": "VERSION_CONFLICT",
            "message": "Clinical record was changed by another user",
            "expected_version": expected,
            "current_version": actual,
        },
    )


@router.get("", response_model=list[ClinicalRecord])
def list_records(
    patient_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Database = Depends(get_database),
):
    require_patient(patient_id, db)
    records = db.clinical_records.find({"patient_id": patient_id}).sort("created_at", -1).limit(limit)
    return [public(ensure_versioned_record(db, record)) for record in records]


@router.get("/{record_id}", response_model=ClinicalRecord)
def get_record(patient_id: str, record_id: str, db: Database = Depends(get_database)):
    return public(require_record(patient_id, record_id, db))


@router.post("", response_model=ClinicalRecord, status_code=status.HTTP_201_CREATED)
def create_record(
    patient_id: str,
    payload: ClinicalRecordCreate,
    db: Database = Depends(get_database),
):
    require_patient(patient_id, db)
    now = datetime.now(timezone.utc)
    actor_data = system_actor_snapshot()
    record = {
        **payload.model_dump(mode="json", exclude_none=True),
        "id": str(uuid4()),
        "patient_id": patient_id,
        "current_version": 1,
        "updated_by": actor_data,
        "created_at": now,
        "updated_at": now,
    }
    snapshot = record_snapshot(record)
    record["content_hash"] = content_hash(snapshot)
    initial_version = version_document(
        record,
        version=1,
        snapshot=snapshot,
        actor=actor_data,
        before=None,
    )
    try:
        db.clinical_records.insert_one(record)
        try:
            db.clinical_record_versions.insert_one(initial_version)
        except Exception:
            db.clinical_records.delete_one({"id": record["id"], "current_version": 1})
            raise
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="record_id already exists") from None
    return public(record)


@router.patch("/{record_id}", response_model=ClinicalRecord)
def update_record(
    patient_id: str,
    record_id: str,
    payload: ClinicalRecordUpdate,
    expected_version: int = Header(alias="If-Match-Version", ge=1),
    db: Database = Depends(get_database),
):
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field is required")

    current = require_record(patient_id, record_id, db)
    actual_version = int(current["current_version"])
    if actual_version != expected_version:
        raise conflict(expected_version, actual_version)

    before = record_snapshot(current)
    after = {**before, **changes}
    digest = content_hash(after)
    if digest == current["content_hash"]:
        return public(current)

    actor_data = system_actor_snapshot()
    next_version = actual_version + 1
    history = version_document(
        current,
        version=next_version,
        snapshot=after,
        actor=actor_data,
        before=before,
    )
    try:
        db.clinical_record_versions.insert_one(history)
    except DuplicateKeyError:
        latest = db.clinical_records.find_one({"id": record_id, "patient_id": patient_id}) or current
        raise conflict(expected_version, int(latest.get("current_version", actual_version))) from None

    update_fields = {
        **changes,
        "current_version": next_version,
        "content_hash": digest,
        "updated_by": actor_data,
        "updated_at": datetime.now(timezone.utc),
    }
    try:
        updated = db.clinical_records.find_one_and_update(
            {
                "id": record_id,
                "patient_id": patient_id,
                "current_version": expected_version,
                "content_hash": current["content_hash"],
            },
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        db.clinical_record_versions.delete_one({"id": history["id"]})
        raise HTTPException(status_code=409, detail="record_id already exists") from None
    except Exception:
        db.clinical_record_versions.delete_one({"id": history["id"]})
        raise
    if not updated:
        db.clinical_record_versions.delete_one({"id": history["id"]})
        latest = db.clinical_records.find_one({"id": record_id, "patient_id": patient_id}) or current
        raise conflict(expected_version, int(latest.get("current_version", actual_version)))
    return public(updated)


@router.get("/{record_id}/versions", response_model=list[ClinicalRecordVersion])
def list_versions(
    patient_id: str,
    record_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    before_version: int | None = Query(default=None, ge=1),
    db: Database = Depends(get_database),
):
    require_record(patient_id, record_id, db)
    selector: dict[str, Any] = {"patient_id": patient_id, "record_id": record_id}
    if before_version is not None:
        selector["version"] = {"$lt": before_version}
    versions = db.clinical_record_versions.find(selector, {"_id": 0}).sort("version", -1).limit(limit)
    return list(versions)


@router.get("/{record_id}/versions/{version}", response_model=ClinicalRecordVersion)
def get_version(patient_id: str, record_id: str, version: int, db: Database = Depends(get_database)):
    require_record(patient_id, record_id, db)
    document = public(
        db.clinical_record_versions.find_one(
            {"patient_id": patient_id, "record_id": record_id, "version": version}
        )
    )
    if not document:
        raise HTTPException(status_code=404, detail="Clinical record version not found")
    return document


@router.get("/{record_id}/versions/{version}/diff", response_model=ClinicalRecordDiff)
def diff_version(
    patient_id: str,
    record_id: str,
    version: int,
    compare_to: int | None = Query(default=None, ge=1),
    db: Database = Depends(get_database),
):
    target = get_version(patient_id, record_id, version, db)
    from_version = compare_to if compare_to is not None else version - 1
    source: dict[str, Any] | None = None
    if from_version >= 1:
        source = db.clinical_record_versions.find_one(
            {"patient_id": patient_id, "record_id": record_id, "version": from_version}
        )
        if not source:
            raise HTTPException(status_code=404, detail="Comparison version not found")
    before = source.get("snapshot", {}) if source else {}
    after = target["snapshot"]
    fields = changed_fields(before, after)
    return {
        "record_id": record_id,
        "from_version": from_version if source else None,
        "to_version": version,
        "changed_fields": fields,
        "changes": {field: {"before": before.get(field), "after": after.get(field)} for field in fields},
    }


@router.post("/{record_id}/versions/{version}/restore", response_model=ClinicalRecord)
def restore_version(
    patient_id: str,
    record_id: str,
    version: int,
    payload: ClinicalRecordRestore,
    db: Database = Depends(get_database),
):
    current = require_record(patient_id, record_id, db)
    actual_version = int(current["current_version"])
    if actual_version != payload.expected_version:
        raise conflict(payload.expected_version, actual_version)

    target = db.clinical_record_versions.find_one(
        {"patient_id": patient_id, "record_id": record_id, "version": version}
    )
    if not target:
        raise HTTPException(status_code=404, detail="Clinical record version not found")

    before = record_snapshot(current)
    restored = deepcopy(target["snapshot"])
    actor_data = system_actor_snapshot()
    next_version = actual_version + 1
    history = version_document(
        current,
        version=next_version,
        snapshot=restored,
        actor=actor_data,
        before=before,
        restored_from_version=version,
    )
    try:
        db.clinical_record_versions.insert_one(history)
    except DuplicateKeyError:
        latest = db.clinical_records.find_one({"id": record_id, "patient_id": patient_id}) or current
        raise conflict(payload.expected_version, int(latest.get("current_version", actual_version))) from None

    unset_fields = {field: "" for field in RECORD_CONTENT_FIELDS if field not in restored}
    update: dict[str, Any] = {
        "$set": {
            **restored,
            "current_version": next_version,
            "content_hash": history["content_hash"],
            "updated_by": actor_data,
            "updated_at": datetime.now(timezone.utc),
        }
    }
    if unset_fields:
        update["$unset"] = unset_fields
    try:
        updated = db.clinical_records.find_one_and_update(
            {
                "id": record_id,
                "patient_id": patient_id,
                "current_version": payload.expected_version,
                "content_hash": current["content_hash"],
            },
            update,
            return_document=ReturnDocument.AFTER,
        )
    except Exception:
        db.clinical_record_versions.delete_one({"id": history["id"]})
        raise
    if not updated:
        db.clinical_record_versions.delete_one({"id": history["id"]})
        latest = db.clinical_records.find_one({"id": record_id, "patient_id": patient_id}) or current
        raise conflict(payload.expected_version, int(latest.get("current_version", actual_version)))
    return public(updated)
