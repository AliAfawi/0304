// ---------- salary guide (crowd-sourced, no names) and the monthly digest ----------
// Salaries: each member keeps at most one entry per field (doc id `${field}__${uid}`), shown only as ranges and counts.
const SAL_BANDS = ["أقل من 6,000", "6,000–8,000", "8,000–10,000", "10,000–13,000", "13,000–16,000", "16,000–20,000", "أكثر من 20,000"];
const SAL_YEARS = ["سنة أولى", "1–3 سنين", "3–6 سنين", "أكثر من 6"];
let salRows = [];
registerView("salaries", "career", "دليل الرواتب", () => {
  const form = h("form", { class: "card form" },
    h("label", { class: "field" }, h("span", { text: "المجال أو المهنة" }), h("input", { type: "text", id: "sal-field", required: true, maxlength: 50, list: "sal-fields", placeholder: "مثال: تمريض" })),
    h("label", { class: "field" }, h("span", { text: "الراتب الشهري الإجمالي (₪)" }), h("select", { id: "sal-band" }, SAL_BANDS.map((b) => opt(b)))),
    h("label", { class: "field" }, h("span", { text: "سنين الخبرة" }), h("select", { id: "sal-years" }, SAL_YEARS.map((y) => opt(y)))),
    h("label", { class: "field" }, h("span", { text: "المنطقة" }), h("select", { id: "sal-region" }, REGIONS.filter((r) => r !== "عن بُعد").map((r) => opt(r)))),
    h("label", { class: "check full" }, h("input", { type: "checkbox", id: "sal-full", checked: true }), "وظيفة كاملة"),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "أضف راتبي بدون اسم" }),
      h("span", { class: "muted small", text: "اسمك ما بيظهر. بنعرض المجال إذا في 3 مشاركات أو أكثر." })));
  form.append(h("datalist", { id: "sal-fields" }, [...new Set(INST.flatMap((i) => Object.values(i.majors).flat()))].slice(0, 300).map((m) => opt(m))));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite()) return;
    const field = $("#sal-field").value.trim(); if (!field) return;
    const ok = await setDoc("salaries", norm(field).replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60) + "__" + S.uid, {
      uid: S.uid, field, band: $("#sal-band").value, years: $("#sal-years").value, region: $("#sal-region").value, full: $("#sal-full").checked, createdAt: Date.now() });
    if (ok) { form.reset(); toast("انضاف. شكرًا إنك ساعدت الطلاب يعرفوا"); }
  });
  const v = h("div", { class: "view" },
    head("المسار المهني", "دليل الرواتب", "رواتب حقيقية بيشاركها خريجونا بدون أسماء، عشان الطلاب يعرفوا شو بيستنّاهم بكل مجال. الأرقام نطاقات تقريبية مش وعد."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ شارك راتبك" }), form),
    h("label", { class: "field", style: "max-width:420px" }, h("span", { text: "ابحث عن مجال" }), h("input", { type: "search", id: "sal-q", oninput: drawSalaries })),
    h("div", { class: "stack", id: "sal-list" }));
  onLeave(subscribe("salaries", { limit: 1000 }, (rows) => { salRows = rows.filter((r) => !isMod("hidden", "salaries:" + r.id)); drawSalaries(); }));
  return v;
}, { order: 75 });
function drawSalaries() {
  const el = $("#sal-list"); if (!el) return;
  const q = $("#sal-q")?.value.trim() || "";
  const groups = {};
  salRows.forEach((r) => { const k = norm(r.field); (groups[k] ||= { name: r.field, rows: [] }).rows.push(r); });
  const list = Object.values(groups).filter((g) => matches(g.name, q)).sort((a, b) => b.rows.length - a.rows.length);
  const shown = list.filter((g) => g.rows.length >= 3);
  const waiting = list.filter((g) => g.rows.length < 3);
  if (!list.length) { el.replaceChildren(empty("لسا ما في رواتب", "إذا بتشتغل، شارك راتبك بدون اسم وساعد الطلاب.")); return; }
  el.replaceChildren(
    ...shown.map((g) => {
      const counts = SAL_BANDS.map((b) => g.rows.filter((r) => r.band === b).length);
      const max = Math.max(...counts);
      return h("article", { class: "card stack" },
        h("div", { class: "spread" }, h("h3", { text: g.name }), h("span", { class: "pill grey", text: `${g.rows.length} مشاركة` })),
        h("div", { class: "stack", style: "gap:6px" }, SAL_BANDS.map((b, i) => counts[i] ? h("div", { class: "sal-row" },
          h("span", { class: "small num", text: b }), h("div", { class: "bar" }, h("i", { style: `width:${(counts[i] / max) * 100}%` })), h("span", { class: "small num muted", text: String(counts[i]) })) : null)),
        h("p", { class: "muted small", text: "كل الأرقام بالشيكل، إجمالي بالشهر." }));
    }),
    waiting.length ? h("p", { class: "muted small", text: `${waiting.length} مجالات لسا فيها أقل من 3 مشاركات، فما بنعرضها حفاظًا على الخصوصية.` }) : null);
}
registerSearch("دليل الرواتب", (q) => matches("رواتب راتب دليل الرواتب", q) ? [{ title: "دليل الرواتب", sub: "المسار المهني", go: "salaries" }] : []);

