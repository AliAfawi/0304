"""Grading charts and pivot tables.

Both are graded in parts, so a student who built the right kind of object
with a small mistake still gets partial credit:

chart:  exists 40% · chart type 30% · plotted data 30%
pivot:  exists 40% · row/column fields 30% · value fields + function 30%

A part that the rubric and the answer key don't specify is skipped and its
weight goes to the parts that are checked.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from openpyxl.utils.cell import range_boundaries

from .excel_reader import CHART_KINDS, ChartInfo, ExcelFile, PivotInfo, WorkbookError, parse_ref
from .grader import normalize_text

W_EXISTS, W_SHAPE, W_DATA = 0.4, 0.3, 0.3

CHART_ALIASES = {
    "column": {"column", "col", "أعمدة", "اعمدة", "عمودي", "عمود", "עמודות"},
    "bar": {"bar", "أشرطة", "اشرطة", "شريطي", "أفقي", "افقي", "פסים", "עמודות אופקיות"},
    "line": {"line", "خطي", "خط", "קו", "קווי"},
    "pie": {"pie", "دائري", "دائرة", "قطاعات", "עוגה"},
    "doughnut": {"doughnut", "حلقي", "דונאט", "טבעת"},
    "scatter": {"scatter", "انتشار", "نقاط", "مبعثر", "פיזור"},
    "area": {"area", "مساحي", "مساحة", "שטח"},
    "radar": {"radar", "راداري", "رادار", "רדאר"},
}

FUNCTION_ALIASES = {
    "average": {"average", "avg", "mean", "متوسط", "معدل", "المتوسط", "ממוצע"},
    "sum": {"sum", "مجموع", "المجموع", "جمع", "סכום"},
    "count": {"count", "countnums", "عدد", "العدد", "ספירה"},
    "max": {"max", "أكبر", "اكبر", "أعلى", "اعلى", "أقصى", "اقصى", "מקסימום"},
    "min": {"min", "أصغر", "اصغر", "أدنى", "ادنى", "מינימום"},
}
FUNCTION_LABELS = {"average": "متوسط", "sum": "مجموع", "count": "عدد", "max": "أكبر قيمة", "min": "أصغر قيمة"}

SPEC_KEYS = {
    "rows": {"صفوف", "الصفوف", "rows", "row", "שורות"},
    "columns": {"أعمدة", "اعمدة", "الأعمدة", "columns", "cols", "עמודות"},
    "values": {"قيم", "القيم", "values", "value", "ערכים"},
}


class SpecError(ValueError):
    pass


def _alias(table: dict[str, set[str]], word: str) -> str | None:
    w = normalize_text(word)
    for key, names in table.items():
        if w in {normalize_text(n) for n in names}:
            return key
    return None


@dataclass
class Graded:
    fraction: float
    feedback: str
    student_answer: str
    expected_answer: str
    review: bool = False


# --------------------------------------------------------------------- charts

def _same_range(a: tuple[str | None, str], b: tuple[str | None, str]) -> bool:
    """Same sheet (when both name one) and nearly the same cells, so a student
    who also selected the header row still matches."""
    if a[0] and b[0] and normalize_text(a[0]) != normalize_text(b[0]):
        return False
    ba, bb = range_boundaries(a[1]), range_boundaries(b[1])
    if ba == bb:
        return True
    # one range is the other plus a single header row (above) or header column (left)
    (c1, r1, c2, r2), (d1, s1, d2, s2) = sorted([ba, bb], key=lambda x: (x[2] - x[0] + 1) * (x[3] - x[1] + 1))
    header_row = (c1, c2, r2) == (d1, d2, s2) and s1 == r1 - 1
    header_col = (r1, r2, c2) == (s1, s2, d2) and d1 == c1 - 1
    return header_row or header_col


def _expected_ranges(cell: str) -> list[tuple[str | None, str]]:
    if not cell or cell.strip() == "*":
        return []
    out = []
    for part in re.split(r"[,،]", cell):
        parsed = parse_ref(part.strip())
        if parsed is None:
            raise SpecError(f"نطاق غير صالح في سلم التصحيح: {part.strip()}")
        out.append(parsed)
    return out


def _score_chart(ch: ChartInfo, kinds: set[str], ranges: list) -> tuple[float, list[str]]:
    weights, got, notes = W_EXISTS, W_EXISTS, []
    if kinds:
        weights += W_SHAPE
        if ch.kind in kinds:
            got += W_SHAPE
        else:
            wanted = " أو ".join(CHART_KINDS[k] for k in sorted(kinds))
            notes.append(f"نوع الرسم {CHART_KINDS.get(ch.kind, ch.kind)} والمطلوب {wanted}")
    if ranges:
        weights += W_DATA
        refs = ch.data_refs + ch.category_refs
        matched = [r for r in ranges if any(_same_range(r, s) for s in refs)]
        got += W_DATA * len(matched) / len(ranges)
        missing = [r[1] for r in ranges if r not in matched]
        if missing:
            plotted = ", ".join(r for _, r in ch.data_refs) or "لا شيء"
            notes.append(f"البيانات المرسومة ({plotted}) لا تشمل: {', '.join(missing)}")
    return got / weights, notes


def grade_chart(item, student: ExcelFile, key: ExcelFile | None) -> Graded:
    try:
        ranges = _expected_ranges(item.cell)
    except SpecError as exc:
        return Graded(0, str(exc), "", "", review=True)

    kinds: set[str] = set()
    if item.expected:
        for word in item.expected.split("|"):
            kind = _alias(CHART_ALIASES, word)
            if kind is None:
                return Graded(0, f"نوع رسم غير معروف في سلم التصحيح: «{word.strip()}»", "", "", review=True)
            kinds.add(kind)

    key_chart = None
    if key is not None and (not kinds or not ranges):
        try:
            key_charts = key.charts(item.sheet)
        except WorkbookError:
            key_charts = []
        if ranges:
            key_charts = [c for c in key_charts
                          if any(_same_range(r, s) for r in ranges for s in c.data_refs)] or key_charts
        key_chart = key_charts[0] if key_charts else None
    if key_chart is not None:
        kinds = kinds or {key_chart.kind}
        ranges = ranges or key_chart.data_refs

    expected_desc = "رسم " + " أو ".join(CHART_KINDS[k] for k in sorted(kinds)) if kinds else "رسم بياني"
    if ranges:
        expected_desc += " للبيانات " + ", ".join(r for _, r in ranges)

    try:
        charts = student.charts(item.sheet)
    except WorkbookError as exc:
        return Graded(0, str(exc), "", expected_desc)
    if not charts:
        where = f" في ورقة «{item.sheet}»" if item.sheet else ""
        return Graded(0, f"لا يوجد رسم بياني{where}", "(لا يوجد رسم)", expected_desc)

    best, best_notes, best_chart = -1.0, [], charts[0]
    for ch in charts:
        frac, notes = _score_chart(ch, kinds, ranges)
        if frac > best:
            best, best_notes, best_chart = frac, notes, ch
    feedback = "؛ ".join(best_notes) if best_notes else "رسم بياني صحيح"
    return Graded(best, feedback, best_chart.describe(), expected_desc)


# --------------------------------------------------------------------- pivots

@dataclass
class PivotSpec:
    rows: list[str] | None
    columns: list[str] | None
    values: list[tuple[str, str | None]] | None  # (field, function or None = any)

    def describe(self) -> str:
        parts = []
        if self.rows is not None:
            parts.append(f"صفوف [{', '.join(self.rows)}]")
        if self.columns:
            parts.append(f"أعمدة [{', '.join(self.columns)}]")
        if self.values is not None:
            vals = ", ".join(f"{FUNCTION_LABELS.get(fn, fn)}({f})" if fn else f for f, fn in self.values)
            parts.append(f"قيم [{vals}]")
        return "جدول محوري: " + "، ".join(parts) if parts else "جدول محوري"


_VALUE_RE = re.compile(r"^\s*([^()]+?)\s*\(\s*([^()]+?)\s*\)\s*$")


def parse_pivot_spec(text: str) -> PivotSpec:
    """"صفوف: الشعبة; قيم: متوسط(العلامة)" -> PivotSpec."""
    spec = PivotSpec(None, None, None)
    for part in re.split(r"[;؛\n]", text):
        if not part.strip():
            continue
        if ":" not in part:
            raise SpecError(f"صيغة غير مفهومة: «{part.strip()}». مثال: صفوف: الشعبة; قيم: متوسط(العلامة)")
        name, value = part.split(":", 1)
        key = _alias(SPEC_KEYS, name)
        if key is None:
            raise SpecError(f"«{name.strip()}» غير معروف. استعمل: صفوف، أعمدة، قيم")
        items = [v.strip() for v in re.split(r"[,،]", value) if v.strip()]
        if key == "values":
            vals = []
            for v in items:
                m = _VALUE_RE.match(v)
                if m:
                    fn = _alias(FUNCTION_ALIASES, m.group(1))
                    if fn is None:
                        raise SpecError(f"دالة غير معروفة: «{m.group(1)}». استعمل: متوسط، مجموع، عدد، أكبر، أصغر")
                    vals.append((m.group(2), fn))
                else:
                    vals.append((v, None))
            spec.values = vals
        else:
            setattr(spec, key, items)
    return spec


def _spec_from_pivot(p: PivotInfo) -> PivotSpec:
    return PivotSpec(list(p.rows), list(p.columns), [(f, fn) for f, fn in p.values])


def _names(xs) -> set[str]:
    return {normalize_text(x) for x in xs}


def _score_pivot(p: PivotInfo, spec: PivotSpec) -> tuple[float, list[str]]:
    weights, got, notes = W_EXISTS, W_EXISTS, []
    if spec.rows is not None or spec.columns is not None:
        weights += W_SHAPE
        rows_ok = spec.rows is None or _names(p.rows) == _names(spec.rows)
        cols_ok = spec.columns is None or _names(p.columns) == _names(spec.columns)
        swapped = (spec.rows is not None and spec.columns is not None and spec.columns
                   and _names(p.rows) == _names(spec.columns) and _names(p.columns) == _names(spec.rows))
        if rows_ok and cols_ok:
            got += W_SHAPE
        elif swapped:
            got += W_SHAPE / 2
            notes.append("الصفوف والأعمدة مبدّلة")
        else:
            if not rows_ok:
                notes.append(f"حقول الصفوف [{', '.join(p.rows) or '—'}] والمطلوب [{', '.join(spec.rows)}]")
            if not cols_ok:
                notes.append(f"حقول الأعمدة [{', '.join(p.columns) or '—'}] والمطلوب [{', '.join(spec.columns)}]")
    if spec.values:
        weights += W_DATA
        have = [(normalize_text(f), fn) for f, fn in p.values]
        ok = 0.0
        for field, fn in spec.values:
            same_field = [h for h in have if h[0] == normalize_text(field)]
            if not same_field:
                notes.append(f"الحقل «{field}» غير موجود في القيم")
            elif fn is None or any(h[1] == fn for h in same_field):
                ok += 1
            else:
                used = FUNCTION_LABELS.get(same_field[0][1], same_field[0][1])
                notes.append(f"الدالة على «{field}» هي {used} والمطلوب {FUNCTION_LABELS.get(fn, fn)}")
                ok += 0.5  # right field, wrong summary function
        got += W_DATA * ok / len(spec.values)
    return got / weights, notes


def grade_pivot(item, student: ExcelFile, key: ExcelFile | None) -> Graded:
    spec = None
    if item.expected:
        try:
            spec = parse_pivot_spec(item.expected)
        except SpecError as exc:
            return Graded(0, f"سلم التصحيح: {exc}", "", "", review=True)
    elif key is not None:
        try:
            key_pivots = key.pivots(item.sheet)
        except WorkbookError:
            key_pivots = []
        if key_pivots:
            spec = _spec_from_pivot(key_pivots[0])
    spec = spec or PivotSpec(None, None, None)

    try:
        pivots = student.pivots(item.sheet)
    except WorkbookError as exc:
        return Graded(0, str(exc), "", spec.describe())
    if not pivots:
        where = f" في ورقة «{item.sheet}»" if item.sheet else ""
        return Graded(0, f"لا يوجد جدول محوري{where}", "(لا يوجد جدول محوري)", spec.describe())

    best, best_notes, best_p = -1.0, [], pivots[0]
    for p in pivots:
        frac, notes = _score_pivot(p, spec)
        if frac > best:
            best, best_notes, best_p = frac, notes, p
    feedback = "؛ ".join(best_notes) if best_notes else "جدول محوري صحيح"
    return Graded(best, feedback, best_p.describe(), spec.describe())
