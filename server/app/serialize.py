import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Account, AdminAudit, Job, Ledger, Payment, Track, Wallet


def ms(value) -> int:
    return int(value.timestamp() * 1000) if value else 0


def job_json(job: Job) -> dict:
    return {
        "id": str(job.id),
        "key": job.idempotency_key,
        "settings": job.settings,
        "status": job.status,
        "created": ms(job.created_at),
        "cost": job.cost,
        "fail": job.scenario == "error",
        "trackId": str(job.track_id) if job.track_id else None,
        "errorCode": job.error_code,
        "demo": job.bucket != "real",
        "bucket": job.bucket,
        "provider": job.provider,
    }


def track_json(track: Track) -> dict:
    return {
        "id": str(track.id),
        "title": track.title,
        "created": ms(track.created_at),
        "settings": track.settings,
        "cover": (track.id.int % 4) + 1,
        "favorite": track.favorite,
        "audioUrl": f"/v1/tracks/{track.id}/stream",
        "demo": track.demo,
        "durationMs": track.duration_ms,
    }


def payment_json(payment: Payment) -> dict:
    return {
        "id": str(payment.id),
        "packageId": payment.package_id,
        "status": payment.status,
        "created": ms(payment.created_at),
        "price": payment.amount_minor // 100,
        "amountMinor": payment.amount_minor,
        "currency": payment.currency,
        "tokens": payment.tokens,
        "test": payment.test,
    }


def balance_json(wallet: Wallet, spendable: str) -> dict:
    bucket = {
        "real": (wallet.real_available, wallet.real_reserved),
        "test": (wallet.test_available, wallet.test_reserved),
        "demo": (wallet.demo_available, wallet.demo_reserved),
    }[spendable]
    return {
        "available": bucket[0],
        "reserved": bucket[1],
        "realAvailable": wallet.real_available,
        "realReserved": wallet.real_reserved,
        "testAvailable": wallet.test_available,
        "testReserved": wallet.test_reserved,
        "demoAvailable": wallet.demo_available,
        "demoReserved": wallet.demo_reserved,
        "spendable": spendable,
    }


def operation_json(row: Ledger) -> dict:
    kind = {"reserve": "reserve", "capture": "generation", "release": "refund", "credit": "topup"}[row.kind]
    return {"id": str(row.id), "kind": kind, "amount": row.display_amount, "label": row.label, "created": ms(row.created_at), "bucket": row.bucket}


def visible_operations(db: Session, account_id: uuid.UUID, limit: int, cursor: str | None) -> dict:
    query = select(Ledger).where(Ledger.account_id == account_id)
    if cursor:
        current = db.get(Ledger, uuid.UUID(cursor))
        if current and current.account_id == account_id:
            query = query.where(Ledger.created_at < current.created_at)
    rows = db.scalars(query.order_by(Ledger.created_at.desc()).limit(400)).all()
    closed = {row.job_id for row in rows if row.kind in {"capture", "release"} and row.job_id}
    items = []
    for row in rows:
        if row.kind == "reserve" and row.job_id in closed:
            continue
        items.append(operation_json(row))
        if len(items) > limit:
            break
    page = items[:limit]
    return {"items": page, "nextCursor": page[-1]["id"] if len(items) > limit else None}


def audit_json(db: Session, row: AdminAudit) -> dict:
    actor = db.get(Account, row.actor_id) if row.actor_id else None
    return {
        "id": str(row.id),
        "action": row.action,
        "summary": row.action,
        "actor": {
            "name": (actor.display_name if actor else "") or "—",
            "email": (actor.email if actor else "") or "—",
            "role": actor.role if actor else "system",
        },
        "created": ms(row.created_at),
        "entity": row.entity_id,
        "amount": None if row.amount_minor is None else row.amount_minor // 100,
        "tokens": row.tokens,
        "source": "server",
        "outcome": row.outcome,
    }
