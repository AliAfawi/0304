from io import BytesIO

import pytest
from openpyxl import Workbook

from app import ai_grader, grader
from app.excel_reader import ExcelFile
from app.reports import class_stats, export_grades_xlsx, similarity_flags
from app.rubric import (CHECK_AI, CHECK_FORMULA, CHECK_TEXT, CHECK_VALUE, RubricError,
                        build_template, parse_rubric)

from .helpers import rubric_bytes, xlsx

# A tiny "exam": B1:B3 are numbers, B4 is their average, B5 a name, B6 an explanation.
KEY = {"B1": 10, "B2": 20, "B3": 30, "B4": ("=AVERAGE(B1:B3)", 20), "B5": "سارة",
       "B6": "القيم المتطرفة تؤثر على المتوسط"}
RUBRIC_ROWS = [
    ["1", "الأرقام", "Sheet", "B1:B3", 30, "قيمة", None, None, None, None],
    ["2", "المتوسط", "Sheet", "B4", 20, "معادلة", 0.01, "AVERAGE", None, None],
    ["3", "الاسم", "Sheet", "B5", 10, "نص", None, None, "سارة|ساره", None],
    ["4", "تفسير", "Sheet", "B6", 10, "ذكاء اصطناعي", None, None, None, "اذكر القيم المتطرفة"],
]


@pytest.fixture
def rubric():
    return parse_rubric(rubric_bytes(RUBRIC_ROWS))


@pytest.fixture
def key():
    return ExcelFile(xlsx(KEY))


@pytest.fixture(autouse=True)
def no_ai(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)


def by_qid(student):
    return {i["qid"]: i for i in student["items"]}


# ------------------------------------------------------------------ rubric

def test_parse_rubric_types(rubric):
    assert [i.check for i in rubric.items] == [CHECK_VALUE, CHECK_FORMULA, CHECK_TEXT, CHECK_AI]
    assert rubric.total_points == 70
    assert rubric.items[0].tolerance == 0.01  # default


def test_template_is_a_valid_rubric():
    assert len(parse_rubric(build_template()).items) == 7


def test_rubric_missing_columns():
    wb = Workbook()
    wb.active.append(["شيء", "آخر"])
    buf = BytesIO()
    wb.save(buf)
    with pytest.raises(RubricError, match="أعمدة ناقصة"):
        parse_rubric(buf.getvalue())


def test_rubric_unknown_check_type():
    with pytest.raises(RubricError, match="نوع فحص"):
        parse_rubric(rubric_bytes([["1", "", "", "A1", 5, "سحر", None, None, None, None]]))


def test_english_headers():
    wb = Workbook()
    ws = wb.active
    ws.append(["Question", "Cell", "Points", "Check"])
    ws.append(["1", "a1", 5, "formula"])
    buf = BytesIO()
    wb.save(buf)
    r = parse_rubric(buf.getvalue())
    assert r.items[0].cell == "A1" and r.items[0].check == CHECK_FORMULA


# ------------------------------------------------------------------ grading

def test_perfect_student(rubric, key):
    s = grader.grade_excel_student("طالب", "x.xlsx", xlsx(KEY), rubric, key)
    items = by_qid(s)
    assert items["1"]["score"] == 30
    assert items["2"]["score"] == 20
    assert items["3"]["score"] == 10
    # open question without an API key -> teacher review
    assert items["4"]["status"] == grader.STATUS_REVIEW
    assert s["needs_review"]
    assert s["total"] == 60 and s["max_points"] == 70


def test_partial_range_and_hardcoded_value(rubric, key):
    student = dict(KEY, B2=99, B4=20)  # one wrong number; average typed, not calculated
    s = grader.grade_excel_student("طالب", "x.xlsx", xlsx(student), rubric, key)
    items = by_qid(s)
    assert items["1"]["score"] == 20  # 2 of 3 cells
    assert items["1"]["status"] == grader.STATUS_PARTIAL
    assert items["2"]["score"] == 10  # right value, no formula -> half
    assert "معادلة" in items["2"]["feedback"]


