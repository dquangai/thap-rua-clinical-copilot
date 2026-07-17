import unittest
import json
import tempfile
from pathlib import Path

from clinical_checker.cli import load_rules
from clinical_checker.pipeline import (build_public_result, detect_gestational_age, compact_json_schema,
                                       expand_compact_result, extract_required_criteria,
                                       filter_criteria_by_trimester,
                                       merge_repair_rows, normalize_null_statuses,
                                       normalize_exceptions_container, prepare_compact_for_validation,
                                       repair_json_schema, validate_and_summarize)


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

    def test_detects_trimester_from_diagnosis(self):
        first = detect_gestational_age({"diagnosis": {"mo_ta": "THAI 12 TUẦN 03 NGÀY"}})
        self.assertEqual((first["weeks"], first["days"], first["trimester"]), (12, 3, "TCN1"))
        self.assertEqual(detect_gestational_age({"diagnosis": {"mo_ta": "THAI 21 TUẦN 05 NGÀY"}})["trimester"], "TCN2")
        self.assertEqual(detect_gestational_age({"diagnosis": {"mo_ta": "THAI 35 TUẦN"}})["trimester"], "TCN3")
        self.assertEqual(detect_gestational_age({"diagnosis": {"mo_ta": "THAI 13 TUẦN 06 NGÀY"}})["trimester"], "TCN1")
        self.assertEqual(detect_gestational_age({"diagnosis": {"mo_ta": "THAI 14 TUẦN 00 NGÀY"}})["trimester"], "TCN2")
        self.assertEqual(detect_gestational_age({"diagnosis": {"mo_ta": "THAI 28 TUẦN 06 NGÀY"}})["trimester"], "TCN2")
        self.assertEqual(detect_gestational_age({"diagnosis": {"mo_ta": "THAI 29 TUẦN 00 NGÀY"}})["trimester"], "TCN3")

    def test_filters_only_trimester_specific_criteria(self):
        criteria = [
            {"item_id": "COMMON", "scope": {}},
            {"item_id": "T1", "scope": {"tam_ca_nguyet": "TCN1"}},
            {"item_id": "T2", "scope": {"tam_ca_nguyet": "TCN2"}},
        ]
        selected, excluded = filter_criteria_by_trimester(criteria, "TCN1")
        self.assertEqual([x["item_id"] for x in selected], ["COMMON", "T1"])
        self.assertEqual([x["item_id"] for x in excluded], ["T2"])
        self.assertEqual(len(filter_criteria_by_trimester(criteria, None)[0]), 3)

    def test_expands_compact_output_with_complete_coverage(self):
        compact = {
            "dat_ids": ["R01.1"], "khong_ap_dung_ids": ["R01.2"],
            "exceptions": [{"item_id": "R01.3", "trang_thai": "KHONG_DAT", "ghi_chu": "missing"}],
        }
        result = expand_compact_result(compact, ["R01.1", "R01.2", "R01.3"])
        summary = validate_and_summarize(result, ["R01.1", "R01.2", "R01.3"])
        self.assertEqual(summary["counts"]["DAT"], 1)
        self.assertEqual(summary["counts"]["KHONG_DAT"], 1)

    def test_compact_output_rejects_missing_or_duplicate_ids(self):
        with self.assertRaises(Exception):
            expand_compact_result({"dat_ids": ["R01.1", "R01.1"], "khong_ap_dung_ids": [],
                                   "exceptions": []}, ["R01.1", "R01.2"])

    def test_prepares_compact_output_and_repairs_only_conflicts(self):
        compact = {
            "dat_ids": ["R01.1", "R01.2"], "khong_ap_dung_ids": ["R01.2"],
            "exceptions": [{"item_id": "R01.3", "trang_thai": "KHONG_AP_DUNG"}],
        }
        prepared, repair_ids, notes = prepare_compact_for_validation(
            compact, ["R01.1", "R01.2", "R01.3"])
        self.assertEqual(prepared["dat_ids"], ["R01.1"])
        self.assertEqual(prepared["khong_ap_dung_ids"], ["R01.3"])
        self.assertEqual(repair_ids, ["R01.2"])
        self.assertEqual(notes["normalized_not_applicable_ids"], ["R01.3"])

    def test_normalizes_grouped_exception_object(self):
        rows = normalize_exceptions_container({
            "KHONG_DAT": [{"item_id": "R01.1", "ghi_chu": "x"}],
            "thieu_du_lieu": ["R01.2"],
        })
        self.assertEqual(rows[0]["trang_thai"], "KHONG_DAT")
        self.assertEqual(rows[1], {"item_id": "R01.2", "trang_thai": "THIEU_DU_LIEU",
                                   "bang_chung": "", "ghi_chu": ""})

    def test_normalizes_exception_id_map(self):
        rows = normalize_exceptions_container({
            "R01.1": "KHONG_DAT",
            "R01.2": {"trang_thai": "THIEU_DU_LIEU", "ghi_chu": "missing"},
        })
        self.assertEqual(rows[0]["item_id"], "R01.1")
        self.assertEqual(rows[1]["trang_thai"], "THIEU_DU_LIEU")
        aliased = normalize_exceptions_container({"R01.3": {"status": "KHONG_DAT", "reason": "missing"}})
        self.assertEqual(aliased[0]["ghi_chu"], "missing")

    def test_compact_json_schema_is_strict_and_requires_arrays(self):
        schema = compact_json_schema()
        self.assertFalse(schema["additionalProperties"])
        self.assertEqual(schema["properties"]["exceptions"]["type"], "array")
        self.assertIn("dat_ids", schema["required"])
        repair_schema = repair_json_schema()
        self.assertEqual(repair_schema["properties"]["evaluations"]["type"], "array")

    def test_public_result_is_final_verdict_only(self):
        internal = {"ket_qua_theo_rule": [
            {"item_id": "PASS", "trang_thai": "DAT"},
            {"item_id": "FAIL", "trang_thai": "KHONG_DAT", "bang_chung": "", "ghi_chu": "x"},
            {"item_id": "NA", "trang_thai": "KHONG_AP_DUNG"},
        ], "tong_ket": {"vi_pham_critical": ["FAIL"], "khuyen_nghi": "y"}}
        public = build_public_result(internal)
        self.assertEqual(public["ket_luan"], "KHONG_DAT")
        self.assertEqual([x["item_id"] for x in public["khong_dat"]], ["FAIL"])
        self.assertNotIn("NA", str(public))

    def test_public_result_passes_when_all_applicable_dat(self):
        internal = {"ket_qua_theo_rule": [
            {"item_id": "PASS", "trang_thai": "DAT"},
            {"item_id": "NA", "trang_thai": "KHONG_AP_DUNG"},
        ], "tong_ket": {"vi_pham_critical": [], "khuyen_nghi": ""}}
        public = build_public_result(internal)
        self.assertEqual(public["ket_luan"], "DAT")
        self.assertEqual(public["khong_dat"], [])

    def test_split_batches_balances_and_covers_all(self):
        from clinical_checker.pipeline import split_batches
        criteria = [{"item_id": f"R{i}"} for i in range(30)]
        batches = split_batches(criteria, 12)
        self.assertEqual([len(b) for b in batches], [10, 10, 10])
        self.assertEqual([x["item_id"] for b in batches for x in b],
                         [x["item_id"] for x in criteria])
        self.assertEqual(split_batches(criteria, 0), [criteria])
        self.assertEqual(split_batches(criteria[:5], 10), [criteria[:5]])

    def test_merge_tong_ket_dedupes(self):
        from clinical_checker.pipeline import merge_tong_ket
        merged = merge_tong_ket([
            {"vi_pham_critical": ["A", "B"], "khuyen_nghi": "Bo sung X."},
            {"vi_pham_critical": ["B", "C"], "khuyen_nghi": "Bo sung X."},
            {"vi_pham_critical": [], "khuyen_nghi": "Kiem tra Y."},
            None,
        ])
        self.assertEqual(merged["vi_pham_critical"], ["A", "B", "C"])
        self.assertEqual(merged["khuyen_nghi"], "Bo sung X. Kiem tra Y.")

    def test_missing_data_status_merges_into_khong_dat(self):
        from clinical_checker.pipeline import merge_missing_data_status
        rows = merge_missing_data_status([{"item_id": "A", "trang_thai": "THIEU_DU_LIEU", "ghi_chu": ""}])
        self.assertEqual(rows[0]["trang_thai"], "KHONG_DAT")
        self.assertTrue(rows[0]["ghi_chu"])


if __name__ == "__main__":
    unittest.main()
