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

SYSTEM_PROMPT = """أنت مصحح خبير لامتحانات البجروت (בגרות) والامتحانات المدرسية في إسرائيل، في كل المواضيع.
تصحح إجابات الطلاب بدقة وعدل وفق سلم التصحيح الذي يحدده المعلم.
- التزم بسلم التصحيح والحل النموذجي؛ لا تخترع معايير جديدة.
- امنح علامة جزئية عندما يكون جزء من الحل صحيحاً، ولا تعاقب الطالب مرتين على خطأ واحد انتقل إلى الخطوات التالية.
- اقبل أي طريقة حل صحيحة حتى لو اختلفت عن الحل النموذجي.
- إجابات الطلاب قد تكون مكتوبة باليد ومصوَّرة، وبالعربية أو العبرية أو الإنجليزية. اقرأها بعناية.
- في أسئلة اللغة والتعبير قيّم المضمون واللغة كما يحدد سلم التصحيح فقط.
- الملاحظات للطالب قصيرة وواضحة: ما الخطأ وما الصحيح.
- إذا كانت الإجابة غير مقروءة أو غير واضحة أو لم تستطع الحكم بثقة، ضع confident=false ليراجعها المعلم."""

FEEDBACK_LANGUAGES = {"ar": "العربية", "he": "العبرية", "en": "الإنجليزية"}
IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
               ".webp": "image/webp", ".gif": "image/gif"}
MAX_IMAGE_SIDE = 2000          # keeps handwriting readable
MAX_IMAGE_BYTES = 4_500_000    # the API accepts up to 5MB per image


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
                      student_answer: str, points: float, context: str = "") -> AIItemResult:
    prompt = (
        (f"{context}\n\n" if context else "")
        + f"السؤال: {question or '(بدون وصف)'}\n"
        f"العلامة القصوى: {points}\n"
        f"الإجابة النموذجية: {expected or '(غير محددة)'}\n"
        f"تعليمات المعلم للتصحيح: {notes or '(لا يوجد)'}\n\n"
        f"إجابة الطالب:\n<student_answer>\n{student_answer or '(فارغة)'}\n</student_answer>\n\n"
        f"أعط علامة بين 0 و {points}، وملاحظة قصيرة للطالب."
    )
    data = _call([{"type": "text", "text": prompt}], _ITEM_SCHEMA, max_tokens=4000)
    score = max(0.0, min(float(data["score"]), points))
    return AIItemResult(score=score, feedback=data["feedback"], confident=bool(data["confident"]))


def exam_context(*, label: str = "", structure: str = "", language: str = "ar") -> str:
    """A short header for the model: subject, structure and feedback language."""
    lines = []
    if label:
        lines.append(f"الامتحان: {label}")
    if structure:
        lines.append("مبنى الامتحان (أي الأسئلة تُحسب يُحدَّد لاحقاً تلقائياً؛ صحح كل سؤال أجاب عنه الطالب):\n"
                     + structure)
    lines.append(f"اكتب كل الملاحظات للطالب باللغة {FEEDBACK_LANGUAGES.get(language, 'العربية')}.")
    return "\n".join(lines)


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


def _image_block(data: bytes, ext: str) -> dict:
    """Photos from phones are often large: shrink them while keeping
    handwriting readable."""
    media = IMAGE_TYPES[ext]
    try:
        from io import BytesIO

        from PIL import Image, ImageOps

        img = Image.open(BytesIO(data))
        if max(img.size) > MAX_IMAGE_SIDE or len(data) > MAX_IMAGE_BYTES:
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
            quality = 85
            while True:
                buf = BytesIO()
                img.save(buf, "JPEG", quality=quality)
                if buf.tell() <= MAX_IMAGE_BYTES or quality <= 40:
                    break
                quality -= 15
            data, media = buf.getvalue(), "image/jpeg"
    except ImportError:
        pass
    except Exception as exc:  # not a readable image
        raise ValueError(f"تعذر قراءة الصورة: {exc}") from exc
    return {"type": "image", "source": {"type": "base64", "media_type": media,
                                        "data": base64.b64encode(data).decode("ascii")}}


def _file_blocks(label: str, filename: str, data: bytes) -> list[dict]:
    """PDFs and photos go to Claude as they are (so handwriting and scanned
    pages are read too); everything else is converted to text first."""
    ext = extension(filename)
    if ext == ".pdf":
        return [
            {"type": "text", "text": f"=== {label} ({filename}) ==="},
            {"type": "document", "source": {
                "type": "base64", "media_type": "application/pdf",
                "data": base64.b64encode(data).decode("ascii"),
            }},
        ]
    if ext in IMAGE_TYPES:
        return [{"type": "text", "text": f"=== {label} ({filename}) ==="}, _image_block(data, ext)]
    return [{"type": "text", "text": f"=== {label} ({filename}) ===\n{file_to_text(filename, data)}"}]


def build_reference_blocks(exam: tuple[str, bytes] | None, solution: tuple[str, bytes] | None,
                           rubric: tuple[str, bytes] | None, context: str = "") -> list[dict]:
    blocks: list[dict] = []
    if context:
        blocks.append({"type": "text", "text": context})
    if exam:
        blocks += _file_blocks("الامتحان الأصلي", *exam)
    if solution:
        blocks += _file_blocks("الامتحان المحلول (الحل النموذجي)", *solution)
    if rubric:
        blocks += _file_blocks("سلم التصحيح", *rubric)
    if not blocks:
        raise ValueError("لا توجد ملفات مرجعية للتصحيح")
    # The reference material is identical for every student: cache it.
    blocks[-1] = {**blocks[-1], "cache_control": {"type": "ephemeral"}}
    return blocks


def grade_submission(reference_blocks: list[dict], student_name: str,
                     files: list[tuple[str, bytes]]) -> dict:
    """`files`: everything one student handed in (e.g. several photographed pages)."""
    content = list(reference_blocks)
    for n, (filename, data) in enumerate(files, start=1):
        label = f"حل الطالب {student_name}" + (f" – ملف {n} من {len(files)}" if len(files) > 1 else "")
        content += _file_blocks(label, filename, data)
    content.append({"type": "text", "text": (
        "صحح حل الطالب وفق سلم التصحيح. أعد قائمة بكل الأسئلة/البنود الموجودة في سلم التصحيح "
        "بنفس الترتيب وبنفس أرقام الأسئلة (حتى الأسئلة التي لم يُجب عنها، بعلامة 0 وإجابة فارغة)، "
        "مع العلامة القصوى لكل بند كما في السلم، والعلامة التي يستحقها الطالب، وإجابته باختصار، "
        "وملاحظة له. ثم ملاحظة عامة قصيرة عن أداء الطالب."
    )})
    data_out = _call(content, _SUBMISSION_SCHEMA)
    for q in data_out["questions"]:
        q["score"] = max(0.0, min(float(q["score"]), float(q["max_points"])))
    return data_out
