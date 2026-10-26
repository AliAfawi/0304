// ===== learning: library (materials) and tutors =====
// Lists render into #ln-lib-list / #ln-tut-list from this module (via LN.draw), not from 99-boot's renderLists.
// ---------- learning team: shared helpers, constants and global data (also used by 31-*.js) ----------
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
  ...(typeof lnMyDecks === "function" ? lnMyDecks() : []).map((d) => ({ d, go: "ln-mycards" })),
].filter(({ d }) => matches(d.title + " " + d.subject, q)).slice(0, 8)
  .map(({ d, go }) => ({ title: d.title, sub: `${d.subject || ""} · ${(d.cards || []).length} بطاقة`, go })));

const libState = { subject: "all", kind: "all", q: "", sort: "new", tag: "all", soon: false };
let tutorType = "offer", tutorFilter = "all";
const tutState = { subject: "all" };
const LN_SHELVES = [
  ["الكل", {}], ["بجروت", { kind: "امتحان بجروت" }], ["بسيخومتري", { subject: "بسيخومتري" }], ["إنجليزي", { subject: "إنجليزي" }],
  ["عبري", { subject: "عبري" }], ["أول سنة جامعة", { kind: "ملخص مساق جامعي" }], ["مكيناه", { kind: "ملخص مكيناه" }],
  ["SAT و TOEFL", { subject: "SAT / TOEFL" }], ["فيديوهات", { kind: "فيديو" }], ["مشاريع تخرج", { kind: "مشروع تخرج" }],
];

// Subjects of my personal exams in the next 30 days (180).
function lnSoonSubjects() {
  const list = (lnMine("ln-exams")?.list || []).filter((e) => { const n = lnDaysTo(e.date); return n >= 0 && n <= 30; });
  return new Set(list.map((e) => e.subject));
}

