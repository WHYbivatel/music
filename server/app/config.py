from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path("/var/www/music.esl.kz/.env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra="ignore")

    database_url: str
    test_database_url: str = ""
    redis_url: str = "redis://127.0.0.1:6379/0"
    redis_prefix: str = "music.esl.kz"
    secret_key: str
    cookie_secure: bool = True
    trust_proxy: bool = True
    media_root: str = "/var/lib/music.esl.kz/media"
    storage_backend: str = "local"
    s3_endpoint: str = ""
    s3_bucket: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "us-east-1"
    music_provider: str = "mock"
    real_generation_enabled: bool = False
    ace_step_base_url: str = ""
    ace_step_token: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    public_base_url: str = "https://music.esl.kz"
    signup_bonus_tokens: int = 0
    test_signup_tokens: int = 200
    demo_tokens: int = 50
    session_days: int = 14
    reset_minutes: int = 30
    daily_job_limit: int = 30
    max_queue: int = 100
    max_active_jobs: int = 1
    mock_delay_seconds: float = 2
    job_timeout_seconds: int = 180
    reconcile_seconds: int = 90
    lease_seconds: int = 30
    max_attempts: int = 3
    real_transfers_enabled: bool = False
    payment_credit_enabled: bool = True
    payment_ttl_hours: int = 72
    demo_audio_dir: str = "/var/www/music.esl.kz/public/audio"
    rate_limit_enabled: bool = True
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
