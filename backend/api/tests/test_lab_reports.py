from fastapi.testclient import TestClient

from app.main import app
from app.routers.lab_reports import PDF_PATH


def test_private_lab_report_pdf_exists():
    assert PDF_PATH.is_file()
    assert PDF_PATH.read_bytes().startswith(b"%PDF-")


def test_lab_report_pdf_is_available():
    response = TestClient(app).get("/api/v1/lab-reports/summary-pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.content == PDF_PATH.read_bytes()
