import json
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings, get_settings

router = APIRouter(prefix='/lab-analysis', tags=['lab-analysis'])


class LabComparisonInput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    name: str = Field(min_length=1, max_length=180)
    result: str = Field(min_length=1, max_length=60)
    unit: str = Field(default='', max_length=40)
    reference: str = Field(min_length=1, max_length=80)
    status: Literal['high', 'low']
    difference: str | None = Field(default=None, max_length=60)


class LabNarrativeRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    rows: list[LabComparisonInput] = Field(min_length=1, max_length=200)


class LabNarrativeResponse(BaseModel):
    text: str
    source: Literal['openai'] = 'openai'


def extract_output_text(payload: dict) -> str:
    texts: list[str] = []
    for item in payload.get('output', []):
        if item.get('type') != 'message':
            continue
        for content in item.get('content', []):
            if content.get('type') == 'output_text' and content.get('text'):
                texts.append(content['text'])
    return '\n'.join(texts).strip()


@router.post('/narrative', response_model=LabNarrativeResponse)
def create_lab_narrative(
    payload: LabNarrativeRequest,
    settings: Settings = Depends(get_settings),
):
    if not settings.openai_configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='OpenAI is not configured')

    deidentified_rows = [row.model_dump() for row in payload.rows]
    instructions = (
        'Bạn là trợ lý biên tập kết quả xét nghiệm cho bác sĩ. Dữ liệu đầu vào đã được đối chiếu số học '
        'bằng mã xác định, chỉ gồm các chỉ số bất thường và không chứa thông tin định danh. '
        'Chỉ hiển thị các chỉ số cao hoặc thấp, tuyệt đối không thêm chỉ số bình thường. Không chẩn đoán, không đề xuất điều trị, '
        'không thay đổi bất kỳ con số, đơn vị, khoảng tham chiếu hoặc trạng thái nào. '
        'Trả về duy nhất các dòng ngắn bằng tiếng Việt, không tiêu đề, không mở đầu, không kết luận và không giải thích thêm. '
        'Mỗi dòng bắt đầu bằng dấu gạch đầu dòng và phải đúng dạng: '
        '- Chỉ số [tên] cao: [kết quả] [đơn vị] hoặc - Chỉ số [tên] thấp: [kết quả] [đơn vị].'
    )

    try:
        response = httpx.post(
            f"{settings.openai_base_url.rstrip('/')}/responses",
            headers={
                'Authorization': f'Bearer {settings.openai_api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': settings.openai_model,
                'store': False,
                'instructions': instructions,
                'input': json.dumps({'lab_comparisons': deidentified_rows}, ensure_ascii=False),
                'max_output_tokens': 600,
            },
            timeout=40.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='OpenAI request failed') from exc

    text = extract_output_text(response.json())
    if not text:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail='OpenAI returned an empty response')
    return LabNarrativeResponse(text=text)
