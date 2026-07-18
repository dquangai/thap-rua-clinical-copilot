from __future__ import annotations

from copy import deepcopy
from types import SimpleNamespace
from typing import Any, Iterable


def _matches(document: dict[str, Any], selector: dict[str, Any]) -> bool:
    for key, expected in selector.items():
        present = key in document
        actual = document.get(key)
        if isinstance(expected, dict):
            if "$exists" in expected and present != expected["$exists"]:
                return False
            if "$lt" in expected and (not present or actual >= expected["$lt"]):
                return False
        elif actual != expected:
            return False
    return True


def _project(document: dict[str, Any], projection: dict[str, Any] | None) -> dict[str, Any]:
    result = deepcopy(document)
    if projection:
        excluded = {key for key, value in projection.items() if value == 0}
        included = {key for key, value in projection.items() if value == 1}
        if included and not excluded:
            result = {key: result[key] for key in included if key in result}
        for key in excluded:
            result.pop(key, None)
    return result


class FakeCursor:
    def __init__(self, rows: Iterable[dict[str, Any]]):
        self.rows = list(rows)

    def sort(self, key: str, direction: int):
        self.rows.sort(key=lambda row: row.get(key), reverse=direction < 0)
        return self

    def limit(self, value: int):
        self.rows = self.rows[:value]
        return self

    def __iter__(self):
        return iter(self.rows)


class FakeCollection:
    def __init__(self, rows: Iterable[dict[str, Any]] = ()):
        self.rows = [deepcopy(row) for row in rows]
        for index, row in enumerate(self.rows, start=1):
            row.setdefault("_id", f"fake-{index}")

    def find_one(self, selector: dict[str, Any], projection: dict[str, Any] | None = None):
        for row in self.rows:
            if _matches(row, selector):
                return _project(row, projection)
        return None

    def find(self, selector: dict[str, Any], projection: dict[str, Any] | None = None):
        return FakeCursor(_project(row, projection) for row in self.rows if _matches(row, selector))

    def insert_one(self, document: dict[str, Any]):
        stored = deepcopy(document)
        stored.setdefault("_id", f"fake-{len(self.rows) + 1}")
        self.rows.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    def delete_one(self, selector: dict[str, Any]):
        for index, row in enumerate(self.rows):
            if _matches(row, selector):
                self.rows.pop(index)
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    def update_one(self, selector: dict[str, Any], update: dict[str, Any]):
        for row in self.rows:
            if _matches(row, selector):
                row.update(deepcopy(update.get("$set", {})))
                for key in update.get("$unset", {}):
                    row.pop(key, None)
                return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)

    def find_one_and_update(self, selector: dict[str, Any], update: dict[str, Any], **_: Any):
        for row in self.rows:
            if _matches(row, selector):
                row.update(deepcopy(update.get("$set", {})))
                for key in update.get("$unset", {}):
                    row.pop(key, None)
                return deepcopy(row)
        return None


class FakeDatabase:
    def __init__(self, *, patients: Iterable[dict[str, Any]] = ()):
        self.patients = FakeCollection(patients)
        self.clinical_records = FakeCollection()
        self.clinical_record_versions = FakeCollection()
        self.ai_artifacts = FakeCollection()
        self.api_usage_events = FakeCollection()
