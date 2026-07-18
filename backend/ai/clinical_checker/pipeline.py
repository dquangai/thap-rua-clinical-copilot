from __future__ import annotations

import hashlib
import json
import math
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
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
Không suy diễn dữ kiện không có. Phân loại ĐÚNG MỘT LẦN mọi item_id trong REQUIRED_CRITERIA vào dat_ids,
khong_ap_dung_ids hoặc exceptions; không thêm ID khác. Điều kiện áp dụng nhưng hồ sơ không đủ bằng chứng
thì tính là KHONG_DAT với ghi_chu ngắn nêu lý do (kể cả lý do thiếu dữ liệu); chỉ dùng KHONG_AP_DUNG cho
rule chắc chắn ngoài scope. exceptions chỉ chứa KHONG_DAT. Trả về duy nhất JSON object theo
OUTPUT_CONTRACT. Đây là công cụ hỗ trợ kiểm tra, không thay thế đánh giá của nhân viên y tế."""


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


def detect_gestational_age(record: dict[str, Any]) -> dict[str, Any]:
    """Read gestational age locally from structured diagnosis data; never call an API."""
    diagnosis = record.get("diagnosis", {})
    weeks = diagnosis.get("tuoi_thai_tuan")
    days = diagnosis.get("tuoi_thai_ngay", 0)
    source = "diagnosis.structured"
    if not isinstance(weeks, int):
        description = str(diagnosis.get("mo_ta", ""))
        week_match = re.search(r"(?i)\b(\d{1,2})\s*tu[ầa]n\b", description)
        day_match = re.search(r"(?i)\b(\d{1,2})\s*ng[àa]y\b", description)
        if not week_match:
            return {"detected": False, "weeks": None, "days": None, "trimester": None,
                    "source": "not_found"}
        weeks = int(week_match.group(1))
        days = int(day_match.group(1)) if day_match else 0
        source = "diagnosis.mo_ta"
    if not isinstance(days, int) or weeks < 0 or days < 0 or days > 6:
        return {"detected": False, "weeks": None, "days": None, "trimester": None,
                "source": "invalid"}
    total_days = weeks * 7 + days
    if total_days <= 13 * 7 + 6:
        trimester = "TCN1"
    elif total_days <= 28 * 7 + 6:
        trimester = "TCN2"
    else:
        trimester = "TCN3"
    return {"detected": True, "weeks": weeks, "days": days, "total_days": total_days,
            "trimester": trimester, "source": source}


def filter_criteria_by_trimester(criteria: list[dict[str, Any]], trimester: str | None
                                 ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Keep common rules plus the detected trimester; fail-safe keeps all if unknown."""
    if trimester is None:
        return criteria[:], []
    selected, excluded = [], []
    for criterion in criteria:
        criterion_trimester = criterion.get("scope", {}).get("tam_ca_nguyet")
        (selected if criterion_trimester in (None, trimester) else excluded).append(criterion)
    return selected, excluded


def compact_json_schema() -> dict[str, Any]:
    return {
        "type": "object", "additionalProperties": False,
        "properties": {
            "dat_ids": {"type": "array", "items": {"type": "string"}},
            "khong_ap_dung_ids": {"type": "array", "items": {"type": "string"}},
            "exceptions": {
                "type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "properties": {
                        "item_id": {"type": "string"},
                        "trang_thai": {"type": "string", "enum": ["KHONG_DAT"]},
                        "ghi_chu": {"type": "string"},
                    },
                    "required": ["item_id", "trang_thai", "ghi_chu"],
                },
            },
            "tong_ket": {
                "type": "object", "additionalProperties": False,
                "properties": {
                    "vi_pham_critical": {"type": "array", "items": {"type": "string"}},
                    "khuyen_nghi": {"type": "string"},
                },
                "required": ["vi_pham_critical", "khuyen_nghi"],
            },
        },
        "required": ["dat_ids", "khong_ap_dung_ids", "exceptions", "tong_ket"],
    }


