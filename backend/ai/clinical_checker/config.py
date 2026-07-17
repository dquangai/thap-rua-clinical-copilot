from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def load_dotenv(path: Path) -> None:
    """Small dependency-free .env loader; existing environment wins."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


@dataclass(frozen=True)
class Settings:
    provider: str
    model: str
    api_key: str
    base_url: str
    timeout_seconds: float
    max_output_tokens: int
    input_price_per_million_usd: float
    output_price_per_million_usd: float
    pipeline_version: str
    pii_fail_closed: bool
    use_json_schema: bool = True

    @classmethod
    def from_env(cls, env_path: Path | None = None) -> "Settings":
        if env_path:
            load_dotenv(env_path)
        provider = os.getenv("LLM_PROVIDER", "openai").lower()
        default_url = "https://api.anthropic.com/v1" if provider == "anthropic" else "https://api.openai.com/v1"
        base_url = os.getenv("LLM_BASE_URL", default_url).rstrip("/")
        # DeepSeek (OpenAI-compatible) chua ho tro response_format json_schema strict.
        use_json_schema_env = os.getenv("LLM_USE_JSON_SCHEMA", "auto").lower()
        if use_json_schema_env == "auto":
            use_json_schema = "deepseek" not in base_url
        else:
            use_json_schema = use_json_schema_env == "true"
        return cls(
            provider=provider,
            model=os.getenv("LLM_MODEL", "gpt-4.1-mini"),
            api_key=os.getenv("LLM_API_KEY", ""),
            base_url=base_url,
            use_json_schema=use_json_schema,
            timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "90")),
            max_output_tokens=int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "4000")),
            input_price_per_million_usd=float(os.getenv("LLM_INPUT_PRICE_PER_MILLION_USD", "0")),
            output_price_per_million_usd=float(os.getenv("LLM_OUTPUT_PRICE_PER_MILLION_USD", "0")),
            pipeline_version=os.getenv("PIPELINE_VERSION", "baseline-v1"),
            pii_fail_closed=os.getenv("PII_FAIL_CLOSED", "true").lower() == "true",
        )
