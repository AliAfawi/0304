"""Web app: upload exam files, grade every student, review and export results."""
from __future__ import annotations

import hmac
import io
import os
import secrets
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
from starlette.datastructures import UploadFile as StarletteUpload

from . import ai_grader, auth, catalog, grader, library, mahvan, pdf_report, reports, scanner, storage
from .excel_reader import ExcelFile, WorkbookError
from .extract import IMAGE_EXTS, SUPPORTED_EXTS, extension
from .rubric import CHECK_LABELS_AR, Rubric, RubricError, build_template, parse_rubric
from .structure import StructureError, parse_structure, sections_from_dicts, sections_to_dicts

BASE = Path(__file__).resolve().parent
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_ZIP_TOTAL = 300 * 1024 * 1024
MAX_STUDENTS = 500
AI_WORKERS = 4

app = FastAPI(title="مصحح الامتحانات")
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
    """Expand ZIP archives; keep supported files only. Paths inside a ZIP are
    kept (e.g. "class/Ahmad/page1.jpg") so files can be grouped per student."""
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
                if ".." in inner.parts or extension(inner.name) not in SUPPORTED_EXTS:
                    continue
                total += info.file_size
                if info.file_size > MAX_FILE_BYTES or total > MAX_ZIP_TOTAL:
                    raise UploadError(f"محتوى الملف {name} كبير جداً")
                out.append((inner.as_posix(), zf.read(info)))
        elif extension(name) in SUPPORTED_EXTS:
            out.append((name, data))
    if len(out) > MAX_STUDENTS * 20:
        raise UploadError("عدد الملفات كبير جداً")
    return out


# "Ahmad_2.jpg", "Ahmad - 3.png", "Ahmad (2).jpg", "Ahmad p2.jpg", "أحمد صفحة 2.jpg"
_PAGE_SUFFIX = re.compile(r"^(.+?)(?:[\s_\-]+(?:p|page|صفحة|עמוד)?\s*\d{1,2}|\s*\(\d{1,2}\))$", re.IGNORECASE)


def group_submissions(files: list[tuple[str, bytes]]) -> list[tuple[str, list[tuple[str, bytes]]]]:
    """One entry per student: [(name, [(filename, data), ...])].

    - Files in their own folder belong to that student (folder name = name).
    - Photos named like "Ahmad_1.jpg", "Ahmad_2.jpg" are pages of one student.
    - Any other file is one student, named after the file.
    """
    parents = [PurePath(p).parent.parts for p, _ in files]
    common = parents[0] if parents else ()
    for parts in parents[1:]:
        n = 0
        while n < min(len(common), len(parts)) and common[n] == parts[n]:
            n += 1
        common = common[:n]

    groups: dict[str, list[tuple[str, bytes]]] = {}
    for path, data in sorted(files, key=lambda f: f[0]):
        pp = PurePath(path)
        below = pp.parent.parts[len(common):]
        if below:
            key = below[0]
        elif extension(pp.name) in IMAGE_EXTS:
            m = _PAGE_SUFFIX.match(pp.stem)
            key = m.group(1) if m else pp.stem
        else:
            key = pp.stem + "\0" + pp.suffix  # same name, different type: separate students
        groups.setdefault(key, []).append((pp.name, data))
    if len(groups) > MAX_STUDENTS:
        raise UploadError(f"عدد الطلاب أكبر من {MAX_STUDENTS}")

    seen: dict[str, int] = {}
    out = []
    for key, group in groups.items():
        base = _student_name(key.split("\0")[0])
        seen[base] = seen.get(base, 0) + 1
        out.append((base if seen[base] == 1 else f"{base} ({seen[base]})", group))
    return out


# --------------------------------------------------------------- grading run

EXCEL_EXTS = {".xlsx", ".xlsm"}


