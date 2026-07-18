from types import SimpleNamespace

from app.ai_cache import make_cache_key
from app.routers import ai
from tests.fake_mongo import FakeDatabase


def test_cache_key_changes_with_input_rules_prompt_pipeline_or_model():
    base, input_hash = make_cache_key(
        "check", {"diagnosis": {"icd10": "Z34.0"}},
        pipeline_version="p1", prompt_version="q1", rules_version="r1", model="m1",
    )
    same, same_input_hash = make_cache_key(
        "check", {"diagnosis": {"icd10": "Z34.0"}},
        pipeline_version="p1", prompt_version="q1", rules_version="r1", model="m1",
    )
    changed, _ = make_cache_key(
        "check", {"diagnosis": {"icd10": "Z34.0"}},
        pipeline_version="p1", prompt_version="q1", rules_version="r2", model="m1",
    )
    assert base == same
    assert input_hash == same_input_hash
    assert changed != base


def test_second_ai_check_with_only_non_ai_field_changed_is_cache_hit_and_uses_zero_tokens(monkeypatch):
    db = FakeDatabase()
    calls = {"count": 0}
    settings = SimpleNamespace(
        api_key="test-key",
        pii_fail_closed=True,
        pipeline_version="pipeline-v1",
        model="model-v1",
    )

    def fake_run_check(*_args, **_kwargs):
        calls["count"] += 1
        return {
            "run_id": "run-1",
            "result": {"ket_luan": "DAT"},
            "telemetry": {
                "status": "success",
                "model": "model-v1",
                "pipeline_version": "pipeline-v1",
                "latency_ms": 25,
                "input_tokens": 100,
                "output_tokens": 23,
                "total_tokens": 123,
                "api_calls": 1,
            },
        }

    monkeypatch.setattr(ai.CheckerSettings, "from_env", lambda *_: settings)
    monkeypatch.setattr(ai, "_load_rules_or_503", lambda: {"rules": []})
    monkeypatch.setattr(ai, "run_check", fake_run_check)
    monkeypatch.setattr(ai, "_cache_database", lambda: db)
    monkeypatch.setattr(ai, "write_api_usage", lambda **_: None)

    first = ai.check_record(
        ai.CheckRecordRequest(
            record={"patient": {"full_name": "Nguyễn Văn A", "age": 30}, "visit": {"reason": "Khám thai"}}
        )
    )
    second = ai.check_record(
        ai.CheckRecordRequest(
            record={"patient": {"full_name": "Nguyễn Văn B", "age": 30}, "visit": {"reason": "Khám thai"}}
        )
    )

    assert calls["count"] == 1
    assert first["meta"]["cache_status"] == "miss"
    assert first["meta"]["total_tokens"] == 123
    assert second["meta"]["cache_status"] == "hit"
    assert second["meta"]["api_calls"] == 0
    assert second["meta"]["total_tokens"] == 0
    assert second["meta"]["saved_tokens"] == 123
