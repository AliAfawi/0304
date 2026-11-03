"""Bagrut features: exam structure, subjects, photographed pages, library."""
import io
import re
import zipfile

import pytest

from app import ai_grader, grader, library, storage
from app.main import collect_student_files, group_submissions
from app.structure import RULE_BEST, RULE_FIRST, StructureError, apply_structure, parse_structure

from .helpers import rubric_bytes, xlsx
from .test_app import XLSX, anon, client, csrf_of, wait_done  # noqa: F401  (fixtures)


# ------------------------------------------------------------------ structure

def test_parse_structure():
    secs = parse_structure("فصل أ: 1,2,3 = 2\n4-7 = 3 الأفضل\n# تعليق\n\n8 9 = 1")
    assert [s.qids for s in secs] == [["1", "2", "3"], ["4", "5", "6", "7"], ["8", "9"]]
    assert [s.required for s in secs] == [2, 3, 1]
    assert [s.rule for s in secs] == [RULE_FIRST, RULE_BEST, RULE_FIRST]
    assert secs[0].title == "فصل أ"
    assert parse_structure("") == []


@pytest.mark.parametrize("bad", ["1,2,3", "1,2 = 3", "1,2 = x", "1,2 = 1\n2,3 = 1", "1,2 = 1 سحر", "9-1 = 1"])
def test_parse_structure_errors(bad):
    with pytest.raises(StructureError):
        parse_structure(bad)


def student(scores: dict, points=10, answered=None):
    answered = answered if answered is not None else {q for q, sc in scores.items() if sc > 0}
    return {"items": [{"qid": q, "score": sc, "points": points, "status": "partial",
                       "student_answer": "جواب" if q in answered else ""} for q, sc in scores.items()]}


def test_first_answered_questions_count():
    s = student({"1": 0, "2": 6, "3": 9, "4": 10}, answered={"1", "2", "3"})
    grader.summarize(s, parse_structure("1,2,3 = 2"))
    counted = {i["qid"] for i in s["items"] if i["counted"]}
    assert counted == {"1", "2", "4"}  # first two answered (1 is answered but wrong), 4 is outside
    assert s["max_points"] == 30 and s["total"] == 16


def test_best_questions_count():
    s = student({"1": 2, "2": 6, "3": 9})
    grader.summarize(s, parse_structure("1,2,3 = 2 الأفضل"))
    assert {i["qid"] for i in s["items"] if i["counted"]} == {"2", "3"}
    assert s["grade"] == 75  # 15 of 20


def test_unanswered_questions_fill_the_quota():
    s = student({"1": 0, "2": 0, "3": 7}, answered={"3"})
    grader.summarize(s, parse_structure("1,2,3 = 2"))
    assert {i["qid"] for i in s["items"] if i["counted"]} == {"1", "3"}
    assert s["grade"] == 35


def test_multi_item_question_and_natural_order():
    s = {"items": [
        {"qid": "10", "score": 5, "points": 5, "status": "correct", "student_answer": "x"},
        {"qid": "2", "score": 3, "points": 5, "status": "partial", "student_answer": "x"},
        {"qid": "2", "score": 2, "points": 5, "status": "partial", "student_answer": "x"},
    ]}
    apply_structure(s, parse_structure("2,10 = 1"))
    # question 2 comes before 10 and has two items worth 10 points together
    assert [i["counted"] for i in s["items"]] == [False, True, True]
    assert s["section_max"] == 10


def test_structure_reapplied_after_teacher_edit():
    s = student({"1": 2, "2": 6, "3": 9})
    secs = parse_structure("1,2,3 = 1 الأفضل")
    grader.summarize(s, secs)
    assert s["total"] == 9
    s["items"][0]["score"] = 10
    grader.summarize(s, secs)
    assert s["total"] == 10 and s["items"][0]["counted"]


# ------------------------------------------------------------------ grouping

def names(groups):
    return {n: sorted(f for f, _ in files) for n, files in groups}