def run_job(job_id: str, students: list[tuple[str, list[tuple[str, bytes]]]], rubric: Rubric | None,
            solution: tuple[str, bytes] | None, exam: tuple[str, bytes] | None,
            rubric_file: tuple[str, bytes] | None, sections: list | None = None,
            context: str = "", scheme: list[dict] | None = None, scan: bool = True) -> None:
    """Grade every student. `scheme` is the teacher's marking scheme (מחוון)
    from the site; `scan` turns photos into clean scans first."""
    key = None
    if scheme:
        rubric_file = ("מחוון.txt", mahvan.as_text(scheme).encode("utf-8"))
    warnings: list[str] = []
    if rubric is not None and solution and extension(solution[0]) in EXCEL_EXTS:
        try:
            key = ExcelFile(solution[1])
        except WorkbookError as exc:
            warnings.append(f"تعذر فتح الامتحان المحلول: {exc}")

    reference_blocks = None
    refs_lock = threading.Lock()

    def refs():
        nonlocal reference_blocks
        with refs_lock:
            if reference_blocks is None:
                reference_blocks = ai_grader.build_reference_blocks(exam, solution, rubric_file, context)
        return reference_blocks

    def grade_one(entry):
        name, files = entry
        file_key = secrets.token_hex(8)
        scanned_pages = 0
        if scan:
            processed = []
            for fname, data in files:
                if extension(fname) in IMAGE_EXTS:
                    try:
                        res = scanner.scan_image(data)
                        processed.append((PurePath(fname).stem + ".jpg", res.data))
                        scanned_pages += 1
                        continue
                    except Exception:
                        pass  # keep the original photo
                processed.append((fname, data))
            files = processed
        try:
            storage.save_student_files(job_id, file_key, files)
        except OSError:
            file_key = None
        excel = [f for f in files if extension(f[0]) in EXCEL_EXTS]

        def failed(msg):
            return grader.summarize({
                "name": name, "filename": "، ".join(f for f, _ in files), "files": [f for f, _ in files],
                "mode": "ai", "items": [], "error": msg,
                "general_feedback": "", "teacher_comment": "", "reviewed": False,
            })
        try:
            if rubric is not None and excel:
                result = grader.grade_excel_student(name, excel[0][0], excel[0][1], rubric, key,
                                                    sections, context)
                if len(files) > 1:
                    result["error"] = (f"تم تصحيح الملف {excel[0][0]} فقط؛ "
                                       f"بقية ملفات الطالب ({len(files) - 1}) لم تُصحح")
                    grader.summarize(result)
            elif ai_grader.ai_available():
                result = grader.grade_ai_student(name, files, refs(), sections, scheme)
            else:
                result = failed("هذه الملفات تحتاج تصحيحاً بالذكاء الاصطناعي (صور، PDF، Word...)، "
                                "لكن مفتاح API غير مُعدّ")
        except Exception as exc:  # one broken file must not stop the class
            result = failed(f"حدث خطأ أثناء تصحيح ملفات هذا الطالب: {exc}")
        result["file_key"] = file_key
        result["scanned_pages"] = scanned_pages

        def add(job):
            job["students"].append(result)
            job["progress"] += 1
        storage.update_job(job_id, add)

    try:
        with ThreadPoolExecutor(max_workers=AI_WORKERS) as pool:
            list(pool.map(grade_one, students))
        status, error = "done", None
    except Exception as exc:  # keep partial results; surface the problem
        status, error = "failed", f"حدث خطأ أثناء التصحيح: {exc}"

    def finish(job):
        order = {name: i for i, (name, _) in enumerate(students)}
        job["students"].sort(key=lambda s: order.get(s["name"], 0))
        job["status"] = status
        job["error"] = error
        job["warnings"] = job.get("warnings", []) + warnings
    storage.update_job(job_id, finish)


# --------------------------------------------------------------------- auth

class LoginRequired(Exception):
    pass


@app.exception_handler(LoginRequired)
def _login_redirect(request: Request, exc: LoginRequired):
    if not auth.has_users():
        return RedirectResponse("/setup", status_code=303)
    nxt = request.url.path if request.method == "GET" else "/"
    return RedirectResponse(f"/login?next={quote(nxt)}", status_code=303)


class Session:
    def __init__(self, user: dict, csrf: str):
        self.user, self.csrf = user, csrf

    @property
    def is_admin(self) -> bool:
        return self.user["role"] == auth.ROLE_ADMIN


def session(request: Request) -> Session:
    found = auth.read_session(request.cookies.get(auth.COOKIE))
    if not found:
        raise LoginRequired()
    return Session(*found)


def admin_session(request: Request) -> Session:
    sess = session(request)
    if not sess.is_admin:
        raise HTTPException(403, "هذه الصفحة للمدير فقط")
    return sess


def check_csrf(sess: Session, token) -> None:
    if not token or not hmac.compare_digest(str(token), sess.csrf):
        raise HTTPException(403, "انتهت صلاحية الصفحة. حدّثها وحاول مرة أخرى")


def render(request: Request, name: str, ctx: dict, sess: Session | None = None, status_code: int = 200):
    ctx = dict(ctx, user=sess.user if sess else None, csrf=sess.csrf if sess else "",
               is_admin=bool(sess and sess.is_admin))
    return templates.TemplateResponse(request, name, ctx, status_code=status_code)


def _set_cookie(resp: Response, user: dict) -> Response:
    resp.set_cookie(auth.COOKIE, auth.make_session(user), max_age=auth.SESSION_SECONDS, httponly=True,
                    samesite="lax", secure=os.environ.get("EXAM_GRADER_SECURE_COOKIE") == "1")
    return resp


def _safe_next(nxt: str | None) -> str:
    return nxt if nxt and nxt.startswith("/") and not nxt.startswith("//") else "/"


@app.get("/setup", response_class=HTMLResponse)
def setup_page(request: Request):
    if auth.has_users():
        return RedirectResponse("/login", status_code=303)
    return render(request, "setup.html", {"error": None})


