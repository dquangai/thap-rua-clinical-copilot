# Thiết lập CI/CD GitHub và deploy Render từ `staging`

Tài liệu này hướng dẫn cấu hình luồng triển khai hiện tại của **Tháp Rùa Clinical Copilot**:

```text
push staging → GitHub Actions CI → CI pass → Render deploy staging
```

Render triển khai trực tiếp từ `staging`; không cần merge vào `main` để cập nhật môi trường này.

## 1. Thành phần đã có trong repository

| File | Chức năng |
|---|---|
| `.github/workflows/ci.yml` | Kiểm tra conflict trong backend, compile Python và chạy test backend/AI |
| `render.yaml` | Tạo backend Web Service và frontend Static Site trên Render |
| `backend/api/app/main.py` | Cung cấp `/health` và `/ready` cho Render |

Workflow chạy khi:

- Push vào `staging` hoặc `main`.
- Tạo pull request vào `main`.
- Chạy thủ công bằng **Actions → CI → Run workflow**.

Hai service trong `render.yaml` đều theo dõi branch `staging` và dùng `autoDeployTrigger: checksPass`.

## 2. Chuẩn bị GitHub credential

GitHub không cho token thiếu quyền workflow tạo hoặc cập nhật `.github/workflows/ci.yml`.

Nếu push báo lỗi sau:

```text
refusing to allow an OAuth App to create or update workflow
without workflow scope
```

hãy tạo Personal Access Token mới.

### Quyền token

- Token classic: chọn `repo` và `workflow`.
- Fine-grained token: chọn đúng repository và cấp **Workflows: Read and write**.

### Xóa credential cũ trên Windows

Chạy trong PowerShell:

```powershell
@"
protocol=https
host=github.com
"@ | git credential-manager erase
```

Nếu Git Credential Manager không khả dụng, mở **Credential Manager → Windows Credentials** và xóa credential liên quan đến `github.com`.

Push lại:

```powershell
git push origin staging
```

Khi được hỏi:

```text
Username: <tên tài khoản GitHub>
Password: <Personal Access Token>
```

Không dùng mật khẩu GitHub và không chèn token trực tiếp vào URL remote.

## 3. Kiểm tra và push nhánh staging

Chuyển sang đúng nhánh và cập nhật thông tin remote:

```powershell
git switch staging
git fetch origin
git status
```

Trước khi commit, chạy kiểm tra backend local:

```powershell
cd backend/api
python -m pytest
cd ../..

git diff --check
```

Commit thay đổi:

```powershell
git add .github/workflows/ci.yml render.yaml docs/setup-github-render.md
git commit -m "ci: deploy staging through GitHub Actions and Render"
git push origin staging
```

Nếu có thay đổi backend liên quan `/ready`, thêm cả các file đó trước khi commit:

```powershell
git add backend/api/app/main.py backend/api/tests/test_health.py
```

## 4. Kiểm tra GitHub Actions

Sau khi push:

1. Mở repository trên GitHub.
2. Chọn tab **Actions**.
3. Mở workflow **CI** của commit mới nhất trên `staging`.
4. Xác nhận job `Backend tests` thành công. Job này gồm:
   - Kiểm tra conflict marker trong `backend` và `rules`.
   - Compile source Python.
   - Chạy API tests.
   - Chạy AI pipeline tests.

Nếu workflow không xuất hiện, kiểm tra:

- `.github/workflows/ci.yml` đã có trên remote `staging` chưa.
- GitHub Actions có bị tắt tại **Settings → Actions → General** không.
- Commit có thực sự được push vào `staging` không.

Nếu CI lỗi, không chạy deploy thủ công để bỏ qua kiểm tra. Sửa lỗi, commit và push lại.

## 5. Tạo Render Blueprint lần đầu

Thực hiện sau khi `render.yaml` đã có trên remote `staging`:

1. Đăng nhập <https://dashboard.render.com>.
2. Chọn **New → Blueprint**.
3. Kết nối GitHub và cấp quyền truy cập repository.
4. Chọn `dquangai/thap-rua-clinical-copilot`.
5. Chọn branch `staging`.
6. Render đọc `render.yaml` và tạo:
   - `thap-rua-clinical-api`: Python Web Service.
   - `thap-rua-clinical-web`: Static Site.
7. Nhập các biến có `sync: false` khi Render yêu cầu.
8. Xác nhận tạo Blueprint.

Nếu Blueprint đã tồn tại, mở Blueprint và chọn **Manual Sync** để đồng bộ thay đổi mới nhất từ `render.yaml`.

Backend đã được khai báo `plan: free`; frontend là Static Site miễn phí. Nếu màn hình Blueprint vẫn chọn `starter` hoặc yêu cầu thanh toán, chưa xác nhận tạo service: quay lại kiểm tra Blueprint đang đọc đúng `render.yaml` trên branch `staging` và backend hiển thị **Free**. Render có thể vẫn đề nghị thêm phương thức thanh toán cho phần usage vượt hạn mức, nhưng không cần chọn gói trả phí để chạy cấu hình staging này.

Trong từng service, kiểm tra tại **Settings → Build & Deploy**:

```text
Branch: staging
Auto-Deploy: After CI Checks Pass
```

## 6. Cấu hình backend trên Render

Mở **thap-rua-clinical-api → Environment** và nhập:

| Biến | Nội dung |
|---|---|
| `MONGODB_URI` | Connection string MongoDB Atlas |
| `FRONTEND_ORIGIN` | URL frontend Render, không có `/` cuối |
| `OPENAI_API_KEY` | OpenAI API key |
| `LLM_API_KEY` | Có thể dùng cùng OpenAI key cho AI checker fallback |

