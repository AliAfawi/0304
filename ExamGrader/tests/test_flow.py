"""Guided flow: upload exam → marking scheme (מחוון) → students → PDF."""
import io
import time
import zipfile

import numpy as np
import pytest
from PIL import Image, ImageDraw

from app import ai_grader, library, mahvan, storage
from app.pdf_report import shape
from app.scanner import scan_image

from .test_app import anon, client, csrf_of, wait_done  # noqa: F401  (fixtures)


def photo_of_page(width=3000, height=2200) -> bytes:
    """A white page with "writing", in perspective on a dark table, lit from one side."""
    import cv2
    page = Image.new("RGB", (620, 877), "white")
    d = ImageDraw.Draw(page)
    for i in range(8):
        d.line([(60, 100 + i * 60), (520, 100 + i * 60)], fill=(30, 30, 90), width=4)
    src = np.array(page)
    bg = np.full((height, width, 3), (70, 60, 50), np.uint8)
    dst = np.float32([[700, 200], [2300, 300], [2400, 2050], [600, 1950]])
    m = cv2.getPerspectiveTransform(np.float32([[0, 0], [620, 0], [620, 877], [0, 877]]), dst)
    warped = cv2.warpPerspective(src, m, (width, height))
    mask = cv2.warpPerspective(np.full((877, 620), 255, np.uint8), m, (width, height))
    img = np.where(mask[..., None] > 0, warped, bg).astype(np.float32)
    img *= np.linspace(1.0, 0.6, width)[None, :, None]
    buf = io.BytesIO()
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(buf, "JPEG", quality=90)
    return buf.getvalue()


# --------------------------------------------------------------- unit tests

def test_scanner_finds_and_cleans_the_page():
    r = scan_image(photo_of_page())
    assert r.cropped
    img = np.array(Image.open(io.BytesIO(r.data)))
    assert img.ndim == 2  # grey-scale scan
    assert img[:8].mean() > 240 and img[:, :8].mean() > 240  # no dark table at the edges
    assert len(r.data) < 1_500_000


def test_scanner_without_a_page_outline_still_cleans():
    buf = io.BytesIO()
    Image.new("RGB", (800, 600), (200, 200, 200)).save(buf, "PNG")
    r = scan_image(buf.getvalue())
    assert not r.cropped and r.width == 800


def test_rtl_shaping_keeps_brackets_right():
    # drawn left-to-right, the visual string must read correctly
    assert shape("ab (مثال)") == "(ﻝﺎﺜﻣ) ab"
    assert "test (a+b)" in shape("سؤال test (a+b) — فيزياء")
    assert shape("a = F/m (5)") == "a = F/m (5)"


def test_mahvan_clean_and_text():
    rows = mahvan.clean([{"qid": "1", "description": "احسب", "points": "10", "answer": "5", "criteria": "نصف للطريقة"},
                         {"qid": "", "description": "", "points": "", "answer": "", "criteria": ""},
                         {"qid": "2ب", "description": "", "points": "7,5", "answer": "", "criteria": ""}])
    assert [r["qid"] for r in rows] == ["1", "2ب"] and rows[1]["points"] == 7.5
    assert mahvan.total(rows) == 17.5
    text = mahvan.as_text(rows)
    assert "سؤال 1 — 10 نقطة" in text and "نصف للطريقة" in text
    for bad in ([{"qid": "1", "points": "x"}], [{"qid": "1", "points": 0}],
                [{"qid": "1", "points": 1}, {"qid": "1", "points": 2}], [{"qid": "", "points": 3}]):
        with pytest.raises(mahvan.MahvanError):
            mahvan.clean(bad)


# ----------------------------------------------------------------- web flow

def wait_entry(entry_id, status_not="generating"):
    for _ in range(100):
        e = library.get_entry(entry_id)
        if e.get("mahvan_status") != status_not:
            return e
        time.sleep(0.05)
    raise AssertionError("marking scheme not ready")


def upload_exam(client, **extra):
    r = client.post("/exams", data={"csrf": client.csrf, "title": "امتحان فيزياء", "subject": "physics", **extra},
                    files=[("exam", ("exam.pdf", b"%PDF-1.4 exam", "application/pdf"))], follow_redirects=False)
    assert r.status_code == 303, r.text
    return r.headers["location"].rsplit("/", 1)[1]


