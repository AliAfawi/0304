// ---------- shared helpers for the career (32), events (33) and mentoring (34) modules ----------
// Fields offered in selects; the "أخرى" entry lets people type their own.
const CR_FIELDS = ["هندسة", "حاسوب وهايتك", "طب ومهن طبية", "تمريض", "تعليم", "قانون", "محاسبة واقتصاد", "إدارة أعمال", "علوم", "علوم اجتماعية", "علم نفس", "عمل اجتماعي", "فنون وتصميم", "إعلام", "تجارة ومبيعات", "مطاعم وضيافة", "بناء وصيانة", "زراعة", "أخرى"];
const CR_REPORT_REASONS = ["معلومة غلط أو مضلّلة", "محتوى مسيء", "احتيال أو سبام", "معلومات شخصية لحدا ثاني", "غير ذلك"];

const crHidden = (col, id) => isMod("hidden", col + ":" + id);
const crVisible = (col, rows) => rows.filter((r) => !crHidden(col, r.id));
function crVer(uid) { return isMod("verified", uid) ? h("span", { class: "pill good", text: "موثّق" }) : null; }
// Avatar + name + «موثّق» + cohort, the way every card in these modules shows a person.
function crWho(uid, extra) {
  const a = S.alumni[uid];
  return h("div", { class: "row cr-who" }, avatar(nameOf(uid), uid),
    h("div", { class: "cr-who-t" },
      h("div", { class: "row cr-name" }, h("span", { class: "who", text: nameOf(uid) }), crVer(uid)),
      h("div", { class: "meta" }, a ? h("span", { text: "فوج " + a.year }) : null, extra ? h("span", { text: extra }) : null)));
}
// In-app notification for someone else (platform team shows them in «مساحتي»).
function crNote(to, kind, text, goView) {
  if (!to || to === S.uid || !S.uid) return;
  addDoc("notes", { uid: S.uid, from: S.uid, to, kind, text: String(text).slice(0, 300), go: goView, createdAt: Date.now() });
}
// «إبلاغ» on content written by others.
function crReport(col, row) {
  if (!row || row.uid === S.uid || !S.uid) return null;
  const target = col + ":" + row.id;
  const sent = (lsGet("cr-reported", []) || []).includes(target);
  return h("button", { class: "link small cr-report", type: "button", disabled: sent ? true : null, text: sent ? "انبعث البلاغ" : "إبلاغ", onclick: () => {
    let reason = CR_REPORT_REASONS[0];
    const chips = h("div", { class: "chips", role: "group", "aria-label": "سبب البلاغ" }, CR_REPORT_REASONS.map((r, i) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(i === 0), text: r, onclick: (e) => { reason = r; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); } })));
    const more = h("textarea", { id: "cr-report-more", maxlength: 300, placeholder: "تفاصيل إضافية (اختياري)" });
    const close = modal("إبلاغ عن محتوى", h("div", { class: "stack" },
      h("p", { class: "muted", text: "البلاغ بيوصل للإدارة بس، وصاحب المنشور ما بيعرف مين بلّغ." }), chips,
      h("label", { class: "field" }, h("span", { text: "شو المشكلة بالضبط؟" }), more),
      h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", text: "أرسل البلاغ", onclick: async () => {
        const text = more.value.trim();
        if (await addDoc("reports", { uid: S.uid, target, reason: reason + (text ? " – " + text : ""), createdAt: Date.now() })) {
          lsSet("cr-reported", [...(lsGet("cr-reported", []) || []), target].slice(-300)); close(); toast("وصل البلاغ للإدارة، شكرًا"); renderLists();
        }
      } }))));
  } });
}
const crCanManage = (row) => row && (row.uid === S.uid || S.isAdmin);
// Dates
const CR_LOC = "ar-EG-u-nu-latn";
function crDate(ts, time = true) {
  if (!ts) return "";
  const o = { weekday: "long", day: "numeric", month: "long" };
  if (new Date(ts).getFullYear() !== new Date().getFullYear()) o.year = "numeric";
  if (time) { o.hour = "2-digit"; o.minute = "2-digit"; }
  return new Date(ts).toLocaleString(CR_LOC, o);
}
function crTime(ts) { return new Date(ts).toLocaleTimeString(CR_LOC, { hour: "2-digit", minute: "2-digit" }); }
function crUntil(ts) {
  const d = ts - Date.now(); if (d <= 0) return "";
  const m = Math.round(d / 60000);
  if (m < 60) return "بعد " + m + " دقيقة";
  if (m < 60 * 24) return "بعد " + Math.round(m / 60) + " ساعة";
  const days = Math.round(m / 1440);
  return days === 1 ? "بكرا" : days === 2 ? "بعد بكرا" : "بعد " + days + " يوم";
}
function crDTValue(ts) { if (!ts) return ""; const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); }
function crParseDT(v) { const t = new Date(v).getTime(); return isNaN(t) ? null : t; }
// Form pieces
function crField(label, control, cls) { return h("label", { class: "field" + (cls ? " " + cls : "") }, h("span", { text: label }), control); }
function crSelect(id, list, value, first) {
  return h("select", { id }, first ? opt(first[0], first[1], value === first[0]) : null, list.map((x) => Array.isArray(x) ? opt(x[0], x[1], String(value) === String(x[0])) : opt(x, x, value === x)));
}
function crLink(url, label, cls) { const u = safeUrl(url); return u ? h("a", { class: cls || "btn sm ghost", href: u, target: "_blank", rel: "noopener", text: label }) : null; }
function crCount(rows, key) { const m = new Map(); rows.forEach((r) => { const k = (typeof key === "function" ? key(r) : r[key]) || ""; if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); }
// Fills a container only when it is on screen (lists refresh on every data change).
function crFill(id, nodes) { const el = document.getElementById(id); if (el) el.replaceChildren(...nodes.filter(Boolean)); return el; }