def test_error_carried_forward_not_punished_twice(rubric, key):
    # B2 is wrong, so the (correct) AVERAGE formula gives a different value.
    student = dict(KEY, B2=50, B4=("=AVERAGE(B1:B3)", 30))
    s = grader.grade_excel_student("طالب", "x.xlsx", xlsx(student), rubric, key)
    items = by_qid(s)
    assert items["1"]["score"] == 20
    assert items["2"]["score"] == 20
    assert "لم يُخصم مرة ثانية" in items["2"]["feedback"]


def test_wrong_formula_function(rubric, key):
    student = dict(KEY, B4=("=SUM(B1:B3)/3", 20))
    items = by_qid(grader.grade_excel_student("t", "x.xlsx", xlsx(student), rubric, key))
    assert items["2"]["score"] == 10
    assert "AVERAGE" in items["2"]["feedback"]


def test_text_normalisation(rubric, key):
    items = by_qid(grader.grade_excel_student("t", "x.xlsx", xlsx(dict(KEY, B5="  ساره ")), rubric, key))
    assert items["3"]["score"] == 10


def test_numeric_tolerance_and_strings():
    assert grader.values_match("20.004", 20, 0.01)
    assert not grader.values_match(20.5, 20, 0.01)
    assert grader.values_match("25%", 0.25, 0.001)
    assert grader.values_match("1,200", 1200, 0)


def test_missing_sheet_and_bad_file(rubric, key):
    wb = Workbook()
    wb.active.title = "Other"
    buf = BytesIO()
    wb.save(buf)
    s = grader.grade_excel_student("t", "x.xlsx", buf.getvalue(), rubric, key)
    assert s["total"] == 0
    assert "غير موجودة" in s["items"][0]["feedback"]

    s = grader.grade_excel_student("t", "x.xlsx", b"not excel", rubric, key)
    assert s["error"] and s["needs_review"]


def test_ai_item_graded_with_mock(monkeypatch, rubric, key):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    calls = []

    def fake(**kw):
        calls.append(kw)
        return ai_grader.AIItemResult(score=7.5, feedback="جيد", confident=True)
    monkeypatch.setattr(ai_grader, "grade_open_answer", fake)
    items = by_qid(grader.grade_excel_student("t", "x.xlsx", xlsx(KEY), rubric, key))
    assert items["4"]["score"] == 7.5
    assert items["4"]["status"] == grader.STATUS_PARTIAL
    assert calls[0]["notes"] == "اذكر القيم المتطرفة"
    assert calls[0]["expected"] == KEY["B6"]


def test_ai_unsure_goes_to_review(monkeypatch, rubric, key):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(ai_grader, "grade_open_answer",
                        lambda **kw: ai_grader.AIItemResult(score=10, feedback="?", confident=False))
    items = by_qid(grader.grade_excel_student("t", "x.xlsx", xlsx(KEY), rubric, key))
    assert items["4"]["status"] == grader.STATUS_REVIEW


def test_expected_from_rubric_without_key():
    r = parse_rubric(rubric_bytes([["1", "", "", "A1", 5, "قيمة", None, None, "42", None]]))
    s = grader.grade_excel_student("t", "x.xlsx", xlsx({"A1": 42}), r, None)
    assert s["total"] == 5


# ------------------------------------------------------------------ reports

def test_stats_similarity_and_export(rubric, key):
    copy = dict(KEY, B2=99, B5="أحمد")
    students = [
        grader.grade_excel_student("أ", "a.xlsx", xlsx(KEY), rubric, key),
        grader.grade_excel_student("ب", "b.xlsx", xlsx(copy), rubric, key),
        grader.grade_excel_student("ج", "c.xlsx", xlsx(copy), rubric, key),
    ]
    stats = class_stats(students)
    assert stats["count"] == 3
    assert stats["hardest"][0]["qid"] == "4"
    flags = similarity_flags(students)
    assert len(flags) == 1 and {flags[0]["a"], flags[0]["b"]} == {"ب", "ج"}

    data = export_grades_xlsx({"title": "t", "students": students})
    from openpyxl import load_workbook
    wb = load_workbook(BytesIO(data))
    assert wb.sheetnames == ["العلامات", "تفاصيل", "إحصائيات"]
    assert wb["العلامات"].max_row == 4
