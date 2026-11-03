"""Web app: upload exam files, grade every student, review and export results."""
from __future__ import annotations

import io
import re
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path, PurePath
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import ai_grader, grader, reports, storage
from .excel_reader import ExcelFile, WorkbookError
from .extract import SUPPORTED_EXTS, extension
from .rubric import CHECK_LABELS_AR, Rubric, RubricError, build_template, parse_rubric

BASE = Path(__file__).resolve().parent
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_ZIP_TOTAL = 300 * 1024 * 1024
MAX_STUDENTS = 500
AI_WORKERS = 4

app = FastAPI(title="مصحح امتحانات تحليل البيانات")
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
templates = Jinja2Templates(directory=BASE / "templates")
templates.env.globals.update(check_labels=CHECK_LABELS_AR, pass_mark=grader.PASS_MARK)


def _num(x) -> str:
    """12.0 -> "12", 7.5 -> "7.5"."""
    try:
        f = round(float(x), 2)
    except (TypeError, ValueError):
        return str(x)
    return str(int(f)) if f.is_integer() else f"{f:g}"


templates.env.filters["num"] = _num

STATUS_LABELS = {
    grader.STATUS_CORRECT: "صحيح", grader.STATUS_PARTIAL: "جزئي",
    grader.STATUS_WRONG: "خطأ", grader.STATUS_REVIEW: "للمراجعة",
}
templates.env.globals["status_labels"] = STATUS_LABELS


class UploadError(ValueError):
    pass


# ----------------------------------------------------------------- uploads

async def _read(upload: UploadFile | None) -> tuple[str, bytes] | None:
    if upload is None or not upload.filename:
        return None
    data = await upload.read(MAX_FILE_BYTES + 1)
    if len(data) > MAX_FILE_BYTES:
        raise UploadError(f"الملف {upload.filename} أكبر من الحد المسموح (25MB)")
    if not data:
        return None
    return PurePath(upload.filename).name, data


def _student_name(filename: str) -> str:
    stem = PurePath(filename).stem
    return re.sub(r"[_\-]+", " ", stem).strip() or "طالب"


def collect_student_files(files: list[tuple[str, bytes]]) -> list[tuple[str, bytes]]:
    """Expand ZIP archives; keep supported files only."""
    out: list[tuple[str, bytes]] = []
    for name, data in files:
        if extension(name) == ".zip":
            try:
                zf = zipfile.ZipFile(io.BytesIO(data))
            except zipfile.BadZipFile:
                raise UploadError(f"الملف {name} ليس ملف ZIP صالحاً")
            total = 0
            for info in zf.infolist():
                inner = PurePath(info.filename)
                if info.is_dir() or "__MACOSX" in inner.parts or inner.name.startswith((".", "~$")):
                    continue
                if extension(inner.name) not in SUPPORTED_EXTS:
                    continue
                total += info.file_size
                if info.file_size > MAX_FILE_BYTES or total > MAX_ZIP_TOTAL:
                    raise UploadError(f"محتوى الملف {name} كبير جداً")
                out.append((inner.name, zf.read(info)))
        elif extension(name) in SUPPORTED_EXTS:
            out.append((name, data))
    if len(out) > MAX_STUDENTS:
        raise UploadError(f"عدد ملفات الطلاب أكبر من {MAX_STUDENTS}")
    return out


def _unique_names(files: list[tuple[str, bytes]]) -> list[tuple[str, str, bytes]]:
    seen: dict[str, int] = {}
    out = []
    for filename, data in sorted(files, key=lambda f: f[0]):
        base = _student_name(filename)
        seen[base] = seen.get(base, 0) + 1
        name = base if seen[base] == 1 else f"{base} ({seen[base]})"
        out.append((name, filename, data))
    return out


# --------------------------------------------------------------- grading run

