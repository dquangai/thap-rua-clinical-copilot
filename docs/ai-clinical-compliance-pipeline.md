# AI Clinical Compliance Pipeline

## 1. Mục đích

Pipeline này kiểm tra các hồ sơ khám bệnh dạng JSON trong thư mục `data/` có tuân thủ các tiêu chí đã định nghĩa
trong thư mục `rules/` hay không. Việc đánh giá nội dung lâm sàng được thực hiện bằng API của provider LLM
(OpenAI-compatible hoặc Anthropic), không phải bởi Coding Agent đang phát triển repository.

Các mục tiêu chính:

- Không gửi PII trực tiếp tới provider.
- Chỉ gửi dữ liệu và rules tối thiểu cần thiết.
- Chọn rules phù hợp với tam cá nguyệt trước API call.
- Trả danh sách ID đạt dưới dạng compact list.
- Chỉ ghi chi tiết cho tiêu chí chưa đạt hoặc chưa đủ dữ liệu kiểm chứng.
- Không ghi các rule ngoài tam cá nguyệt hoặc `KHONG_AP_DUNG` vào result public.
- Bắt buộc kiểm tra coverage và cấu trúc response trước khi chấp nhận kết quả.
- Ghi token, latency, cost và metadata của từng run để benchmark các pipeline version.
- Mọi kết quả chỉ là hỗ trợ kiểm tra và cần human review.

## 2. Phạm vi và nguyên tắc an toàn

Pipeline là công cụ kiểm tra chất lượng hồ sơ, không phải công cụ chẩn đoán hoặc tự động đưa ra quyết định điều trị.
Nó không được tự động sửa bệnh án, ký hồ sơ hoặc thay thế đánh giá của bác sĩ/điều dưỡng.

Các nguyên tắc:

1. **Minimum necessary:** chỉ gửi các field lâm sàng cần cho việc kiểm tra.
2. **Fail closed:** nếu còn mẫu PII sau redaction, chặn request trước network boundary.
3. **No inference:** LLM không được tự tạo dữ kiện không có trong hồ sơ.
4. **Explicit uncertainty:** không đủ bằng chứng phải dùng `THIEU_DU_LIEU`.
5. **Strict validation:** JSON hợp lệ chưa đủ; coverage và status cũng phải hợp lệ.
6. **Human in the loop:** kết quả cuối cần nhân viên y tế xác nhận.

## 3. Cấu trúc thư mục

```text
thap-rua-clinical-copilot/
├── .env                              # Secret local, không commit
├── .env.example                      # Cấu hình mẫu
├── data/                             # Hồ sơ JSON đầu vào
├── rules/                            # Rule JSON
├── results/                          # Result và telemetry, bị gitignore
│   ├── sim_kham1.result.json
│   ├── sim_kham2.result.json
│   ├── sim_kham3.result.json
│   └── runs.jsonl
├── backend/ai/
│   ├── clinical_checker/
│   │   ├── cli.py                    # Batch CLI và file I/O
│   │   ├── config.py                 # Đọc .env
│   │   ├── privacy.py                # Allowlist, redaction, PII scan
│   │   ├── provider.py               # HTTP adapter OpenAI/Anthropic
│   │   └── pipeline.py               # Scope, prompt, validation, repair, telemetry
│   ├── tests/                        # Unit tests
│   └── versions/                     # Manifest các pipeline version
└── docs/
    └── ai-clinical-compliance-pipeline.md
```

## 4. Cách chạy

### 4.1 Cấu hình API key

Sao chép `.env.example` thành `.env` nếu `.env` chưa có, sau đó điền key trực tiếp trên máy local:

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
LLM_API_KEY=replace_with_real_key
LLM_BASE_URL=https://api.openai.com/v1
LLM_TIMEOUT_SECONDS=90
LLM_MAX_OUTPUT_TOKENS=12000
LLM_INPUT_PRICE_PER_MILLION_USD=0.40
LLM_OUTPUT_PRICE_PER_MILLION_USD=1.60
PIPELINE_VERSION=compact-applicable-v3.1
PII_FAIL_CLOSED=true
```

Không gửi API key qua chat, không ghi vào tài liệu và không commit `.env`. File `.env` đã được `.gitignore` bảo vệ.

Hai giá token chỉ dùng để tính cost ước tính. Chúng phải được cập nhật theo model và hợp đồng provider thực tế.

### 4.2 Chạy unit tests

```bash
npm run test:ai
```

### 4.3 Chạy dry-run

```bash
npm run check:ai:dry
```

Dry-run thực hiện:

```text
Đọc data/rules
→ parse JSON
→ allowlist
→ redaction
→ PII scan
→ xác định tam cá nguyệt
→ lọc criteria
→ tạo prompt
→ dừng trước API call
```

Dry-run không tạo kết quả `DAT/KHONG_DAT`, không dùng token và không phát sinh API cost.

### 4.4 Chạy API thật cho toàn bộ folder

```bash
npm run check:ai
```

Command tương đương:

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data \
  --rules rules \
  --output results
```

### 4.5 Chạy một hồ sơ

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data/sim_kham1.json \
  --rules rules \
  --output results/sim_kham1.result.json
