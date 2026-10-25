// ===== learning team: shared helpers, constants and global data (used by 23-learn.js and 31-*.js) =====
const LN = { mine: [], decks: [], approved: {}, draw: null };
const LN_KINDS = ["ملخص", "امتحان بجروت", "امتحان سابق", "حلول", "فيديو", "ملخص مساق جامعي", "ملخص مكيناه", "مشروع تخرج", "أسئلة تدريب", "أخرى"];
const LN_SUBJECTS = [...SUBJECTS.filter((s) => s !== "أخرى"), "SAT / TOEFL", "مساعدة تقنية", "ترجمة وثائق", "أخرى"];
const LN_TAGS = { "إنجليزي": ["Unseen", "Writing", "Oral"], "عبري": ["הבנת הנקרא", "כתיבה"], "SAT / TOEFL": ["SAT", "TOEFL"] };
const LN_SEASONS = ["صيفي", "شتوي", "موعد ب / خاص"];
const LN_FREE = "حصة تقوية مجانية";
const LN_FORMATS = ["درس خصوصي", "درس جماعي", LN_FREE];

// One private subscription (my decks, plans, exam dates, follows, bagrut tracker) + public decks + material approvals.
HOOKS.boot.push(() => {
  if (S.uid) subscribe(myCol(), { limit: 300 }, (rows) => { LN.mine = rows; lnRefresh(); });
  subscribe("decks", { limit: 200 }, (rows) => { LN.decks = rows; lnRefresh(); });
  subscribe("approvals", { limit: 1000 }, (rows) => { LN.approved = Object.fromEntries(rows.map((r) => [r.id, true])); lnRefresh(); });
});
function lnRefresh() { if (LN.draw) { try { LN.draw(); } catch (e) { console.warn(e); } } }
HOOKS.lists.push(lnRefresh);
// The current view's redraw function; cleared when the view closes.
function lnSetDraw(fn) { LN.draw = fn; onLeave(() => { if (LN.draw === fn) LN.draw = null; }); }
// Subscribe for the lifetime of the current view.
function lnLive(col, opts, cb) { onLeave(subscribe(col, opts, cb)); }
const lnClean = (row) => { const c = { ...row }; delete c.id; return c; };
const lnId = () => Math.random().toString(36).slice(2, 10);

// ---------- private docs ----------
const lnMine = (id) => LN.mine.find((r) => r.id === id) || null;
async function lnSaveMine(id, data) {
  if (!S.uid) { toast("لازم تسجّل دخول عشان نحفظلك"); return false; }
  const old = lnMine(id);
  return setDoc(myCol(), id, { ...lnClean(data), uid: S.uid, createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() });
}

// ---------- materials visibility ----------
const lnPending = (m) => m.status === "pending" && !LN.approved[m.id];
function lnMatOk(m) {
  if (isMod("hidden", "materials:" + m.id)) return false;
  return !lnPending(m) || m.uid === S.uid || S.isAdmin;
}
const lnKindIs = (m, k) => (k === "فيديو" ? m.kind === "فيديو" || m.kind === "فيديو شرح" : m.kind === k);

