import io
import re
import time
import zipfile

import pytest
from fastapi.testclient import TestClient

from app import ai_grader, auth, storage
from app.main import app, collect_student_files, UploadError

from .helpers import rubric_bytes, xlsx

KEY = {"A1": 5, "A2": ("=A1*2", 10)}
ROWS = [
    ["1", "رقم", "Sheet", "A1", 4, "قيمة", None, None, None, None],
    ["2", "ضعف", "Sheet", "A2", 6, "معادلة", None, None, None, None],
]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


CSRF_RE = re.compile(r'name="csrf" value="([^"]+)"')


def csrf_of(client) -> str:
    return CSRF_RE.search(client.get("/").text).group(1)


@pytest.fixture
def anon(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("EXAM_GRADER_SECRET", raising=False)
    auth._failures.clear()
    return TestClient(app)


@pytest.fixture
def client(anon):
    """Logged in as the admin created through the first-run setup page."""
    r = anon.post("/setup", data={"username": "Admin", "name": "المدير",
                                  "password": "secret123", "password2": "secret123"}, follow_redirects=False)
    assert r.status_code == 303
    anon.csrf = csrf_of(anon)
    return anon


def login(client, username, password):
    client.cookies.clear()
    return client.post("/login", data={"username": username, "password": password}, follow_redirects=False)


def wait_done(client, url):
    for _ in range(100):
        r = client.get(url)
        if "جاري التصحيح" not in r.text:
            return r
        time.sleep(0.05)
    raise AssertionError("grading did not finish")


def zip_of(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for n, d in files.items():
            z.writestr(n, d)
    return buf.getvalue()


def test_full_flow(client):
    assert "تصحيح امتحان جديد" in client.get("/").text
    students = zip_of({
        "class/أحمد_علي.xlsx": xlsx(KEY),
        "class/ليلى.xlsx": xlsx({"A1": 5, "A2": 10}),
        "__MACOSX/._x.xlsx": b"junk",
        "notes.exe": b"ignored",
    })
    r = client.post("/grade", data={"title": "تجربة", "csrf": client.csrf}, files=[
        ("solution", ("key.xlsx", xlsx(KEY), XLSX)),
        ("rubric", ("rubric.xlsx", rubric_bytes(ROWS), XLSX)),
        ("students", ("all.zip", students, "application/zip")),
    ], follow_redirects=False)
    assert r.status_code == 303
    url = r.headers["location"]
    page = wait_done(client, url)
    assert "أحمد علي" in page.text and "ليلى" in page.text
    assert "إحصائيات الصف" in page.text

    job_id = url.rsplit("/", 1)[1]
    job = storage.load_job(job_id)
    grades = {s["name"]: s["grade"] for s in job["students"]}
    assert grades == {"أحمد علي": 100, "ليلى": 70}

    # teacher raises Laila's formula item to full marks
    idx = [s["name"] for s in job["students"]].index("ليلى")
    r = client.post(f"{url}/students/{idx}", data={
        "csrf": client.csrf, "score_0": "4", "score_1": "6", "feedback_1": "مقبول", "teacher_comment": "أحسنت", "reviewed": "on",
    }, follow_redirects=False)
    assert r.status_code == 303
    s = storage.load_job(job_id)["students"][idx]
    assert s["grade"] == 100 and s["teacher_comment"] == "أحسنت" and s["items"][1]["teacher_edited"]

    # scores above the maximum are capped
    client.post(f"{url}/students/{idx}", data={"csrf": client.csrf, "score_0": "99"})
    assert storage.load_job(job_id)["students"][idx]["items"][0]["score"] == 4

    assert client.get(f"{url}/students/{idx}").status_code == 200
    r = client.get(f"{url}/export.xlsx")
    assert r.status_code == 200 and r.content[:2] == b"PK"
    r = client.get(f"{url}/reports.zip")
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert sorted(names) == sorted(["أحمد علي.html", "ليلى.html"])
    html = zipfile.ZipFile(io.BytesIO(r.content)).read("ليلى.html").decode()
    assert "<style>" in html and "أحسنت" in html

    client.post(f"{url}/delete", data={"csrf": client.csrf})
    assert client.get(url).status_code == 404


def test_free_rubric_needs_ai_key(client):
    r = client.post("/grade", data={"csrf": client.csrf}, files=[
        ("rubric", ("rubric.txt", "سؤال 1: 10 نقاط".encode(), "text/plain")),
        ("students", ("s.txt", "جواب".encode(), "text/plain")),
    ])
    assert r.status_code == 400 and "مفتاح" in r.text


def test_free_rubric_with_ai(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    def fake_submission(reference_blocks, name, files):
        assert reference_blocks[-1]["cache_control"] == {"type": "ephemeral"}
        return {"general_feedback": "عمل جيد", "questions": [
            {"qid": "1", "description": "سؤال", "max_points": 10, "score": 8,
             "student_answer": "x", "feedback": "ok", "confident": True}]}
    monkeypatch.setattr(ai_grader, "grade_submission", fake_submission)
    r = client.post("/grade", data={"csrf": client.csrf}, files=[
        ("rubric", ("rubric.txt", "سؤال 1: 10 نقاط".encode(), "text/plain")),
        ("students", ("نور.py", b"print(1)", "text/plain")),
    ], follow_redirects=False)
    page = wait_done(client, r.headers["location"])
    assert "نور" in page.text
    job = storage.load_job(r.headers["location"].rsplit("/", 1)[1])
    assert job["mode"] == "ai" and job["students"][0]["grade"] == 80


def test_no_student_files(client):
    r = client.post("/grade", data={"csrf": client.csrf}, files=[
        ("rubric", ("rubric.xlsx", rubric_bytes(ROWS), XLSX)),
        ("students", ("a.exe", b"x", "application/octet-stream")),
    ])
    assert r.status_code == 400


def test_bad_job_ids(client):
    assert client.get("/jobs/../../etc").status_code == 404
    assert client.get("/jobs/" + "0" * 32).status_code == 404


def test_zip_bad():
    with pytest.raises(UploadError):
        collect_student_files([("x.zip", b"not a zip")])


def test_rubric_template_download(client):
    r = client.get("/rubric-template.xlsx")
    assert r.status_code == 200 and r.content[:2] == b"PK"


# ------------------------------------------------------------------ security

def test_first_run_goes_to_setup_then_login(anon):
    r = anon.get("/", follow_redirects=False)
    assert r.headers["location"] == "/setup"
    auth.create_user("teacher1", "معلم", "password1")
    r = anon.get("/jobs/" + "0" * 32, follow_redirects=False)
    assert r.headers["location"].startswith("/login?next=")
    assert anon.get("/setup", follow_redirects=False).headers["location"] == "/login"


def test_setup_only_once(client):
    client.cookies.clear()
    r = client.post("/setup", data={"username": "evil", "password": "x" * 8, "password2": "x" * 8},
                    follow_redirects=False)
    assert r.headers["location"] == "/login"
    assert auth.get_user("evil") is None


def test_login_wrong_password_and_lockout(client):
    assert login(client, "admin", "wrong-pass").status_code == 401
    for _ in range(auth.MAX_FAILURES):
        login(client, "admin", "wrong-pass")
    r = login(client, "admin", "secret123")
    assert r.status_code == 401 and "5 دقائق" in r.text


def test_login_redirects_only_to_local_paths(client):
    client.cookies.clear()
    r = client.post("/login", data={"username": "admin", "password": "secret123", "next": "//evil.com"},
                    follow_redirects=False)
    assert r.headers["location"] == "/"


def test_tampered_cookie_rejected(client):
    cookie = client.cookies.get(auth.COOKIE)
    client.cookies.set(auth.COOKIE, cookie[:-2] + ("00" if not cookie.endswith("00") else "11"))
    assert client.get("/", follow_redirects=False).status_code == 303


def test_csrf_required(client):
    r = client.post("/users", data={"username": "t2", "password": "password2"})
    assert r.status_code == 403
    r = client.post("/users", data={"username": "t2", "password": "password2", "csrf": "nope"})
    assert r.status_code == 403
    assert auth.get_user("t2") is None


def test_teachers_see_only_their_own_exams(client):
    for u in ("teacher1", "teacher2"):
        r = client.post("/users", data={"username": u, "name": u, "password": "password1",
                                        "csrf": client.csrf}, follow_redirects=False)
        assert r.status_code == 303

    assert login(client, "teacher1", "password1").status_code == 303
    client.csrf = csrf_of(client)
    r = client.post("/grade", data={"csrf": client.csrf, "title": "امتحان المعلم الأول"}, files=[
        ("solution", ("key.xlsx", xlsx(KEY), XLSX)),
        ("rubric", ("rubric.xlsx", rubric_bytes(ROWS), XLSX)),
        ("students", ("أحمد.xlsx", xlsx(KEY), XLSX)),
    ], follow_redirects=False)
    url = r.headers["location"]
    wait_done(client, url)
    assert client.get("/users").status_code == 403  # teachers can't manage users

    login(client, "teacher2", "password1")
    assert client.get(url).status_code == 404
    assert client.get(url + "/export.xlsx").status_code == 404
    assert "امتحان المعلم الأول" not in client.get("/").text

    login(client, "admin", "secret123")
    assert client.get(url).status_code == 200
    assert "امتحان المعلم الأول" in client.get("/").text


def test_password_change_logs_out_other_sessions(client):
    old_cookie = client.cookies.get(auth.COOKIE)
    r = client.post("/account", data={"csrf": client.csrf, "current": "secret123",
                                      "password": "newpass123", "password2": "newpass123"},
                    follow_redirects=False)
    assert r.status_code == 303
    assert client.get("/", follow_redirects=False).status_code == 200  # this session got a new cookie
    client.cookies.set(auth.COOKIE, old_cookie)
    assert client.get("/", follow_redirects=False).status_code == 303
    assert login(client, "admin", "newpass123").status_code == 303


def test_cannot_delete_last_admin_or_self(client):
    r = client.post("/users/admin/delete", data={"csrf": client.csrf})
    assert r.status_code == 400
    assert auth.get_user("admin") is not None
