import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[4]
AI_PACKAGE_ROOT = REPO_ROOT / "backend" / "ai"
if str(AI_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_PACKAGE_ROOT))

from clinical_checker.cli import load_rules  # noqa: E402
from clinical_checker.config import Settings as CheckerSettings  # noqa: E402
from clinical_checker.pipeline import (  # noqa: E402
    CriteriaValidationError,
    extract_required_criteria,
    run_check,
)

router = APIRouter(prefix="/ai", tags=["ai"])

RULES_PATH = REPO_ROOT / "rules"
LOG_PATH = REPO_ROOT / "results" / "api-runs.jsonl"
ENV_PATH = REPO_ROOT / ".env"


class CheckRecordRequest(BaseModel):
    record: dict[str, Any]
    dry_run: bool = Field(default=False, description="Chỉ redact + quét PII, không gọi LLM")


def _load_rules_or_503() -> dict[str, Any]:
    if not RULES_PATH.exists():
        raise HTTPException(status_code=503, detail=f"Không tìm thấy thư mục rules: {RULES_PATH}")
    try:
        return load_rules(RULES_PATH)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/check-record")
def check_record(payload: CheckRecordRequest) -> dict[str, Any]:
    settings = CheckerSettings.from_env(ENV_PATH)
    if not payload.dry_run and (not settings.api_key or settings.api_key == "replace_me"):
        raise HTTPException(status_code=503, detail="LLM_API_KEY chưa được cấu hình cho AI checker")
    rules = _load_rules_or_503()
    criteria_catalog = {
        criterion["item_id"]: criterion["criterion"]
        for criterion in extract_required_criteria(rules)
    }
    try:
        output = run_check(payload.record, rules, settings, LOG_PATH, dry_run=payload.dry_run)
    except CriteriaValidationError as exc:
        raise HTTPException(status_code=502, detail=f"Kết quả AI không hợp lệ: {exc}") from exc
    except RuntimeError as exc:
        message = str(exc)
        status_code = 422 if "PII" in message else 502
        raise HTTPException(status_code=status_code, detail=message) from exc
    telemetry = output.get("telemetry", {})
    meta = {
        "status": telemetry.get("status"),
        "model": telemetry.get("model"),
        "pipeline_version": telemetry.get("pipeline_version"),
        "latency_ms": telemetry.get("latency_ms"),
        "total_tokens": telemetry.get("total_tokens"),
        "api_calls": telemetry.get("api_calls"),
    }
    if payload.dry_run:
        return {"run_id": output["run_id"], "safe_record": output["safe_record"], "meta": meta}
    return {
        "run_id": output["run_id"],
        "result": output["result"],
        "criteria_catalog": criteria_catalog,
        "meta": meta,
    }
