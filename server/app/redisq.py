import redis

from .config import get_settings


def client():
    settings = get_settings()
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def queue_key() -> str:
    return f"{get_settings().redis_prefix}:jobs"


def heartbeat_key() -> str:
    return f"{get_settings().redis_prefix}:worker:heartbeat"
