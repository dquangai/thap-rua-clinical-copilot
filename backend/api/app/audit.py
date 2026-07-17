from typing import Any

from supabase import Client

from app.auth import CurrentUser


def write_audit(
    db: Client,
    *,
    actor: CurrentUser,
    action: str,
    entity_type: str,
    entity_id: str,
    reason: str,
    changes: dict[str, Any] | None = None,
) -> None:
    db.table("audit_events").insert(
        {
            "actor_id": actor.id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "reason": reason,
            "changes": changes or {},
        }
    ).execute()
