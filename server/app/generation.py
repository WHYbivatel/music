import re
import uuid
from datetime import timedelta

from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .catalog import cost_tokens, request_hash
from .config import get_settings
from .errors import ApiError, ProviderError, StorageError
from .models import Job, Ledger, Outbox, Track, utcnow
from .providers import wav_duration_ms
from .redisq import queue_key
from .wallet import apply_entry, lock_wallet, spendable

KEY_RE = re.compile(r"^[A-Za-z0-9_-]{8,80}$")


def check_key(key: str) -> str:
    if not key or not KEY_RE.match(key):
        raise ApiError("error.idempotency", 400)
    return key


def create_job(db: Session, account, settings: dict, scenario: str, idempotency_key: str) -> Job:
    config = get_settings()
    key = check_key(idempotency_key)
    if scenario not in {"success", "error", "timeout"}:
        raise ApiError("error.settings", 400)
    provider_name = config.music_provider
    if provider_name == "ace":
        ready = bool(config.ace_step_base_url and config.ace_step_token and config.real_generation_enabled)
        if not ready:
            raise ApiError("error.provider", 503)
    elif provider_name != "mock":
        raise ApiError("error.provider", 503)
    if account.kind == "guest" and provider_name != "mock":
        raise ApiError("error.provider", 503)
    bucket = "demo" if account.kind == "guest" else spendable(account.kind, provider_name, config.real_generation_enabled)
    if bucket != "demo" and provider_name == "mock":
        bucket = "test"
    if bucket == "real":
        scenario = "success"
    digest = request_hash(settings, scenario)
    db.execute(text("SELECT pg_advisory_xact_lock(872233)"))
    existing = db.scalar(select(Job).where(Job.account_id == account.id, Job.idempotency_key == key))
    if existing:
        if existing.request_hash != digest:
            raise ApiError("error.conflict", 409)
        return existing
    lock_wallet(db, account.id)
    active = db.scalar(select(func.count()).select_from(Job).where(Job.account_id == account.id, Job.status.in_(("queued", "running"))))
    if active >= config.max_active_jobs:
        raise ApiError("error.wait", 409)
    day = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today = db.scalar(select(func.count()).select_from(Job).where(Job.account_id == account.id, Job.created_at >= day))
    if today >= config.daily_job_limit:
        raise ApiError("error.limit", 429)
    queued = db.scalar(select(func.count()).select_from(Job).where(Job.status.in_(("queued", "running"))))
    if queued >= config.max_queue:
        raise ApiError("error.queue", 429)
    price = cost_tokens(settings["duration"])
    job = Job(
        account_id=account.id,
        idempotency_key=key,
        request_hash=digest,
        settings=settings,
        cost=price,
        bucket=bucket,
        provider=provider_name,
        scenario=scenario,
        status="queued",
    )
    db.add(job)
    db.flush()
    apply_entry(
        db, account.id, bucket=bucket, business_key=f"job:{job.id}:reserve", kind="reserve",
        amount=price, label="op.reserve", job_id=job.id,
    )
    db.add(Outbox(job_id=job.id, payload={"jobId": str(job.id)}, available_at=utcnow()))
    return job


def requeue(db: Session, job: Job, seconds: int) -> None:
    when = utcnow() + timedelta(seconds=seconds)
    job.lease_until = utcnow()
    pending = db.scalar(select(Outbox).where(Outbox.job_id == job.id, Outbox.published_at.is_(None)))
    if pending:
        pending.available_at = when
        return
    db.add(Outbox(job_id=job.id, payload={"jobId": str(job.id)}, available_at=when))


def fail_job(db: Session, job: Job, code: str) -> None:
    current = db.scalar(select(Job).where(Job.id == job.id).with_for_update())
    if not current or current.status in {"succeeded", "failed"}:
        return
    captured = db.scalar(select(Ledger.id).where(Ledger.business_key == f"job:{current.id}:capture"))
    if not captured:
        apply_entry(
            db, current.account_id, bucket=current.bucket, business_key=f"job:{current.id}:release",
            kind="release", amount=current.cost, label="op.refund", job_id=current.id,
        )
    current.status = "failed"
    current.error_code = code
    current.finished_at = utcnow()
    current.lease_until = None


def publish_pending(redis, limit: int = 50) -> int:
    from .db import SessionLocal

    db = SessionLocal()
    sent = 0
    try:
        rows = db.scalars(
            select(Outbox).where(Outbox.published_at.is_(None), Outbox.available_at <= utcnow()).order_by(Outbox.created_at).limit(limit).with_for_update(skip_locked=True)
        ).all()
        for row in rows:
            try:
                redis.rpush(queue_key(), str(row.job_id))
            except Exception:
                break
            row.published_at = utcnow()
            row.attempts += 1
            sent += 1
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    return sent


