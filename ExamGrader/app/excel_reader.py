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

    def charts(self, sheet: str | None = None) -> list["ChartInfo"]:
        """Charts on one sheet, or on every sheet when `sheet` is empty."""
        return _excel_charts(self._formulas, self._sheet_name(sheet) if sheet else None)

    def pivots(self, sheet: str | None = None) -> list["PivotInfo"]:
        """Pivot tables on one sheet, or on every sheet when `sheet` is empty."""
        return _excel_pivots(self._formulas, self._sheet_name(sheet) if sheet else None)

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
                        return "\n".join(lines + self._objects_text())
        return "\n".join(lines + self._objects_text())

    def _objects_text(self) -> list[str]:
        objs = [c.describe() for c in self.charts()] + [p.describe() for p in self.pivots()]
        return (["### رسوم بيانية وجداول محورية"] + objs) if objs else []


# ------------------------------------------------------- charts and pivots

CHART_KINDS = {
    "column": "أعمدة", "bar": "أشرطة", "line": "خطي", "pie": "دائري",
    "doughnut": "حلقي", "scatter": "انتشار", "area": "مساحي", "radar": "راداري",
    "other": "آخر",
}


@dataclass
class ChartInfo:
    sheet: str
    kind: str                 # key of CHART_KINDS
    data_refs: list[tuple[str | None, str]]      # (sheet, "D2:D11") of the plotted values
    category_refs: list[tuple[str | None, str]]  # labels / x values
    title: str | None

    def describe(self) -> str:
        refs = ", ".join(r for _, r in self.data_refs) or "—"
        return f"رسم {CHART_KINDS.get(self.kind, self.kind)} في ورقة «{self.sheet}» (البيانات: {refs})"


@dataclass
class PivotInfo:
    sheet: str
    location: str
    rows: list[str]
    columns: list[str]
    values: list[tuple[str, str]]  # (field, function) e.g. ("Score", "average")
    source: str | None

    def describe(self) -> str:
        vals = ", ".join(f"{fn}({f})" for f, fn in self.values) or "—"
        return (f"جدول محوري في «{self.sheet}»: صفوف [{', '.join(self.rows) or '—'}]"
                + (f"، أعمدة [{', '.join(self.columns)}]" if self.columns else "")
                + f"، قيم [{vals}]")


def parse_ref(formula: str | None) -> tuple[str | None, str] | None:
    """"'Sheet 1'!$D$2:$D$11" -> ("Sheet 1", "D2:D11")."""
    if not formula:
        return None
    f = formula.replace("$", "").strip()
    if "!" in f:
        sheet, ref = f.rsplit("!", 1)
        sheet = sheet.strip("'").replace("''", "'")
    else:
        sheet, ref = None, f
    try:
        range_boundaries(ref)
    except (ValueError, TypeError):
        return None
    return sheet, ref.upper()


def _chart_kind(chart) -> str:
    name = type(chart).__name__.replace("3D", "")
    if name == "BarChart":
        return "bar" if getattr(chart, "barDir", "col") == "bar" else "column"
    return {"LineChart": "line", "PieChart": "pie", "ProjectedPieChart": "pie",
            "DoughnutChart": "doughnut", "ScatterChart": "scatter", "AreaChart": "area",
            "RadarChart": "radar", "BubbleChart": "scatter"}.get(name, "other")


def _series_refs(series) -> tuple[list, list]:
    data, cats = [], []

    def add(target, ds):
        if ds is None:
            return
        for attr in ("numRef", "strRef"):
            ref = getattr(ds, attr, None)
            parsed = parse_ref(getattr(ref, "f", None)) if ref is not None else None
            if parsed:
                target.append(parsed)
    for s in series or []:
        add(data, getattr(s, "val", None))
        add(data, getattr(s, "yVal", None))
        add(cats, getattr(s, "cat", None))
        add(cats, getattr(s, "xVal", None))
    return data, cats


def _chart_title(chart) -> str | None:
    try:
        rich = chart.title.tx.rich
        return "".join(r.t for p in rich.p for r in (p.r or []) if r.t) or None
    except AttributeError:
        return None


def _excel_charts(wb, sheet: str | None) -> list[ChartInfo]:
    out = []
    for ws in wb.worksheets:
        if sheet and ws.title != sheet:
            continue
        for chart in getattr(ws, "_charts", []):
            data, cats = _series_refs(getattr(chart, "series", []))
            out.append(ChartInfo(ws.title, _chart_kind(chart), data, cats, _chart_title(chart)))
    return out


def _excel_pivots(wb, sheet: str | None) -> list[PivotInfo]:
    out = []
    for ws in wb.worksheets:
        if sheet and ws.title != sheet:
            continue
        for p in getattr(ws, "_pivots", []):
            names = [cf.name for cf in p.cache.cacheFields]

            def field(x):
                return names[x] if 0 <= x < len(names) else str(x)
            rows = [field(f.x) for f in (p.rowFields or []) if f.x is not None and f.x >= 0]
            cols = [field(f.x) for f in (p.colFields or []) if f.x is not None and f.x >= 0]
            values = [(field(d.fld), (d.subtotal or "sum").lower()) for d in (p.dataFields or [])]
            src = None
            ws_src = getattr(getattr(p.cache, "cacheSource", None), "worksheetSource", None)
            if ws_src is not None:
                src = f"{ws_src.sheet or ''}!{ws_src.ref or ws_src.name or ''}"
            out.append(PivotInfo(ws.title, p.location.ref, rows, cols, values, src))
    return out

