"""Exam library (מאגר בחינות): exams saved once and reused by every teacher.

Each entry keeps the reference files (exam, solved exam, rubric) together
with the subject, unit level, questionnaire number, session and the exam
structure, so the next grading of the same exam needs no uploads.
"""
from __future__ import annotations

import json
import re
import shutil
import uuid
from datetime import datetime
from pathlib import PurePath

from . import storage

KINDS = ("exam", "solution", "rubric")
KIND_LABELS = {"exam": "الامتحان الأصلي", "solution": "الامتحان المحلول", "rubric": "سلم التصحيح"}
_ID = re.compile(r"^[0-9a-f]{32}$")


def _root():
    return storage.DATA_DIR / "library"


def _dir(entry_id: str):
    if not _ID.match(entry_id):
        raise KeyError(entry_id)
    return _root() / entry_id


def create_entry(meta: dict, files: dict[str, tuple[str, bytes]]) -> dict:
    if "rubric" not in files and "solution" not in files:
        raise ValueError("يجب أن يحتوي الامتحان في المكتبة على سلم تصحيح أو امتحان محلول")
    entry_id = uuid.uuid4().hex
    folder = _dir(entry_id)
    folder.mkdir(parents=True)
    stored = {}
    for kind, (filename, data) in files.items():
        if kind not in KINDS:
            continue
        ext = PurePath(filename).suffix.lower()
        (folder / f"{kind}{ext}").write_bytes(data)
        stored[kind] = {"name": PurePath(filename).name, "path": f"{kind}{ext}"}
    entry = {**meta, "id": entry_id, "files": stored,
             "created": datetime.now().isoformat(timespec="seconds")}
    (folder / "meta.json").write_text(json.dumps(entry, ensure_ascii=False, indent=1), encoding="utf-8")
    return entry


def get_entry(entry_id: str) -> dict:
    path = _dir(entry_id) / "meta.json"
    if not path.exists():
        raise KeyError(entry_id)
    return json.loads(path.read_text(encoding="utf-8"))


def load_file(entry_id: str, kind: str) -> tuple[str, bytes] | None:
    entry = get_entry(entry_id)
    info = entry["files"].get(kind)
    if not info:
        return None
    return info["name"], (_dir(entry_id) / info["path"]).read_bytes()


def list_entries(subject: str | None = None) -> list[dict]:
    root = _root()
    if not root.exists():
        return []
    out = []
    for meta in root.glob("*/meta.json"):
        try:
            e = json.loads(meta.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if subject and e.get("subject") != subject:
            continue
        out.append(e)
    return sorted(out, key=lambda e: (e.get("subject") or "", -(int(e.get("year") or 0)),
                                      e.get("questionnaire") or "", e["created"]))


def delete_entry(entry_id: str) -> None:
    folder = _dir(entry_id)
    if not (folder / "meta.json").exists():
        raise KeyError(entry_id)
    shutil.rmtree(folder)
