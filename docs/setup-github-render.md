# Hướng dẫn thiết lập GitHub CI/CD và Render

Tài liệu này liệt kê các việc cần làm để đưa **Tháp Rùa Clinical Copilot** từ nhánh `staging` lên production trên Render.

## 1. Trạng thái hiện tại

- CI được định nghĩa tại `.github/workflows/ci.yml`.
- Render Blueprint được định nghĩa tại `render.yaml`.
- Production sử dụng branch `main`.
- CI chạy khi push vào `staging`, `main` hoặc tạo pull request vào `main`.
- Render chỉ tự động deploy khi GitHub CI thành công.
- Backend có `/health` để kiểm tra tiến trình và `/ready` để ping MongoDB.

Trước khi thao tác, chạy:

```powershell
git status
git branch -vv
git fetch origin
```

## 2. Cấp quyền cập nhật GitHub Workflow

Nếu push báo lỗi:

```text
refusing to allow an OAuth App to create or update workflow
without workflow scope
```

credential GitHub trên máy chưa có quyền cập nhật `.github/workflows/*.yml`.

### Tạo token

1. Mở GitHub **Settings → Developer settings → Personal access tokens**.
2. Tạo token mới.
3. Nếu dùng classic token, bật:
   - `repo`
   - `workflow`
4. Nếu dùng fine-grained token, chọn đúng repository và cấp **Workflows: Read and write**.
5. Sao chép token và lưu tại nơi an toàn. GitHub chỉ hiển thị token một lần.

### Thay credential trên Windows

1. Mở **Credential Manager**.
2. Chọn **Windows Credentials**.
3. Xóa credential liên quan đến `github.com`.
4. Push lại và dùng:
   - Username: tên tài khoản GitHub.
   - Password: token vừa tạo, không dùng mật khẩu GitHub.

Không ghi token vào `.env`, source code hoặc tài liệu trong repository.

## 3. Commit cấu hình CI/CD trên staging

Đồng bộ thông tin remote trước:

```powershell
git fetch origin
git switch staging
```

Kiểm tra thay đổi:

```powershell
git status
git diff --check
git diff -- .github/workflows/ci.yml render.yaml backend/api/app/main.py backend/api/tests/test_health.py
```

Chạy kiểm thử local:

```powershell
npm run build

cd backend/api
python -m pytest
cd ../..
```

Commit các file CI/CD:

```powershell
git add .github/workflows/ci.yml `
  render.yaml `
  backend/api/app/main.py `
  backend/api/tests/test_health.py `
  docs/setup-github-render.md

git commit -m "ci: restore GitHub Actions and Render deployment"
```

Đưa commit mới nhất từ `main` vào `staging`:

```powershell
git merge origin/main
```

Nếu có conflict, xử lý conflict, chạy lại build/test rồi commit. Sau đó push:

```powershell
git push origin staging
```

## 4. Tạo Pull Request vào main

Trên GitHub:

1. Mở repository `dquangai/thap-rua-clinical-copilot`.
2. Chọn **Pull requests → New pull request**.
3. Chọn:
   - Base: `main`
   - Compare: `staging`
4. Tạo pull request.
5. Chờ các check sau thành công:
   - `Conflict markers`
   - `Backend tests`
   - `Frontend build`
6. Review thay đổi rồi merge vào `main`.

Không push trực tiếp vào `main` sau khi branch protection đã được bật.

## 5. Bật Branch Protection cho main

Trong GitHub repository:

1. Mở **Settings → Rules → Rulesets**.
2. Tạo branch ruleset áp dụng cho `main`.
3. Bật **Require a pull request before merging**.
4. Bật **Require status checks to pass**.
5. Chọn ba status check:
   - `Conflict markers`
   - `Backend tests`
   - `Frontend build`
6. Bật **Require branches to be up to date before merging** nếu muốn CI luôn chạy trên base mới nhất.
7. Chặn force push và deletion đối với `main`.

## 6. Tạo Render Blueprint

Thực hiện sau khi `render.yaml` đã có trên branch `main`:

1. Đăng nhập tại <https://dashboard.render.com>.
2. Chọn **New → Blueprint**.
3. Kết nối GitHub nếu Render chưa được cấp quyền.
4. Chọn repository `dquangai/thap-rua-clinical-copilot`.
5. Chọn branch `main`.
6. Render đọc `render.yaml` và đề xuất hai service:
   - `thap-rua-clinical-api`
   - `thap-rua-clinical-web`
7. Xác nhận tạo Blueprint.

Nếu tên service đã được sử dụng, đổi tên trên Render và dùng URL thực tế ở các bước tiếp theo.

## 7. Biến môi trường backend

