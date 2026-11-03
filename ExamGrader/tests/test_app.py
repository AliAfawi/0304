import io
import re
import time
import zipfile

import pytest
from fastapi.testclient import TestClient

from app import ai_grader, storage
from app.main import app, collect_student_files, UploadError

from .helpers import rubric_bytes, xlsx

KEY = {"A1": 5, "A2": ("=A1*2", 10)}
ROWS = [
    ["1", "رقم", "Sheet", "A1", 4, "قيمة", None, None, None, None],
    ["2", "ضعف", "Sheet", "A2", 6, "معادلة", None, None, None, None],
]
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DATA_DIR", tmp_path)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    return TestClient(app)


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
    r = client.post("/grade", data={"title": "تجربة"}, files=[
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
        "score_0": "4", "score_1": "6", "feedback_1": "مقبول", "teacher_comment": "أحسنت", "reviewed": "on",
    }, follow_redirects=False)
    assert r.status_code == 303
    s = storage.load_job(job_id)["students"][idx]
    assert s["grade"] == 100 and s["teacher_comment"] == "أحسنت" and s["items"][1]["teacher_edited"]

    # scores above the maximum are capped
    client.post(f"{url}/students/{idx}", data={"score_0": "99"})
    assert storage.load_job(job_id)["students"][idx]["items"][0]["score"] == 4

    assert client.get(f"{url}/students/{idx}").status_code == 200
    r = client.get(f"{url}/export.xlsx")
    assert r.status_code == 200 and r.content[:2] == b"PK"
    r = client.get(f"{url}/reports.zip")
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert sorted(names) == sorted(["أحمد علي.html", "ليلى.html"])
    html = zipfile.ZipFile(io.BytesIO(r.content)).read("ليلى.html").decode()
    assert "<style>" in html and "أحسنت" in html

    client.post(f"{url}/delete")
    assert client.get(url).status_code == 404


def test_free_rubric_needs_ai_key(client):
    r = client.post("/grade", files=[
        ("rubric", ("rubric.txt", "سؤال 1: 10 نقاط".encode(), "text/plain")),
        ("students", ("s.txt", "جواب".encode(), "text/plain")),
    ])
    assert r.status_code == 400 and "مفتاح" in r.text


def test_free_rubric_with_ai(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    def fake_submission(reference_blocks, name, filename, data):
        assert reference_blocks[-1]["cache_control"] == {"type": "ephemeral"}
        return {"general_feedback": "عمل جيد", "questions": [
            {"qid": "1", "description": "سؤال", "max_points": 10, "score": 8,
             "student_answer": "x", "feedback": "ok", "confident": True}]}
    monkeypatch.setattr(ai_grader, "grade_submission", fake_submission)
    r = client.post("/grade", files=[
        ("rubric", ("rubric.txt", "سؤال 1: 10 نقاط".encode(), "text/plain")),
        ("students", ("نور.py", b"print(1)", "text/plain")),
    ], follow_redirects=False)
    page = wait_done(client, r.headers["location"])
    assert "نور" in page.text
    job = storage.load_job(r.headers["location"].rsplit("/", 1)[1])
    assert job["mode"] == "ai" and job["students"][0]["grade"] == 80


def test_no_student_files(client):
    r = client.post("/grade", files=[
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
