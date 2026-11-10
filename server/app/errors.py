class ApiError(Exception):
    def __init__(self, code: str, status: int = 400, params: dict | None = None):
        super().__init__(code)
        self.code = code
        self.status = status
        self.params = params or {}


class StorageError(Exception):
    pass


class ProviderError(Exception):
    def __init__(self, code: str, temporary: bool = False):
        super().__init__(code)
        self.code = code
        self.temporary = temporary