def test_manual_mahvan_without_ai(client):
    entry_id = upload_exam(client)
    page = client.get(f"/exams/{entry_id}").text
    assert "اكتب سلم التصحيح" in page
    r = client.post(f"/exams/{entry_id}/mahvan", data={
        "csrf": client.csrf, "qid_0": "1", "points_0": "60", "description_0": "س1", "answer_0": "a",
        "criteria_0": "", "qid_3": "2", "points_3": "40", "description_3": "س2", "answer_3": "b",
        "criteria_3": "", "structure": "", "next": "stay"}, follow_redirects=False)
    assert r.headers["location"].endswith("?saved=1")
    e = library.get_entry(entry_id)
    assert [x["qid"] for x in e["mahvan"]] == ["1", "2"] and e["mahvan_status"] == "approved"
    # structure must only name questions that exist
    r = client.post(f"/exams/{entry_id}/mahvan", data={
        "csrf": client.csrf, "qid_0": "1", "points_0": "10", "structure": "1,7 = 1"}, follow_redirects=False)
    assert "error=" in r.headers["location"]
    # without an API key the students step explains what is missing
    r = client.post(f"/exams/{entry_id}/students", data={"csrf": client.csrf, "name_0": "أحمد"},
                    files=[("files_0", ("p.jpg", photo_of_page(), "image/jpeg"))], follow_redirects=False)
    assert "ANTHROPIC_API_KEY" in client.get(r.headers["location"]).text


def test_exam_upload_requires_a_file(client):
    r = client.post("/exams", data={"csrf": client.csrf}, follow_redirects=False)
    assert "error=" in r.headers["location"]


