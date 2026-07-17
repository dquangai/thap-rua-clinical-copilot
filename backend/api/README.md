# API service

Service boundary dành cho identity, patient, encounter, orders, results, billing và audit log.

## Nguyên tắc

- Tách clinical write model khỏi read model phục vụ màn hình khám.
- Mọi thay đổi hồ sơ phải có `actor`, `timestamp`, `reason` và audit event.
- Chuẩn hóa tích hợp về FHIR/HL7 ở lớp adapter, không để UI gọi thẳng hệ thống HIS ngoài.
- Dùng idempotency key cho các thao tác kê đơn, chỉ định và đồng bộ bảo hiểm.

## Gợi ý module

`identity` · `patient` · `encounter` · `clinical-notes` · `orders` · `results` · `pharmacy` · `admission` · `billing` · `audit` · `integration`.

