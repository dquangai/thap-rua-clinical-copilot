# Thập Rùa Clinical Copilot

Nền tảng HIS/EMR theo workflow phòng khám, tách frontend/backend rõ ràng và sẵn sàng mở rộng các tính năng AI hỗ trợ nhân viên y tế.

## Cấu trúc frontend/backend

~~~text
frontend/              # React + Vite, giao diện HIS/EMR
backend/
  api/                 # Clinical API, auth, audit, integrations
  ai/                  # AI gateway, model registry, evaluations
packages/domain/       # Contract nghiệp vụ dùng chung
docs/                  # Kiến trúc và quyết định kỹ thuật
~~~

## Chạy local

~~~bash
npm install
npm run dev:frontend
~~~

Backend dùng Python/FastAPI, Supabase PostgreSQL và Supabase Auth. Xem hướng dẫn cấu hình tại `backend/api/README.md`, sau đó chạy `npm run dev:backend`; health check tại http://localhost:4000/health. Bản demo frontend hiện tại dùng dữ liệu mock, chưa kết nối dữ liệu bệnh nhân thật.

## Hiện có

- Màn hình khám bệnh responsive theo bố cục tham chiếu.
- Danh sách bệnh nhân, tìm kiếm, chọn bệnh nhân và trạng thái hàng đợi.
- Tab thông tin khám, toa thuốc, dịch vụ kỹ thuật, chuyển viện, nhập viện.
- Các action chính có feedback toast để kiểm thử workflow.
- Domain contract cho Patient, Encounter, ClinicalNote, AiSuggestion.
- Ranh giới API/AI và nguyên tắc human-in-the-loop được ghi trong docs/architecture.md.
- Toàn bộ frontend dùng một font UI duy nhất: DM Sans, khai báo qua biến --font-ui.

## Roadmap đề xuất

1. Nền tảng: auth/RBAC, audit log, patient registry, encounter API, PostgreSQL.
2. Clinical core: orders/results, thuốc-vật tư, mẫu bệnh án, ICD-10, FHIR adapters.
3. AI copilot: tóm tắt hồ sơ, gợi ý ICD, kiểm tra thiếu dữ liệu, soạn hướng dẫn tái khám.
4. Production hardening: observability, backup, disaster recovery, security review, clinical evaluation.

## Tài liệu AI compliance checker

- Hướng dẫn chạy: [docs/how-to-run-ai-compliance-checker.md](docs/how-to-run-ai-compliance-checker.md).
- Tài liệu kỹ thuật đầy đủ: [docs/ai-clinical-compliance-pipeline.md](docs/ai-clinical-compliance-pipeline.md).
