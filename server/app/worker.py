import logging
import os
import socket
import time
import uuid

from .config import get_settings
from .db import SessionLocal
from .generation import process_job, recover_stuck
from .logging_setup import setup_logging
from .redisq import client, heartbeat_key, queue_key
from .runtime import get_provider, get_storage

log = logging.getLogger("music.worker")


def worker_id() -> str:
    return f"{socket.gethostname()}:{os.getpid()}"


def run_once(redis, owner: str) -> bool:
    db = SessionLocal()
    try:
        recover_stuck(db)
        db.commit()
    except Exception:
        db.rollback()
        log.exception("recover failed")
    finally:
        db.close()
    item = redis.blpop(queue_key(), timeout=2)
    redis.set(heartbeat_key(), owner, ex=30)
    if not item:
        return False
    _, raw = item
    try:
        job_id = uuid.UUID(raw)
    except ValueError:
        return True
    db = SessionLocal()
    try:
        process_job(db, job_id, owner, get_storage(), get_provider())
    except Exception:
        db.rollback()
        log.exception("job failed", extra={"job_id": str(job_id)})
    finally:
        db.close()
    return True


def main() -> None:
    setup_logging(get_settings().log_level)
    owner = worker_id()
    redis = client()
    while True:
        try:
            run_once(redis, owner)
        except Exception:
            log.exception("worker loop")
            time.sleep(2)


if __name__ == "__main__":
    main()
