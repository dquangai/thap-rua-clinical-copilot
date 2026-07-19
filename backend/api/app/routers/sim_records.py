"""Phục vụ hồ sơ bệnh nhân demo từ MongoDB thay vì bundle JSON vào frontend.

Nguồn chính là collection sim_clinical_records; khi DB chưa cấu hình/chưa seed
(môi trường dev chưa có Mongo) thì fallback đọc file bootstrap trên disk để
không làm gãy chức năng.
"""
from typing import Any

from fastapi import APIRouter

from app.database import get_database
from app.routers.collections import json_value
from app.seed import SIM_COLLECTION, load_sim_seed_documents

router = APIRouter(prefix="/sim-records", tags=["sim-records"])


@router.get("")
def list_sim_records() -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    try:
        db = get_database()
        cursor = db[SIM_COLLECTION].find({}, {"_id": 0}).sort("seq", 1)
        items = [json_value(document) for document in cursor]
    except Exception:
        items = []
    if not items:
        # Bootstrap fallback: DB chưa sẵn sàng thì dùng file seed nếu còn trên disk.
        items = load_sim_seed_documents()
    return {"items": items, "total": len(items)}
