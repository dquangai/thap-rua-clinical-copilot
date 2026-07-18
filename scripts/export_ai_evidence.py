#!/usr/bin/env python3
"""Export a reviewable Codex session excerpt without secrets or clinical payloads."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any


REDACTIONS = [
    (re.compile(r"\b(?:\+?84|0)(?:[ .-]?\d){9,10}\b"), "[REDACTED_PHONE]"),
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), "[REDACTED_EMAIL]"),
    (re.compile(r"(?i)(?:api[_-]?key|authorization)([\"'=:\s]+)[^\s\",}]+"), r"api_key\1[REDACTED_SECRET]"),
    (re.compile(r"(?i)\b(full_name|address|doctor)\b\s*[:=]\s*[^,}\n]+"), r"\1: [REDACTED_PII]"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def redact(text: str) -> str:
    for pattern, replacement in REDACTIONS:
        text = pattern.sub(replacement, text)
    return text


def content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts = []
    for item in content:
        if isinstance(item, dict) and item.get("type") in {"input_text", "output_text", "text"}:
            parts.append(str(item.get("text", "")))
    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    exported: list[dict[str, Any]] = []
    session_id = "unknown"
    with args.session.open(encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            payload = row.get("payload", {})
            if row.get("type") == "session_meta":
                session_id = payload.get("session_id", payload.get("id", "unknown"))
                exported.append({
                    "timestamp": row.get("timestamp"), "type": "session_meta",
                    "session_id": session_id, "originator": payload.get("originator"),
                    "cli_version": payload.get("cli_version"), "cwd": payload.get("cwd"),
                    "git": payload.get("git"),
                })
            elif row.get("type") == "response_item" and payload.get("type") == "message":
                role = payload.get("role")
                if role in {"user", "assistant"}:
                    text = redact(content_text(payload.get("content")))
                    # Environment boilerplate is not authored project work.
                    if text and "<environment_context>" not in text and "<permissions instructions>" not in text:
                        exported.append({"timestamp": row.get("timestamp"), "type": "message", "role": role, "text": text})
            elif row.get("type") == "response_item" and payload.get("type") in {"custom_tool_call", "function_call"}:
                raw_input = str(payload.get("input", payload.get("arguments", "")))
                exported.append({
                    "timestamp": row.get("timestamp"), "type": "tool_call", "tool": payload.get("name"),
                    "input_sha256": hashlib.sha256(raw_input.encode()).hexdigest(),
                    "note": "Raw tool input omitted because it may contain source data or patches.",
                })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in exported) + "\n", encoding="utf-8")
    raw_size = args.session.stat().st_size
    manifest = {
        "session_id": session_id,
        "raw_session_path": str(args.session),
        "raw_session_snapshot_bytes": raw_size,
        "raw_session_snapshot_sha256": sha256(args.session),
        "sanitized_export_path": str(args.output),
        "sanitized_export_sha256": sha256(args.output),
        "hash_note": "The raw Codex session is append-only while the task is active. The hash covers the recorded byte count at export time.",
        "export_policy": "Messages only; system/developer instructions, reasoning and raw tool I/O omitted; PII/secrets redacted.",
    }
    manifest_path = args.output.with_name("session-manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
