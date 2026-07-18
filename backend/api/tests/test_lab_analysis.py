import pytest
from pydantic import ValidationError

from app.routers.lab_analysis import LabNarrativeRequest, extract_output_text


def test_extract_output_text():
    payload = {
        "output": [
            {
                "type": "message",
                "content": [{"type": "output_text", "text": "Bản nháp kết quả"}],
            }
        ]
    }
    assert extract_output_text(payload) == "Bản nháp kết quả"


def test_lab_payload_rejects_patient_identifiers():
    with pytest.raises(ValidationError):
        LabNarrativeRequest.model_validate(
            {
                "patient_name": "Không được gửi",
                "rows": [
                    {
                        "name": "Glucose",
                        "result": "90.7",
                        "unit": "mg/dl",
                        "reference": "74 - 109",
                        "status": "normal",
                        "difference": None,
                    }
                ],
            }
        )