# AI evidence package

This root-level directory contains submission evidence for the AI-assisted work sessions (Nhật ký cộng tác AI).

## Codex Desktop

- `codex-session.sanitized.jsonl`: reviewable user/assistant transcript and hashed tool-call events.
- `session-manifest.json`: raw session location and integrity hashes.

## Claude Code (desktop CLI)

- `claude-session-*.sanitized.jsonl`: user/assistant transcripts of four Claude Code sessions on this
  project (counseling-record feature, appointment scheduling, prescription page, README/docs, incident
  recovery and integration work). One JSON record per message: `{role, timestamp, text}`.
- `claude-sessions-manifest.json`: for each session — raw session path
  (`~/.claude/projects/-Users-mac-Downloads-thap-rua-clinical-copilot/<id>.jsonl`), byte count and
  SHA-256 of the raw snapshot, SHA-256 of the sanitized export, message count and export time.
- Regenerate with: `python3 scripts/export_claude_sessions.py ~/.claude/projects/-Users-mac-Downloads-thap-rua-clinical-copilot ai-log`

## Export policy (both tools)

Messages only; system/developer instructions, reasoning and raw tool I/O omitted; API keys, connection
strings and personal identifiers redacted before export. The original sessions are intentionally not
copied into the Git repository because they may contain secrets, clinical sample data, machine paths and
operational context. They remain at the local paths recorded in the manifests, with integrity hashes so
organizers can verify the exports against the originals on request.

The human-readable overview is [`../AI_LOG.md`](../AI_LOG.md).
