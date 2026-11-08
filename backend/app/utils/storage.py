"""Isolated per-file / per-job working directories with TTL cleanup."""
import json
import shutil
import threading
import time
import uuid
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import valid_id


def _root() -> Path:
    root = get_settings().root
    root.mkdir(parents=True, exist_ok=True)
    return root


def new_id() -> str:
    return uuid.uuid4().hex


def dir_for(item_id: str, create: bool = False) -> Path:
    path = _root() / valid_id(item_id)
    if create:
        path.mkdir(parents=True, exist_ok=True)
    return path


def write_meta(item_id: str, meta: dict) -> None:
    (dir_for(item_id) / "meta.json").write_text(json.dumps(meta), encoding="utf-8")


def read_meta(item_id: str) -> dict:
    path = dir_for(item_id) / "meta.json"
    if not path.is_file():
        raise AppError("file_not_found", 404)
    return json.loads(path.read_text(encoding="utf-8"))


def source_path(meta: dict) -> Path:
    return dir_for(meta["id"]) / f"source.{meta['format']}"


def delete(item_id: str) -> None:
    shutil.rmtree(dir_for(item_id), ignore_errors=True)


def cleanup_expired(ttl_minutes: int | None = None) -> int:
    ttl = (ttl_minutes if ttl_minutes is not None else get_settings().file_ttl_minutes) * 60
    now, removed = time.time(), 0
    for child in _root().iterdir():
        try:
            if child.is_dir() and now - child.stat().st_mtime > ttl:
                shutil.rmtree(child, ignore_errors=True)
                removed += 1
        except OSError:
            continue
    return removed


def start_cleanup_thread(stop: threading.Event) -> threading.Thread:
    def loop():
        while not stop.wait(get_settings().cleanup_interval_s):
            cleanup_expired()

    thread = threading.Thread(target=loop, name="filemaster-cleanup", daemon=True)
    thread.start()
    return thread