Các biến không bí mật đã được khai báo trong `render.yaml`:

```text
APP_ENV=production
PYTHON_VERSION=3.12.13
MONGODB_DATABASE=cilinal_copilot
PII_FAIL_CLOSED=true
OPENAI_MODEL=gpt-5.6-sol
```

Xác nhận chính xác tên database. Nếu database thực tế là `thap_rua_clinical`, sửa `MONGODB_DATABASE` trong `render.yaml` và trên Render trước khi deploy.

Không đặt OpenAI key trong biến có tiền tố `VITE_` vì các biến này xuất hiện trong bundle trình duyệt.

## 7. Cấu hình frontend trên Render

Mở **thap-rua-clinical-web → Environment** và đặt:

```text
VITE_API_BASE_URL=https://<backend-service>.onrender.com/api/v1
```

Ví dụ nếu URL backend đúng bằng tên service:

```text
VITE_API_BASE_URL=https://thap-rua-clinical-api.onrender.com/api/v1
```

Sau khi Render cấp URL frontend, quay lại backend và đặt:

```text
FRONTEND_ORIGIN=https://<frontend-service>.onrender.com
```

Không thêm `/` ở cuối `FRONTEND_ORIGIN`.

Sau khi đổi `VITE_API_BASE_URL`, phải redeploy frontend vì biến `VITE_*` được đóng vào bundle lúc build.

## 8. Cấu hình MongoDB Atlas

1. Tạo database user riêng cho môi trường staging.
2. Chỉ cấp quyền cần thiết trên database ứng dụng.
3. Mở **Network Access** và cho phép outbound IP của Render.
4. Đưa connection string mới vào `MONGODB_URI` trên Render.
5. Rotate ngay credential nếu từng xuất hiện trong Git, tài liệu hoặc log.

Không nên giữ `0.0.0.0/0` lâu dài khi sử dụng dữ liệu thật.

## 9. Luồng deploy hằng ngày

Mỗi lần cập nhật staging:

```powershell
git switch staging
git pull --ff-only origin staging

# Chỉnh sửa và kiểm tra backend
cd backend/api
python -m pytest
cd ../..

git add <các-file-đã-thay-đổi>
git commit -m "<nội dung thay đổi>"
git push origin staging
```

Sau khi push:

1. GitHub Actions chạy CI.
2. CI pass.
3. Render nhận trạng thái checks của commit trên `staging`.
4. Render build và deploy đúng commit đó.

`main` không tham gia vào luồng deploy staging. Chỉ tạo pull request `staging → main` khi muốn cập nhật nhánh release ổn định.

## 10. Kiểm tra sau deploy

### Backend

```powershell
curl.exe https://<backend-service>.onrender.com/health
curl.exe https://<backend-service>.onrender.com/ready
```

Kết quả `/ready` mong đợi:

```json
{
  "status": "ready",
  "service": "clinical-api"
}
```

Nếu `/health` trả `200` nhưng `/ready` trả `503`, kiểm tra:

- `MONGODB_URI`.
- Username/password MongoDB.
- Atlas Network Access.
- Tên database.
- DNS và TLS trong connection string.

### Frontend

1. Mở URL frontend.
2. Mở DevTools → **Network**.
3. Xác nhận request gọi backend Render, không gọi `localhost`.
4. Refresh trực tiếp tại một route con để kiểm tra SPA rewrite.
5. Kiểm tra bệnh nhân, AI checker và báo cáo xét nghiệm.

Nếu trình duyệt báo CORS, kiểm tra `FRONTEND_ORIGIN` có đúng chính xác URL frontend hay không rồi redeploy backend.

## 11. Xử lý deploy lỗi

### CI pass nhưng Render không deploy

Kiểm tra:

- Service đang theo dõi `staging`.
- Auto-Deploy là **After CI Checks Pass**.
- Render GitHub App còn quyền đọc repository và checks.
- Commit thay đổi file phù hợp với `buildFilter` của service.

Thay đổi chỉ ở frontend sẽ không deploy backend và ngược lại. Thay đổi `render.yaml` luôn được Blueprint xử lý khi sync.

### Rollback

1. Mở service → **Events**.
2. Chọn deploy thành công trước đó và redeploy.
3. Dùng `git revert <commit>` để hoàn tác trong Git.
4. Push commit revert lên `staging` để CI và Render chạy lại.

Không rollback database bằng cách xóa collection. Thay đổi dữ liệu cần có backup và kế hoạch migration riêng.

## 12. Checklist hoàn tất

- [ ] Token GitHub có quyền cập nhật workflow.
- [ ] `.github/workflows/ci.yml` tồn tại trên remote `staging`.
- [ ] Job `Backend tests` của GitHub Actions đã pass.
- [ ] Render Blueprint theo dõi `staging`.
- [ ] Backend dùng instance type **Free**, không phải `Starter`.
- [ ] Auto-Deploy đặt thành **After CI Checks Pass**.
- [ ] Backend đã có đủ MongoDB và OpenAI secrets.
- [ ] `VITE_API_BASE_URL` trỏ đúng backend `/api/v1`.
- [ ] `FRONTEND_ORIGIN` trùng chính xác URL frontend.
- [ ] MongoDB Atlas cho phép kết nối từ Render.
- [ ] `/health` và `/ready` trả `200`.
- [ ] Frontend không gọi `localhost`.
- [ ] Không có secret trong commit hoặc log.
