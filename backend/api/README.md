# Clinical API (Python + MongoDB Atlas)

FastAPI service dùng MongoDB Atlas để lưu dữ liệu lâm sàng. Các API collection tổng quát yêu cầu Supabase Bearer token; API bệnh nhân và bệnh án hiện vẫn public.

## Setup

```powershell
cd backend/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m scripts.setup_mongodb
```

Từ root chạy `npm run dev:backend`. Health ở `http://localhost:4000/health`, OpenAPI ở `http://localhost:4000/docs`.

## API

- `GET /api/v1/patients`
- `GET /api/v1/patients/{patient_id}`
- `POST /api/v1/patients`
- `GET /api/v1/patients/{patient_id}/clinical-records`
- `GET /api/v1/patients/{patient_id}/clinical-records/{record_id}`
- `POST /api/v1/patients/{patient_id}/clinical-records`
- `PATCH /api/v1/patients/{patient_id}/clinical-records/{record_id}`

## API đọc MongoDB collections

Các endpoint này yêu cầu `Authorization: Bearer <supabase-access-token>` và chỉ cho phép đọc các collection đã khai báo trong backend.

```text
GET /api/v1/collections
GET /api/v1/collections/{collection_name}
GET /api/v1/collections/{collection_name}/{document_id}
```

Danh sách document hỗ trợ `limit`, `offset`, `sort_by`, `sort_order=asc|desc` và bộ lọc equality gồm cặp `filter_field` + `filter_value`.

Ví dụ:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/collections/encounters?limit=20&sort_by=created_at&sort_order=desc"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/v1/collections/lab_results?filter_field=encounter_id&filter_value=ENC-001"
```

API không nhận MongoDB operator hoặc tên collection tùy ý từ client.

## Kiểm thử

```powershell
python -m pytest
```

## OpenAI cho agent đối chiếu xét nghiệm

Tạo file `backend/api/.env` từ `.env.example`, sau đó điền key vào **backend**:

```env
OPENAI_API_KEY=sk-proj_xxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-5.6-sol
OPENAI_BASE_URL=https://api.openai.com/v1
```

Không thêm `OPENAI_API_KEY` hoặc biến bắt đầu bằng `VITE_` vào `frontend/.env`: mọi biến `VITE_*` được đóng gói vào trình duyệt và có thể bị xem bởi người dùng. Endpoint `POST /api/v1/lab-analysis/narrative` chỉ nhận danh sách đã loại định danh gồm tên xét nghiệm, kết quả, đơn vị, khoảng tham chiếu, trạng thái và độ chênh. Phép so sánh số học vẫn chạy cục bộ; OpenAI chỉ biên tập câu chữ của bản nháp.

## AI worker queue

Tài liệu thiết kế, API contract, load test và hướng dẫn production chi tiết:
[`docs/ai-async-jobs-rate-limits.md`](../../docs/ai-async-jobs-rate-limits.md).

`AI_JOB_WORKERS` giới hạn số bệnh án xử lý đồng thời. Vì mỗi bệnh án có thể tách thành nhiều rule batch,
`LLM_MAX_CONCURRENCY` là giới hạn process-wide áp dụng tại từng HTTP call thật tới provider. `AI_JOB_MAX_QUEUE` tạo
backpressure và API trả `429` kèm `Retry-After` khi hàng đợi đầy. Job chỉ giữ bản sao bệnh án đến khi xử lý xong rồi
xoá khỏi bộ nhớ.

Queue tích hợp hiện tại là queue có giới hạn trong **một API instance**, phù hợp để triển khai bước đầu với một
Uvicorn worker. Không chạy nhiều Uvicorn/Gunicorn worker hoặc nhiều replica với queue này vì mỗi process sẽ có quota
riêng. Trước khi horizontal scaling, thay `AiJobQueue` bằng Redis/SQS/Celery (giữ nguyên contract HTTP) và dùng một
distributed token-bucket cho RPM/input TPM/output TPM. Kết quả job quan trọng cũng cần được lưu vào PostgreSQL thay vì
chỉ giữ trong RAM.

Provider adapter retry tối đa 5 lần cho lỗi tạm thời, ưu tiên header `Retry-After`; nếu header không có thì dùng
exponential backoff với full jitter. Không ghi response body của provider vào lỗi hoặc log.
