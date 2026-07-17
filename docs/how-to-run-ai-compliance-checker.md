# How to Run the AI Clinical Compliance Checker

This guide explains how to run the clinical compliance checker locally. The feature reads patient-record JSON files
from `data/`, checks them against JSON rules in `rules/`, calls the configured LLM provider, and writes results to
`results/`.

## 1. Prerequisites

You need:

- Python 3.10 or newer.
- Node.js and npm.
- A provider API key, such as an OpenAI API key.
- Terminal access to the repository.

The current implementation uses only Python standard-library packages for the checker itself, so it does not require a
separate `pip install` step.

## 2. Open the repository

```bash
cd /Users/thanhhiepvos/Code/thap-rua-clinical-copilot
```

Confirm that you are in the correct directory:

```bash
pwd
```

Expected output:

```text
/Users/thanhhiepvos/Code/thap-rua-clinical-copilot
```

## 3. Configure the provider

The checker reads provider configuration from the hidden `.env` file at the repository root.

If `.env` does not exist, create it from the example:

```bash
cp .env.example .env
```

Open it on macOS:

```bash
open -a TextEdit .env
```

For OpenAI, configure:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_API_KEY=replace_with_your_real_api_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_TIMEOUT_SECONDS=90
LLM_MAX_OUTPUT_TOKENS=12000
LLM_INPUT_PRICE_PER_MILLION_USD=0.40
LLM_OUTPUT_PRICE_PER_MILLION_USD=1.60
PIPELINE_VERSION=compact-applicable-v3.1
PII_FAIL_CLOSED=true
```

Important:

- Never commit `.env`.
- Never paste the API key into chat, documentation, logs, or source code.
- The token prices are used only for cost estimation. Update them when the provider price changes.
- Keep `PII_FAIL_CLOSED=true` when processing clinical records.

Verify that `.env` is ignored by Git:

```bash
git check-ignore -v .env
```

## 4. Prepare input records

Place patient-record JSON files in:

```text
data/
```

Example:

```text
data/
├── sim_kham1.json
├── sim_kham2.json
└── sim_kham3.json
```

Each file should contain the clinical sections expected by the checker, such as:

```json
{
  "patient": {
    "age": 26,
    "gender": "Nữ"
  },
  "visit": {
    "reason": "KHÁM THAI ĐỊNH KÌ"
  },
  "vital_signs": {},
  "clinical_note": {
    "dien_bien": "...",
    "huong_xu_tri": "..."
  },
  "diagnosis": {
    "icd10": "Z34.0",
    "mo_ta": "THAI 12 TUẦN 03 NGÀY"
  }
}
```

The source file may contain identifying fields, but the pipeline removes configured PII before the network call. Do not
assume the sample redaction patterns are sufficient for production without a privacy and security review.

## 5. Prepare rules

Place rule JSON files in:

```text
rules/
```

Example:

```text
rules/
└── rules_kham_thai.json
```

All `*.json` files in this directory are loaded and combined for the run.

## 6. Run unit tests

Before calling the provider, run:

```bash
npm run test:ai
```

Expected result:

```text
Ran 17 tests
OK
```

If tests fail, do not run real clinical records through the API until the failure has been understood.

## 7. Run a dry-run

```bash
npm run check:ai:dry
```

Dry-run performs the local stages:

```text
Read files
→ Parse JSON
→ Apply the clinical allowlist
→ Redact PII
→ Scan for residual PII
→ Detect gestational age
→ Filter rules by trimester
→ Build the provider payload
→ Stop before the HTTP request
```

Dry-run:

- Does not call OpenAI or another provider.
- Does not consume provider tokens.
- Does not generate compliance decisions.
- Does verify the privacy and prompt-construction path.

A successful dry-run prints:

```text
Run <run-id> hoan tat; output: results/result.json
```

## 8. Run all records

To process every `*.json` file in `data/` with every rule file in `rules/`:

```bash
npm run check:ai
```

Equivalent command:

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data \
  --rules rules \
  --output results
```

The CLI processes each record independently. One failed record does not prevent later files from running. The process
returns a non-zero exit code at the end if any file failed.

Successful output looks like:

```text
Run <run-id> hoan tat; output: results/sim_kham1.result.json
Run <run-id> hoan tat; output: results/sim_kham2.result.json
Run <run-id> hoan tat; output: results/sim_kham3.result.json
```

## 9. Run one record

Use this command when developing or troubleshooting one file:

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data/sim_kham1.json \
  --rules rules \
  --output results/sim_kham1.result.json
```

Replace `sim_kham1.json` with the required filename.

## 10. Use a specific rule file

The default commands load the whole `rules/` directory. To use one rule file only:

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data/sim_kham1.json \
  --rules rules/rules_kham_thai.json \
  --output results/sim_kham1.result.json
```

## 11. Choose custom result and log paths

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data/sim_kham1.json \
  --rules rules \
  --output results/custom.result.json \
  --log results/custom-runs.jsonl
