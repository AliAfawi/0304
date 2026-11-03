"""Class statistics, similarity detection and Excel export."""
from __future__ import annotations

import statistics
from collections import OrderedDict
from io import BytesIO
from itertools import combinations

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from .grader import PASS_MARK, STATUS_CORRECT, STATUS_REVIEW

BUCKETS = [(0, 54), (55, 64), (65, 74), (75, 84), (85, 94), (95, 100)]


def question_order(students: list[dict]) -> list[str]:
    order: OrderedDict[str, None] = OrderedDict()
    for s in students:
        for item in s["items"]:
            order.setdefault(item["qid"], None)
    return list(order)


def question_scores(student: dict) -> dict[str, tuple[float, float]]:
    """Per-question (score, points); a question may span several rubric rows."""
    out: dict[str, list[float]] = {}
    for item in student["items"]:
        if not item.get("counted", True):
            continue  # a question the student answered beyond what the exam asks
        acc = out.setdefault(item["qid"], [0.0, 0.0])
        acc[0] += item["score"]
        acc[1] += item["points"]
    return {k: (round(v[0], 2), round(v[1], 2)) for k, v in out.items()}


def class_stats(students: list[dict]) -> dict:
    graded = [s for s in students if s["items"]]
    grades = [s["grade"] for s in graded]
    if not grades:
        return {"count": 0}
    per_question = []
    for qid in question_order(graded):
        scores, points, desc = [], 0.0, ""
        for s in graded:
            qs = question_scores(s)
            if qid in qs:
                scores.append(qs[qid][0])
                points = max(points, qs[qid][1])
        for s in graded:
            for item in s["items"]:
                if item["qid"] == qid and item["description"]:
                    desc = item["description"]
                    break
            if desc:
                break
        avg = statistics.mean(scores) if scores else 0
        per_question.append({
            "qid": qid, "description": desc, "points": points,
            "average": round(avg, 2),
            "percent": round(100 * avg / points) if points else 0,
            "full_marks": sum(1 for x in scores if points and x >= points - 1e-9),
        })
    distribution = [{"label": f"{lo}–{hi}", "count": sum(1 for g in grades if lo <= g <= hi)}
                    for lo, hi in BUCKETS]
    return {
        "count": len(grades),
        "mean": round(statistics.mean(grades), 1),
        "median": round(statistics.median(grades), 1),
        "stdev": round(statistics.pstdev(grades), 1),
        "min": min(grades),
        "max": max(grades),
        "passed": sum(1 for g in grades if g >= PASS_MARK),
        "pass_rate": round(100 * sum(1 for g in grades if g >= PASS_MARK) / len(grades)),
        "per_question": per_question,
        "hardest": sorted(per_question, key=lambda q: q["percent"])[:3],
        "distribution": distribution,
        "needs_review": sum(1 for s in students if s.get("needs_review")),
    }


def similarity_flags(students: list[dict], min_shared_wrong: int = 2) -> list[dict]:
    """Pairs of students who gave the *same wrong answers* on several items —
    a common sign of copying. Matching correct answers prove nothing."""
    def wrong_answers(s):
        return {
            (i["qid"], i["cell"]): i["student_answer"]
            for i in s["items"]
            if i["status"] not in (STATUS_CORRECT, STATUS_REVIEW) and i.get("counted", True)
            and i["student_answer"] and i["student_answer"] != "(فارغ)"
            and not i.get("ai")
        }

    rubric_students = [s for s in students if s.get("mode") == "rubric" and s["items"]]
    wrongs = {id(s): wrong_answers(s) for s in rubric_students}
    flags = []
    for a, b in combinations(rubric_students, 2):
        wa, wb = wrongs[id(a)], wrongs[id(b)]
        shared = [k for k in wa if k in wb and wa[k] == wb[k]]
        if len(shared) >= min_shared_wrong:
            flags.append({
                "a": a["name"], "b": b["name"], "count": len(shared),
                "questions": sorted({k[0] for k in shared}),
            })
    return sorted(flags, key=lambda f: -f["count"])


# --------------------------------------------------------------------- export

def export_grades_xlsx(job: dict) -> bytes:
    students = job["students"]
    qids = question_order(students)
    wb = Workbook()
    ws = wb.active
    ws.title = "العلامات"
    ws.sheet_view.rightToLeft = True
    headers = ["اسم الطالب"] + [f"سؤال {q}" for q in qids] + ["المجموع", "من", "العلامة (100)", "يحتاج مراجعة", "ملاحظة المعلم"]
    ws.append(headers)
    for s in students:
        qs = question_scores(s)
        ws.append([s["name"]] + [qs.get(q, (None, None))[0] for q in qids] + [
            s["total"], s["max_points"], s["grade"],
            "نعم" if s.get("needs_review") else "", s.get("teacher_comment") or s.get("error") or "",
        ])
    fill = PatternFill("solid", fgColor="1F4E79")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = fill
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    ws.column_dimensions["A"].width = 24
    ws.freeze_panes = "B2"

    details = wb.create_sheet("تفاصيل")
    details.sheet_view.rightToLeft = True
    details.append(["اسم الطالب", "سؤال", "الوصف", "الخلية", "العلامة", "من", "يُحسب", "إجابة الطالب",
                    "الإجابة الصحيحة", "ملاحظة"])
    for s in students:
        for i in s["items"]:
            details.append([s["name"], i["qid"], i["description"], i["cell"], i["score"], i["points"],
                            "نعم" if i.get("counted", True) else "لا (اختيار)",
                            i["student_answer"], i["expected_answer"], i["feedback"]])
    for c in details[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = fill
    for col, w in zip("ABCDEFGHIJ", [22, 8, 30, 12, 8, 6, 10, 30, 30, 60]):
        details.column_dimensions[col].width = w

    stats = class_stats(students)
    if stats.get("count"):
        st = wb.create_sheet("إحصائيات")
        st.sheet_view.rightToLeft = True
        for label, key in [("عدد الطلاب", "count"), ("المعدل", "mean"), ("الوسيط", "median"),
                           ("الانحراف المعياري", "stdev"), ("أدنى علامة", "min"), ("أعلى علامة", "max"),
                           ("نسبة النجاح %", "pass_rate")]:
            st.append([label, stats[key]])
        st.append([])
        st.append(["سؤال", "الوصف", "معدل العلامة", "من", "نسبة النجاح في السؤال %"])
        for q in stats["per_question"]:
            st.append([q["qid"], q["description"], q["average"], q["points"], q["percent"]])
        st.column_dimensions["A"].width = 20
        st.column_dimensions["B"].width = 36

    out = BytesIO()
    wb.save(out)
    return out.getvalue()
