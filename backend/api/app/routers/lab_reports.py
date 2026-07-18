from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import FileResponse

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings

router = APIRouter(prefix="/lab-reports", tags=["lab-reports"])
PDF_PATH = Path(__file__).resolve().parents[1] / "assets" / "phieu-xet-nghiem-tong-hop.pdf"


def pdf_response():
    if not PDF_PATH.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab report PDF not found")
    return FileResponse(
        path=PDF_PATH,
        media_type="application/pdf",
        headers={"Cache-Control": "private, no-store"},
    )


@router.get("/summary-pdf", response_class=FileResponse)
def get_summary_lab_report(_: CurrentUser = Depends(get_current_user)):
    return pdf_response()


@router.get("/demo-summary-pdf", response_class=FileResponse)
def get_demo_summary_lab_report(
    x_demo_mode: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
):
    frontend_host = urlparse(settings.frontend_origin).hostname
    if x_demo_mode != "1" or frontend_host not in {"127.0.0.1", "localhost"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo PDF access is disabled")
    return pdf_response()