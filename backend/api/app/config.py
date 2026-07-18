from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    frontend_origins: str = "https://thap-rua-clinical-copilot-1.onrender.com"
    mongodb_uri: str = ""
    mongodb_database: str = "thap_rua_clinical"
    openai_api_key: str = Field(default="", repr=False)
    openai_model: str = "gpt-5.6-sol"
    openai_base_url: str = "https://api.openai.com/v1"
    supabase_url: str = ""
    supabase_publishable_key: str = Field(default="", repr=False)
    supabase_secret_key: str = Field(default="", repr=False)

    @property
    def mongodb_configured(self) -> bool:
        return bool(self.mongodb_uri)

    @property
    def allowed_frontend_origins(self) -> list[str]:
        origins = [self.frontend_origin, *self.frontend_origins.split(",")]
        return list(dict.fromkeys(origin.strip().rstrip("/") for origin in origins if origin.strip()))

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key and self.openai_model)

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key and self.supabase_secret_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
