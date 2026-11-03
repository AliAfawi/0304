"""Reading the grading rubric (سلم التصحيح).

A structured rubric is an Excel sheet with one row per gradable item. Column
headers may be written in Arabic, Hebrew or English; see HEADER_ALIASES.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from io import BytesIO

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

CHECK_VALUE = "value"
CHECK_FORMULA = "formula"
CHECK_TEXT = "text"
CHECK_AI = "ai"
CHECK_CHART = "chart"
CHECK_PIVOT = "pivot"

CHECK_ALIASES = {
    CHECK_VALUE: {"value", "قيمة", "رقم", "ערך"},
    CHECK_FORMULA: {"formula", "معادلة", "دالة", "נוסחה"},
    CHECK_TEXT: {"text", "نص", "טקסט"},
    CHECK_AI: {"ai", "ذكاء اصطناعي", "ذكاء", "تفسير", "شرح", "בינה", "הסבר"},
    CHECK_CHART: {"chart", "رسم بياني", "رسم", "مخطط", "مخطط بياني", "תרשים", "גרף"},
    CHECK_PIVOT: {"pivot", "جدول محوري", "جدول ديناميكي", "pivot table", "טבלת ציר"},
}

CHECK_LABELS_AR = {
    CHECK_VALUE: "قيمة",
    CHECK_FORMULA: "معادلة",
    CHECK_TEXT: "نص",
    CHECK_AI: "ذكاء اصطناعي",
    CHECK_CHART: "رسم بياني",
    CHECK_PIVOT: "جدول محوري",
}
# These look at a whole sheet (or workbook), so the cell column is optional.
WHOLE_SHEET_CHECKS = {CHECK_CHART, CHECK_PIVOT}

HEADER_ALIASES = {
    "qid": {"رقم السؤال", "السؤال", "question", "id", "q", "מספר שאלה", "שאלה"},
    "description": {"الوصف", "وصف السؤال", "نص السؤال", "description", "תיאור"},
    "sheet": {"الورقة", "ورقة العمل", "sheet", "גיליון"},
    "cell": {"الخلية", "الخلايا", "cell", "range", "תא"},
    "points": {"العلامة", "النقاط", "الدرجة", "points", "score", "ניקוד"},
    "check": {"نوع الفحص", "النوع", "check", "type", "סוג בדיקה"},
    "tolerance": {"السماحية", "هامش الخطأ", "tolerance", "סטייה"},
    "function": {"الدالة المطلوبة", "دالة مطلوبة", "function", "פונקציה"},
    "expected": {"الإجابة المتوقعة", "الاجابة المتوقعة", "expected", "answer", "תשובה"},
    "notes": {"ملاحظات للمصحح", "ملاحظات", "notes", "הערות"},
}

TEMPLATE_HEADERS = [
    "رقم السؤال", "الوصف", "الورقة", "الخلية", "العلامة",
    "نوع الفحص", "السماحية", "الدالة المطلوبة", "الإجابة المتوقعة", "ملاحظات للمصحح",
]

DEFAULT_TOLERANCE = 0.01


class RubricError(ValueError):
    pass


@dataclass
class RubricItem:
    qid: str
    description: str
    sheet: str | None
    cell: str
    points: float
    check: str
    tolerance: float = DEFAULT_TOLERANCE
    function: str | None = None
    expected: str | None = None
    notes: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Rubric:
    items: list[RubricItem] = field(default_factory=list)

    @property
    def total_points(self) -> float:
        return sum(i.points for i in self.items)

    def to_dict(self) -> dict:
        return {"items": [i.to_dict() for i in self.items]}

    @classmethod
    def from_dict(cls, data: dict) -> "Rubric":
        return cls(items=[RubricItem(**i) for i in data.get("items", [])])


def _norm_header(h) -> str:
    return " ".join(str(h or "").strip().lower().split())


def _resolve_check(raw) -> str:
    text = _norm_header(raw)
    if not text:
        return CHECK_VALUE
    for key, aliases in CHECK_ALIASES.items():
        if text in {a.lower() for a in aliases}:
            return key
    raise RubricError(f"نوع فحص غير معروف: «{raw}». الأنواع المسموحة: قيمة، معادلة، نص، ذكاء اصطناعي")


def _cell_str(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def looks_like_structured_rubric(data: bytes) -> bool:
    """True if the bytes are an xlsx whose first row has the required columns."""
    try:
        parse_rubric(data)
        return True
    except Exception:
        return False


def parse_rubric(data: bytes) -> Rubric:
    try:
        wb = load_workbook(BytesIO(data), data_only=True, read_only=True)
    except Exception as exc:  # not an xlsx
        raise RubricError("ملف سلم التصحيح ليس ملف Excel صالحاً") from exc

    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise RubricError("ملف سلم التصحيح فارغ")

    col_index: dict[str, int] = {}
    for idx, header in enumerate(rows[0]):
        h = _norm_header(header)
        for key, aliases in HEADER_ALIASES.items():
            if h in {a.lower() for a in aliases} and key not in col_index:
                col_index[key] = idx

    missing = [k for k in ("qid", "cell", "points") if k not in col_index]
    if missing:
        names = {"qid": "رقم السؤال", "cell": "الخلية", "points": "العلامة"}
        raise RubricError("أعمدة ناقصة في سلم التصحيح: " + "، ".join(names[m] for m in missing))

    def get(row, key):
        i = col_index.get(key)
        return row[i] if i is not None and i < len(row) else None

    items: list[RubricItem] = []
    for line_no, row in enumerate(rows[1:], start=2):
        if row is None or all(v is None or str(v).strip() == "" for v in row):
            continue
        qid = _cell_str(get(row, "qid"))
        cell = _cell_str(get(row, "cell"))
        check = _resolve_check(get(row, "check"))
        if check in WHOLE_SHEET_CHECKS and not cell:
            cell = "*"
        if not qid or not cell:
            raise RubricError(f"السطر {line_no}: رقم السؤال والخلية إلزاميان")
        try:
            points = float(get(row, "points"))
        except (TypeError, ValueError):
            raise RubricError(f"السطر {line_no}: العلامة يجب أن تكون رقماً")
        tol_raw = get(row, "tolerance")
        try:
            tolerance = float(tol_raw) if tol_raw not in (None, "") else DEFAULT_TOLERANCE
        except (TypeError, ValueError):
            raise RubricError(f"السطر {line_no}: السماحية يجب أن تكون رقماً")
        items.append(RubricItem(
            qid=qid,
            description=_cell_str(get(row, "description")) or "",
            sheet=_cell_str(get(row, "sheet")),
            cell=cell.replace("$", "").upper(),
            points=points,
            check=check,
            tolerance=tolerance,
            function=(_cell_str(get(row, "function")) or None),
            expected=_cell_str(get(row, "expected")),
            notes=_cell_str(get(row, "notes")),
        ))
    wb.close()
    if not items:
        raise RubricError("سلم التصحيح لا يحتوي على أي سؤال")
    return Rubric(items=items)


def build_template() -> bytes:
    """An example rubric workbook teachers can download and fill in."""
    wb = Workbook()
    ws = wb.active
    ws.title = "سلم التصحيح"
    ws.sheet_view.rightToLeft = True
    ws.append(TEMPLATE_HEADERS)
    examples = [
        ["1", "متوسط العلامات", "البيانات", "F2", 10, "معادلة", 0.01, "AVERAGE", None, None],
        ["2", "عدد الطلاب الناجحين", "البيانات", "F3", 10, "قيمة", 0, None, None, None],
        ["3", "عمود المعدلات لكل طالب", "البيانات", "D2:D11", 20, "قيمة", 0.01, None, None, None],
        ["4", "اسم الطالب صاحب أعلى علامة", "البيانات", "F4", 10, "نص", None, None, None, None],
        ["5", "فسّر الفرق بين المتوسط والوسيط", "البيانات", "F6", 10, "ذكاء اصطناعي", None, None, None,
         "علامة كاملة إذا ذكر تأثير القيم المتطرفة"],
        ["6", "رسم بياني بالأعمدة لمعدلات الطلاب", None, "D2:D11", 20, "رسم بياني", None, None, "أعمدة", None],
        ["7", "جدول محوري: معدل العلامة لكل شعبة", None, None, 20, "جدول محوري", None, None,
         "صفوف: الشعبة; قيم: متوسط(العلامة)", None],
    ]
    for row in examples:
        ws.append(row)
    header_fill = PatternFill("solid", fgColor="1F4E79")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    widths = [12, 32, 14, 12, 10, 16, 12, 18, 20, 40]
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(ord("A") + i)].width = w
    dv = DataValidation(type="list", formula1='"قيمة,معادلة,نص,ذكاء اصطناعي,رسم بياني,جدول محوري"',
                        allow_blank=True)
    ws.add_data_validation(dv)
    dv.add("F2:F200")

    help_ws = wb.create_sheet("شرح")
    help_ws.sheet_view.rightToLeft = True
    lines = [
        ["العمود", "الشرح"],
        ["رقم السؤال", "إلزامي. مثلاً 1 أو 2أ. يمكن تكرار الرقم لعدة خلايا في نفس السؤال"],
        ["الوصف", "وصف قصير يظهر في تقرير الطالب"],
        ["الورقة", "اسم ورقة العمل في ملف الطالب. إذا تُرك فارغاً تُستعمل الورقة الأولى (وفي الرسم البياني والجدول المحوري: يُبحث في كل الأوراق)"],
        ["الخلية", "إلزامي. خلية واحدة (B5) أو نطاق (B2:B10). في الرسم البياني: نطاق البيانات المرسومة (اختياري، ويمكن كتابة عدة نطاقات مفصولة بفاصلة). في الجدول المحوري: اتركه فارغاً"],
        ["العلامة", "إلزامي. عدد النقاط لهذا البند"],
        ["نوع الفحص", "قيمة: مقارنة الرقم/القيمة مع الحل | معادلة: نصف العلامة للقيمة الصحيحة ونصفها لاستعمال معادلة (والدالة المطلوبة إن وُجدت) | نص: مقارنة نصية (يمكن كتابة عدة إجابات مقبولة مفصولة بـ |) | ذكاء اصطناعي: تصحيح إجابة مفتوحة حسب الملاحظات | رسم بياني: وجود الرسم، نوعه، والبيانات المرسومة | جدول محوري: وجود الجدول، حقول الصفوف/الأعمدة، والقيم مع الدالة (متوسط، مجموع...)"],
        ["السماحية", "الفرق المسموح في الأرقام. الافتراضي 0.01"],
        ["الدالة المطلوبة", "لفحص المعادلة: مثل AVERAGE أو COUNTIF. يمكن كتابة عدة دوال مفصولة بفاصلة"],
        ["الإجابة المتوقعة", "اختياري. إذا تُرك فارغاً تؤخذ الإجابة من نفس الخلية في الامتحان المحلول. في الرسم البياني: نوع الرسم (أعمدة، أشرطة، خطي، دائري، انتشار، مساحي). في الجدول المحوري: مثل «صفوف: الشعبة; قيم: متوسط(العلامة)». إذا تُرك فارغاً يُقارن مع الرسم/الجدول في الامتحان المحلول"],
        ["ملاحظات للمصحح", "تعليمات إضافية لتصحيح الأسئلة المفتوحة بالذكاء الاصطناعي"],
    ]
    for line in lines:
        help_ws.append(line)
    help_ws["A1"].font = Font(bold=True)
    help_ws["B1"].font = Font(bold=True)
    help_ws.column_dimensions["A"].width = 18
    help_ws.column_dimensions["B"].width = 110

    out = BytesIO()
    wb.save(out)
    return out.getvalue()
