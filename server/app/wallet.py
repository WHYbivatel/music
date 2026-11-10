import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .errors import ApiError
from .models import Ledger, Wallet

COLUMNS = {
    "real": ("real_available", "real_reserved"),
    "test": ("test_available", "test_reserved"),
    "demo": ("demo_available", "demo_reserved"),
}


def lock_wallet(db: Session, account_id: uuid.UUID) -> Wallet:
    wallet = db.scalar(select(Wallet).where(Wallet.account_id == account_id).with_for_update())
    if not wallet:
        raise ApiError("error.balance", 409)
    return wallet


def apply_entry(
    db: Session,
    account_id: uuid.UUID,
    *,
    bucket: str,
    business_key: str,
    kind: str,
    amount: int,
    label: str,
    job_id: uuid.UUID | None = None,
    payment_id: uuid.UUID | None = None,
    display_amount: int | None = None,
) -> Ledger:
    existing = db.scalar(select(Ledger).where(Ledger.business_key == business_key))
    if existing:
        return existing
    if amount < 0:
        raise ApiError("error.balance", 400)
    wallet = lock_wallet(db, account_id)
    available_name, reserved_name = COLUMNS[bucket]
    available = getattr(wallet, available_name)
    reserved = getattr(wallet, reserved_name)
    if kind == "reserve":
        if available < amount:
            raise ApiError("error.balance", 402)
        available -= amount
        reserved += amount
        available_delta, reserved_delta = -amount, amount
        shown = -amount
    elif kind == "capture":
        if reserved < amount:
            raise ApiError("error.reserve", 409)
        reserved -= amount
        available_delta, reserved_delta = 0, -amount
        shown = -amount
    elif kind == "release":
        if reserved < amount:
            raise ApiError("error.reserve", 409)
        reserved -= amount
        available += amount
        available_delta, reserved_delta = amount, -amount
        shown = amount
    elif kind == "credit":
        available += amount
        available_delta, reserved_delta = amount, 0
        shown = amount
    else:
        raise ApiError("error.balance", 400)
    setattr(wallet, available_name, available)
    setattr(wallet, reserved_name, reserved)
    entry = Ledger(
        account_id=account_id,
        business_key=business_key,
        bucket=bucket,
        kind=kind,
        available_delta=available_delta,
        reserved_delta=reserved_delta,
        display_amount=display_amount if display_amount is not None else shown,
        label=label,
        job_id=job_id,
        payment_id=payment_id,
    )
    db.add(entry)
    db.flush()
    return entry


def spendable(account_kind: str, provider: str, real_enabled: bool) -> str:
    if account_kind == "guest":
        return "demo"
    if provider == "mock" or not real_enabled:
        return "test"
    return "real"