@app.post("/setup")
def setup(request: Request, username: str = Form(...), name: str = Form(""),
          password: str = Form(...), password2: str = Form(...)):
    if auth.has_users():
        return RedirectResponse("/login", status_code=303)
    try:
        if password != password2:
            raise auth.AuthError("كلمتا المرور غير متطابقتين")
        auth.create_user(username, name, password, role=auth.ROLE_ADMIN)
    except auth.AuthError as exc:
        return render(request, "setup.html", {"error": str(exc)}, status_code=400)
    return _set_cookie(RedirectResponse("/", status_code=303), auth.get_user(username.strip().lower()))


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request, next: str = "/"):
    if not auth.has_users():
        return RedirectResponse("/setup", status_code=303)
    return render(request, "login.html", {"error": None, "next": _safe_next(next)})


@app.post("/login")
def login(request: Request, username: str = Form(...), password: str = Form(...), next: str = Form("/")):
    try:
        user = auth.verify_password(username, password)
    except auth.AuthError as exc:
        return render(request, "login.html", {"error": str(exc), "next": _safe_next(next)}, status_code=401)
    return _set_cookie(RedirectResponse(_safe_next(next), status_code=303), user)


@app.post("/logout")
def logout():
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(auth.COOKIE)
    return resp


@app.get("/account", response_class=HTMLResponse)
def account_page(request: Request, saved: int = 0):
    sess = session(request)
    return render(request, "account.html", {"error": None, "saved": bool(saved)}, sess)


@app.post("/account")
def change_password(request: Request, csrf: str = Form(""), current: str = Form(...),
                    password: str = Form(...), password2: str = Form(...)):
    sess = session(request)
    check_csrf(sess, csrf)
    try:
        auth.verify_password(sess.user["username"], current)
        if password != password2:
            raise auth.AuthError("كلمتا المرور غير متطابقتين")
        auth.set_password(sess.user["username"], password)
    except auth.AuthError as exc:
        return render(request, "account.html", {"error": str(exc), "saved": False}, sess, status_code=400)
    # the password change invalidated this session too: issue a fresh one
    return _set_cookie(RedirectResponse("/account?saved=1", status_code=303), auth.get_user(sess.user["username"]))


@app.get("/users", response_class=HTMLResponse)
def users_page(request: Request, msg: str = ""):
    sess = admin_session(request)
    return render(request, "users.html", {"users": auth.list_users(), "error": None, "msg": msg}, sess)


@app.post("/users")
def add_user(request: Request, csrf: str = Form(""), username: str = Form(...), name: str = Form(""),
             password: str = Form(...), role: str = Form(auth.ROLE_TEACHER)):
    sess = admin_session(request)
    check_csrf(sess, csrf)
    try:
        auth.create_user(username, name, password, role=role)
    except auth.AuthError as exc:
        return render(request, "users.html", {"users": auth.list_users(), "error": str(exc), "msg": ""},
                      sess, status_code=400)
    return RedirectResponse("/users?msg=" + quote("تمت إضافة المستخدم"), status_code=303)


@app.post("/users/{username}/password")
def reset_password(request: Request, username: str, csrf: str = Form(""), password: str = Form(...)):
    sess = admin_session(request)
    check_csrf(sess, csrf)
    try:
        auth.set_password(username, password)
    except auth.AuthError as exc:
        return render(request, "users.html", {"users": auth.list_users(), "error": str(exc), "msg": ""},
                      sess, status_code=400)
    return RedirectResponse("/users?msg=" + quote("تم تغيير كلمة المرور"), status_code=303)


@app.post("/users/{username}/delete")
def remove_user(request: Request, username: str, csrf: str = Form("")):
    sess = admin_session(request)
    check_csrf(sess, csrf)
    try:
        if username == sess.user["username"]:
            raise auth.AuthError("لا يمكنك حذف حسابك")
        auth.delete_user(username)
    except auth.AuthError as exc:
        return render(request, "users.html", {"users": auth.list_users(), "error": str(exc), "msg": ""},
                      sess, status_code=400)
    return RedirectResponse("/users?msg=" + quote("تم حذف المستخدم"), status_code=303)


# -------------------------------------------------------------------- pages

def _visible_jobs(sess: Session) -> list[dict]:
    return storage.list_jobs(owner=None if sess.is_admin else sess.user["username"])


def _form_ctx(**extra) -> dict:
    return {
        "subjects": catalog.SUBJECTS, "units": catalog.UNITS, "seasons": catalog.SEASONS,
        "languages": ai_grader.FEEDBACK_LANGUAGES, "this_year": datetime.now().year,
        "library_entries": [dict(e, label=catalog.exam_label(e)) for e in library.list_entries()],
        "ai": ai_grader.ai_available(), **extra,
    }


@app.get("/", response_class=HTMLResponse)
def home(request: Request, error: str = ""):
    """Step 1 of the guided flow: upload an exam."""
    sess = session(request)
    exams = [dict(e, label=catalog.exam_label(e)) for e in library.list_entries()]
    exams.sort(key=lambda e: e["created"], reverse=True)
    return render(request, "home.html", _form_ctx(jobs=_visible_jobs(sess), exams=exams[:30],
                                                  error=error or None), sess)


