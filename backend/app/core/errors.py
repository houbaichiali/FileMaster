"""Errors carry a stable machine code; the frontend translates it (no raw server details leak)."""


class AppError(Exception):
    def __init__(self, code: str, status: int = 400, **params):
        super().__init__(code)
        self.code = code
        self.status = status
        self.params = params
