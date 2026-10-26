// ===== 36 · tools & AI team: «جامعة» add-ons — compare, student experiences, registration deadlines =====
// Collections: reviews {uid, inst, stars, role, text, createdAt, updatedAt} (doc id `${inst}__${uid}`),
// deadlines {uid, inst, title, date "YYYY-MM-DD", url, note, createdAt}. inst = t35Key(INST entry).

const u36Hidden = (col, id) => isMod("hidden", col + ":" + id);
function u36Stars(avg, size) {
  const full = Math.round(avg);
  return h("span", { class: "u36-stars" + (size ? " " + size : ""), role: "img", "aria-label": `${avg.toFixed(1)} من 5` },
    h("span", { class: "u36-on", text: "★".repeat(full) }), h("span", { class: "u36-off", text: "★".repeat(5 - full) }));
}
function u36Avg(rows, key) {
  const list = rows.filter((r) => r.inst === key);
  return list.length ? { avg: list.reduce((n, r) => n + (+r.stars || 0), 0) / list.length, n: list.length } : null;
}
function u36AvgLine(a) {
  if (!a) return h("span", { class: "muted small", text: "لسا ما في تقييمات" });
  return h("span", { class: "row u36-avg" }, u36Stars(a.avg), h("b", { class: "num", text: a.avg.toFixed(1) }), h("span", { class: "muted small", text: a.n === 1 ? "تجربة وحدة" : `${a.n} تجارب` }));
}
function u36Report(col, row) {
  if (!guardWrite()) return;
  const reasons = ["معلومة غلط أو مضللة", "إساءة أو كلام جارح", "ذكر أسماء أشخاص أو معلومات خاصة", "إعلان أو سبام", "رابط مشبوه", "غير ذلك"];
  const f = h("form", { class: "stack" },
    t35Field("شو المشكلة؟", h("select", { id: "u36-rp-reason" }, reasons.map((r) => opt(r)))),
    t35Field("تفاصيل (اختياري)", h("textarea", { id: "u36-rp-text", maxlength: 300, rows: 3 })),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "submit", text: "أرسل البلاغ" }), h("span", { class: "muted small", text: "البلاغ بيوصل للإدارة بس." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = [$("#u36-rp-reason").value, $("#u36-rp-text").value.trim()].filter(Boolean).join(" — ");
    if (await addDoc("reports", { uid: S.uid, target: col + ":" + row.id, reason, createdAt: Date.now() })) { close(); toast("وصل البلاغ، شكرًا"); }
  });
  const close = modal("إبلاغ", f);
}
function u36ReportBtn(col, row) {
  return row.uid === S.uid ? null : h("button", { class: "link small u36-report", type: "button", text: "إبلاغ", onclick: () => u36Report(col, row) });
}

