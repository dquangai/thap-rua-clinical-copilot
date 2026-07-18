from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    mongodb_uri: str = ""
    mongodb_database: str = "thap_rua_clinical"

    @property
    def mongodb_configured(self) -> bool:
        return bool(self.mongodb_uri)



@lru_cache
def get_settings() -> Settings:
    return Settings()
