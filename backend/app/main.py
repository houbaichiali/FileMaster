import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import AppError
from app.utils import storage

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    stop = threading.Event()
    storage.cleanup_expired()
    storage.start_cleanup_thread(stop)
    yield
    stop.set()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="FileMaster API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=s.origins, allow_methods=["GET", "POST", "DELETE"],
                       allow_headers=["Content-Type"], expose_headers=["Content-Disposition"])

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        return response

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse({"error": {"code": exc.code, "params": exc.params}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse({"error": {"code": "invalid_request", "params": {}}}, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        logging.getLogger("filemaster").exception("unhandled error")
        return JSONResponse({"error": {"code": "internal", "params": {}}}, status_code=500)

    app.include_router(router)

    if s.static_dir and Path(s.static_dir).is_dir():
        root = Path(s.static_dir).resolve()

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            candidate = (root / path).resolve()
            if path and candidate.is_file() and root in candidate.parents:
                return FileResponse(candidate)
            return FileResponse(root / "index.html")

    return app


app = create_app()