def repair_json_schema() -> dict[str, Any]:
    return {
        "type": "object", "additionalProperties": False,
        "properties": {
            "evaluations": {
                "type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "properties": {
                        "item_id": {"type": "string"},
                        "trang_thai": {"type": "string", "enum": sorted(ALLOWED_STATUSES)},
                        "bang_chung": {"type": "string"}, "ghi_chu": {"type": "string"},
                    },
                    "required": ["item_id", "trang_thai", "bang_chung", "ghi_chu"],
                },
            },
        },
        "required": ["evaluations"],
    }


def split_batches(criteria: list[dict[str, Any]], batch_size: int) -> list[list[dict[str, Any]]]:
    """Chia tiêu chí thành các batch cân bằng để gọi LLM song song; batch_size <= 0 tắt chia."""
    if batch_size <= 0 or len(criteria) <= batch_size:
        return [criteria]
    count = math.ceil(len(criteria) / batch_size)
    base, extra = divmod(len(criteria), count)
    batches, start = [], 0
    for index in range(count):
        size = base + (1 if index < extra else 0)
        batches.append(criteria[start:start + size])
        start += size
    return batches


def merge_tong_ket(parts: list[Any]) -> dict[str, Any]:
    critical: list[str] = []
    recommendations: list[str] = []
    for part in parts:
        if not isinstance(part, dict):
            continue
        for item in part.get("vi_pham_critical", []) or []:
            if item not in critical:
                critical.append(item)
        recommendation = str(part.get("khuyen_nghi") or "").strip()
        if recommendation and recommendation not in recommendations:
            recommendations.append(recommendation)
    return {"vi_pham_critical": critical, "khuyen_nghi": " ".join(recommendations)}


def merge_missing_data_status(rows: list[Any]) -> list[Any]:
    """Contract v4 gộp THIEU_DU_LIEU vào KHONG_DAT; vẫn chấp nhận provider cũ trả trạng thái này."""
    for row in rows:
        if isinstance(row, dict) and row.get("trang_thai") == "THIEU_DU_LIEU":
            row["trang_thai"] = "KHONG_DAT"
            row["ghi_chu"] = row.get("ghi_chu") or "Thiếu dữ liệu trong hồ sơ"
    return rows


def build_public_result(result: dict[str, Any]) -> dict[str, Any]:
    """Chỉ trả kết luận cuối cùng: DAT khi mọi tiêu chí áp dụng đều đạt, kèm danh sách chưa đạt."""
    applicable_rows = [row for row in result["ket_qua_theo_rule"]
                       if row["trang_thai"] != "KHONG_AP_DUNG"]
    failures = [{"item_id": row["item_id"], "ly_do": row.get("ghi_chu") or row.get("bang_chung", "")}
                for row in applicable_rows if row["trang_thai"] != "DAT"]
    tong_ket = result.get("tong_ket", {})
    return {
        "ket_luan": "DAT" if not failures else "KHONG_DAT",
        "khong_dat": failures,
        "vi_pham_critical": tong_ket.get("vi_pham_critical", []),
        "khuyen_nghi": tong_ket.get("khuyen_nghi", ""),
    }


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


