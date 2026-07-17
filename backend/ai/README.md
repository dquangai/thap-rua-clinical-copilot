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

## Baseline kiểm tra tuân thủ (`baseline-v1`)

Pipeline CLI áp dụng **allowlist → redaction → PII scan fail-closed → một LLM call → parse JSON → telemetry**.
Các trường định danh (họ tên, điện thoại, địa chỉ, mã hồ sơ/lượt khám, bác sĩ, timestamp) không được đưa vào prompt.
Ngày tuyệt đối và PII vô tình nằm trong ghi chú tự do cũng được thay bằng token redaction. Không log raw prompt,
API key hoặc bệnh án; output và JSONL runtime nằm trong `backend/ai/artifacts/` và đã bị gitignore.

Chạy kiểm tra privacy, không gọi API:

```bash
PYTHONPATH=backend/ai python -m clinical_checker.cli \
  --data data --rules rules --output results --dry-run
```

Sau khi điền `LLM_API_KEY` trong `.env`, bỏ `--dry-run` để gọi provider. Giá trong `.env` là cấu hình
vận hành, cần cập nhật theo model/hợp đồng thực tế; pipeline dùng giá đó để ước tính `estimated_cost_usd`.

Chạy thật toàn bộ file trong `data/` với toàn bộ rule JSON trong `rules/`:

```bash
npm run check:ai
```

Kết quả được ghi vào folder `results/` ở root repository; telemetry nằm tại `results/runs.jsonl`.
Mỗi output chứa `ket_qua_theo_rule` với đúng một hàng cho mỗi tiêu chí (`DAT`, `KHONG_DAT`,
`KHONG_AP_DUNG`, hoặc `THIEU_DU_LIEU`) và `criteria_summary` tổng hợp count/danh sách ID theo trạng thái.
Pipeline từ chối response nếu thiếu, thừa, trùng ID hoặc có trạng thái ngoài contract.
Nếu model chỉ bỏ sót tiêu chí, pipeline tự thực hiện một repair call tập trung cho đúng các ID bị thiếu và ghi
`api_calls`, `repaired_criteria`, token/cost cộng dồn trong telemetry. Một file lỗi sẽ có result trạng thái `error`
nhưng không làm các file còn lại bị bỏ qua.
Nếu provider trả `trang_thai: null`, guardrail chuẩn hoá thành `THIEU_DU_LIEU` và ghi ID vào
`normalized_null_criteria`; pipeline không âm thầm coi `null` là đạt hoặc không đạt.

Chạy test:

```bash
PYTHONPATH=backend/ai python -m unittest discover -s backend/ai/tests
```

### Versioning và đánh giá

- Manifest bất biến đặt tại `versions/<pipeline-version>.json`; thay prompt, model, logic privacy hoặc orchestration
  thì tạo version mới, không sửa lịch sử cũ.
- Mỗi run ghi `pipeline_version`, model/provider, token, cost, latency, status, request ID và các SHA-256 phục vụ
  truy vết. Hash không thay thế hệ thống audit và quyền truy cập.
- Để đo chất lượng, tạo tập gold đã de-identify và theo dõi precision/recall/F1 riêng cho `CRITICAL`, tỷ lệ
  `THIEU_DU_LIEU`, schema-valid rate, false-negative rate và mức đồng thuận với bác sĩ. Baseline hiện chưa thể tự
  tính accuracy vì repo chưa có nhãn chuẩn.

### Các version tiếp theo nên thử

1. `deterministic-v2`: rule engine cho trường cấu trúc (vital signs, liều, lịch), chỉ dùng LLM cho free text.
2. `retrieve-v3`: chọn đúng rule theo scope/tam cá nguyệt trước khi gọi model để giảm token và nhiễu.
3. `guarded-v4`: JSON Schema validation, retry có giới hạn, kiểm tra citation/bằng chứng và policy guardrails.
4. `reasoning-ensemble-v5`: 2–3 lượt đánh giá độc lập rồi adjudicator hợp nhất cho item CRITICAL; chỉ chạy khi
   confidence thấp để kiểm soát giá/latency.
5. `react-tools-v6`: model gọi các tool xác định (tính tuổi thai, BMI, cửa sổ xét nghiệm) thay vì tự tính bằng text.
6. `multi-agent-v7`: agent theo nhóm rule (tiền sử, xét nghiệm, thuốc) + verifier; chỉ nên dùng khi benchmark chứng
   minh cải thiện đủ lớn so với chi phí và độ phức tạp.