@app.get("/advanced", response_class=HTMLResponse)
def index(request: Request, library_id: str = ""):
    """All options on one page: Excel rubrics, ready-made marking schemes, ZIPs."""
    sess = session(request)
    return render(request, "index.html", _form_ctx(jobs=_visible_jobs(sess), error=None,
                                                   selected_library=library_id), sess)


@app.get("/rubric-template.xlsx")
def rubric_template(request: Request):
    session(request)
    return Response(build_template(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote("سلم_التصحيح.xlsx")})


def _exam_meta(subject: str, subject_custom: str, units: str, questionnaire: str, year: str,
               season: str, language: str) -> dict:
    if subject and subject not in catalog.SUBJECT_KEYS:
        raise UploadError("موضوع غير معروف")
    if season and season not in catalog.SEASON_NAMES:
        raise UploadError("موعد غير معروف")
    year_n = None
    if year.strip():
        if not year.strip().isdigit() or not 1990 <= int(year) <= 2100:
            raise UploadError("السنة غير صالحة")
        year_n = int(year)
    return {
        "subject": subject or None,
        "subject_custom": subject_custom.strip()[:80] or None,
        "units": int(units) if units.isdigit() and int(units) in catalog.UNITS else None,
        "questionnaire": re.sub(r"[^\w\-/ ]", "", questionnaire.strip())[:30] or None,
        "year": year_n, "season": season or None,
        "language": language if language in ai_grader.FEEDBACK_LANGUAGES else "ar",
    }


@app.post("/grade")
async def grade(request: Request,
                csrf: str = Form(""),
                title: str = Form(""),
                subject: str = Form(""), subject_custom: str = Form(""), units: str = Form(""),
                questionnaire: str = Form(""), year: str = Form(""), season: str = Form(""),
                language: str = Form("ar"), structure: str = Form(""),
                library_id: str = Form(""), save_to_library: str = Form(""),
                exam: UploadFile | None = File(None),
                solution: UploadFile | None = File(None),
                rubric: UploadFile | None = File(None),
                students: list[UploadFile] = File(...)):
    sess = session(request)
    check_csrf(sess, csrf)

    def fail(msg: str):
        return render(request, "index.html", _form_ctx(jobs=_visible_jobs(sess), error=msg,
                                                       selected_library=library_id), sess, status_code=400)

    try:
        exam_f = await _read(exam)
        solution_f = await _read(solution)
        rubric_f = await _read(rubric)
        raw_students = [f for f in [await _read(u) for u in students] if f]
        submissions = group_submissions(collect_student_files(raw_students))
        meta = _exam_meta(subject, subject_custom, units, questionnaire, year, season, language)
    except UploadError as exc:
        return fail(str(exc))

    entry = None
    if library_id:
        try:
            entry = library.get_entry(library_id)
        except KeyError:
            return fail("الامتحان المختار غير موجود في المكتبة")
        # files uploaded now replace the library's; empty fields take the library's values
        exam_f = exam_f or library.load_file(library_id, "exam")
        solution_f = solution_f or library.load_file(library_id, "solution")
        rubric_f = rubric_f or library.load_file(library_id, "rubric")
        for k in ("subject", "subject_custom", "units", "questionnaire", "year", "season"):
            meta[k] = meta[k] or entry.get(k)
        structure = structure.strip() or entry.get("structure_text", "")

    if not rubric_f and not solution_f:
        return fail("يجب رفع سلم التصحيح أو الامتحان المحلول (أو اختيار امتحان من المكتبة)")
    if not submissions:
        return fail("لم يتم العثور على ملفات طلاب مدعومة (Excel، PDF، Word، صور، كود، أو ZIP يحتويها)")
    for f in (rubric_f, solution_f, exam_f):
        if f and extension(f[0]) not in SUPPORTED_EXTS:
            return fail(f"صيغة الملف {f[0]} غير مدعومة")
    try:
        sections = parse_structure(structure)
    except StructureError as exc:
        return fail(f"مبنى الامتحان: {exc}")

    structured: Rubric | None = None
    rubric_error = None
    if rubric_f and extension(rubric_f[0]) in EXCEL_EXTS:
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

    if save_to_library and not entry:
        files = {k: f for k, f in (("exam", exam_f), ("solution", solution_f), ("rubric", rubric_f)) if f}
        entry = library.create_entry({**meta, "title": title.strip() or None, "structure_text": structure.strip(),
                                      "created_by": sess.user["username"]}, files)

    label = catalog.exam_label(meta)
    context = ai_grader.exam_context(label=label, structure="\n".join(x.describe() for x in sections),
                                     language=meta["language"])
    job_id = storage.new_job_id()
    warnings = []
    if structured is None:
        warnings.append("التصحيح تم بالذكاء الاصطناعي حسب سلم تصحيح حر؛ يُنصح بمراجعة العلامات قبل اعتمادها.")
    elif not solution_f and any(i.expected is None for i in structured.items):
        warnings.append("لم يُرفع امتحان محلول، والبنود التي ليس لها «إجابة متوقعة» في السلم ستظهر للمراجعة.")
    job = {
        "id": job_id,
        "owner": sess.user["username"],
        "title": title.strip() or (entry or {}).get("title") or label or f"امتحان {datetime.now():%d/%m/%Y}",
        "created": datetime.now().isoformat(timespec="seconds"),
        "status": "running", "error": None, "progress": 0, "total": len(submissions),
        "mode": "rubric" if structured else "ai",
        "meta": meta, "label": label, "library_id": entry["id"] if entry else None,
        "structure": sections_to_dicts(sections), "structure_text": structure.strip(),
        "files": {"exam": exam_f[0] if exam_f else None,
                  "solution": solution_f[0] if solution_f else None,
                  "rubric": rubric_f[0] if rubric_f else None},
        "rubric": structured.to_dict() if structured else None,
        "warnings": warnings, "students": [],
    }
    storage.save_job(job)
    threading.Thread(target=run_job, daemon=True,
                     args=(job_id, submissions, structured, solution_f, exam_f, rubric_f, sections,
                           context)).start()
    return RedirectResponse(f"/jobs/{job_id}", status_code=303)