def test_group_pages_by_name_suffix_and_folders():
    files = [("أحمد_1.jpg", b"1"), ("أحمد_2.jpg", b"2"), ("أحمد (3).jpg", b"3"),
             ("ليلى صفحة 1.png", b"1"), ("ليلى صفحة 2.png", b"2"), ("سامي.pdf", b"x"),
             ("123456789.jpg", b"id-named")]
    g = names(group_submissions(files))
    assert g == {"أحمد": ["أحمد (3).jpg", "أحمد_1.jpg", "أحمد_2.jpg"],
                 "ليلى": ["ليلى صفحة 1.png", "ليلى صفحة 2.png"],
                 "سامي": ["سامي.pdf"], "123456789": ["123456789.jpg"]}


def test_group_zip_folders_per_student():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for path in ["class/Ahmad/p1.jpg", "class/Ahmad/p2.jpg", "class/Laila/scan.pdf",
                     "class/Laila/extra.jpg", "class/__MACOSX/x.jpg", "class/../evil.jpg"]:
            z.writestr(path, b"x")
    g = names(group_submissions(collect_student_files([("all.zip", buf.getvalue())])))
    assert g == {"Ahmad": ["p1.jpg", "p2.jpg"], "Laila": ["extra.jpg", "scan.pdf"]}


def test_flat_zip_keeps_one_student_per_excel():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("class/student_1.xlsx", b"x")
        z.writestr("class/student_2.xlsx", b"x")
    g = names(group_submissions(collect_student_files([("all.zip", buf.getvalue())])))
    assert set(g) == {"student 1", "student 2"}


# ------------------------------------------------------------------ AI input

def test_images_are_sent_as_images_and_shrunk():
    from PIL import Image
    img = Image.new("RGB", (4000, 3000), "white")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    blocks = ai_grader._file_blocks("حل", "page.png", buf.getvalue())
    assert blocks[1]["type"] == "image"
    import base64
    small = Image.open(io.BytesIO(base64.b64decode(blocks[1]["source"]["data"])))
    assert max(small.size) <= ai_grader.MAX_IMAGE_SIDE


def test_exam_context_mentions_subject_structure_language():
    ctx = ai_grader.exam_context(label="فيزياء · 5 وحدات", structure="من الأسئلة 1, 2 يُحسب 1", language="he")
    assert "فيزياء" in ctx and "يُحسب 1" in ctx and "العبرية" in ctx


# --------------------------------------------------------------------- web

