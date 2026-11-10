import hashlib
import hmac
import re
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .catalog import DEFAULT_DRAFT, PACKAGES, minor_units, request_hash, validate_settings
from .config import get_settings
from .db import SessionLocal
from .errors import ApiError
from .generation import check_key, create_job
from .mailer import get_mailer
from .models import Account, AdminAudit, Job, PasswordReset, Payment, Session as DbSession, Track, UserSettings, Wallet, utcnow
from .providers import provider_status_public
from urllib.parse import quote

from .security import (
    DUMMY_HASH, check_name, check_password_shape, client_ip, hash_password, issue_session, load_guest, load_session,
    new_token, normalize_email, rate_limit, revoke_sessions, token_hash, verify_password,
)
from .serialize import audit_json, balance_json, job_json, ms, payment_json, track_json, visible_operations
from .wallet import apply_entry, lock_wallet, spendable

router = APIRouter()
CSRF_EXEMPT = {"/v1/auth/login", "/v1/auth/register", "/v1/auth/password/forgot", "/v1/auth/password/reset"}
RANGE_RE = re.compile(r"^bytes=(\d+)-(\d*)$")


def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_redis():
    from .redisq import client
    return client()


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str
    password: str


class RegisterBody(LoginBody):
    name: str


class NameBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str


class ForgotBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str


class ResetBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str
    password: str


class PasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current: str
    password: str


class DraftBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    prompt: str = ""
    tags: list = []
    vocal: bool = False
    duration: int = 120
    genre: str = "auto"
    purpose: str = "video"
    mood: str = "calm"
    tempo: str = "auto"
    instruments: list = []
    language: str = "ru"
    lyricsMode: str = "auto"
    lyrics: str = ""
    title: str = ""


class GenerationBody(DraftBody):
    scenario: str = "success"


class PaymentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    packageId: str


class TrackPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = None
    favorite: bool | None = None


class ReasonBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str


def cookie_flags() -> dict:
    settings = get_settings()
    return {"httponly": True, "secure": settings.cookie_secure, "samesite": "lax", "path": "/"}


def set_session_cookie(response: Response, raw: str) -> None:
    response.set_cookie("music_session", raw, max_age=get_settings().session_days * 86400, **cookie_flags())


def set_guest_cookie(response: Response, raw: str) -> None:
    response.set_cookie("music_guest", raw, max_age=30 * 86400, **cookie_flags())


def principal(request: Request, db: Session) -> tuple[Account | None, DbSession | None]:
    session = load_session(db, request.cookies.get("music_session"))
    if session:
        account = db.get(Account, session.account_id)
        return account, session
    return load_guest(db, request.cookies.get("music_guest")), None


def enforce_csrf(request: Request, account: Account | None, session: DbSession | None) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"} or request.url.path in CSRF_EXEMPT:
        return
    sent = request.headers.get("x-csrf-token", "")
    expected = session.csrf_token if session else (account.csrf_token if account else "")
    if not expected or not hmac.compare_digest(sent, expected):
        raise ApiError("error.csrf", 403)


def require_user(account: Account | None) -> Account:
    if not account or account.kind != "user":
        raise ApiError("error.unauthorized", 401)
    return account


def require_admin(account: Account | None) -> Account:
    user = require_user(account)
    if user.role != "admin":
        raise ApiError("error.forbidden", 403)
    return user


def context(request: Request, db: Session = Depends(get_db)):
    if request.headers.get("content-length") and int(request.headers.get("content-length") or 0) > 65536:
        raise ApiError("error.settings", 413)
    account, session = principal(request, db)
    enforce_csrf(request, account, session)
    request.state.account = account
    request.state.session = session
    return account, session, db


def open_guest(db: Session) -> tuple[Account, str]:
    settings = get_settings()
    raw = new_token()
    account = Account(kind="guest", display_name="", role="user", guest_token_hash=token_hash(raw), csrf_token=new_token())
    db.add(account)
    db.flush()
    db.add(Wallet(account_id=account.id))
    db.flush()
    if settings.demo_tokens > 0:
        apply_entry(db, account.id, bucket="demo", business_key=f"demo-grant:{account.id}", kind="credit", amount=settings.demo_tokens, label="op.demoGrant")
    db.add(UserSettings(account_id=account.id, draft=dict(DEFAULT_DRAFT)))
    return account, raw


