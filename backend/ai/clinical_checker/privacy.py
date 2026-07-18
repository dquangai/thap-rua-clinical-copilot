from __future__ import annotations

import copy
import json
import re
from typing import Any


# Only these top-level clinical fields can leave the trusted boundary.
CLINICAL_ALLOWLIST = {"patient", "visit", "vital_signs", "clinical_note", "diagnosis"}
NESTED_ALLOWLIST = {
    "patient": {"age", "gender"},
    "visit": {"reason", "department", "clinic"},
    "vital_signs": None,
    "clinical_note": {"dien_bien", "huong_xu_tri", "tu_van"},
    "diagnosis": {"icd10", "mo_ta"},
}

PATTERNS = {
    "email": re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I),
    "phone": re.compile(r"(?<!\d)(?:\+?84|0)(?:[ .-]?\d){9,10}(?!\d)"),
    "national_id": re.compile(r"(?<!\d)\d{9}|\d{12}(?!\d)"),
    "medical_id": re.compile(r"\b(?:BN|HSBA|MRN|CCCD|CMND|BHYT|KB)[-: ]?[A-Z0-9-]{5,}\b", re.I),
    "absolute_date": re.compile(r"\b(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-](?:19|20)\d{2}\b"),
}


def _known_identifiers(record: dict[str, Any]) -> list[str]:
    patient = record.get("patient", {})
    values = [
        record.get("record_id"), record.get("doctor"), record.get("signed_at"),
        patient.get("full_name"), patient.get("phone"), patient.get("address"),
        record.get("visit", {}).get("visit_code"), record.get("visit", {}).get("visit_datetime"),
    ]
    return sorted((str(v) for v in values if v), key=len, reverse=True)


def _scrub_text(value: str, identifiers: list[str]) -> str:
    result = value
    for identifier in identifiers:
        result = re.sub(re.escape(identifier), "[REDACTED_IDENTIFIER]", result, flags=re.I)
    for label, pattern in PATTERNS.items():
        result = pattern.sub(f"[REDACTED_{label.upper()}]", result)
    return result


def build_minimum_necessary_record(record: dict[str, Any]) -> dict[str, Any]:
    """Apply structural allowlisting and content redaction before prompt creation."""
    identifiers = _known_identifiers(record)
    output: dict[str, Any] = {}
    for section in CLINICAL_ALLOWLIST:
        if section not in record or not isinstance(record[section], dict):
            continue
        allowed = NESTED_ALLOWLIST[section]
        section_data = record[section] if allowed is None else {
            key: value for key, value in record[section].items() if key in allowed
        }
        output[section] = copy.deepcopy(section_data)

    def walk(value: Any) -> Any:
        if isinstance(value, str):
            return _scrub_text(value, identifiers)
        if isinstance(value, dict):
            return {k: walk(v) for k, v in value.items()}
        if isinstance(value, list):
            return [walk(v) for v in value]
        return value

    return walk(output)


def find_residual_pii(value: Any) -> list[str]:
    serialized = json.dumps(value, ensure_ascii=False)
    return sorted(label for label, pattern in PATTERNS.items() if pattern.search(serialized))
