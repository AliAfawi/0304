"""Regenerate the pivot-table fixtures (needs LibreOffice and its Python UNO bridge).

    python3 tests/fixtures/make_pivots.py

openpyxl cannot create pivot tables, so the files are built by LibreOffice
the same way Excel would save them.
"""
import subprocess
import sys
import time
from pathlib import Path

import uno
from com.sun.star.beans import PropertyValue
from com.sun.star.table import CellAddress, CellRangeAddress

HERE = Path(__file__).resolve().parent
PORT = 2099
ROWS = [("Class", "Gender", "Score"), ("A", "M", 80), ("B", "F", 70), ("A", "F", 90), ("B", "M", 60)]
# name: (row field index, data function, put pivot on its own sheet?)
VARIANTS = {
    "pivot_key.xlsx": (0, "AVERAGE", False),
    "pivot_good.xlsx": (0, "AVERAGE", True),
    "pivot_sum.xlsx": (0, "SUM", False),
    "pivot_rows.xlsx": (1, "AVERAGE", False),
    "pivot_none.xlsx": None,
}


def pv(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


def connect():
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(60):
        try:
            return resolver.resolve(f"uno:socket,host=localhost,port={PORT};urp;StarOffice.ComponentContext")
        except Exception:
            time.sleep(0.5)
    sys.exit("LibreOffice did not start")


def build(desktop, out: Path, spec):
    from com.sun.star.sheet.DataPilotFieldOrientation import DATA, ROW

    doc = desktop.loadComponentFromURL("private:factory/scalc", "_blank", 0, (pv("Hidden", True),))
    sheet = doc.Sheets.getByIndex(0)
    sheet.Name = "Data"
    for r, row in enumerate(ROWS):
        for c, v in enumerate(row):
            cell = sheet.getCellByPosition(c, r)
            if isinstance(v, str):
                cell.String = v
            else:
                cell.Value = v
    if spec:
        row_field, func, own_sheet = spec
        target = sheet
        if own_sheet:
            doc.Sheets.insertNewByName("Pivot", 1)
            target = doc.Sheets.getByName("Pivot")
        desc = sheet.getDataPilotTables().createDataPilotDescriptor()
        rng = CellRangeAddress()
        rng.Sheet, rng.StartColumn, rng.StartRow, rng.EndColumn, rng.EndRow = 0, 0, 0, 2, len(ROWS) - 1
        desc.setSourceRange(rng)
        fields = desc.getDataPilotFields()
        fields.getByIndex(row_field).Orientation = ROW
        data = fields.getByIndex(2)
        data.Orientation = DATA
        data.Function = uno.Enum("com.sun.star.sheet.GeneralFunction", func)
        dest = CellAddress()
        dest.Sheet, dest.Column, dest.Row = (1, 0, 0) if own_sheet else (0, 5, 0)
        target.getDataPilotTables().insertNewByName("Pivot1", dest, desc)
    doc.storeToURL(uno.systemPathToFileUrl(str(out)), (pv("FilterName", "Calc MS Excel 2007 XML"),))
    doc.close(True)


def main():
    proc = subprocess.Popen(["soffice", "--headless", "--norestore",
                             f"--accept=socket,host=localhost,port={PORT};urp;"])
    try:
        ctx = connect()
        desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        for name, spec in VARIANTS.items():
            build(desktop, HERE / name, spec)
        try:
            desktop.terminate()
        except Exception:
            pass
    finally:
        try:
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()
    print("fixtures written to", HERE)


if __name__ == "__main__":
    main()
