import json
import re
import sys
import time
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


class GenerateCounselingRequest(BaseModel):
    record: dict[str, Any]


@router.post("/generate-counseling")
def generate_counseling(payload: GenerateCounselingRequest) -> dict[str, Any]:
    settings = CheckerSettings.from_env(ENV_PATH)
    if not settings.api_key or settings.api_key == "replace_me":
        raise HTTPException(status_code=503, detail="LLM_API_KEY chưa được cấu hình cho AI generator")
    safe_record = build_minimum_necessary_record(payload.record)
    if settings.pii_fail_closed and find_residual_pii(safe_record):
        raise HTTPException(status_code=422, detail="Phát hiện mẫu PII còn sót trong hồ sơ, đã hủy request")
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
    return {
        "tu_van": tu_van,
        "meta": {
            "model": settings.model,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            "total_tokens": response.input_tokens + response.output_tokens,
        },
    }


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
