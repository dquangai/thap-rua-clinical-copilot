# Versioning hồ sơ và AI Result Cache

## 1. Mục đích

Tài liệu này mô tả tính năng quản lý phiên bản tài liệu lâm sàng và tái sử dụng kết quả AI trong Tháp Rùa Clinical Copilot.

Tính năng giải quyết hai nhu cầu chính:

1. Mỗi thay đổi nghiệp vụ trên hồ sơ được lưu thành một phiên bản bất biến, có thời gian và danh tính người sửa.
2. Kết quả AI được lưu trong MongoDB và tái sử dụng khi dữ liệu AI thực sự nhận được không thay đổi, tránh gọi lại nhà cung cấp AI và tốn token.

Phạm vi đã triển khai hiện tại:

- Versioning cho collection `clinical_records`.
- Lịch sử snapshot trong `clinical_record_versions`.
- AI cache cho:
  - `POST /api/v1/ai/check-record`.
  - Worker của `POST /api/v1/ai/jobs`.
  - `POST /api/v1/ai/generate-counseling`.
- Telemetry cho cache hit, cache miss, API calls và số token tiết kiệm.

Hạ tầng versioning được tách trong module dùng chung để có thể mở rộng sang đơn thuốc, phiếu xét nghiệm, phiếu tư vấn và các document khác.

## 2. Khái niệm

| Khái niệm | Ý nghĩa |
|---|---|
| Current document | Bản hiện hành trong `clinical_records`, dùng để đọc nhanh và hiển thị trên giao diện. |
| Version snapshot | Bản sao bất biến của nội dung nghiệp vụ tại một thời điểm. |
| `current_version` | Số phiên bản hiện hành, bắt đầu từ `1`. |
| `content_hash` | SHA-256 của nội dung nghiệp vụ đã chuẩn hóa. |
| Optimistic concurrency | Chỉ cập nhật nếu version client đang sửa vẫn là version hiện hành. |
| AI artifact | Kết quả AI đã hoàn thành được lưu trong `ai_artifacts`. |
| Cache hit | Có artifact phù hợp; không gọi nhà cung cấp AI. |
| Cache miss | Chưa có artifact phù hợp; gọi AI và lưu kết quả. |
| Fail-open cache | Cache lỗi không làm hỏng tính năng AI; hệ thống tiếp tục gọi AI. |

## 3. Kiến trúc tổng quan

```mermaid
flowchart LR
    UI["Bác sĩ / Frontend"] --> API["FastAPI"]
    API --> CURRENT["clinical_records\nBản hiện hành"]
    API --> HISTORY["clinical_record_versions\nSnapshot bất biến"]
    API --> REDACT["Minimum necessary + ẩn danh"]
    REDACT --> KEY["Tính AI cache key"]
    KEY --> CACHE["ai_artifacts"]
    CACHE -->|"Cache hit"| API
    CACHE -->|"Cache miss"| LLM["Nhà cung cấp AI"]
    LLM --> CACHE
```

Version của hồ sơ và cache AI có liên quan nhưng không đồng nhất:

- Version giúp quản lý lịch sử, audit và phát hiện xung đột cập nhật.
- `input_hash` xác định dữ liệu nào thực sự được gửi cho AI.
- Một hồ sơ có thể tăng version nhưng AI cache vẫn hợp lệ nếu thay đổi chỉ nằm ở trường không gửi cho AI.

## 4. Mô hình dữ liệu

### 4.1. Bản hiện hành: `clinical_records`

Ví dụ:

```json
{
  "id": "32cb2b4f-c24c-4389-a33b-60f30e66dd50",
  "patient_id": "patient-1",
  "record_id": "HS-001",
  "current_version": 4,
  "content_hash": "7df7f5...",
  "visit": {},
  "vital_signs": {},
  "clinical_note": {},
  "diagnosis": {},
  "doctor": "BS. Nguyễn Văn A",
  "signed_at": "2026-07-18T08:00:00Z",
  "updated_by": {
    "user_id": "doctor-user-id",
    "display_name": "BS. Nguyễn Văn A"
  },
  "created_at": "2026-07-18T07:30:00Z",
  "updated_at": "2026-07-18T08:15:00Z"
}
```

