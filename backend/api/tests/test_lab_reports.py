from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_current_user
from app.main import app
from app.routers.lab_reports import PDF_PATH


def test_private_lab_report_pdf_exists():
    assert PDF_PATH.is_file()
    assert PDF_PATH.read_bytes().startswith(b"%PDF-")


def test_lab_report_pdf_requires_authentication():
    response = TestClient(app).get("/api/v1/lab-reports/summary-pdf")
    assert response.status_code == 401

def test_authenticated_user_can_view_full_pdf():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id="doctor-1", email="doctor@example.test")
    try:
        response = TestClient(app).get("/api/v1/lab-reports/summary-pdf")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.content == PDF_PATH.read_bytes()

def test_local_demo_can_view_full_pdf():
    response = TestClient(app).get(
        "/api/v1/lab-reports/demo-summary-pdf",
        headers={"X-Demo-Mode": "1"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content == PDF_PATH.read_bytes()


def test_demo_pdf_requires_explicit_header():
    response = TestClient(app).get("/api/v1/lab-reports/demo-summary-pdf")
    assert response.status_code == 403