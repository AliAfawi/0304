"""Exam structure: "answer N of these questions" rules (בחירת שאלות).

Bagrut exams usually say e.g. "Chapter 1: answer 2 of questions 1-3".
The teacher writes one line per chapter:

    1,2,3 = 2              from questions 1, 2, 3 count two
    فصل ب: 4-7 = 3 الأفضل   from questions 4..7 count the three best

By default the first answered questions count, as most Bagrut papers state
("ייבדקו רק התשובות הראשונות"). "First" follows question numbers, since the
order in the student's notebook is not known. Add «الأفضل» / «best» /
«הטובות» to count the best answers instead. Questions that are not in any
line always count.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass

RULE_BEST = "best"
RULE_FIRST = "first"
_FIRST_WORDS = {"الأولى", "الاولى", "أولى", "first", "ראשונות", "הראשונות"}
_BEST_WORDS = {"الأفضل", "الافضل", "best", "הטובות"}


class StructureError(ValueError):
    pass


@dataclass
class Section:
    qids: list[str]
    required: int
    rule: str = RULE_FIRST
    title: str = ""

    def describe(self) -> str:
        how = "الأولى المُجاب عنها" if self.rule == RULE_FIRST else "الأفضل"
        head = f"{self.title}: " if self.title else ""
        return f"{head}من الأسئلة {', '.join(self.qids)} تُحسب {self.required} ({how})"


def _expand(token: str) -> list[str]:
    token = token.strip()
    m = re.fullmatch(r"(\d+)\s*[-–]\s*(\d+)", token)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if a > b or b - a > 100:
            raise StructureError(f"مدى غير صالح: {token}")
        return [str(i) for i in range(a, b + 1)]
    return [token] if token else []


def parse_structure(text: str | None) -> list[Section]:
    sections: list[Section] = []
    seen: set[str] = set()
    for n, raw in enumerate((text or "").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        title = ""
        if ":" in line.split("=")[0]:
            title, line = (s.strip() for s in line.split(":", 1))
        if "=" not in line:
            raise StructureError(f"السطر {n}: الصيغة «الأسئلة = العدد»، مثلاً: 1,2,3 = 2")
        left, right = line.split("=", 1)
        qids = [q for tok in re.split(r"[,،\s]+", left) for q in _expand(tok)]
        words = right.split()
        if not words or not words[0].isdigit():
            raise StructureError(f"السطر {n}: بعد = يجب كتابة عدد الأسئلة المطلوبة")
        required = int(words[0])
        rest = {w.strip() for w in words[1:]}
        if rest - _FIRST_WORDS - _BEST_WORDS:
            raise StructureError(f"السطر {n}: كلمة غير مفهومة «{' '.join(rest)}» (المسموح: الأولى / الأفضل)")
        rule = RULE_BEST if rest & _BEST_WORDS else RULE_FIRST
        if not qids:
            raise StructureError(f"السطر {n}: لم تُكتب أرقام أسئلة")
        if not 1 <= required <= len(qids):
            raise StructureError(f"السطر {n}: العدد المطلوب يجب أن يكون بين 1 و {len(qids)}")
        dup = seen & set(qids)
        if dup:
            raise StructureError(f"السطر {n}: السؤال {', '.join(sorted(dup))} مذكور في أكثر من سطر")
        seen |= set(qids)
        sections.append(Section(qids, required, rule, title))
    return sections


def sections_to_dicts(sections: list[Section]) -> list[dict]:
    return [asdict(s) for s in sections]


def sections_from_dicts(data: list[dict] | None) -> list[Section]:
    return [Section(**d) for d in data or []]


def _qkey(qid: str):
    """Natural order: 2 < 10, "3a" after "3"."""
    m = re.match(r"(\d+)(.*)", qid)
    return (int(m.group(1)), m.group(2)) if m else (10 ** 6, qid)


def apply_structure(student: dict, sections: list[Section]) -> None:
    """Marks items of questions that don't count with item["counted"] = False
    and stores the reachable maximum in student["section_max"]."""
    items = student["items"]
    for it in items:
        it["counted"] = True
    student["section_max"] = None
    if not sections:
        return

    per_q: dict[str, dict] = {}
    for it in items:
        q = per_q.setdefault(it["qid"], {"score": 0.0, "points": 0.0, "answered": False})
        q["score"] += it["score"]
        q["points"] += it["points"]
        ans = (it.get("student_answer") or "").strip()
        if it["score"] > 0 or (ans and not ans.startswith("(")):  # "(فارغ)" = empty
            q["answered"] = True

    in_sections = set()
    section_max = 0.0
    not_counted: set[str] = set()
    for sec in sections:
        present = [q for q in sec.qids if q in per_q]
        in_sections |= set(present)
        if sec.rule == RULE_FIRST:
            answered = [q for q in sorted(present, key=_qkey) if per_q[q]["answered"]]
            rest = [q for q in sorted(present, key=_qkey) if not per_q[q]["answered"]]
            chosen = (answered + rest)[:sec.required]
        else:
            # best score; on a tie prefer the earlier question
            chosen = sorted(present, key=lambda q: (-per_q[q]["score"], _qkey(q)))[:sec.required]
        not_counted |= set(present) - set(chosen)
        section_max += sum(sorted((per_q[q]["points"] for q in present), reverse=True)[:sec.required])

    for it in items:
        if it["qid"] in not_counted:
            it["counted"] = False
    outside = sum(it["points"] for it in items if it["qid"] not in in_sections)
    student["section_max"] = round(outside + section_max, 2)
