import threading
import uuid

import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import get_settings
from app.db import SessionLocal
from app.errors import StorageError
from app.generation import process_job
from app.main import app
from app.models import Account, Job, Ledger, Outbox, Track, Wallet
from app.runtime import get_provider, get_storage


def user_wallet(db, email: str) -> Wallet:
    account = db.scalar(select(Account).where(Account.email == email))
    return db.get(Wallet, account.id)


def csrf(client: TestClient) -> str:
    me = client.get("/v1/auth/me")
    assert me.status_code == 200, me.text
    return me.json()["csrfToken"]


def register(client: TestClient, email: str, password: str = "correct-horse") -> dict:
    token = csrf(client)
    response = client.post("/v1/auth/register", headers={"X-CSRF-Token": token}, json={"email": email, "password": password, "name": "Алия"})
    assert response.status_code == 201, response.text
    return response.json()


def test_register_login_logout_and_session_expiry():
    client = TestClient(app)
    created = register(client, "aliya@music.esl.kz")
    assert created["user"]["email"] == "aliya@music.esl.kz"
    me = client.get("/v1/auth/me")
    assert me.json()["user"]["name"] == "Алия"
    denied = client.patch("/v1/auth/name", json={"name": "Новое"})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "error.csrf"
    renamed = client.patch("/v1/auth/name", headers={"X-CSRF-Token": me.json()["csrfToken"]}, json={"name": "Новое имя"})
    assert renamed.status_code == 200
    assert renamed.json()["user"]["name"] == "Новое имя"
    logout = client.post("/v1/auth/logout", headers={"X-CSRF-Token": renamed.json()["csrfToken"]})
    assert logout.status_code == 204
    assert client.get("/v1/auth/me").json()["user"] is None
    logged = client.post("/v1/auth/login", json={"email": "aliya@music.esl.kz", "password": "correct-horse"})
    assert logged.status_code == 200
    db = SessionLocal()
    try:
        from app.models import Session as DbSession
        row = db.scalar(select(DbSession).where(DbSession.revoked_at.is_(None)))
        row.expires_at = row.created_at
        db.commit()
    finally:
        db.close()
    assert client.get("/v1/auth/me").json()["user"] is None
    assert client.post("/v1/auth/login", json={"email": "missing@music.esl.kz", "password": "correct-horse"}).status_code == 401
    assert client.post("/v1/auth/login", json={"email": "aliya@music.esl.kz", "password": "wrong-password"}).status_code == 401


def test_password_reset_does_not_reveal_mail_or_token(monkeypatch):
    client = TestClient(app)
    register(client, "reset@music.esl.kz")
    unknown = client.post("/v1/auth/password/forgot", json={"email": "nobody@music.esl.kz"})
    known = client.post("/v1/auth/password/forgot", json={"email": "reset@music.esl.kz"})
    assert unknown.status_code == known.status_code == 503
    assert unknown.json() == known.json()
    assert "token" not in unknown.text

    sent = {}

    class Mail:
        configured = True

        def send_password_reset(self, to, link):
            sent["to"] = to
            sent["link"] = link

    monkeypatch.setattr("app.api.get_mailer", lambda: Mail())
    response = client.post("/v1/auth/password/forgot", json={"email": "reset@music.esl.kz"})
    hidden = client.post("/v1/auth/password/forgot", json={"email": "nobody@music.esl.kz"})
    assert response.status_code == hidden.status_code == 200
    assert response.json() == hidden.json()
    assert "token=" not in response.text
    token = sent["link"].split("token=", 1)[1]
    client.post("/v1/auth/logout", headers={"X-CSRF-Token": client.get("/v1/auth/me").json()["csrfToken"]})
    reset = client.post("/v1/auth/password/reset", json={"token": token, "password": "a-new-password"})
    assert reset.status_code == 204
    assert client.post("/v1/auth/login", json={"email": "reset@music.esl.kz", "password": "correct-horse"}).status_code == 401
    assert client.post("/v1/auth/login", json={"email": "reset@music.esl.kz", "password": "a-new-password"}).status_code == 200
    assert client.post("/v1/auth/password/reset", json={"token": token, "password": "another-password-1"}).status_code == 400


def test_owner_isolation_and_admin_forbidden():
    owner = TestClient(app)
    register(owner, "owner@music.esl.kz")
    key = "idem-owner-1"
    created = owner.post("/v1/generations", headers={"Idempotency-Key": key, "X-CSRF-Token": owner.get("/v1/auth/me").json()["csrfToken"]}, json={"prompt": "тихий город ночью", "duration": 30, "tags": ["calm"]})
    assert created.status_code == 201, created.text
    job_id = created.json()["id"]
    db = SessionLocal()
    try:
        process_job(db, uuid.UUID(job_id), "test", get_storage(), get_provider())
    finally:
        db.close()
    track_id = owner.get(f"/v1/generations/{job_id}").json()["trackId"]
    audio = owner.get(f"/v1/tracks/{track_id}/stream")
    assert audio.status_code == 200
    assert audio.content[:4] == b"RIFF"
    other = TestClient(app)
    register(other, "other@music.esl.kz")
    assert other.get(f"/v1/tracks/{track_id}/stream").status_code == 404
    assert other.get(f"/v1/generations/{job_id}").status_code == 404
    assert other.get("/v1/tracks").json()["items"] == []
    assert other.get("/v1/admin/overview").status_code == 403
    download = other.get(f"/v1/tracks/{track_id}/download")
    assert download.status_code == 404


