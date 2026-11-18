import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .api import router
from .config import get_settings
from .errors import ApiError
from .generation import publish_pending
from .logging_setup import setup_logging
from .redisq import client

log = logging.getLogger("music.api")
setup_logging(get_settings().log_level)
app = FastAPI(title="ÄUEN", docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(router, prefix="/v1")


@app.exception_handler(ApiError)
def handle_api_error(_, exc: ApiError):
    return JSONResponse(status_code=exc.status, content={"error": {"code": exc.code, "params": exc.params}})


@app.exception_handler(RequestValidationError)
def handle_validation(_, __):
    return JSONResponse(status_code=422, content={"error": {"code": "error.settings", "params": {}}})


@app.exception_handler(Exception)
def handle_unexpected(request: Request, exc: Exception):
    log.exception("request failed", extra={"path": request.url.path, "method": request.method})
    return JSONResponse(status_code=500, content={"error": {"code": "error.unexpected", "params": {}}})


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", "")
    if not request_id or len(request_id) > 80 or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-" for char in request_id):
        request_id = uuid.uuid4().hex
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("request crashed", extra={"request_id": request_id, "path": request.url.path, "method": request.method})
        raise
    if getattr(request.state, "publish", False):
        try:
            publish_pending(client())
        except Exception:
            log.exception("outbox publish failed", extra={"request_id": request_id})
    response.headers["X-Request-Id"] = request_id
    response.headers["Cache-Control"] = "private, no-store"
    log.info(
        "request",
        extra={"request_id": request_id, "path": request.url.path, "method": request.method, "status": response.status_code, "ms": int((time.perf_counter() - started) * 1000)},
    )
    return response
