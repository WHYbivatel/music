import logging
import time
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select

from .config import get_settings
from .db import SessionLocal
from .generation import publish_pending, recover_stuck
from .logging_setup import setup_logging
from .models import PasswordReset, Payment, Session as DbSession, Track, utcnow
from .redisq import client
from .runtime import get_storage

log = logging.getLogger("music.dispatcher")


def expire_payments(db) -> None:
    rows = db.scalars(select(Payment).where(Payment.status == "awaiting_payment", Payment.expires_at < utcnow())).all()
    for row in rows:
        row.status = "expired"


def cleanup(db) -> None:
    cutoff = utcnow() - timedelta(days=7)
    db.query(PasswordReset).filter(PasswordReset.expires_at < cutoff).delete(synchronize_session=False)
    db.query(DbSession).filter(DbSession.revoked_at.is_not(None), DbSession.revoked_at < utcnow() - timedelta(days=30)).delete(synchronize_session=False)
    storage = get_storage()
    deleted = db.scalars(select(Track).where(Track.deleted_at.is_not(None), Track.deleted_at < utcnow() - timedelta(hours=1))).all()
    for track in deleted:
        try:
            storage.delete(track.storage_key)
        except Exception:
            log.exception("file delete failed", extra={"job_id": str(track.job_id or track.id)})
    if hasattr(storage, "root"):
        known = {row.storage_key for row in db.scalars(select(Track.storage_key)).all()}
        for key in storage.orphan_keys(known):
            path = Path(storage.root) / key
            if path.is_file() and (time.time() - path.stat().st_mtime) > 86400:
                storage.delete(key)
        for tmp in Path(storage.root).rglob("*.tmp"):
            if tmp.is_file() and (time.time() - tmp.stat().st_mtime) > 86400:
                tmp.unlink()


def cycle(redis) -> None:
    db = SessionLocal()
    try:
        recover_stuck(db)
        expire_payments(db)
        db.commit()
    except Exception:
        db.rollback()
        log.exception("dispatch maintenance failed")
    finally:
        db.close()
    publish_pending(redis)
    db = SessionLocal()
    try:
        cleanup(db)
        db.commit()
    except Exception:
        db.rollback()
        log.exception("cleanup failed")
    finally:
        db.close()


def main() -> None:
    setup_logging(get_settings().log_level)
    redis = client()
    last_cleanup = 0.0
    while True:
        started = time.time()
        try:
            db = SessionLocal()
            try:
                recover_stuck(db)
                expire_payments(db)
                if time.time() - last_cleanup > 3600:
                    cleanup(db)
                    last_cleanup = time.time()
                db.commit()
            except Exception:
                db.rollback()
                log.exception("dispatch maintenance failed")
            finally:
                db.close()
            publish_pending(redis)
        except Exception:
            log.exception("dispatcher loop")
        time.sleep(max(1, 2 - (time.time() - started)))


if __name__ == "__main__":
    main()
