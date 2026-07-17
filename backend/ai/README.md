# AI service

Lớp AI được tách khỏi API nghiệp vụ để kiểm soát dữ liệu nhạy cảm, version model và vòng đời phê duyệt.

## Luồng an toàn đề xuất

1. API tạo một `ai-run` với scope dữ liệu tối thiểu của encounter.
2. AI service lấy context đã được redaction, chạy model và ghi lại model/version/prompt hash.
3. Kết quả luôn ở trạng thái `DRAFT`, hiển thị thành suggestion trong UI.
4. Nhân viên y tế accept/reject; không tự động ghi đè bệnh án hoặc ra quyết định lâm sàng.

## Use case ưu tiên

- Tóm tắt diễn biến bệnh và lịch sử khám.
- Gợi ý ICD-10 kèm lý do và mức độ tin cậy.
- Phát hiện thiếu trường bắt buộc trước khi lưu.
- Soạn hướng dẫn tái khám bằng tiếng Việt dễ hiểu.
- Trích xuất thông tin từ kết quả xét nghiệm/PDF có human review.