// ---------- 86 · compare two institutions ----------
const CMP = lsGet("u36:cmp", { a: "", b: "" });
function u36CompareView() {
  if (!t35Inst(CMP.a)) CMP.a = t35Key(INST[0]);
  if (!t35Inst(CMP.b)) CMP.b = t35Key(INST.find((i) => i.t === "c") || INST[1]);
  let reviews = [];
  const table = h("div", { class: "u36-cmp" });
  const draw = () => {
    lsSet("u36:cmp", CMP);
    const A = t35Inst(CMP.a), B = t35Inst(CMP.b);
    const all = (i) => Object.values(i.majors).flat();
    const common = all(A).filter((m) => all(B).includes(m));
    const row = (label, fa, fb) => [h("h4", { class: "u36-cmp-label", text: label }), h("div", { class: "u36-cell" }, fa(A)), h("div", { class: "u36-cell" }, fb ? fb(B) : fa(B))];
    const majors = (i) => h("div", { class: "stack", style: "gap:6px" }, ...Object.entries(i.majors).map(([fac, l]) => h("div", { class: "fac" }, h("span", { class: "fac-name", text: fac }),
      h("div", { class: "chips" }, l.map((m) => h("span", { class: "tag" + (common.includes(m) ? " hit" : ""), text: m }))))));
    t35Fill(table, 
      h("div", { class: "u36-cell u36-name" }, h("h3", { text: A.ar }), h("span", { class: "he muted small", text: A.he })),
      h("div", { class: "u36-cell u36-name" }, h("h3", { text: B.ar }), h("span", { class: "he muted small", text: B.he })),
      ...row("النوع والمنطقة", (i) => h("div", { class: "row" }, h("span", { class: "pill", text: TYPES[i.t] }), h("span", { class: "pill grey", text: i.r }))),
      ...row("نبذة", (i) => h("p", { class: "about small", text: i.about })),
      ...row("تجارب الطلاب", (i) => u36AvgLine(u36Avg(reviews, t35Key(i)))),
      ...row("شروط مكتوبة", (i) => i.req.length ? reqList(i.req) : h("p", { class: "muted small", text: "ما في شروط خاصة بالدليل. الشروط العامة لنوعها بتنطبق." })),
      ...row("عدد التخصصات بالدليل", (i) => h("b", { class: "num", text: String(all(i).length) })),
      ...row("التخصصات", majors),
      ...row("التسجيل", (i) => h("a", { class: "btn sm blue", href: regUrl(i), target: "_blank", rel: "noopener", text: i.reg ? "رابط التسجيل" : "ابحث عن صفحة التسجيل" })),
    );
    $("#u36-common") && ($("#u36-common").textContent = common.length ? `${common.length} تخصص مشترك، معلّمين بالأزرق.` : "ما في تخصصات بنفس الاسم بالمؤسستين.");
  };
  const v = h("div", { class: "view" },
    head("قسم «جامعة»", "قارن بين مؤسستين", "اختار مؤسستين وشوفهم جنب بعض: النوع، المنطقة، الشروط المكتوبة، التخصصات، تقييمات الطلاب ورابط التسجيل."),
    h("div", { class: "card stack" },
      h("div", { class: "form" },
        t35Field("المؤسسة الأولى", t35InstSelect("u36-cmp-a", CMP.a, (e) => { CMP.a = e.target.value; draw(); })),
        t35Field("المؤسسة الثانية", t35InstSelect("u36-cmp-b", CMP.b, (e) => { CMP.b = e.target.value; draw(); }))),
      h("div", { class: "spread" }, h("p", { class: "muted small", id: "u36-common" }),
        h("button", { class: "btn sm ghost", type: "button", text: "بدّل الأماكن", onclick: () => { [CMP.a, CMP.b] = [CMP.b, CMP.a]; $("#u36-cmp-a").value = CMP.a; $("#u36-cmp-b").value = CMP.b; draw(); } }))),
    table,
    h("p", { class: "muted small", text: "الحدود الدنيا والرسوم بتتغيّر كل سنة وما بنعرضها هون إلا إذا مكتوبة بالدليل. الرقم الرسمي بصفحة التخصص." }),
  );
  onLeave(subscribe("reviews", { limit: 500 }, (rows) => { reviews = rows.filter((r) => !u36Hidden("reviews", r.id)); draw(); }));
  queueMicrotask(draw);
  return v;
}

