import json
import re
import sys
import time
from copy import deepcopy
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from app.ai_cache import get_cached, make_cache_key, store_cached
from app.database import get_database
from app.telemetry import write_api_usage
from app.versioning import content_hash

REPO_ROOT = Path(__file__).resolve().parents[4]
AI_PACKAGE_ROOT = REPO_ROOT / "backend" / "ai"
if str(AI_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_PACKAGE_ROOT))

from clinical_checker.cli import load_rules  # noqa: E402
from clinical_checker.config import Settings as CheckerSettings  # noqa: E402
from clinical_checker.pipeline import (  # noqa: E402
    CriteriaValidationError,
    SYSTEM_PROMPT,
    extract_required_criteria,
    run_check,
)
from clinical_checker.privacy import (  # noqa: E402
    build_minimum_necessary_record,
    find_residual_pii,
)
from clinical_checker.provider import call_llm  # noqa: E402

router = APIRouter(prefix="/ai", tags=["ai"])

RULES_PATH = REPO_ROOT / "rules"
LOG_PATH = REPO_ROOT / "results" / "api-runs.jsonl"
ENV_PATH = REPO_ROOT / ".env"


COUNSELING_SYSTEM_PROMPT = (
    "Bạn là bác sĩ sản khoa soạn biên bản tư vấn cho thai phụ dựa trên hồ sơ khám đã ẩn danh.\n"
    "Yêu cầu nội dung:\n"
    "- Nếu hồ sơ có bệnh lý/nguy cơ (VD: đái tháo đường thai kỳ, tăng huyết áp, tiền sản giật, thiếu máu,"
    " kết quả bất thường): nêu rõ nguy cơ đã tư vấn, kế hoạch theo dõi cụ thể, dặn dò dấu hiệu cần khám ngay.\n"
    "- Nếu thai kỳ khỏe mạnh bình thường: tư vấn theo dõi thường quy (dinh dưỡng, vi chất, lịch khám,"
    " theo dõi cử động thai, dấu hiệu cảnh báo chung).\n"
    "- Dùng ngôn ngữ cân bằng, trấn an hợp lý, không gây hoang mang; chỉ dựa trên dữ kiện có trong hồ sơ,"
    " không bịa thêm; không ghi tên hay bất kỳ thông tin định danh nào.\n"
    "- Nội dung sẽ được chèn vào mẫu biên bản in sẵn đã có tiêu đề: KHÔNG lặp lại tiêu đề 'BIÊN BẢN TƯ VẤN',"
    " vào thẳng nội dung.\n"
    "- Bố cục rõ ràng: đoạn mở đầu tóm tắt tình trạng hiện tại; tiếp theo các mục tư vấn đánh số '1.', '2.', '3.'...;"
    " cuối cùng là câu xác nhận thai phụ đã hiểu và đồng ý kế hoạch theo dõi.\n"
    "- Viết văn bản thuần để in: không dùng ký hiệu markdown (không **, ##, gạch đầu dòng bằng *).\n"
    'Trả về JSON đúng định dạng: {"tu_van": ["<đoạn mở đầu>", "<mục 1>", "<mục 2>", ..., "<câu xác nhận>"]}'
    " — mỗi phần tử của mảng là MỘT đoạn hoặc MỘT mục riêng, sẽ được in thành một dòng/đoạn riêng trong biên bản."
)


class CheckRecordRequest(BaseModel):
    record: dict[str, Any]
    dry_run: bool = Field(default=False, description="Chỉ redact + quét PII, không gọi LLM")
    include_criteria: list[str] | None = Field(default=None, description="Chỉ kiểm tra các tiêu chí này")
    exclude_criteria: list[str] = Field(default_factory=list, description="Bỏ qua các tiêu chí đã được duyệt")
    record_id: str | None = None
    record_version: int | None = Field(default=None, ge=1)


class GenerateCounselingRequest(BaseModel):
    record: dict[str, Any]
    record_id: str | None = None
    record_version: int | None = Field(default=None, ge=1)


def _cache_database():
    try:
        return get_database()
    except Exception:
        return None


def _cache_hit_response(cached: dict[str, Any]) -> dict[str, Any]:
    response = deepcopy(cached)
    meta = response.setdefault("meta", {})
    saved_tokens = meta.get("original_total_tokens", meta.get("total_tokens", 0)) or 0
    meta.update(
        {
            "status": "cache_hit",
            "cache_status": "hit",
            "api_calls": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "saved_tokens": saved_tokens,
        }
    )
    return response


