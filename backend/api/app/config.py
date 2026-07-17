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

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_publishable_key and self.supabase_secret_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
