from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from app.audit import write_audit
from app.auth import CurrentUser, require_admin
from app.config import Settings, get_settings
from app.database import get_admin_client
from app.schemas import AdminRecordAction, AdminUserCreate, AdminUserUpdate

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/overview")
def overview(days: int = Query(default=30, ge=1, le=365), db: Client = Depends(get_admin_client)):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    events = db.table("api_usage_events").select("*").gte("occurred_at", since).order("occurred_at", desc=True).limit(5000).execute().data
    users = db.table("profiles").select("id,active").execute().data
    encounters = db.table("encounters").select("id,deleted_at").execute().data
    latencies = sorted(float(item.get("latency_ms") or 0) for item in events)
    def percentile(ratio: float) -> float:
        if not latencies:
            return 0
        return latencies[min(round((len(latencies) - 1) * ratio), len(latencies) - 1)]
    return {
        "period_days": days,
        "users": {"total": len(users), "active": sum(1 for row in users if row["active"])},
        "records": {"total": len(encounters), "deleted": sum(1 for row in encounters if row.get("deleted_at"))},
        "api": {
            "calls": len(events),
            "errors": sum(1 for item in events if int(item.get("status_code") or 0) >= 400),
            "cost_usd": round(sum(float(item.get("cost_usd") or 0) for item in events), 6),
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0,
            "p50_latency_ms": percentile(.5), "p95_latency_ms": percentile(.95), "p99_latency_ms": percentile(.99),
            "total_tokens": sum(int(item.get("total_tokens") or 0) for item in events),
        },
    }


@router.get("/users")
def list_users(db: Client = Depends(get_admin_client)):
    return db.table("profiles").select("id,full_name,department_id,role,active,last_login_at,created_at,departments(name)").order("created_at", desc=True).execute().data


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminUserCreate, actor: CurrentUser = Depends(require_admin), db: Client = Depends(get_admin_client), settings: Settings = Depends(get_settings)):
    if payload.role == "ADMIN" and actor.role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only a super administrator can create administrators")
    response = httpx.post(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users",
        headers={"apikey": settings.supabase_secret_key, "Authorization": f"Bearer {settings.supabase_secret_key}"},
        json={"email": str(payload.email), "password": payload.password, "email_confirm": True, "user_metadata": {"full_name": payload.full_name}}, timeout=10,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=response.json().get("msg", "Unable to create account"))
    user_id = response.json()["id"]
    profile = db.table("profiles").update({"full_name": payload.full_name, "department_id": str(payload.department_id) if payload.department_id else None, "role": payload.role}).eq("id", user_id).execute().data[0]
    write_audit(db, actor=actor, action="CREATE", entity_type="user", entity_id=user_id, reason="Admin created clinician account", changes={"role": payload.role})
    return profile


@router.patch("/users/{user_id}")
def update_user(user_id: UUID, payload: AdminUserUpdate, actor: CurrentUser = Depends(require_admin), db: Client = Depends(get_admin_client)):
    changes = payload.model_dump(exclude_unset=True, mode="json")
    if not changes:
        raise HTTPException(status_code=400, detail="No changes supplied")
    if str(user_id) == actor.id and changes.get("active") is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    target = db.table("profiles").select("role").eq("id", str(user_id)).limit(1).execute().data
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if actor.role != "SUPER_ADMIN" and (target[0]["role"] in {"ADMIN", "SUPER_ADMIN"} or changes.get("role") == "ADMIN"):
        raise HTTPException(status_code=403, detail="Only a super administrator can manage administrators")
    if changes.get("active") is False:
        changes["deactivated_at"] = datetime.now(timezone.utc).isoformat()
    elif changes.get("active") is True:
        changes["deactivated_at"] = None
    rows = db.table("profiles").update(changes).eq("id", str(user_id)).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    write_audit(db, actor=actor, action="UPDATE", entity_type="user", entity_id=str(user_id), reason="Admin updated account", changes=changes)
    return rows[0]


@router.get("/api-usage")
def api_usage(limit: int = Query(default=100, ge=1, le=500), db: Client = Depends(get_admin_client)):
    return db.table("api_usage_events").select("*").order("occurred_at", desc=True).limit(limit).execute().data


@router.get("/audit-events")
def audit_events(limit: int = Query(default=100, ge=1, le=500), db: Client = Depends(get_admin_client)):
    return db.table("audit_events").select("*").order("occurred_at", desc=True).limit(limit).execute().data


@router.get("/records")
def records(limit: int = Query(default=100, ge=1, le=500), db: Client = Depends(get_admin_client)):
    return db.table("encounters").select("id,status,reason,created_at,updated_at,deleted_at,deletion_reason,patient:patients(id,medical_record_number,full_name),doctor:profiles!encounters_attending_clinician_id_fkey(full_name)").order("created_at", desc=True).limit(limit).execute().data


@router.post("/records/{record_id}/delete")
def delete_record(record_id: UUID, payload: AdminRecordAction, actor: CurrentUser = Depends(require_admin), db: Client = Depends(get_admin_client)):
    before = db.table("encounters").select("*").eq("id", str(record_id)).limit(1).execute().data
    if not before: raise HTTPException(status_code=404, detail="Record not found")
    changes = {"deleted_at": datetime.now(timezone.utc).isoformat(), "deleted_by": actor.id, "deletion_reason": payload.reason}
    after = db.table("encounters").update(changes).eq("id", str(record_id)).execute().data[0]
    db.table("record_versions").insert({"entity_type":"encounter","entity_id":str(record_id),"operation":"DELETE","actor_id":actor.id,"reason":payload.reason,"before_data":before[0],"after_data":after}).execute()
    write_audit(db, actor=actor, action="DELETE", entity_type="encounter", entity_id=str(record_id), reason=payload.reason)
    return after


@router.post("/records/{record_id}/restore")
def restore_record(record_id: UUID, payload: AdminRecordAction, actor: CurrentUser = Depends(require_admin), db: Client = Depends(get_admin_client)):
    before = db.table("encounters").select("*").eq("id", str(record_id)).limit(1).execute().data
    if not before: raise HTTPException(status_code=404, detail="Record not found")
    after = db.table("encounters").update({"deleted_at":None,"deleted_by":None,"deletion_reason":None}).eq("id", str(record_id)).execute().data[0]
    db.table("record_versions").insert({"entity_type":"encounter","entity_id":str(record_id),"operation":"RESTORE","actor_id":actor.id,"reason":payload.reason,"before_data":before[0],"after_data":after}).execute()
    write_audit(db, actor=actor, action="RESTORE", entity_type="encounter", entity_id=str(record_id), reason=payload.reason)
    return after