views.library = () => {
  let uploaded = null;
  const tags = new Set();
  const kindSel = h("select", { id: "ln-m-kind" }, LN_KINDS.map((k) => opt(k)));
  const subjSel = h("select", { id: "ln-m-subject" }, LN_SUBJECTS.map((s) => opt(s)));
  const extra = h("div", { class: "form full ln-sub" });
  const urlCap = h("span", { text: "الرابط (Google Drive أو غيره، مفتوح للمشاهدة)" });
  const upNote = h("span", { class: "muted small", text: "PDF أو صورة. الملف بينحفظ بالمنصة وبيفتح بصفحة جديدة." });
  const upBox = h("div", { class: "field full", hidden: true },
    h("span", { text: "أو ارفع الملف مباشرة" }),
    h("input", { type: "file", id: "ln-m-file", accept: "application/pdf,image/*", onchange: async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (!guardWrite()) { e.target.value = ""; return; }
      upNote.textContent = "جارِ الرفع…";
      uploaded = await uploadFile(file);
      upNote.textContent = uploaded ? "انرفع الملف: " + file.name : "ما انرفع. جرّب مرة ثانية أو حط رابط.";
      if (!uploaded) e.target.value = "";
    } }), upNote);
  const drawExtra = () => {
    const k = kindSel.value, s = subjSel.value;
    urlCap.textContent = k === "فيديو" ? "رابط الفيديو (يوتيوب أو غيره)" : "الرابط (Google Drive أو غيره، مفتوح للمشاهدة)";
    const years = []; for (let y = THIS_YEAR; y >= 1995; y--) years.push(y);
    const parts = [];
    if (k === "امتحان بجروت" || k === "مشروع تخرج" || k === "امتحان سابق")
      parts.push(lnField("السنة", h("select", { id: "ln-m-year" }, opt("", "—"), years.map((y) => opt(y, String(y))))));
    if (k === "امتحان بجروت") {
      parts.push(lnField("الموعد", h("select", { id: "ln-m-season" }, LN_SEASONS.map((x) => opt(x)))));
      parts.push(lnField("عدد الوحدات", h("select", { id: "ln-m-units" }, [5, 4, 3, 2, 1].map((u) => opt(u, `${u} وحدات`)))));
    }
    if (k === "امتحان بجروت" || k === "امتحان سابق")
      parts.push(lnField("رابط الحل (اختياري)", h("input", { type: "url", id: "ln-m-sol", maxlength: 500, placeholder: "https://…" }), true));
    if (k === "ملخص مساق جامعي" || k === "ملخص مكيناه")
      parts.push(lnField("المؤسسة", h("input", { type: "text", id: "ln-m-inst", list: "ln-inst-names", maxlength: 80, placeholder: "مثال: جامعة بن غوريون" })),
        h("datalist", { id: "ln-inst-names" }, INST.map((i) => opt(i.ar))));
    const tl = LN_TAGS[s];
    if (tl) parts.push(h("div", { class: "field full" }, h("span", { text: "تصنيف إضافي" }),
      h("div", { class: "chips" }, tl.map((t) => h("button", { class: "chip", type: "button", "aria-pressed": String(tags.has(t)), onclick: (e) => { tags.has(t) ? tags.delete(t) : tags.add(t); e.target.setAttribute("aria-pressed", String(tags.has(t))); }, text: t })))));
    extra.replaceChildren(...parts);
    extra.hidden = !parts.length;
  };
  kindSel.addEventListener("change", drawExtra);
  subjSel.addEventListener("change", () => { tags.clear(); drawExtra(); });
  drawExtra();

  const f = h("form", { class: "card form" },
    lnField("العنوان", h("input", { type: "text", id: "ln-m-title", required: true, maxlength: 120, placeholder: "مثال: ملخص بيولوجيا – الخلية، 5 وحدات" }), true),
    lnField("الموضوع", subjSel), lnField("النوع", kindSel),
    lnField("المستوى / الوحدات", h("input", { type: "text", id: "ln-m-level", maxlength: 40, placeholder: "مثال: 5 وحدات" })),
    extra,
    h("label", { class: "field full" }, urlCap, h("input", { type: "url", id: "ln-m-url", maxlength: 500, placeholder: "https://drive.google.com/…" })),
    upBox,
    lnField("وصف أو ملاحظة (اختياري، وبيساعد المساعد يلخّص)", h("textarea", { id: "ln-m-note", maxlength: 1500 }), true),
    h("p", { class: "muted small full", text: S.isAdmin ? "أنت من الإدارة، فالمادة بتنشر فورًا." : "المواد الجديدة بتراجعها الإدارة قبل ما تظهر للكل. لا تشارك كتب أو مواد محمية بحقوق نشر." }),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "شارك المادة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const val = (id) => ($("#" + id)?.value || "").trim();
    const raw = val("ln-m-url"), url = raw ? safeUrl(raw) : null;
    if (raw && !url) { toast("الرابط لازم يبلّش بـ https://"); return; }
    if (!url && !uploaded) { toast("حط رابط للمادة أو ارفع ملف"); return; }
    const d = { uid: S.uid, title: val("ln-m-title"), subject: subjSel.value, kind: kindSel.value, level: val("ln-m-level"), url: url || "", note: val("ln-m-note"),
      tags: [...tags], status: S.isAdmin ? "approved" : "pending", createdAt: Date.now() };
    if (!d.title) return;
    if ($("#ln-m-year")) d.year = +val("ln-m-year") || null;
    if ($("#ln-m-season")) d.season = val("ln-m-season");
    if ($("#ln-m-units")) d.units = +val("ln-m-units");
    if ($("#ln-m-inst")) d.institution = val("ln-m-inst");
    if (val("ln-m-sol")) { const s = safeUrl(val("ln-m-sol")); if (!s) { toast("رابط الحل لازم يبلّش بـ https://"); return; } d.solUrl = s; }
    if (uploaded) { d.fileId = uploaded.id; d.fileUrl = uploaded.url; }
    if (await addDoc("materials", d)) {
      f.reset(); uploaded = null; tags.clear(); drawExtra(); upNote.textContent = "PDF أو صورة. الملف بينحفظ بالمنصة وبيفتح بصفحة جديدة.";
      toast(S.isAdmin ? "انضافت المادة" : "انضافت المادة، وبتظهر للكل بعد موافقة الإدارة");
    }
  });

  const votes = { count: {}, mine: {} };
  const list = h("div", { class: "grid", id: "ln-lib-list" });
  const queue = h("div", { class: "section" });
  const fresh = h("div");
  const count = h("p", { class: "muted small", "aria-live": "polite" });
  const followBtn = h("button", { class: "btn sm ghost", type: "button", hidden: libState.subject === "all" });
  const soonChip = h("button", { class: "chip", type: "button", "aria-pressed": String(libState.soon), onclick: () => {
    if (!libState.soon && !lnSoonSubjects().size) { toast("ما عندك امتحانات بالشهر الجاي. أضفها بـ«مواعيد الامتحانات»"); return; }
    libState.soon = !libState.soon; soonChip.setAttribute("aria-pressed", String(libState.soon)); draw();
  }, text: "حسب امتحاناتي القريبة" });
  const setFilter = (p) => { libState.subject = p.subject || "all"; libState.kind = p.kind || "all"; libState.tag = "all"; renderView(); };
  const tagList = LN_TAGS[libState.subject];

  const vote = (m) => {
    if (!guardWrite()) return;
    if (m.uid === S.uid) { toast("ما بتقدر تصوّت لمادتك"); return; }
    const on = !votes.mine[m.id];
    setDoc("useful", `${m.id}__${S.uid}`, { uid: S.uid, target: m.id, v: on ? 1 : 0, createdAt: Date.now() });
  };
  const approve = async (m) => {
    if (await setDoc("approvals", m.id, { uid: S.uid, target: m.id, createdAt: Date.now() })) {
      toast("انقبلت المادة وصارت ظاهرة للكل");
      lnNote(m.uid, "approved", "انقبلت مادتك «" + m.title + "» وصارت بالمكتبة", "library");
    }
  };
  const card = (m) => {
    const fileHref = m.fileUrl ? safeUrl(m.fileUrl) || (String(m.fileUrl).startsWith("/") ? m.fileUrl : null) : null;
    const linkHref = safeUrl(m.url);
    const info = [m.year, m.season, m.units ? `${m.units} وحدات` : "", m.institution].filter(Boolean).join(" · ");
    return h("article", { class: "card item ln-mat" },
      h("div", { class: "row" }, h("span", { class: "pill", text: m.subject }), h("span", { class: "pill grey", text: m.kind }),
        lnPending(m) ? h("span", { class: "pill warn", text: "بانتظار المراجعة" }) : null,
        isMod("pinned", m.id) ? h("span", { class: "pill good", text: "مثبّتة" }) : null,
        (m.tags || []).map((t) => h("span", { class: "tag", text: t }))),
      h("h3", { text: m.title }),
      info || m.level ? h("div", { class: "muted small", text: [info, m.level].filter(Boolean).join(" · ") }) : null,
      m.note ? h("p", { class: "muted ln-clamp", text: m.note }) : null,
      h("div", { class: "meta" }, lnWho(m.uid), h("span", { text: rel(m.createdAt) })),
      h("div", { class: "row" },
        fileHref ? h("a", { class: "btn sm blue", href: fileHref, target: "_blank", rel: "noopener", text: "افتح الملف" }) : null,
        linkHref ? h("a", { class: "btn sm " + (fileHref ? "ghost" : "blue"), href: linkHref, target: "_blank", rel: "noopener", text: lnKindIs(m, "فيديو") ? "شوف الفيديو" : "افتح المادة" }) : null,
        safeUrl(m.solUrl) ? h("a", { class: "btn sm ghost", href: safeUrl(m.solUrl), target: "_blank", rel: "noopener", text: "الحل" }) : null,
        h("button", { class: "chip ln-useful", type: "button", "aria-pressed": String(!!votes.mine[m.id]), onclick: () => vote(m), title: "إذا ساعدتك المادة" }, `مفيد · ${votes.count[m.id] || 0}`)),
      h("div", { class: "row ln-actions" },
        CAP.sample ? h("button", { class: "link small", type: "button", onclick: () => lnSummarize(m), text: "لخّص هالمادة" }) : null,
        S.isAdmin && lnPending(m) ? h("button", { class: "btn sm blue", type: "button", onclick: () => approve(m), text: "وافق وانشر" }) : null,
        lnReportBtn("materials:" + m.id), rowActions("materials", m)));
  };

  const draw = () => {
    upBox.hidden = !CAP.assets;
    const all = S.materials.filter(lnMatOk);
    // admin review queue (48)
    const pend = S.isAdmin ? all.filter(lnPending) : [];
    queue.replaceChildren(...(pend.length ? [h("div", { class: "card stack ln-queue" },
      h("div", { class: "spread" }, h("h2", { text: "بانتظار المراجعة" }), h("span", { class: "pill warn", text: `${pend.length} مادة` })),
      h("p", { class: "muted small", text: "تأكد إن الرابط شغّال وإن المادة مش محمية بحقوق نشر، وبعدين وافق. اللي مش مناسب احذفه." }),
      ...pend.map((m) => h("div", { class: "plain spread" },
        h("div", { class: "ln-min" }, h("b", { text: m.title }), h("div", { class: "muted small", text: [m.subject, m.kind, nameOf(m.uid)].join(" · ") })),
        h("div", { class: "row" },
          safeUrl(m.url) ? h("a", { class: "btn sm ghost", href: safeUrl(m.url), target: "_blank", rel: "noopener", text: "افحص" }) : null,
          h("button", { class: "btn sm blue", type: "button", onclick: () => approve(m), text: "وافق" }), rowActions("materials", m)))))] : []));
    // follows (62)
    const fol = lnMine("ln-follow") || { subjects: [], seen: 0 };
    const isF = fol.subjects.includes(libState.subject);
    followBtn.textContent = isF ? "إلغاء متابعة «" + libState.subject + "»" : "تابع «" + libState.subject + "»";
    followBtn.onclick = () => {
      const subjects = isF ? fol.subjects.filter((s) => s !== libState.subject) : [...fol.subjects, libState.subject];
      lnSaveMine("ln-follow", { t: "ln-follow", subjects, seen: fol.seen || Date.now() }).then((ok) => ok && toast(isF ? "لغيت المتابعة" : "صرت تتابع الموضوع، الجديد بيطلعلك هون"));
    };
    if (fol.subjects.length) {
      const news = all.filter((m) => fol.subjects.includes(m.subject) && m.createdAt > (fol.seen || 0) && m.uid !== S.uid).slice(0, 6);
      fresh.replaceChildren(h("div", { class: "plain stack ln-fresh" },
        h("div", { class: "spread" }, h("h3", { text: "جديد في مواضيعك" }),
          news.length ? h("button", { class: "link small", type: "button", onclick: () => lnSaveMine("ln-follow", { ...fol, seen: Date.now() }), text: "علّمها كمقروءة" }) : null),
        h("div", { class: "chips" }, fol.subjects.map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(libState.subject === s), onclick: () => setFilter({ subject: s }), text: s }))),
        news.length ? h("ul", { class: "ln-list" }, news.map((m) => h("li", null, h("b", { text: m.title }), h("span", { class: "muted small", text: " · " + m.subject + " · " + rel(m.createdAt) }))))
          : h("p", { class: "muted small", text: "ما في إشي جديد بمواضيعك من آخر مرة." })));
    } else fresh.replaceChildren();
    // list
    const q = libState.q.trim(), soon = libState.soon ? lnSoonSubjects() : null;
    let rows = all.filter((m) => (libState.subject === "all" || m.subject === libState.subject) && (libState.kind === "all" || lnKindIs(m, libState.kind)) &&
      (libState.tag === "all" || (m.tags || []).includes(libState.tag)) && (!soon || soon.has(m.subject)) &&
      matches([m.title, m.note, m.level, m.subject, m.kind, m.institution, m.year, m.season, (m.tags || []).join(" ")].join(" "), q));
    rows = rows.sort((a, b) => (isMod("pinned", b.id) - isMod("pinned", a.id)) ||
      (libState.sort === "useful" ? (votes.count[b.id] || 0) - (votes.count[a.id] || 0) : 0) || (b.createdAt || 0) - (a.createdAt || 0));
    count.textContent = `${rows.length} مادة`;
    list.replaceChildren(...(rows.length ? rows.map(card) : [all.length
      ? empty("ما لقينا مواد بهالفلتر", "جرّب موضوع أو نوع ثاني، أو شارك أول مادة من هالنوع.")
      : empty("المكتبة فاضية لسا", "شارك أول ملخص أو امتحان بجروت من زر «شارك مادة». كل مادة بتوفّر ساعات على طالب.")]));
  };
  lnSetDraw(draw);
  lnLive("useful", { limit: 3000 }, (rows) => {
    votes.count = {}; votes.mine = {};
    rows.forEach((r) => { if (r.v) { votes.count[r.target] = (votes.count[r.target] || 0) + 1; if (r.uid === S.uid) votes.mine[r.target] = true; } });
    draw();
  });

  const v = h("div", { class: "view ln" },
    head("مكتبة الخريجين", "مواد، امتحانات ومساعدات", "امتحانات بجروت سابقة مع حلول، ملخصات، فيديوهات شرح، وملخصات مساقات أول سنة ومكيناه. بيشاركها الخريجون لطلاب المدرسة وللأفواج الجاية."),
    writeBanner(),
    queue,
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ شارك مادة" }), f),
    h("nav", { class: "chips ln-shelves", "aria-label": "رفوف المكتبة" }, LN_SHELVES.map(([l, p]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(libState.subject === (p.subject || "all") && libState.kind === (p.kind || "all")), onclick: () => setFilter(p), text: l }))),
    h("div", { class: "section" },
      h("div", { class: "form" },
        lnField("بحث", h("input", { type: "search", id: "ln-lib-q", value: libState.q, placeholder: "عنوان، سنة، مؤسسة…", oninput: (e) => { libState.q = e.target.value; draw(); } })),
        lnField("الموضوع", h("select", { id: "ln-lib-subject", onchange: (e) => { libState.subject = e.target.value; libState.tag = "all"; renderView(); } },
          opt("all", "كل المواضيع", libState.subject === "all"), LN_SUBJECTS.map((s) => opt(s, s, libState.subject === s)))),
        lnField("النوع", h("select", { id: "ln-lib-kind", onchange: (e) => { libState.kind = e.target.value; renderView(); } },
          opt("all", "كل الأنواع", libState.kind === "all"), LN_KINDS.map((s) => opt(s, s, libState.kind === s)))),
        lnField("الترتيب", h("select", { id: "ln-lib-sort", onchange: (e) => { libState.sort = e.target.value; draw(); } },
          opt("new", "الأحدث", libState.sort === "new"), opt("useful", "الأكثر فائدة", libState.sort === "useful")))),
      tagList ? h("div", { class: "chips", "aria-label": "تصنيف" }, ["all", ...tagList].map((t) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String(libState.tag === t), onclick: () => { libState.tag = t; renderView(); }, text: t === "all" ? "كل التصنيفات" : t }))) : null,
      h("div", { class: "spread" }, h("div", { class: "row" }, soonChip, followBtn), count)),
    fresh,
    list,
  );
  return v;
};

