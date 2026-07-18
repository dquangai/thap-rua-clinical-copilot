# Clinical API (Python + Supabase Cloud)

FastAPI service dùng Supabase Cloud cho PostgreSQL và Auth. Dự án chỉ có một loại tài khoản đăng nhập là bác sĩ.

## Setup

Làm theo [hướng dẫn Supabase Cloud](../../docs/supabase-online-setup.md) để tạo project, chạy migration trên Dashboard và cấu hình key.

```bash
cd backend/api
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Điền thông tin Supabase Cloud vào `.env`, sau đó từ root chạy:

```bash
npm run dev:backend
```

- Health: `GET http://localhost:4000/health`
- OpenAPI: `http://localhost:4000/docs`
- API: `/api/v1/patients`, `/api/v1/encounters`, `/api/v1/encounters/{id}/workspace`
- Submit AI job: `POST /api/v1/ai/jobs` (trả `202` và `job_id`)
- Poll AI job: `GET /api/v1/ai/jobs/{job_id}`
- Auth API: xem [`docs/auth-api.md`](../../docs/auth-api.md)

Các endpoint nghiệp vụ yêu cầu `Authorization: Bearer <supabase-access-token>`. Frontend đăng nhập bằng Supabase Auth với publishable key, rồi gửi access token cho API. Secret key chỉ được dùng trong backend và có thể vượt qua RLS.

## Kiểm thử

```bash
python -m pytest
```

<<<<<<< HEAD
## OpenAI cho agent đối chiếu xét nghiệm

Tạo file `backend/api/.env` từ `.env.example`, sau đó điền key vào **backend**:

```env
OPENAI_API_KEY=sk-proj_xxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-5.6-sol
OPENAI_BASE_URL=https://api.openai.com/v1
```

Không thêm `OPENAI_API_KEY` hoặc biến bắt đầu bằng `VITE_` vào `frontend/.env`: mọi biến `VITE_*` được đóng gói vào trình duyệt và có thể bị xem bởi người dùng. Endpoint `POST /api/v1/lab-analysis/narrative` chỉ nhận danh sách đã loại định danh gồm tên xét nghiệm, kết quả, đơn vị, khoảng tham chiếu, trạng thái và độ chênh. Phép so sánh số học vẫn chạy cục bộ; OpenAI chỉ biên tập câu chữ của bản nháp.
=======
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
>>>>>>> main
