"""Xuất phiên Claude Code thành bản sanitized cho nhật ký cộng tác AI.

Chính sách xuất (khớp ai-log/README.md): chỉ giữ nội dung hội thoại
user/assistant; bỏ system prompt, reasoning và raw tool I/O; xoá
API key/secret/PII bằng regex trước khi ghi ra ai-log/.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REDACTIONS = [
    (re.compile(r"sk-[A-Za-z0-9_\-]{20,}"), "[REDACTED_API_KEY]"),
    (re.compile(r"sb_(?:publishable|secret)_[A-Za-z0-9_\-]+"), "[REDACTED_SUPABASE_KEY]"),
    (re.compile(r"mongodb\+srv://[^\s\"']+"), "[REDACTED_MONGODB_URI]"),
    (re.compile(r"(?i)(api[_-]?key|token|secret|password|mat khau|mật khẩu)\s*[:=]\s*[^\s\"',;]{8,}"), r"\1=[REDACTED]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@(?!thaprua\.vn|benhvien\.vn|example)[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[REDACTED_EMAIL]"),
]


def scrub(text: str) -> str:
    for pattern, repl in REDACTIONS:
        text = pattern.sub(repl, text)
    return text


def extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text" and block.get("text"):
                parts.append(block["text"])
        return "\n".join(parts)
    return ""


def sanitize_session(raw_path: Path, out_path: Path) -> dict:
    raw_bytes = raw_path.read_bytes()
    kept = 0
    with out_path.open("w", encoding="utf-8") as out:
        for line in raw_bytes.decode("utf-8", errors="replace").splitlines():
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") not in ("user", "assistant"):
                continue
            message = obj.get("message") or {}
            text = extract_text(message.get("content"))
            if not text.strip():
                continue
            record = {
                "role": message.get("role") or obj.get("type"),
                "timestamp": obj.get("timestamp"),
                "text": scrub(text),
            }
            out.write(json.dumps(record, ensure_ascii=False) + "\n")
            kept += 1
    return {
        "session_id": raw_path.stem,
        "raw_session_path": str(raw_path),
        "raw_session_snapshot_bytes": len(raw_bytes),
        "raw_session_snapshot_sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "sanitized_export_path": f"ai-log/{out_path.name}",
        "sanitized_export_sha256": hashlib.sha256(out_path.read_bytes()).hexdigest(),
        "sanitized_message_count": kept,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "export_policy": "Messages only; system/developer instructions, reasoning and raw tool I/O omitted; PII/secrets redacted.",
    }


def main() -> None:
    project_dir = Path(sys.argv[1]).expanduser()
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for raw in sorted(project_dir.glob("*.jsonl")):
        short = raw.stem.split("-")[0]
        out_path = out_dir / f"claude-session-{short}.sanitized.jsonl"
        entry = sanitize_session(raw, out_path)
        manifest.append(entry)
        print(f"{raw.name}: {entry['sanitized_message_count']} messages -> {out_path.name}")
    manifest_path = out_dir / "claude-sessions-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"manifest: {manifest_path}")


if __name__ == "__main__":
    main()