def run_job(job_id: str, students: list[tuple[str, str, bytes]], rubric: Rubric | None,
            solution: tuple[str, bytes] | None, exam: tuple[str, bytes] | None,
            rubric_file: tuple[str, bytes]) -> None:
    key = None
    warnings: list[str] = []
    if rubric is not None and solution and extension(solution[0]) in {".xlsx", ".xlsm"}:
        try:
            key = ExcelFile(solution[1])
        except WorkbookError as exc:
            warnings.append(f"تعذر فتح الامتحان المحلول: {exc}")

    reference_blocks = None

    def refs():
        nonlocal reference_blocks
        if reference_blocks is None:
            reference_blocks = ai_grader.build_reference_blocks(exam, solution, rubric_file)
        return reference_blocks

    def grade_one(entry):
        name, filename, data = entry
        is_excel = extension(filename) in {".xlsx", ".xlsm"}

        def failed(msg):
            return grader.summarize({
                "name": name, "filename": filename, "mode": "ai", "items": [], "error": msg,
                "general_feedback": "", "teacher_comment": "", "reviewed": False,
            })
        try:
            if rubric is not None and is_excel:
                result = grader.grade_excel_student(name, filename, data, rubric, key)
            elif ai_grader.ai_available():
                result = grader.grade_ai_student(name, filename, data, refs())
            else:
                result = failed("هذا الملف ليس Excel ويحتاج تصحيحاً بالذكاء الاصطناعي، لكن مفتاح API غير مُعدّ")
        except Exception as exc:  # one broken file must not stop the class
            result = failed(f"حدث خطأ أثناء تصحيح هذا الملف: {exc}")

        def add(job):
            job["students"].append(result)
            job["progress"] += 1
        storage.update_job(job_id, add)

    try:
        if ai_grader.ai_available() and (rubric is None or any(
                extension(f) not in {".xlsx", ".xlsm"} for _, f, _ in students)):
            refs()  # build once before fanning out so all workers share the cache prefix
        with ThreadPoolExecutor(max_workers=AI_WORKERS) as pool:
            list(pool.map(grade_one, students))
        status, error = "done", None
    except Exception as exc:  # keep partial results; surface the problem
        status, error = "failed", f"حدث خطأ أثناء التصحيح: {exc}"

    def finish(job):
        order = {name: i for i, (name, _, _) in enumerate(students)}
        job["students"].sort(key=lambda s: order.get(s["name"], 0))
        job["status"] = status
        job["error"] = error
        job["warnings"] = job.get("warnings", []) + warnings
    storage.update_job(job_id, finish)


# -------------------------------------------------------------------- pages

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html", {
        "jobs": storage.list_jobs(), "ai": ai_grader.ai_available(), "error": None,
    })


@app.get("/rubric-template.xlsx")
def rubric_template():
    return Response(build_template(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote("سلم_التصحيح.xlsx")})


@app.post("/grade")
async def grade(request: Request,
                title: str = Form(""),
                exam: UploadFile | None = File(None),
                solution: UploadFile | None = File(None),
                rubric: UploadFile = File(...),
                students: list[UploadFile] = File(...)):
    def fail(msg: str):
        return templates.TemplateResponse(request, "index.html", {
            "jobs": storage.list_jobs(), "ai": ai_grader.ai_available(), "error": msg,
        }, status_code=400)

    try:
        exam_f = await _read(exam)
        solution_f = await _read(solution)
        rubric_f = await _read(rubric)
        raw_students = [f for f in [await _read(u) for u in students] if f]
        student_files = collect_student_files(raw_students)
    except UploadError as exc:
        return fail(str(exc))

    if not rubric_f:
        return fail("يجب رفع سلم التصحيح")
    if not student_files:
        return fail("لم يتم العثور على ملفات طلاب مدعومة (xlsx, pdf, docx, ipynb, py, sql, txt, csv أو ZIP يحتويها)")
    if extension(rubric_f[0]) not in SUPPORTED_EXTS:
        return fail("صيغة سلم التصحيح غير مدعومة")

    structured: Rubric | None = None
    rubric_error = None
    if extension(rubric_f[0]) in {".xlsx", ".xlsm"}:
        try:
            structured = parse_rubric(rubric_f[1])
        except RubricError as exc:
            rubric_error = str(exc)

    if structured is None and not ai_grader.ai_available():
        msg = ("سلم التصحيح ليس بالصيغة المنظمة (قالب Excel)، والتصحيح الحر يحتاج مفتاح ذكاء اصطناعي. "
               "حمّل القالب واملأه، أو اضبط ANTHROPIC_API_KEY.")
        if rubric_error:
            msg += f" التفاصيل: {rubric_error}"
        return fail(msg)

    named = _unique_names(student_files)
    job_id = storage.new_job_id()
    warnings = []
    if structured is None:
        warnings.append("التصحيح تم بالذكاء الاصطناعي حسب سلم تصحيح حر؛ يُنصح بمراجعة العلامات قبل اعتمادها.")
    elif not solution_f and any(i.expected is None for i in structured.items):
        warnings.append("لم يُرفع امتحان محلول، والبنود التي ليس لها «إجابة متوقعة» في السلم ستظهر للمراجعة.")
    job = {
        "id": job_id,
        "title": title.strip() or f"امتحان {datetime.now():%d/%m/%Y}",
        "created": datetime.now().isoformat(timespec="seconds"),
        "status": "running", "error": None, "progress": 0, "total": len(named),
        "mode": "rubric" if structured else "ai",
        "files": {"exam": exam_f[0] if exam_f else None,
                  "solution": solution_f[0] if solution_f else None,
                  "rubric": rubric_f[0]},
        "rubric": structured.to_dict() if structured else None,
        "warnings": warnings, "students": [],
    }
    storage.save_job(job)
    threading.Thread(target=run_job, daemon=True,
                     args=(job_id, named, structured, solution_f, exam_f, rubric_f)).start()
    return RedirectResponse(f"/jobs/{job_id}", status_code=303)