// ---------- 88 · student experiences ----------
const REV = { inst: "", sort: "new" };
const U36 = { redraw: null };
HOOKS.lists.push(() => U36.redraw && U36.redraw());
function u36ReviewsView() {
  let rows = [];
  const summary = h("div", { class: "u36-sum" });
  const list = h("div", { class: "stack" });
  const formBox = h("div");
  const draw = () => {
    const vis = rows.filter((r) => !u36Hidden("reviews", r.id) && t35Inst(r.inst));
    const byInst = {};
    vis.forEach((r) => (byInst[r.inst] ||= []).push(r));
    const ranked = Object.keys(byInst).map((k) => ({ k, ...u36Avg(vis, k) })).sort((a, b) => b.n - a.n || b.avg - a.avg);
    t35Fill(summary, ...(ranked.length ? ranked.slice(0, 12).map((x) => h("button", { class: "plain u36-sum-item", type: "button", "aria-pressed": String(REV.inst === x.k), onclick: () => { REV.inst = REV.inst === x.k ? "" : x.k; $("#u36-rv-filter").value = REV.inst; draw(); } },
      h("b", { text: t35Inst(x.k).ar }), u36AvgLine(x))) : []));
    let shown = vis.filter((r) => !REV.inst || r.inst === REV.inst);
    shown = shown.sort(REV.sort === "high" ? (a, b) => b.stars - a.stars || b.createdAt - a.createdAt : REV.sort === "low" ? (a, b) => a.stars - b.stars || b.createdAt - a.createdAt : (a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    t35Fill(list, ...(shown.length ? shown.map((r) => h("article", { class: "card item" },
      h("div", { class: "spread" }, h("b", { text: t35Inst(r.inst).ar }), u36Stars(+r.stars || 0)),
      h("p", { text: r.text }),
      h("div", { class: "meta" }, avatar(nameOf(r.uid), r.uid), h("span", { class: "who", text: nameOf(r.uid) }), isMod("verified", r.uid) ? h("span", { class: "pill good", text: "موثّق" }) : null,
        r.role ? h("span", { text: r.role }) : null, S.alumni[r.uid] ? h("span", { text: `فوج ${S.alumni[r.uid].year}` }) : null, h("span", { text: rel(r.updatedAt || r.createdAt) })),
      h("div", { class: "row" }, u36ReportBtn("reviews", r), rowActions("reviews", r))))
      : [empty(REV.inst ? "لسا ما حدا كتب عن هاي المؤسسة" : "لسا ما في تجارب", "إذا بتدرس أو درست بمؤسسة، اكتب تجربتك فوق. هيك بتساعد طلاب المدرسة يختاروا.")]));
    drawForm();
  };
  const drawForm = () => {
    if (!S.uid || !S.canWrite) { t35Fill(formBox, h("p", { class: "muted small", text: "لتكتب تجربة لازم تكون مسجّل دخول ومعك صلاحية مشاركة." })); return; }
    const sel = $("#u36-rv-inst"); const cur = sel ? sel.value : (REV.inst || "");
    if (sel && formBox.contains(sel) && formBox.dataset.inst === cur) return;
    const key = cur || t35Key(INST[0]);
    formBox.dataset.inst = key;
    const mine = rows.find((r) => r.inst === key && r.uid === S.uid);
    let stars = mine ? +mine.stars : 0;
    const starBtns = [1, 2, 3, 4, 5].map((n) => h("button", { class: "u36-star-btn", type: "button", "aria-label": `${n} من 5`, "aria-pressed": String(n <= stars), text: "★",
      onclick: () => { stars = n; starBtns.forEach((b, k) => b.setAttribute("aria-pressed", String(k < n))); } }));
    const f = h("form", { class: "form" },
      t35Field("المؤسسة", t35InstSelect("u36-rv-inst", key, (e) => { formBox.dataset.inst = ""; drawForm(); })),
      t35Field("علاقتك فيها", h("select", { id: "u36-rv-role" }, ["طالب/ة حالي/ة", "خريج/ة", "درست فيها وتركت", "مكيناه"].map((r) => opt(r, r, mine && mine.role === r)))),
      h("div", { class: "field full" }, h("span", { text: "تقييمك العام" }), h("div", { class: "row", role: "group", "aria-label": "عدد النجوم" }, starBtns)),
      h("label", { class: "field full" }, h("span", { text: "تجربتك" }), h("textarea", { id: "u36-rv-text", required: true, minlength: 20, maxlength: 1200, rows: 4, placeholder: "شو عجبك وشو صعّب عليك؟ الجو للطلاب العرب، المساعدة الأكاديمية، السكن، المواصلات… بدون أسماء محاضرين أو طلاب.", text: mine ? mine.text : "" })),
      h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: mine ? "حدّث تجربتي" : "انشر تجربتي" }),
        h("span", { class: "muted small", text: "تجربة وحدة لكل شخص بكل مؤسسة. بتقدر تعدّلها بأي وقت." })));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!needProfile()) return;
      const text = $("#u36-rv-text").value.trim();
      if (!stars) { toast("اختار عدد النجوم"); return; }
      if (text.length < 20) { toast("اكتب شوي أكثر عن تجربتك"); return; }
      const inst = $("#u36-rv-inst").value;
      const old = rows.find((r) => r.inst === inst && r.uid === S.uid);
      const ok = await setDoc("reviews", `${inst}__${S.uid}`, { uid: S.uid, inst, stars, role: $("#u36-rv-role").value, text, createdAt: old ? old.createdAt : Date.now(), updatedAt: Date.now() });
      if (ok) { toast(old ? "تحدّثت تجربتك" : "انشرت تجربتك، شكرًا"); formBox.dataset.inst = ""; drawForm(); }
    });
    t35Fill(formBox, f);
  };
  const v = h("div", { class: "view" },
    head("قسم «جامعة»", "تجارب الطلاب", "خريجو المدرسة بيحكوا عن مؤسساتهم: شو منيح، شو صعب، وشو لازم تعرف قبل ما تسجّل. تقييم من 1 لـ 5 وتجربة قصيرة."),
    writeBanner(),
    h("section", { class: "card stack" }, h("h2", { text: "اكتب تجربتك" }), formBox),
    h("section", { class: "section" }, h("h2", { text: "المؤسسات حسب التجارب" }), summary),
    h("section", { class: "section" },
      h("div", { class: "form" },
        t35Field("اعرض تجارب عن", t35InstSelect("u36-rv-filter", REV.inst, (e) => { REV.inst = e.target.value; draw(); }, "كل المؤسسات")),
        h("div", { class: "field" }, h("span", { text: "الترتيب" }), h("div", { class: "chips" }, [["new", "الأحدث"], ["high", "الأعلى"], ["low", "الأقل"]].map(([k, l]) =>
          h("button", { class: "chip", type: "button", "aria-pressed": String(REV.sort === k), text: l, onclick: (e) => { REV.sort = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); draw(); } }))))),
      list),
    h("p", { class: "muted small", text: "التجارب آراء شخصية لأصحابها. شفت تجربة فيها إساءة أو معلومات خاصة؟ اكبس «إبلاغ»." }),
  );
  onLeave(subscribe("reviews", { limit: 500 }, (r) => { rows = r; resolveNames(r.map((x) => x.uid)); draw(); }));
  U36.redraw = () => document.body.contains(list) && draw();
  onLeave(() => (U36.redraw = null));
  return v;
}