# ------------------------------------------------------- guided flow (exams)

def _can_edit(sess: Session, entry: dict) -> bool:
    return sess.is_admin or entry.get("created_by") == sess.user["username"]


def _generate_mahvan(entry_id: str) -> None:
    """Background: draft the marking scheme from the exam with Claude."""
    try:
        _draft_mahvan(entry_id)
    except KeyError:
        pass  # the exam was deleted while the draft was being written


def _draft_mahvan(entry_id: str) -> None:
    entry = library.get_entry(entry_id)
    exam = library.load_file(entry_id, "exam")
    solution = library.load_file(entry_id, "solution")
    context = ai_grader.exam_context(label=catalog.exam_label(entry))
    try:
        draft = mahvan.generate(exam, solution, context)
    except Exception as exc:
        def failed(e):
            e["mahvan_status"] = "failed"
            e["mahvan_error"] = f"تعذر إعداد سلم التصحيح آلياً: {exc}"
        library.update_entry(entry_id, failed)
        return
    structure = draft.get("structure", "").strip()
    try:
        parse_structure(structure)
    except StructureError:
        structure = ""  # the teacher fixes it on the edit page

    def done(e):
        e["mahvan"] = draft["questions"]
        e["structure_text"] = e.get("structure_text") or structure
        e["mahvan_notes"] = draft.get("notes", "")
        e["mahvan_status"] = "draft"
        e.pop("mahvan_error", None)
    library.update_entry(entry_id, done)


@app.post("/exams")
async def create_exam(request: Request, csrf: str = Form(""), title: str = Form(""),
                      subject: str = Form(""), subject_custom: str = Form(""), units: str = Form(""),
                      questionnaire: str = Form(""), year: str = Form(""), season: str = Form(""),
                      exam: UploadFile | None = File(None), solution: UploadFile | None = File(None)):
    """Step 1: the teacher uploads the exam; Claude drafts a marking scheme."""
    sess = session(request)
    check_csrf(sess, csrf)
    try:
        meta = _exam_meta(subject, subject_custom, units, questionnaire, year, season, "ar")
        meta.pop("language")
        exam_f = await _read(exam)
        solution_f = await _read(solution)
        if not exam_f:
            raise UploadError("ارفع ملف الامتحان (PDF، Word، صورة...)")
        for f in (exam_f, solution_f):
            if f and extension(f[0]) not in SUPPORTED_EXTS:
                raise UploadError(f"صيغة الملف {f[0]} غير مدعومة")
    except UploadError as exc:
        return RedirectResponse("/?error=" + quote(str(exc)), status_code=303)
    files = {"exam": exam_f}
    if solution_f:
        files["solution"] = solution_f
    ai = ai_grader.ai_available()
    entry = library.create_entry({
        **meta, "title": title.strip() or None, "structure_text": "", "created_by": sess.user["username"],
        "mahvan": [], "mahvan_status": "generating" if ai else "manual",
    }, files, require_key=False)
    if ai:
        threading.Thread(target=_generate_mahvan, args=(entry["id"],), daemon=True).start()
    return RedirectResponse(f"/exams/{entry['id']}", status_code=303)


@app.get("/exams/{entry_id}", response_class=HTMLResponse)
def exam_page(request: Request, entry_id: str, saved: int = 0, error: str = ""):
    """Step 2: review and edit the marking scheme (מחוון)."""
    sess = session(request)
    entry = _entry_or_404(entry_id)
    if entry.get("mahvan_status") == "generating":
        return render(request, "mahvan_wait.html", {"entry": entry, "label": catalog.exam_label(entry)}, sess)
    rows = entry.get("mahvan") or []
    return render(request, "mahvan.html", _form_ctx(
        entry=entry, label=catalog.exam_label(entry), rows=rows, total=mahvan.total(rows) if rows else 0,
        can_edit=_can_edit(sess, entry), saved=bool(saved), error=error or entry.get("mahvan_error"),
        kind_labels=library.KIND_LABELS), sess)


