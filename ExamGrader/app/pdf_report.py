"""One PDF per student: the grading report followed by the student's
scanned solution, ready to print or send to the student.

Arabic and Hebrew are drawn right-to-left with letter shaping
(arabic-reshaper + python-bidi) in DejaVu Sans, which covers Arabic,
Hebrew and Latin.
"""
from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from .extract import IMAGE_EXTS, extension

FONT_DIR = Path(__file__).resolve().parent / "static" / "fonts"
FONT, FONT_BOLD = "DejaVu", "DejaVu-Bold"
PAGE_W, PAGE_H = A4
MARGIN = 42
INK = HexColor("#1d2433")
MUTED = HexColor("#5f6b7d")
LINE = HexColor("#dfe4ec")
BRAND = HexColor("#1f4e79")
STATUS_COLORS = {"correct": HexColor("#1e7e45"), "partial": HexColor("#9a6700"),
                 "wrong": HexColor("#b42318"), "review": HexColor("#6941c6")}
STATUS_LABELS = {"correct": "صحيح", "partial": "جزئي", "wrong": "خطأ", "review": "للمراجعة"}
_fonts_ready = False


def _register_fonts() -> None:
    global _fonts_ready
    if not _fonts_ready:
        pdfmetrics.registerFont(TTFont(FONT, str(FONT_DIR / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONT_DIR / "DejaVuSans-Bold.ttf")))
        _fonts_ready = True


_MIRROR = str.maketrans("()[]{}<>«»‹›", ")(][}{><»«›‹")
_LEVEL_RE = re.compile(r"Level\(\s*(\d+),?\s*\)")


def _levels(text: str) -> list[int] | None:
    """Embedding level of every character, from python-bidi's Rust engine
    (which implements paired brackets, rule N0). It reports levels per UTF-8
    byte; map them back to characters."""
    from bidi import get_display

    dump = get_display(text, base_dir="R", debug=True)
    start = dump.find("levels:")
    if start < 0:
        return None
    per_byte = [int(x) for x in _LEVEL_RE.findall(dump[start:dump.find("]", start)])]
    out, pos = [], 0
    for ch in text:
        if pos >= len(per_byte):
            return None
        out.append(per_byte[pos])
        pos += len(ch.encode("utf-8"))
    return out if pos == len(per_byte) else None


def _visual(text: str, levels: list[int]) -> str:
    """Unicode rules L2 (reverse runs, highest level first) and L4 (mirror
    brackets on right-to-left levels)."""
    chars = [c.translate(_MIRROR) if lv % 2 else c for c, lv in zip(text, levels)]
    idx = list(range(len(chars)))
    top = max(levels, default=0)
    lowest_odd = min((lv for lv in levels if lv % 2), default=top + 1)
    for level in range(top, lowest_odd - 1, -1):
        i = 0
        while i < len(idx):
            if levels[idx[i]] >= level:
                j = i
                while j < len(idx) and levels[idx[j]] >= level:
                    j += 1
                idx[i:j] = reversed(idx[i:j])
                i = j
            else:
                i += 1
    return "".join(chars[k] for k in idx)


def shape(text: str) -> str:
    """Logical-order text → glyph order for drawing (RTL paragraphs)."""
    import arabic_reshaper

    shaped = arabic_reshaper.reshape(text)
    try:
        levels = _levels(shaped)
    except Exception:
        levels = None
    if levels is None:  # fall back to the pure-Python algorithm (mirrors, no N0)
        from bidi.algorithm import get_display

        return get_display(shaped, base_dir="R")
    return _visual(shaped, levels)


def _num(x) -> str:
    f = round(float(x), 2)
    return str(int(f)) if f.is_integer() else f"{f:g}"


class _Writer:
    """Draws right-aligned wrapped text and starts new pages when needed."""

    def __init__(self, c: canvas.Canvas, footer: str):
        self.c, self.footer, self.page = c, footer, 1
        self.y = PAGE_H - MARGIN
        self.right, self.left = PAGE_W - MARGIN, MARGIN

    def _footer(self):
        self.c.setFont(FONT, 8)
        self.c.setFillColor(MUTED)
        self.c.drawCentredString(PAGE_W / 2, 22, shape(f"{self.footer} · صفحة {self.page}"))

    def new_page(self):
        self._footer()
        self.c.showPage()
        self.page += 1
        self.y = PAGE_H - MARGIN

    def need(self, height: float):
        if self.y - height < MARGIN + 10:
            self.new_page()

    def wrap(self, text: str, font: str, size: float, width: float) -> list[str]:
        lines: list[str] = []
        for para in (text or "").split("\n"):
            words, cur = para.split(), ""
            if not words:
                lines.append("")
                continue
            for w in words:
                cand = f"{cur} {w}" if cur else w
                if pdfmetrics.stringWidth(shape(cand), font, size) <= width or not cur:
                    cur = cand
                else:
                    lines.append(cur)
                    cur = w
            lines.append(cur)
        return lines

    def text(self, text: str, size: float = 10, font: str = FONT, color=INK, gap: float = 3,
             indent: float = 0, max_lines: int | None = None):
        width = self.right - self.left - indent
        lines = self.wrap(text, font, size, width)
        if max_lines and len(lines) > max_lines:
            lines = lines[:max_lines] + ["…"]
        for line in lines:
            self.need(size + gap)
            self.y -= size + gap
            self.c.setFont(font, size)
            self.c.setFillColor(color)
            self.c.drawRightString(self.right - indent, self.y, shape(line))

    def rule(self, space: float = 8):
        self.need(space * 2)
        self.y -= space
        self.c.setStrokeColor(LINE)
        self.c.setLineWidth(0.7)
        self.c.line(self.left, self.y, self.right, self.y)
        self.y -= space


