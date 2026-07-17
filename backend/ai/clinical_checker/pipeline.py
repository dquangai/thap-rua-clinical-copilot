from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import Settings
from .privacy import build_minimum_necessary_record, find_residual_pii
from .provider import call_llm

ALLOWED_STATUSES = {"DAT", "KHONG_DAT", "KHONG_AP_DUNG", "THIEU_DU_LIEU"}


class CriteriaValidationError(ValueError):
    def __init__(self, missing: list[str], unknown: list[str], duplicates: list[str],
                 invalid_status: list[str], invalid_item_ids: list[str]):
        self.missing = missing
        self.unknown = unknown
        self.duplicates = duplicates
        self.invalid_status = invalid_status
        self.invalid_item_ids = invalid_item_ids
        super().__init__(f"LLM response khong phu criteria: missing={missing}, unknown={unknown}, "
                         f"duplicates={duplicates}, invalid_status={invalid_status}, invalid_item_ids={invalid_item_ids}")

SYSTEM_PROMPT = """Bạn là bộ kiểm tra tuân thủ hồ sơ lâm sàng. Chỉ đánh giá bằng dữ liệu được cung cấp.
Không suy diễn dữ kiện không có. Với điều kiện áp dụng nhưng hồ sơ không đủ bằng chứng, dùng THIEU_DU_LIEU;
với rule chắc chắn ngoài scope, dùng KHONG_AP_DUNG. Phải đánh giá ĐÚNG MỘT LẦN mọi item_id trong
REQUIRED_CRITERIA, không thêm ID khác. Mỗi bằng chứng phải là trích dẫn ngắn từ CLINICAL_RECORD đã cung cấp;
không có bằng chứng thì để chuỗi rỗng. Trả về duy nhất JSON object theo OUTPUT_CONTRACT. Đây là công cụ hỗ trợ
kiểm tra, không thay thế đánh giá của nhân viên y tế."""


