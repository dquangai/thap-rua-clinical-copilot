# Thập Rùa Clinical Copilot

Nền tảng HIS/EMR theo workflow phòng khám, tách frontend/backend rõ ràng và sẵn sàng mở rộng các tính năng AI hỗ trợ nhân viên y tế.

## Cấu trúc frontend/backend

~~~text
frontend/              # React + Vite, giao diện HIS/EMR
backend/
  api/                 # FastAPI, Supabase Auth và clinical API
  ai/                  # AI gateway, model registry, evaluations
packages/domain/       # Contract nghiệp vụ dùng chung
docs/                  # Kiến trúc và quyết định kỹ thuật
~~~

## Chạy local

~~~bash
npm install
npm run dev:frontend
~~~

Backend dùng Python/FastAPI với Supabase PostgreSQL và Supabase Auth. Cấu hình biến môi trường theo `backend/api/.env.example`, sau đó chạy backend; health check mặc định tại http://localhost:4000/health. Khi chưa cấu hình Supabase, frontend vẫn hỗ trợ tài khoản demo và dữ liệu bệnh nhân mô phỏng.

## Hiện có

- Màn hình khám bệnh responsive theo bố cục tham chiếu.
- Danh sách bệnh nhân, tìm kiếm, chọn bệnh nhân và trạng thái hàng đợi.
- Tab thông tin khám, toa thuốc, dịch vụ kỹ thuật, chuyển viện, nhập viện.
- Các action chính có feedback toast để kiểm thử workflow.
- Domain contract cho Patient, Encounter, ClinicalNote, AiSuggestion.
- Admin Dashboard với RBAC, quản lý tài khoản, telemetry API/AI, audit và soft-delete hồ sơ.
- Ranh giới API/AI và nguyên tắc human-in-the-loop được ghi trong docs/architecture.md.
- Toàn bộ frontend dùng một font UI duy nhất: DM Sans, khai báo qua biến --font-ui.

## Roadmap đề xuất

1. Nền tảng: patient registry, clinical-record API và Supabase.
2. Clinical core: orders/results, thuốc-vật tư, mẫu bệnh án, ICD-10, FHIR adapters.
3. AI copilot: tóm tắt hồ sơ, gợi ý ICD, kiểm tra thiếu dữ liệu, soạn hướng dẫn tái khám.
4. Production hardening: observability, backup, disaster recovery, security review, clinical evaluation.

## Tài liệu AI compliance checker

- Hướng dẫn chạy: [docs/how-to-run-ai-compliance-checker.md](docs/how-to-run-ai-compliance-checker.md).
- Tài liệu kỹ thuật đầy đủ: [docs/ai-clinical-compliance-pipeline.md](docs/ai-clinical-compliance-pipeline.md).

## Tài liệu quản trị

- Admin Dashboard, phân quyền, tài khoản, telemetry và audit: [docs/admin-dashboard.md](docs/admin-dashboard.md).
