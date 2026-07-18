# Admin Dashboard

## 1. Mục tiêu

Admin Dashboard là khu vực quản trị tách biệt với workspace khám bệnh. Tính năng phục vụ ba nhóm nghiệp vụ:

- Quản lý tài khoản bác sĩ và quản trị viên.
- Theo dõi mức sử dụng API/AI: chi phí, token, latency và trạng thái request.
- Giám sát thay đổi hồ sơ bệnh án thông qua audit log, soft-delete và lịch sử phiên bản.

Dashboard được truy cập tại `/admin`. Tài khoản bác sĩ không được phép truy cập route hoặc API quản trị.

## 2. Vai trò và quyền

| Vai trò | Workspace bác sĩ | Dashboard admin | Quản lý bác sĩ | Quản lý admin |
|---|---:|---:|---:|---:|
| `DOCTOR` | Có | Không | Không | Không |
| `ADMIN` | Không mặc định | Có | Có | Không |
| `SUPER_ADMIN` | Không mặc định | Có | Có | Có |

Quy tắc bảo vệ quan trọng:

- Backend xác thực access token trước khi đọc role trong `profiles`.
- Tài khoản phải có `active = true`.
- Mọi endpoint `/api/v1/admin/*` sử dụng dependency `require_admin`.
- `ADMIN` không thể tạo, khóa hoặc thay đổi quyền của `ADMIN`/`SUPER_ADMIN` khác.
- Người dùng không thể tự khóa tài khoản đang đăng nhập.
- Backend dùng Supabase service-role nên việc kiểm tra role tại API là bắt buộc; không được dựa riêng vào việc ẩn menu ở frontend.

## 3. Luồng đăng nhập

Sau khi đăng nhập thành công:

- `ADMIN` và `SUPER_ADMIN` được chuyển thẳng đến `/admin`.
- `DOCTOR` được chuyển đến `/ho-so-benh-an`.
- Nếu bác sĩ mở trực tiếp `/admin`, frontend chuyển họ về workspace bác sĩ; backend vẫn trả `403` nếu API admin bị gọi trực tiếp.
- Header và sidebar lấy danh tính từ phiên đăng nhập, không dùng tên bác sĩ hard-code.

### Tài khoản demo local

| Người dùng | Email | Mật khẩu | Vai trò |
|---|---|---|---|
| Quản trị viên | `admin@thaprua.vn` | `Admin@123` | `SUPER_ADMIN` |
| BS. Lê Thị Mỹ Hạnh | `myhanh@thaprua.vn` | `Bacsi@123` | `DOCTOR` |
| BS. Nguyễn Thị Hương | `thihuong@thaprua.vn` | `Bacsi@123` | `DOCTOR` |

Các tài khoản trên chỉ tồn tại trong frontend để trình diễn. Không dùng chúng cho production và không có dữ liệu bền vững trong Supabase.

## 4. Chức năng giao diện

### Tổng quan

Dashboard hiển thị:

- Số tài khoản hoạt động trên tổng số tài khoản.
- Tổng API call trong khoảng thời gian thống kê.
- Latency P95.
- Tổng chi phí AI theo USD.
- Số hồ sơ đang ở trạng thái xóa mềm.

### API & AI

Bảng metric hiển thị thời gian, endpoint, model, trạng thái, latency, token và chi phí. Telemetry không lưu request body hoặc nội dung bệnh án.

Các metric được hỗ trợ:

- `latency_ms`, `runtime_ms`.
- `input_tokens`, `output_tokens`, `total_tokens`.
- `api_calls` tới nhà cung cấp model.
- `estimated_cost_usd`.
- Model và phiên bản pipeline.
- HTTP status và trạng thái pipeline.

### Tài khoản bác sĩ

Quản trị viên có thể:

- Tạo tài khoản với email, tên, mật khẩu tạm thời và vai trò.
- Xem khoa/phòng, vai trò và trạng thái.
- Khóa hoặc mở khóa tài khoản.

Không xóa vật lý tài khoản vì `actor_id`, chữ ký và audit lịch sử cần tiếp tục tham chiếu đúng người thực hiện.

### Nhật ký hồ sơ

Audit log ghi nhận tối thiểu:

- Người thực hiện.
- Hành động.
- Loại và ID đối tượng.
- Lý do thao tác.
- Thay đổi có cấu trúc.
- Thời điểm xảy ra.

## 5. Soft-delete hồ sơ bệnh án

Hồ sơ y tế không bị xóa vật lý. Thao tác xóa cập nhật:

- `deleted_at`.
- `deleted_by`.
- `deletion_reason`.

Một bản ghi tương ứng được thêm vào `record_versions` và `audit_events`. Workspace bác sĩ chỉ truy vấn bản ghi có `deleted_at is null`. Admin có thể phục hồi hồ sơ với một lý do mới.

## 6. API

Tất cả API dưới đây yêu cầu Bearer token của `ADMIN` hoặc `SUPER_ADMIN`.

| Method | Endpoint | Chức năng |
|---|---|---|
| `GET` | `/api/v1/admin/overview` | Chỉ số tổng quan |
| `GET` | `/api/v1/admin/users` | Danh sách tài khoản |
| `POST` | `/api/v1/admin/users` | Tạo tài khoản |
| `PATCH` | `/api/v1/admin/users/{id}` | Sửa role, khoa hoặc trạng thái |
| `GET` | `/api/v1/admin/api-usage` | Lịch sử API/AI metric |
| `GET` | `/api/v1/admin/audit-events` | Audit log |
| `GET` | `/api/v1/admin/records` | Danh sách hồ sơ |
| `POST` | `/api/v1/admin/records/{id}/delete` | Xóa mềm hồ sơ |
| `POST` | `/api/v1/admin/records/{id}/restore` | Phục hồi hồ sơ |

Ví dụ khóa tài khoản:

```http
PATCH /api/v1/admin/users/USER_UUID
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "active": false
}
```

Ví dụ xóa mềm hồ sơ:

```http
POST /api/v1/admin/records/ENCOUNTER_UUID/delete
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "reason": "Hồ sơ được tạo trùng theo biên bản xử lý số 123"
}
```

## 7. Database migration

Migration của tính năng nằm tại:

```text
supabase/migrations/202607180001_admin_dashboard.sql
```

Migration bổ sung:

- Enum `user_role`.
- Role, lần đăng nhập cuối và trạng thái khóa trong `profiles`.
- Bảng `api_usage_events`.
- Bảng `record_versions`.
- Các cột soft-delete cho patient, encounter và clinical note.
- Hàm RLS `is_admin()` cùng policy chỉ đọc dành cho admin.

Sau khi apply migration, cần chỉ định `SUPER_ADMIN` đầu tiên bằng SQL Editor:

```sql
update public.profiles
set role = 'SUPER_ADMIN', active = true
where id = '<AUTH_USER_UUID>';
```

## 8. Cấu hình production

Backend cần các biến môi trường:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key>
```

Không đưa `SUPABASE_SECRET_KEY` vào frontend, Git hoặc log. Tài khoản demo phải được loại bỏ hoặc vô hiệu hóa trước khi triển khai production.

## 9. Mã nguồn liên quan

```text
frontend/src/pages/AdminDashboard.tsx
frontend/src/pages/AdminDashboard.module.scss
frontend/src/api/adminApi.ts
frontend/src/store/useAuthStore.ts
backend/api/app/routers/admin.py
backend/api/app/auth.py
backend/api/app/telemetry.py
supabase/migrations/202607180001_admin_dashboard.sql
```

## 10. Giới hạn hiện tại

- Môi trường local chưa cấu hình Supabase nên tài khoản demo không được lưu bền vững.
- Form demo không thể tạo hoặc khóa tài khoản thật.
- Chi phí AI phụ thuộc telemetry do pipeline trả về và bảng giá cấu hình của model.
- API tổng quan hiện giới hạn số event được tổng hợp để tránh truy vấn không giới hạn; production nên chuyển phần percentile và aggregation xuống PostgreSQL view/RPC.
- Chưa có quy trình gửi email mời và bắt buộc đổi mật khẩu trong lần đăng nhập đầu tiên.

## 11. Kiểm thử

```bash
cd frontend
npm run build

cd ../backend/api
.venv312/bin/python -m pytest tests -q
```

Các kiểm thử production nên bổ sung: ma trận quyền theo role, khóa phiên sau khi deactive, chống tự nâng quyền, audit completeness và phục hồi hồ sơ.
