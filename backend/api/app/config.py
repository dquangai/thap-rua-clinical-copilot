from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    supabase_url: str = ""
    supabase_publishable_key: str = Field(default="", repr=False)
    supabase_secret_key: str = Field(default="", repr=False)
    openai_api_key: str = Field(default="", repr=False)
    openai_model: str = "gpt-5.6-sol"
    openai_base_url: str = "https://api.openai.com/v1"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key and self.supabase_secret_key)

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key and self.openai_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()