// ---------- small UI pieces ----------
function lnField(label, control, full) { return h("label", { class: "field" + (full ? " full" : "") }, h("span", { text: label }), control); }
function lnWho(uid) {
  return h("span", { class: "ln-who" }, h("b", { text: nameOf(uid) }), isMod("verified", uid) ? h("span", { class: "pill good", text: "موثّق" }) : null);
}
function lnPerson(uid, sub) {
  return h("div", { class: "row ln-person" }, avatar(nameOf(uid), uid), h("div", { class: "ln-min" }, lnWho(uid), sub ? h("div", { class: "muted small", text: sub }) : null));
}
function lnStars(avg, n) {
  const r = Math.round(avg || 0);
  return h("span", { class: "ln-stars", title: `${(avg || 0).toFixed(1)} من 5` },
    h("span", { "aria-hidden": "true", text: "★".repeat(r) + "☆".repeat(5 - r) }),
    h("span", { class: "muted small", text: n ? ` ${avg.toFixed(1)} (${n})` : " لسا ما في تقييم" }));
}
// A 1-5 star picker; returns {el, get()}.
function lnStarPick(id, val = 0) {
  let v = val;
  const btns = [1, 2, 3, 4, 5].map((n) => h("button", { class: "ln-star", type: "button", "aria-label": n + " من 5", onclick: () => { v = n; paint(); } }, "★"));
  const paint = () => btns.forEach((b, i) => { b.setAttribute("aria-pressed", String(i < v)); });
  paint();
  return { el: h("div", { class: "ln-starpick", id, role: "group", "aria-label": "التقييم" }, btns), get: () => v };
}
const lnReportBtn = (target) => h("button", { class: "link small ln-quiet", type: "button", onclick: () => lnReport(target), text: "إبلاغ" });
function lnReport(target) {
  if (!guardWrite()) return;
  const reasons = ["معلومة غلط أو مضلّلة", "مادة محمية بحقوق نشر", "إساءة أو محتوى مش لائق", "الرابط خربان", "إشي ثاني"];
  const f = h("form", { class: "stack" },
    lnField("ليش بتبلّغ؟", h("select", { id: "ln-rep-reason" }, reasons.map((r) => opt(r)))),
    lnField("تفاصيل (اختياري)", h("textarea", { id: "ln-rep-text", maxlength: 400 })),
    h("p", { class: "muted small", text: "البلاغ بيوصل لإدارة المنصة بس، وما حدا ثاني بيشوف مين بلّغ." }),
    h("div", null, h("button", { class: "btn blue", type: "submit", text: "ابعث البلاغ" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = $("#ln-rep-text").value.trim();
    if (await addDoc("reports", { uid: S.uid, target, reason: $("#ln-rep-reason").value + (t ? ": " + t : ""), createdAt: Date.now() })) { close(); toast("وصل البلاغ للإدارة، يسلمو"); }
  });
  const close = modal("إبلاغ عن محتوى", f);
}
function lnNote(to, kind, text, goView) {
  if (!to || to === S.uid) return;
  addDoc("notes", { to, from: S.uid, kind, text, go: goView, createdAt: Date.now() });
}

// ---------- dates ----------
function lnDay(d = new Date()) { const z = new Date(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`; }
const lnToday = () => lnDay();
function lnDaysTo(s) { return Math.round((new Date(s + "T00:00") - new Date(lnToday() + "T00:00")) / 86400000); }
function lnAddDays(s, n) { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return lnDay(d); }
function lnDate(s, long) {
  const d = new Date(String(s).length > 10 ? s : s + "T00:00");
  if (isNaN(d)) return String(s || "");
  return d.toLocaleDateString("ar-EG-u-nu-latn", long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "numeric", year: "numeric" });
}
function lnSlot(s) {
  const d = new Date(s);
  return isNaN(d) ? String(s) : d.toLocaleString("ar-EG-u-nu-latn", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
}
function lnLeft(n) { return n === 0 ? "اليوم" : n === 1 ? "بكرا" : n < 0 ? "خلص" : n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يوم`; }

// ---------- AI: summarise a material (241) ----------
function lnSummarize(m) {
  const out = h("div", { class: "result ln-ai", "aria-live": "polite" }, h("span", { class: "muted small", text: "الملخص بيطلع هون." }));
  const ta = h("textarea", { id: "ln-sum-text", maxlength: 12000, placeholder: "انسخ فقرة أو صفحة من المادة والصقها هون…" });
  const btn = h("button", { class: "btn blue", type: "button", text: "لخّص" });
  btn.addEventListener("click", async () => {
    const pasted = ta.value.trim();
    if (!pasted && !(m && (m.note || "").trim().length > 20)) { toast("الصق نص من المادة أولًا، المساعد ما بيقدر يفتح الملف"); return; }
    btn.disabled = true;
    const p = h("p", { class: "ln-pre" }); out.replaceChildren(p);
    const input = "لخّص هالمادة الدراسية لطالب ثانوية بالعربي البسيط: نقاط رئيسية قصيرة، وبعدها 3 أسئلة مراجعة مع أجوبتها. اعتمد بس على النص المعطى تحت. إذا النص قليل أو مش واضح، قول هيك وما تخترع معلومات.\n\n" +
      (m ? `العنوان: ${m.title}\nالموضوع: ${m.subject} · ${m.kind}\nوصف صاحب المادة: ${m.note || "—"}\n` : "") + (pasted ? `\nالنص:\n${pasted}` : "");
    try { const t = await ai(input, { onText: ({ text }) => { p.textContent = text; } }); p.textContent = t; }
    catch (e) { p.textContent = aiError(e); }
    btn.disabled = false;
  });
  modal(m ? "لخّص: " + m.title : "لخّص نص دراسي", h("div", { class: "stack ln" },
    h("p", { class: "banner", text: "Claude ما بيقدر يفتح الرابط أو الملف بنفسه. الصق النص اللي بدك تلخّصه (أو جزء منه)، وإذا ما لصقت إشي بنلخّص وصف المادة بس." }),
    lnField("نص من المادة", ta), h("div", null, btn), out));
}

// ---------- global search ----------
registerSearch("المواد والامتحانات", (q) => S.materials
  .filter((m) => lnMatOk(m) && matches([m.title, m.note, m.subject, m.kind, m.institution, m.year, (m.tags || []).join(" ")].join(" "), q))
  .slice(0, 8).map((m) => ({ title: m.title, sub: [m.subject, m.kind, m.year].filter(Boolean).join(" · "), go: "library", onOpen: () => { libState.q = m.title; libState.subject = "all"; libState.kind = "all"; } })));
registerSearch("بطاقات الحفظ", (q) => [
  ...LN.decks.filter((d) => !isMod("hidden", "decks:" + d.id)).map((d) => ({ d, go: "ln-cards" })),
  ...lnMyDecks().map((d) => ({ d, go: "ln-mycards" })),
].filter(({ d }) => matches(d.title + " " + d.subject, q)).slice(0, 8)
  .map(({ d, go }) => ({ title: d.title, sub: `${d.subject || ""} · ${(d.cards || []).length} بطاقة`, go })));