Collection này luôn giữ bản mới nhất để các truy vấn danh sách và workspace không phải tìm snapshot mới nhất trong lịch sử.

### 4.2. Lịch sử: `clinical_record_versions`

```json
{
  "id": "version-uuid",
  "record_id": "32cb2b4f-c24c-4389-a33b-60f30e66dd50",
  "patient_id": "patient-1",
  "version": 4,
  "snapshot": {
    "record_id": "HS-001",
    "visit": {},
    "vital_signs": {},
    "clinical_note": {},
    "diagnosis": {},
    "doctor": "BS. Nguyễn Văn A",
    "signed_at": "2026-07-18T08:00:00Z"
  },
  "content_hash": "7df7f5...",
  "changed_fields": [
    "clinical_note",
    "diagnosis"
  ],
  "created_by": {
    "user_id": "doctor-user-id",
    "display_name": "BS. Nguyễn Văn A"
  },
  "created_at": "2026-07-18T08:15:00Z"
}
```

Nếu version được tạo bằng thao tác restore, document có thêm:

```json
{
  "restored_from_version": 2
}
```

`record_id` trong collection version là UUID nội bộ của `clinical_records.id`, không phải mã nghiệp vụ tùy chọn `snapshot.record_id`.

### 4.3. AI cache: `ai_artifacts`

```json
{
  "id": "artifact-uuid",
  "cache_key": "9eab23...",
  "input_hash": "54d44a...",
  "artifact_type": "clinical_compliance_check",
  "record_id": "32cb2b4f-c24c-4389-a33b-60f30e66dd50",
  "record_version": 4,
  "pipeline_version": "compact-applicable-v3.1",
  "prompt_version": "prompt-sha256",
  "rules_version": "rules-sha256",
  "model": "gpt-4.1-mini",
  "status": "completed",
  "response": {
    "run_id": "run-uuid",
    "result": {},
    "criteria_catalog": {},
    "meta": {
      "cache_status": "miss",
      "input_tokens": 8662,
      "output_tokens": 1671,
      "total_tokens": 10333,
      "api_calls": 5
    }
  },
  "created_at": "2026-07-18T09:58:00Z"
}
```

Không lưu raw prompt hoặc dữ liệu định danh vào cache key. Artifact lưu response nghiệp vụ và các hash/metadata phục vụ truy vết.

## 5. Nội dung được version hóa

Các trường lâm sàng tham gia snapshot và `content_hash`:

```text
record_id
visit
vital_signs
clinical_note
diagnosis
doctor
signed_at
```

Các trường kỹ thuật không tham gia hash:

```text
id
patient_id
current_version
content_hash
created_at
updated_at
updated_by
```

Vì vậy, việc cập nhật tự động `updated_at` không tự tạo version mới.

## 6. Chuẩn hóa và tính hash

Nội dung được serialize thành canonical JSON theo các quy tắc:

- Sắp xếp key.
- Không thêm whitespace không cần thiết.
- Giữ Unicode tiếng Việt.
- Dùng biểu diễn chuỗi ổn định cho các kiểu như `datetime`.
- Tính SHA-256 trên chuỗi UTF-8.

Biểu thức khái quát:

```text
content_hash = SHA256(canonical_json(snapshot))
```

Nếu hash nội dung mới bằng hash hiện hành, API trả lại bản hiện hành và không tạo version.

## 7. Luồng tạo hồ sơ