def test_grade_photos_with_structure_and_library(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    seen = {}

    def fake_submission(reference_blocks, name, files):
        seen[name] = [f for f, _ in files]
        seen["context"] = reference_blocks[0]["text"]
        return {"general_feedback": "", "questions": [
            {"qid": q, "description": "", "max_points": 25, "score": sc, "student_answer": "x",
             "feedback": "", "confident": True} for q, sc in (("1", 20), ("2", 25), ("3", 10), ("4", 25))]}
    monkeypatch.setattr(ai_grader, "grade_submission", fake_submission)

    r = client.post("/grade", data={
        "csrf": client.csrf, "subject": "physics", "units": "5", "questionnaire": "036361",
        "year": "2025", "season": "summer", "language": "he", "structure": "1,2,3 = 2",
        "save_to_library": "1",
    }, files=[
        ("rubric", ("מחוון.pdf", b"%PDF-1.4 fake", "application/pdf")),
        ("students", ("أحمد_1.jpg", b"img1", "image/jpeg")),
        ("students", ("أحمد_2.jpg", b"img2", "image/jpeg")),
    ], follow_redirects=False)
    assert r.status_code == 303, r.text
    page = wait_done(client, r.headers["location"])
    assert "فيزياء" in page.text
    job = storage.load_job(r.headers["location"].rsplit("/", 1)[1])
    s = job["students"][0]
    assert seen["أحمد"] == ["أحمد_1.jpg", "أحمد_2.jpg"]
    assert "שאלון 036361" in seen["context"] and "العبرية" in seen["context"]
    # questions 1,2 count (first two answered), 3 does not, 4 is outside the structure
    assert [i["counted"] for i in s["items"]] == [True, True, False, True]
    assert s["total"] == 70 and s["max_points"] == 75 and s["grade"] == 93
    assert "لا يُحسب" in client.get(r.headers["location"] + "/students/0").text

    # saved to the library: grade again by choosing it, without uploading anything
    entries = library.list_entries("physics")
    assert len(entries) == 1 and entries[0]["structure_text"] == "1,2,3 = 2"
    assert "036361" in client.get("/library").text
    r = client.post("/grade", data={"csrf": client.csrf, "library_id": entries[0]["id"]}, files=[
        ("students", ("ليلى.pdf", b"%PDF-1.4", "application/pdf"))], follow_redirects=False)
    job2 = storage.load_job(r.headers["location"].rsplit("/", 1)[1])
    wait_done(client, r.headers["location"])
    job2 = storage.load_job(job2["id"])
    assert job2["meta"]["questionnaire"] == "036361" and job2["structure"][0]["required"] == 2
    assert job2["files"]["rubric"] == "מחוון.pdf"


def test_library_add_download_delete(client):
    r = client.post("/library", data={"csrf": client.csrf, "subject": "math", "units": "5",
                                      "questionnaire": "035582", "year": "2024", "season": "winter",
                                      "structure": "1-3 = 2\n4,5 = 1"},
                    files=[("exam", ("exam.pdf", b"%PDF exam", "application/pdf")),
                           ("rubric", ("rubric.pdf", b"%PDF rubric", "application/pdf"))],
                    follow_redirects=False)
    assert r.status_code == 303
    page = client.get("/library?subject=math").text
    assert "035582" in page and "من الأسئلة 1, 2, 3 تُحسب 2" in page
    entry = library.list_entries("math")[0]
    assert client.get(f"/library/{entry['id']}/exam").content == b"%PDF exam"
    assert client.get(f"/library/{entry['id']}/solution").status_code == 404
    assert client.get("/library?subject=history").text.count("صحّح به") == 0
    # the grading form offers it
    assert entry["id"] in client.get("/").text
    r = client.post(f"/library/{entry['id']}/delete", data={"csrf": client.csrf}, follow_redirects=False)
    assert r.status_code == 303 and library.list_entries() == []


def test_library_validation(client):
    r = client.post("/library", data={"csrf": client.csrf, "subject": "math"},
                    files=[("exam", ("exam.pdf", b"%PDF", "application/pdf"))])
    assert r.status_code == 400 and "سلم تصحيح أو امتحان محلول" in r.text
    r = client.post("/library", data={"csrf": client.csrf, "subject": "math", "structure": "1,2 = 5"},
                    files=[("rubric", ("r.pdf", b"%PDF", "application/pdf"))])
    assert r.status_code == 400
    r = client.post("/library", data={"csrf": client.csrf, "subject": "nope"},
                    files=[("rubric", ("r.pdf", b"%PDF", "application/pdf"))])
    assert r.status_code == 400


def test_only_owner_or_admin_deletes_library_entry(client):
    from app import auth
    entry = library.create_entry({"subject": "math", "created_by": "admin"},
                                 {"rubric": ("r.pdf", b"%PDF")})
    client.post("/users", data={"username": "teach1", "password": "password1", "csrf": client.csrf})
    client.cookies.clear()
    client.post("/login", data={"username": "teach1", "password": "password1"})
    token = csrf_of(client)
    assert client.post(f"/library/{entry['id']}/delete", data={"csrf": token}).status_code == 403
    assert library.get_entry(entry["id"])


def test_bad_structure_rejected_on_grade(client):
    r = client.post("/grade", data={"csrf": client.csrf, "structure": "1,2 ="}, files=[
        ("rubric", ("rubric.xlsx", rubric_bytes([["1", "", "", "A1", 5, "قيمة", None, None, "1", None]]), XLSX)),
        ("students", ("a.xlsx", xlsx({"A1": 1}), XLSX))])
    assert r.status_code == 400 and "مبنى الامتحان" in r.text


def test_structure_with_excel_rubric(client):
    rows = [[q, "", "", f"A{q}", 10, "قيمة", None, None, "1", None] for q in ("1", "2", "3")]
    r = client.post("/grade", data={"csrf": client.csrf, "structure": "1,2,3 = 2 الأفضل"}, files=[
        ("rubric", ("rubric.xlsx", rubric_bytes(rows), XLSX)),
        ("students", ("a.xlsx", xlsx({"A1": 1, "A2": 0, "A3": 1}), XLSX))], follow_redirects=False)
    wait_done(client, r.headers["location"])
    s = storage.load_job(r.headers["location"].rsplit("/", 1)[1])["students"][0]
    assert s["grade"] == 100 and s["max_points"] == 20
