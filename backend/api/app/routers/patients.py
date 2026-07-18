from fastapi import APIRouter, Depends, Query, status
from supabase import Client

from app.audit import write_audit
from app.auth import CurrentUser, get_current_user
from app.database import get_admin_client
from app.schemas import Patient, PatientCreate

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[Patient])
def list_patients(
    query: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_admin_client),
):
    request = db.table("patients").select("*").is_("deleted_at", "null").order("created_at", desc=True).limit(limit)
    if query:
        safe_query = query.replace(",", " ")
        request = request.or_(f"full_name.ilike.%{safe_query}%,medical_record_number.ilike.%{safe_query}%")
    return request.execute().data


@router.post("", response_model=Patient, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    actor: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_admin_client),
):
    patient = db.table("patients").insert(payload.model_dump(mode="json")).execute().data[0]
    write_audit(db, actor=actor, action="CREATE", entity_type="patient", entity_id=patient["id"], reason="Patient registration")
    return patient