@app.post("/exams/{entry_id}/mahvan")
async def save_mahvan(request: Request, entry_id: str):
    sess = session(request)
    form = await request.form()
    check_csrf(sess, form.get("csrf"))
    entry = _entry_or_404(entry_id)
    if not _can_edit(sess, entry):
        raise HTTPException(403, "فقط من أضاف الامتحان أو المدير يستطيع تعديل سلم التصحيح")
    structure = str(form.get("structure", "")).strip()
    try:
        rows = mahvan.from_form(form)
        if not rows:
            raise mahvan.MahvanError("سلم التصحيح فارغ: أضف سؤالاً واحداً على الأقل")
        sections = parse_structure(structure)
        unknown = {q for sec in sections for q in sec.qids} - {r["qid"] for r in rows}
        if unknown:
            raise StructureError(f"مبنى الامتحان يذكر أسئلة غير موجودة في السلم: {', '.join(sorted(unknown))}")
    except (mahvan.MahvanError, StructureError) as exc:
        return RedirectResponse(f"/exams/{entry_id}?error=" + quote(str(exc)), status_code=303)

    def apply(e):
        e["mahvan"] = rows
        e["structure_text"] = structure
        e["mahvan_status"] = "approved"
        e.pop("mahvan_error", None)
    library.update_entry(entry_id, apply)
    if form.get("next") == "students":
        return RedirectResponse(f"/exams/{entry_id}/students", status_code=303)
    return RedirectResponse(f"/exams/{entry_id}?saved=1", status_code=303)


@app.post("/exams/{entry_id}/regenerate")
def regenerate_mahvan(request: Request, entry_id: str, csrf: str = Form("")):
    sess = session(request)
    check_csrf(sess, csrf)
    entry = _entry_or_404(entry_id)
    if not _can_edit(sess, entry):
        raise HTTPException(403)
    if not ai_grader.ai_available() or not entry["files"].get("exam"):
        return RedirectResponse(f"/exams/{entry_id}?error=" + quote("الإعداد الآلي يحتاج ملف امتحان ومفتاح API"),
                                status_code=303)
    library.update_entry(entry_id, lambda e: e.update(mahvan_status="generating"))
    threading.Thread(target=_generate_mahvan, args=(entry_id,), daemon=True).start()
    return RedirectResponse(f"/exams/{entry_id}", status_code=303)


@app.get("/exams/{entry_id}/students", response_class=HTMLResponse)
def students_page(request: Request, entry_id: str, error: str = ""):
    """Step 3: attach each student's solution."""
    sess = session(request)
    entry = _entry_or_404(entry_id)
    return render(request, "students_upload.html", _form_ctx(
        entry=entry, label=catalog.exam_label(entry), error=error or None,
        rows=entry.get("mahvan") or []), sess)


@app.post("/exams/{entry_id}/students")
async def grade_students(request: Request, entry_id: str):
    sess = session(request)
    form = await request.form()
    check_csrf(sess, form.get("csrf"))
    entry = _entry_or_404(entry_id)

    def fail(msg):
        return RedirectResponse(f"/exams/{entry_id}/students?error=" + quote(msg), status_code=303)

    scheme = entry.get("mahvan") or []
    rubric_f = library.load_file(entry_id, "rubric")
    if not scheme and not rubric_f:
        return RedirectResponse(f"/exams/{entry_id}?error=" + quote("اعتمد سلم التصحيح أولاً"), status_code=303)

    # one row per student (name + files), plus an optional bulk upload grouped automatically
    submissions: list[tuple[str, list[tuple[str, bytes]]]] = []
    try:
        rows = sorted({int(k.split("_", 1)[1]) for k in form.keys()
                       if k.startswith("files_") and k.split("_", 1)[1].isdigit()})
        for i in rows:
            files = [f for f in [await _read(u) for u in form.getlist(f"files_{i}")
                                 if isinstance(u, StarletteUpload)] if f]
            files = [f for f in files if extension(f[0]) in SUPPORTED_EXTS]
            if not files:
                continue
            name = str(form.get(f"name_{i}", "")).strip()[:120] or _student_name(files[0][0])
            submissions.append((name, files))
        bulk = [f for f in [await _read(u) for u in form.getlist("bulk") if isinstance(u, StarletteUpload)] if f]
        if bulk:
            submissions += group_submissions(collect_student_files(bulk))
    except UploadError as exc:
        return fail(str(exc))
    if not submissions:
        return fail("لم تُرفق ملفات حلول لأي طالب")
    if len(submissions) > MAX_STUDENTS:
        return fail(f"عدد الطلاب أكبر من {MAX_STUDENTS}")
    seen: dict[str, int] = {}
    unique = []
    for name, files in submissions:
        seen[name] = seen.get(name, 0) + 1
        unique.append((name if seen[name] == 1 else f"{name} ({seen[name]})", files))

    structured = None
    if not scheme and rubric_f and extension(rubric_f[0]) in EXCEL_EXTS:
        try:
            structured = parse_rubric(rubric_f[1])
        except RubricError:
            structured = None
    if structured is None and not ai_grader.ai_available():
        return fail("تصحيح هذه الحلول يحتاج الذكاء الاصطناعي، لكن مفتاح ANTHROPIC_API_KEY غير مُعدّ")

    language = str(form.get("language", "ar"))
    language = language if language in ai_grader.FEEDBACK_LANGUAGES else "ar"
    sections = parse_structure(entry.get("structure_text", ""))
    label = catalog.exam_label(entry)
    context = ai_grader.exam_context(label=label, structure="\n".join(x.describe() for x in sections),
                                     language=language)
    title = str(form.get("title", "")).strip() or entry.get("title") or label or "امتحان"
    exam_f = library.load_file(entry_id, "exam")
    solution_f = library.load_file(entry_id, "solution")
    job_id = storage.new_job_id()
    job = {
        "id": job_id, "owner": sess.user["username"], "title": title,
        "created": datetime.now().isoformat(timespec="seconds"),
        "status": "running", "error": None, "progress": 0, "total": len(unique),
        "mode": "rubric" if structured else "ai",
        "meta": {k: entry.get(k) for k in ("subject", "subject_custom", "units", "questionnaire", "year", "season")}
        | {"language": language},
        "label": label, "library_id": entry_id,
        "structure": sections_to_dicts(sections), "structure_text": entry.get("structure_text", ""),
        "files": {"exam": exam_f[0] if exam_f else None, "solution": solution_f[0] if solution_f else None,
                  "rubric": "מחוון" if scheme else (rubric_f[0] if rubric_f else None)},
        "rubric": structured.to_dict() if structured else None,
        "warnings": [] if structured else
        ["التصحيح تم بالذكاء الاصطناعي حسب سلم التصحيح؛ راجع العلامات قبل إرسالها للطلاب."],
        "students": [],
    }
    storage.save_job(job)
    threading.Thread(target=run_job, daemon=True, kwargs=dict(
        job_id=job_id, students=unique, rubric=structured, solution=solution_f, exam=exam_f,
        rubric_file=rubric_f, sections=sections, context=context, scheme=scheme or None,
        scan=form.get("scan", "1") == "1")).start()
    return RedirectResponse(f"/jobs/{job_id}", status_code=303)