```

## 5. Tổng quan luồng xử lý

```mermaid
flowchart TD
    A["Đọc JSON trong data/"] --> B["Đọc và gộp JSON trong rules/"]
    B --> C["Compile criteria"]
    A --> D["Allowlist dữ liệu lâm sàng"]
    D --> E["Redact PII"]
    E --> F{"Residual PII scan"}
    F -- "Phát hiện PII" --> G["Chặn network call"]
    F -- "Pass" --> H["Parse tuổi thai local"]
    H --> I["Xác định TCN1/TCN2/TCN3"]
    I --> J["Chọn common rules + rules đúng tam cá nguyệt"]
    J --> K["Tạo compact prompt"]
    K --> L["Gọi provider với strict JSON Schema"]
    L --> M["Normalize representation"]
    M --> N["Coverage validation"]
    N -- "Thiếu hoặc mâu thuẫn" --> O["Focused repair evaluations[]"]
    O --> N
    N -- "Hợp lệ" --> P["Tạo public result"]
    P --> Q["Ghi results/*.result.json"]
    P --> R["Ghi results/runs.jsonl"]
```

## 6. Bước 1 — Đọc data và rules

Việc đọc file hoàn toàn chạy local, không gọi API.

CLI sử dụng thư viện chuẩn Python:

- `pathlib.Path.glob("*.json")` để tìm file.
- `Path.read_text(encoding="utf-8-sig")` để đọc UTF-8 và xử lý BOM nếu có.
- `json.loads()` để parse JSON.

Rules được đọc một lần khi CLI bắt đầu và gộp thành:

```json
{
  "sources": ["rules_kham_thai.json"],
  "rules": []
}
```

Trong một batch, mỗi data file được đọc một lần. Network chỉ bắt đầu khi `call_llm()` được gọi.

## 7. Bước 2 — Compile criteria

`extract_required_criteria()` chuyển cấu trúc rules thành một danh sách phẳng dễ đưa vào prompt.

Ví dụ:

```json
{
  "item_id": "R02.1",
  "criterion": "Đo mạch và huyết áp",
  "severity": "CRITICAL",
  "scope": {
    "ap_dung": "moi_lan_kham"
  },
  "tan_suat": "mỗi lần khám"
}
```

Rule có `items[]` sử dụng ID của từng item. Rule lịch hẹn `R07` hiện chưa có child ID nên được đánh giá ở mức
`R07`.

File rules hiện tại compile thành 53 criteria trước khi scope filtering.

## 8. Bước 3 — Allowlist và redaction PII

### 8.1 Structural allowlist

Chỉ các section sau có thể đi tiếp:

```text
patient
visit
vital_signs
clinical_note
diagnosis
```

Các field được giữ:

```text
patient.age
patient.gender
visit.reason
visit.department
visit.clinic
vital_signs.*
clinical_note.dien_bien
clinical_note.huong_xu_tri
diagnosis.icd10
diagnosis.mo_ta
```

Các field định danh bị loại khỏi cấu trúc:

```text
record_id
patient.full_name
patient.phone
patient.address
visit.visit_code
visit.visit_datetime
doctor
signed_at
```

### 8.2 Redaction trong free text

Free text có thể vô tình chứa PII nên pipeline tiếp tục thay thế:

- Email.
- Số điện thoại Việt Nam.
- CCCD/CMND.
- Mã bệnh án/lượt khám.
- Ngày tuyệt đối.
- Các identifier đã biết từ record gốc.

Ví dụ:

```text
Dự sanh ngày: 26/01/2027
```

trở thành:

```text
Dự sanh ngày: [REDACTED_ABSOLUTE_DATE]
```

### 8.3 Residual PII scan

Sau redaction, payload được serialize và quét lại. Nếu còn mẫu PII và `PII_FAIL_CLOSED=true`:

```text
status = blocked_pii
API calls = 0
cost = 0
```

## 9. Bước 4 — Xác định tam cá nguyệt local

`detect_gestational_age()` không dùng LLM. Nó ưu tiên field cấu trúc:

```json
{
  "diagnosis": {
    "tuoi_thai_tuan": 12,
    "tuoi_thai_ngay": 3
  }
}
```

Nếu field cấu trúc không có, parser đọc `diagnosis.mo_ta`:

```text
THAI 12 TUẦN 03 NGÀY
```

Kết quả:

```json
{
  "detected": true,
  "weeks": 12,
  "days": 3,
  "total_days": 87,
  "trimester": "TCN1",
  "source": "diagnosis.mo_ta"
}
```

Boundary:

| Tam cá nguyệt | Tuổi thai |
|---|---|
| `TCN1` | Đến 13 tuần 6 ngày |
| `TCN2` | 14 tuần đến 28 tuần 6 ngày |
| `TCN3` | Từ 29 tuần |

Các boundary được unit test:

```text
13 tuần 6 ngày → TCN1
14 tuần 0 ngày → TCN2
28 tuần 6 ngày → TCN2
29 tuần 0 ngày → TCN3
```

Nếu không xác định được tuổi thai, pipeline fail-safe bằng cách không loại bất kỳ trimester rule nào.

## 10. Bước 5 — Lọc criteria theo tam cá nguyệt

`filter_criteria_by_trimester()` giữ:

1. Các rule không có `scope.tam_ca_nguyet` — common rules.
2. Các rule có `scope.tam_ca_nguyet` đúng với hồ sơ.

Ví dụ TCN1:

```text
Giữ: R01 + R02 + R03 + R06 + R07
Không gửi LLM: R04 + R05
```

Kết quả trên dữ liệu mẫu:

| Hồ sơ | Tuổi thai | TCN | Criteria trước | Gửi LLM | Không gửi |
|---|---:|---|---:|---:|---:|
| `sim_kham1` | 12w3d | TCN1 | 53 | 33 | 20 |
| `sim_kham2` | 21w5d | TCN2 | 53 | 32 | 21 |
| `sim_kham3` | 26w1d | TCN2 | 53 | 32 | 21 |

Rule thuộc tam cá nguyệt khác không xuất hiện trong result public.

## 11. Bước 6 — Tạo prompt

### 11.1 System prompt

System prompt định nghĩa:

- Vai trò compliance checker.
- Chỉ sử dụng dữ liệu cung cấp.
- Không suy diễn dữ kiện.
- Quy tắc sử dụng `THIEU_DU_LIEU`.
- Phân loại mỗi ID đúng một lần.
- Không thêm ID ngoài criteria.
- Trả JSON theo contract.
- Kết quả cần human review.

### 11.2 User prompt

User prompt gồm:

```text
REQUIRED_CRITERIA
OUTPUT_CONTRACT
CLINICAL_RECORD
```

`REQUIRED_CRITERIA` chỉ chứa common rules và rules của tam cá nguyệt phù hợp.

`CLINICAL_RECORD` là payload sau allowlist, redaction và residual PII scan.

## 12. Bước 7 — Provider API

### 12.1 OpenAI-compatible

Adapter gọi:

```text
POST {LLM_BASE_URL}/chat/completions
```

Header:

```text
Authorization: Bearer <LLM_API_KEY>
Content-Type: application/json
```

API key không được ghi vào log hoặc exception.

### 12.2 Anthropic

Adapter gọi:

```text
POST {LLM_BASE_URL}/messages
```

Header gồm `x-api-key` và `anthropic-version`.

### 12.3 Timeout

Request timeout được lấy từ `LLM_TIMEOUT_SECONDS`. HTTP error chỉ ghi status code; response body của provider không
được echo vào exception vì có thể chứa lại request data.

## 13. Bước 8 — Strict Structured Outputs

Với OpenAI, pipeline sử dụng `response_format: json_schema` và `strict: true`.

Schema bắt buộc:

- Top-level object.
- `dat_ids` phải là array string.
- `khong_ap_dung_ids` phải là array string.
- `exceptions` phải là array object.
- Exception status chỉ được `KHONG_DAT` hoặc `THIEU_DU_LIEU`.
- Required fields đầy đủ.
- `additionalProperties: false`.

Strict schema bảo đảm shape nhưng không thể bảo đảm ba arrays không chứa cùng một ID. Do đó local coverage validation
vẫn bắt buộc.

## 14. Compact provider contract

Provider được yêu cầu trả:

```json
{
  "thong_tin_lan_kham": {
    "tuoi_thai_tuan": 12,
    "tuoi_thai_ngay": 3,
    "phan_loai_nguy_co": "khong_ghi_nhan",
    "lan_kham_thu": null
  },
  "dat_ids": [
    "R01.1",
    "R01.2",
    "R02.4"
  ],
  "khong_ap_dung_ids": [
    "R02.2"
  ],
  "exceptions": [
    {
      "item_id": "R02.1",
      "trang_thai": "KHONG_DAT",
      "bang_chung": "",
      "ghi_chu": "Không ghi nhận huyết áp."
    }
  ],
  "tong_ket": {
    "vi_pham_critical": ["R02.1"],
    "khuyen_nghi": "Bổ sung sinh hiệu."
  }
}
```

`khong_ap_dung_ids` là field nội bộ phục vụ coverage validation. Nó không được ghi vào result public.

## 15. Normalize representation

Strict schema là cơ chế chính. Parser vẫn có normalization cho provider khác hoặc response lịch sử:

- Exceptions dạng array.
- Exceptions group theo `KHONG_DAT`/`THIEU_DU_LIEU`.
- Exceptions dạng map `item_id → status/object`.
- Alias `status`, `evidence`, `reason` được chuyển sang field tiếng Việt tương ứng.

Normalization chỉ thay đổi representation, không tự thay đổi kết luận lâm sàng. Nếu không xác định được status một
cách chắc chắn, response bị chặn.

## 16. Coverage validation

Pipeline kiểm tra tập hợp:

```text
dat_ids
∪ khong_ap_dung_ids
∪ exception item_ids
= REQUIRED_CRITERIA
```

Các điều kiện:

- Không thiếu ID.
- Không có ID ngoài rules.
- Không có ID trùng cùng hoặc khác nhóm.
- Status thuộc tập cho phép.
- Số ID bằng số criteria gửi LLM.

Nếu một ID bị lặp cùng một trạng thái, code có thể deduplicate representation. Nếu một ID nằm trong hai nhóm có
hai trạng thái khác nhau, code không tự chọn kết luận mà gửi focused repair.

## 17. Focused repair

Repair chỉ gửi các ID bị thiếu hoặc mâu thuẫn, không chạy lại toàn bộ criteria.

Repair dùng contract riêng:

```json
{
  "evaluations": [
    {
      "item_id": "R06.2",
      "trang_thai": "DAT",
      "bang_chung": "SẮT 30MG...",
      "ghi_chu": "Có chỉ định vi chất."
    }
  ]
}
```

Mỗi ID repair xuất hiện đúng một hàng. Strict schema cho phép status:

```text
DAT
KHONG_DAT
KHONG_AP_DUNG
THIEU_DU_LIEU
```

Telemetry ghi:

```json
{
  "api_calls": 2,
  "repaired_criteria": ["R06.2"]
}
```

## 18. Public result contract

Result ghi vào `results/<input>.result.json` không chứa rules ngoài tam cá nguyệt và không chứa
`KHONG_AP_DUNG`.

Ví dụ:

```json
{
  "run_id": "...",
  "result": {
    "thong_tin_lan_kham": {
      "tuoi_thai_tuan": 12,
      "tuoi_thai_ngay": 3,
      "phan_loai_nguy_co": "khong_ghi_nhan",
      "lan_kham_thu": null
    },
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
    "tong_ket": {
      "vi_pham_critical": ["R02.1"],
      "khuyen_nghi": "Bổ sung sinh hiệu."
    },
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

### 18.1 `dat_ids`

Chỉ chứa ID. Không evidence và không explanation để giảm output token.

### 18.2 `exceptions`

Chỉ chứa:

- `KHONG_DAT`: có đủ dữ liệu để kết luận chưa đáp ứng.
- `THIEU_DU_LIEU`: chưa đủ bằng chứng để xác minh.

### 18.3 Những gì bị loại khỏi public result

- Rule thuộc tam cá nguyệt khác.
- Criteria được model đánh giá `KHONG_AP_DUNG`.
- Evidence/ghi chú cho criteria `DAT`.
- Raw prompt.
- Raw provider response.
- API key.

## 19. Batch error isolation

Một file lỗi không làm các file sau bị bỏ qua. CLI ghi:

```json
{
  "status": "error",
  "source_file": "sim_kham2.json",
  "error_type": "CriteriaValidationError",
  "error": "..."
}
```

sau đó tiếp tục hồ sơ tiếp theo. Sau batch, process exit code khác 0 nếu có ít nhất một file thất bại.

## 20. Telemetry

Mỗi run ghi một dòng vào `results/runs.jsonl`.

Ví dụ:

```json
{
  "run_id": "...",
  "started_at": "2026-07-17T...Z",
  "pipeline_version": "compact-applicable-v3.1",
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "status": "success",
  "gestational_age": {
    "weeks": 12,
    "days": 3,
    "trimester": "TCN1"
  },
  "criteria_count_before_scope": 53,
  "criteria_count_after_scope": 33,
  "excluded_by_scope_count": 20,
  "input_tokens": 4775,
  "output_tokens": 490,
  "total_tokens": 5265,
  "estimated_cost_usd": 0.002694,
  "latency_ms": 12351.6,
  "api_calls": 2,
  "repaired_criteria": ["R01.2"],
  "pii_scan_passed": true,
  "request_ids": ["req_..."]
}
```

### 20.1 Status của run

| Status | Ý nghĩa | API call |
|---|---|---:|
| `dry_run` | Hoàn thành local stages, dừng trước provider | 0 |
| `success` | Provider result đã parse và validate thành công | 1 hoặc nhiều hơn |
| `error` | Network/provider/parse/schema/coverage/write thất bại | Có thể 0 hoặc nhiều hơn |
| `blocked_pii` | Residual PII scan không pass | 0 |

`success` là trạng thái kỹ thuật của pipeline, không có nghĩa hồ sơ đạt toàn bộ rules.

### 20.2 Hash phục vụ truy vết

Telemetry ghi:

```text
prompt_sha256
rules_sha256
input_sha256
output_sha256
```

Hash dùng để nhận biết version/input thay đổi mà không lưu raw prompt trong telemetry. Hash không thay thế access
control hoặc audit system.

### 20.3 Cost

Cost được tính:

```text
input_tokens × input_price / 1,000,000
+ output_tokens × output_price / 1,000,000
```

Nếu có repair, token và cost của tất cả API calls được cộng lại.

## 21. Pipeline versions

### `baseline-v1`

- Gửi toàn bộ 53 criteria.
- Row-oriented output cho mọi criteria.
- Output token cao.

### `trimester-v2`

- Parse tuổi thai local.
- Lọc criteria theo tam cá nguyệt.
- Giảm input/output token.

### `compact-output-v3`

- `dat_ids`, `khong_ap_dung_ids`, `exceptions`.
- Strict JSON Schema.
- Chỉ exceptions có explanation.

### `compact-applicable-v3.1`

- Public result chỉ còn `dat_ids` và `exceptions`.
- Rule ngoài tam cá nguyệt không xuất hiện.
- `KHONG_AP_DUNG` không xuất hiện.
- Repair sử dụng `evaluations[]` để tránh cross-array conflict.

## 22. Benchmark hiện có

Benchmark trên ba hồ sơ mẫu cho thấy việc lọc tam cá nguyệt và compact output giảm đáng kể output token, latency và
cost. Các số liệu chi tiết được lưu trong manifest tại `backend/ai/versions/` và telemetry `results/runs.jsonl`.

Không sử dụng benchmark ba hồ sơ này để kết luận chất lượng lâm sàng. Cần gold dataset đã de-identify và đánh giá
độc lập bởi chuyên gia.

## 23. Unit tests

Test hiện bao phủ:

- Loại PII cấu trúc và trong free text.
- Parse tuổi thai.
- Boundary tam cá nguyệt.
- Fail-safe khi không tìm thấy tuổi thai.
- Scope filtering.
- Compact output expansion.
- Missing/duplicate/unknown IDs.
- Grouped exceptions và ID-map normalization.
- Strict JSON Schema shape.
- Public result không chứa `KHONG_AP_DUNG`.
- Focused repair row coverage.

Chạy:

```bash
npm run test:ai
```

## 24. Failure modes và cách xử lý

### API key chưa cấu hình

```text
RuntimeError: LLM_API_KEY chua duoc cau hinh
```

Kiểm tra `.env`, không commit key.

### Network/DNS lỗi

```text
URLError
TimeoutError
```

Run được ghi `error`; các file khác vẫn tiếp tục.

### Provider HTTP error

```text
HTTP 401 → key/auth
HTTP 429 → rate limit
HTTP 5xx → provider/server
```

Response body không được log.

### JSON parse error

Provider không trả JSON hợp lệ hoặc output bị cắt. Run bị chặn.

### Coverage error

Các trường hợp:

- Thiếu ID.
- ID lạ.
- ID trùng.
- Một ID ở hai nhóm mâu thuẫn.
- Status ngoài enum.

Pipeline dùng focused repair nếu có thể; nếu repair vẫn không hợp lệ, run thất bại.

### PII block

Nếu residual scan phát hiện PII, request không được gửi.

## 25. Privacy và lưu trữ

`results/` bị `.gitignore` vì result có thể chứa nội dung lâm sàng trong exceptions. Không commit result thật lên GitHub.

Không log:

- API key.
- Raw prompt.
- Raw clinical record.
- Raw provider response.
- PII đã bị loại.

Cần thiết kế thêm trước production:

- Encryption at rest.
- RBAC.
- Audit access.
- Retention/deletion policy.
- Key rotation.
- Data processing agreement với provider.
- Region/data residency review.
- Incident response.

## 26. Những giới hạn hiện tại

1. Parser tuổi thai phụ thuộc field cấu trúc hoặc pattern trong `diagnosis.mo_ta`.
2. Nếu tuổi thai sai trong nguồn, scope filter cũng có thể sai.
3. Conditional applicability vẫn cần LLM đánh giá.
4. Structured output bảo đảm shape nhưng không bảo đảm kết luận lâm sàng đúng.
5. Focused repair làm tăng input token và số API calls.
6. HTTP adapter hiện chưa dùng async connection pooling.
7. Batch đang chạy tuần tự.
8. Chưa có persistent result cache.
9. Chưa có stage-level latency chi tiết.
10. Chưa có gold dataset hoặc chỉ số precision/recall/F1.

## 27. Hướng tối ưu tiếp theo

### 27.1 Giảm repair rate

- Thử status-map contract thay vì ba arrays.
- Benchmark prompt wording.
- Ghi repair rate theo model/version.
- Không tự giải quyết kết luận mâu thuẫn bằng code.

### 27.2 Deterministic rules

Các tiêu chí có thể kiểm tra local:

- Mạch/huyết áp có null hay không.
- Chiều cao/cân nặng/BMI.
- ICD code.
- Liều sắt/acid folic/canxi.
- Tuổi thai và lịch tái khám.

LLM chỉ nên xử lý free text khó định lượng.

### 27.3 Result cache

Cache key đề xuất:

```text
provider
+ model
+ pipeline_version
+ prompt_sha256
+ rules_sha256
+ input_sha256
+ output_schema_version
```

Cache hit vẫn phải chạy PII scan và validation. Không cache run lỗi.

### 27.4 Async/concurrency

Chuyển sang `httpx.AsyncClient` và `asyncio.Semaphore` để:

- Tái sử dụng connection.
- Chạy nhiều hồ sơ song song.
- Giảm wall-clock latency của batch.
- Kiểm soát rate limit.

Parallelism giảm thời gian batch nhưng không giảm token/cost.

### 27.5 Stage telemetry

Nên bổ sung:

```text
load_ms
redaction_ms
scope_filter_ms
prompt_build_ms
api_ms
repair_ms
parse_ms
validation_ms
write_ms
```

### 27.6 Clinical evaluation

Cần tập gold đã de-identify và đo:

- Recall của `KHONG_DAT`.
- Recall riêng cho `CRITICAL`.
- False-negative rate.
- Precision.
- Agreement với chuyên gia.
- Schema-valid rate.
- Repair rate.
- Cost/hồ sơ.
- P50/P95 latency.

## 28. Checklist trước production

- [ ] Rules đã được bệnh viện phê duyệt và version hóa.
- [ ] Gold dataset đã de-identify.
- [ ] Clinical reviewer xác nhận threshold chất lượng.
- [ ] Privacy/security review hoàn tất.
- [ ] DPA và data residency của provider được duyệt.
- [ ] API key nằm trong secret manager, không chỉ `.env`.
- [ ] Rate limit, retry và backoff được cấu hình.
- [ ] Result encryption và retention policy được triển khai.
- [ ] Monitoring P50/P95 latency, error rate, repair rate và cost.
- [ ] Human-review workflow rõ ràng.
- [ ] Không có đường tự động ghi kết quả AI vào bệnh án chính thức.

## 29. Tệp triển khai chính

| File | Trách nhiệm |
|---|---|
| `backend/ai/clinical_checker/cli.py` | CLI, batch file discovery, error isolation, result write |
| `backend/ai/clinical_checker/config.py` | `.env` và settings |
| `backend/ai/clinical_checker/privacy.py` | Allowlist, redaction, residual PII scan |
| `backend/ai/clinical_checker/provider.py` | OpenAI/Anthropic HTTP calls và token usage |
| `backend/ai/clinical_checker/pipeline.py` | Scope, prompt, schema, normalization, validation, repair, telemetry |
| `backend/ai/tests/` | Unit tests |
| `backend/ai/versions/` | Pipeline manifests và benchmark metadata |
| `results/runs.jsonl` | Runtime telemetry local |

## 30. Tóm tắt contract cuối

```text
Input:
  data/*.json + rules/*.json

Local safety:
  allowlist → redact → PII scan

Local optimization:
  parse tuổi thai → filter tam cá nguyệt

Provider:
  compact strict JSON

Validation:
  coverage + status + focused repair

Public result:
  dat_ids[]
  exceptions[KHONG_DAT | THIEU_DU_LIEU]

Không ghi public result:
  rules ngoài tam cá nguyệt
  KHONG_AP_DUNG
  evidence cho DAT

Observability:
  results/runs.jsonl
```

## 31. Tích hợp AI checker vào giao diện web

Ngoài CLI xử lý file, pipeline được expose qua endpoint:

```http
POST /api/v1/ai/check-record
Content-Type: application/json

{
  "record": { "...": "minimum necessary clinical record" }
}
```

Frontend gọi endpoint trong `frontend/src/lib/aiCheck.ts`. Hàm `buildCheckerRecord()` tạo một record riêng cho
checker, không gửi nguyên đối tượng bệnh nhân đang hiển thị trên HIS.

Luồng web:

```text
Bác sĩ nhấn Kiểm tra hồ sơ (AI)
→ frontend lấy giá trị mới nhất từ form
→ buildCheckerRecord() chỉ chọn trường lâm sàng cần thiết
→ POST /api/v1/ai/check-record
→ backend tiếp tục allowlist + residual PII scan
→ lọc rule theo tam cá nguyệt
→ gọi provider
→ deterministic post-check
→ trả kết luận + criteria catalog
→ UI dựng bản bệnh án và remediation workspace
```

Hai lớp lọc dữ liệu được giữ độc lập:

1. Frontend chỉ tạo payload minimum-necessary.
2. Backend vẫn allowlist, redact và fail-closed nếu còn mẫu PII.

Không được bỏ lớp bảo vệ backend chỉ vì frontend đã loại PII. Client không phải trust boundary.

## 32. Giao diện scan hồ sơ

Trong lúc chờ API, modal không chỉ hiển thị spinner. UI dựng một bản giấy A4 mô phỏng hồ sơ đang kiểm tra.

### 32.1 Hiệu ứng scan

- Một scan beam chạy liên tục theo chiều dọc trang giấy.
- Chu kỳ hiện tại khoảng `1.35 giây/chiều`.
- Beam dùng gradient, border và shadow; không can thiệp dữ liệu hoặc API.
- Rule stream đổi khoảng `720 ms/lần`, hiển thị rule hiện tại rõ nhất và hai rule trước mờ dần.

Rule stream chỉ là progress affordance để giải thích hệ thống đang làm gì. Nó không khẳng định provider đã hoàn tất
rule đang hiển thị và không được dùng làm audit evidence.

### 32.2 Che PII trên bản xem trước lúc scan

Mặc dù payload thật đã bỏ PII, bản giấy local vẫn có dữ liệu thật để người dùng nhận ra hồ sơ. Điều này dễ tạo hiểu
lầm rằng AI provider đang đọc PII. Vì vậy trạng thái scan che đen:

- Họ tên bệnh nhân.
- Mã y tế.
- Địa chỉ.
- Tên bác sĩ điều trị.

Việc che này là UX privacy cue, không thay thế redaction ở backend. Sau khi có kết quả, bản xem nội bộ có thể hiển
thị thông tin thật cho người dùng đã được phân quyền.

## 33. Giao diện kết quả hai cột

Kết quả dùng workspace hai cột:

| Cột | Nội dung |
|---|---|
| Trái | Bản bệnh án dạng A4, vị trí cần sửa và editor |
| Phải | Kết luận, danh sách rule không đạt, severity, lý do và gợi ý sửa |

Mỗi lỗi bên phải dùng tên tiêu chí đầy đủ từ `criteria_catalog`. Mã như `R02.4` chỉ là mã tham chiếu, không phải mô
tả chính dành cho bác sĩ.

Hover một lỗi bên phải làm nổi bật đúng editor bên trái. Hover editor bên trái cũng làm nổi bật lỗi tương ứng. State
liên kết dùng `item_id`, không dùng vị trí mảng, để vẫn đúng khi danh sách được sắp xếp hoặc thay đổi.

## 34. Nguyên tắc highlight chính xác

UI không được mặc định tô cả section lớn chỉ vì không biết rule thuộc dòng nào. Cách này tạo cảm giác nhiều nội dung
đều sai và bác sĩ không biết phải sửa gì.

Thứ tự ưu tiên:

1. Highlight đúng structured field, ví dụ mạch hoặc chiều cao.
2. Nếu dữ liệu đã có nhưng không đạt, tìm và highlight đúng dòng hiện hữu.
3. Nếu dữ liệu hoàn toàn không tồn tại, đặt một remediation block nhỏ trong đúng section.
4. Không tìm thấy anchor không đồng nghĩa với tô toàn bộ section.

Ví dụ ánh xạ sinh hiệu:

| Rule | Vùng sửa |
|---|---|
| `R02.1` | Mạch + huyết áp |
| `R02.2` | Nhiệt độ |
| `R02.3` | Nhịp thở |
| `R02.4` | Chiều cao + cân nặng + BMI |
| `R02.5` | Nội dung khám toàn thân |
| `R02.6` | Nội dung khám bụng |

`R02.2` và `R02.3` là rule có điều kiện. Nếu pipeline trả `KHONG_AP_DUNG`, trường trống không được hiển thị như một
lỗi. Nếu trả `KHONG_DAT`, UI mới tạo editor tương ứng.

## 35. Remediation registry

Logic highlight và chỉnh sửa được tập trung thành registry thay vì viết `if/else` rải rác trong JSX.

Mỗi entry có cấu trúc khái niệm:

```ts
type RemediationConfig = {
  section: RemediationSection
  field?: keyof AiDocumentNotes
  mode: 'structured' | 'replace-line' | 'append'
  keywords?: string[]
  editLabel?: string
}
```

Ý nghĩa:

- `section`: vị trí trên bản giấy.
- `field`: trường form nhận thay đổi.
- `mode`: loại remediation.
- `keywords`: anchor để định vị dòng hiện có.
- `editLabel`: hướng dẫn ngắn hiển thị cho bác sĩ.

Ví dụ:

```ts
'R06.2': {
  section: 'plan',
  field: 'treatmentPlan',
  mode: 'replace-line',
  keywords: ['SAT', 'ACID FOLIC', 'CANXI'],
  editLabel: 'Điều chỉnh liều vi chất trực tiếp'
}
```

Text được normalize Unicode, bỏ dấu và chuyển uppercase trước khi so khớp anchor. Nhờ đó `Sắt`, `SAT`, khác biệt
hoa/thường hoặc dấu tiếng Việt vẫn định vị được cùng một dòng.

### 35.1 Chế độ `structured`

Dùng khi form có trường dữ liệu riêng. Editor dùng input theo đúng kiểu dữ liệu và cập nhật state của form.

Ví dụ:

- Mạch, huyết áp, nhịp thở, nhiệt độ.
- Chiều cao và cân nặng.
- BMI được tính lại từ chiều cao và cân nặng sau khi sửa.

### 35.2 Chế độ `replace-line`

Dùng khi dữ liệu đã tồn tại nhưng giá trị không tuân thủ. Renderer:

1. Tách field thành các dòng.
2. Normalize từng dòng.
3. So khớp `keywords` trong registry.
4. Highlight đúng dòng đầu tiên phù hợp cho rule.
5. Biến dòng đó thành editor trực tiếp.
6. Khi blur, thay đúng dòng trong field gốc và đồng bộ về form.

Các trường hợp hiện được hỗ trợ gồm:

- PARA và tiền sử sản khoa.
- Tiền căn nội/ngoại khoa.
- Dòng xét nghiệm.
- Sàng lọc lệch bội.
- Sàng lọc tiền sản giật.
- Liều Sắt, Acid folic và Canxi.
- Lịch hoặc ngày tái khám.

### 35.3 Chế độ `append`

Dùng khi hồ sơ hoàn toàn thiếu dữ liệu nên không có dòng gốc để highlight. UI tách rõ:

- Dải vàng: nhắc nhở của AI, chỉ đọc.
- Ô trắng viền xanh: `Nội dung bác sĩ bổ sung`.

Khi bác sĩ nhập và blur, nội dung được nối vào trường đích. Nhiều remediation trong cùng một field được append tuần
tự, không ghi đè lẫn nhau.

### 35.4 Fallback an toàn

Nếu rule `replace-line` không tìm được anchor, UI tự hạ xuống `append`. Điều này tránh mất editor và tránh highlight
sai một vùng lớn.

Rule chưa có entry riêng được ánh xạ theo prefix vào section hợp lý, ví dụ `R01.*` vào diễn biến/tiền sử và `R08.*`
vào tư vấn. Đây chỉ là fallback UX; nên bổ sung registry cụ thể khi rule mới được đưa vào production.

## 36. Gợi ý sửa theo từng lỗi

Mỗi card lỗi có mục `Gợi ý sửa`. Nội dung lấy từ `editLabel` trong remediation registry. Nếu entry không có label,
UI dùng hướng dẫn mặc định theo mode:

- `append`: bổ sung thông tin tại ô được đánh dấu bên trái.
- `replace-line`: cập nhật giá trị hiện tại tại dòng được đánh dấu.
- `structured`: nhập giá trị vào field cấu trúc.

Gợi ý sửa không được tự động thay đổi bệnh án. Bác sĩ vẫn là người nhập, kiểm tra và chịu trách nhiệm lưu dữ liệu.

## 37. Đồng bộ editor về form

Editor trên bản A4 không phải bản dữ liệu độc lập. Thay đổi được đồng bộ về form đang mở:

- Clinical progress → textarea `Diễn biến bệnh`.
- Treatment plan → textarea `Hướng xử trí`.
- Diagnosis summary → textarea `Ghi chú chẩn đoán`.
- Counseling record → textarea `Biên bản tư vấn`.
- Vital signs → state của các trường sinh hiệu.

Sau khi sửa, kết quả AI đang hiển thị vẫn là kết quả của lần chạy cũ. Bác sĩ cần chạy lại checker để xác nhận rule đã
đạt. Không được tự đổi card sang `DAT` chỉ dựa trên việc người dùng đã nhập text.

Một cải tiến tiếp theo phù hợp là nút `Kiểm tra lại thay đổi`, chỉ gửi lại các rule bị lỗi và các field vừa sửa.

## 38. Khử trùng lặp chẩn đoán

Chẩn đoán có thể xuất hiện đồng thời trong:

- ICD bệnh chính + mô tả.
- Ghi chú chẩn đoán.

Trước khi hiển thị hoặc gửi AI, hệ thống normalize chữ, khoảng trắng và dấu gạch ngang. Nếu ghi chú bằng đúng mô tả
ICD hoặc `ICD + mô tả`, nó không được in/gửi lần thứ hai. Ghi chú có nội dung bổ sung thực sự vẫn được giữ.

## 39. Tăng tính nhất quán của kết quả

LLM không bảo đảm tuyệt đối deterministic. Hệ thống hiện dùng hai lớp giảm dao động:

### 39.1 Provider temperature

OpenAI request đặt:

```json
{ "temperature": 0 }
```

Điều này giảm sampling variation nhưng không phải cam kết cùng output tuyệt đối.

### 39.2 Deterministic checks

Rule có thể xác định chắc chắn từ structured data nên được kiểm tra bằng code. `R02.4` hiện được override local:

- Chiều cao phải là số lớn hơn 0.
- Cân nặng phải là số lớn hơn 0.
- BMI phải là số lớn hơn 0.

Nếu thiếu một giá trị, kết quả cuối luôn có `R02.4 = KHONG_DAT` dù LLM trả `DAT`. Telemetry ghi
`deterministic_criteria` để audit những rule đã bị lớp local áp dụng.

Nên tiếp tục mở rộng deterministic checks cho các rule số học, required structured fields, ngày tháng và dose range.
Không nên chuyển rule cần diễn giải ngữ cảnh lâm sàng sang code chỉ dựa trên keyword đơn giản.

## 40. Retry và xử lý lỗi provider

Provider adapter retry tối đa ba lần cho lỗi tạm thời:

- Network interruption và connection reset.
- Timeout.
- HTTP `408`, `429`, `500`, `502`, `503`, `504`.

Backoff hiện tại bắt đầu khoảng `350 ms` và tăng theo cấp số nhân. Các lỗi HTTP không tạm thời không retry.

Nếu ba lần đều thất bại, adapter phát `RuntimeError` đã làm sạch. API route chuyển lỗi thành `502` có thông báo rõ,
thay vì để exception mạng lọt ra thành `500`. Response body của provider không được đưa vào error message vì có thể
chứa dữ liệu từ request.

## 41. Checklist thêm rule editable mới

Khi thêm rule mới:

1. Xác định rule là structured, replace-line hay append.
2. Xác định field thật trên form nhận thay đổi.
3. Chọn section nhỏ nhất trên bản giấy.
4. Với replace-line, chọn keyword ổn định sau khi bỏ dấu.
5. Viết `editLabel` theo ngôn ngữ thao tác, không chỉ lặp lại tên rule.
6. Kiểm tra rule không highlight cả section.
7. Kiểm tra hover hai chiều bằng đúng `item_id`.
8. Sửa dữ liệu và xác nhận form gốc nhận thay đổi.
9. Chạy lại checker và xác nhận kết quả mới.
10. Bổ sung deterministic check nếu rule hoàn toàn dựa trên structured data.

## 42. Tệp liên quan đến tính năng web remediation

| File | Trách nhiệm |
|---|---|
| `frontend/src/App.tsx` | Modal scan/result, paper renderer, remediation registry, editor và form synchronization |
| `frontend/src/App.module.scss` | A4 layout, PII masking, scan beam, rule stream, highlight và editor styles |
| `frontend/src/lib/aiCheck.ts` | Minimum-necessary payload, diagnosis deduplication và API call |
| `frontend/src/types/aiCheck.ts` | Type của result, criteria catalog và telemetry trả về UI |
| `backend/api/app/routers/ai.py` | Web endpoint, rule catalog và HTTP error mapping |
| `backend/ai/clinical_checker/provider.py` | Temperature, retry, timeout và provider error sanitization |
| `backend/ai/clinical_checker/pipeline.py` | LLM evaluation, deterministic override, validation và telemetry |
