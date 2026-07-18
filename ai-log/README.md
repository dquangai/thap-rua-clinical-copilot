# AI evidence package

This root-level directory contains submission evidence for the Codex Desktop work session.

- `codex-session.sanitized.jsonl`: reviewable user/assistant transcript and hashed tool-call events.
- `session-manifest.json`: raw session location and integrity hashes.

The original session is intentionally not copied into the Git repository because it may contain clinical sample data,
machine paths and operational context. It remains at the local path recorded in the manifest.

Screenshots are not included because they are not required for this submission. The human-readable overview is
[`../AI_LOG.md`](../AI_LOG.md).
