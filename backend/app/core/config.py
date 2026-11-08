"""Application configuration, driven by environment variables (prefix FILEMASTER_)."""
import tempfile
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FILEMASTER_", env_file=".env", extra="ignore")

    max_upload_mb: int = Field(200, ge=1, le=5000)
    work_dir: str = ""
    file_ttl_minutes: int = Field(60, ge=1)
    cleanup_interval_s: int = Field(300, ge=5)
    ffmpeg_timeout_s: int = Field(900, ge=5)
    max_workers: int = Field(2, ge=1, le=16)
    max_image_pixels: int = 100_000_000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"
    static_dir: str = ""  # optional: serve a built frontend from the API container

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def root(self) -> Path:
        return Path(self.work_dir) if self.work_dir else Path(tempfile.gettempdir()) / "filemaster"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