// ---------- tutors (63-72, 76-77, 80) ----------
const lnTut = { bookings: [], conf: {}, reviews: [] };
views.tutors = () => {
  const isOffer = tutorType === "offer";
  let slots = [];
  const fmtSel = h("select", { id: "ln-t-format" }, LN_FORMATS.map((x) => opt(x)));
  const groupBox = h("div", { class: "form full ln-sub", hidden: true },
    lnField("عدد المقاعد", h("input", { type: "number", id: "ln-t-cap", min: 2, max: 60, value: 8 })),
    lnField("متى؟", h("input", { type: "text", id: "ln-t-when", maxlength: 80, placeholder: "مثال: كل ثلاثاء 17:00، أو 3/12 الساعة 16:00" })));
  const priceBox = lnField("السعر للساعة (₪، اكتب 0 إذا مجاني)", h("input", { type: "number", id: "ln-t-price", min: 0, max: 1000, value: 0 }));
  const slotList = h("div", { class: "chips" });
  const slotIn = h("input", { type: "datetime-local", id: "ln-t-slot", "aria-label": "موعد متاح" });
  const drawSlots = () => slotList.replaceChildren(...slots.map((s) => h("button", { class: "chip", type: "button", title: "شيل الموعد", onclick: () => { slots = slots.filter((x) => x !== s); drawSlots(); } }, lnSlot(s) + " ×")));
  const slotBox = h("div", { class: "field full" }, h("span", { text: "مواعيد متاحة للحجز (اختياري)" }),
    h("div", { class: "row" }, slotIn, h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (slotIn.value && !slots.includes(slotIn.value)) { slots.push(slotIn.value); slots.sort(); drawSlots(); slotIn.value = ""; } }, text: "أضف موعد" })),
    slotList);
  fmtSel.addEventListener("change", () => {
    const fm = fmtSel.value;
    groupBox.hidden = fm !== "درس جماعي";
    priceBox.hidden = fm === LN_FREE;
    slotBox.hidden = fm === "درس جماعي";
  });
  const f = h("form", { class: "card form" },
    h("div", { class: "chips full" },
      h("button", { class: "chip", type: "button", "aria-pressed": String(isOffer), onclick: () => { tutorType = "offer"; renderView(); }, text: "بعلّم درس" }),
      h("button", { class: "chip", type: "button", "aria-pressed": String(!isOffer), onclick: () => { tutorType = "request"; renderView(); }, text: "بحتاج مساعدة" })),
    isOffer ? lnField("نوع العرض", fmtSel) : null,
    lnField("الموضوع", h("select", { id: "ln-t-subject" }, LN_SUBJECTS.map((s) => opt(s)))),
    lnField("المستوى", h("input", { type: "text", id: "ln-t-level", maxlength: 40, placeholder: "مثال: 4-5 وحدات" })),
    isOffer ? priceBox : null,
    lnField("الطريقة", h("select", { id: "ln-t-mode" }, opt("وجهًا لوجه"), opt("أونلاين"), opt("الطريقتين"))),
    lnField("المنطقة / البلد", h("input", { type: "text", id: "ln-t-area", maxlength: 40 })),
    lnField("طريقة تواصل", h("input", { type: "text", id: "ln-t-contact", maxlength: 80, placeholder: "إنستغرام أو إيميل" })),
    isOffer ? groupBox : null,
    isOffer ? slotBox : null,
    lnField(isOffer ? "عن الدرس" : "شو بتحتاج بالضبط؟", h("textarea", { id: "ln-t-note", maxlength: 600 }), true),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: isOffer ? "أضف عرض الدرس" : "أضف الطلب" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const val = (id) => ($("#" + id)?.value || "").trim();
    const format = isOffer ? fmtSel.value : null;
    const d = { uid: S.uid, type: tutorType, subject: val("ln-t-subject"), level: val("ln-t-level"), mode: val("ln-t-mode"), area: val("ln-t-area"), contact: val("ln-t-contact"), note: val("ln-t-note"), createdAt: Date.now() };
    if (isOffer) {
      d.format = format;
      d.price = format === LN_FREE ? 0 : Math.max(0, +val("ln-t-price") || 0);
      if (format === "درس جماعي") { d.capacity = Math.max(2, Math.min(60, +val("ln-t-cap") || 8)); d.when = val("ln-t-when"); }
      else d.slots = slots;
    } else d.price = null;
    if (await addDoc("tutors", d)) { f.reset(); slots = []; drawSlots(); toast("انضاف"); }
  });

  const list = h("div", { class: "grid", id: "ln-tut-list" });
  const mine = h("div");
  const draw = () => {
    mine.replaceChildren(typeof lnMyLessonsPanel === "function" ? lnMyLessonsPanel() : h("span"));
    const offers = S.tutors.filter((t) => t.type === "offer" && !isMod("hidden", "tutors:" + t.id));
    const rows = S.tutors.filter((t) => !isMod("hidden", "tutors:" + t.id) && (tutState.subject === "all" || t.subject === tutState.subject) && (
      tutorFilter === "all" || (tutorFilter === "free" ? t.type === "offer" && !t.price : tutorFilter === "group" ? t.format === "درس جماعي" :
        tutorFilter === "boost" ? t.format === LN_FREE : t.type === tutorFilter)));
    list.replaceChildren(...(rows.length ? rows.map((t) => (typeof lnTutorCard === "function" ? lnTutorCard(t, offers) : h("article", { class: "card item" }, h("span", { class: "pill", text: t.subject }), t.note ? h("p", { text: t.note }) : null))) : [S.tutors.length
      ? empty("ما في شي بهالفلتر", "جرّب فلتر ثاني، أو أضف عرض أو طلب بهالموضوع.")
      : empty("ما في عروض ولا طلبات لسا", "إذا بتقدر تعلّم موضوع أضف عرضك، وإذا بتحتاج مساعدة اكتب شو بتحتاج.")]));
  };
  lnSetDraw(draw);
  lnLive("bookings", { limit: 1000 }, (rows) => { lnTut.bookings = rows; draw(); });
  lnLive("bookconf", { limit: 1000 }, (rows) => { lnTut.conf = Object.fromEntries(rows.map((r) => [r.id, r])); draw(); });
  lnLive("tutorreviews", { limit: 1000 }, (rows) => { lnTut.reviews = rows.filter((r) => !isMod("hidden", "tutorreviews:" + r.id)); draw(); });

  return h("div", { class: "view ln" },
    head("دروس خصوصية ومساعدات", "خريج بيعلّم، وطالب بيتعلّم", "دروس خصوصية وجماعية، حصص تقوية مجانية قبل البجروت، بسيخومتري، مساعدة تقنية وترجمة وثائق. احجز موعد من جدول المعلّم وقيّمه بعد الدرس."),
    writeBanner(),
    mine,
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ أضف عرض أو طلب" }), f),
    h("div", { class: "section" },
      h("div", { class: "chips" }, [["all", "الكل"], ["offer", "عروض دروس"], ["request", "طلبات مساعدة"], ["free", "مجاني"], ["group", "دروس جماعية"], ["boost", "حصص تقوية"]].map(([k, l]) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String(tutorFilter === k), onclick: () => { tutorFilter = k; renderView(); }, text: l }))),
      h("div", { class: "form" }, lnField("الموضوع", h("select", { id: "ln-tut-subject", onchange: (e) => { tutState.subject = e.target.value; draw(); } },
        opt("all", "كل المواضيع", tutState.subject === "all"), LN_SUBJECTS.map((s) => opt(s, s, tutState.subject === s)))))),
    list,
  );
};

registerView("library", "learn", "المواد والامتحانات", null, { order: 10 });
registerView("tutors", "learn", "دروس ومساعدة", null, { order: 20 });
