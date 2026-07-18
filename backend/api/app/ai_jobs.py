from __future__ import annotations

import asyncio
import copy
import os
import threading
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AiJob:
    id: str
    record: dict[str, Any] = field(repr=False)
    status: str = "queued"
    created_at: str = field(default_factory=_now)
    started_at: str | None = None
    completed_at: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None

    def public(self) -> dict[str, Any]:
        return {
            "job_id": self.id,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "result": self.result,
            "error": self.error,
        }


class AiJobQueue:
    """Bounded single-instance queue. Replace this adapter with Redis for multi-instance deploys."""

    def __init__(self, handler: Callable[[dict[str, Any]], dict[str, Any]], *, workers: int, max_queue: int):
        self._handler = handler
        self._workers = max(1, workers)
        self._max_queue = max(1, max_queue)
        self._jobs: OrderedDict[str, AiJob] = OrderedDict()
        self._pending: asyncio.Queue[str] | None = None
        self._tasks: list[asyncio.Task[None]] = []
        self._executor: ThreadPoolExecutor | None = None
        self._lock = threading.Lock()

    async def start(self) -> None:
        if self._tasks:
            return
        self._pending = asyncio.Queue(maxsize=self._max_queue)
        self._executor = ThreadPoolExecutor(max_workers=self._workers, thread_name_prefix="ai-worker")
        self._tasks = [asyncio.create_task(self._worker()) for _ in range(self._workers)]

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        if self._executor:
            self._executor.shutdown(wait=False, cancel_futures=True)
            self._executor = None

    async def submit(self, record: dict[str, Any]) -> AiJob:
        if self._pending is None:
            raise RuntimeError("AI job queue chưa khởi động")
        if self._pending.full():
            raise OverflowError("AI job queue đang đầy")
        job = AiJob(id=str(uuid.uuid4()), record=copy.deepcopy(record))
        with self._lock:
            self._jobs[job.id] = job
            while len(self._jobs) > self._max_queue * 4:
                oldest_id, oldest = next(iter(self._jobs.items()))
                if oldest.status in {"queued", "processing"}:
                    break
                self._jobs.pop(oldest_id)
        self._pending.put_nowait(job.id)
        return job

    def get(self, job_id: str) -> AiJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    async def _worker(self) -> None:
        assert self._pending is not None
        while True:
            job_id = await self._pending.get()
            job = self.get(job_id)
            if job is None:
                self._pending.task_done()
                continue
            job.status = "processing"
            job.started_at = _now()
            try:
                loop = asyncio.get_running_loop()
                job.result = await loop.run_in_executor(self._executor, self._handler, job.record)
                job.status = "completed"
            except Exception as exc:  # sanitized by pipeline/provider before reaching this boundary
                job.status = "failed"
                job.error = str(exc)
            finally:
                job.record.clear()
                job.completed_at = _now()
                self._pending.task_done()


def queue_settings() -> tuple[int, int]:
    return int(os.getenv("AI_JOB_WORKERS", "4")), int(os.getenv("AI_JOB_MAX_QUEUE", "100"))
