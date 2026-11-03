"""Teacher accounts and login sessions.

- Passwords are hashed with scrypt (standard library).
- The session is a signed cookie (HMAC-SHA256). It carries a per-user
  version number, so changing a password logs out every other session.
- Each session has its own CSRF token; every form posts it back.
- Repeated wrong passwords lock the account for a few minutes.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from datetime import datetime

from . import storage

COOKIE = "eg_session"
SESSION_SECONDS = 12 * 3600
MAX_FAILURES = 5
LOCK_SECONDS = 5 * 60
MIN_PASSWORD = 8
ROLE_ADMIN = "admin"
ROLE_TEACHER = "teacher"
_USERNAME = re.compile(r"^[A-Za-z0-9_.\-@]{3,40}$")

_lock = threading.Lock()
_failures: dict[str, list[float]] = {}


class AuthError(ValueError):
    pass


# ------------------------------------------------------------------ secrets

def _secret() -> bytes:
    env = os.environ.get("EXAM_GRADER_SECRET")
    if env:
        return env.encode()
    path = storage.DATA_DIR / "secret.key"
    with _lock:
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(secrets.token_hex(32))
            try:
                path.chmod(0o600)
            except OSError:
                pass
        return path.read_text().strip().encode()


# -------------------------------------------------------------------- users

def _users_path():
    return storage.DATA_DIR / "users.json"


def _load_users() -> dict:
    path = _users_path()
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _save_users(users: dict) -> None:
    path = _users_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(users, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def has_users() -> bool:
    return bool(_load_users())


def list_users() -> list[dict]:
    return [{"username": u, **{k: v for k, v in d.items() if k in ("name", "role", "created")}}
            for u, d in sorted(_load_users().items())]


def get_user(username: str) -> dict | None:
    d = _load_users().get(username)
    if d is None:
        return None
    return {"username": username, "name": d["name"], "role": d["role"], "version": d.get("version", 0)}


def _hash(password: str, salt: bytes) -> str:
    return hashlib.scrypt(password.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32).hex()


def _check_password_rules(password: str) -> None:
    if len(password) < MIN_PASSWORD:
        raise AuthError(f"كلمة المرور يجب أن تكون {MIN_PASSWORD} أحرف على الأقل")


def create_user(username: str, name: str, password: str, role: str = ROLE_TEACHER) -> None:
    username = username.strip().lower()
    if not _USERNAME.match(username):
        raise AuthError("اسم المستخدم: 3–40 حرفاً إنجليزياً أو أرقاماً (مسموح أيضاً _ . - @)")
    _check_password_rules(password)
    if role not in (ROLE_ADMIN, ROLE_TEACHER):
        raise AuthError("دور غير معروف")
    with _lock:
        users = _load_users()
        if username in users:
            raise AuthError("اسم المستخدم موجود مسبقاً")
        salt = secrets.token_bytes(16)
        users[username] = {
            "name": name.strip() or username, "role": role, "salt": salt.hex(),
            "hash": _hash(password, salt), "version": 0,
            "created": datetime.now().isoformat(timespec="seconds"),
        }
        _save_users(users)


def set_password(username: str, password: str) -> None:
    _check_password_rules(password)
    with _lock:
        users = _load_users()
        if username not in users:
            raise AuthError("المستخدم غير موجود")
        salt = secrets.token_bytes(16)
        users[username].update(salt=salt.hex(), hash=_hash(password, salt),
                               version=users[username].get("version", 0) + 1)
        _save_users(users)


def delete_user(username: str) -> None:
    with _lock:
        users = _load_users()
        if username not in users:
            raise AuthError("المستخدم غير موجود")
        if users[username]["role"] == ROLE_ADMIN and sum(
                1 for d in users.values() if d["role"] == ROLE_ADMIN) == 1:
            raise AuthError("لا يمكن حذف المدير الوحيد")
        del users[username]
        _save_users(users)


def verify_password(username: str, password: str) -> dict:
    """Returns the user, or raises AuthError. Locks after repeated failures."""
    username = username.strip().lower()
    now = time.time()
    with _lock:
        recent = [t for t in _failures.get(username, []) if now - t < LOCK_SECONDS]
        _failures[username] = recent
        if len(recent) >= MAX_FAILURES:
            raise AuthError("محاولات كثيرة خاطئة. حاول مرة أخرى بعد 5 دقائق")
    d = _load_users().get(username)
    ok = False
    if d is not None:
        ok = hmac.compare_digest(_hash(password, bytes.fromhex(d["salt"])), d["hash"])
    else:
        _hash(password, b"0" * 16)  # same work either way: don't reveal which usernames exist
    if not ok:
        with _lock:
            _failures.setdefault(username, []).append(now)
        raise AuthError("اسم المستخدم أو كلمة المرور غير صحيحة")
    with _lock:
        _failures.pop(username, None)
    return get_user(username)


# ------------------------------------------------------------------ session

def _sign(payload: bytes) -> str:
    return hmac.new(_secret(), payload, hashlib.sha256).hexdigest()


def make_session(user: dict) -> str:
    payload = json.dumps({"u": user["username"], "v": user["version"], "t": int(time.time()),
                          "c": secrets.token_urlsafe(24)}).encode()
    body = base64.urlsafe_b64encode(payload).decode()
    return f"{body}.{_sign(payload)}"


def read_session(cookie: str | None) -> tuple[dict, str] | None:
    """(user, csrf token) for a valid cookie, else None."""
    if not cookie or "." not in cookie:
        return None
    body, sig = cookie.rsplit(".", 1)
    try:
        payload = base64.urlsafe_b64decode(body.encode())
    except (ValueError, TypeError):
        return None
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    if time.time() - data.get("t", 0) > SESSION_SECONDS:
        return None
    user = get_user(data.get("u", ""))
    if user is None or user["version"] != data.get("v"):
        return None
    return user, data["c"]
