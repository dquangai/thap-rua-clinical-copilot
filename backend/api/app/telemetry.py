from typing import Any

from app.database import get_admin_client


def write_api_usage(*, endpoint: str, method: str, telemetry: dict[str, Any], actor_id: str | None = None, status_code: int = 200) -> None:
    """Persist technical metrics only. Never pass request or clinical payloads here."""
    try:
        get_admin_client().table("api_usage_events").insert({
            "actor_id": actor_id,
            "endpoint": endpoint,
            "method": method,
            "status_code": status_code,
            "status": telemetry.get("status", "unknown"),
            "model": telemetry.get("model"),
            "pipeline_version": telemetry.get("pipeline_version"),
            "latency_ms": telemetry.get("latency_ms") or 0,
            "runtime_ms": telemetry.get("latency_ms") or 0,
            "input_tokens": telemetry.get("input_tokens") or 0,
            "output_tokens": telemetry.get("output_tokens") or 0,
            "total_tokens": telemetry.get("total_tokens") or 0,
            "api_calls": telemetry.get("api_calls") or 0,
            "cost_usd": telemetry.get("estimated_cost_usd") or telemetry.get("cost_usd") or 0,
        }).execute()
    except Exception:
        # Observability must never make a clinical request fail.
        return