# ------------------------------------------------------------------- library

@app.get("/library", response_class=HTMLResponse)
def library_page(request: Request, subject: str = "", msg: str = ""):
    sess = session(request)
    entries = [dict(e, label=catalog.exam_label(e),
                    structure_lines=[x.describe() for x in parse_structure(e.get("structure_text", ""))])
               for e in library.list_entries(subject or None)]
    return render(request, "library.html", _form_ctx(entries=entries, subject_filter=subject, msg=msg,
                                                     error=None, kind_labels=library.KIND_LABELS), sess)


@app.post("/library")
async def library_add(request: Request, csrf: str = Form(""), title: str = Form(""),
                      subject: str = Form(""), subject_custom: str = Form(""), units: str = Form(""),
                      questionnaire: str = Form(""), year: str = Form(""), season: str = Form(""),
                      structure: str = Form(""),
                      exam: UploadFile | None = File(None), solution: UploadFile | None = File(None),
                      rubric: UploadFile | None = File(None)):
    sess = session(request)
    check_csrf(sess, csrf)
    try:
        meta = _exam_meta(subject, subject_custom, units, questionnaire, year, season, "ar")
        if not meta["subject"]:
            raise UploadError("اختر الموضوع")
        parse_structure(structure)
        files = {k: f for k, f in (("exam", await _read(exam)), ("solution", await _read(solution)),
                                   ("rubric", await _read(rubric))) if f}
        for f in files.values():
            if extension(f[0]) not in SUPPORTED_EXTS:
                raise UploadError(f"صيغة الملف {f[0]} غير مدعومة")
        if "rubric" in files and extension(files["rubric"][0]) in EXCEL_EXTS:
            try:
                parse_rubric(files["rubric"][1])
            except RubricError:
                pass  # a free-form rubric in Excel is fine too
        meta.pop("language")
        library.create_entry({**meta, "title": title.strip() or None, "structure_text": structure.strip(),
                              "created_by": sess.user["username"]}, files)
    except (UploadError, StructureError, ValueError) as exc:
        entries = [dict(e, label=catalog.exam_label(e), structure_lines=[]) for e in library.list_entries()]
        return render(request, "library.html", _form_ctx(entries=entries, subject_filter="", msg="",
                                                         error=str(exc), kind_labels=library.KIND_LABELS),
                      sess, status_code=400)
    return RedirectResponse("/library?msg=" + quote("تمت إضافة الامتحان إلى المكتبة"), status_code=303)


def _entry_or_404(entry_id: str) -> dict:
    try:
        return library.get_entry(entry_id)
    except KeyError:
        raise HTTPException(404, "الامتحان غير موجود في المكتبة")


