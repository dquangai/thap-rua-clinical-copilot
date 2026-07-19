"""Seed dữ liệu lâm sàng (rules phác đồ + hồ sơ demo) từ file JSON bootstrap vào MongoDB.

MongoDB là nguồn dữ liệu chạy chính thức: AI checker và các endpoint đọc rules/hồ sơ
từ DB. Các file JSON trong repo (rules/, data/) chỉ còn vai trò bootstrap lần đầu —
sau khi DB đã được seed và kiểm chứng, có thể xoá chúng khỏi repo.

Seed tay: cd backend/api && python -m scripts.seed_clinical_data [--force]
Tự động: API tự seed lúc khởi động nếu collection còn trống (xem main.py).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pymongo.database import Database

REPO_ROOT = Path(__file__).resolve().parents[3]
RULES_DIR = REPO_ROOT / "rules"
SIM_DATA_DIR = REPO_ROOT / "data"

# File rules nào seed vào collection nào; thứ tự khớp với load_rules() đọc disk
# (glob *.json được sort theo tên) để content_hash(rules) không đổi giữa 2 nguồn.
RULES_COLLECTIONS = (
    ("rules_kham_thai.json", "rules_kham_thai"),
    ("rules_tu_van.json", "rules_tu_van"),
)
SIM_COLLECTION = "sim_clinical_records"
DEMO_UI_FILE = "sim_demo_ui.json"

# Trạng thái hàng đợi minh hoạ cho 6 ca sim — trước đây gán theo index trong
# frontend/src/data/simPatients.ts; nay bake vào document để thứ tự ổn định.
SIM_UI_STATUSES = ("waiting", "waiting", "waiting", "has-results", "examining", "completed")


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_rules_seed_documents(rules_dir: Path = RULES_DIR) -> dict[str, list[dict[str, Any]]]:
    """Đọc file rules trên disk thành document Mongo: mỗi rule một document."""
    documents: dict[str, list[dict[str, Any]]] = {}
    for filename, collection_name in RULES_COLLECTIONS:
        file_path = rules_dir / filename
        if not file_path.exists():
            continue
        ruleset = _read_json(file_path)
        documents[collection_name] = [
            {"_id": rule["rule_id"], "seq": seq, "source": filename, "rule": rule}
            for seq, rule in enumerate(ruleset.get("rules", []))
        ]
    return documents


def load_sim_seed_documents(data_dir: Path = SIM_DATA_DIR) -> list[dict[str, Any]]:
    """Đọc hồ sơ demo trên disk thành document {seq, record, ui}."""
    documents: list[dict[str, Any]] = []
    demo_path = data_dir / DEMO_UI_FILE
    if demo_path.exists():
        documents.extend(_read_json(demo_path))
    sim_files = sorted(data_dir.glob("sim_kham*.json")) if data_dir.exists() else []
    offset = len(documents)
    for index, file_path in enumerate(sim_files):
        documents.append(
            {
                "seq": offset + index,
                "record": _read_json(file_path),
                "ui": {
                    "queueNumber": str(53100 + index + 1),
                    "status": SIM_UI_STATUSES[index] if index < len(SIM_UI_STATUSES) else "waiting",
                },
            }
        )
    return documents


def seed_rules(db: Database, rules_dir: Path = RULES_DIR, force: bool = False) -> dict[str, int]:
    """Seed rules vào Mongo; bỏ qua collection đã có dữ liệu trừ khi force=True."""
    counts: dict[str, int] = {}
    for collection_name, documents in load_rules_seed_documents(rules_dir).items():
        collection = db[collection_name]
        if not force and collection.count_documents({}) > 0:
            counts[collection_name] = 0
            continue
        collection.delete_many({})
        if documents:
            collection.insert_many(documents)
        counts[collection_name] = len(documents)
    return counts


def seed_sim_records(db: Database, data_dir: Path = SIM_DATA_DIR, force: bool = False) -> int:
    """Seed hồ sơ demo vào Mongo; bỏ qua nếu collection đã có dữ liệu trừ khi force=True."""
    collection = db[SIM_COLLECTION]
    if not force and collection.count_documents({}) > 0:
        return 0
    documents = load_sim_seed_documents(data_dir)
    collection.delete_many({})
    for document in documents:
        record_id = document.get("record", {}).get("record_id")
        if record_id:
            document = {"_id": record_id, **document}
        collection.insert_one(document)
    return len(documents)


def seed_if_empty(db: Database) -> dict[str, int]:
    """Bootstrap DB lúc API khởi động: chỉ seed collection còn trống."""
    counts = seed_rules(db)
    counts[SIM_COLLECTION] = seed_sim_records(db)
    return counts