def wallet_of(db: Session, account: Account) -> Wallet:
    wallet = db.get(Wallet, account.id)
    if not wallet:
        raise ApiError("error.balance", 409)
    return wallet


def current_bucket(account: Account) -> str:
    settings = get_settings()
    if account.kind == "guest":
        return "demo"
    return "test" if settings.music_provider == "mock" or not settings.real_generation_enabled else spendable(account.kind, settings.music_provider, settings.real_generation_enabled)


def user_json(account: Account) -> dict:
    return {"id": str(account.id), "name": account.display_name, "email": account.email, "role": account.role}


def draft_of(db: Session, account: Account) -> dict:
    row = db.get(UserSettings, account.id)
    return row.draft if row else dict(DEFAULT_DRAFT)


def save_draft(db: Session, account: Account, raw: dict) -> dict:
    settings = validate_settings({**DEFAULT_DRAFT, **raw}, require_prompt=False)
    row = db.get(UserSettings, account.id)
    if not row:
        row = UserSettings(account_id=account.id, draft=settings, updated_at=utcnow())
        db.add(row)
    else:
        row.draft = settings
        row.updated_at = utcnow()
    return settings


def audit(db: Session, actor: Account | None, action: str, entity: str | None, outcome: str, reason: str | None = None, amount_minor: int | None = None, tokens: int | None = None) -> None:
    db.add(AdminAudit(actor_id=actor.id if actor else None, action=action, entity_id=entity, outcome=outcome, reason=reason, amount_minor=amount_minor, tokens=tokens, meta={}))


def own_track(db: Session, account: Account, track_id: uuid.UUID) -> Track:
    track = db.get(Track, track_id)
    if not track or track.deleted_at or track.account_id != account.id:
        raise ApiError("error.track", 404)
    return track


def sign_track(track_id: uuid.UUID, exp: int) -> str:
    message = f"{track_id}.{exp}".encode()
    return hmac.new(get_settings().secret_key.encode(), message, hashlib.sha256).hexdigest()


@router.get("/health/live")
def live():
    return {"status": "live"}


@router.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    db.execute(select(1))
    try:
        get_redis().ping()
    except Exception as exc:
        raise ApiError("error.unavailable", 503) from exc
    storage_ok = get_settings().storage_backend == "local"
    return {"status": "ready", "storage": get_settings().storage_backend, "provider": provider_status_public(get_settings()), "storageWritable": storage_ok}


@router.get("/auth/me")
def me(response: Response, ctx=Depends(context)):
    account, session, db = ctx
    created = False
    guest_token = None
    if not account:
        account, guest_token = open_guest(db)
        created = True
    account.last_seen_at = utcnow()
    if created and guest_token:
        set_guest_cookie(response, guest_token)
    csrf = session.csrf_token if session else account.csrf_token
    settings = get_settings()
    return {
        "user": None if account.kind != "user" else user_json(account),
        "guest": account.kind == "guest",
        "csrfToken": csrf,
        "balance": balance_json(wallet_of(db, account), current_bucket(account)),
        "draft": draft_of(db, account),
        "provider": provider_status_public(settings),
        "mail": {"resetAvailable": get_mailer().configured},
        "payments": {"transfersEnabled": settings.real_transfers_enabled, "creditEnabled": settings.payment_credit_enabled},
        "sessionExpires": ms(session.expires_at) if session else None,
    }


