from __future__ import annotations

import json
import os
import random
import threading
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


_limiter_lock = threading.Lock()
_limiter: threading.BoundedSemaphore | None = None
_limiter_size: int | None = None


def _provider_limiter() -> threading.BoundedSemaphore:
    """Process-wide limiter covering every HTTP call, including parallel rule batches."""
    global _limiter, _limiter_size
    size = max(1, int(os.getenv("LLM_MAX_CONCURRENCY", "4")))
    with _limiter_lock:
        if _limiter is None or _limiter_size != size:
            _limiter = threading.BoundedSemaphore(size)
            _limiter_size = size
        return _limiter


def _retry_delay(exc: urllib.error.HTTPError | None, attempt: int) -> float:
    """Honor provider guidance, otherwise use capped exponential backoff with full jitter."""
    if exc is not None:
        retry_after = exc.headers.get("Retry-After")
        if retry_after:
            try:
                return min(max(float(retry_after), 0.0), 60.0)
            except ValueError:
                pass
    cap = min(1.0 * (2 ** attempt), 30.0)
    return random.uniform(0.0, cap)


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
        payload = {"model": settings.model,
                   "response_format": response_format,
                   "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        # OpenAI chinh thuc (gpt-5.x) bat buoc max_completion_tokens va chi cho temperature mac dinh;
        # cac endpoint OpenAI-compatible khac (deepseek...) van dung max_tokens + temperature 0.
        if "openai.com" in settings.base_url:
            payload["max_completion_tokens"] = settings.max_output_tokens
        else:
            payload["max_tokens"] = settings.max_output_tokens
            payload["temperature"] = 0
    else:
        raise ValueError(f"Provider khong ho tro: {settings.provider}")
    headers["Content-Type"] = "application/json"
    request_data = json.dumps(payload).encode()
    body = None
    request_id = None
    max_attempts = 5
    for attempt in range(max_attempts):
        request = urllib.request.Request(url, data=request_data, headers=headers, method="POST")
        try:
            with _provider_limiter():
                with urllib.request.urlopen(request, timeout=settings.timeout_seconds) as response:
                    body = json.loads(response.read())
                    request_id = response.headers.get("x-request-id") or response.headers.get("request-id")
            break
        except urllib.error.HTTPError as exc:
            # Retry only temporary upstream failures; never echo response bodies because they can contain request data.
            if exc.code not in {408, 429, 500, 502, 503, 504} or attempt == max_attempts - 1:
                raise RuntimeError(f"LLM API lỗi HTTP {exc.code}") from exc
            time.sleep(_retry_delay(exc, attempt))
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            if attempt == max_attempts - 1:
                raise RuntimeError(f"Kết nối đến LLM provider bị gián đoạn sau {max_attempts} lần thử") from exc
            time.sleep(_retry_delay(None, attempt))
    if body is None:
        raise RuntimeError("LLM provider không trả về dữ liệu")
    if settings.provider == "anthropic":
        usage = body.get("usage", {})
        text = "".join(block.get("text", "") for block in body.get("content", []) if block.get("type") == "text")
        return LlmResponse(text, usage.get("input_tokens", 0), usage.get("output_tokens", 0), request_id)
    usage = body.get("usage", {})
    return LlmResponse(body["choices"][0]["message"]["content"], usage.get("prompt_tokens", 0),
                       usage.get("completion_tokens", 0), request_id)
