from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.database import get_database
from app.schemas import ClinicalRecord, ClinicalRecordCreate, ClinicalRecordUpdate

router = APIRouter(prefix="/patients/{patient_id}/clinical-records", tags=["clinical-records"])


def public(document: dict | None) -> dict | None:
    if document:
        document.pop("_id", None)
    return document


def require_patient(patient_id: str, db: Database) -> None:
    if not db.patients.find_one({"id": patient_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Patient not found")


@router.get("", response_model=list[ClinicalRecord])
def list_records(patient_id: str, limit: int = Query(default=50, ge=1, le=200), db: Database = Depends(get_database)):
    require_patient(patient_id, db)
    return list(db.clinical_records.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).limit(limit))


@router.get("/{record_id}", response_model=ClinicalRecord)
def get_record(patient_id: str, record_id: str, db: Database = Depends(get_database)):
    record = public(db.clinical_records.find_one({"id": record_id, "patient_id": patient_id}))
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    return record


@router.post("", response_model=ClinicalRecord, status_code=status.HTTP_201_CREATED)
def create_record(patient_id: str, payload: ClinicalRecordCreate, db: Database = Depends(get_database)):
    require_patient(patient_id, db)
    now = datetime.now(timezone.utc)
    record = {**payload.model_dump(mode="json", exclude_none=True), "id": str(uuid4()), "patient_id": patient_id, "created_at": now, "updated_at": now}
    try:
        db.clinical_records.insert_one(record)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="record_id already exists") from None
    return public(record)


@router.patch("/{record_id}", response_model=ClinicalRecord)
def update_record(patient_id: str, record_id: str, payload: ClinicalRecordUpdate, db: Database = Depends(get_database)):
    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="At least one field is required")
    changes["updated_at"] = datetime.now(timezone.utc)
    try:
        record = db.clinical_records.find_one_and_update({"id": record_id, "patient_id": patient_id}, {"$set": changes}, return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="record_id already exists") from None
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    return public(record)
