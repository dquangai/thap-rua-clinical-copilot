from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, encounters, patients

settings = get_settings()
app = FastAPI(title="Thap Rua Clinical API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)
app.include_router(patients.router, prefix="/api/v1")
app.include_router(encounters.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "service": "clinical-api",
        "supabase": "configured" if settings.supabase_configured else "missing-cloud-config",
        "supabase_url": settings.supabase_url,
    }
