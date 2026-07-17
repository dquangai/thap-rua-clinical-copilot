# Thiết lập Supabase Cloud trên web

Hướng dẫn này cấu hình PostgreSQL và Supabase Auth online, không cần Supabase CLI hoặc Docker.

## 1. Tạo Supabase project

1. Truy cập [Supabase Dashboard](https://supabase.com/dashboard) và đăng nhập.
2. Chọn **New project**.
3. Chọn organization, đặt tên project và tạo database password mạnh.
4. Chọn region gần người dùng rồi bấm **Create new project**.
5. Chờ project khởi tạo hoàn tất.

Không ghi database password, secret key hoặc dữ liệu bệnh nhân vào Git.

## 2. Tạo database schema

1. Trong Dashboard, mở **SQL Editor**.
2. Chọn **New query**.
3. Chạy lần lượt hai migration theo đúng thứ tự, mỗi file trong một query riêng:
   - [`202607170001_initial_clinical_schema.sql`](../supabase/migrations/202607170001_initial_clinical_schema.sql)
   - [`202607170002_clinical_conclusion_records.sql`](../supabase/migrations/202607170002_clinical_conclusion_records.sql)
4. Với mỗi file, sao chép toàn bộ nội dung vào SQL Editor và bấm **Run**. Project đã chạy migration `001` trước đây chỉ cần chạy `002`.
5. Tạo query mới, sao chép nội dung [`supabase/seed.sql`](../supabase/seed.sql) và bấm **Run**.
6. Mở **Table Editor** và kiểm tra có các bảng `departments`, `clinics`, `profiles`, `patients`, `encounters`, `vital_signs`, `diagnoses`, `clinical_notes`, `clinical_conclusions`, `audit_events`.

Migration đã bật RLS. Mỗi user Auth mới sẽ tự động có một bản ghi `profiles`; `profiles.active = false` dùng để khóa quyền truy cập nghiệp vụ của bác sĩ.

### Mô hình dữ liệu kết luận lâm sàng

- `patients`: thông tin định danh bệnh nhân.
- `encounters`: mã lượt khám, thời điểm khám, khoa/phòng, bác sĩ và thời điểm ký.
- `vital_signs`: mạch, nhiệt độ, huyết áp, nhịp thở, chiều cao, cân nặng, BMI và đường huyết.
- `diagnoses`: ICD-10 và mô tả chẩn đoán.
- `clinical_conclusions`: diễn biến, hướng xử trí, chữ ký và toàn bộ JSON nguồn trong `source_payload` để audit/truy vết.
- `audit_events`: ai đã import dữ liệu và thời điểm thực hiện.

Không dùng tên và số điện thoại để chống trùng bệnh nhân. Payload production nên bổ sung `medical_record_number` và `date_of_birth`; mẫu hiện chỉ có tuổi nên migration lưu `reported_age` tại lượt khám và để ngày sinh trống.

## 3. Cấu hình Supabase Auth

1. Mở **Authentication → URL Configuration**.
2. Đặt **Site URL** là `http://localhost:5173` khi phát triển.
3. Thêm `http://localhost:5173` vào **Redirect URLs**.
4. Mở **Authentication → Providers** và bảo đảm Email provider được bật.
5. Trong môi trường phát triển, có thể tắt **Confirm email**. Production nên bật xác nhận email.

## 4. Tạo tài khoản bác sĩ

1. Mở **Authentication → Users**.
2. Chọn **Add user → Create new user**.
3. Nhập email và mật khẩu của bác sĩ.
4. Nếu có tùy chọn, đánh dấu email đã xác nhận.
5. Mở **Table Editor → profiles** và kiểm tra user vừa tạo có `active = true`.

Chỉ cấp tài khoản cho bác sĩ được phép truy cập hồ sơ. Không dùng chung tài khoản.

## 5. Lấy URL và API keys

1. Mở **Project Settings → API Keys**, hoặc nút **Connect** của project.
2. Sao chép **Project URL**.
3. Sao chép **Publishable key** (`sb_publishable_...`). Key này có thể dùng ở frontend.
4. Tạo hoặc sao chép **Secret key** (`sb_secret_...`). Key này chỉ được dùng ở backend.

Tạo `backend/api/.env` từ `.env.example`:

```env
APP_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
```

Không thêm `.env` vào Git và không đặt `SUPABASE_SECRET_KEY` trong biến môi trường frontend. Nếu project chỉ hiển thị legacy keys, có thể dùng `anon` thay publishable và `service_role` thay secret, nhưng key mới được khuyến nghị.

## 6. Chạy và kiểm tra backend

```bash
cd backend/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Điền `.env`, quay lại root repo và chạy:

```bash
npm run dev:backend
```

Mở:

- Health check: `http://localhost:4000/health`
- Swagger/OpenAPI: `http://localhost:4000/docs`

Health response phải có `"supabase": "configured"` và đúng URL cloud. Backend sẽ kiểm tra access token tại Supabase Auth online trước khi cho phép gọi API nghiệp vụ.

## 7. Kiểm tra đăng nhập

Frontend tạo Supabase client bằng Project URL và publishable key, sau đó đăng nhập:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

Gửi `data.session.access_token` cho backend:

```http
Authorization: Bearer <access-token>
```

## 8. Vận hành an toàn

- Bật MFA cho tài khoản quản trị Supabase Dashboard.
- Không dùng dữ liệu bệnh nhân thật trước khi hoàn tất security review, backup và chính sách lưu trữ dữ liệu.
- Thu hồi và tạo lại secret key ngay nếu key bị lộ.
- Kiểm tra **Database → Security Advisor** sau mỗi thay đổi schema/RLS.
- Với production, cập nhật Site URL, Redirect URLs và `FRONTEND_ORIGIN` sang domain HTTPS thật.

## 9. Import mẫu kết luận

Mẫu đã được lưu tại [`docs/sample-clinical-record.json`](sample-clinical-record.json). Hai timestamp được thêm offset `+07:00` để không bị hiểu sai múi giờ khi lưu vào `timestamptz`.

1. Đăng nhập bằng tài khoản bác sĩ để lấy access token.
2. Gọi endpoint backend; PowerShell:

```powershell
$token = "PASTE_DOCTOR_ACCESS_TOKEN"
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:4000/api/v1/encounters/import-clinical-record" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json; charset=utf-8" `
  -InFile "docs/sample-clinical-record.json"
```

API gọi hàm PostgreSQL `import_clinical_record` trong một transaction. Nếu `record_id` hoặc `visit_code` đã tồn tại, import bị từ chối để tránh ghi trùng. Kết quả trả về:

```json
{ "encounter_id": "<uuid>" }
```

Sau đó xem read model tổng hợp tại `GET /api/v1/encounters/<uuid>/workspace`.

Tham khảo: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase Auth](https://supabase.com/docs/guides/auth), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