def normalize_exceptions_container(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return value
    if not isinstance(value, dict):
        raise ValueError(f"exceptions phai la array hoac grouped object; received={type(value).__name__}")
    rows: list[dict[str, Any]] = []
    status_aliases = {
        "KHONG_DAT": "KHONG_DAT", "khong_dat": "KHONG_DAT",
        "THIEU_DU_LIEU": "THIEU_DU_LIEU", "thieu_du_lieu": "THIEU_DU_LIEU",
    }
    if not set(value).issubset(status_aliases):
        for item_id, item in value.items():
            if isinstance(item, str) and item in {"KHONG_DAT", "THIEU_DU_LIEU"}:
                rows.append({"item_id": item_id, "trang_thai": item, "bang_chung": "", "ghi_chu": ""})
            elif isinstance(item, dict) and (item.get("trang_thai") or item.get("status")) in {
                    "KHONG_DAT", "THIEU_DU_LIEU"}:
                status = item.get("trang_thai") or item.get("status")
                rows.append({"item_id": item_id, "trang_thai": status,
                             "bang_chung": item.get("bang_chung", item.get("evidence", "")),
                             "ghi_chu": item.get("ghi_chu", item.get("reason", ""))})
            else:
                shape = {str(key): type(nested).__name__ for key, nested in value.items()}
                raise ValueError(f"exceptions ID-map co value khong hop le tai {item_id}; shape={shape}")
        return rows
    for group, items in value.items():
        if not isinstance(items, list):
            raise ValueError(f"exceptions.{group} phai la array")
        for item in items:
            if isinstance(item, str):
                rows.append({"item_id": item, "trang_thai": status_aliases[group],
                             "bang_chung": "", "ghi_chu": ""})
            elif isinstance(item, dict):
                rows.append({**item, "trang_thai": status_aliases[group]})
            else:
                raise ValueError(f"exceptions.{group} chua item khong hop le")
    return rows


def expand_compact_result(compact: dict[str, Any], required_ids: list[str],
                          require_complete: bool = True) -> dict[str, Any]:
    """Validate compact coverage and expand it to the stable row-oriented result contract."""
    dat_ids = compact.get("dat_ids", [])
    not_applicable_ids = compact.get("khong_ap_dung_ids", [])
    exceptions = merge_missing_data_status(normalize_exceptions_container(compact.get("exceptions", [])))
    if not isinstance(dat_ids, list) or not isinstance(not_applicable_ids, list):
        shape = {str(key): type(value).__name__ for key, value in compact.items()}
        raise ValueError("Compact response phai co dat_ids, khong_ap_dung_ids va exceptions arrays; "
                         f"received_shape={shape}")
    exception_ids = [row.get("item_id") for row in exceptions if isinstance(row, dict)]
    all_ids = dat_ids + not_applicable_ids + exception_ids
    unknown = sorted({item_id for item_id in all_ids if item_id not in required_ids}, key=str)
    duplicates = sorted({item_id for item_id in all_ids if all_ids.count(item_id) > 1}, key=str)
    missing = sorted(set(required_ids) - set(all_ids)) if require_complete else []
    invalid_rows = [row for row in exceptions if not isinstance(row, dict) or
                    row.get("trang_thai") not in {"KHONG_DAT", "THIEU_DU_LIEU"}]
    invalid_status = sorted({str(row.get("trang_thai")) if isinstance(row, dict) else "invalid_row"
                             for row in invalid_rows})
    invalid_item_ids = sorted({row.get("item_id") for row in invalid_rows
                               if isinstance(row, dict) and row.get("item_id") in required_ids})
    if missing or unknown or duplicates or invalid_status or (require_complete and len(all_ids) != len(required_ids)):
        raise CriteriaValidationError(missing, unknown, duplicates, invalid_status, invalid_item_ids)
    rows = ([{"item_id": item_id, "trang_thai": "DAT", "bang_chung": "", "ghi_chu": ""}
             for item_id in dat_ids] +
            [{"item_id": item_id, "trang_thai": "KHONG_AP_DUNG", "bang_chung": "", "ghi_chu": ""}
             for item_id in not_applicable_ids] +
            [{"item_id": row["item_id"], "trang_thai": row["trang_thai"],
              "bang_chung": row.get("bang_chung", ""), "ghi_chu": row.get("ghi_chu", "")}
             for row in exceptions])
    return {
        "thong_tin_lan_kham": compact.get("thong_tin_lan_kham", {}),
        "ket_qua_theo_rule": rows,
        "tong_ket": compact.get("tong_ket", {}),
    }


def prepare_compact_for_validation(compact: dict[str, Any], required_ids: list[str]
                                   ) -> tuple[dict[str, Any], list[str], dict[str, list[str]]]:
    """Normalize harmless placement errors and isolate ambiguous IDs for focused repair."""
    dat_ids = compact.get("dat_ids", [])
    not_applicable_ids = compact.get("khong_ap_dung_ids", [])
    exceptions = merge_missing_data_status(normalize_exceptions_container(compact.get("exceptions", [])))
    if not isinstance(dat_ids, list) or not isinstance(not_applicable_ids, list):
        shape = {str(key): type(value).__name__ for key, value in compact.items()}
        raise ValueError("Compact response phai co dat_ids, khong_ap_dung_ids va exceptions arrays; "
                         f"received_shape={shape}")
    statuses: dict[str, list[str]] = {}
    valid_exceptions: dict[str, dict[str, Any]] = {}
    normalized_not_applicable: list[str] = []
    invalid_ids: list[str] = []
    unknown_ids: list[str] = []

    def record(item_id: Any, status: str) -> None:
        if item_id not in required_ids:
            unknown_ids.append(str(item_id))
            return
        statuses.setdefault(item_id, []).append(status)

    for item_id in dat_ids:
        record(item_id, "DAT")
    for item_id in not_applicable_ids:
        record(item_id, "KHONG_AP_DUNG")
    for row in exceptions:
        if not isinstance(row, dict):
            continue
        item_id, status = row.get("item_id"), row.get("trang_thai")
        if status == "KHONG_AP_DUNG":
            normalized_not_applicable.append(item_id)
            record(item_id, status)
        elif status in {"KHONG_DAT", "THIEU_DU_LIEU"}:
            record(item_id, status)
            if item_id in required_ids:
                valid_exceptions[item_id] = row
        elif item_id in required_ids:
            invalid_ids.append(item_id)

    conflicting_ids = sorted(item_id for item_id, values in statuses.items() if len(set(values)) > 1)
    repair_ids = sorted(set(invalid_ids + conflicting_ids +
                            [item_id for item_id in required_ids if item_id not in statuses]))
    repair_set = set(repair_ids)
    normalized = {
        "thong_tin_lan_kham": compact.get("thong_tin_lan_kham", {}),
        "dat_ids": sorted(item_id for item_id, values in statuses.items()
                          if item_id not in repair_set and set(values) == {"DAT"}),
        "khong_ap_dung_ids": sorted(item_id for item_id, values in statuses.items()
                                      if item_id not in repair_set and set(values) == {"KHONG_AP_DUNG"}),
        "exceptions": [valid_exceptions[item_id] for item_id, values in statuses.items()
                       if item_id not in repair_set and set(values) <= {"KHONG_DAT", "THIEU_DU_LIEU"}
                       and len(set(values)) == 1 and item_id in valid_exceptions],
        "tong_ket": compact.get("tong_ket", {}),
    }
    notes = {
        "normalized_not_applicable_ids": sorted(set(normalized_not_applicable)),
        "conflicting_ids": conflicting_ids,
        "discarded_unknown_ids": sorted(set(unknown_ids)),
    }
    return normalized, repair_ids, notes


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
    all_criteria = extract_required_criteria(rules)
    gestational_age = detect_gestational_age(safe_record)
    criteria, excluded_criteria = filter_criteria_by_trimester(all_criteria, gestational_age["trimester"])
    required_ids = [item["item_id"] for item in criteria]
    output_contract = {
        "dat_ids": ["IDs kết luận DAT; mỗi ID xuất hiện đúng một lần trong toàn response"],
        "khong_ap_dung_ids": ["IDs kết luận KHONG_AP_DUNG; mỗi ID xuất hiện đúng một lần trong toàn response"],
        "exceptions": [{"item_id": "ID chưa đạt (kể cả thiếu dữ liệu); BẮT BUỘC exceptions là ARRAY, không object phân nhóm",
                         "trang_thai": "KHONG_DAT", "ghi_chu": "lý do ngắn gọn"}],
        "tong_ket": {"vi_pham_critical": ["item_id"], "khuyen_nghi": "string"},
    }
    user_prompt = ("REQUIRED_CRITERIA:\n" + _canonical(criteria) + "\n\nOUTPUT_CONTRACT:\n" +
                   _canonical(output_contract) + "\n\nCLINICAL_RECORD:\n" + _canonical(safe_record))
    batches = split_batches(criteria, settings.batch_size)
    base_event = {
        "batch_count": len(batches), "batch_sizes": [len(batch) for batch in batches],
        "run_id": run_id, "started_at": started_at.isoformat(), "pipeline_version": settings.pipeline_version,
        "provider": settings.provider, "model": settings.model, "prompt_sha256": _sha256(SYSTEM_PROMPT),
        "rules_sha256": _sha256(_canonical(rules)), "input_sha256": _sha256(_canonical(safe_record)),
        "gestational_age": gestational_age, "criteria_count": len(required_ids),
        "criteria_count_before_scope": len(all_criteria), "criteria_count_after_scope": len(criteria),
        "excluded_by_scope_count": len(excluded_criteria),
        "pii_scan_passed": not residual, "pii_findings": residual,
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
    def check_batch(batch: list[dict[str, Any]]) -> tuple[Any, dict[str, Any], list[str], dict[str, list[str]]]:
        batch_ids = [item["item_id"] for item in batch]
        batch_prompt = ("REQUIRED_CRITERIA:\n" + _canonical(batch) + "\n\nOUTPUT_CONTRACT:\n" +
                        _canonical(output_contract) + "\n\nCLINICAL_RECORD:\n" + _canonical(safe_record))
        response = call_llm(settings, SYSTEM_PROMPT, batch_prompt, compact_json_schema())
        compact, repair_ids, notes = prepare_compact_for_validation(json.loads(response.text), batch_ids)
        expanded = expand_compact_result(compact, batch_ids, require_complete=False)
        return response, expanded, repair_ids, notes

    try:
        # Cac batch doc lap theo ID nen goi song song; latency ~ batch cham nhat.
        with ThreadPoolExecutor(max_workers=len(batches)) as pool:
            batch_outputs = list(pool.map(check_batch, batches))
        responses = [output[0] for output in batch_outputs]
        result = {
            "ket_qua_theo_rule": [row for output in batch_outputs
                                  for row in output[1]["ket_qua_theo_rule"]],
            "tong_ket": merge_tong_ket([output[1].get("tong_ket") for output in batch_outputs]),
        }
        pre_repair_ids = sorted({item_id for output in batch_outputs for item_id in output[2]})
        compact_notes = {
            key: sorted({value for output in batch_outputs for value in output[3][key]})
            for key in ("normalized_not_applicable_ids", "conflicting_ids", "discarded_unknown_ids")
        }
        repaired_ids: list[str] = []
        normalized_ids: list[str] = []
        try:
            result["criteria_summary"] = validate_and_summarize(result, required_ids)
        except CriteriaValidationError as validation_error:
            # A focused repair is cheaper and more deterministic than repeating all 53 criteria.
            repair_ids = sorted(set(pre_repair_ids + validation_error.missing + validation_error.invalid_item_ids))
            if not repair_ids or validation_error.unknown or validation_error.duplicates:
                raise
            repair_set = set(repair_ids)
            repair_criteria = [criterion for criterion in criteria if criterion["item_id"] in repair_set]
            repair_prompt = ("Bạn đã trả kết luận mâu thuẫn hoặc thiếu cho các tiêu chí dưới đây. Trả đúng một hàng "
                             "trong evaluations cho mỗi item_id, không trùng và không thêm ID.\n\n"
                             "REQUIRED_CRITERIA:\n" + _canonical(repair_criteria) +
                             "\n\nCLINICAL_RECORD:\n" + _canonical(safe_record))
            repair_response = call_llm(settings, SYSTEM_PROMPT, repair_prompt, repair_json_schema())
            responses.append(repair_response)
            result["ket_qua_theo_rule"] = [row for row in result["ket_qua_theo_rule"]
                                            if row.get("item_id") not in repair_set]
            repair_rows = merge_missing_data_status(json.loads(repair_response.text).get("evaluations", []))
            repair_result = {"ket_qua_theo_rule": repair_rows}
            merge_repair_rows(result, repair_result, repair_ids)
            repaired_ids = repair_ids
            result["criteria_summary"] = validate_and_summarize(result, required_ids)
        result = build_public_result(result)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        input_tokens = sum(item.input_tokens for item in responses)
        output_tokens = sum(item.output_tokens for item in responses)
        cost = ((input_tokens * settings.input_price_per_million_usd) +
                (output_tokens * settings.output_price_per_million_usd)) / 1_000_000
        event = {**base_event, "status": "success", "latency_ms": latency_ms,
                 "input_tokens": input_tokens, "output_tokens": output_tokens,
                 "total_tokens": input_tokens + output_tokens, "api_calls": len(responses),
                 "repaired_criteria": repaired_ids, "normalized_null_criteria": sorted(set(normalized_ids)),
                 "compact_normalized_not_applicable_ids": sorted(set(compact_notes["normalized_not_applicable_ids"])),
                 "compact_conflicting_ids": compact_notes["conflicting_ids"],
                 "compact_discarded_unknown_ids": sorted(set(compact_notes["discarded_unknown_ids"])),
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