def test_idempotency_conflict_and_same_body():
    client = TestClient(app)
    register(client, "idem@music.esl.kz")
    token = client.get("/v1/auth/me").json()["csrfToken"]
    body = {"prompt": "ночная поездка", "duration": 30}
    headers = {"Idempotency-Key": "same-key-01", "X-CSRF-Token": token}
    first = client.post("/v1/generations", headers=headers, json=body)
    second = client.post("/v1/generations", headers=headers, json=body)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    conflict = client.post("/v1/generations", headers=headers, json={"prompt": "другое описание", "duration": 30})
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "error.conflict"
    db = SessionLocal()
    try:
        assert db.scalar(select(func.count()).select_from(Ledger).where(Ledger.kind == "reserve")) == 1
    finally:
        db.close()


def test_parallel_reserve_cannot_overdraw():
    client = TestClient(app)
    register(client, "race@music.esl.kz")
    db = SessionLocal()
    try:
        wallet = user_wallet(db, "race@music.esl.kz")
        wallet.test_available = 5
        wallet.test_reserved = 0
        db.commit()
        account_id = wallet.account_id
    finally:
        db.close()
    get_settings().max_active_jobs = 2
    barrier = threading.Barrier(2)
    results = []

    def once(key: str):
        session = SessionLocal()
        try:
            from app.models import Account
            account = session.get(Account, account_id)
            barrier.wait(timeout=5)
            from app.generation import create_job
            from app.catalog import validate_settings
            create_job(session, account, validate_settings({"prompt": "гонка", "duration": 30}, True), "success", key)
            session.commit()
            results.append("ok")
        except Exception as exc:
            session.rollback()
            results.append(getattr(exc, "code", type(exc).__name__))
        finally:
            session.close()

    threads = [threading.Thread(target=once, args=(f"race-key-{index}",)) for index in (1, 2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sorted(results) == ["error.balance", "ok"]
    db = SessionLocal()
    try:
        wallet = user_wallet(db, "race@music.esl.kz")
        assert wallet.test_available == 0
        assert wallet.test_reserved == 5
        assert wallet.real_available == 0
        assert db.scalar(select(func.count()).select_from(Job).where(Job.account_id == wallet.account_id)) == 1
    finally:
        db.close()
    get_settings().max_active_jobs = 1


def _run(job_id: str):
    db = SessionLocal()
    try:
        process_job(db, uuid.UUID(job_id), "worker-a", get_storage(), get_provider())
    finally:
        db.close()


def test_success_captures_once_and_error_releases_once():
    client = TestClient(app)
    register(client, "money@music.esl.kz")
    token = client.get("/v1/auth/me").json()["csrfToken"]
    ok = client.post("/v1/generations", headers={"Idempotency-Key": "money-ok-01", "X-CSRF-Token": token}, json={"prompt": "успех", "duration": 30})
    _run(ok.json()["id"])
    _run(ok.json()["id"])
    db = SessionLocal()
    try:
        wallet = user_wallet(db, "money@music.esl.kz")
        assert wallet.test_available == 195
        assert wallet.test_reserved == 0
        assert wallet.real_available == 0
        assert db.scalar(select(func.count()).select_from(Ledger).where(Ledger.kind == "capture")) == 1
        track = db.scalar(select(Track))
        assert track.demo is True
        assert track.duration_ms > 0
        assert get_storage().exists(track.storage_key)
    finally:
        db.close()
    failed = client.post("/v1/generations", headers={"Idempotency-Key": "money-bad-1", "X-CSRF-Token": token}, json={"prompt": "ошибка", "duration": 30, "scenario": "error"})
    assert failed.status_code == 201
    _run(failed.json()["id"])
    _run(failed.json()["id"])
    db = SessionLocal()
    try:
        wallet = user_wallet(db, "money@music.esl.kz")
        assert wallet.test_available == 195
        assert wallet.test_reserved == 0
        assert db.scalar(select(func.count()).select_from(Ledger).where(Ledger.kind == "release")) == 1
        assert db.scalar(select(Job).where(Job.id == uuid.UUID(failed.json()["id"]))).status == "failed"
    finally:
        db.close()


def test_payment_confirm_is_idempotent_and_does_not_touch_test_balance():
    client = TestClient(app)
    user = register(client, "pay@music.esl.kz")
    token = user["csrfToken"]
    created = client.post("/v1/payments", headers={"Idempotency-Key": "pay-key-001", "X-CSRF-Token": token}, json={"packageId": "creator"})
    assert created.status_code == 201
    assert created.json()["amountMinor"] == 3500000
    assert created.json()["tokens"] == 800
    assert created.json()["price"] == 35000
    paid = client.post(f"/v1/payments/{created.json()['id']}/paid", headers={"X-CSRF-Token": token})
    assert paid.status_code == 204
    db = SessionLocal()
    try:
        from app.models import Account
        admin = Account(kind="user", email="admin@music.esl.kz", display_name="Админ", role="admin", password_hash="x")
        db.add(admin)
        db.flush()
        db.add(Wallet(account_id=admin.id))
        db.commit()
        admin_id = admin.id
    finally:
        db.close()
    from app.security import issue_session
    db = SessionLocal()
    try:
        from app.models import Account
        admin = db.get(Account, admin_id)
        _, raw = issue_session(db, admin, "127.0.0.1", "test")
        db.commit()
        csrf_token = db.scalar(select(__import__("app.models", fromlist=["Session"]).Session).where(__import__("app.models", fromlist=["Session"]).Session.account_id == admin_id)).csrf_token
    finally:
        db.close()
    admin_client = TestClient(app)
    admin_client.cookies.set("music_session", raw)
    confirm = {"reason": "сверено вручную"}
    assert admin_client.post(f"/v1/admin/payments/{created.json()['id']}/confirm", headers={"X-CSRF-Token": csrf_token}, json=confirm).status_code == 204
    assert admin_client.post(f"/v1/admin/payments/{created.json()['id']}/confirm", headers={"X-CSRF-Token": csrf_token}, json=confirm).status_code == 204
    db = SessionLocal()
    try:
        wallet = user_wallet(db, "pay@music.esl.kz")
        assert wallet.real_available == 800
        assert wallet.test_available == 200
        assert db.scalar(select(func.count()).select_from(Ledger).where(Ledger.business_key.like("payment:%"))) == 1
    finally:
        db.close()
    outsider = TestClient(app)
    register(outsider, "plain@music.esl.kz")
    assert outsider.post(f"/v1/admin/payments/{created.json()['id']}/confirm", headers={"X-CSRF-Token": outsider.get("/v1/auth/me").json()["csrfToken"]}, json=confirm).status_code == 403


def test_redis_outage_keeps_job_and_restart_does_not_double_charge(monkeypatch):
    client = TestClient(app)
    register(client, "queue@music.esl.kz")
    token = client.get("/v1/auth/me").json()["csrfToken"]

    def fail_push(self, *args, **kwargs):
        raise redis.ConnectionError("down")

    monkeypatch.setattr(redis.Redis, "rpush", fail_push)
    created = client.post("/v1/generations", headers={"Idempotency-Key": "queue-key-1", "X-CSRF-Token": token}, json={"prompt": "очередь", "duration": 30})
    assert created.status_code == 201, created.text
    db = SessionLocal()
    try:
        job = db.scalar(select(Job))
        assert job.status == "queued"
        outbox = db.scalar(select(Outbox))
        assert outbox.published_at is None
        assert user_wallet(db, "queue@music.esl.kz").test_reserved == 5
    finally:
        db.close()
    monkeypatch.undo()
    from app.generation import publish_pending
    from app.redisq import client as redis_client
    assert publish_pending(redis_client()) == 1
    _run(created.json()["id"])
    db = SessionLocal()
    try:
        job = db.get(Job, uuid.UUID(created.json()["id"]))
        assert job.provider_task_id
        task = job.provider_task_id
        job.status = "running"
        job.finished_at = None
        job.track_id = None
        db.commit()
    finally:
        db.close()
    _run(created.json()["id"])
    db = SessionLocal()
    try:
        job = db.get(Job, uuid.UUID(created.json()["id"]))
        assert job.status == "succeeded"
        assert job.provider_task_id == task
        assert db.scalar(select(func.count()).select_from(Ledger).where(Ledger.kind == "capture")) == 1
        assert db.scalar(select(func.count()).select_from(Track)) == 1
    finally:
        db.close()


def test_storage_failure_is_not_success(monkeypatch):
    client = TestClient(app)
    register(client, "disk@music.esl.kz")
    token = client.get("/v1/auth/me").json()["csrfToken"]
    created = client.post("/v1/generations", headers={"Idempotency-Key": "disk-key-01", "X-CSRF-Token": token}, json={"prompt": "диск", "duration": 30})
    get_settings().max_attempts = 1

    def boom(self, key, data):
        raise StorageError("full")

    monkeypatch.setattr(type(get_storage()), "put", boom)
    _run(created.json()["id"])
    db = SessionLocal()
    try:
        job = db.get(Job, uuid.UUID(created.json()["id"]))
        wallet = user_wallet(db, "disk@music.esl.kz")
        assert job.status == "failed"
        assert job.error_code == "error.storage"
        assert wallet.test_reserved == 0
        assert wallet.test_available == 200
        assert db.scalar(select(func.count()).select_from(Track)) == 0
    finally:
        db.close()
    get_settings().max_attempts = 3
