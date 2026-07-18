import re
from datetime import datetime, timezone
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError
from pymongo.database import Database

from app.database import get_database
from app.schemas import Patient, PatientCreate

router = APIRouter(prefix="/patients", tags=["patients"])


def normalize_sex(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"female", "f", "nữ", "nu"}:
        return "FEMALE"
    if normalized in {"male", "m", "nam"}:
        return "MALE"
    return "OTHER"


def public(document: dict | None) -> dict | None:
    """Map both the legacy API schema and the current MongoDB patient schema."""
    if not document:
        return document
    result = dict(document)
    mongo_id = result.pop("_id", None)
    result["id"] = str(result.get("id") or mongo_id or result.get("hospital_patient_code"))
    result["medical_record_number"] = str(
        result.get("medical_record_number") or result.get("hospital_patient_code") or result["id"]
    )
    result["sex"] = normalize_sex(result.get("sex") or result.get("gender"))
    address = result.get("address")
    if isinstance(address, dict):
        result["address"] = address.get("full_text") or ", ".join(
            str(value) for value in address.values() if value
        )
    return result


@router.get("", response_model=list[Patient])
def list_patients(query: str | None = Query(default=None, max_length=100), limit: int = Query(default=50, ge=1, le=200), db: Database = Depends(get_database)):
    selector: dict = {}
    if query:
        pattern = re.escape(query)
        selector = {"$or": [
            {"full_name": {"$regex": pattern, "$options": "i"}},
            {"medical_record_number": {"$regex": pattern, "$options": "i"}},
            {"hospital_patient_code": {"$regex": pattern, "$options": "i"}},
        ]}
    return [public(document) for document in db.patients.find(selector).sort("created_at", -1).limit(limit)]


@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: str, db: Database = Depends(get_database)):
    identifiers: list[dict] = [
        {"id": patient_id},
        {"hospital_patient_code": patient_id},
        {"medical_record_number": patient_id},
    ]
    if ObjectId.is_valid(patient_id):
        identifiers.append({"_id": ObjectId(patient_id)})
    patient = public(db.patients.find_one({"$or": identifiers}))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("", response_model=Patient, status_code=status.HTTP_201_CREATED)
def create_patient(payload: PatientCreate, db: Database = Depends(get_database)):
    now = datetime.now(timezone.utc)
    patient = {**payload.model_dump(mode="json"), "id": str(uuid4()), "created_at": now, "updated_at": now}
    try:
        db.patients.insert_one(patient)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Medical record number already exists") from None
    return public(patient)
