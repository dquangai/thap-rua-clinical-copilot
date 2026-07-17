# Kiến trúc Thập Rùa Clinical Copilot

## Cấu trúc repo

```text
frontend/                 # HIS workspace, route theo module nghiệp vụ
packages/
  domain/              # Patient, Encounter, ClinicalNote, AiSuggestion
  ui/                  # design tokens/components dùng chung (giai đoạn tiếp theo)
backend/
  api/                 # clinical API, auth, audit, integrations
  ai/                  # AI gateway, prompt/model registry, evaluations
docs/
  architecture.md
```

## Bounded contexts

- **Identity & access**: người dùng, vai trò, đơn vị, quyền theo phòng ban.
- **Patient registry**: định danh bệnh nhân, BHYT, liên hệ, chống trùng.
- **Encounter**: hàng đợi, phiên khám, chuyển khoa, kết thúc khám.
- **Clinical documentation**: dấu hiệu sinh tồn, diễn biến, chẩn đoán, hướng xử trí.
- **Orders & results**: dịch vụ kỹ thuật, xét nghiệm, chẩn đoán hình ảnh, thuốc/vật tư.
- **Revenue cycle**: thanh toán, bảo hiểm, đối soát.
- **AI copilot**: gợi ý có kiểm duyệt, audit và khả năng giải thích.

## Quyết định quan trọng

### 1. Màn hình theo workflow, domain theo encounter

UI tái hiện workflow của phòng khám, nhưng dữ liệu trung tâm là `Encounter`. Điều này giúp một bệnh nhân có nhiều lần khám mà không trộn lẫn ghi chú, chỉ định và kết quả.

### 2. Human-in-the-loop bắt buộc cho AI

AI chỉ tạo `AiSuggestion`; bác sĩ/điều dưỡng mới là người xác nhận. Tất cả accept/reject phải được audit.

### 3. Read model riêng cho màn hình khám

Màn hình cần tổng hợp patient + encounter + vitals + diagnosis + orders trong một request nhanh. Tách read model giúp UI không phụ thuộc vào nhiều round-trip nghiệp vụ.

### 4. Dữ liệu nhạy cảm

Không ghi PII/PHI vào log ứng dụng. Phân quyền theo least privilege, mã hóa khi truyền/lưu, retention policy và backup/restore phải được thiết kế trước khi đưa dữ liệu thật vào hệ thống.


