from .config import get_settings
from .providers import build_provider
from .storage import build_storage

_storage = None
_provider = None


def get_storage():
    global _storage
    if _storage is None:
        _storage = build_storage(get_settings())
    return _storage


def get_provider():
    global _provider
    if _provider is None:
        _provider = build_provider(get_settings())
    return _provider


def reset_runtime() -> None:
    global _storage, _provider
    _storage = None
    _provider = None
