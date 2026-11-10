import hashlib
import re
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .errors import ApiError
from .models import Account, Session as DbSession, utcnow

HASHER = PasswordHasher()
DUMMY_HASH = HASHER.hash("music-esl-dummy-password")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    return HASHER.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    try:
        return bool(hashed) and HASHER.verify(hashed, password)
    except VerifyMismatchError:
        return False


def check_password_shape(password: str) -> None:
    if not isinstance(password, str) or len(password) < 10 or len(password) > 200:
        raise ApiError("error.password", 400)


def normalize_email(email: str) -> str:
    value = (email or "").strip().lower()
    if not EMAIL_RE.match(value) or len(value) > 254:
        raise ApiError("error.email", 400)
    return value


def check_name(name: str) -> str:
    value = " ".join((name or "").split())
    if not value or len(value) > 80:
        raise ApiError("error.name", 400)
    return value


def client_ip(request) -> str:
    settings = get_settings()
    if settings.trust_proxy:
        real = request.headers.get("x-real-ip", "").strip()
        if real:
            return real[:64]
    host = request.client.host if request.client else ""
    return (host or "unknown")[:64]


def rate_limit(redis, action: str, identity: str, limit: int, window: int) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    key = f"{settings.redis_prefix}:rl:{action}:{identity}"
    try:
        count = redis.incr(key)
        if count == 1:
            redis.expire(key, window)
    except Exception as exc:
        raise ApiError("error.unavailable", 503) from exc
    if count > limit:
        raise ApiError("error.rate", 429)


def load_session(db: Session, raw: str | None) -> DbSession | None:
    if not raw:
        return None
    row = db.scalar(select(DbSession).where(DbSession.token_hash == token_hash(raw)))
    if not row or row.revoked_at or row.expires_at <= utcnow():
        return None
    return row


def load_guest(db: Session, raw: str | None) -> Account | None:
    if not raw:
        return None
    return db.scalar(select(Account).where(Account.kind == "guest", Account.guest_token_hash == token_hash(raw)))


def issue_session(db: Session, account: Account, ip: str, user_agent: str) -> tuple[DbSession, str]:
    raw = new_token()
    row = DbSession(
        account_id=account.id,
        token_hash=token_hash(raw),
        csrf_token=new_token(),
        expires_at=utcnow() + timedelta(days=get_settings().session_days),
        ip=ip[:64],
        user_agent=(user_agent or "")[:200],
    )
    db.add(row)
    account.last_seen_at = utcnow()
    return row, raw


def revoke_sessions(db: Session, account_id, keep: DbSession | None = None) -> None:
    rows = db.scalars(select(DbSession).where(DbSession.account_id == account_id, DbSession.revoked_at.is_(None))).all()
    now = utcnow()
    for row in rows:
        if keep and row.id == keep.id:
            continue
        row.revoked_at = now
