from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from .config import Settings


@dataclass(frozen=True)
class LlmResponse:
    text: str
    input_tokens: int
    output_tokens: int
    request_id: str | None


def call_llm(settings: Settings, system: str, user: str,
             response_schema: dict[str, Any] | None = None) -> LlmResponse:
    if not settings.api_key or settings.api_key == "replace_me":
        raise RuntimeError("LLM_API_KEY chua duoc cau hinh")
    if settings.provider == "anthropic":
        url = f"{settings.base_url}/messages"
        headers = {"x-api-key": settings.api_key, "anthropic-version": "2023-06-01"}
        payload = {"model": settings.model, "max_tokens": settings.max_output_tokens,
                   "system": system, "messages": [{"role": "user", "content": user}]}
    elif settings.provider == "openai":
        url = f"{settings.base_url}/chat/completions"
        headers = {"Authorization": f"Bearer {settings.api_key}"}
        response_format = ({"type": "json_schema", "json_schema": {
            "name": "clinical_compliance", "strict": True, "schema": response_schema,
        }} if response_schema and settings.use_json_schema else {"type": "json_object"})
        payload = {"model": settings.model, "max_tokens": settings.max_output_tokens,
                   "temperature": 0,
                   "response_format": response_format,
                   "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    else:
        raise ValueError(f"Provider khong ho tro: {settings.provider}")
    headers["Content-Type"] = "application/json"
    request_data = json.dumps(payload).encode()
    body = None
    request_id = None
    max_attempts = 3
    for attempt in range(max_attempts):
        request = urllib.request.Request(url, data=request_data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=settings.timeout_seconds) as response:
                body = json.loads(response.read())
                request_id = response.headers.get("x-request-id") or response.headers.get("request-id")
            break
        except urllib.error.HTTPError as exc:
            # Retry only temporary upstream failures; never echo response bodies because they can contain request data.
            if exc.code not in {408, 429, 500, 502, 503, 504} or attempt == max_attempts - 1:
                raise RuntimeError(f"LLM API lỗi HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            if attempt == max_attempts - 1:
                raise RuntimeError("Kết nối đến LLM provider bị gián đoạn sau 3 lần thử") from exc
        time.sleep(0.35 * (2 ** attempt))
    if body is None:
        raise RuntimeError("LLM provider không trả về dữ liệu")
    if settings.provider == "anthropic":
        usage = body.get("usage", {})
        text = "".join(block.get("text", "") for block in body.get("content", []) if block.get("type") == "text")
        return LlmResponse(text, usage.get("input_tokens", 0), usage.get("output_tokens", 0), request_id)
    usage = body.get("usage", {})
    return LlmResponse(body["choices"][0]["message"]["content"], usage.get("prompt_tokens", 0),
                       usage.get("completion_tokens", 0), request_id)
