"""Saving grading jobs as JSON files on disk.

Student files themselves are not kept: only the grading results are stored.
"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from pathlib import Path

DATA_DIR = Path(os.environ.get("EXAM_GRADER_DATA", Path(__file__).resolve().parent.parent / "data"))
_JOB_ID = re.compile(r"^[0-9a-f]{32}$")
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock(job_id: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(job_id, threading.Lock())


def _path(job_id: str) -> Path:
    if not _JOB_ID.match(job_id):
        raise KeyError(job_id)
    return DATA_DIR / "jobs" / f"{job_id}.json"


def new_job_id() -> str:
    return uuid.uuid4().hex


def save_job(job: dict) -> None:
    path = _path(job["id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock(job["id"]):
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(path)


def load_job(job_id: str) -> dict:
    path = _path(job_id)
    if not path.exists():
        raise KeyError(job_id)
    with _lock(job_id):
        return json.loads(path.read_text(encoding="utf-8"))


def update_job(job_id: str, fn) -> dict:
    """Read-modify-write under the job's lock."""
    path = _path(job_id)
    with _lock(job_id):
        job = json.loads(path.read_text(encoding="utf-8"))
        fn(job)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(path)
    return job


def delete_job(job_id: str) -> None:
    path = _path(job_id)
    with _lock(job_id):
        path.unlink(missing_ok=True)


def list_jobs(owner: str | None = None) -> list[dict]:
    """All jobs, or only those created by `owner`."""
    folder = DATA_DIR / "jobs"
    if not folder.exists():
        return []
    jobs = []
    for p in folder.glob("*.json"):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if owner is not None and j.get("owner") != owner:
            continue
        jobs.append({"id": j["id"], "owner": j.get("owner"), "title": j["title"], "created": j["created"],
                     "status": j["status"], "count": len(j.get("students", []))})
    return sorted(jobs, key=lambda j: j["created"], reverse=True)
