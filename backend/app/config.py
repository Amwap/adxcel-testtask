from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Campaign analytics API"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:5173"]
    data_dir: Path = BASE_DIR / "data"
    db_path: Path = BASE_DIR / "data" / "app.db"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
