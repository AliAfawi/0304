"""Grading open answers with Claude.

Needs an Anthropic API key (ANTHROPIC_API_KEY). Without one, AI-graded items
are marked for manual review instead of failing the whole run.
"""
from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass

from .extract import extension, file_to_text

MODEL = os.environ.get("EXAM_GRADER_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("EXAM_GRADER_EFFORT", "medium")
FALLBACK_BETA = "server-side-fallback-2026-07-01"

SYSTEM_PROMPT = """أنت مصحح امتحانات خبير في تحليل البيانات (Excel، إحصاء، SQL، Python).
تصحح إجابات الطلاب بدقة وعدل وفق سلم التصحيح الذي يحدده المعلم.
- التزم بسلم التصحيح؛ لا تخترع معايير جديدة.
- امنح علامة جزئية عندما يكون جزء من الحل صحيحاً، ولا تعاقب الطالب مرتين على خطأ واحد انتقل إلى الخطوات التالية.
- اقبل أي طريقة حل صحيحة حتى لو اختلفت عن الحل النموذجي.
- اكتب الملاحظات للطالب بالعربية، قصيرة وواضحة: ما الخطأ وما الصحيح.
- إذا كانت الإجابة غير مقروءة أو غير واضحة أو لم تستطع الحكم بثقة، ضع confident=false ليراجعها المعلم."""


class AIError(RuntimeError):
    pass


def ai_available() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic

        _client = anthropic.Anthropic()
    return _client


def _call(content: list[dict], schema: dict, max_tokens: int = 16000) -> dict:
    import anthropic

    try:
        response = _get_client().beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": schema},
            },
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.AuthenticationError as exc:
        raise AIError("مفتاح Anthropic API غير صالح") from exc
    except anthropic.RateLimitError as exc:
        raise AIError("تم تجاوز حد الطلبات لخدمة الذكاء الاصطناعي، حاول لاحقاً") from exc
    except anthropic.APIStatusError as exc:
        raise AIError(f"خطأ من خدمة الذكاء الاصطناعي ({exc.status_code})") from exc
    except anthropic.APIConnectionError as exc:
        raise AIError("تعذر الاتصال بخدمة الذكاء الاصطناعي") from exc

    if response.stop_reason == "refusal":
        raise AIError("رفضت خدمة الذكاء الاصطناعي تصحيح هذه الإجابة")
    if response.stop_reason == "max_tokens":
        raise AIError("الرد من خدمة الذكاء الاصطناعي كان طويلاً جداً وانقطع")
    text = next((b.text for b in response.content if b.type == "text"), None)
    if text is None:
        raise AIError("لم يصل رد نصي من خدمة الذكاء الاصطناعي")
    return json.loads(text)


# ---------------------------------------------------------------- single item

_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "number"},
        "feedback": {"type": "string"},
        "confident": {"type": "boolean"},
    },
    "required": ["score", "feedback", "confident"],
    "additionalProperties": False,
}


@dataclass
class AIItemResult:
    score: float
    feedback: str
    confident: bool


def grade_open_answer(*, question: str, expected: str, notes: str | None,
                      student_answer: str, points: float) -> AIItemResult:
    prompt = (
        f"السؤال: {question or '(بدون وصف)'}\n"
        f"العلامة القصوى: {points}\n"
        f"الإجابة النموذجية: {expected or '(غير محددة)'}\n"
        f"تعليمات المعلم للتصحيح: {notes or '(لا يوجد)'}\n\n"
        f"إجابة الطالب:\n<student_answer>\n{student_answer or '(فارغة)'}\n</student_answer>\n\n"
        f"أعط علامة بين 0 و {points}، وملاحظة قصيرة للطالب."
    )
    data = _call([{"type": "text", "text": prompt}], _ITEM_SCHEMA, max_tokens=4000)
    score = max(0.0, min(float(data["score"]), points))
    return AIItemResult(score=score, feedback=data["feedback"], confident=bool(data["confident"]))


# ----------------------------------------------------------- whole submission

_SUBMISSION_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "qid": {"type": "string"},
                    "description": {"type": "string"},
                    "max_points": {"type": "number"},
                    "score": {"type": "number"},
                    "student_answer": {"type": "string"},
                    "feedback": {"type": "string"},
                    "confident": {"type": "boolean"},
                },
                "required": ["qid", "description", "max_points", "score",
                             "student_answer", "feedback", "confident"],
                "additionalProperties": False,
            },
        },
        "general_feedback": {"type": "string"},
    },
    "required": ["questions", "general_feedback"],
    "additionalProperties": False,
}


def _file_blocks(label: str, filename: str, data: bytes) -> list[dict]:
    """PDFs go to Claude as documents (so scanned pages are read too);
    everything else is converted to text first."""
    if extension(filename) == ".pdf":
        return [
            {"type": "text", "text": f"=== {label} ({filename}) ==="},
            {"type": "document", "source": {
                "type": "base64", "media_type": "application/pdf",
                "data": base64.b64encode(data).decode("ascii"),
            }},
        ]
    return [{"type": "text", "text": f"=== {label} ({filename}) ===\n{file_to_text(filename, data)}"}]


def build_reference_blocks(exam: tuple[str, bytes] | None, solution: tuple[str, bytes] | None,
                           rubric: tuple[str, bytes]) -> list[dict]:
    blocks: list[dict] = []
    if exam:
        blocks += _file_blocks("الامتحان الأصلي", *exam)
    if solution:
        blocks += _file_blocks("الامتحان المحلول (الحل النموذجي)", *solution)
    blocks += _file_blocks("سلم التصحيح", *rubric)
    # The reference material is identical for every student: cache it.
    blocks[-1] = {**blocks[-1], "cache_control": {"type": "ephemeral"}}
    return blocks


def grade_submission(reference_blocks: list[dict], student_name: str,
                     filename: str, data: bytes) -> dict:
    content = list(reference_blocks)
    content += _file_blocks(f"حل الطالب {student_name}", filename, data)
    content.append({"type": "text", "text": (
        "صحح حل الطالب وفق سلم التصحيح. أعد قائمة بكل الأسئلة/البنود الموجودة في سلم التصحيح "
        "بنفس الترتيب وبنفس أرقام الأسئلة، مع العلامة القصوى لكل بند كما في السلم، "
        "والعلامة التي يستحقها الطالب، وإجابته باختصار، وملاحظة له. "
        "ثم ملاحظة عامة قصيرة عن أداء الطالب."
    )})
    data_out = _call(content, _SUBMISSION_SCHEMA)
    for q in data_out["questions"]:
        q["score"] = max(0.0, min(float(q["score"]), float(q["max_points"])))
    return data_out
