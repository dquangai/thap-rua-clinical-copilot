from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.ai_jobs import AiJobQueue, queue_settings
from app.config import get_settings
from app.database import get_database
from app.routers import ai, appointments, clinical_records, collections, lab_analysis, lab_reports, patients, rules, sim_records
from app.seed import seed_if_empty

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.mongodb_configured:
        # Bootstrap: đưa rules + hồ sơ demo từ file JSON vào DB nếu collection còn trống,
        # để DB là nguồn dữ liệu chạy chính thức. Lỗi seed không được chặn API khởi động.
        try:
            counts = seed_if_empty(get_database())
            if any(counts.values()):
                print(f"[seed] Đã bootstrap dữ liệu vào MongoDB: {counts}")
        except Exception as exc:
            print(f"[seed] Bỏ qua auto-seed: {exc}")
    workers, max_queue = queue_settings()
    app.state.ai_job_queue = AiJobQueue(ai.execute_check, workers=workers, max_queue=max_queue)
    await app.state.ai_job_queue.start()
    yield
    await app.state.ai_job_queue.stop()


app = FastAPI(title="Thap Rua Clinical API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_frontend_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+" if settings.app_env == "development" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "If-Match-Version"],
)
app.include_router(patients.router, prefix="/api/v1")
app.include_router(clinical_records.router, prefix="/api/v1")
app.include_router(collections.router, prefix="/api/v1")
app.include_router(rules.router, prefix="/api/v1")
app.include_router(lab_analysis.router, prefix="/api/v1")
app.include_router(lab_reports.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(sim_records.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "service": "clinical-api",
        "mongodb": "configured" if settings.mongodb_configured else "missing-cloud-config",
        "database": settings.mongodb_database,
        "openai": "configured" if settings.openai_configured else "missing-api-key",
    }


@app.get("/ready", tags=["system"])
def ready():
    try:
        get_database().command("ping")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database is not ready") from exc
    return {"status": "ready", "service": "clinical-api"}