@router.post("/auth/register", status_code=201)
def register(body: RegisterBody, request: Request, response: Response, ctx=Depends(context)):
    _, _, db = ctx
    settings = get_settings()
    ip = client_ip(request)
    rate_limit(get_redis(), "register", ip, 5, 3600)
    email = normalize_email(body.email)
    name = check_name(body.name)
    check_password_shape(body.password)
    if db.scalar(select(Account.id).where(Account.email == email)):
        raise ApiError("error.emailTaken", 409)
    account = Account(kind="user", email=email, display_name=name, role="user", password_hash=hash_password(body.password), password_changed_at=utcnow())
    db.add(account)
    db.flush()
    db.add(Wallet(account_id=account.id))
    db.flush()
    if settings.test_signup_tokens > 0:
        apply_entry(db, account.id, bucket="test", business_key=f"signup-test:{account.id}", kind="credit", amount=settings.test_signup_tokens, label="op.testGrant")
    if settings.signup_bonus_tokens > 0:
        apply_entry(db, account.id, bucket="real", business_key=f"signup-bonus:{account.id}", kind="credit", amount=settings.signup_bonus_tokens, label="op.bonus")
    db.add(UserSettings(account_id=account.id, draft=dict(DEFAULT_DRAFT)))
    row, raw = issue_session(db, account, ip, request.headers.get("user-agent", ""))
    audit(db, account, "auth.login", str(account.id), "success")
    set_session_cookie(response, raw)
    return {"user": user_json(account), "csrfToken": row.csrf_token}


@router.post("/auth/login")
def login(body: LoginBody, request: Request, response: Response, ctx=Depends(context)):
    _, _, db = ctx
    ip = client_ip(request)
    email = normalize_email(body.email)
    rate_limit(get_redis(), "login", f"{ip}:{token_hash(email)[:16]}", 8, 900)
    account = db.scalar(select(Account).where(Account.kind == "user", Account.email == email))
    matches = bool(account) and verify_password(body.password, account.password_hash)
    if not account:
        verify_password(body.password, DUMMY_HASH)
    if not matches:
        raise ApiError("error.credentials", 401)
    row, raw = issue_session(db, account, ip, request.headers.get("user-agent", ""))
    audit(db, account, "auth.login", str(account.id), "success")
    set_session_cookie(response, raw)
    return {"user": user_json(account), "csrfToken": row.csrf_token}


@router.post("/auth/logout", status_code=204)
def logout(response: Response, ctx=Depends(context)):
    account, session, db = ctx
    if session:
        session.revoked_at = utcnow()
        if account:
            audit(db, account, "auth.logout", str(account.id), "success")
    response.delete_cookie("music_session", path="/")
    return Response(status_code=204)


@router.patch("/auth/name")
def rename(body: NameBody, ctx=Depends(context)):
    account, session, db = ctx
    user = require_user(account)
    user.display_name = check_name(body.name)
    user.updated_at = utcnow()
    return {"user": user_json(user), "csrfToken": session.csrf_token}


@router.post("/auth/password")
def change_password(body: PasswordBody, request: Request, response: Response, ctx=Depends(context)):
    account, session, db = ctx
    user = require_user(account)
    check_password_shape(body.password)
    if not verify_password(body.current, user.password_hash):
        raise ApiError("error.credentials", 401)
    user.password_hash = hash_password(body.password)
    user.password_changed_at = utcnow()
    revoke_sessions(db, user.id)
    row, raw = issue_session(db, user, client_ip(request), request.headers.get("user-agent", ""))
    set_session_cookie(response, raw)
    return {"user": user_json(user), "csrfToken": row.csrf_token}


@router.post("/auth/sessions/revoke-others", status_code=204)
def revoke_others(ctx=Depends(context)):
    account, session, db = ctx
    user = require_user(account)
    revoke_sessions(db, user.id, keep=session)
    return Response(status_code=204)


@router.post("/auth/password/forgot")
def forgot(body: ForgotBody, request: Request, ctx=Depends(context)):
    _, _, db = ctx
    rate_limit(get_redis(), "forgot", client_ip(request), 5, 3600)
    mailer = get_mailer()
    if not mailer.configured:
        raise ApiError("error.mail", 503)
    try:
        email = normalize_email(body.email)
    except ApiError:
        return {"ok": True, "code": "auth.reset.accepted"}
    account = db.scalar(select(Account).where(Account.kind == "user", Account.email == email))
    if account:
        raw = new_token()
        db.add(PasswordReset(account_id=account.id, token_hash=token_hash(raw), expires_at=utcnow() + timedelta(minutes=get_settings().reset_minutes)))
        link = f"{get_settings().public_base_url}/reset?token={raw}"
        try:
            mailer.send_password_reset(email, link)
        except Exception as exc:
            raise ApiError("error.mail", 503) from exc
    return {"ok": True, "code": "auth.reset.accepted"}


