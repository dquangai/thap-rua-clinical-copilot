# Kế hoạch Pilot & Mô hình kinh doanh — Tháp Rùa Clinical Copilot

> Phiên bản 1.0 — tháng 7/2026. Số liệu chi phí/hiệu năng trong tài liệu này là **số đo thực tế** từ hệ thống đang chạy (xem mục 4), không phải ước tính lý thuyết.

## 1. Mục tiêu pilot

Chứng minh trong môi trường thật, với chi phí đo đếm được, ba giả thuyết giá trị:

| # | Giả thuyết | Chỉ số đo (KPI) | Ngưỡng thành công |
|---|---|---|---|
| H1 | AI giúp hồ sơ đầy đủ hơn | % tiêu chí đạt/hồ sơ trước vs sau khi dùng | +30% tiêu chí đạt sau 4 tuần |
| H2 | Tiết kiệm thời gian giấy tờ của bác sĩ | Thời gian soạn biên bản tư vấn/ca | Từ 10–15 phút xuống ≤ 3 phút (nháp AI 10 giây + bác sĩ duyệt/sửa) |
| H3 | Chi phí AI đủ rẻ để có biên lợi nhuận | Chi phí AI/lượt khám (đo từ dashboard) | ≤ 5% giá dịch vụ một lượt khám |

KPI phụ: tỷ lệ bác sĩ bấm "Approve" gợi ý AI (chấp nhận ≥ 50% = gợi ý hữu ích), số lượt dùng/bác sĩ/ngày, NPS bác sĩ cuối pilot.

## 2. Phạm vi pilot

- **Đối tượng**: 1 phòng khám sản khoa tư nhân, 2–4 bác sĩ + 1 quản lý.
- **Thời gian**: 4 tuần vận hành + 1 tuần chuẩn bị.
- **Tính năng bật trong pilot**: rà soát hồ sơ AI (kèm Approve từng tiêu chí), soạn nháp biên bản tư vấn + in A4, gợi ý lịch tái khám cân bằng tải, trang Lịch hẹn, tổng hợp xét nghiệm, dashboard chi phí cho quản lý.
- **Ngoài phạm vi pilot**: kê toa lưu bền, kết nối HIS/LIS có sẵn của phòng khám, chữ ký số.
- **Dữ liệu**: nhập bệnh nhân thật vào MongoDB Atlas riêng của phòng khám (một database/khách hàng); tuân thủ nguyên tắc PII fail-closed — thông tin định danh không bao giờ rời hệ thống.

## 3. Lộ trình 5 tuần

| Tuần | Việc chính | Đầu ra |
|---|---|---|
| 0 (chuẩn bị) | Ký thỏa thuận pilot + cam kết bảo mật dữ liệu; tạo môi trường riêng (Render + MongoDB Atlas); đào tạo 60 phút | Môi trường chạy và truy cập được |
| 1 | Dùng song song với quy trình giấy hiện tại, chỉ luồng rà soát hồ sơ | Baseline % tiêu chí đạt; phản hồi UX đầu tiên |
| 2 | Bật biên bản tư vấn AI + in A4 cho ca có bệnh lý | Đo thời gian soạn biên bản trước/sau |
| 3 | Bật gợi ý lịch tái khám + trang Lịch hẹn; chỉnh bộ tiêu chí theo góp ý bác sĩ (chỉ sửa JSON, không sửa code) | Bộ tiêu chí bản địa hoá cho phòng khám |
| 4 | Vận hành đủ luồng; thu số liệu KPI; phỏng vấn bác sĩ | Báo cáo pilot + quyết định go/no-go |

## 4. Unit economics (số đo thực tế)

Số liệu đo trực tiếp trên hệ thống (model GPT-5.6, ghi tự động vào bảng `api_usage_events`, xem được trên dashboard quản trị):

| Thao tác AI | Thời gian | Token/lượt (thực đo) |
|---|---|---|
| Rà soát toàn bộ hồ sơ (34 tiêu chí, chạy batch song song) | 10–15 giây | ~10.000–20.000 |
| Soạn nháp biên bản tư vấn | ~10 giây | ~1.500–2.800 |
| Gợi ý khoảng tái khám | ~3–5 giây | ~1.000–1.500 |
| Tổng hợp xét nghiệm | ~5 giây | ≤ 1.000 |

**Một lượt khám dùng trọn bộ AI ≈ 15.000–25.000 token.**

Công thức chi phí (đơn giá cấu hình qua env `LLM_INPUT/OUTPUT_PRICE_PER_MILLION_USD`, dashboard tự quy đổi):

```
Chi phí/lượt khám ≈ (token vào × giá vào + token ra × giá ra) / 1.000.000
```

Ví dụ minh hoạ (giả định đơn giá $0.5/1M token vào, $2/1M token ra — thay bằng bảng giá hợp đồng thực tế):
- ~20.000 token/lượt khám ⇒ **≈ $0.015–0.03/lượt ≈ 400–800 đồng/lượt khám**.
- So với giá khám sản tư nhân phổ biến 150.000–500.000đ/lượt ⇒ chi phí AI **< 0,5% doanh thu lượt khám** — thoả H3 với biên độ lớn.