```

Do not write clinical outputs into a Git-tracked directory.

## 12. Result files

Results are written to the root-level `results/` directory:

```text
results/
├── sim_kham1.result.json
├── sim_kham2.result.json
├── sim_kham3.result.json
└── runs.jsonl
```

`results/` is excluded from Git because exceptions may contain clinical evidence.

## 13. Public result format

A successful result contains:

```json
{
  "run_id": "...",
  "result": {
    "dat_ids": [
      "R01.1",
      "R01.2",
      "R02.4"
    ],
    "exceptions": [
      {
        "item_id": "R02.1",
        "trang_thai": "KHONG_DAT",
        "bang_chung": "",
        "ghi_chu": "Không ghi nhận huyết áp."
      }
    ],
    "criteria_summary": {
      "criteria_applicable": 18,
      "dat_count": 17,
      "khong_dat_count": 1,
      "thieu_du_lieu_count": 0
    },
    "scope_filter": {
      "gestational_age": {
        "weeks": 12,
        "days": 3,
        "trimester": "TCN1"
      },
      "criteria_sent_to_llm": 33,
      "criteria_excluded_locally": 20
    }
  },
  "telemetry": {}
}
```

The public result intentionally omits:

- Rules belonging to another trimester.
- Criteria classified as `KHONG_AP_DUNG`.
- Evidence and explanations for criteria in `dat_ids`.
- Raw prompts and raw provider responses.

## 14. Inspect results with `jq`

Format the whole file:

```bash
jq . results/sim_kham1.result.json
```

Show passed criteria:

```bash
jq '.result.dat_ids' results/sim_kham1.result.json
```

Show criteria requiring attention:

```bash
jq '.result.exceptions' results/sim_kham1.result.json
```

Show only failed criteria:

```bash
jq '.result.exceptions[] | select(.trang_thai == "KHONG_DAT")' \
  results/sim_kham1.result.json
```

Show criteria with insufficient data:

```bash
jq '.result.exceptions[] | select(.trang_thai == "THIEU_DU_LIEU")' \
  results/sim_kham1.result.json
```

Show the trimester filter:

```bash
jq '.result.scope_filter' results/sim_kham1.result.json
```

Show token, cost and latency:

```bash
jq '.telemetry | {
  pipeline_version,
  provider,
  model,
  api_calls,
  input_tokens,
  output_tokens,
  total_tokens,
  estimated_cost_usd,
  latency_ms,
  repaired_criteria
}' results/sim_kham1.result.json
```

## 15. Runtime telemetry

Every record run appends one JSON object to:

```text
results/runs.jsonl
```

Inspect the latest event:

```bash
tail -1 results/runs.jsonl | jq .
```

Show recent successful runs:

```bash
jq -c 'select(.status == "success")' results/runs.jsonl | tail -10
```

Important telemetry fields:

| Field | Meaning |
|---|---|
| `status` | `dry_run`, `success`, `error`, or `blocked_pii` |
| `pipeline_version` | Pipeline implementation/version used for the run |
| `model` | Provider model |
| `latency_ms` | Total record-processing latency |
| `input_tokens` | Total input tokens across initial and repair calls |
| `output_tokens` | Total output tokens across initial and repair calls |
| `estimated_cost_usd` | Estimated cost using prices from `.env` |
| `api_calls` | Number of provider calls for the record |
| `repaired_criteria` | IDs re-evaluated by a focused repair call |
| `criteria_count_before_scope` | All compiled criteria before trimester filtering |
| `criteria_count_after_scope` | Criteria sent to the provider |
| `pii_scan_passed` | Whether the residual PII scan passed |

## 16. Understanding focused repair

The first API call evaluates all criteria selected for the record. If the provider omits an ID or assigns conflicting
groups, the pipeline makes a second, smaller API call for only those IDs.

Example telemetry:

```json
{
  "api_calls": 2,
  "repaired_criteria": ["R06.2"]
}
```

`repaired_criteria` is a technical pipeline field. It does not mean those criteria failed. Their final decisions are
found in `result.dat_ids` or `result.exceptions`.

## 17. Common errors

### `LLM_API_KEY chua duoc cau hinh`

Cause: `.env` is missing, the key is blank, or it still contains `replace_me`.

Fix:

```bash
open -a TextEdit .env
```

Set `LLM_API_KEY` and run again.

### HTTP 401 or 403

The API key is invalid, expired, unauthorized, or associated with the wrong provider/project.

### HTTP 429

The account or project exceeded a request/token limit. Wait, reduce concurrency, or review provider limits.

### `URLError` or DNS error

The machine cannot reach the provider endpoint. Check internet access, DNS, firewall, proxy, VPN and
`LLM_BASE_URL`.

### `CriteriaValidationError`

The provider response had missing, unknown, duplicate or conflicting IDs. The pipeline attempts focused repair when it
can. If repair also fails, the record is rejected instead of silently accepting an incomplete result.

### `blocked_pii`

The residual scan found a PII pattern after redaction. The provider was not called. Review the record and redaction
rules; do not disable fail-closed behavior merely to make the request pass.

### One file fails but others continue

This is expected batch behavior. Inspect the failed file's result:

```bash
jq . results/<failed-file>.result.json
```

## 18. Verify that results are not committed

```bash
git check-ignore -v results/sim_kham1.result.json
git check-ignore -v results/runs.jsonl
```

Do not force-add clinical results with `git add -f`.

## 19. Recommended development workflow

For code or rule changes:

```text
1. Edit code/rules
2. Run npm run test:ai
3. Run npm run check:ai:dry
4. Review privacy and trimester-filter telemetry
5. Run one sample record through the API
6. Inspect result and runs.jsonl
7. Run the complete data folder
8. Compare token, cost, latency and repair rate with the previous version
9. Update the pipeline version manifest
```

## 20. Additional documentation

For architecture, privacy boundaries, response contracts, validation details, pipeline versions and optimization
guidance, see:

[AI Clinical Compliance Pipeline](ai-clinical-compliance-pipeline.md)

