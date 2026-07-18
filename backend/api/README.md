# Clinical API (Python + MongoDB Atlas)

FastAPI service không có authentication, dùng MongoDB Atlas để lưu bệnh nhân và bệnh án.

## Setup

```powershell
cd backend/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m scripts.setup_mongodb
```

Từ root chạy `npm run dev:backend`. Health ở `http://localhost:4000/health`, OpenAPI ở `http://localhost:4000/docs`.

## API

- `GET /api/v1/patients`
- `GET /api/v1/patients/{patient_id}`
- `POST /api/v1/patients`
- `GET /api/v1/patients/{patient_id}/clinical-records`
- `GET /api/v1/patients/{patient_id}/clinical-records/{record_id}`
- `POST /api/v1/patients/{patient_id}/clinical-records`
- `PATCH /api/v1/patients/{patient_id}/clinical-records/{record_id}`

## Kiểm thử

```powershell
python -m pytest
```