Ba cơ chế đã có sẵn trong code giữ chi phí không phình:
1. **Cache kết quả AI**: hồ sơ không đổi → trả từ cache, 0 token (dashboard hiện `saved_tokens`).
2. **Kiểm tra lại chỉ chạy tiêu chí chưa duyệt** (`exclude_criteria`) — không trả tiền hai lần cho tiêu chí đã đạt.
3. **Hàng đợi + giới hạn đồng thời** — không có đột biến chi phí do gọi trùng.

## 5. Mô hình giá đề xuất (SaaS)

| Gói | Giá đề xuất | Phù hợp | Ghi chú |
|---|---|---|---|
| **Theo lượt** | 3.000–5.000đ/lượt khám có dùng AI | Phòng khám nhỏ, mới thử | Biên gộp > 85% theo unit economics trên |
| **Thuê bao phòng khám** | 3–5 triệu đ/tháng, không giới hạn lượt* | Phòng khám 2–5 bác sĩ | *fair-use theo `APPT_DAILY_CAPACITY`; đây là gói chủ lực |
| **Theo ghế bác sĩ** | 1–1,5 triệu đ/bác sĩ/tháng | Chuỗi phòng khám | Kèm SLA + tuỳ biến bộ tiêu chí riêng |

Pilot: **miễn phí 4 tuần** đổi lấy dữ liệu KPI + quyền dẫn chứng (case study, có ẩn danh). Sau pilot chuyển gói thuê bao với ưu đãi 3 tháng đầu.

Chi phí vận hành nền tảng/khách hàng (ngoài AI): Render ~$7–25/tháng + MongoDB Atlas M0–M10 ($0–60/tháng) ⇒ hoà vốn từ **1–2 phòng khám thuê bao**.

## 6. Vai trò trong pilot

| Bên | Trách nhiệm |
|---|---|
| Đội dự án | Vận hành hệ thống, trực hỗ trợ giờ khám, chỉnh bộ tiêu chí theo góp ý, xuất báo cáo KPI hàng tuần từ dashboard |
| Phòng khám | Cử 1 bác sĩ đầu mối; dùng hệ thống tối thiểu 50% ca khám thai; tham gia 2 buổi phỏng vấn 30 phút |
| Quản lý phòng khám | Theo dõi dashboard chi phí; xác nhận số liệu KPI cuối kỳ |

## 7. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu (đã có trong hệ thống) |
|---|---|
| Pháp lý hành nghề y | Thiết kế human-in-the-loop: AI chỉ gợi ý/soạn nháp, bác sĩ duyệt và ký tươi; khuyến cáo hiển thị thường trực |
| Lộ dữ liệu bệnh nhân | Allowlist + xoá PII + fail-closed trước mọi lời gọi LLM; log kỹ thuật chỉ chứa hash |
| AI gợi ý sai | Grounding vào bộ tiêu chí do con người ban hành; output ép schema, sai định dạng bị từ chối; bác sĩ là chốt chặn cuối |
| Chi phí vượt dự kiến | Đơn giá cấu hình được, dashboard theo dõi từng lượt, cache + exclude_criteria + rate limit |
| Nhà cung cấp AI tăng giá/ngừng dịch vụ | Kiến trúc provider-agnostic: đổi model/nhà cung cấp bằng biến môi trường (đã kiểm chứng thực tế với 2 nhà cung cấp) |
| Bác sĩ không dùng | Không bắt đổi thói quen: luồng khám giữ nguyên, AI là nút bấm thêm; KPI tuần 1 phát hiện sớm để điều chỉnh |

## 8. Tiêu chí Go/No-Go sau pilot

**GO** (mở rộng bán): đạt ≥ 2/3 KPI chính, ≥ 50% gợi ý được Approve, phòng khám đồng ý chuyển trả phí.
**PIVOT**: bác sĩ dùng nhiều nhưng chỉ 1 tính năng → tách bán tính năng đó (ví dụ chỉ biên bản tư vấn).
**NO-GO**: bác sĩ không dùng sau tuần 2 dù đã điều chỉnh → phỏng vấn root-cause trước khi kết luận.

## 9. Lộ trình sau pilot (6–12 tháng)

1. Hoàn tất production hardening: phân quyền đọc, audit đầy đủ, backup (đã ghi trong `docs/architecture.md`).
2. Nhân bản bộ tiêu chí sang chuyên khoa thứ hai (nhi khoa/khám định kỳ) — chỉ thêm JSON, không đổi nền tảng.
3. Chuỗi 3–5 phòng khám: multi-tenant trên hạ tầng hiện có (mỗi khách một database).
4. Đăng ký hồ sơ pháp lý phần mềm hỗ trợ y tế theo hướng dẫn hiện hành khi mở rộng thương mại.
