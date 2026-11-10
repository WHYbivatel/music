import uuid
from datetime import timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .errors import ProviderError
from .models import ProviderTask, utcnow


def wav_duration_ms(data: bytes) -> int:
    if len(data) < 44 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ProviderError("error.audio")
    offset = 12
    rate = channels = bits = data_size = None
    while offset + 8 <= len(data):
        chunk = data[offset:offset + 4]
        size = int.from_bytes(data[offset + 4:offset + 8], "little")
        body = data[offset + 8:offset + 8 + size]
        if chunk == b"fmt " and len(body) >= 16:
            channels = int.from_bytes(body[2:4], "little")
            rate = int.from_bytes(body[4:8], "little")
            bits = int.from_bytes(body[14:16], "little")
        elif chunk == b"data":
            data_size = size
            break
        offset += 8 + size + (size % 2)
    if not rate or not channels or not bits or data_size is None:
        raise ProviderError("error.audio")
    frame = channels * max(bits // 8, 1)
    if frame <= 0 or rate <= 0:
        raise ProviderError("error.audio")
    return int(data_size / (rate * frame) * 1000)


class MockMusicProvider:
    name = "mock"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.audio_dir = Path(settings.demo_audio_dir)

    def submit(self, db: Session, scenario: str, duration: int) -> str:
        task_id = f"mock-{uuid.uuid4()}"
        delay = 0 if scenario == "error" else self.settings.mock_delay_seconds
        db.add(ProviderTask(
            id=task_id,
            provider=self.name,
            scenario=scenario,
            duration=duration,
            status="queued",
            ready_at=utcnow() + timedelta(seconds=delay),
        ))
        db.flush()
        return task_id

    def status(self, db: Session, task_id: str) -> str:
        task = db.get(ProviderTask, task_id)
        if not task:
            return "unknown"
        if task.scenario == "timeout":
            task.status = "unknown"
            return "unknown"
        if utcnow() < task.ready_at:
            task.status = "running"
            return "running"
        if task.scenario == "error":
            task.status = "failed"
            return "failed"
        task.status = "succeeded"
        return "succeeded"

    def result(self, db: Session, task_id: str) -> bytes:
        task = db.get(ProviderTask, task_id)
        if not task or self.status(db, task_id) != "succeeded":
            raise ProviderError("error.provider", temporary=True)
        path = self.audio_dir / f"demo-{task.duration}.wav"
        if not path.is_file():
            path = self.audio_dir / "demo-120.wav"
        if not path.is_file():
            raise ProviderError("error.audio")
        return path.read_bytes()


class AceStepProvider:
    name = "ace-step"

    def __init__(self, settings: Settings):
        self.ready = bool(settings.ace_step_base_url and settings.ace_step_token and settings.real_generation_enabled)

    def submit(self, db: Session, scenario: str, duration: int) -> str:
        raise ProviderError("error.provider")

    def status(self, db: Session, task_id: str) -> str:
        raise ProviderError("error.provider")

    def result(self, db: Session, task_id: str) -> bytes:
        raise ProviderError("error.provider")


def build_provider(settings: Settings):
    if settings.music_provider == "mock":
        return MockMusicProvider(settings)
    if settings.music_provider == "ace":
        provider = AceStepProvider(settings)
        if not provider.ready:
            return provider
        return provider
    raise RuntimeError("Unknown music provider")


def provider_status_public(settings: Settings) -> dict:
    if settings.music_provider == "ace":
        ready = bool(settings.ace_step_base_url and settings.ace_step_token and settings.real_generation_enabled)
        return {"name": "ace", "demo": False, "available": ready, "realGeneration": ready}
    return {"name": "mock", "demo": True, "available": True, "realGeneration": False}