@app.get("/library/{entry_id}/{kind}")
def library_file(request: Request, entry_id: str, kind: str):
    session(request)
    _entry_or_404(entry_id)
    if kind not in library.KINDS:
        raise HTTPException(404)
    f = library.load_file(entry_id, kind)
    if not f:
        raise HTTPException(404, "الملف غير موجود")
    return Response(f[1], media_type="application/octet-stream",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(f[0])})


@app.post("/library/{entry_id}/delete")
def library_delete(request: Request, entry_id: str, csrf: str = Form("")):
    sess = session(request)
    check_csrf(sess, csrf)
    entry = _entry_or_404(entry_id)
    if not sess.is_admin and entry.get("created_by") != sess.user["username"]:
        raise HTTPException(403, "فقط من أضاف الامتحان أو المدير يستطيع حذفه")
    library.delete_entry(entry_id)
    return RedirectResponse("/library?msg=" + quote("تم حذف الامتحان من المكتبة"), status_code=303)


def _job_or_404(job_id: str, sess: Session) -> dict:
    """Teachers only see their own exams; the admin sees all of them."""
    try:
        job = storage.load_job(job_id)
    except KeyError:
        raise HTTPException(404, "التصحيح غير موجود")
    if not sess.is_admin and job.get("owner") != sess.user["username"]:
        raise HTTPException(404, "التصحيح غير موجود")
    return job


def _student_or_404(job: dict, idx: int) -> dict:
    if not 0 <= idx < len(job["students"]):
        raise HTTPException(404, "الطالب غير موجود")
    return job["students"][idx]


@app.get("/jobs/{job_id}", response_class=HTMLResponse)
def job_page(request: Request, job_id: str):
    sess = session(request)
    job = _job_or_404(job_id, sess)
    if job["status"] == "running":
        return render(request, "progress.html", {"job": job}, sess)
    qids = reports.question_order(job["students"])
    return render(request, "job.html", {
        "job": job, "qids": qids,
        "scores": [reports.question_scores(s) for s in job["students"]],
        "stats": reports.class_stats(job["students"]),
        "similar": reports.similarity_flags(job["students"]),
    }, sess)


@app.get("/jobs/{job_id}/students/{idx}", response_class=HTMLResponse)
def student_page(request: Request, job_id: str, idx: int, saved: int = 0):
    sess = session(request)
    job = _job_or_404(job_id, sess)
    return render(request, "student.html", {
        "job": job, "s": _student_or_404(job, idx), "idx": idx,
        "standalone": False, "saved": bool(saved),
    }, sess)


@app.post("/jobs/{job_id}/students/{idx}")
async def save_student(request: Request, job_id: str, idx: int):
    sess = session(request)
    form = await request.form()
    check_csrf(sess, form.get("csrf"))
    _job_or_404(job_id, sess)

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
        grader.summarize(s, sections_from_dicts(job.get("structure")))
    storage.update_job(job_id, apply)
    return RedirectResponse(f"/jobs/{job_id}/students/{idx}?saved=1", status_code=303)


@app.get("/jobs/{job_id}/export.xlsx")
def export(request: Request, job_id: str):
    job = _job_or_404(job_id, session(request))
    data = reports.export_grades_xlsx(job)
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename*=UTF-8''" + quote(f"علامات - {job['title']}.xlsx")})


@app.get("/jobs/{job_id}/reports.zip")
def reports_zip(request: Request, job_id: str):
    job = _job_or_404(job_id, session(request))
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


def _student_pdf(job: dict, idx: int) -> bytes:
    s = _student_or_404(job, idx)
    files = storage.load_student_files(job["id"], s["file_key"]) if s.get("file_key") else []
    return pdf_report.build_student_pdf(job, s, files)


def _pdf_name(s: dict, job: dict) -> str:
    return re.sub(r'[\\/:*?"<>|]', "_", f"{s['name']} - {job['title']}") + ".pdf"


@app.get("/jobs/{job_id}/students/{idx}/report.pdf")
def student_pdf(request: Request, job_id: str, idx: int):
    """The grading report followed by the student's scanned solution."""
    job = _job_or_404(job_id, session(request))
    data = _student_pdf(job, idx)
    return Response(data, media_type="application/pdf", headers={
        "Content-Disposition": "inline; filename*=UTF-8''" + quote(_pdf_name(job["students"][idx], job))})


@app.get("/jobs/{job_id}/reports-pdf.zip")
def all_pdfs(request: Request, job_id: str):
    job = _job_or_404(job_id, session(request))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        used = set()
        for idx, s in enumerate(job["students"]):
            name = _pdf_name(s, job)
            if name in used:
                name = f"{idx + 1} - {name}"
            used.add(name)
            zf.writestr(name, _student_pdf(job, idx))
    return Response(buf.getvalue(), media_type="application/zip", headers={
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(f"تقارير PDF - {job['title']}.zip")})


@app.post("/jobs/{job_id}/delete")
def delete(request: Request, job_id: str, csrf: str = Form("")):
    sess = session(request)
    check_csrf(sess, csrf)
    _job_or_404(job_id, sess)
    storage.delete_job(job_id)
    return RedirectResponse("/", status_code=303)