def _job_or_404(job_id: str) -> dict:
    try:
        return storage.load_job(job_id)
    except KeyError:
        raise HTTPException(404, "التصحيح غير موجود")


def _student_or_404(job: dict, idx: int) -> dict:
    if not 0 <= idx < len(job["students"]):
        raise HTTPException(404, "الطالب غير موجود")
    return job["students"][idx]


@app.get("/jobs/{job_id}", response_class=HTMLResponse)
def job_page(request: Request, job_id: str):
    job = _job_or_404(job_id)
    if job["status"] == "running":
        return templates.TemplateResponse(request, "progress.html", {"job": job})
    qids = reports.question_order(job["students"])
    return templates.TemplateResponse(request, "job.html", {
        "job": job, "qids": qids,
        "scores": [reports.question_scores(s) for s in job["students"]],
        "stats": reports.class_stats(job["students"]),
        "similar": reports.similarity_flags(job["students"]),
    })


@app.get("/jobs/{job_id}/students/{idx}", response_class=HTMLResponse)
def student_page(request: Request, job_id: str, idx: int, saved: int = 0):
    job = _job_or_404(job_id)
    return templates.TemplateResponse(request, "student.html", {
        "job": job, "s": _student_or_404(job, idx), "idx": idx,
        "standalone": False, "saved": bool(saved),
    })


@app.post("/jobs/{job_id}/students/{idx}")
async def save_student(request: Request, job_id: str, idx: int):
    form = await request.form()
    _job_or_404(job_id)

    def apply(job):
        s = _student_or_404(job, idx)
        for n, item in enumerate(s["items"]):
            raw = form.get(f"score_{n}")
            if raw is not None and str(raw).strip() != "":
                try:
                    value = float(str(raw).replace(",", "."))
                except ValueError:
                    continue
                value = max(0.0, min(value, item["points"]))
                if abs(value - item["score"]) > 1e-9:
                    item["score"] = round(value, 2)
                    item["teacher_edited"] = True
                    item["status"] = grader._status(item["score"], item["points"])
            fb = form.get(f"feedback_{n}")
            if fb is not None:
                item["feedback"] = str(fb)[:2000]
        if "teacher_comment" in form:
            s["teacher_comment"] = str(form["teacher_comment"])[:4000]
            s["reviewed"] = form.get("reviewed") == "on"
        grader.summarize(s)
    storage.update_job(job_id, apply)
    return RedirectResponse(f"/jobs/{job_id}/students/{idx}?saved=1", status_code=303)


@app.get("/jobs/{job_id}/export.xlsx")
def export(job_id: str):
    job = _job_or_404(job_id)
    data = reports.export_grades_xlsx(job)
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(f"علامات - {job['title']}.xlsx")})


@app.get("/jobs/{job_id}/reports.zip")
def reports_zip(request: Request, job_id: str):
    job = _job_or_404(job_id)
    css = (BASE / "static" / "style.css").read_text(encoding="utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        used = set()
        for idx, s in enumerate(job["students"]):
            html = templates.get_template("student.html").render(
                request=request, job=job, s=s, idx=idx, standalone=True, inline_css=css, saved=False)
            fname = re.sub(r'[\\/:*?"<>|]', "_", s["name"]) or f"student_{idx + 1}"
            if fname in used:
                fname = f"{fname}_{idx + 1}"
            used.add(fname)
            zf.writestr(f"{fname}.html", html)
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(f"تقارير - {job['title']}.zip")})


@app.post("/jobs/{job_id}/delete")
def delete(job_id: str):
    _job_or_404(job_id)
    storage.delete_job(job_id)
    return RedirectResponse("/", status_code=303)
