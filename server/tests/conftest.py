import os
from pathlib import Path

ENV = Path("/var/www/music.esl.kz/.env").read_text()
for line in ENV.splitlines():
    if line.startswith("TEST_DATABASE_URL="):
        os.environ["DATABASE_URL"] = line.split("=", 1)[1]
os.environ["COOKIE_SECURE"] = "false"
os.environ["MOCK_DELAY_SECONDS"] = "0"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["RECONCILE_SECONDS"] = "30"
os.environ["REDIS_PREFIX"] = "music.esl.kz:test"
os.environ["MEDIA_ROOT"] = "/var/lib/music.esl.kz/test-media"
os.environ["SIGNUP_BONUS_TOKENS"] = "0"
os.environ["TEST_SIGNUP_TOKENS"] = "200"
assert "music_esl_test" in os.environ["DATABASE_URL"]

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.config import get_settings
from app.db import engine


@pytest.fixture(scope="session", autouse=True)
def migrated():
    Path("/var/lib/music.esl.kz/test-media").mkdir(parents=True, exist_ok=True)
    config = Config("/var/www/music.esl.kz/server/alembic.ini")
    command.upgrade(config, "head")
    yield


@pytest.fixture(autouse=True)
def clean(migrated):
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE admin_audit, outbox, ledger, tracks, jobs, payments, password_resets, sessions, user_settings, wallets, provider_tasks, accounts RESTART IDENTITY CASCADE"))
    redis = __import__("app.redisq", fromlist=["client"]).client()
    for key in redis.scan_iter(f"{get_settings().redis_prefix}:*"):
        redis.delete(key)
    yield
