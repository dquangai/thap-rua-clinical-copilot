from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import ai, clinical_records, patients

settings = get_settings()
app = FastAPI(title="Thap Rua Clinical API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    # Vite may fall back to another port (e.g. 5174) when 5173 is taken.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+" if settings.app_env == "development" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Idempotency-Key"],
)
app.include_router(patients.router, prefix="/api/v1")
app.include_router(clinical_records.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "service": "clinical-api",
        "mongodb": "configured" if settings.mongodb_configured else "missing-cloud-config",
        "database": settings.mongodb_database,
    }