```mermaid
sequenceDiagram
    participant D as Bác sĩ
    participant API as FastAPI
    participant C as clinical_records
    participant V as clinical_record_versions

    D->>API: POST clinical record + Bearer token
    API->>API: Tạo actor snapshot
    API->>API: Tính snapshot và content_hash
    API->>C: Insert current_version = 1
    API->>V: Insert immutable version 1
    API-->>D: 201 + hồ sơ v1
```

Nếu insert version thất bại sau khi insert bản hiện hành, code thực hiện xóa bù bản hiện hành vừa tạo.

## 8. Luồng cập nhật và chống ghi đè

Client phải gửi version mà bác sĩ đang sửa:

```http
PATCH /api/v1/patients/{patient_id}/clinical-records/{record_id}
Authorization: Bearer <access-token>
If-Match-Version: 3
Content-Type: application/json

{
  "diagnosis": {
    "icd10": "O24.4",
    "mo_ta": "Đái tháo đường thai kỳ"
  }
}
```

Backend thực hiện:

1. Đọc bản hiện hành.
2. So sánh `If-Match-Version` với `current_version`.
3. Áp dụng patch lên snapshot hiện hành.
4. Tính hash mới.
5. Nếu hash không đổi, trả bản hiện hành và không tăng version.
6. Insert snapshot `current_version + 1` vào lịch sử.
7. Cập nhật bản hiện hành bằng compare-and-set trên cả `current_version` và `content_hash`.
8. Nếu compare-and-set thất bại, xóa version vừa chèn và trả conflict.

### 8.1. Version conflict

Nếu hai bác sĩ cùng mở version 3:

```text
Bác sĩ A lưu trước: v3 → v4
Bác sĩ B gửi If-Match-Version: 3
Backend thấy current_version = 4
→ từ chối ghi đè
```

Response:

```http
HTTP/1.1 409 Conflict
Content-Type: application/json
```

```json
{
  "detail": {
    "code": "VERSION_CONFLICT",
    "message": "Clinical record was changed by another user",
    "expected_version": 3,
    "current_version": 4
  }
}
```

Frontend nên tải lại version mới, hiển thị khác biệt và yêu cầu bác sĩ xác nhận trước khi lưu lại.

## 9. Hồ sơ tạo trước khi có versioning

Khi đọc hoặc sửa một hồ sơ cũ chưa có metadata version, backend tự backfill:

- Tạo snapshot version 1.
- Tính `content_hash`.
- Đặt `current_version = 1`.
- Ghi actor đặc biệt:

```json
{
  "user_id": "legacy-import",
  "display_name": "Dữ liệu trước versioning"
}
```

Nếu hồ sơ cũ có trường `doctor`, tên đó được dùng làm `display_name` cho snapshot backfill.

## 10. API lịch sử phiên bản

### 10.1. Danh sách version

```http
GET /api/v1/patients/{patient_id}/clinical-records/{record_id}/versions
```

Query parameters:

| Tham số | Mặc định | Ý nghĩa |
|---|---:|---|
| `limit` | `50` | Số version tối đa, từ 1 đến 200. |
| `before_version` | Không có | Chỉ lấy version nhỏ hơn giá trị này. |

Kết quả được sắp xếp version giảm dần.

### 10.2. Đọc một version

```http
GET /api/v1/patients/{patient_id}/clinical-records/{record_id}/versions/{version}
```

### 10.3. So sánh version

```http
GET /api/v1/patients/{patient_id}/clinical-records/{record_id}/versions/4/diff
```

Mặc định version 4 được so với version 3. Có thể chỉ định:

```http
GET /api/v1/patients/{patient_id}/clinical-records/{record_id}/versions/4/diff?compare_to=1
```

Response:

```json
{
  "record_id": "record-uuid",
  "from_version": 3,
  "to_version": 4,
  "changed_fields": ["diagnosis"],
  "changes": {
    "diagnosis": {
      "before": {"icd10": "Z34.0"},
      "after": {"icd10": "O24.4"}
    }
  }
}
```

