import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError
from pymongo.database import Database

from app.database import get_database
from app.schemas import Patient, PatientCreate

router = APIRouter(prefix="/patients", tags=["patients"])


def public(document: dict | None) -> dict | None:
    if document:
        document.pop("_id", None)
    return document


@router.get("", response_model=list[Patient])
<<<<<<< HEAD
def list_patients(query: str | None = Query(default=None, max_length=100), limit: int = Query(default=50, ge=1, le=200), db: Database = Depends(get_database)):
    selector: dict = {}
=======
def list_patients(
    query: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_admin_client),
):
    request = db.table("patients").select("*").is_("deleted_at", "null").order("created_at", desc=True).limit(limit)
>>>>>>> db90767f961a5f7159500429b95e69d6ca7049f6
    if query:
        pattern = re.escape(query)
        selector = {"$or": [{"full_name": {"$regex": pattern, "$options": "i"}}, {"medical_record_number": {"$regex": pattern, "$options": "i"}}]}
    return list(db.patients.find(selector, {"_id": 0}).sort("created_at", -1).limit(limit))


@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: str, db: Database = Depends(get_database)):
    patient = public(db.patients.find_one({"id": patient_id}))
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
