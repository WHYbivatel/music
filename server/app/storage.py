from pathlib import Path

from .config import Settings
from .errors import StorageError


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        if not key or key.startswith("/") or ".." in key.split("/"):
            raise StorageError("bad key")
        path = (self.root / key).resolve()
        if self.root != path and self.root not in path.parents:
            raise StorageError("bad key")
        return path

    def put(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)

    def get(self, key: str) -> bytes:
        path = self._path(key)
        if not path.is_file():
            raise StorageError("missing")
        return path.read_bytes()

    def get_range(self, key: str, start: int, end: int) -> bytes:
        path = self._path(key)
        with path.open("rb") as handle:
            handle.seek(start)
            return handle.read(end - start + 1)

    def size(self, key: str) -> int:
        path = self._path(key)
        if not path.is_file():
            raise StorageError("missing")
        return path.stat().st_size

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()

    def orphan_keys(self, known: set[str]) -> list[str]:
        found = []
        for path in self.root.rglob("*"):
            if not path.is_file() or path.suffix == ".tmp":
                continue
            key = str(path.relative_to(self.root))
            if key not in known:
                found.append(key)
        return found


class UnavailableS3:
    def __init__(self):
        raise StorageError("S3 is not configured")


def build_storage(settings: Settings):
    if settings.storage_backend == "local":
        return LocalStorage(settings.media_root)
    if settings.storage_backend == "s3":
        if not all([settings.s3_endpoint, settings.s3_bucket, settings.s3_access_key, settings.s3_secret_key]):
            raise RuntimeError("S3 storage selected but credentials are incomplete. Local storage was not used as a fallback.")
        try:
            import boto3  # type: ignore
        except ImportError as exc:
            raise RuntimeError("S3 storage requires boto3. It is not installed, and mock local storage will not be used instead.") from exc
        return S3Storage(settings, boto3)
    raise RuntimeError("Unknown storage backend")


class S3Storage:
    """Private S3-compatible bucket. Used only when STORAGE_BACKEND=s3 and credentials exist."""

    def __init__(self, settings: Settings, boto3):
        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        )

    def put(self, key: str, data: bytes) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data)

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def get_range(self, key: str, start: int, end: int) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key, Range=f"bytes={start}-{end}")["Body"].read()

    def size(self, key: str) -> int:
        return self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"]

    def exists(self, key: str) -> bool:
        try:
            self.size(key)
            return True
        except Exception:
            return False

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def orphan_keys(self, known: set[str]) -> list[str]:
        return []