Mở **thap-rua-clinical-api → Environment** và khai báo:

| Biến | Giá trị |
|---|---|
| `MONGODB_URI` | Connection string MongoDB Atlas production |
| `FRONTEND_ORIGIN` | URL frontend Render, không có `/` cuối |
| `SUPABASE_URL` | URL Supabase project |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key của Supabase |
| `SUPABASE_SECRET_KEY` | Secret/service key, chỉ đặt ở backend |
| `OPENAI_API_KEY` | OpenAI API key của backend |
| `LLM_API_KEY` | Có thể dùng cùng key để hỗ trợ AI checker fallback |

Các giá trị không bí mật đã nằm trong `render.yaml`, gồm:

```text
APP_ENV=production
MONGODB_DATABASE=cilinal_copilot
PII_FAIL_CLOSED=true
OPENAI_MODEL=gpt-5.6-sol
PYTHON_VERSION=3.12.13
```

Lưu ý:

- Không đặt OpenAI hoặc Supabase secret trong biến có tiền tố `VITE_`.
- Không commit secret vào Git.
- Nếu tên database đúng thực tế là `thap_rua_clinical`, sửa đồng thời `MONGODB_DATABASE` trên Render và trong `render.yaml` trước khi deploy.

## 8. Biến môi trường frontend

Mở **thap-rua-clinical-web → Environment** và đặt:

```text
VITE_API_BASE_URL=https://<backend-service>.onrender.com/api/v1
```

Ví dụ:

```text
VITE_API_BASE_URL=https://thap-rua-clinical-api.onrender.com/api/v1
```

Biến `VITE_*` được đóng vào bundle lúc build. Sau khi đổi giá trị, cần redeploy frontend.

Sau khi biết URL frontend chính xác, quay lại backend và đặt:

```text
FRONTEND_ORIGIN=https://<frontend-service>.onrender.com
```

Sau đó redeploy backend để cập nhật CORS.

## 9. MongoDB Atlas

1. Tạo database user riêng cho production.
2. Cấp đúng quyền cần thiết trên database ứng dụng.
3. Trong **Network Access**, cho phép outbound IP của Render.
4. Không giữ `0.0.0.0/0` lâu dài nếu sử dụng dữ liệu thật.
5. Rotate ngay credential nếu từng xuất hiện trong Git hoặc log.
6. Đưa connection string mới vào `MONGODB_URI` trên Render.

## 10. Triển khai và kiểm tra

Render được cấu hình chỉ deploy sau khi GitHub checks pass. Nếu cần chạy lại thủ công:

1. Mở service trên Render.
2. Chọn **Manual Deploy → Deploy latest commit**.
3. Theo dõi tab **Events** và build logs.

Kiểm tra backend:

```powershell
curl.exe https://<backend-service>.onrender.com/health
curl.exe https://<backend-service>.onrender.com/ready
```

`/ready` phải trả về:

```json
{
  "status": "ready",
  "service": "clinical-api"
}
```

Nếu `/health` trả `200` nhưng `/ready` trả `503`, kiểm tra:

- `MONGODB_URI`.
- Database username/password.
- MongoDB Atlas Network Access.
- Tên database.
- DNS/TLS trong connection string.

Kiểm tra frontend:

1. Mở URL frontend.
2. Mở DevTools → Network.
3. Xác nhận request gọi backend Render, không gọi `localhost`.
4. Refresh trực tiếp tại một route con để kiểm tra SPA rewrite.
5. Kiểm tra login, danh sách bệnh nhân, AI checker và báo cáo xét nghiệm.

## 11. Rollback

Nếu production lỗi:

1. Mở service trên Render → **Events**.
2. Chọn deploy thành công trước đó và redeploy.
3. Tạo `git revert` cho commit lỗi.
4. Đưa revert qua pull request và CI như bình thường.

Không rollback database bằng cách xóa collection. Mọi thay đổi dữ liệu cần có backup và kế hoạch migration riêng.

## 12. Checklist hoàn tất

- [ ] GitHub token có quyền `workflow`.
- [ ] `.github/workflows/ci.yml` đã được push.
- [ ] CI trên `staging` thành công.
- [ ] Pull request `staging → main` đã được merge.
- [ ] Branch protection cho `main` đã bật.
- [ ] Render Blueprint theo dõi branch `main`.
- [ ] Backend environment variables đã nhập đủ.
- [ ] Frontend `VITE_API_BASE_URL` đúng.
- [ ] Backend `FRONTEND_ORIGIN` đúng.
- [ ] MongoDB Atlas cho phép kết nối từ Render.
- [ ] `/health` và `/ready` trả `200`.
- [ ] Frontend gọi đúng backend production.
- [ ] Không có secret trong Git history mới.