def _report_pages(job: dict, s: dict) -> bytes:
    _register_fonts()
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"{s['name']} - {job['title']}")
    w = _Writer(c, f"تقرير تصحيح · {s['name']}")

    # header
    c.setFillColor(BRAND)
    c.rect(0, PAGE_H - 30, PAGE_W, 30, stroke=0, fill=1)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont(FONT_BOLD, 11)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 20, shape("تقرير تصحيح الامتحان"))
    w.y = PAGE_H - 52
    passed = s["grade"] >= 55
    c.setFillColor(STATUS_COLORS["correct"] if passed else STATUS_COLORS["wrong"])
    c.setFont(FONT_BOLD, 34)
    c.drawString(MARGIN, w.y - 30, str(s["grade"]))
    c.setFont(FONT, 9)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, w.y - 46, shape(f"{_num(s['total'])} من {_num(s['max_points'])} نقطة"))
    w.right = PAGE_W - MARGIN
    w.text(s["name"], size=18, font=FONT_BOLD, gap=6)
    w.text(job["title"], size=10, color=MUTED)
    if job.get("label") and job.get("label") != job["title"]:
        w.text(job["label"], size=9, color=MUTED)
    w.y = min(w.y, PAGE_H - 52 - 52)
    if job.get("structure"):
        secs = "؛ ".join(f"من الأسئلة {', '.join(x['qids'])} يُحسب {x['required']}" for x in job["structure"])
        w.text(f"مبنى الامتحان: {secs}", size=8.5, color=MUTED)
    if s.get("error"):
        w.text(s["error"], size=9, color=STATUS_COLORS["wrong"])
    w.rule(10)

    # questions
    for it in s["items"]:
        counted = it.get("counted", True)
        w.need(40)
        w.y -= 14
        color = STATUS_COLORS.get(it["status"], INK) if counted else MUTED
        c.setFont(FONT_BOLD, 11.5)
        c.setFillColor(INK if counted else MUTED)
        head = f"سؤال {it['qid']}" + ("" if counted else " — لا يُحسب (أجاب الطالب عن أسئلة أكثر من المطلوب)")
        c.drawRightString(w.right, w.y, shape(head))
        c.setFillColor(color)
        c.drawString(w.left, w.y, f"{_num(it['score'])} / {_num(it['points'])}")
        c.setFont(FONT, 8.5)
        c.drawString(w.left + 62, w.y + 1, shape(STATUS_LABELS.get(it["status"], "")))
        if it.get("description"):
            w.text(it["description"], size=9, color=MUTED, max_lines=4)
        if it.get("student_answer"):
            w.text(f"إجابة الطالب: {it['student_answer']}", size=9, max_lines=6)
        if it.get("feedback"):
            w.text(f"ملاحظة: {it['feedback']}", size=9.5, color=color if counted else MUTED, max_lines=12)
        w.rule(6)

    if s.get("general_feedback"):
        w.text("ملاحظة عامة", size=11, font=FONT_BOLD, gap=8)
        w.text(s["general_feedback"], size=10)
    if s.get("teacher_comment"):
        w.text("ملاحظة المعلم", size=11, font=FONT_BOLD, gap=10)
        w.text(s["teacher_comment"], size=10)
    w._footer()
    c.save()
    return buf.getvalue()


def _image_pages(images: list[tuple[str, bytes]]) -> bytes:
    _register_fonts()
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    m = 18
    for n, (name, data) in enumerate(images, start=1):
        img = ImageReader(BytesIO(data))
        iw, ih = img.getSize()
        scale = min((PAGE_W - 2 * m) / iw, (PAGE_H - 2 * m - 14) / ih)
        w, h = iw * scale, ih * scale
        c.drawImage(img, (PAGE_W - w) / 2, PAGE_H - m - h, w, h)
        c.setFont(FONT, 7.5)
        c.setFillColor(MUTED)
        c.drawCentredString(PAGE_W / 2, 10, shape(f"حل الطالب · {name}"))
        c.showPage()
    c.save()
    return buf.getvalue()


def _note_page(text: str) -> bytes:
    _register_fonts()
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w = _Writer(c, "حل الطالب")
    w.text(text, size=11)
    c.showPage()
    c.save()
    return buf.getvalue()


def build_student_pdf(job: dict, student: dict, files: list[tuple[str, bytes]]) -> bytes:
    """Report pages, then the student's files in the order they were handed in."""
    from pypdf import PdfReader, PdfWriter

    out = PdfWriter()

    def add(pdf_bytes: bytes):
        for page in PdfReader(BytesIO(pdf_bytes)).pages:
            out.add_page(page)

    add(_report_pages(job, student))
    pending_images: list[tuple[str, bytes]] = []
    for name, data in files:
        ext = extension(name)
        if ext in IMAGE_EXTS:
            pending_images.append((name, data))
            continue
        if pending_images:
            add(_image_pages(pending_images))
            pending_images = []
        if ext == ".pdf":
            try:
                add(data)
            except Exception:
                add(_note_page(f"تعذر إرفاق الملف {name}"))
        else:
            add(_note_page(f"ملف الطالب «{name}» مرفق بصيغة لا يمكن عرضها هنا."))
    if pending_images:
        add(_image_pages(pending_images))
    out.add_metadata({"/Title": f"{student['name']} - {job['title']}"})
    buf = BytesIO()
    out.write(buf)
    return buf.getvalue()
