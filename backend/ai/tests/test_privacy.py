import unittest

from clinical_checker.privacy import build_minimum_necessary_record, find_residual_pii


class PrivacyTests(unittest.TestCase):
    def test_removes_structured_and_embedded_pii(self):
        record = {
            "record_id": "SIM-001", "doctor": "BS Nguyen Van A", "signed_at": "2026-01-01",
            "patient": {"full_name": "NGUYEN THI A", "phone": "0903214567", "address": "Dia chi X", "age": 26, "gender": "Nu"},
            "visit": {"visit_code": "KB123456", "visit_datetime": "2026-01-01", "reason": "Kham thai", "clinic": "PK1"},
            "clinical_note": {"dien_bien": "BN NGUYEN THI A, goi 0903214567, du sanh 26/01/2027"},
            "diagnosis": {"icd10": "Z34.0", "mo_ta": "Thai 12 tuan"},
            "vital_signs": {"mach_lan_phut": 80},
        }
        safe = build_minimum_necessary_record(record)
        self.assertNotIn("full_name", safe["patient"])
        self.assertNotIn("visit_code", safe["visit"])
        self.assertNotIn("NGUYEN THI A", str(safe))
        self.assertEqual(find_residual_pii(safe), [])


if __name__ == "__main__":
    unittest.main()
