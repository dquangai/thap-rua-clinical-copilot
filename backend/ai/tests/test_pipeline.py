import unittest
import json
import tempfile
from pathlib import Path

from clinical_checker.cli import load_rules
from clinical_checker.pipeline import (extract_required_criteria, merge_repair_rows,
                                       normalize_null_statuses, validate_and_summarize)


class PipelineTests(unittest.TestCase):
    def test_extracts_item_and_rule_level_criteria(self):
        rules = {"rules": [
            {"rule_id": "R01", "ten": "A", "severity": "MAJOR", "items": [{"id": "R01.1", "noi_dung": "X"}]},
            {"rule_id": "R02", "ten": "Schedule", "lich": [{"x": 1}], "logic_kiem_tra": "Y"},
        ]}
        self.assertEqual([x["item_id"] for x in extract_required_criteria(rules)], ["R01.1", "R02"])

    def test_validates_coverage_and_builds_pass_fail_summary(self):
        result = {"ket_qua_theo_rule": [
            {"item_id": "R01.1", "trang_thai": "DAT"},
            {"item_id": "R01.2", "trang_thai": "KHONG_DAT"},
        ]}
        summary = validate_and_summarize(result, ["R01.1", "R01.2"])
        self.assertEqual(summary["counts"]["DAT"], 1)
        self.assertEqual(summary["criteria_by_status"]["KHONG_DAT"], ["R01.2"])

    def test_rejects_missing_criterion(self):
        with self.assertRaises(ValueError):
            validate_and_summarize({"ket_qua_theo_rule": []}, ["R01.1"])

    def test_merges_focused_repair(self):
        result = {"ket_qua_theo_rule": [{"item_id": "R01.1", "trang_thai": "DAT"}]}
        repair = {"ket_qua_theo_rule": [{"item_id": "R07", "trang_thai": "THIEU_DU_LIEU"}]}
        merge_repair_rows(result, repair, ["R07"])
        summary = validate_and_summarize(result, ["R01.1", "R07"])
        self.assertEqual(summary["total_criteria"], 2)

    def test_rejects_null_status_with_repairable_item_id(self):
        with self.assertRaises(Exception) as context:
            validate_and_summarize({"ket_qua_theo_rule": [
                {"item_id": "R01.1", "trang_thai": None}
            ]}, ["R01.1"])
        self.assertEqual(context.exception.invalid_item_ids, ["R01.1"])

    def test_normalizes_provider_null_to_missing_data(self):
        result = {"ket_qua_theo_rule": [{"item_id": "R07", "trang_thai": None, "ghi_chu": ""}]}
        self.assertEqual(normalize_null_statuses(result), ["R07"])
        summary = validate_and_summarize(result, ["R07"])
        self.assertEqual(summary["counts"]["THIEU_DU_LIEU"], 1)

    def test_loads_all_rule_files_from_folder(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.json").write_text(json.dumps({"rules": [{"rule_id": "R01"}]}))
            (root / "b.json").write_text(json.dumps({"rules": [{"rule_id": "R02"}]}))
            loaded = load_rules(root)
            self.assertEqual(loaded["sources"], ["a.json", "b.json"])
            self.assertEqual([x["rule_id"] for x in loaded["rules"]], ["R01", "R02"])


if __name__ == "__main__":
    unittest.main()