@router.post("/auth/password/reset", status_code=204)
def reset_password(body: ResetBody, ctx=Depends(context)):
    _, _, db = ctx
    check_password_shape(body.password)
    row = db.scalar(select(PasswordReset).where(PasswordReset.token_hash == token_hash(body.token)))
    if not row or row.used_at or row.expires_at <= utcnow():
        raise ApiError("error.reset", 400)
    account = db.get(Account, row.account_id)
    if not account or account.kind != "user":
        raise ApiError("error.reset", 400)
    account.password_hash = hash_password(body.password)
    account.password_changed_at = utcnow()
    row.used_at = utcnow()
    revoke_sessions(db, account.id)
    return Response(status_code=204)


@router.get("/draft")
def get_draft(ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    return {"draft": draft_of(db, account)}


@router.put("/draft")
def put_draft(body: DraftBody, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    return {"draft": save_draft(db, account, body.model_dump())}


@router.post("/draft/import")
def import_draft(body: DraftBody, ctx=Depends(context)):
    account, _, db = ctx
    require_user(account)
    return {"draft": save_draft(db, account, body.model_dump())}


@router.post("/generations", status_code=201)
def post_generation(body: GenerationBody, request: Request, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    settings = validate_settings(body.model_dump(), require_prompt=True)
    digest = request_hash(settings, body.scenario if body.scenario in {"success", "error", "timeout"} else "success")
    try:
        job = create_job(db, account, settings, body.scenario, request.headers.get("idempotency-key", ""))
    except IntegrityError:
        db.rollback()
        existing = db.scalar(select(Job).where(Job.account_id == account.id, Job.idempotency_key == request.headers.get("idempotency-key", "")))
        if existing:
            if existing.request_hash != digest:
                raise ApiError("error.conflict", 409)
            request.state.publish = True
            return job_json(existing)
        raise ApiError("error.wait", 409)
    audit(db, account, "generation.created", str(job.id), "pending", tokens=job.cost)
    request.state.publish = True
    return job_json(job)


@router.get("/generations/active")
def active_generation(ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        return None
    job = db.scalar(select(Job).where(Job.account_id == account.id, Job.status.in_(("queued", "running"))).order_by(Job.created_at.desc()))
    return job_json(job) if job else None


@router.get("/generations/{job_id}")
def generation_status(job_id: uuid.UUID, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    job = db.get(Job, job_id)
    if not job or job.account_id != account.id:
        raise ApiError("error.job", 404)
    return job_json(job)


@router.get("/generations")
def generation_list(ctx=Depends(context), limit: int = 20, cursor: str | None = None):
    account, _, db = ctx
    if not account:
        return {"items": [], "nextCursor": None}
    limit = min(max(limit, 1), 100)
    query = select(Job).where(Job.account_id == account.id)
    if cursor:
        query = query.where(Job.created_at < db.get(Job, uuid.UUID(cursor)).created_at)
    rows = db.scalars(query.order_by(Job.created_at.desc()).limit(limit + 1)).all()
    page = rows[:limit]
    return {"items": [job_json(row) for row in page], "nextCursor": str(page[-1].id) if len(rows) > limit else None}


@router.get("/tracks")
def list_tracks(ctx=Depends(context), q: str = "", sort: str = "new", filter: str = "all", limit: int = 50, cursor: str | None = None):
    account, _, db = ctx
    if not account:
        return {"items": [], "nextCursor": None}
    limit = min(max(limit, 1), 100)
    query = select(Track).where(Track.account_id == account.id, Track.deleted_at.is_(None))
    if q:
        query = query.where(Track.title.ilike(f"%{q[:80]}%"))
    if filter == "favorite":
        query = query.where(Track.favorite.is_(True))
    elif filter == "vocal":
        query = query.where(Track.settings["vocal"].astext == "true")
    elif filter == "instrumental":
        query = query.where(or_(Track.settings["vocal"].astext == "false", Track.settings["vocal"].astext.is_(None)))
    if cursor:
        current = own_track(db, account, uuid.UUID(cursor))
        query = query.where(Track.created_at < current.created_at if sort != "old" else Track.created_at > current.created_at)
    order = Track.created_at.asc() if sort == "old" else Track.created_at.desc()
    rows = db.scalars(query.order_by(order).limit(limit + 1)).all()
    page = rows[:limit]
    return {"items": [track_json(row) for row in page], "nextCursor": str(page[-1].id) if len(rows) > limit else None}


@router.patch("/tracks/{track_id}", status_code=204)
def patch_track(track_id: uuid.UUID, body: TrackPatch, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    track = own_track(db, account, track_id)
    if body.title is not None:
        title = body.title.strip()
        if not title or len(title) > 120:
            raise ApiError("error.settings", 400)
        track.title = title
    if body.favorite is not None:
        track.favorite = body.favorite
    return Response(status_code=204)


@router.delete("/tracks/{track_id}", status_code=204)
def delete_track(track_id: uuid.UUID, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    track = own_track(db, account, track_id)
    track.deleted_at = utcnow()
    from .runtime import get_storage
    try:
        get_storage().delete(track.storage_key)
    except Exception:
        pass
    return Response(status_code=204)


def stream_file(storage, track: Track, request: Request, download_name: str | None = None):
    size = storage.size(track.storage_key)
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "Content-Type": "audio/wav"}
    if download_name:
        headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{download_name}"
    range_header = request.headers.get("range")
    if not range_header:
        from fastapi.responses import Response as Raw
        return Raw(content=storage.get(track.storage_key), headers={**headers, "Content-Length": str(size)})
    match = RANGE_RE.match(range_header.strip())
    if not match:
        raise ApiError("error.settings", 416)
    start = int(match.group(1))
    end = int(match.group(2) or size - 1)
    end = min(end, size - 1)
    if start > end or start >= size:
        raise ApiError("error.settings", 416)
    data = storage.get_range(track.storage_key, start, end)
    from fastapi.responses import Response as Raw
    return Raw(content=data, status_code=206, headers={**headers, "Content-Range": f"bytes {start}-{end}/{size}", "Content-Length": str(len(data))})


@router.get("/tracks/{track_id}/stream")
def stream_track(track_id: uuid.UUID, request: Request, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    track = own_track(db, account, track_id)
    from .runtime import get_storage
    return stream_file(get_storage(), track, request)


@router.get("/tracks/{track_id}/download")
def download_meta(track_id: uuid.UUID, ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    track = own_track(db, account, track_id)
    exp = int(utcnow().timestamp()) + 120
    signature = sign_track(track.id, exp)
    return {"url": f"/v1/tracks/{track.id}/file?exp={exp}&sig={signature}"}


@router.get("/tracks/{track_id}/file")
def download_file(track_id: uuid.UUID, exp: int, sig: str, request: Request, db: Session = Depends(get_db)):
    expected = sign_track(track_id, exp)
    if exp < int(utcnow().timestamp()) or not hmac.compare_digest(sig, expected):
        raise ApiError("error.track", 403)
    track = db.get(Track, track_id)
    if not track or track.deleted_at:
        raise ApiError("error.track", 404)
    name = quote(re.sub(r"[\\/:*?\"<>|]+", "_", track.title).strip() or "track")
    from .runtime import get_storage
    return stream_file(get_storage(), track, request, f"{name}.wav")


@router.get("/balance")
def balance(ctx=Depends(context)):
    account, _, db = ctx
    if not account:
        raise ApiError("error.unauthorized", 401)
    return balance_json(wallet_of(db, account), current_bucket(account))


@router.get("/balance/operations")
def operations(ctx=Depends(context), limit: int = 50, cursor: str | None = None):
    account, _, db = ctx
    if not account:
        return {"items": [], "nextCursor": None}
    return visible_operations(db, account.id, min(max(limit, 1), 100), cursor)


@router.get("/payments")
def list_payments(ctx=Depends(context)):
    account, _, db = ctx
    if not account or account.kind != "user":
        return []
    rows = db.scalars(select(Payment).where(Payment.account_id == account.id).order_by(Payment.created_at.desc()).limit(100)).all()
    return [payment_json(row) for row in rows]


@router.post("/payments", status_code=201)
def create_payment(body: PaymentBody, request: Request, ctx=Depends(context)):
    account, _, db = ctx
    user = require_user(account)
    package = PACKAGES.get(body.packageId)
    if not package:
        raise ApiError("error.package", 400)
    key = check_key(request.headers.get("idempotency-key", ""))
    existing = db.scalar(select(Payment).where(Payment.account_id == user.id, Payment.idempotency_key == key))
    if existing:
        if existing.package_id != body.packageId:
            raise ApiError("error.conflict", 409)
        return payment_json(existing)
    payment = Payment(
        account_id=user.id,
        idempotency_key=key,
        package_id=body.packageId,
        amount_minor=minor_units(package["price"]),
        tokens=package["tokens"],
        currency="KZT",
        test=False,
        expires_at=utcnow() + timedelta(hours=get_settings().payment_ttl_hours),
    )
    db.add(payment)
    db.flush()
    audit(db, user, "payment.created", str(payment.id), "pending", amount_minor=payment.amount_minor, tokens=payment.tokens)
    return payment_json(payment)


@router.post("/payments/{payment_id}/paid", status_code=204)
def mark_paid(payment_id: uuid.UUID, ctx=Depends(context)):
    account, _, db = ctx
    user = require_user(account)
    payment = db.scalar(select(Payment).where(Payment.id == payment_id, Payment.account_id == user.id).with_for_update())
    if not payment:
        raise ApiError("error.payment", 404)
    if payment.status == "awaiting_payment":
        payment.status = "pending_review"
        payment.paid_at = utcnow()
        audit(db, user, "payment.submitted", str(payment.id), "pending", amount_minor=payment.amount_minor, tokens=payment.tokens)
    return Response(status_code=204)


@router.post("/payments/{payment_id}/cancel", status_code=204)
def cancel_payment(payment_id: uuid.UUID, ctx=Depends(context)):
    account, _, db = ctx
    user = require_user(account)
    payment = db.scalar(select(Payment).where(Payment.id == payment_id, Payment.account_id == user.id).with_for_update())
    if not payment:
        raise ApiError("error.payment", 404)
    if payment.status == "awaiting_payment":
        payment.status = "cancelled"
    return Response(status_code=204)


@router.get("/admin/session")
def admin_session(ctx=Depends(context)):
    account, _, _ = ctx
    try:
        admin = require_admin(account)
    except ApiError:
        return None
    return {"name": admin.display_name, "email": admin.email, "role": "admin"}


@router.post("/admin/logout", status_code=204)
def admin_logout(response: Response, ctx=Depends(context)):
    return logout(response, ctx)


@router.get("/admin/overview")
def overview(ctx=Depends(context)):
    account, _, db = ctx
    require_admin(account)
    users = db.scalars(select(Account).where(Account.kind == "user").order_by(Account.created_at.desc()).limit(100)).all()
    user_rows = []
    for user in users:
        wallet = db.get(Wallet, user.id)
        spent = db.scalar(select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(Payment.account_id == user.id, Payment.status == "confirmed")) or 0
        generations = db.scalar(select(func.count()).select_from(Job).where(Job.account_id == user.id, Job.status == "succeeded")) or 0
        user_rows.append({
            "id": str(user.id), "name": user.display_name, "email": user.email, "balance": wallet.real_available if wallet else 0,
            "testBalance": wallet.test_available if wallet else 0, "spent": int(spent) // 100, "generations": generations,
            "lastSeen": ms(user.last_seen_at), "source": "server",
        })
    payments = db.scalars(select(Payment).order_by(Payment.created_at.desc()).limit(100)).all()
    payment_rows = []
    for payment in payments:
        owner = db.get(Account, payment.account_id)
        payment_rows.append({**payment_json(payment), "customer": {"name": owner.display_name if owner else "—", "email": owner.email if owner else "—", "role": "user"}, "source": "server"})
    audits = db.scalars(select(AdminAudit).order_by(AdminAudit.created_at.desc()).limit(200)).all()
    jobs = db.scalars(select(Job).order_by(Job.created_at.desc()).limit(100)).all()
    queued = db.scalar(select(func.count()).select_from(Job).where(Job.status == "queued")) or 0
    running = db.scalar(select(func.count()).select_from(Job).where(Job.status == "running")) or 0
    stuck = db.scalar(select(func.count()).select_from(Job).where(Job.status == "running", Job.lease_until < utcnow())) or 0
    day = utcnow() - timedelta(days=1)
    failed = db.scalar(select(func.count()).select_from(Job).where(Job.status == "failed", Job.finished_at >= day)) or 0
    from .models import Outbox
    pending_outbox = db.scalar(select(func.count()).select_from(Outbox).where(Outbox.published_at.is_(None))) or 0
    durations = db.scalars(select(Job).where(Job.status == "succeeded", Job.finished_at.is_not(None), Job.started_at.is_not(None), Job.finished_at >= day)).all()
    samples = [int((row.finished_at - row.started_at).total_seconds()) for row in durations]
    return {
        "users": user_rows,
        "payments": payment_rows,
        "audit": [audit_json(db, row) for row in audits],
        "jobs": [job_json(row) for row in jobs],
        "queue": {"queued": queued, "running": running, "stuck": stuck, "failedDay": failed, "outboxPending": pending_outbox, "avgSeconds": int(sum(samples) / len(samples)) if samples else 0},
    }


def decide_payment(db: Session, admin: Account, payment_id: uuid.UUID, action: str, reason: str) -> None:
    reason = " ".join(reason.split())
    if len(reason) < 3 or len(reason) > 500:
        raise ApiError("error.reason", 400)
    payment = db.scalar(select(Payment).where(Payment.id == payment_id).with_for_update())
    if not payment:
        raise ApiError("error.payment", 404)
    if action == "confirm" and payment.status == "confirmed":
        return
    if action == "reject" and payment.status == "rejected":
        return
    if payment.status != "pending_review":
        raise ApiError("error.payment", 409)
    payment.reviewed_by = admin.id
    payment.reviewed_at = utcnow()
    payment.review_reason = reason
    if action == "reject":
        payment.status = "rejected"
        audit(db, admin, "payment.rejected", str(payment.id), "error", reason=reason, amount_minor=payment.amount_minor, tokens=payment.tokens)
        return
    payment.status = "confirmed"
    if payment.test or not get_settings().payment_credit_enabled:
        audit(db, admin, "payment.confirmed", str(payment.id), "success", reason=reason, amount_minor=payment.amount_minor, tokens=0)
        return
    apply_entry(db, payment.account_id, bucket="real", business_key=f"payment:{payment.id}:credit", kind="credit", amount=payment.tokens, label="op.topup", payment_id=payment.id)
    audit(db, admin, "payment.confirmed", str(payment.id), "success", reason=reason, amount_minor=payment.amount_minor, tokens=payment.tokens)


@router.post("/admin/payments/{payment_id}/confirm", status_code=204)
def confirm_payment(payment_id: uuid.UUID, body: ReasonBody, ctx=Depends(context)):
    account, _, db = ctx
    decide_payment(db, require_admin(account), payment_id, "confirm", body.reason)
    return Response(status_code=204)


@router.post("/admin/payments/{payment_id}/reject", status_code=204)
def reject_payment(payment_id: uuid.UUID, body: ReasonBody, ctx=Depends(context)):
    account, _, db = ctx
    decide_payment(db, require_admin(account), payment_id, "reject", body.reason)
    return Response(status_code=204)


@router.get("/admin/metrics")
def metrics(ctx=Depends(context)):
    account, _, db = ctx
    require_admin(account)
    data = overview(ctx)
    return data["queue"]
