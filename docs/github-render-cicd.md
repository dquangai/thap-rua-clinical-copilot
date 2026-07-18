# CI/CD với GitHub Actions và Render

Tài liệu này mô tả cách kiểm tra và triển khai monorepo **Tháp Rùa Clinical Copilot** lên Render.

## 1. Kiến trúc triển khai

```text
GitHub pull request
        │
        ▼
GitHub Actions CI
  ├── kiểm tra conflict marker
  ├── test FastAPI
  ├── compile Python
  └── build React/Vite
        │
        ▼ CI thành công + merge main
Render Auto-Deploy: After CI Checks Pass
  ├── Static Site: frontend
  └── Web Service: FastAPI backend
        │
        ▼
MongoDB Atlas + LLM provider
```

Render hỗ trợ liên kết branch GitHub và chỉ triển khai sau khi GitHub Actions thành công. Xem [Render deploys và CI checks](https://render.com/docs/deploys#integrating-with-ci).

## 2. Điều kiện trước khi triển khai

Máy local cần chạy được:

```powershell
npm ci
npm run build

cd backend/api
python -m pip install -r requirements.txt
python -m pytest
```

Repository không được chứa conflict marker:

```text
<<<<<<<
>>>>>>>
```

> **Trạng thái cần xử lý:** tại thời điểm viết tài liệu, `backend/api/app/main.py` đang có conflict marker đã được commit. CI bên dưới sẽ chủ động fail cho đến khi team resolve file này.

## 3. Biến môi trường

### Backend Render Web Service

| Tên | Secret | Ví dụ/ghi chú |
|---|---:|---|
| `APP_ENV` | Không | `production` |
| `FRONTEND_ORIGIN` | Không | URL frontend Render, không có dấu `/` cuối |
| `MONGODB_URI` | Có | Connection string MongoDB Atlas |
| `MONGODB_DATABASE` | Không | `cilinal_copilot` |
| `OPENAI_API_KEY` | Có | Khóa API của provider |
| `LLM_API_KEY` | Có | Chỉ đặt nếu ứng dụng vẫn dùng fallback này |
| `LLM_PROVIDER` | Không | `openai` |
| `LLM_MODEL` | Không | Model team đã phê duyệt |
| `LLM_BASE_URL` | Không | Endpoint OpenAI-compatible nếu có |
| `PII_FAIL_CLOSED` | Không | `true` |
| `JWT_SECRET` | Có | Secret ngẫu nhiên đủ mạnh nếu module auth sử dụng |

Không đưa secret vào `render.yaml`, GitHub Actions, source code hoặc file `.env.example`. Secret phải nhập tại **Render Dashboard → Environment**.

`backend/api/.env.example` hiện có connection string trông giống credential thật. Trước khi public repository, cần thay bằng placeholder và rotate MongoDB password nếu credential đó từng hoạt động.

### Frontend Render Static Site

| Tên | Giá trị |
|---|---|
| `VITE_API_BASE_URL` | `https://<backend-service>.onrender.com/api/v1` |

Biến `VITE_*` được đóng vào bundle tại build time. Sau khi đổi URL backend, phải redeploy frontend.

## 4. GitHub Actions CI

Tạo file `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  conflict-check:
    name: Conflict markers
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Reject unresolved merge markers
        shell: bash
        run: |
          if git grep -n -E '^(<<<<<<<|>>>>>>>)' -- ':!docs/*.md'; then
            echo 'Unresolved merge conflict markers detected.'
            exit 1
          fi

  backend:
    name: Backend tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend/api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: backend/api/requirements.txt
      - name: Install dependencies
        run: python -m pip install -r requirements.txt
      - name: Compile application
        run: python -m compileall -q app
      - name: Run tests
        run: python -m pytest

  frontend:
    name: Frontend build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Build frontend
        run: npm run build
```

CI không cần `MONGODB_URI` hoặc khóa LLM nếu unit test đã mock/tắt external calls. Không cho phép test pull request gọi MongoDB production hoặc provider LLM thật.

## 5. Render Blueprint

Sau khi CI chạy ổn định, có thể tạo `render.yaml` ở repository root:

```yaml
services:
  - type: web
    name: thap-rua-clinical-api
    runtime: python
    region: singapore
    buildCommand: pip install -r backend/api/requirements.txt
    startCommand: cd backend/api && uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    autoDeployTrigger: checksPass
    buildFilter:
      paths:
        - backend/api/**
        - backend/ai/**
        - rules/**
        - render.yaml
    envVars:
      - key: APP_ENV
        value: production
      - key: MONGODB_DATABASE
        value: cilinal_copilot
      - key: PII_FAIL_CLOSED
        value: "true"
      - key: FRONTEND_ORIGIN
        sync: false
      - key: MONGODB_URI
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: JWT_SECRET
        sync: false

  - type: web
    name: thap-rua-clinical-web
    runtime: static
    buildCommand: npm ci && npm run build
    staticPublishPath: frontend/dist
    autoDeployTrigger: checksPass
    buildFilter:
      paths:
        - frontend/**
        - packages/**
        - package.json
        - package-lock.json
        - render.yaml
    envVars:
      - key: VITE_API_BASE_URL
        sync: false
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

Không đặt `rootDir: backend/api` cho backend hiện tại vì router AI truy cập `backend/ai` và `rules` từ repository root. Không đặt `rootDir: frontend` vì npm lockfile/workspace hiện nằm tại repository root. Render quy định file bên ngoài `rootDir` không khả dụng trong build/runtime; xem [Render monorepo support](https://render.com/docs/monorepo-support).

`autoDeployTrigger: checksPass` là field hiện hành của Blueprint để chỉ deploy sau khi CI pass; xem [Render Blueprint specification](https://render.com/docs/blueprint-spec#autodeploytrigger).

## 6. Tạo services trên Render

1. Push repository lên GitHub.
2. Mở Render Dashboard và chọn **New → Blueprint**.
3. Kết nối GitHub repository.
4. Chọn branch `main`.
5. Render đọc `render.yaml` và tạo hai service.
6. Nhập các biến có `sync: false`.
7. Backend deploy trước để có URL `https://<backend>.onrender.com`.
8. Đặt frontend `VITE_API_BASE_URL=https://<backend>.onrender.com/api/v1`.
9. Đặt backend `FRONTEND_ORIGIN=https://<frontend>.onrender.com`.
10. Redeploy cả hai service sau khi cập nhật environment variables.

Backend bắt buộc bind `0.0.0.0` và sử dụng `$PORT` do Render cung cấp; đây là yêu cầu của [Render Web Services](https://render.com/docs/web-services#port-binding).

## 7. Thiết lập GitHub branch protection

Trong GitHub repository:

1. Vào **Settings → Branches** hoặc **Rules → Rulesets**.
2. Tạo rule cho branch `main`.
3. Bật **Require a pull request before merging**.
4. Bật **Require status checks to pass**.
5. Chọn các checks:
   - `Conflict markers`
   - `Backend tests`
   - `Frontend build`
6. Bật **Require branches to be up to date before merging** nếu team muốn kiểm tra lại trên HEAD mới nhất.
7. Không cho push trực tiếp vào `main`.

Luồng chuẩn:

```text
feature branch → pull request → CI pass → review → merge main → Render deploy
```

## 8. Kiểm tra sau deploy

### Backend

```bash
curl --fail https://<backend>.onrender.com/health
curl --fail https://<backend>.onrender.com/api/v1/patients
```

`/health` hiện chỉ cho biết MongoDB đã được cấu hình, chưa chứng minh database ping thành công. Nên bổ sung `/ready` để gọi `db.command("ping")`; Render health check nên chuyển sang `/ready` sau khi endpoint này có timeout ngắn và response không lộ URI/credential.

### Frontend

1. Mở URL frontend.
2. Refresh tại một route con để kiểm tra SPA rewrite.
3. Mở DevTools → Network.
4. Xác nhận request đi tới backend Render, không phải `localhost`.
5. Kiểm tra response CORS không bị chặn.

## 9. Rollback

Nếu deploy lỗi, Render tiếp tục giữ bản deploy thành công gần nhất. Để rollback:

1. Render Dashboard → service → **Events**.
2. Chọn deploy thành công trước đó.
3. Redeploy commit đó hoặc revert commit trên GitHub.
4. Với quy trình GitOps, ưu tiên `git revert` và merge qua pull request để lịch sử code khớp production.

Không rollback database bằng cách xóa collection. Thay đổi schema/migration cần có kế hoạch backward-compatible và backup trước khi chạy.

## 10. Checklist production

- [ ] Resolve toàn bộ merge conflict marker.
- [ ] `npm ci && npm run build` thành công.
- [ ] `python -m pytest` thành công.
- [ ] GitHub branch protection đã bật.
- [ ] Render dùng `After CI Checks Pass`.
- [ ] Không có secret trong Git.
- [ ] MongoDB credential đã rotate nếu từng xuất hiện trong source/example.
- [ ] `FRONTEND_ORIGIN` đúng URL production.
- [ ] `VITE_API_BASE_URL` đúng URL backend và có `/api/v1`.
- [ ] MongoDB Atlas Network Access không để `0.0.0.0/0` khi dùng dữ liệu thật.
- [ ] Có `/ready` kiểm tra MongoDB thật.
- [ ] Có backup/restore và audit log trước khi dùng dữ liệu bệnh nhân thật.

