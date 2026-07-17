from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.audit import write_audit
from app.auth import CurrentUser, get_current_user
from app.database import get_admin_client
from app.schemas import ClinicalNote, ClinicalNoteCreate, ClinicalRecordImport, ClinicalRecordImportResult, Encounter, EncounterCreate, EncounterStatusUpdate, Workspace

router = APIRouter(prefix="/encounters", tags=["encounters"])


@router.post("/import-clinical-record", response_model=ClinicalRecordImportResult, status_code=status.HTTP_201_CREATED)
def import_clinical_record(
    payload: ClinicalRecordImport,
    actor: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_admin_client),
):
    encounter_id = db.rpc(
        "import_clinical_record",
        {"payload": payload.model_dump(mode="json"), "actor_id": actor.id},
    ).execute().data
    return {"encounter_id": encounter_id}


@router.get("", response_model=list[Encounter])
def list_encounters(
    department_id: UUID | None = None,
    encounter_status: str | None = Query(default=None, alias="status"),
    _: CurrentUser = Depends(get_current_user),
    db: Client = Depends(get_admin_client),
):
    request = db.table("encounters").select("*").order("created_at")
    if department_id:
        request = request.eq("department_id", str(department_id))
    if encounter_status:
        request = request.eq("status", encounter_status)
    return request.execute().data


@router.post("", response_model=Encounter, status_code=status.HTTP_201_CREATED)
def create_encounter(payload: EncounterCreate, actor: CurrentUser = Depends(get_current_user), db: Client = Depends(get_admin_client)):
    data = payload.model_dump(mode="json")
    data["created_by"] = actor.id
    encounter = db.table("encounters").insert(data).execute().data[0]
    write_audit(db, actor=actor, action="CREATE", entity_type="encounter", entity_id=encounter["id"], reason="Encounter registration")
    return encounter


@router.patch("/{encounter_id}/status", response_model=Encounter)
def update_status(encounter_id: UUID, payload: EncounterStatusUpdate, actor: CurrentUser = Depends(get_current_user), db: Client = Depends(get_admin_client)):
    now = datetime.now(timezone.utc).isoformat()
    changes = {"status": payload.status.value}
    if payload.status.value == "IN_PROGRESS":
        changes["started_at"] = now
    elif payload.status.value in {"COMPLETED", "CANCELLED"}:
        changes["ended_at"] = now
    rows = db.table("encounters").update(changes).eq("id", str(encounter_id)).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Encounter not found")
    write_audit(db, actor=actor, action="STATUS_CHANGE", entity_type="encounter", entity_id=str(encounter_id), reason=payload.reason, changes=changes)
    return rows[0]


@router.post("/{encounter_id}/notes", response_model=ClinicalNote, status_code=status.HTTP_201_CREATED)
def create_note(encounter_id: UUID, payload: ClinicalNoteCreate, actor: CurrentUser = Depends(get_current_user), db: Client = Depends(get_admin_client)):
    note_data = payload.model_dump(exclude={"reason"})
    note_data.update({"encounter_id": str(encounter_id), "authored_by": actor.id})
    note = db.table("clinical_notes").insert(note_data).execute().data[0]
    write_audit(db, actor=actor, action="CREATE", entity_type="clinical_note", entity_id=note["id"], reason=payload.reason)
    return note


@router.get("/{encounter_id}/workspace", response_model=Workspace)
def get_workspace(encounter_id: UUID, _: CurrentUser = Depends(get_current_user), db: Client = Depends(get_admin_client)):
    rows = db.table("encounters").select("*, patient:patients(*)").eq("id", str(encounter_id)).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Encounter not found")
    encounter = rows[0]
    patient = encounter.pop("patient")
    notes = db.table("clinical_notes").select("*").eq("encounter_id", str(encounter_id)).order("authored_at").execute().data
    vital_rows = db.table("vital_signs").select("*").eq("encounter_id", str(encounter_id)).limit(1).execute().data
    diagnoses = db.table("diagnoses").select("*").eq("encounter_id", str(encounter_id)).execute().data
    conclusion_rows = db.table("clinical_conclusions").select("*").eq("encounter_id", str(encounter_id)).limit(1).execute().data
    return {
        "patient": patient,
        "encounter": encounter,
        "notes": notes,
        "vital_signs": vital_rows[0] if vital_rows else None,
        "diagnoses": diagnoses,
        "conclusion": conclusion_rows[0] if conclusion_rows else None,
    }
