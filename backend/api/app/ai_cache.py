from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.versioning import content_hash


def make_cache_key(
    artifact_type: str,
    safe_input: dict[str, Any],
    *,
    pipeline_version: str,
    prompt_version: str,
    rules_version: str = "none",
    model: str,
) -> tuple[str, str]:
    input_hash = content_hash(safe_input)
    key = content_hash(
        {
            "artifact_type": artifact_type,
            "input_hash": input_hash,
            "pipeline_version": pipeline_version,
            "prompt_version": prompt_version,
            "rules_version": rules_version,
            "model": model,
        }
    )
    return key, input_hash


def get_cached(db: Database, cache_key: str) -> dict[str, Any] | None:
    artifact = db.ai_artifacts.find_one({"cache_key": cache_key, "status": "completed"})
    return artifact.get("response") if artifact else None


def store_cached(
    db: Database,
    *,
    cache_key: str,
    input_hash: str,
    artifact_type: str,
    response: dict[str, Any],
    pipeline_version: str,
    prompt_version: str,
    rules_version: str,
    model: str,
    record_id: str | None = None,
    record_version: int | None = None,
) -> None:
    document = {
        "id": str(uuid4()),
        "cache_key": cache_key,
        "input_hash": input_hash,
        "artifact_type": artifact_type,
        "record_id": record_id,
        "record_version": record_version,
        "pipeline_version": pipeline_version,
        "prompt_version": prompt_version,
        "rules_version": rules_version,
        "model": model,
        "status": "completed",
        "response": response,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        db.ai_artifacts.insert_one(document)
    except DuplicateKeyError:
        # Another worker completed the same deterministic request first.
        pass
