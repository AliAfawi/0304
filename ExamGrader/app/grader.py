"""The grading engine: compares each student's workbook with the answer key."""
from __future__ import annotations

import math
import re
import unicodedata
from datetime import date, datetime, time

from . import ai_grader
from .excel_reader import CellData, ExcelFile, WorkbookError
from .rubric import (CHECK_AI, CHECK_CHART, CHECK_FORMULA, CHECK_PIVOT, CHECK_TEXT,
                     CHECK_VALUE, Rubric, RubricItem)

STATUS_CORRECT = "correct"
STATUS_PARTIAL = "partial"
STATUS_WRONG = "wrong"
STATUS_REVIEW = "review"  # teacher should look at this one

PASS_MARK = 55

# ------------------------------------------------------------------ helpers

_ARABIC_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
_HEBREW_POINTS = re.compile(r"[֑-ׇ]")


def normalize_text(value) -> str:
    s = "" if value is None else str(value)
    s = unicodedata.normalize("NFKC", s)
    s = _ARABIC_DIACRITICS.sub("", s)
    s = _HEBREW_POINTS.sub("", s)
    s = re.sub("[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    return " ".join(s.casefold().split())


def to_number(value) -> float | None:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return None if (isinstance(value, float) and math.isnan(value)) else float(value)
    if isinstance(value, str):
        s = value.strip().replace(",", "").replace("٫", ".")
        percent = s.endswith("%")
        if percent:
            s = s[:-1].strip()
        try:
            n = float(s)
        except ValueError:
            return None
        return n / 100 if percent else n
    return None


def display(value) -> str:
    if value is None:
        return "(فارغ)"
    if isinstance(value, float):
        return f"{value:.4f}".rstrip("0").rstrip(".") if not value.is_integer() else str(int(value))
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return str(value)


def values_match(student, expected, tolerance: float) -> bool:
    if expected is None:
        return student is None or str(student).strip() == ""
    if isinstance(expected, (datetime, date)) or isinstance(student, (datetime, date)):
        return student == expected
    e_num, s_num = to_number(expected), to_number(student)
    if e_num is not None and s_num is not None:
        return abs(e_num - s_num) <= tolerance + 1e-9
    return normalize_text(student) == normalize_text(expected)


def _uses_function(formula: str | None, functions: list[str]) -> bool:
    if not formula:
        return False
    if not functions:
        return True
    upper = formula.upper()
    return any(re.search(rf"(?<![A-Z0-9_.]){re.escape(f)}\s*\(", upper) for f in functions)


def normalize_formula(formula: str | None) -> str | None:
    if not formula:
        return None
    return re.sub(r"\s+", "", formula.replace("$", "")).upper()


def _carried_forward(cell: CellData, key_formula: str | None) -> bool:
    """Same formula as the model answer, so a wrong value comes from an
    earlier mistake: do not take marks off a second time."""
    return bool(cell.formula) and normalize_formula(cell.formula) == normalize_formula(key_formula)


ECF_NOTE = "القيمة مختلفة بسبب خطأ في بند سابق، لكن المعادلة صحيحة فلم يُخصم مرة ثانية"


def _round(x: float) -> float:
    return round(x + 1e-9, 2)


def _status(score: float, points: float) -> str:
    if points <= 0:
        return STATUS_CORRECT
    if score >= points - 1e-9:
        return STATUS_CORRECT
    if score <= 1e-9:
        return STATUS_WRONG
    return STATUS_PARTIAL


# ------------------------------------------------------------ expected values

def _expected_values(item: RubricItem, key: ExcelFile | None, n_cells: int) -> tuple[list, list]:
    """(expected values, model-answer formulas) for each cell of the item."""
    key_cells = None
    if key is not None:
        try:
            key_cells = key.cells(item.sheet, item.cell)
        except WorkbookError:
            if item.expected is None:
                raise
    formulas = [c.formula for c in key_cells] if key_cells else [None] * n_cells
    if item.expected is not None:
        parts = [p.strip() for p in item.expected.split(";")]
        if n_cells > 1 and len(parts) == n_cells:
            return parts, formulas
        return [item.expected] * n_cells, formulas
    if key_cells is None:
        raise WorkbookError("لا يوجد امتحان محلول بصيغة Excel ولا إجابة متوقعة في سلم التصحيح")
    return [c.value for c in key_cells], formulas


# ------------------------------------------------------------------ checkers

def _check_values(item, cells: list[CellData], expected: list, key_formulas: list) -> tuple[float, str]:
    exact = [values_match(c.value, e, item.tolerance) for c, e in zip(cells, expected)]
    ecf = [not g and _carried_forward(c, f) for c, g, f in zip(cells, exact, key_formulas)]
    ok = [g or e for g, e in zip(exact, ecf)]
    frac = sum(ok) / len(ok)
    wrong = [f"{c.ref}: كتبت {display(c.value)} والمتوقع {display(e)}"
             for c, e, good in zip(cells, expected, ok) if not good]
    if not wrong:
        return frac, ECF_NOTE if any(ecf) else "إجابة صحيحة"
    head = "؛ ".join(wrong[:4]) + (f" (و{len(wrong) - 4} خلايا أخرى)" if len(wrong) > 4 else "")
    if len(cells) > 1:
        return frac, f"{sum(ok)} من {len(cells)} خلايا صحيحة. {head}"
    return frac, head


def _check_formula(item, cells: list[CellData], expected: list, key_formulas: list) -> tuple[float, str]:
    functions = [f.strip().upper() for f in (item.function or "").split(",") if f.strip()]
    exact = [values_match(c.value, e, item.tolerance) for c, e in zip(cells, expected)]
    ecf = [not g and _carried_forward(c, f) for c, g, f in zip(cells, exact, key_formulas)]
    value_ok = [g or e for g, e in zip(exact, ecf)]
    formula_ok = [_uses_function(c.formula, functions) for c in cells]
    frac = 0.5 * sum(value_ok) / len(cells) + 0.5 * sum(formula_ok) / len(cells)
    notes = []
    if not all(value_ok):
        bad = [f"{c.ref}: {display(c.value)} بدل {display(e)}"
               for c, e, good in zip(cells, expected, value_ok) if not good]
        notes.append("القيمة غير صحيحة (" + "؛ ".join(bad[:3]) + ")")
    if not all(formula_ok):
        no_formula = [c.ref for c, good in zip(cells, formula_ok) if not good]
        hardcoded = [c.ref for c, good in zip(cells, formula_ok) if not good and not c.formula]
        wrong_fn = [r for r in no_formula if r not in hardcoded]
        if hardcoded:
            notes.append(f"كُتبت قيمة ثابتة بدل معادلة في: {', '.join(hardcoded[:5])}")
        if wrong_fn:
            notes.append(f"لم تُستعمل الدالة المطلوبة ({', '.join(functions)}) في: {', '.join(wrong_fn[:5])}")
    if any(ecf):
        notes.append(ECF_NOTE)
    return frac, "؛ ".join(notes) if notes else "إجابة صحيحة باستعمال معادلة مناسبة"


def _check_text(item, cells: list[CellData], expected: list, key_formulas: list) -> tuple[float, str]:
    ok = []
    for c, e in zip(cells, expected):
        options = [normalize_text(o) for o in str(e if e is not None else "").split("|")]
        ok.append(normalize_text(c.value) in options)
    frac = sum(ok) / len(ok)
    if all(ok):
        return frac, "إجابة صحيحة"
    bad = [f"{c.ref}: كتبت «{display(c.value)}» والمتوقع «{display(e)}»"
           for c, e, good in zip(cells, expected, ok) if not good]
    return frac, "؛ ".join(bad[:4])


MAX_SHOWN = 12


def _answer_lines(cells: list[CellData], values: list | None = None) -> str:
    """One line per cell: "D2: 81.5  (=AVERAGE(B2:C2))". The cell name is
    only shown for ranges; formulas only for the student's own answer."""
    lines = []
    for i, c in enumerate(cells[:MAX_SHOWN]):
        v = display(values[i] if values is not None else c.value)
        if values is None and c.formula:
            v += f"  ({c.formula})"
        lines.append(f"{c.ref}: {v}" if len(cells) > 1 else v)
    if len(cells) > MAX_SHOWN:
        lines.append(f"… و{len(cells) - MAX_SHOWN} خلايا أخرى")
    return "\n".join(lines)


def _grade_item(item: RubricItem, student: ExcelFile, key: ExcelFile | None, context: str = "") -> dict:
    result = {
        "qid": item.qid, "description": item.description, "check": item.check,
        "cell": f"{item.sheet + '!' if item.sheet else ''}{item.cell}",
        "points": item.points, "score": 0.0, "status": STATUS_WRONG,
        "student_answer": "", "expected_answer": "", "feedback": "", "ai": False,
    }
    if item.check in (CHECK_CHART, CHECK_PIVOT):
        from . import visuals  # imported here: visuals uses helpers from this module

        g = (visuals.grade_chart if item.check == CHECK_CHART else visuals.grade_pivot)(item, student, key)
        score = _round(item.points * g.fraction)
        result.update(score=score, feedback=g.feedback, student_answer=g.student_answer,
                      expected_answer=g.expected_answer,
                      status=STATUS_REVIEW if g.review else _status(score, item.points),
                      cell=item.sheet or "")
        return result

    try:
        cells = student.cells(item.sheet, item.cell)
    except WorkbookError as exc:
        result["feedback"] = str(exc)
        return result
    except ValueError:
        result.update(status=STATUS_REVIEW, feedback=f"عنوان خلية غير صالح في سلم التصحيح: {item.cell}")
        return result

    result["student_answer"] = _answer_lines(cells)

    try:
        expected, key_formulas = _expected_values(item, key, len(cells))
    except (WorkbookError, ValueError) as exc:
        result.update(status=STATUS_REVIEW, feedback=f"تعذر قراءة الإجابة الصحيحة: {exc}")
        return result
    result["expected_answer"] = _answer_lines(cells, expected)

    if item.check == CHECK_AI:
        return _grade_ai_item(item, cells, expected, result, context)

    checker = {CHECK_VALUE: _check_values, CHECK_FORMULA: _check_formula,
               CHECK_TEXT: _check_text}[item.check]
    frac, feedback = checker(item, cells, expected, key_formulas)
    score = _round(item.points * frac)
    result.update(score=score, status=_status(score, item.points), feedback=feedback)
    if any(c.formula and c.value is None for c in cells):
        result["status"] = STATUS_REVIEW
        result["feedback"] += " — تنبيه: في الملف معادلات بلا قيم محسوبة؛ افتح الملف في Excel واحفظه ثم أعد التصحيح"
    return result


def _grade_ai_item(item: RubricItem, cells: list[CellData], expected: list, result: dict,
                   context: str = "") -> dict:
    answer = "\n".join(display(c.value) for c in cells if c.value not in (None, ""))
    result["ai"] = True
    if not answer.strip():
        result.update(score=0.0, status=STATUS_WRONG, feedback="لم يكتب الطالب إجابة")
        return result
    if not ai_grader.ai_available():
        result.update(status=STATUS_REVIEW,
                      feedback="سؤال مفتوح يحتاج تصحيحاً يدوياً (لم يتم إعداد مفتاح الذكاء الاصطناعي)")
        return result
    try:
        ai = ai_grader.grade_open_answer(
            question=item.description, expected="\n".join(display(e) for e in expected),
            notes=item.notes, student_answer=answer, points=item.points, context=context,
        )
    except ai_grader.AIError as exc:
        result.update(status=STATUS_REVIEW, feedback=f"تعذر التصحيح الآلي: {exc}")
        return result
    score = _round(ai.score)
    result.update(score=score, feedback=ai.feedback,
                  status=_status(score, item.points) if ai.confident else STATUS_REVIEW)
    return result


# ------------------------------------------------------------------ students

def summarize(student: dict, sections: list | None = None) -> dict:
    """Recompute totals from the item scores (also after teacher edits).
    With an exam structure, only the questions that count are added up."""
    from .structure import apply_structure

    if sections is not None:
        apply_structure(student, sections)
    items = student["items"]
    counted = [i for i in items if i.get("counted", True)]
    total = _round(sum(i["score"] for i in counted))
    max_points = student.get("section_max")
    if max_points is None:
        max_points = _round(sum(i["points"] for i in items))
    student["total"] = total
    student["max_points"] = max_points
    student["grade"] = min(100, round(100 * total / max_points)) if max_points else 0
    student["needs_review"] = (not student.get("reviewed")) and (
        bool(student.get("error")) or any(i["status"] == STATUS_REVIEW for i in counted))
    return student


def _new_student(name: str, filenames: list[str], mode: str) -> dict:
    return {"name": name, "filename": "، ".join(filenames), "files": filenames, "mode": mode,
            "items": [], "error": None, "general_feedback": "", "teacher_comment": "", "reviewed": False}


def grade_excel_student(name: str, filename: str, data: bytes, rubric: Rubric,
                        key: ExcelFile | None, sections: list | None = None, context: str = "") -> dict:
    student = _new_student(name, [filename], "rubric")
    try:
        wb = ExcelFile(data)
    except WorkbookError as exc:
        student["error"] = str(exc)
        student["items"] = [{
            "qid": i.qid, "description": i.description, "check": i.check, "cell": i.cell,
            "points": i.points, "score": 0.0, "status": STATUS_REVIEW, "student_answer": "",
            "expected_answer": "", "feedback": "تعذر فتح ملف الطالب", "ai": False,
        } for i in rubric.items]
        return summarize(student, sections)
    student["items"] = [_grade_item(item, wb, key, context) for item in rubric.items]
    return summarize(student, sections)


def grade_ai_student(name: str, files: list[tuple[str, bytes]], reference_blocks: list[dict],
                     sections: list | None = None) -> dict:
    student = _new_student(name, [f for f, _ in files], "ai")
    try:
        out = ai_grader.grade_submission(reference_blocks, name, files)
    except (ai_grader.AIError, ValueError) as exc:
        student["error"] = f"تعذر التصحيح: {exc}"
        return summarize(student, sections)
    student["general_feedback"] = out.get("general_feedback", "")
    for q in out["questions"]:
        score = _round(q["score"])
        points = float(q["max_points"])
        student["items"].append({
            "qid": str(q["qid"]).strip(), "description": q["description"], "check": "ai", "cell": "",
            "points": points, "score": score,
            "status": _status(score, points) if q["confident"] else STATUS_REVIEW,
            "student_answer": q["student_answer"], "expected_answer": "",
            "feedback": q["feedback"], "ai": True,
        })
    return summarize(student, sections)