// ---------- 89 · registration deadlines (members post, source link required) ----------
const DL = { inst: "", past: false };
function u36DeadlinesView() {
  let rows = [];
  const list = h("div", { class: "stack" });
  const draw = () => {
    const today = t35Ymd();
    const vis = rows.filter((r) => !u36Hidden("deadlines", r.id) && t35Inst(r.inst) && r.date && (!DL.inst || r.inst === DL.inst));
    const up = vis.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = vis.filter((r) => r.date < today).sort((a, b) => b.date.localeCompare(a.date));
    const card = (r) => {
      const n = t35DaysTo(r.date), i = t35Inst(r.inst), u = safeUrl(r.url);
      return h("article", { class: "card item u36-dl" + (n < 0 ? " past" : "") },
        h("div", { class: "row u36-dl-top" },
          h("div", { class: "t35-rem-date" }, h("b", { class: "num", text: r.date.slice(8) }), h("span", { text: new Date(r.date + "T00:00").toLocaleDateString("ar-EG", { month: "short" }) })),
          h("div", { style: "min-width:0;flex:1" }, h("h3", { text: r.title }), h("div", { class: "muted small", text: i.ar }), h("div", { class: "small", text: `${t35In(n)} · ${t35DateAr(r.date)}` })),
          n >= 0 && n <= 7 ? h("span", { class: "pill warn", text: "قريب" }) : null),
        r.note ? h("p", { class: "muted", text: r.note }) : null,
        h("div", { class: "meta" }, h("span", { text: "نشره " + nameOf(r.uid) }), h("span", { text: rel(r.createdAt) })),
        h("div", { class: "row" },
          u ? h("a", { class: "btn sm ghost", href: u, target: "_blank", rel: "noopener", text: "المصدر" }) : null,
          n >= 0 ? h("button", { class: "btn sm", type: "button", text: "أضف لتذكيراتي", onclick: () => t35AddReminder(`${r.title} · ${i.ar}`, r.date, u || "") }) : null,
          u36ReportBtn("deadlines", r), rowActions("deadlines", r)));
    };
    t35Fill(list, 
      up.length ? h("div", { class: "stack" }, ...up.map(card)) : empty(DL.inst ? "ما في مواعيد جاية لهاي المؤسسة" : "لسا ما في مواعيد", "شفت موعد تسجيل رسمي بموقع مؤسسة؟ أضفه مع رابط المصدر، وكل طلاب المدرسة بيستفيدوا."),
      past.length ? h("details", { class: "t35-past" }, h("summary", { text: `مواعيد فاتت (${past.length})` }), h("div", { class: "stack" }, ...past.slice(0, 20).map(card))) : null);
  };
  const f = h("form", { class: "form" },
    t35Field("المؤسسة", t35InstSelect("u36-dl-inst", DL.inst || t35Key(INST[0]))),
    t35Field("شو الموعد", h("input", { type: "text", id: "u36-dl-title", required: true, maxlength: 100, placeholder: "مثال: آخر موعد تسجيل لسمستر أ" })),
    t35Field("التاريخ", h("input", { type: "date", id: "u36-dl-date", required: true })),
    t35Field("رابط المصدر الرسمي (إجباري)", h("input", { type: "url", id: "u36-dl-url", required: true, maxlength: 300, placeholder: "https://" })),
    t35Field("ملاحظة (اختياري)", h("input", { type: "text", id: "u36-dl-note", maxlength: 200, placeholder: "مثال: لتخصصات الهندسة بس" }), "full"),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "انشر الموعد" }), h("span", { class: "muted small", text: "انشر بس مواعيد شفتها بموقع المؤسسة نفسها." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = safeUrl($("#u36-dl-url").value);
    if (!url) { toast("حط رابط المصدر الرسمي (يبدأ بـ https://)"); return; }
    const data = { uid: S.uid, inst: $("#u36-dl-inst").value, title: $("#u36-dl-title").value.trim(), date: $("#u36-dl-date").value, url, note: $("#u36-dl-note").value.trim(), createdAt: Date.now() };
    if (!data.title || !data.date) return;
    if (await addDoc("deadlines", data)) { f.reset(); toast("انشر الموعد، شكرًا"); }
  });
  const v = h("div", { class: "view" },
    head("قسم «جامعة»", "مواعيد التسجيل", "مواعيد تسجيل ومقابلات ومنح نشرها أعضاء المنصة، كل واحد مع رابط مصدره. أضف أي موعد لتذكيراتك الخاصة."),
    writeBanner(),
    h("div", { class: "banner warn" }, "المواعيد بتتغيّر وممكن تتمدّد. قبل ما تعتمد على موعد، افتح المصدر وتأكد."),
    h("section", { class: "section" },
      h("div", { class: "form" }, t35Field("اعرض مواعيد", t35InstSelect("u36-dl-filter", DL.inst, (e) => { DL.inst = e.target.value; draw(); }, "كل المؤسسات"))),
      list),
    h("section", { class: "card stack" }, h("h2", { text: "أضف موعد" }), S.canWrite && S.uid ? f : h("p", { class: "muted small", text: "لتنشر موعد لازم تكون مسجّل دخول ومعك صلاحية مشاركة." })),
  );
  onLeave(subscribe("deadlines", { limit: 300 }, (r) => { rows = r; resolveNames(r.map((x) => x.uid)); draw(); }));
  return v;
}

registerView("uni-compare", "uni", "قارن بين مؤسستين", u36CompareView, { order: 20 });
registerView("uni-reviews", "uni", "تجارب الطلاب", u36ReviewsView, { order: 30 });
registerView("uni-deadlines", "uni", "مواعيد التسجيل", u36DeadlinesView, { order: 40 });
registerSearch("جامعة", (q) => [
  ["uni-compare", "قارن بين مؤسستين", "مؤسستين جنب بعض: شروط، تخصصات، تسجيل", "مقارنه قارن"],
  ["uni-reviews", "تجارب الطلاب", "تقييمات وتجارب الخريجين لكل مؤسسة", "تقييم تجربه نجوم"],
  ["uni-deadlines", "مواعيد التسجيل", "مواعيد نشرها الأعضاء مع مصادرها", "موعد تسجيل اخر يوم"],
].filter(([, t, s, k]) => matches(`${t} ${s} ${k}`, q)).map(([go, title, sub]) => ({ title, sub, go })));
