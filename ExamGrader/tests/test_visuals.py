from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

from app import grader
from app.excel_reader import ExcelFile
from app.rubric import CHECK_CHART, CHECK_PIVOT, parse_rubric
from app.visuals import SpecError, parse_pivot_spec

from .helpers import rubric_bytes

FIX = Path(__file__).parent / "fixtures"


def chart_book(kind="column", col=2, extra_sheet=False, chart=True) -> bytes:
    """Names in A2:A6, scores in B2:B6 and C2:C6; optional chart of column `col`."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Data"
    ws.append(["name", "math", "science"])
    for i in range(5):
        ws.append([f"s{i}", 60 + i * 5, 70 + i])
    if chart:
        c = {"column": BarChart, "bar": BarChart, "line": LineChart, "pie": PieChart}[kind]()
        if kind == "bar":
            c.type = "bar"
        target = wb.create_sheet("Chart") if extra_sheet else ws
        c.add_data(Reference(ws, min_col=col, min_row=1, max_row=6), titles_from_data=True)
        c.set_categories(Reference(ws, min_col=1, min_row=2, max_row=6))
        target.add_chart(c, "E2")
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def one_item(row) -> object:
    return parse_rubric(rubric_bytes([row]))


def grade(rubric, student: bytes, key: bytes | None = None):
    k = ExcelFile(key, recalc=False) if key else None
    s = grader.grade_excel_student("t", "t.xlsx", student, rubric, k)
    return s["items"][0]


# --------------------------------------------------------------------- charts

def test_chart_rubric_row_parses_without_cell():
    r = one_item(["1", "رسم", None, None, 10, "رسم بياني", None, None, None, None])
    assert r.items[0].check == CHECK_CHART and r.items[0].cell == "*"


def test_chart_full_marks_from_rubric_spec():
    r = one_item(["1", "رسم", None, "B2:B6", 10, "رسم بياني", None, None, "أعمدة", None])
    item = grade(r, chart_book("column"))
    assert item["score"] == 10, item["feedback"]
    assert "أعمدة" in item["student_answer"]


def test_chart_on_another_sheet_is_found():
    r = one_item(["1", "رسم", None, "Data!B2:B6", 10, "رسم بياني", None, None, "column", None])
    assert grade(r, chart_book(extra_sheet=True))["score"] == 10


def test_chart_wrong_type_and_wrong_data():
    r = one_item(["1", "رسم", None, "B2:B6", 10, "رسم بياني", None, None, "أعمدة", None])
    item = grade(r, chart_book("line"))
    assert item["score"] == 7  # exists 4 + data 3
    assert "خطي" in item["feedback"]
    item = grade(r, chart_book("column", col=3))
    assert item["score"] == 7  # exists 4 + type 3
    assert "B2:B6" in item["feedback"]


def test_chart_alternative_types():
    r = one_item(["1", "رسم", None, "*", 10, "رسم بياني", None, None, "أعمدة|أشرطة", None])
    assert grade(r, chart_book("bar"))["score"] == 10


def test_no_chart():
    r = one_item(["1", "رسم", None, "*", 10, "رسم بياني", None, None, None, None])
    item = grade(r, chart_book(chart=False))
    assert item["score"] == 0 and "لا يوجد رسم" in item["feedback"]
    # with nothing to compare, any chart gets full marks
    assert grade(r, chart_book("pie"))["score"] == 10


def test_chart_compared_with_answer_key():
    r = one_item(["1", "رسم", None, None, 10, "رسم بياني", None, None, None, None])
    key = chart_book("pie")
    assert grade(r, chart_book("pie"), key)["score"] == 10
    assert grade(r, chart_book("column"), key)["score"] == 7
    assert grade(r, chart_book("pie", col=3), key)["score"] == 7


def test_bad_chart_type_in_rubric_goes_to_review():
    r = one_item(["1", "رسم", None, "*", 10, "رسم بياني", None, None, "سحري", None])
    assert grade(r, chart_book())["status"] == grader.STATUS_REVIEW


def test_header_row_included_in_selection_still_matches():
    r = one_item(["1", "رسم", None, "B1:B6", 10, "رسم بياني", None, None, None, None])
    assert grade(r, chart_book())["score"] == 10


# --------------------------------------------------------------------- pivots

def fx(name) -> bytes:
    return (FIX / f"pivot_{name}.xlsx").read_bytes()


def test_parse_pivot_spec():
    s = parse_pivot_spec("صفوف: الشعبة; قيم: متوسط(العلامة), عدد(الاسم)")
    assert s.rows == ["الشعبة"] and s.columns is None
    assert s.values == [("العلامة", "average"), ("الاسم", "count")]
    assert parse_pivot_spec("rows: Class; values: Score").values == [("Score", None)]
    with pytest.raises(SpecError):
        parse_pivot_spec("صفوف الشعبة")
    with pytest.raises(SpecError):
        parse_pivot_spec("قيم: سحر(Score)")


@pytest.mark.parametrize("name,score", [("good", 10), ("sum", 8.5), ("rows", 7), ("none", 0)])
def test_pivot_against_answer_key(name, score):
    r = one_item(["1", "محوري", None, None, 10, "جدول محوري", None, None, None, None])
    item = grade(r, fx(name), fx("key"))
    assert item["score"] == score, item["feedback"]


def test_pivot_against_rubric_spec():
    r = one_item(["1", "محوري", None, None, 10, "جدول محوري", None, None,
                  "صفوف: Class; قيم: متوسط(Score)", None])
    assert grade(r, fx("good"))["score"] == 10
    item = grade(r, fx("sum"))
    assert item["score"] == 8.5 and "مجموع" in item["feedback"] and "متوسط" in item["feedback"]


def test_pivot_any_function_when_not_specified():
    r = one_item(["1", "محوري", None, None, 10, "جدول محوري", None, None, "صفوف: Class; قيم: Score", None])
    assert grade(r, fx("sum"))["score"] == 10


def test_pivot_check_type_alias():
    r = one_item(["1", "", None, None, 10, "pivot", None, None, None, None])
    assert r.items[0].check == CHECK_PIVOT


def test_ai_text_lists_charts_and_pivots():
    text = ExcelFile(fx("good"), recalc=False).as_text()
    assert "جدول محوري" in text and "Class" in text
    assert "رسم أعمدة" in ExcelFile(chart_book()).as_text()


def test_range_matching_rules():
    from app.visuals import _same_range
    assert _same_range((None, "B2:B6"), ("Data", "B2:B6"))
    assert _same_range((None, "B1:B6"), (None, "B2:B6"))       # header row
    assert _same_range((None, "B2:C6"), (None, "C2:C6"))       # header column
    assert not _same_range((None, "B2:B6"), (None, "B2:B100"))
    assert not _same_range((None, "B2:B6"), (None, "B2:B7"))   # extra row at the bottom is real data
    assert not _same_range(("Data", "B2:B6"), ("Other", "B2:B6"))
