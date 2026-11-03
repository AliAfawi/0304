"""Build a small example exam to try the app with.

    python samples/make_samples.py

Writes to samples/example/: the exam (Word), the solved exam (Excel),
the rubric (Excel) and five student files inside students.zip.
Formulas are recalculated with LibreOffice when available so the files
look as if they were saved by Excel.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path

import docx
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.rubric import TEMPLATE_HEADERS  # noqa: E402

OUT = Path(__file__).resolve().parent / "example"
SHEET = "البيانات"
DATA = [
    ("أحمد", 78, 85), ("سارة", 92, 88), ("محمد", 45, 60), ("ليلى", 66, 71), ("يوسف", 88, 95),
    ("نور", 52, 49), ("كريم", 74, 69), ("هبة", 98, 93), ("علي", 35, 58), ("رنا", 81, 77),
]
EXPLANATION = ("الوسيط أقل تأثراً بالقيم المتطرفة من المتوسط، لذلك عندما توجد علامات منخفضة جداً "
               "ينخفض المتوسط أكثر من الوسيط.")


def recalc(data: bytes) -> bytes:
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return data
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "f.xlsx"
        src.write_bytes(data)
        subprocess.run([soffice, "--headless", "--convert-to", "xlsx", "--outdir", str(Path(tmp) / "o"), str(src)],
                       check=True, capture_output=True, timeout=120)
        return (Path(tmp) / "o" / "f.xlsx").read_bytes()


def workbook(variant: str) -> bytes:
    """variant: key | good | values | mistakes | copy1 | copy2"""
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET
    ws.sheet_view.rightToLeft = True
    ws.append(["الاسم", "رياضيات", "علوم", "المعدل", "", "النتائج"])
    for name, m, s in DATA:
        ws.append([name, m, s])
    labels = {5: "متوسط المعدلات", 6: "عدد الناجحين", 7: "صاحب أعلى معدل", 8: "الوسيط", 9: "تفسير"}
    for r, text in labels.items():
        ws.cell(row=r - 3, column=5, value=text)

    for r in range(2, 12):
        m, s = DATA[r - 2][1], DATA[r - 2][2]
        if variant == "values":
            ws[f"D{r}"] = (m + s) / 2
        elif variant in ("mistakes", "copy1", "copy2") and r in (4, 10):
            ws[f"D{r}"] = f"=B{r}+C{r}"  # forgot to divide by 2
        else:
            ws[f"D{r}"] = f"=AVERAGE(B{r}:C{r})"

    if variant == "values":
        avgs = [(m + s) / 2 for _, m, s in DATA]
        ws["F2"] = round(sum(avgs) / len(avgs), 2)
        ws["F3"] = sum(1 for a in avgs if a >= 55)
        ws["F4"] = "هبة"
        ws["F5"] = 75.75
        ws["F6"] = "المتوسط أقل لأن هناك علامات منخفضة."
    elif variant in ("copy1", "copy2"):
        ws["F2"] = "=SUM(D2:D11)/11"  # same wrong formula in both copies
        ws["F3"] = '=COUNTIF(D2:D11,">55")'
        ws["F4"] = "سارة"
        ws["F5"] = "=MEDIAN(D2:D11)"
        ws["F6"] = "لأن الوسيط هو العلامة في الوسط."
    elif variant == "mistakes":
        ws["F2"] = "=AVERAGE(D2:D11)"
        ws["F3"] = '=COUNTIF(D2:D11,">=55")'
        ws["F4"] = "هبه"
        ws["F5"] = "=AVERAGE(D2:D11)"
        ws["F6"] = ""
    else:
        ws["F2"] = "=AVERAGE(D2:D11)"
        ws["F3"] = '=COUNTIF(D2:D11,">=55")'
        ws["F4"] = "=INDEX(A2:A11,MATCH(MAX(D2:D11),D2:D11,0))"
        ws["F5"] = "=MEDIAN(D2:D11)"
        ws["F6"] = EXPLANATION if variant == "key" else (
            "لأن هناك طلاب علاماتهم منخفضة جداً، وهذه القيم المتطرفة تسحب المتوسط للأسفل أما الوسيط فلا يتأثر بها كثيراً.")
    # question 7: a column chart of every student's average, labelled by name
    if variant != "mistakes":
        chart = LineChart() if variant in ("copy1", "copy2") else BarChart()
        data_col = 3 if variant == "values" else 4  # "values" plotted the science column by mistake
        chart.add_data(Reference(ws, min_col=data_col, min_row=1, max_row=11), titles_from_data=True)
        chart.set_categories(Reference(ws, min_col=1, min_row=2, max_row=11))
        chart.title = "معدلات الطلاب"
        ws.add_chart(chart, "H2")
    buf = BytesIO()
    wb.save(buf)
    return recalc(buf.getvalue())


def rubric() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "سلم التصحيح"
    ws.sheet_view.rightToLeft = True
    ws.append(TEMPLATE_HEADERS)
    rows = [
        ["1", "حساب معدل كل طالب", SHEET, "D2:D11", 20, "معادلة", 0.01, "AVERAGE", None, None],
        ["2", "متوسط معدلات الصف", SHEET, "F2", 15, "معادلة", 0.01, "AVERAGE", None, None],
        ["3", "عدد الطلاب الناجحين (55 فما فوق)", SHEET, "F3", 15, "معادلة", 0, "COUNTIF,COUNTIFS", None, None],
        ["4", "اسم الطالب صاحب أعلى معدل", SHEET, "F4", 10, "نص", None, None, None, None],
        ["5", "وسيط المعدلات", SHEET, "F5", 15, "معادلة", 0.01, "MEDIAN", None, None],
        ["6", "فسّر الفرق بين المتوسط والوسيط", SHEET, "F6", 15, "ذكاء اصطناعي", None, None, None,
         "علامة كاملة إذا ذكر أن القيم المتطرفة (العلامات المنخفضة) تؤثر على المتوسط أكثر من الوسيط. نصف العلامة لإجابة عامة بلا تفسير."],
        ["7", "رسم بياني بالأعمدة لمعدلات الطلاب", None, "D2:D11", 10, "رسم بياني", None, None, "أعمدة", None],
    ]
    for r in rows:
        ws.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def exam_docx() -> bytes:
    d = docx.Document()
    d.add_heading("امتحان تحليل بيانات – علامات الصف", level=1)
    d.add_paragraph("في ورقة «البيانات» علامات 10 طلاب في الرياضيات والعلوم. أجب في نفس الورقة:")
    for q in [
        "1. في العمود D احسب معدل كل طالب باستعمال دالة مناسبة (20 نقطة).",
        "2. في الخلية F2 احسب متوسط معدلات الصف (15 نقطة).",
        "3. في الخلية F3 احسب عدد الطلاب الذين معدلهم 55 فما فوق (15 نقطة).",
        "4. في الخلية F4 اكتب اسم الطالب صاحب أعلى معدل (10 نقاط).",
        "5. في الخلية F5 احسب وسيط المعدلات (15 نقطة).",
        "6. في الخلية F6 فسّر لماذا يختلف المتوسط عن الوسيط (15 نقطة).",
        "7. ارسم رسماً بيانياً بالأعمدة لمعدلات الطلاب مع أسمائهم (10 نقاط).",
    ]:
        d.add_paragraph(q)
    buf = BytesIO()
    d.save(buf)
    return buf.getvalue()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "الامتحان.docx").write_bytes(exam_docx())
    (OUT / "الامتحان_المحلول.xlsx").write_bytes(workbook("key"))
    (OUT / "سلم_التصحيح.xlsx").write_bytes(rubric())
    students = {
        "سارة_خليل.xlsx": "good",
        "عمر_ناصر.xlsx": "values",
        "مريم_حداد.xlsx": "mistakes",
        "خالد_يوسف.xlsx": "copy1",
        "دانا_سعيد.xlsx": "copy2",
    }
    with zipfile.ZipFile(OUT / "students.zip", "w", zipfile.ZIP_DEFLATED) as zf:
        for name, variant in students.items():
            zf.writestr(name, workbook(variant))
    print(f"wrote example files to {OUT}")


if __name__ == "__main__":
    main()
