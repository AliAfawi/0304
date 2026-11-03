"""Bagrut subjects, unit levels and exam sessions shown in the forms.

Only the subject names are listed here. Questionnaire numbers (מספר שאלון)
change between years and tracks, so the teacher types them in.
"""
from __future__ import annotations

# (key, Arabic name, Hebrew name)
SUBJECTS: list[tuple[str, str, str]] = [
    ("math", "رياضيات", "מתמטיקה"),
    ("english", "لغة إنجليزية", "אנגלית"),
    ("arabic", "لغة عربية", "ערבית"),
    ("arabic_lit", "أدب عربي", "ספרות ערבית"),
    ("hebrew", "لغة عبرية", "עברית"),
    ("hebrew_lang", "لغة (לשון)", "לשון והבעה"),
    ("hebrew_lit", "أدب عبري", "ספרות"),
    ("history", "تاريخ", "היסטוריה"),
    ("civics", "مدنيات", "אזרחות"),
    ("islam", "دين إسلامي", "דת האסלאם"),
    ("christianity", "دين مسيحي", "דת נוצרית"),
    ("druze", "تراث درزي", "מורשת דרוזית"),
    ("tanakh", "تناخ", "תנ\"ך"),
    ("jewish_thought", "فكر يهودي", "מחשבת ישראל"),
    ("physics", "فيزياء", "פיזיקה"),
    ("chemistry", "كيمياء", "כימיה"),
    ("biology", "بيولوجيا", "ביולוגיה"),
    ("cs", "علم الحاسوب", "מדעי המחשב"),
    ("data", "تحليل البيانات", "ניתוח נתונים"),
    ("environment", "علوم البيئة", "מדעי הסביבה"),
    ("geography", "جغرافيا", "גיאוגרפיה"),
    ("sociology", "علم الاجتماع", "סוציולוגיה"),
    ("psychology", "علم النفس", "פסיכולוגיה"),
    ("economics", "اقتصاد", "כלכלה"),
    ("accounting", "محاسبة", "חשבונאות"),
    ("management", "إدارة أعمال", "מנהל עסקים"),
    ("communication", "اتصال وإعلام", "תקשורת"),
    ("electronics", "إلكترونيكا", "אלקטרוניקה"),
    ("other", "موضوع آخر", "אחר"),
]
SUBJECT_KEYS = {k for k, _, _ in SUBJECTS}
SUBJECT_NAMES = {k: f"{ar} ({he})" if k != "other" else ar for k, ar, he in SUBJECTS}

UNITS = [1, 2, 3, 4, 5]  # יחידות לימוד

SEASONS = [
    ("winter", "شتاء (חורף)"),
    ("summer", "صيف (קיץ)"),
    ("summer_b", "صيف – موعد ثانٍ (קיץ מועד ב)"),
    ("special", "موعد خاص (מועד מיוחד)"),
    ("school", "امتحان مدرسي / تجريبي (מתכונת)"),
]
SEASON_NAMES = dict(SEASONS)


def subject_label(key: str | None, custom: str | None = None) -> str:
    if key == "other" and custom:
        return custom
    return SUBJECT_NAMES.get(key or "", custom or "")


def exam_label(meta: dict) -> str:
    """"رياضيات (מתמטיקה) · 5 وحدات · שאלון 035581 · صيف 2025"."""
    parts = [subject_label(meta.get("subject"), meta.get("subject_custom"))]
    if meta.get("units"):
        parts.append(f"{meta['units']} وحدات")
    if meta.get("questionnaire"):
        parts.append(f"שאלון {meta['questionnaire']}")
    when = " ".join(x for x in (SEASON_NAMES.get(meta.get("season") or "", ""), str(meta.get("year") or "")) if x)
    if when:
        parts.append(when)
    return " · ".join(p for p in parts if p)
