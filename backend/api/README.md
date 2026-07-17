# Clinical API (Python + Supabase)

FastAPI service cho identity, patient registry, encounter, clinical notes và audit. Supabase cung cấp PostgreSQL và Auth; access token Supabase được API xác minh qua JWKS.

## Cài đặt

Yêu cầu Python 3.11+ và một Supabase project.

```bash
cd backend/api
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Điền `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` trong `.env`. Service role key chỉ nằm ở backend.

### Database local bằng Supabase CLI

Tại thư mục gốc repo:

```bash
supabase start
supabase db reset
```

Với project hosted:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Migration tạo profile liên kết `auth.users`, RBAC, patient, encounter, clinical note, audit log, index và RLS. Sau khi tạo user trong Supabase Auth, đổi vai trò bằng SQL/Dashboard (chỉ admin vận hành):

```sql
update public.profiles set role = 'clinician' where id = '<auth-user-uuid>';
```

## Chạy

Từ root có thể dùng `npm run dev:backend`, hoặc:

```bash
cd backend/api
python -m uvicorn app.main:app --reload --port 4000
```

- Health: `GET http://localhost:4000/health`
- OpenAPI: `http://localhost:4000/docs`
- API: `/api/v1/patients`, `/api/v1/encounters`, `/api/v1/encounters/{id}/workspace`

Các endpoint nghiệp vụ yêu cầu `Authorization: Bearer <supabase-access-token>`. Frontend đăng nhập bằng Supabase Auth với anon key rồi chuyển access token cho API. Không log request body vì có thể chứa PII/PHI.

## Kiểm thử

```bash
python -m pytest
```
