"""Kiểm tra seed dữ liệu vào Mongo và các đường đọc DB-first của rules/hồ sơ demo."""
from fastapi.testclient import TestClient

from app.main import app
from app.routers import ai as ai_router
from app.routers import sim_records as sim_records_router
from app.seed import (
    SIM_COLLECTION,
    load_sim_seed_documents,
    seed_if_empty,
    seed_rules,
    seed_sim_records,
)
from app.versioning import content_hash
from clinical_checker.cli import load_rules

from tests.fake_mongo import FakeKeyedDatabase


def test_seed_rules_then_database_rules_match_disk_hash():
    db = FakeKeyedDatabase()
    counts = seed_rules(db)
    assert counts["rules_kham_thai"] > 0
    assert counts["rules_tu_van"] > 0

    disk_rules = load_rules(ai_router.RULES_PATH)

    def fake_get_database():
        return db

    original = ai_router.get_database
    ai_router.get_database = fake_get_database
    try:
        db_rules = ai_router._load_rules_or_503()
    finally:
        ai_router.get_database = original

    # DB và disk phải cho cùng rules_version để cache ai_artifacts không bị vô hiệu.
    assert db_rules == disk_rules
    assert content_hash(db_rules) == content_hash(disk_rules)


def test_seed_is_idempotent_without_force():
    db = FakeKeyedDatabase()
    first = seed_if_empty(db)
    second = seed_if_empty(db)
    assert first["rules_kham_thai"] > 0
    assert first[SIM_COLLECTION] == 9
    assert all(count == 0 for count in second.values())


def test_seed_sim_records_force_reseeds():
    db = FakeKeyedDatabase()
    assert seed_sim_records(db) == 9
    assert seed_sim_records(db) == 0
    assert seed_sim_records(db, force=True) == 9


def test_load_rules_falls_back_to_disk_when_database_unavailable():
    def broken_get_database():
        raise RuntimeError("mongo down")

    original = ai_router.get_database
    ai_router.get_database = broken_get_database
    try:
        rules = ai_router._load_rules_or_503()
    finally:
        ai_router.get_database = original
    assert rules["rules"], "fallback disk phải trả về rules"


def test_sim_records_endpoint_serves_database_documents():
    db = FakeKeyedDatabase()
    seed_sim_records(db)

    original = sim_records_router.get_database
    sim_records_router.get_database = lambda: db
    try:
        response = TestClient(app).get("/api/v1/sim-records")
    finally:
        sim_records_router.get_database = original

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 9
    sequences = [item["seq"] for item in body["items"]]
    assert sequences == sorted(sequences)
    assert body["items"][0]["record"]["record_id"] == "2001175594"
    assert body["items"][0]["ui"]["status"] == "examining"
    assert all("_id" not in item for item in body["items"])


def test_sim_records_endpoint_falls_back_to_disk():
    def broken_get_database():
        raise RuntimeError("mongo down")

    original = sim_records_router.get_database
    sim_records_router.get_database = broken_get_database
    try:
        response = TestClient(app).get("/api/v1/sim-records")
    finally:
        sim_records_router.get_database = original

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == len(load_sim_seed_documents()) == 9