def test_full_guided_flow_with_ai(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(mahvan, "generate", lambda exam, solution, context="": {
        "questions": [
            {"qid": "1", "description": "احسب التسارع", "points": 40, "answer": "5", "criteria": "نصف للقانون"},
            {"qid": "2", "description": "اشرح", "points": 30, "answer": "...", "criteria": ""},
            {"qid": "3", "description": "اشرح", "points": 30, "answer": "...", "criteria": ""}],
        "structure": "2,3 = 1", "notes": "العلامات كانت مكتوبة في الامتحان"})
    entry_id = upload_exam(client)
    e = wait_entry(entry_id)
    assert e["mahvan_status"] == "draft" and e["structure_text"] == "2,3 = 1"
    page = client.get(f"/exams/{entry_id}").text
    assert "مسودة" in page and "احسب التسارع" in page

    # the teacher changes question 1 to 50 points and approves
    form = {"csrf": client.csrf, "structure": "2,3 = 1", "next": "students"}
    for i, (q, pts) in enumerate((("1", "50"), ("2", "30"), ("3", "30"))):
        form.update({f"qid_{i}": q, f"points_{i}": pts, f"description_{i}": "", f"answer_{i}": "", f"criteria_{i}": ""})
    r = client.post(f"/exams/{entry_id}/mahvan", data=form, follow_redirects=False)
    assert r.headers["location"].endswith("/students")

    seen = {}

    def fake_submission(reference_blocks, name, files):
        seen[name] = files
        seen["refs"] = reference_blocks
        return {"general_feedback": "جيد", "questions": [
            {"qid": "1", "description": "", "max_points": 40, "score": 45, "student_answer": "a=5",
             "feedback": "صحيح", "confident": True},
            {"qid": "2", "description": "", "max_points": 30, "score": 20, "student_answer": "...",
             "feedback": "جزئي", "confident": True},
            {"qid": "9", "description": "", "max_points": 5, "score": 5, "student_answer": "",
             "feedback": "", "confident": True}]}
    monkeypatch.setattr(ai_grader, "grade_submission", fake_submission)

    buf = io.BytesIO()
    Image.new("RGB", (100, 100), "white").save(buf, "PNG")
    r = client.post(f"/exams/{entry_id}/students", data={
        "csrf": client.csrf, "title": "الحادي عشر ب", "name_0": "أحمد علي", "name_1": "ليلى", "scan": "1"},
        files=[("files_0", ("p1.jpg", photo_of_page(), "image/jpeg")),
               ("files_0", ("p2.jpg", photo_of_page(), "image/jpeg")),
               ("files_1", ("ليلى.pdf", b"%PDF-1.4 not really", "application/pdf"))],
        follow_redirects=False)
    assert r.status_code == 303, r.text
    url = r.headers["location"]
    wait_done(client, url)
    job = storage.load_job(url.rsplit("/", 1)[1])
    names = [s["name"] for s in job["students"]]
    assert names == ["أحمد علي", "ليلى"]

    # photos were scanned before grading, and graded against the teacher's scheme
    assert [f for f, _ in seen["أحمد علي"]] == ["p1.jpg", "p2.jpg"]
    assert Image.open(io.BytesIO(seen["أحمد علي"][0][1])).mode == "L"
    ref_text = " ".join(b.get("text", "") for b in seen["refs"])
    assert "سؤال 1 — 50 نقطة" in ref_text
    ahmad = job["students"][0]
    assert ahmad["scanned_pages"] == 2
    items = {i["qid"]: i for i in ahmad["items"]}
    assert list(items) == ["1", "2", "3"]          # question 9 dropped, 3 added
    assert items["1"]["points"] == 50 and items["1"]["score"] == 45
    assert items["3"]["status"] == "review" and items["3"]["counted"] is False  # 2 counts (first answered)
    assert ahmad["total"] == 65 and ahmad["max_points"] == 80 and ahmad["grade"] == 81
    assert "9" in ahmad["error"]

    # one PDF per student: report + scanned pages
    from pypdf import PdfReader
    r = client.get(f"{url}/students/0/report.pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    pages = PdfReader(io.BytesIO(r.content)).pages
    assert len(pages) >= 3  # report (1+) + 2 scanned pages
    # Laila handed in a broken PDF: the report is still produced with a note
    assert client.get(f"{url}/students/1/report.pdf").status_code == 200
    z = zipfile.ZipFile(io.BytesIO(client.get(f"{url}/reports-pdf.zip").content))
    assert len(z.namelist()) == 2 and all(n.endswith(".pdf") for n in z.namelist())
    assert any("أحمد علي" in n for n in z.namelist())

    # deleting the grading removes the stored student pages too
    folder = storage._path(job["id"]).with_suffix("")
    assert folder.exists()
    client.post(f"{url}/delete", data={"csrf": client.csrf})
    assert not folder.exists()


def test_only_owner_edits_mahvan(client):
    entry_id = upload_exam(client)
    client.post("/users", data={"username": "teach2", "password": "password1", "csrf": client.csrf})
    client.cookies.clear()
    client.post("/login", data={"username": "teach2", "password": "password1"})
    token = csrf_of(client)
    assert "تعديله متاح لمن أضاف الامتحان" in client.get(f"/exams/{entry_id}").text
    r = client.post(f"/exams/{entry_id}/mahvan", data={"csrf": token, "qid_0": "1", "points_0": "5"})
    assert r.status_code == 403


def test_mahvan_generation_failure_is_shown(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")

    def boom(*a, **k):
        raise ai_grader.AIError("خطأ تجريبي")
    monkeypatch.setattr(mahvan, "generate", boom)
    entry_id = upload_exam(client)
    e = wait_entry(entry_id)
    assert e["mahvan_status"] == "failed"
    assert "خطأ تجريبي" in client.get(f"/exams/{entry_id}").text


def test_bulk_upload_in_guided_flow(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(mahvan, "generate", lambda *a, **k: {"questions": [], "structure": "", "notes": ""})
    entry_id = upload_exam(client)
    wait_entry(entry_id)
    library.update_entry(entry_id, lambda e: e.update(
        mahvan=[{"qid": "1", "description": "", "points": 10, "answer": "", "criteria": ""}],
        mahvan_status="approved"))
    monkeypatch.setattr(ai_grader, "grade_submission", lambda refs, name, files: {
        "general_feedback": "", "questions": [{"qid": "1", "description": "", "max_points": 10, "score": 7,
                                               "student_answer": "x", "feedback": "", "confident": True}]})
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as z:
        z.writestr("c/سامي/1.jpg", photo_of_page())
        z.writestr("c/هبة/1.jpg", photo_of_page())
    r = client.post(f"/exams/{entry_id}/students", data={"csrf": client.csrf, "scan": "0"},
                    files=[("bulk", ("all.zip", zbuf.getvalue(), "application/zip"))], follow_redirects=False)
    wait_done(client, r.headers["location"])
    job = storage.load_job(r.headers["location"].rsplit("/", 1)[1])
    assert sorted(s["name"] for s in job["students"]) == ["سامي", "هبة"]
    assert all(s["grade"] == 70 and s["scanned_pages"] == 0 for s in job["students"])