// Monthly digest: what happened this month, ready to paste into a WhatsApp group.
registerView("digest", "home", "ملخّص الشهر", () => {
  const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
  const t0 = since.getTime();
  const fresh = (rows) => rows.filter((r) => (r.createdAt || 0) >= t0);
  const posts = fresh(S.posts), mats = fresh(S.materials), tut = fresh(S.tutors);
  const newAlumni = Object.values(S.alumni).filter((a) => (a.createdAt || 0) >= t0);
  const month = since.toLocaleDateString("ar-EG-u-nu-latn", { month: "long", year: "numeric" });
  const lines = [
    `بوابة الخريجين – ملخّص ${month}`,
    `• ${newAlumni.length} خريج/ة جديد انضموا للدليل`,
    `• ${mats.length} مادة وامتحان جديد بالمكتبة`,
    `• ${tut.length} عرض درس أو طلب مساعدة`,
    `• ${posts.length} نقاش جديد بالمجتمع`,
    ...mats.slice(0, 5).map((m) => `   – ${m.subject}: ${m.title}`),
    "ادخلوا وشاركوا.",
  ];
  const text = lines.join("\n");
  const pre = h("pre", { class: "plain dg-pre", "data-i18n-skip": "", text });
  return h("div", { class: "view" },
    head("ملخّص الشهر", `شو صار بالمنصة بـ ${month}`, "ملخّص جاهز تنسخه وتبعته لمجموعة الفوج بالواتساب."),
    h("div", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { text: newAlumni.length }), h("span", { text: "خريج جديد" })),
      h("div", { class: "stat" }, h("b", { text: mats.length }), h("span", { text: "مادة جديدة" })),
      h("div", { class: "stat" }, h("b", { text: posts.length }), h("span", { text: "نقاش جديد" }))),
    pre,
    h("div", { class: "row" },
      h("button", { class: "btn blue", type: "button", onclick: () => {
        navigator.clipboard?.writeText(text).then(() => toast("انسخ"), () => { selectText(pre); toast("حدّد النص وانسخه"); });
      }, text: "انسخ الملخّص" }),
      CAP.downloads ? h("button", { class: "btn ghost", type: "button", onclick: () => saveFile("ملخص-الشهر.txt", text), text: "نزّله كملف" }) : null));
}, { order: 90 });
function selectText(el) { try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch {} }
registerHome(() => h("button", { class: "tool-card", type: "button", "data-go": "digest" }, h("b", { text: "ملخّص الشهر" }), h("span", { text: "شو صار بالمنصة هالشهر، جاهز للواتساب" })), 95);
