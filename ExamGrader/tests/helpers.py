from io import BytesIO

from openpyxl import Workbook

from app.rubric import TEMPLATE_HEADERS


def xlsx(cells: dict, sheet: str = "Sheet") -> bytes:
    """cells: {"A1": value} or {"A1": ("=FORMULA", cached_value)}.

    openpyxl cannot store a formula together with its computed value, so the
    cached value is injected straight into the sheet XML, the same way Excel
    saves it."""
    import re
    import zipfile

    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    cached = {}
    for ref, v in cells.items():
        if isinstance(v, tuple):
            ws[ref] = v[0]
            cached[ref] = v[1]
        else:
            ws[ref] = v
    buf = BytesIO()
    wb.save(buf)
    if not cached:
        return buf.getvalue()

    src = zipfile.ZipFile(BytesIO(buf.getvalue()))
    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            data = src.read(info)
            if info.filename == "xl/worksheets/sheet1.xml":
                xml = data.decode()
                for ref, value in cached.items():
                    xml = re.sub(rf'(<c r="{ref}"[^>]*>)(<f>[^<]*</f>)(<v>[^<]*</v>|<v\s*/>)?',
                                 lambda m: f"{m.group(1)}{m.group(2)}<v>{value}</v>", xml)
                data = xml.encode()
            dst.writestr(info, data)
    return out.getvalue()


def rubric_bytes(rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(TEMPLATE_HEADERS)
    for r in rows:
        ws.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