### 10.4. Restore

```http
POST /api/v1/patients/{patient_id}/clinical-records/{record_id}/versions/2/restore
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "expected_version": 5
}
```

Restore không xóa version 3–5 và không đưa con trỏ lùi về version 2. Backend tạo version 6 có snapshot giống version 2 và ghi `restored_from_version = 2`.

## 11. Danh tính người sửa

Các thao tác tạo, cập nhật và restore yêu cầu Bearer token qua dependency `get_current_user`.

Actor snapshot gồm:

```json
{
  "user_id": "Supabase user ID",
  "display_name": "full_name, name, email hoặc user ID"
}
```

`user_id` là định danh audit chính. `display_name` là snapshot để lịch sử vẫn hiển thị được tên tại thời điểm chỉnh sửa.

Trạng thái hiện tại:

- Mutation của hồ sơ yêu cầu xác thực.
- API đọc hồ sơ và lịch sử vẫn giữ behavior public của ứng dụng hiện tại.

Đối với production chứa dữ liệu sức khỏe thật, cần yêu cầu xác thực và kiểm tra quyền truy cập bệnh nhân cho cả API đọc.

## 12. Cách AI cache hoạt động

### 12.1. Chuẩn bị dữ liệu

Trước khi tính cache key, hồ sơ đi qua cùng pipeline bảo vệ dữ liệu dùng cho prompt:

1. Chỉ giữ các section được phép.
2. Chỉ giữ các field minimum-necessary.
3. Loại tên, số điện thoại, địa chỉ, mã bệnh nhân và các định danh khác.
4. Quét residual PII.
5. Tính `input_hash` từ safe input.

Điều này bảo đảm cache được quyết định theo dữ liệu AI thực sự nhìn thấy, không phải toàn bộ document nội bộ.

### 12.2. Thành phần cache key

```text
input_hash = SHA256(canonical_json(safe_input))

cache_key = SHA256(canonical_json({
  artifact_type,
  input_hash,
  pipeline_version,
  prompt_version,
  rules_version,
  model
}))
```

| Thành phần | Lý do tham gia cache key |
|---|---|
| `artifact_type` | Không dùng kết quả kiểm tra tuân thủ cho tác vụ sinh tư vấn. |
| `input_hash` | Cache chỉ hit khi dữ liệu AI nhận được giống nhau. |
| `pipeline_version` | Pipeline xử lý thay đổi phải làm cache cũ mất hiệu lực. |
| `prompt_version` | Prompt thay đổi có thể làm kết quả thay đổi. |
| `rules_version` | Bộ quy tắc y khoa thay đổi phải đánh giá lại. |
| `model` | Model khác có thể tạo kết quả khác. |

### 12.3. Vì sao không dùng riêng `record_version` làm cache key?

Ví dụ bác sĩ sửa số điện thoại:

```text
Hồ sơ v4 → v5
```

Số điện thoại không được gửi cho AI. Nếu cache key chứa bắt buộc `record_version`, hệ thống sẽ gọi AI lại dù safe input không đổi.

Thiết kế hiện tại:

```text
record_version thay đổi
safe_input không đổi
input_hash không đổi
→ cache hit
```

`record_id` và `record_version` vẫn có thể gửi trong request để lưu provenance, nhưng không thay thế kiểm tra bằng `input_hash`.

## 13. Cache hit và cache miss

### 13.1. Cache miss

```json
{
  "meta": {
    "status": "success",
    "cache_status": "miss",
    "api_calls": 5,
    "input_tokens": 8662,
    "output_tokens": 1671,
    "total_tokens": 10333,
    "original_total_tokens": 10333
  }
}
```

### 13.2. Cache hit

```json
{
  "meta": {
    "status": "cache_hit",
    "cache_status": "hit",
    "api_calls": 0,
    "input_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0,
    "original_total_tokens": 10333,
    "saved_tokens": 10333
  }
}
```

