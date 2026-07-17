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
- Auth API: xem [`docs/auth-api.md`](../../docs/auth-api.md)

Các endpoint nghiệp vụ yêu cầu `Authorization: Bearer <supabase-access-token>`. Frontend đăng nhập bằng Supabase Auth với publishable key, rồi gửi access token cho API. Secret key chỉ được dùng trong backend và có thể vượt qua RLS.

## Kiểm thử

```bash
python -m pytest
```
