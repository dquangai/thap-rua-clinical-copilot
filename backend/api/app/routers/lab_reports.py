from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

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
def get_summary_lab_report():
    return pdf_response()