Frontend vẫn gửi request tới backend ở lần thứ hai. Request này cần thiết để tra MongoDB; nó không đồng nghĩa với việc gọi OpenAI.

## 14. Telemetry và đo token tiết kiệm

Mỗi lần gọi AI ghi technical telemetry vào `api_usage_events` khi MongoDB khả dụng:

```text
endpoint
method
status_code
status
model
pipeline_version
latency_ms
input_tokens
output_tokens
total_tokens
saved_tokens
api_calls
cache_status
cost_usd
occurred_at
```

Không truyền clinical payload vào telemetry.

Công thức tổng quát:

```text
token_saved = tổng saved_tokens của cache hit

cache_hit_rate = cache_hits / (cache_hits + cache_misses)

estimated_saving_rate ≈ cache_hit_rate
```

Ví dụ kiểm thử thực tế:

```text
Lần đầu:  cache miss, 10.333 token, 5 provider calls
Lần hai:  cache hit, 0 token, 0 provider calls
Tiết kiệm: 10.333 token cho lần hai
```

## 15. Cache fail-open

Cache được thiết kế không làm gián đoạn nghiệp vụ AI:

```text
MongoDB hoạt động
→ đọc/ghi ai_artifacts bình thường

MongoDB mất kết nối hoặc chưa cấu hình
→ bỏ qua lỗi cache
→ vẫn gọi AI
→ trả kết quả cho người dùng
```

Ưu điểm: bác sĩ vẫn dùng được tính năng AI khi cache gặp sự cố.

Đánh đổi: nếu MongoDB không khả dụng, mọi lần quét đều gọi AI và tiêu tốn token. Health endpoint phải được giám sát để phát hiện trạng thái này.

## 16. MongoDB indexes

Các index bắt buộc:

```javascript
clinical_record_versions: { record_id: 1, version: 1 } unique
clinical_record_versions: { patient_id: 1, record_id: 1, version: -1 }

ai_artifacts: { cache_key: 1 } unique
ai_artifacts: { record_id: 1, record_version: -1 }
ai_artifacts: { artifact_type: 1, input_hash: 1, created_at: -1 }
```

Unique version index ngăn hai request đồng thời cùng tạo một số version. Unique cache key index ngăn hai worker lưu trùng artifact hoàn chỉnh.

## 17. Cấu hình và khởi tạo

Thêm vào `.env` ở thư mục được dùng làm working directory khi chạy backend:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=clinical_copilot
```

Không commit `.env` hoặc URI chứa username/password.

Tạo index:

```bash
cd /path/to/thap-rua-clinical-copilot
PYTHONPATH=backend/api backend/api/.venv312/bin/python -m scripts.setup_mongodb
```

Chạy backend:

```bash
cd /path/to/thap-rua-clinical-copilot
PYTHONPATH=backend/api:backend/ai \
AI_JOB_WORKERS=4 \
AI_JOB_MAX_QUEUE=100 \
LLM_MAX_CONCURRENCY=4 \
backend/api/.venv312/bin/python -m uvicorn app.main:app \
  --reload --host 127.0.0.1 --port 4000