def recover_stuck(db: Session) -> int:
    cutoff = utcnow() - timedelta(seconds=5)
    rows = db.scalars(
        select(Job).where(
            Job.status.in_(("queued", "running")),
            or_(Job.lease_until.is_(None), Job.lease_until < utcnow()),
            Job.created_at < cutoff,
        )
    ).all()
    count = 0
    for job in rows:
        pending = db.scalar(select(Outbox.id).where(Outbox.job_id == job.id, Outbox.published_at.is_(None)))
        if pending:
            continue
        requeue(db, job, 0)
        count += 1
    return count


def process_job(db: Session, job_id: uuid.UUID, owner: str, storage, provider) -> None:
    config = get_settings()
    job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
    if not job or job.status in {"succeeded", "failed"}:
        db.commit()
        return
    now = utcnow()
    if job.lease_until and job.lease_until > now and job.lease_owner and job.lease_owner != owner:
        db.commit()
        return
    job.lease_owner = owner
    job.lease_until = now + timedelta(seconds=config.lease_seconds)
    if job.status == "queued":
        job.status = "running"
        job.started_at = job.started_at or now
    age = (now - job.created_at).total_seconds()
    if job.provider_task_id is None and age > config.job_timeout_seconds:
        fail_job(db, job, "error.timeout")
        db.commit()
        return
    if job.provider_task_id and age > config.job_timeout_seconds + config.reconcile_seconds:
        fail_job(db, job, "error.providerTimeout")
        db.commit()
        return
    db.commit()

    job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
    try:
        if not job.provider_task_id:
            if job.provider != provider.name:
                fail_job(db, job, "error.provider")
                db.commit()
                return
            task_id = provider.submit(db, job.scenario, int(job.settings["duration"]))
            job.provider_task_id = task_id
            job.provider_state = "submitted"
            db.commit()
            job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
        elif job.provider_state == "needs_reconcile":
            pass
        state = provider.status(db, job.provider_task_id)
        if state in {"queued", "running"}:
            job.lease_until = utcnow() + timedelta(seconds=config.lease_seconds)
            requeue(db, job, 1)
            db.commit()
            return
        if state == "unknown":
            job.provider_state = "needs_reconcile"
            started = job.started_at or job.created_at
            if (utcnow() - started).total_seconds() >= config.reconcile_seconds:
                fail_job(db, job, "error.providerTimeout")
            else:
                requeue(db, job, 2)
            db.commit()
            return
        if state == "failed":
            fail_job(db, job, "error.generation")
            db.commit()
            return
        data = provider.result(db, job.provider_task_id)
        duration_ms = wav_duration_ms(data)
        key = f"{job.account_id}/{job.id}.wav"
        storage.put(key, data)
        if not storage.exists(key) or storage.size(key) != len(data):
            raise StorageError("verify")
        job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if job.status in {"succeeded", "failed"}:
            db.commit()
            return
        if db.scalar(select(Track.id).where(Track.job_id == job.id)):
            job.status = "succeeded"
            db.commit()
            return
        track = Track(
            account_id=job.account_id,
            job_id=job.id,
            title=(job.settings.get("title") or "Новая волна")[:120],
            format="wav",
            duration_ms=duration_ms,
            size_bytes=len(data),
            storage_key=key,
            settings=job.settings,
            tags=job.settings.get("tags") or [],
            demo=job.provider == "mock" or job.bucket != "real",
        )
        db.add(track)
        db.flush()
        apply_entry(
            db, job.account_id, bucket=job.bucket, business_key=f"job:{job.id}:capture", kind="capture",
            amount=job.cost, label="op.charge", job_id=job.id,
        )
        job.status = "succeeded"
        job.track_id = track.id
        job.finished_at = utcnow()
        job.lease_until = None
        job.error_code = None
        db.commit()
    except StorageError:
        db.rollback()
        job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if not job or job.status in {"succeeded", "failed"}:
            db.commit()
            return
        job.attempts += 1
        if job.attempts >= config.max_attempts:
            fail_job(db, job, "error.storage")
        else:
            requeue(db, job, 2)
        db.commit()
    except ProviderError as exc:
        db.rollback()
        job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if not job or job.status in {"succeeded", "failed"}:
            db.commit()
            return
        if exc.temporary:
            job.attempts += 1
            if job.attempts >= config.max_attempts:
                fail_job(db, job, exc.code)
            else:
                requeue(db, job, 2)
        else:
            fail_job(db, job, exc.code)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
