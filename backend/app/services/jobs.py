"""In-process job queue: long-running work happens in a thread pool, the API stays responsive."""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from app.core.config import get_settings
from app.core.errors import AppError
from app.utils import storage

log = logging.getLogger("filemaster.jobs")


@dataclass
class Job:
    id: str
    kind: str
    state: str = "queued"  # queued | running | done | error
    progress: float = 0.0
    error: dict | None = None
    result: dict | None = None
    out_path: Path | None = None
    created: float = field(default_factory=time.time)

    def set_progress(self, value: float) -> None:
        self.progress = max(self.progress, min(float(value), 0.99))

    def public(self) -> dict:
        return {"id": self.id, "kind": self.kind, "state": self.state, "progress": round(self.progress, 3),
                "error": self.error, "result": self.result}


class JobManager:
    def __init__(self) -> None:
        self.pool = ThreadPoolExecutor(max_workers=get_settings().max_workers, thread_name_prefix="fm-job")
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()

    def submit(self, kind: str, fn: Callable[[Job], tuple[Path, dict]]) -> Job:
        job = Job(id=storage.new_id(), kind=kind)
        storage.dir_for(job.id, create=True)
        with self.lock:
            self._prune()
            self.jobs[job.id] = job
        self.pool.submit(self._run, job, fn)
        return job

    def _run(self, job: Job, fn: Callable[[Job], tuple[Path, dict]]) -> None:
        job.state = "running"
        try:
            out_path, result = fn(job)
            job.out_path, job.result, job.progress, job.state = out_path, result, 1.0, "done"
        except AppError as exc:
            job.error, job.state = {"code": exc.code, "params": exc.params}, "error"
            storage.delete(job.id)
        except Exception:  # never leak internals to the client
            log.exception("job %s failed", job.id)
            job.error, job.state = {"code": "internal", "params": {}}, "error"
            storage.delete(job.id)

    def get(self, job_id: str) -> Job:
        job = self.jobs.get(job_id)
        if job is None:
            raise AppError("job_not_found", 404)
        return job

    def _prune(self) -> None:
        ttl = get_settings().file_ttl_minutes * 60
        for jid in [j.id for j in self.jobs.values() if time.time() - j.created > ttl]:
            self.jobs.pop(jid, None)


_manager: JobManager | None = None


def get_manager() -> JobManager:
    global _manager
    if _manager is None:
        _manager = JobManager()
    return _manager
