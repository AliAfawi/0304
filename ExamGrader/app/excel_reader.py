"""Reading cell values and formulas from Excel workbooks."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils.cell import range_boundaries, get_column_letter


@dataclass
class CellData:
    ref: str
    value: object  # computed value (cached by Excel)
    formula: str | None  # e.g. "=AVERAGE(B2:B10)", or None


class WorkbookError(ValueError):
    pass


def _recalculate_with_libreoffice(data: bytes) -> bytes | None:
    """Files written by scripts have formulas without computed values.
    If LibreOffice is installed, open and re-save the file to compute them."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.xlsx"
        out_dir = Path(tmp) / "out"
        src.write_bytes(data)
        try:
            subprocess.run(
                [soffice, "--headless", "--norestore", "--convert-to", "xlsx",
                 "--outdir", str(out_dir), str(src)],
                check=True, capture_output=True, timeout=120,
            )
        except (subprocess.SubprocessError, OSError):
            return None
        result = out_dir / "in.xlsx"
        return result.read_bytes() if result.exists() else None


class ExcelFile:
    def __init__(self, data: bytes, recalc: bool = True):
        try:
            self._formulas = load_workbook(BytesIO(data), data_only=False)
            self._values = load_workbook(BytesIO(data), data_only=True)
        except Exception as exc:
            raise WorkbookError("لا يمكن فتح الملف كملف Excel (xlsx)") from exc
        self.recalculated = False
        if recalc and self._has_uncomputed_formulas():
            new = _recalculate_with_libreoffice(data)
            if new:
                self._values = load_workbook(BytesIO(new), data_only=True)
                self.recalculated = True

    def _has_uncomputed_formulas(self) -> bool:
        for ws in self._formulas.worksheets:
            vws = self._values[ws.title]
            for row in ws.iter_rows():
                for c in row:
                    if isinstance(c.value, str) and c.value.startswith("="):
                        if vws[c.coordinate].value is None:
                            return True
        return False

    @property
    def sheet_names(self) -> list[str]:
        return self._formulas.sheetnames

    def _sheet_name(self, sheet: str | None) -> str:
        if not sheet:
            return self._formulas.sheetnames[0]
        if sheet in self._formulas.sheetnames:
            return sheet
        # tolerate case / surrounding-space differences
        for name in self._formulas.sheetnames:
            if name.strip().lower() == sheet.strip().lower():
                return name
        raise WorkbookError(f"ورقة العمل «{sheet}» غير موجودة في الملف")

    def cells(self, sheet: str | None, ref: str) -> list[CellData]:
        name = self._sheet_name(sheet)
        fws = self._formulas[name]
        vws = self._values[name]
        min_col, min_row, max_col, max_row = range_boundaries(ref)
        out = []
        for r in range(min_row, max_row + 1):
            for c in range(min_col, max_col + 1):
                coord = f"{get_column_letter(c)}{r}"
                raw = fws[coord].value
                formula = raw if isinstance(raw, str) and raw.startswith("=") else None
                value = vws[coord].value
                if formula is None:
                    value = raw if value is None else value
                out.append(CellData(ref=coord, value=value, formula=formula))
        return out

    def as_text(self, max_cells: int = 4000) -> str:
        """Plain-text dump (value and formula) used for AI grading."""
        lines: list[str] = []
        count = 0
        for ws in self._formulas.worksheets:
            vws = self._values[ws.title]
            lines.append(f"### ورقة: {ws.title}")
            for row in ws.iter_rows():
                for c in row:
                    if c.value is None:
                        continue
                    v = vws[c.coordinate].value
                    if isinstance(c.value, str) and c.value.startswith("="):
                        lines.append(f"{c.coordinate}: {v!r}  (معادلة: {c.value})")
                    else:
                        lines.append(f"{c.coordinate}: {c.value!r}")
                    count += 1
                    if count >= max_cells:
                        lines.append("... (تم اختصار بقية الخلايا)")
                        return "\n".join(lines)
        return "\n".join(lines)