def _read_cache(db, cache_key: str) -> dict[str, Any] | None:
    if db is None:
        return None
    try:
        return get_cached(db, cache_key)
    except Exception:
        return None


def _store_cache(db, **kwargs: Any) -> None:
    if db is None:
        return
    try:
        store_cached(db, **kwargs)
    except Exception:
        # Cache/observability must never make a clinical AI request fail.
        return


@router.post("/generate-counseling")
def generate_counseling(payload: GenerateCounselingRequest) -> dict[str, Any]:
    settings = CheckerSettings.from_env(ENV_PATH)
    safe_record = build_minimum_necessary_record(payload.record)
    if settings.pii_fail_closed and find_residual_pii(safe_record):
        raise HTTPException(status_code=422, detail="Phát hiện mẫu PII còn sót trong hồ sơ, đã hủy request")
    prompt_version = content_hash(COUNSELING_SYSTEM_PROMPT)
    cache_key, input_hash = make_cache_key(
        "generate_counseling",
        safe_record,
        pipeline_version=settings.pipeline_version,
        prompt_version=prompt_version,
        model=settings.model,
    )
    cache_db = _cache_database()
    cached = _read_cache(cache_db, cache_key)
    if cached:
        result = _cache_hit_response(cached)
        write_api_usage(
            endpoint="/api/v1/ai/generate-counseling",
            method="POST",
            telemetry=result["meta"],
        )
        return result
    if not settings.api_key or settings.api_key == "replace_me":
        raise HTTPException(status_code=503, detail="LLM_API_KEY chưa được cấu hình cho AI generator")
    started = time.perf_counter()
    try:
        response = call_llm(
            settings,
            COUNSELING_SYSTEM_PROMPT,
            "CLINICAL_RECORD:\n" + json.dumps(safe_record, ensure_ascii=False, sort_keys=True),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    try:
        raw = json.loads(response.text).get("tu_van", "")
    except (json.JSONDecodeError, AttributeError):
        raw = response.text
    if isinstance(raw, list):
        tu_van = "\n".join(str(part).strip() for part in raw if str(part).strip())
    else:
        tu_van = str(raw).strip()
        # Model trả một khối liền: tách dòng trước các gạch đầu dòng/mục đánh số sau dấu câu.
        if "\n" not in tu_van:
            tu_van = re.sub(r"(?<=[.:;]) - ", "\n- ", tu_van)
            tu_van = re.sub(r"(?<=\.) (?=\d{1,2}\. )", "\n", tu_van)
    # Chống sót định dạng markdown khi in biên bản.
    tu_van = tu_van.replace("**", "")
    if not tu_van:
        raise HTTPException(status_code=502, detail="LLM không trả về nội dung tư vấn")
    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    write_api_usage(
        endpoint="/api/v1/ai/generate-counseling",
        method="POST",
        telemetry={
            "status": "success",
            "model": settings.model,
            "pipeline_version": settings.pipeline_version,
            "latency_ms": latency_ms,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "total_tokens": response.input_tokens + response.output_tokens,
            "api_calls": 1,
        },
    )
    result = {
        "tu_van": tu_van,
        "meta": {
            "status": "success",
            "cache_status": "miss",
            "model": settings.model,
            "pipeline_version": settings.pipeline_version,
            "latency_ms": latency_ms,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "total_tokens": response.input_tokens + response.output_tokens,
            "original_total_tokens": response.input_tokens + response.output_tokens,
            "api_calls": 1,
        },
    }
    _store_cache(
        cache_db,
        cache_key=cache_key,
        input_hash=input_hash,
        artifact_type="generate_counseling",
        response=result,
        pipeline_version=settings.pipeline_version,
        prompt_version=prompt_version,
        rules_version="none",
        model=settings.model,
        record_id=payload.record_id,
        record_version=payload.record_version,
    )
    return result


def execute_check(record: dict[str, Any]) -> dict[str, Any]:
    """Worker entry point; deliberately accepts only the record copied into the queue."""
    settings = CheckerSettings.from_env(ENV_PATH)
    rules = _load_rules_or_503()
    safe_record = build_minimum_necessary_record(record)
    if settings.pii_fail_closed and find_residual_pii(safe_record):
        raise RuntimeError("Phát hiện mẫu PII còn sót trong hồ sơ, đã hủy request")
    prompt_version = content_hash(SYSTEM_PROMPT)
    rules_version = content_hash(rules)
    cache_key, input_hash = make_cache_key(
        "clinical_compliance_check",
        safe_record,
        pipeline_version=settings.pipeline_version,
        prompt_version=prompt_version,
        rules_version=rules_version,
        model=settings.model,
    )
    cache_db = _cache_database()
    cached = _read_cache(cache_db, cache_key)
    if cached:
        result = _cache_hit_response(cached)
        write_api_usage(endpoint="/api/v1/ai/jobs", method="POST", telemetry=result["meta"], status_code=200)
        return result
    if not settings.api_key or settings.api_key == "replace_me":
        raise RuntimeError("LLM_API_KEY chưa được cấu hình cho AI checker")
    output = run_check(record, rules, settings, LOG_PATH, dry_run=False)
    write_api_usage(endpoint="/api/v1/ai/jobs", method="POST", telemetry=output.get("telemetry", {}), status_code=200)
    telemetry = output.get("telemetry", {})
    criteria_catalog = {
        criterion["item_id"]: criterion["criterion"]
        for criterion in extract_required_criteria(rules)
    }
    result = {
        "run_id": output["run_id"],
        "result": output["result"],
        "criteria_catalog": criteria_catalog,
        "meta": {
            **{
                key: telemetry.get(key)
                for key in (
                    "status",
                    "model",
                    "pipeline_version",
                    "latency_ms",
                    "input_tokens",
                    "output_tokens",
                    "total_tokens",
                    "api_calls",
                    "estimated_cost_usd",
                )
            },
            "cache_status": "miss",
            "original_total_tokens": telemetry.get("total_tokens") or 0,
        },
    }
    _store_cache(
        cache_db,
        cache_key=cache_key,
        input_hash=input_hash,
        artifact_type="clinical_compliance_check",
        response=result,
        pipeline_version=settings.pipeline_version,
        prompt_version=prompt_version,
        rules_version=rules_version,
        model=settings.model,
    )
    return result


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def create_job(payload: CheckRecordRequest, request: Request) -> dict[str, Any]:
    if payload.dry_run:
        raise HTTPException(status_code=400, detail="dry_run chỉ được hỗ trợ tại /ai/check-record")
    queue = request.app.state.ai_job_queue
    try:
        job = await queue.submit(payload.record)
    except OverflowError as exc:
        raise HTTPException(status_code=429, detail=str(exc), headers={"Retry-After": "5"}) from exc
    return {"job_id": job.id, "status": job.status, "status_url": f"/api/v1/ai/jobs/{job.id}"}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, request: Request) -> dict[str, Any]:
    job = request.app.state.ai_job_queue.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy AI job")
    return job.public()


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
    rules = _load_rules_or_503()
    criteria_catalog = {
        criterion["item_id"]: criterion["criterion"]
        for criterion in extract_required_criteria(rules)
    }
    known_ids = set(criteria_catalog)
    included = set(payload.include_criteria) if payload.include_criteria is not None else None
    excluded = set(payload.exclude_criteria)
    requested_ids = (included or set()) | excluded
    unknown_ids = sorted(requested_ids - known_ids)
    if unknown_ids:
        raise HTTPException(status_code=422, detail=f"Tiêu chí không tồn tại: {', '.join(unknown_ids)}")
    if included is not None and included & excluded:
        overlap = ", ".join(sorted(included & excluded))
        raise HTTPException(status_code=422, detail=f"Tiêu chí vừa được chọn vừa bị loại trừ: {overlap}")

    if payload.dry_run:
        try:
            output = run_check(
                payload.record,
                rules,
                settings,
                LOG_PATH,
                dry_run=True,
                include_criteria=included,
                exclude_criteria=excluded,
            )
        except CriteriaValidationError as exc:
            raise HTTPException(status_code=502, detail=f"Kết quả AI không hợp lệ: {exc}") from exc
        except RuntimeError as exc:
            message = str(exc)
            raise HTTPException(status_code=422 if "PII" in message else 502, detail=message) from exc
        telemetry = output.get("telemetry", {})
        meta = {
            "status": telemetry.get("status"),
            "model": telemetry.get("model"),
            "pipeline_version": telemetry.get("pipeline_version"),
            "latency_ms": telemetry.get("latency_ms"),
            "total_tokens": telemetry.get("total_tokens"),
            "api_calls": telemetry.get("api_calls"),
            "input_tokens": telemetry.get("input_tokens"),
            "output_tokens": telemetry.get("output_tokens"),
            "estimated_cost_usd": telemetry.get("estimated_cost_usd") or telemetry.get("cost_usd"),
            "criteria_count": telemetry.get("criteria_count"),
            "included_by_request_count": telemetry.get("included_by_request_count"),
            "excluded_by_request_count": telemetry.get("excluded_by_request_count"),
            "cache_status": "bypass",
        }
        write_api_usage(endpoint="/api/v1/ai/check-record", method="POST", telemetry=telemetry, status_code=200)
        return {"run_id": output["run_id"], "safe_record": output["safe_record"], "meta": meta}

    safe_record = build_minimum_necessary_record(payload.record)
    if settings.pii_fail_closed and find_residual_pii(safe_record):
        raise HTTPException(status_code=422, detail="Phát hiện mẫu PII còn sót trong hồ sơ, đã hủy request")
    prompt_version = content_hash(SYSTEM_PROMPT)
    rules_version = content_hash(rules)
    cache_input = {
        "record": safe_record,
        "include_criteria": sorted(included) if included is not None else None,
        "exclude_criteria": sorted(excluded),
    }
    cache_key, input_hash = make_cache_key(
        "clinical_compliance_check",
        cache_input,
        pipeline_version=settings.pipeline_version,
        prompt_version=prompt_version,
        rules_version=rules_version,
        model=settings.model,
    )
    cache_db = _cache_database()
    cached = _read_cache(cache_db, cache_key)
    if cached:
        result = _cache_hit_response(cached)
        write_api_usage(endpoint="/api/v1/ai/check-record", method="POST", telemetry=result["meta"], status_code=200)
        return result
    if not settings.api_key or settings.api_key == "replace_me":
        raise HTTPException(status_code=503, detail="LLM_API_KEY chưa được cấu hình cho AI checker")

    try:
        output = run_check(
            payload.record,
            rules,
            settings,
            LOG_PATH,
            dry_run=False,
            include_criteria=included,
            exclude_criteria=excluded,
        )
    except CriteriaValidationError as exc:
        raise HTTPException(status_code=502, detail=f"Kết quả AI không hợp lệ: {exc}") from exc
    except RuntimeError as exc:
        message = str(exc)
        status_code = 422 if "PII" in message else 502
        raise HTTPException(status_code=status_code, detail=message) from exc
    telemetry = output.get("telemetry", {})
    write_api_usage(endpoint="/api/v1/ai/check-record", method="POST", telemetry=telemetry, status_code=200)
    meta = {
        "status": telemetry.get("status"),
        "model": telemetry.get("model"),
        "pipeline_version": telemetry.get("pipeline_version"),
        "latency_ms": telemetry.get("latency_ms"),
        "total_tokens": telemetry.get("total_tokens"),
        "api_calls": telemetry.get("api_calls"),
        "input_tokens": telemetry.get("input_tokens"),
        "output_tokens": telemetry.get("output_tokens"),
        "estimated_cost_usd": telemetry.get("estimated_cost_usd") or telemetry.get("cost_usd"),
        "criteria_count": telemetry.get("criteria_count"),
        "included_by_request_count": telemetry.get("included_by_request_count"),
        "excluded_by_request_count": telemetry.get("excluded_by_request_count"),
        "cache_status": "miss",
        "original_total_tokens": telemetry.get("total_tokens") or 0,    }
    result = {
        "run_id": output["run_id"],
        "result": output["result"],
        "criteria_catalog": criteria_catalog,
        "meta": meta,
    }
    _store_cache(
        cache_db,
        cache_key=cache_key,
        input_hash=input_hash,
        artifact_type="clinical_compliance_check",
        response=result,
        pipeline_version=settings.pipeline_version,
        prompt_version=prompt_version,
        rules_version=rules_version,
        model=settings.model,
        record_id=payload.record_id,
        record_version=payload.record_version,
    )
    return result