```

Kiểm tra health:

```bash
curl http://127.0.0.1:4000/health
```

Kết quả mong đợi:

```json
{
  "status": "ok",
  "service": "clinical-api",
  "mongodb": "configured",
  "database": "clinical_copilot",
  "openai": "configured"
}
```

Lưu ý: `mongodb: configured` xác nhận biến môi trường tồn tại. Để xác nhận kết nối thật, phải chạy script tạo index hoặc thực hiện một thao tác đọc/ghi.

## 18. Cách kiểm thử cache thủ công

Chuẩn bị payload request:

```bash
jq -c '{record: .}' docs/sample-clinical-record.json > /tmp/clinical-ai-request.json
```

Lần đầu:

```bash
curl -sS -X POST http://127.0.0.1:4000/api/v1/ai/check-record \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/clinical-ai-request.json | jq '{run_id, meta}'
```

Kỳ vọng:

```text
cache_status = miss
api_calls > 0
total_tokens > 0
```

Gửi lại đúng request:

```bash
curl -sS -X POST http://127.0.0.1:4000/api/v1/ai/check-record \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/clinical-ai-request.json | jq '{run_id, meta}'
```

Kỳ vọng:

```text
cache_status = hit
api_calls = 0
total_tokens = 0
saved_tokens > 0
```

## 19. Automated tests

Các test backend bao phủ:

- Tạo hồ sơ sinh version 1.
- Cập nhật nội dung sinh version 2.
- Patch không đổi không sinh version.
- Stale version trả `409 VERSION_CONFLICT`.
- API diff trả đúng field thay đổi.
- Restore tạo version mới và giữ provenance.
- Mutation yêu cầu danh tính bác sĩ.
- Cache key thay đổi khi input/rules/prompt/pipeline/model thay đổi.
- Lần AI thứ hai cache hit và dùng 0 token.
- Thay đổi field không gửi cho AI vẫn cache hit.

Chạy test:

```bash
PYTHONPATH=backend/api:backend/ai \
backend/api/.venv312/bin/python -m pytest backend/api/tests backend/ai/tests -q
```

## 20. Xử lý sự cố

### 20.1. Quét lần hai vẫn mất 15–30 giây

Kiểm tra:

```bash
curl http://127.0.0.1:4000/health
```

Nếu trả:

```json
{"mongodb":"missing-cloud-config"}
```

thì backend không có `MONGODB_URI`, cache đang fail-open.

Nếu health báo configured nhưng vẫn miss:

1. Kiểm tra backend có kết nối được Atlas và IP máy đã nằm trong Network Access allowlist.
2. Kiểm tra `cache_status` trong response.
3. So sánh `input_hash`, `prompt_version`, `rules_version`, `pipeline_version` và `model` của hai artifact.
4. Kiểm tra frontend có thay đổi dữ liệu đầu vào giữa hai lần quét không.
5. Kiểm tra process backend có được restart sau khi sửa `.env` không.

### 20.2. Trình duyệt vẫn hiện màn hình “AI đang đối chiếu hồ sơ”

Frontend luôn chuyển sang trạng thái loading khi gửi request tra cache. Đây là hành vi bình thường. Với cache hit, trạng thái này chỉ tồn tại trong thời gian round-trip tới backend/MongoDB và không phát sinh provider call.

Phân biệt bằng response:

```text
cache_status=hit + api_calls=0 → không gọi AI
cache_status=miss + api_calls>0 → đã gọi AI
```

### 20.3. Cache miss sau khi đổi rule hoặc prompt

Đây là hành vi đúng. Kết quả cũ không còn tương ứng với logic đánh giá hiện hành.

### 20.4. Version conflict khi lưu

Client đang sửa version cũ. Tải current document và diff mới nhất, sau đó để bác sĩ merge/confirm thay đổi.

## 21. An toàn và riêng tư

- Không đưa `MONGODB_URI`, API key hoặc access token vào log hay source control.
- AI cache key được tính sau bước minimum-necessary và redaction.
- Không lưu prompt chứa PII trong `ai_artifacts`.
- Audit sử dụng user ID xác thực, không tin tên bác sĩ do request body cung cấp.
- Không xóa version cũ khi restore.
- Không dùng cache của model/prompt/rules/pipeline khác.
- Không xem cache như kết luận y khoa độc lập; kết quả AI vẫn là công cụ hỗ trợ.

## 22. Giới hạn hiện tại và hướng production

### 22.1. Versioning mới áp dụng cho clinical records

Các document khác cần định nghĩa rõ content fields, snapshot schema và API riêng trước khi bật versioning.

### 22.2. Frontend chính vẫn dùng dữ liệu mock

Nút lưu hồ sơ trên giao diện hiện tại chưa hoàn toàn nối vào clinical-record API. Backend version/history đã sẵn sàng nhưng UI cần bổ sung:

- Gửi `If-Match-Version` khi lưu.
- Lưu `current_version` trong state.
- Màn hình danh sách version.
- Màn hình diff và thao tác restore.
- UX xử lý `VERSION_CONFLICT`.
- Hiển thị cache hit/token saved khi cần.

### 22.3. Multi-document atomicity

Implementation hiện tại dùng unique index, compare-and-set và thao tác xóa bù khi bước cập nhật thất bại. Điều này xử lý xung đột thường gặp, nhưng vẫn có một cửa sổ rất nhỏ nếu process bị crash giữa hai write.

Đối với production có yêu cầu audit nghiêm ngặt, nên bọc insert version và update current document trong MongoDB transaction trên replica set/Atlas.

### 22.4. Cache stampede

Hai request giống nhau đến đồng thời khi cache chưa có vẫn có thể cùng gọi AI; unique cache key chỉ ngăn lưu trùng sau khi hoàn thành.

Hướng cải tiến:

- Tạo artifact trạng thái `processing` bằng atomic upsert.
- Chỉ worker giành được lease gọi AI.
- Request còn lại chờ/poll artifact hoặc nhận job ID chung.

### 22.5. Cache retention

Artifact hiện không có TTL. Cần định nghĩa retention theo yêu cầu vận hành và pháp lý:

- Artifact audit cần giữ lâu.
- Artifact có thể tái tạo có thể hết hạn.
- Không xóa artifact đang được tham chiếu bởi hồ sơ đã ký nếu chính sách yêu cầu lưu bằng chứng.

### 22.6. Phân quyền đọc

Các API đọc hồ sơ hiện chưa áp dụng authorization đầy đủ. Production cần RBAC/ABAC theo cơ sở, khoa, vai trò và quan hệ chăm sóc bệnh nhân.

## 23. Checklist triển khai production

- [ ] `MONGODB_URI` lấy từ secret manager, không từ source control.
- [ ] Tên database được kiểm tra chính tả và phân tách dev/staging/prod.
- [ ] Network allowlist của Atlas được giới hạn.
- [ ] Đã chạy `scripts.setup_mongodb`.
- [ ] Unique indexes tồn tại.
- [ ] Backup và restore drill đã được kiểm thử.
- [ ] API đọc và ghi đều có authorization phù hợp.
- [ ] MongoDB transactions được bật cho audit-grade write.
- [ ] Cache stampede control được triển khai nếu tải cao.
- [ ] Có dashboard cache hit rate, saved tokens và provider cost.
- [ ] Có alert khi MongoDB/cache fail-open.
- [ ] Có retention policy cho version và AI artifact.
- [ ] Frontend xử lý version conflict và restore có xác nhận.
- [ ] Clinical safety/privacy review hoàn tất.

## 24. File triển khai chính

| File | Trách nhiệm |
|---|---|
| `backend/api/app/versioning.py` | Canonical JSON, hash, snapshot, changed fields và backfill hồ sơ cũ. |
| `backend/api/app/routers/clinical_records.py` | CRUD version-aware, history, diff, restore và concurrency control. |
| `backend/api/app/ai_cache.py` | Tạo cache key, đọc và ghi AI artifact. |
| `backend/api/app/routers/ai.py` | Tích hợp cache vào AI endpoints và worker. |
| `backend/api/app/database.py` | MongoDB indexes. |
| `backend/api/app/auth.py` | Danh tính actor dùng cho audit. |
| `backend/api/app/telemetry.py` | Cache/token/API usage telemetry. |
| `backend/api/tests/test_clinical_record_versions.py` | Test versioning API. |
| `backend/api/tests/test_ai_cache.py` | Test cache key và cache hit. |

