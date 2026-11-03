"""Turning uploaded files (PDF, Word, Excel, code, notebooks) into text."""
from __future__ import annotations

import json
from io import BytesIO
from pathlib import PurePath

TEXT_EXTS = {".txt", ".csv", ".py", ".sql", ".r", ".md", ".json", ".tsv"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
SUPPORTED_EXTS = TEXT_EXTS | IMAGE_EXTS | {".pdf", ".docx", ".xlsx", ".xlsm", ".ipynb"}


def extension(filename: str) -> str:
    return PurePath(filename).suffix.lower()


def _decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "cp1256", "cp1255", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _pdf_text(data: bytes) -> str:
    import pdfplumber

    parts = []
    with pdfplumber.open(BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            parts.append(f"--- صفحة {i} ---\n{page.extract_text() or ''}")
    text = "\n".join(parts)
    if len(text.replace("-", "").replace("صفحة", "").strip()) < 20:
        text += "\n[تنبيه: يبدو أن ملف PDF ممسوح ضوئياً (صورة) ولا يحتوي على نص قابل للقراءة]"
    return text


def _docx_text(data: bytes) -> str:
    import docx

    d = docx.Document(BytesIO(data))
    parts = [p.text for p in d.paragraphs if p.text.strip()]
    for t_i, table in enumerate(d.tables, start=1):
        parts.append(f"[جدول {t_i}]")
        for row in table.rows:
            parts.append(" | ".join(c.text.strip() for c in row.cells))
    return "\n".join(parts)


def _ipynb_text(data: bytes) -> str:
    nb = json.loads(_decode(data))
    parts = []
    for i, cell in enumerate(nb.get("cells", []), start=1):
        src = "".join(cell.get("source", []))
        parts.append(f"--- خلية {i} ({cell.get('cell_type')}) ---\n{src}")
        for out in cell.get("outputs", []) or []:
            text = out.get("text") or out.get("data", {}).get("text/plain")
            if text:
                parts.append("[المخرجات]\n" + "".join(text if isinstance(text, list) else [text]))
    return "\n".join(parts)


def file_to_text(filename: str, data: bytes) -> str:
    ext = extension(filename)
    if ext == ".pdf":
        return _pdf_text(data)
    if ext == ".docx":
        return _docx_text(data)
    if ext in {".xlsx", ".xlsm"}:
        from .excel_reader import ExcelFile

        return ExcelFile(data).as_text()
    if ext == ".ipynb":
        return _ipynb_text(data)
    if ext in TEXT_EXTS:
        return _decode(data)
    if ext in IMAGE_EXTS:
        raise ValueError("الصور تُقرأ بالذكاء الاصطناعي فقط")
    raise ValueError(f"نوع الملف {ext or '(بدون امتداد)'} غير مدعوم")
