# AI Usage Log — Thập Rùa Clinical Copilot

## Submission summary

This project used **Codex Desktop** as an AI-assisted software engineering tool. The submitted evidence package is
stored in [`ai-log/`](./ai-log/). The original desktop session remains available locally for organizer
inspection; a sanitized transcript is included for routine submission so that patient-like sample data and secrets are
not unnecessarily disclosed.

## Session record

| Field | Value |
|---|---|
| Tool | Codex Desktop |
| Session ID | `019f6f2d-baf3-7901-bd1c-3df887158ff4` |
| Date | 2026-07-17 (Asia/Ho_Chi_Minh) |
| Repository | `dquangai/thap-rua-clinical-copilot` |
| Branch at session start | `check-rules` |
| Starting commit | `4dddca0fdd85c649b5c31a841b605c9ba078cee0` |
| Raw desktop session | `~/.codex/sessions/2026/07/17/rollout-2026-07-17T15-24-55-019f6f2d-baf3-7901-bd1c-3df887158ff4.jsonl` |
| Sanitized transcript | [`ai-log/codex-session.sanitized.jsonl`](./ai-log/codex-session.sanitized.jsonl) |
| Integrity manifest | [`ai-log/session-manifest.json`](./ai-log/session-manifest.json) |
| Screenshots | Not included; not required for this submission |

Codex Desktop sessions do not have a public online chat link. The local session file is therefore the primary session
evidence, matching the organizer's requirement for desktop AI tools.

## Work performed with AI assistance

1. Inspected the repository, sample clinical JSON files and hospital rule JSON.
2. Identified direct identifiers and quasi-identifiers that must not be sent to an external LLM.
3. Implemented a privacy-first pipeline: allowlist, redaction, residual PII scan, fail-closed network boundary, LLM call,
   JSON parsing and telemetry.
4. Added local/provider configuration via `.env` and a safe `.env.example`; updated `.gitignore` to exclude secrets and
   clinical runtime artifacts.
5. Added pipeline version manifest and monitoring fields for latency, tokens, estimated cost, status, model/provider,
   request ID and content hashes.
6. Added unit tests and executed dry-runs over all three sample records without making an external API request.
7. Documented future versions: deterministic checks, scoped retrieval, guardrails, reasoning ensemble, ReAct tools and
   multi-agent verification.

## Human decisions and review

The project owner defined the objective, supplied the sample records/rules, and requested privacy controls, secret
management, telemetry and pipeline versioning. AI-generated code remains subject to human review. The clinical checker
is decision support only; its output must not automatically modify a medical record or replace professional review.

## Verification performed

```text
npm run test:ai
Result: 1 test passed

PYTHONPATH=backend/ai python -m clinical_checker.cli --data data \
  --rules rules/rules_kham_thai.json --output backend/ai/artifacts/results --dry-run
Result: 3/3 sample JSON files completed; no external LLM call

python -m compileall -q backend/ai/clinical_checker backend/ai/tests
Result: passed

git diff --check
Result: passed
```

## Disclosure and privacy notes

- `.env` and runtime artifacts are intentionally excluded from Git.
- No API key is included in this evidence package.
- The sanitized transcript omits system/developer instructions, model reasoning and raw tool input/output.
- The manifest records SHA-256 hashes of both the original local session and sanitized export. Organizers can request the
  original session for controlled review if necessary.
- Before publishing screenshots, verify that no notification, API key, patient identifier or unrelated private window is visible.

## Screenshots

Screenshots are intentionally not included because they are not required for this submission. The local Codex session,
sanitized transcript and integrity manifest are the primary evidence artifacts.

## Reproducing the evidence export

```bash
python scripts/export_ai_evidence.py \
  ~/.codex/sessions/2026/07/17/rollout-2026-07-17T15-24-55-019f6f2d-baf3-7901-bd1c-3df887158ff4.jsonl \
  ai-log/codex-session.sanitized.jsonl
```
