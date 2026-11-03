"""The marking scheme (מחוון) the teacher reviews before grading.

Flow: the teacher uploads the exam → Claude drafts a marking scheme (one row
per question: points, model answer, grading criteria, and the exam
structure) → the teacher edits it → students are graded against it.

The scheme is stored as a list of dicts on the library entry:
    {"qid": "1", "description": "...", "points": 10,
     "answer": "model answer", "criteria": "how to give partial credit"}
"""
from __future__ import annotations

from . import ai_grader

MAX_QUESTIONS = 80
FIELDS = ("qid", "description", "points", "answer", "criteria")


class MahvanError(ValueError):
    pass


_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "qid": {"type": "string"},
                    "description": {"type": "string"},
                    "points": {"type": "number"},
                    "answer": {"type": "string"},
                    "criteria": {"type": "string"},
                },
                "required": list(FIELDS),
                "additionalProperties": False,
            },
        },
        "structure": {"type": "string"},
        "notes": {"type": "string"},
    },
    "required": ["questions", "structure", "notes"],
    "additionalProperties": False,
}

_PROMPT = """اقرأ الامتحان المرفق واكتب له سلم تصحيح (מחוון) مفصلاً يستعمله المعلم.

لكل سؤال أو بند يُصحح على حدة (مثل 1، 2أ، 2ب) أعطِ:
- qid: رقم السؤال كما في الامتحان (مثلاً "1" أو "2ب").
- description: نص السؤال باختصار.
- points: العلامة. إذا كانت العلامات مكتوبة في الامتحان فاستعملها كما هي. إذا لم تكن مكتوبة فوزّع 100 نقطة بشكل معقول.
- answer: الإجابة النموذجية الكاملة (مع خطوات الحل في الأسئلة الحسابية).
- criteria: كيف تُعطى العلامة الجزئية، مثلاً: «3 نقاط للمعادلة الصحيحة، 2 للتعويض، 2 للنتيجة مع الوحدات».
إذا أُرفق حل نموذجي فاعتمد عليه في الإجابات.

structure: إذا كان في الامتحان اختيار أسئلة (مثل «أجب عن 2 من الأسئلة 1–3») فاكتبه بهذه الصيغة، سطراً لكل فصل:
فصل أ: 1,2,3 = 2
وإذا كان الطالب يجيب عن كل الأسئلة فاترك structure فارغاً. في البنود الفرعية (2أ، 2ب) لا تكتب اختيار الأسئلة إلا إذا كان على مستوى السؤال الكامل.

notes: ملاحظات قصيرة للمعلم: ما الذي يجب التأكد منه في هذا السلم (مثلاً: «لم تكن العلامات مكتوبة في الامتحان فوزعتها بالتساوي»).
اكتب كل شيء بلغة الامتحان."""


def generate(exam: tuple[str, bytes], solution: tuple[str, bytes] | None, context: str = "") -> dict:
    """Ask Claude for a draft marking scheme. Returns
    {"questions": [...], "structure": "...", "notes": "..."}."""
    content = []
    if context:
        content.append({"type": "text", "text": context})
    content += ai_grader._file_blocks("الامتحان", *exam)
    if solution:
        content += ai_grader._file_blocks("الحل النموذجي", *solution)
    content.append({"type": "text", "text": _PROMPT})
    data = ai_grader._call(content, _SCHEMA)
    data["questions"] = clean(data["questions"])
    return data


def clean(rows: list[dict]) -> list[dict]:
    """Validate rows from the AI or from the teacher's form."""
    out, seen = [], set()
    for n, row in enumerate(rows, start=1):
        qid = str(row.get("qid", "")).strip()
        if not qid and not any(str(row.get(f, "")).strip() for f in FIELDS[1:]):
            continue  # empty row in the form
        if not qid:
            raise MahvanError(f"السطر {n}: رقم السؤال إلزامي")
        if qid in seen:
            raise MahvanError(f"رقم السؤال {qid} مكرر")
        seen.add(qid)
        try:
            points = float(str(row.get("points", "")).replace(",", "."))
        except ValueError:
            raise MahvanError(f"السؤال {qid}: العلامة يجب أن تكون رقماً")
        if not 0 < points <= 1000:
            raise MahvanError(f"السؤال {qid}: العلامة يجب أن تكون أكبر من 0")
        out.append({
            "qid": qid[:20],
            "description": str(row.get("description", "")).strip()[:2000],
            "points": round(points, 2),
            "answer": str(row.get("answer", "")).strip()[:6000],
            "criteria": str(row.get("criteria", "")).strip()[:3000],
        })
    if len(out) > MAX_QUESTIONS:
        raise MahvanError(f"عدد الأسئلة أكبر من {MAX_QUESTIONS}")
    return out


def from_form(form) -> list[dict]:
    """Rows posted as qid_0, points_0, ... (rows may have gaps after deletions)."""
    idx = sorted({int(k.split("_", 1)[1]) for k in form.keys()
                  if k.startswith("qid_") and k.split("_", 1)[1].isdigit()})
    return clean([{f: form.get(f"{f}_{i}", "") for f in FIELDS} for i in idx])


def as_text(rows: list[dict]) -> str:
    """The scheme as the grader model reads it."""
    parts = ["سلم التصحيح (מחוון) كما اعتمده المعلم. صحح حسبه فقط، وبنفس أرقام الأسئلة والعلامات:"]
    for r in rows:
        parts.append(f"\n## سؤال {r['qid']} — {r['points']:g} نقطة\n{r['description']}")
        if r["answer"]:
            parts.append(f"الإجابة النموذجية:\n{r['answer']}")
        if r["criteria"]:
            parts.append(f"معايير التصحيح والعلامة الجزئية:\n{r['criteria']}")
    return "\n".join(parts)


def total(rows: list[dict]) -> float:
    return round(sum(r["points"] for r in rows), 2)