def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _append_log(path: Path, event: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def extract_required_criteria(rules: dict[str, Any]) -> list[dict[str, Any]]:
    """Flatten rule items; rule-level schedules remain one explicit criterion."""
    criteria: list[dict[str, Any]] = []
    for rule in rules.get("rules", []):
        common = {
            "rule_name": rule.get("ten", ""), "scope": rule.get("scope", {}),
            "severity": rule.get("severity", "MAJOR"),
        }
        items = rule.get("items", [])
        if items:
            for item in items:
                criteria.append({
                    "item_id": item["id"], "criterion": item.get("noi_dung", ""),
                    "severity": item.get("severity", common["severity"]), "scope": common["scope"],
                    **{key: item[key] for key in ("dieu_kien", "cua_so_thoi_gian", "tan_suat", "kiem_tra_lieu") if key in item},
                })
        else:
            # R07 currently defines a schedule without child IDs; evaluate it as R07.
            criteria.append({"item_id": rule["rule_id"], "criterion": rule.get("logic_kiem_tra", rule.get("ten", "")),
                             "schedule": rule.get("lich", []), **common})
    return criteria


def validate_and_summarize(result: dict[str, Any], required_ids: list[str]) -> dict[str, Any]:
    rows = result.get("ket_qua_theo_rule")
    if not isinstance(rows, list):
        raise ValueError("LLM response thieu ket_qua_theo_rule array")
    ids = [row.get("item_id") for row in rows if isinstance(row, dict)]
    missing = sorted(set(required_ids) - set(ids))
    unknown = sorted(set(ids) - set(required_ids))
    duplicates = sorted({item_id for item_id in ids if ids.count(item_id) > 1})
    invalid_status = sorted({str(row.get("trang_thai")) for row in rows
                             if not isinstance(row, dict) or row.get("trang_thai") not in ALLOWED_STATUSES})
    invalid_item_ids = sorted({row.get("item_id") for row in rows if isinstance(row, dict)
                               and row.get("item_id") in required_ids
                               and row.get("trang_thai") not in ALLOWED_STATUSES})
    if missing or unknown or duplicates or invalid_status or len(rows) != len(required_ids):
        raise CriteriaValidationError(missing, unknown, duplicates, invalid_status, invalid_item_ids)
    order = {item_id: index for index, item_id in enumerate(required_ids)}
    rows.sort(key=lambda row: order[row["item_id"]])
    counts = {status: 0 for status in sorted(ALLOWED_STATUSES)}
    by_status = {status: [] for status in sorted(ALLOWED_STATUSES)}
    for row in rows:
        counts[row["trang_thai"]] += 1
        by_status[row["trang_thai"]].append(row["item_id"])
    return {"total_criteria": len(required_ids), "counts": counts, "criteria_by_status": by_status}


def merge_repair_rows(result: dict[str, Any], repair: dict[str, Any], missing_ids: list[str]) -> None:
    rows = repair.get("ket_qua_theo_rule")
    if not isinstance(rows, list):
        raise ValueError("Repair response thieu ket_qua_theo_rule array")
    repaired_ids = [row.get("item_id") for row in rows if isinstance(row, dict)]
    if sorted(repaired_ids) != sorted(missing_ids) or len(repaired_ids) != len(set(repaired_ids)):
        raise ValueError(f"Repair response sai criteria: expected={missing_ids}, actual={repaired_ids}")
    result["ket_qua_theo_rule"].extend(rows)


def normalize_null_statuses(result: dict[str, Any]) -> list[str]:
    """Map provider null to the contract's explicit insufficient-data state."""
    normalized: list[str] = []
    for row in result.get("ket_qua_theo_rule", []):
        if isinstance(row, dict) and row.get("trang_thai") is None and row.get("item_id"):
            row["trang_thai"] = "THIEU_DU_LIEU"
            row["ghi_chu"] = row.get("ghi_chu") or "Provider không xác định trạng thái; chuẩn hoá thành thiếu dữ liệu."
            normalized.append(row["item_id"])
    return normalized


def run_check(record: dict[str, Any], rules: dict[str, Any], settings: Settings,
              log_path: Path, dry_run: bool = False) -> dict[str, Any]:
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    started = time.perf_counter()
    safe_record = build_minimum_necessary_record(record)
    residual = find_residual_pii(safe_record)
    criteria = extract_required_criteria(rules)
    required_ids = [item["item_id"] for item in criteria]
    output_contract = {
        "thong_tin_lan_kham": {"tuoi_thai_tuan": "number|null", "tuoi_thai_ngay": "number|null",
                                "phan_loai_nguy_co": "binh_thuong|nguy_co_cao|khong_ghi_nhan", "lan_kham_thu": "number|null"},
        "ket_qua_theo_rule": [{"item_id": "exact ID from REQUIRED_CRITERIA", "trang_thai": "DAT|KHONG_DAT|KHONG_AP_DUNG|THIEU_DU_LIEU",
                                "bang_chung": "short quote or empty string", "ghi_chu": "brief explanation"}],
        "tong_ket": {"vi_pham_critical": ["item_id"], "khuyen_nghi": "string"},
    }
    user_prompt = ("REQUIRED_CRITERIA:\n" + _canonical(criteria) + "\n\nOUTPUT_CONTRACT:\n" +
                   _canonical(output_contract) + "\n\nCLINICAL_RECORD:\n" + _canonical(safe_record))
    base_event = {
        "run_id": run_id, "started_at": started_at.isoformat(), "pipeline_version": settings.pipeline_version,
        "provider": settings.provider, "model": settings.model, "prompt_sha256": _sha256(SYSTEM_PROMPT),
        "rules_sha256": _sha256(_canonical(rules)), "input_sha256": _sha256(_canonical(safe_record)),
        "criteria_count": len(required_ids), "pii_scan_passed": not residual, "pii_findings": residual,
    }
    if residual and settings.pii_fail_closed:
        event = {**base_event, "status": "blocked_pii", "latency_ms": round((time.perf_counter() - started) * 1000, 2)}
        _append_log(log_path, event)
        raise RuntimeError(f"Da chan API call vi con mau PII: {', '.join(residual)}")
    if dry_run:
        event = {**base_event, "status": "dry_run", "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                 "payload_bytes": len(user_prompt.encode())}
        _append_log(log_path, event)
        return {"run_id": run_id, "safe_record": safe_record, "telemetry": event}
    try:
        response = call_llm(settings, SYSTEM_PROMPT, user_prompt)
        result = json.loads(response.text)
        responses = [response]
        repaired_ids: list[str] = []
        normalized_ids = normalize_null_statuses(result)
        try:
            result["criteria_summary"] = validate_and_summarize(result, required_ids)
        except CriteriaValidationError as validation_error:
            # A focused repair is cheaper and more deterministic than repeating all 53 criteria.
            repair_ids = sorted(set(validation_error.missing + validation_error.invalid_item_ids))
            if not repair_ids or validation_error.unknown or validation_error.duplicates:
                raise
            repair_set = set(repair_ids)
            repair_criteria = [criterion for criterion in criteria if criterion["item_id"] in repair_set]
            repair_prompt = ("Bạn đã bỏ sót hoặc trả trạng thái không hợp lệ cho các tiêu chí dưới đây. Chỉ trả JSON dạng "
                             "{\"ket_qua_theo_rule\": [...]} với đúng các item_id được yêu cầu.\n\n"
                             "REQUIRED_CRITERIA:\n" + _canonical(repair_criteria) +
                             "\n\nCLINICAL_RECORD:\n" + _canonical(safe_record))
            repair_response = call_llm(settings, SYSTEM_PROMPT, repair_prompt)
            responses.append(repair_response)
            result["ket_qua_theo_rule"] = [row for row in result["ket_qua_theo_rule"]
                                            if row.get("item_id") not in repair_set]
            merge_repair_rows(result, json.loads(repair_response.text), repair_ids)
            normalized_ids.extend(normalize_null_statuses(result))
            repaired_ids = repair_ids
            result["criteria_summary"] = validate_and_summarize(result, required_ids)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        input_tokens = sum(item.input_tokens for item in responses)
        output_tokens = sum(item.output_tokens for item in responses)
        cost = ((input_tokens * settings.input_price_per_million_usd) +
                (output_tokens * settings.output_price_per_million_usd)) / 1_000_000
        event = {**base_event, "status": "success", "latency_ms": latency_ms,
                 "input_tokens": input_tokens, "output_tokens": output_tokens,
                 "total_tokens": input_tokens + output_tokens, "api_calls": len(responses),
                 "repaired_criteria": repaired_ids, "normalized_null_criteria": sorted(set(normalized_ids)),
                 "estimated_cost_usd": round(cost, 8),
                 "request_ids": [item.request_id for item in responses if item.request_id],
                 "output_sha256": _sha256(_canonical(result))}
        _append_log(log_path, event)
        return {"run_id": run_id, "result": result, "telemetry": event}
    except Exception as exc:
        event = {**base_event, "status": "error", "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                 "error_type": type(exc).__name__}
        _append_log(log_path, event)
        raise
