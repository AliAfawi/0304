// ===== scholarships (ideas 143-151, 154, 156-158) – section «المنح» =====
const SCH_CATS = ["تفوّق", "اجتماعية", "مقابل تطوع", "سكن", "للطلاب العرب", "لطلاب النقب", "تخصص معيّن", "أخرى"];
const SCH_REGIONS = ["كل البلاد", ...REGIONS];
const SCH_FIELDS = ["كل التخصصات", "طب ومهن صحية", "هندسة وتكنولوجيا", "علوم", "تربية وتعليم", "علوم اجتماعية", "إنسانيات", "حقوق", "إدارة واقتصاد", "فنون وتصميم"];
const SCH_STATUS = ["بدّي أقدّم", "بجهّز الوثائق", "قدّمت", "انقبلت", "ما انقبلت"];
const SCH_DOCS = ["إثبات تسجيل للدراسة", "كشف علامات", "وثائق دخل العائلة", "صورة هوية مع الملحق", "رسالة شخصية", "توصية", "إثبات تطوع", "تأكيد التقديم"];
const schData = { rows: [], loaded: false };
const schState = { q: "", region: "all", field: "all", cat: "all", status: "open" };

HOOKS.boot.push(() => subscribe("scholarships", { limit: 400 }, (rows) => { schData.rows = rows; schData.loaded = true; schDrawList(); }));
HOOKS.lists.push(() => schDrawList());

// days left until the deadline (end of that day); null = no fixed deadline
function schDays(r) {
  if (!r.deadline) return null;
  const t = new Date(r.deadline + "T23:59:59").getTime();
  return isNaN(t) ? null : Math.ceil((t - Date.now()) / 86400000);
}
const schOpen = (r) => { const d = schDays(r); return d === null || d >= 0; };
function schBadge(r) {
  const d = schDays(r);
  if (d === null) return h("span", { class: "pill grey", text: "بدون موعد ثابت" });
  if (d < 0) return h("span", { class: "pill grey", text: "انتهى التقديم" });
  if (d === 0) return h("span", { class: "pill warn sch-soon", text: "آخر يوم اليوم" });
  if (d <= 14) return h("span", { class: "pill warn sch-soon", text: `قرّب الموعد · باقي ${d} يوم` });
  return h("span", { class: "pill good", text: "مفتوحة" });
}
const schDate = (s) => { try { return new Date(s + "T12:00:00").toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }); } catch { return s; } };

// shared form for admin add/edit, member suggestions and approve-with-edit
function schForm(idp, init, submitLabel, onSubmit) {
  const v = init || {};
  const f = h("form", { class: "form" },
    h("label", { class: "field full" }, h("span", { text: "اسم المنحة" }), h("input", { type: "text", id: idp + "-name", required: true, maxlength: 120, value: v.name || "" })),
    h("label", { class: "field" }, h("span", { text: "الجهة المانحة" }), h("input", { type: "text", id: idp + "-provider", maxlength: 100, value: v.provider || "" })),
    h("label", { class: "field" }, h("span", { text: "التصنيف" }), h("select", { id: idp + "-cat" }, SCH_CATS.map((c) => opt(c, c, v.cat === c)))),
    h("label", { class: "field full" }, h("span", { text: "لمين؟" }), h("input", { type: "text", id: idp + "-audience", maxlength: 200, value: v.audience || "", placeholder: "مثال: طلاب لقب أول من النقب، سنة أولى" })),
    h("label", { class: "field" }, h("span", { text: "المنطقة" }), h("select", { id: idp + "-region" }, SCH_REGIONS.map((r) => opt(r, r, v.region === r)))),
    h("label", { class: "field" }, h("span", { text: "مجال الدراسة" }), h("select", { id: idp + "-field" }, SCH_FIELDS.map((r) => opt(r, r, v.field === r)))),
    h("label", { class: "field" }, h("span", { text: "المبلغ (كما بالمصدر)" }), h("input", { type: "text", id: idp + "-amount", maxlength: 80, value: v.amount || "", placeholder: "مثال: حسب المصدر، بتتغير كل سنة" })),
    h("label", { class: "field" }, h("span", { text: "آخر موعد (اختياري)" }), h("input", { type: "date", id: idp + "-deadline", value: v.deadline || "" })),
    h("label", { class: "field full" }, h("span", { text: "رابط المصدر الرسمي (إجباري)" }), h("input", { type: "url", id: idp + "-link", required: true, maxlength: 400, value: v.link || "", placeholder: "https://" })),
    h("label", { class: "field full" }, h("span", { text: "ملاحظة عن المصدر" }), h("input", { type: "text", id: idp + "-source", maxlength: 200, value: v.source || "", placeholder: "مثال: من موقع الجهة، فحصت بتاريخ…" })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: submitLabel })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const g = (k) => $("#" + idp + "-" + k, f).value.trim();
    const link = safeUrl(g("link"));
    if (!link) { toast("الرابط لازم يبلّش بـ https://"); return; }
    const data = { name: g("name"), provider: g("provider"), cat: g("cat"), audience: g("audience"), region: g("region"), field: g("field"), amount: g("amount"), deadline: g("deadline"), link, source: g("source") };
    if (!data.name) return;
    if (await onSubmit(data)) f.reset();
  });
  return f;
}
function schEdit(r) {
  const close = modal("تعديل منحة", schForm("sch-ed", r, "احفظ", async (d) => {
    const ok = await setDoc("scholarships", r.id, { ...r, ...d, id: undefined, updatedAt: Date.now() });
    if (ok) { close(); toast("انحفظت"); } return ok;
  }));
}
function schCard(r) {
  const link = safeUrl(r.link);
  return h("article", { class: "card item sch-card" + (schDays(r) !== null && schDays(r) >= 0 && schDays(r) <= 14 ? " sch-hot" : "") },
    h("div", { class: "row" }, schBadge(r), r.cat ? h("span", { class: "pill", text: r.cat }) : null),
    h("h3", { text: r.name }),
    r.provider ? h("div", { class: "muted small", text: r.provider }) : null,
    h("dl", { class: "sch-dl" },
      r.audience ? [h("dt", { text: "لمين" }), h("dd", { text: r.audience })] : null,
      [h("dt", { text: "المنطقة" }), h("dd", { text: r.region || "كل البلاد" })],
      [h("dt", { text: "المجال" }), h("dd", { text: r.field || "كل التخصصات" })],
      r.amount ? [h("dt", { text: "المبلغ" }), h("dd", { text: r.amount })] : null,
      [h("dt", { text: "آخر موعد" }), h("dd", { text: r.deadline ? schDate(r.deadline) : "مش محدّد، افحص بالمصدر" })]),
    r.source ? h("p", { class: "muted small", text: r.source }) : null,
    h("div", { class: "row" },
      link ? h("a", { class: "btn sm blue", href: link, target: "_blank", rel: "noopener", text: "المصدر الرسمي" }) : null,
      S.uid ? h("button", { class: "btn sm ghost", type: "button", onclick: () => schTrack(r), text: "تابع طلبي" }) : null,
      S.isAdmin ? h("button", { class: "link small", type: "button", onclick: () => schEdit(r), text: "تعديل" }) : null,
      S.isAdmin ? rowActions("scholarships", r) : null));
}
async function schTrack(r) {
  if (!guardWrite()) return;
  const ok = await addDoc(myCol(), { kind: "schapp", uid: S.uid, name: r.name, schId: r.id, link: safeUrl(r.link) || "", deadline: r.deadline || "", status: SCH_STATUS[0], docs: [], note: "", createdAt: Date.now() });
  if (ok) toast("انضافت لمتابعة طلباتك بمساحتي");
}

// ---------- «كل المنح» landing ----------
registerView("grants", "grants", "كل المنح", () => {
  const visible = schData.rows;
  const open = visible.filter(schOpen).length, soon = visible.filter((r) => { const d = schDays(r); return d !== null && d >= 0 && d <= 14; }).length;
  const filters = h("div", { class: "section" },
    h("div", { class: "form" },
      h("label", { class: "field" }, h("span", { text: "بحث" }), h("input", { type: "search", id: "sch-q", value: schState.q, placeholder: "اسم منحة، جهة، أو كلمة" })),
      h("label", { class: "field" }, h("span", { text: "المنطقة" }), h("select", { id: "sch-region" }, opt("all", "كل المناطق", schState.region === "all"), SCH_REGIONS.map((r) => opt(r, r, schState.region === r)))),
      h("label", { class: "field" }, h("span", { text: "المجال" }), h("select", { id: "sch-field" }, opt("all", "كل المجالات", schState.field === "all"), SCH_FIELDS.map((r) => opt(r, r, schState.field === r)))),
      h("label", { class: "field" }, h("span", { text: "التصنيف" }), h("select", { id: "sch-cat" }, opt("all", "كل التصنيفات", schState.cat === "all"), SCH_CATS.map((r) => opt(r, r, schState.cat === r))))),
    h("div", { class: "chips", id: "sch-status" }, [["open", "مفتوحة"], ["soon", "قرّب موعدها"], ["closed", "انتهت"], ["all", "الكل"]].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(schState.status === k),
      onclick: (e) => { schState.status = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); schDrawList(); }, text: l }))),
    h("p", { class: "muted small", id: "sch-count" }),
    h("div", { class: "grid", id: "sch-list" }));
  const v = h("div", { class: "view" },
    h("section", { class: "section" },
      eyebrow("المنح والمساعدات"),
      h("h1", { text: "منح للطلاب، بمكان واحد" }),
      h("p", { class: "lede", text: "قاعدة منح بتحدّثها إدارة المنصة، مع مواعيد التقديم وتنبيه لما يقرّب الموعد. ولكل منحة رابط لمصدرها الرسمي: الشروط والمبالغ بتتغير كل سنة، فافحص هناك قبل ما تقدّم." }),
      h("div", { class: "row" },
        h("button", { class: "btn blue", type: "button", "data-go": "grants-apply", text: "كيف أقدّم؟" }),
        h("button", { class: "btn ghost", type: "button", "data-go": "my-apps", text: "متابعة طلباتي" }),
        h("button", { class: "btn ghost", type: "button", "data-go": "grants-suggest", text: "بعرف منحة" }))),
    h("section", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { id: "sch-n-all", text: visible.length }), h("span", { text: "منحة بالقاعدة" })),
      h("div", { class: "stat" }, h("b", { id: "sch-n-open", text: open }), h("span", { text: "مفتوحة هلّق" })),
      h("div", { class: "stat" }, h("b", { id: "sch-n-soon", text: soon }), h("span", { text: "قرّب موعدها" }))),
    h("section", { class: "section" },
      h("div", { class: "spread" }, h("h2", { text: "مصادر عامة" }), h("span", { class: "muted small", text: "نقطة بداية ثابتة، مش منح بموعد محدّد" })),
      h("div", { class: "sch-sources" }, SCHOLARSHIPS.map(([t, d, u]) => h("div", { class: "plain item sch-source" },
        h("h3", { text: t }), h("p", { class: "muted small", text: d }),
        u.startsWith("#") ? h("button", { class: "link", type: "button", "data-go": u.slice(1), text: "افتح قسم جامعة" }) : h("a", { href: u, target: "_blank", rel: "noopener", text: "افتح" }))))),
    h("section", { class: "section" },
      h("h2", { text: "قاعدة المنح" }),
      S.isAdmin ? h("details", { class: "card" }, h("summary", { class: "btn sm ghost", style: "width:max-content", text: "+ أضف منحة (للإدارة)" }),
        h("div", { style: "margin-top:12px" }, schForm("sch-add", null, "أضف للقاعدة", (d) => addDoc("scholarships", { ...d, uid: S.uid, createdAt: Date.now() }).then((ok) => { ok && toast("انضافت"); return ok; })))) : null,
      filters),
    h("section", { class: "plain spread sch-workshop" },
      h("div", null, h("h3", { text: "ورشة تعبئة طلبات المنح" }), h("p", { class: "muted small", text: "مرة بالسنة، قبل موسم المنح: خريجين بيساعدوا الطلاب يعبّوا الطلبات ويكتبوا الرسائل. الموعد بينتشر بقسم الفعاليات." })),
      h("button", { class: "btn sm", type: "button", onclick: () => go("events"), text: "للفعاليات" })),
  );
  queueMicrotask(() => {
    const on = (id, ev, k) => { const el = $(id); el && el.addEventListener(ev, (e) => { schState[k] = e.target.value; schDrawList(); }); };
    on("#sch-q", "input", "q"); on("#sch-region", "change", "region"); on("#sch-field", "change", "field"); on("#sch-cat", "change", "cat");
    schDrawList();
  });
  return v;
}, { order: 10 });

function schDrawList() {
  const box = $("#sch-list"); if (!box) return;
  const q = schState.q.trim();
  const rows = schData.rows.filter((r) => {
    const d = schDays(r);
    if (schState.status === "open" && !schOpen(r)) return false;
    if (schState.status === "closed" && schOpen(r)) return false;
    if (schState.status === "soon" && !(d !== null && d >= 0 && d <= 14)) return false;
    if (schState.region !== "all" && r.region !== schState.region && r.region !== "كل البلاد") return false;
    if (schState.field !== "all" && r.field !== schState.field && r.field !== "كل التخصصات") return false;
    if (schState.cat !== "all" && r.cat !== schState.cat) return false;
    return matches([r.name, r.provider, r.audience, r.source, r.cat].join(" "), q);
  }).sort((a, b) => {
    const da = schDays(a), db_ = schDays(b);
    const ka = da === null ? 1e6 : da < 0 ? 2e6 - da : da, kb = db_ === null ? 1e6 : db_ < 0 ? 2e6 - db_ : db_;
    return ka - kb;
  });
  const setN = (id, n) => { const el = $(id); if (el) el.textContent = n; };
  setN("#sch-n-all", schData.rows.length); setN("#sch-n-open", schData.rows.filter(schOpen).length);
  setN("#sch-n-soon", schData.rows.filter((r) => { const d = schDays(r); return d !== null && d >= 0 && d <= 14; }).length);
  const c = $("#sch-count"); if (c) c.textContent = schData.rows.length ? `${rows.length} منحة` : "";
  if (rows.length) { box.replaceChildren(...rows.map(schCard)); return; }
  box.replaceChildren(schData.rows.length
    ? empty("ما في منح بهالفلتر", "جرّب «الكل» أو شيل فلتر المنطقة والمجال.")
    : empty("قاعدة المنح لسا فاضية", S.isAdmin ? "أضف أول منحة من «أضف منحة»، مع رابط المصدر الرسمي." : "الإدارة بتضيف منح مع مصادرها. بتعرف منحة؟ اقترحها من «بعرف منحة»، وبالأثناء ابدأ من المصادر العامة فوق."));
}

registerSearch("المنح", (q) => [
  ...schData.rows.filter((r) => matches([r.name, r.provider, r.audience, r.cat].join(" "), q)).map((r) => ({ title: r.name, sub: [r.provider, r.deadline ? schDate(r.deadline) : ""].filter(Boolean).join(" · "), go: "grants", onOpen: () => { schState.q = r.name; schState.status = "all"; go("grants"); } })),
  ...SCHOLARSHIPS.filter(([t, d]) => matches(t + " " + d, q)).map(([t]) => ({ title: t, sub: "مصدر عام", go: "grants" })),
].slice(0, 8));

registerHome(() => {
  const soon = schData.rows.filter((r) => { const d = schDays(r); return d !== null && d >= 0 && d <= 14; }).sort((a, b) => schDays(a) - schDays(b)).slice(0, 3);
  if (!soon.length) return null;
  return h("section", { class: "section" },
    h("div", { class: "spread" }, h("h2", { text: "منح قرّب موعدها" }), h("button", { class: "link", type: "button", onclick: () => { schState.status = "soon"; go("grants"); }, text: "كل المنح" })),
    h("div", { class: "stack" }, soon.map((r) => h("div", { class: "plain spread sch-home" },
      h("div", { style: "min-width:0" }, h("b", { text: r.name }), h("div", { class: "muted small", text: r.provider || "" })),
      schBadge(r)))));
}, 36);

// ---------- «كيف أقدّم» (146, 147) ----------
const SCH_LETTERS = [
  { t: "رسالة شخصية لمنحة اجتماعية", body: `لجنة المنح المحترمة في [اسم الجهة]،

اسمي [الاسم الكامل]، من [البلد]، وأدرس [التخصص] في [المؤسسة]، السنة [رقم السنة].

أتقدّم بطلب لمنحة [اسم المنحة] لأن [سبب واضح وقصير: وضع العائلة الاقتصادي، عدد الإخوة الذين يدرسون، بُعد السكن…].

اخترت هذا التخصص لأن [سبب شخصي محدّد]. خلال السنة الماضية [إنجاز أو جهد: علامات، عمل إلى جانب الدراسة، مسؤولية في البيت].

ستساعدني المنحة على [كيف بالضبط: تغطية جزء من الرسوم، تقليل ساعات العمل والتركيز على الدراسة، السكن قرب الحرم].

أرفقت الوثائق المطلوبة: [قائمة الوثائق].

شكرًا لوقتكم واهتمامكم،
[الاسم] · [رقم الهوية إذا طُلب] · [وسيلة تواصل]` },
  { t: "رسالة لمنحة مقابل تطوع", body: `إلى [اسم الجهة / البرنامج]،

أنا [الاسم الكامل]، طالب/ة [التخصص] في [المؤسسة].

أرغب بالانضمام إلى [اسم البرنامج] لأن العمل مع [الأطفال / الطلاب / المجتمع] قريب مني: [تجربة سابقة محدّدة في تطوع أو إرشاد أو مساعدة].

أستطيع الالتزام بـ[عدد الساعات أو الأيام] أسبوعيًا، في [المنطقة أو البلد]. أتحدث العربية والعبرية [والإنجليزية]، وهذا يساعدني في [مثال].

ما أطمح إليه من هذه التجربة: [ما ستتعلّمه أو تقدّمه].

مع الاحترام،
[الاسم] · [وسيلة تواصل]` },
  { t: "طلب رسالة توصية من محاضر أو معلم", body: `مرحبا [اسم المحاضر/ة أو المعلم/ة]،

أنا [الاسم]، كنت في [اسم المساق / الصف] في [الفصل أو السنة]، وحصلت على [العلامة إذا كانت مفيدة].

أتقدّم لمنحة [اسم المنحة]، والجهة تطلب رسالة توصية حتى تاريخ [الموعد].

هل تستطيع/ين كتابة توصية قصيرة؟ أرفقت ملخصًا عني: ما أدرسه، وسبب التقديم، ونقاط قد تساعد في الرسالة.

طريقة الإرسال المطلوبة: [رابط / إيميل الجهة / ملف أرفعه بنفسي].

شكرًا جزيلًا،
[الاسم] · [وسيلة تواصل]` },
];
async function schCopy(text) {
  try { await navigator.clipboard.writeText(text); toast("انسخت"); } catch { toast("ما قدرت أنسخ، حدّد النص وانسخه يدويًا"); }
}
registerView("grants-apply", "grants", "كيف أقدّم", () => {
  const g = GD_BY_ID["sch-apply"];
  const done = new Set(gdDone(g.id));
  return h("div", { class: "view" },
    head("كيف أقدّم", "طلب منحة خطوة بخطوة", "الخطوات هي هي تقريبًا بكل منحة. جهّز ملف ثابت مرة وحدة، وكل طلب بعده بياخذ دقائق."),
    h("section", { class: "section" },
      h("ol", { class: "sch-steps" }, g.sections.map((s) => h("li", { class: "card stack" }, h("h3", { text: s.h.replace(/^\d+\.\s*/, "") }), ...s.body.map(gdBlock)))),
      h("div", { class: "row" },
        h("button", { class: "btn sm", type: "button", onclick: () => gdOpen(g.id), text: `قائمة الخطوات (${done.size}/${g.steps.length})` }),
        h("button", { class: "btn sm ghost", type: "button", "data-go": "my-apps", text: "متابعة طلباتي" }))),
    h("section", { class: "section" },
      h("h2", { text: "نماذج رسائل" }),
      h("p", { class: "muted", text: "نماذج عامة فيها فراغات بين [ ]. عبّيها بكلامك وتفاصيلك الحقيقية: اللجان بتميّز الرسالة المنسوخة. إذا الجهة بتطلب عبري، ترجم بعد ما تكتب الأفكار." }),
      h("div", { class: "stack" }, SCH_LETTERS.map((l, i) => h("details", { class: "card sch-letter" },
        h("summary", null, h("b", { text: l.t })),
        h("pre", { class: "sch-pre", id: "sch-letter-" + i, text: l.body }),
        h("div", { class: "row" },
          h("button", { class: "btn sm", type: "button", onclick: () => schCopy(l.body), text: "انسخ" }),
          h("button", { class: "btn sm ghost", type: "button", onclick: () => saveFile(`نموذج-رسالة-${i + 1}.txt`, l.body), text: "نزّل" })))))),
    h("section", { class: "plain spread" },
      h("div", null, h("h3", { text: "بدك مساعدة بالكتابة؟" }), h("p", { class: "muted small", text: "بأدوات المنصة في مساعد بيساعدك تصيغ رسالة من تفاصيلك." })),
      h("button", { class: "btn sm ghost", type: "button", "data-go": "tools", text: "للأدوات" })),
  );
}, { order: 20 });

// ---------- «اقترح منحة» (143: member suggestions → admin approval) ----------
registerView("grants-suggest", "grants", "اقترح منحة", () => {
  const list = h("div", { class: "stack", id: "sch-sugg" });
  let rows = [];
  const draw = () => {
    const shown = S.isAdmin ? rows : rows.filter((r) => r.uid === S.uid);
    list.replaceChildren(
      h("h2", { text: S.isAdmin ? `اقتراحات بانتظار المراجعة (${shown.length})` : "اقتراحاتك" }),
      ...(shown.length ? shown.map((r) => h("article", { class: "card item" },
        h("div", { class: "row" }, h("span", { class: "pill warn", text: "بانتظار المراجعة" }), r.cat ? h("span", { class: "pill", text: r.cat }) : null),
        h("h3", { text: r.name }),
        h("p", { class: "muted small", text: [r.provider, r.audience, r.deadline ? schDate(r.deadline) : ""].filter(Boolean).join(" · ") }),
        safeUrl(r.link) ? h("a", { href: safeUrl(r.link), target: "_blank", rel: "noopener", class: "small", text: "رابط المصدر" }) : null,
        S.isAdmin ? gdWho(r.uid, r.createdAt) : null,
        h("div", { class: "row" },
          S.isAdmin ? h("button", { class: "btn sm blue", type: "button", onclick: () => {
            const close = modal("راجع وأضف للقاعدة", schForm("sch-ap", r, "أضف للقاعدة", async (d) => {
              const ok = await addDoc("scholarships", { ...d, uid: S.uid, suggestedBy: r.uid, createdAt: Date.now() });
              if (ok) { await delDoc("scholarship_suggestions", r.id); if (r.uid !== S.uid) addDoc("notes", { to: r.uid, from: S.uid, kind: "scholarship", text: "انضافت المنحة اللي اقترحتها: " + d.name, go: "grants", createdAt: Date.now() }); close(); }
              return ok;
            }));
          }, text: "راجع وأضف" }) : null,
          rowActions("scholarship_suggestions", r))))
        : [empty(S.isAdmin ? "ما في اقتراحات جديدة" : "لسا ما اقترحت منح", S.isAdmin ? "لما يقترح عضو منحة بتظهر هون." : "عبّي النموذج فوق. الإدارة بتفحص المصدر وبتضيفها للقاعدة.")]));
  };
  onLeave(subscribe("scholarship_suggestions", { limit: 200 }, (r) => { rows = r; resolveNames(r.map((x) => x.uid)); draw(); }));
  return h("div", { class: "view" },
    head("اقترح منحة", "بتعرف منحة مش موجودة؟", "عبّي التفاصيل مع رابط المصدر الرسمي. الإدارة بتفحصها قبل ما تنضاف للقاعدة، عشان تظل المعلومات موثوقة."),
    writeBanner(),
    h("div", { class: "card" }, schForm("sch-sg", null, "أرسل الاقتراح", async (d) => {
      if (!guardWrite() || !needProfile()) return false;
      const ok = await addDoc("scholarship_suggestions", { ...d, uid: S.uid, createdAt: Date.now() });
      if (ok) toast("وصل الاقتراح، شكرًا"); return ok;
    })),
    list);
}, { order: 30 });

// ---------- «تبادل وتبرّع» (150, 151) ----------
const SCH_X_CATS = ["كتب جامعية", "حاسوب أو لابتوب", "آلة حاسبة ومعدات", "أخرى"];
const SCH_X_COND = ["جديد", "ممتاز", "منيح", "بحاجة تصليح"];
const schX = { type: "all", cat: "all" };
registerView("grants-exchange", "grants", "تبادل وتبرّع", () => {
  let rows = [];
  const list = h("div", { class: "grid" });
  const draw = () => {
    const shown = rows.filter((r) => !isMod("hidden", "exchange:" + r.id) && (schX.type === "all" || r.type === schX.type) && (schX.cat === "all" || r.cat === schX.cat));
    list.replaceChildren(...(shown.length ? shown.map((r) => h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: r.type === "offer" ? "pill good" : "pill warn", text: r.type === "offer" ? "بتبرّع / ببدّل" : "بدوّر على" }), h("span", { class: "pill grey", text: r.cat })),
      h("h3", { text: r.item }),
      h("div", { class: "meta" }, r.condition ? h("span", { text: "الحالة: " + r.condition }) : null, r.town ? h("span", { text: r.town }) : null),
      r.note ? h("p", { class: "muted", text: r.note }) : null,
      gdWho(r.uid, r.createdAt),
      r.contact ? h("span", { class: "small" }, "تواصل: ", h("b", { text: r.contact })) : null,
      h("div", { class: "row" }, gdReportBtn("exchange", r.id), rowActions("exchange", r))))
      : [empty("اللوح فاضي", "عندك كتب أو جهاز ما بتحتاجه؟ أو بتدوّر على شي؟ أضف أول إعلان.")]));
  };
  const f = h("form", { class: "card form" },
    h("label", { class: "field" }, h("span", { text: "شو بدك؟" }), h("select", { id: "sch-x-type" }, opt("offer", "عندي شي بتبرّع فيه أو ببدّله"), opt("request", "بدوّر على شي"))),
    h("label", { class: "field" }, h("span", { text: "التصنيف" }), h("select", { id: "sch-x-cat" }, SCH_X_CATS.map((c) => opt(c)))),
    h("label", { class: "field full" }, h("span", { text: "الغرض" }), h("input", { type: "text", id: "sch-x-item", required: true, maxlength: 120, placeholder: "مثال: كتاب حسبان 1، أو لابتوب للدراسة" })),
    h("label", { class: "field" }, h("span", { text: "الحالة" }), h("select", { id: "sch-x-cond" }, opt("", "—"), SCH_X_COND.map((c) => opt(c)))),
    h("label", { class: "field" }, h("span", { text: "البلد" }), h("input", { type: "text", id: "sch-x-town", maxlength: 40 })),
    h("label", { class: "field full" }, h("span", { text: "طريقة تواصل" }), h("input", { type: "text", id: "sch-x-contact", maxlength: 80, placeholder: "إنستغرام أو إيميل" })),
    h("label", { class: "field full" }, h("span", { text: "تفاصيل (اختياري)" }), h("input", { type: "text", id: "sch-x-note", maxlength: 300 })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const data = { uid: S.uid, type: $("#sch-x-type").value, cat: $("#sch-x-cat").value, item: $("#sch-x-item").value.trim(), condition: $("#sch-x-cond").value, town: $("#sch-x-town").value.trim(), contact: $("#sch-x-contact").value.trim(), note: $("#sch-x-note").value.trim(), createdAt: Date.now() };
    if (!data.item) return;
    if (await addDoc("exchange", data)) { f.reset(); toast("انتشر"); }
  });
  onLeave(subscribe("exchange", { limit: 300 }, (r) => { rows = r; resolveNames(r.map((x) => x.uid)); draw(); }));
  const chips = (arr, key) => h("div", { class: "chips" }, arr.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(schX[key] === k),
    onclick: (e) => { schX[key] = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); draw(); }, text: l })));
  return h("div", { class: "view" },
    head("تبادل وتبرّع", "كتب وأجهزة بتنتقل من فوج لفوج", "كتاب خلّصت منه أو لابتوب قديم ممكن يفرق كثير مع طالب جديد. المنصة بتعرض الإعلان بس، والتواصل والتسليم بينكم مباشرة."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ أضف إعلان" }), f),
    h("p", { class: "banner", text: "لا تبعت مصاري مسبقًا لحدا ما بتعرفه، وسلّموا بمكان عام. امسح ملفاتك الشخصية من أي جهاز قبل ما تتبرّع فيه." }),
    chips([["all", "الكل"], ["offer", "عروض"], ["request", "طلبات"]], "type"),
    chips([["all", "كل التصنيفات"], ...SCH_X_CATS.map((c) => [c, c])], "cat"),
    list);
}, { order: 40 });

// ---------- «ادعم طالب» pledge board (148, 149) ----------
const SCH_PLEDGE = ["منحة الفوج: دعم طالب من الفوج الجديد", "صندوق منح الخريجين", "إرشاد طالب بطلب المنح", "كتب أو جهاز لطالب"];
registerView("grants-pledge", "grants", "ادعم طالب", () => {
  let rows = [];
  const board = h("div", { class: "stack" });
  const draw = () => {
    const shown = rows.filter((r) => !isMod("hidden", "pledges:" + r.id));
    const byYear = {}; shown.forEach((r) => (byYear[r.year || "—"] ||= []).push(r));
    board.replaceChildren(
      h("h2", { text: "لوح التعهّدات" }),
      shown.length ? h("div", { class: "sch-cohorts" }, Object.keys(byYear).sort((a, b) => b - a).map((y) => h("div", { class: "stat" }, h("b", { text: byYear[y].length }), h("span", { text: y === "—" ? "بدون فوج" : "فوج " + y })))) : null,
      ...(shown.length ? shown.map((r) => h("article", { class: "plain item" },
        h("div", { class: "row" }, h("span", { class: "pill", text: r.kind }), r.year ? h("span", { class: "pill grey", text: "فوج " + r.year }) : null),
        r.note ? h("p", { text: r.note }) : null,
        gdWho(r.uid, r.createdAt),
        h("div", { class: "row" }, gdReportBtn("pledges", r.id), rowActions("pledges", r))))
        : [empty("لسا ما في تعهّدات", "كن أول خريج بيتعهّد. تعهّدك بيشجّع فوجك.")]));
  };
  const years = []; for (let y = THIS_YEAR; y >= 1990; y--) years.push(y);
  const f = h("form", { class: "card form" },
    h("label", { class: "field full" }, h("span", { text: "نوع الدعم" }), h("select", { id: "sch-p-kind" }, SCH_PLEDGE.map((k) => opt(k)))),
    h("label", { class: "field" }, h("span", { text: "فوجك" }), h("select", { id: "sch-p-year" }, years.map((y) => opt(y, String(y), S.alumni[S.uid]?.year == y)))),
    h("label", { class: "field full" }, h("span", { text: "كلمة (اختياري)" }), h("input", { type: "text", id: "sch-p-note", maxlength: 240, placeholder: "مثال: جاهز أساعد طالب بطلبات المنح كل سنة" })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "سجّل تعهّدي" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    if (await addDoc("pledges", { uid: S.uid, kind: $("#sch-p-kind").value, year: +$("#sch-p-year").value, note: $("#sch-p-note").value.trim(), createdAt: Date.now() })) { f.reset(); toast("شكرًا، انسجّل تعهّدك"); }
  });
  onLeave(subscribe("pledges", { limit: 300 }, (r) => { rows = r; resolveNames(r.map((x) => x.uid)); draw(); }));
  return h("div", { class: "view" },
    head("ادعم طالب", "الخريجين بيدعموا اللي وراهم", "فكرتين بسيطات: صندوق منح بيموّله خريجو المدرسة، وكل فوج بيتبنّى طالب من الفوج الجديد. هون بتسجّل نيّتك، والتنسيق بيصير مع إدارة المدرسة."),
    h("div", { class: "grid" },
      h("div", { class: "card stack" }, h("h3", { text: "صندوق منح الخريجين" }), h("p", { class: "muted", text: "خريجين من كل الأفواج بيساهموا، ولجنة من المدرسة والخريجين بتختار طلاب حسب معايير واضحة ومعلنة. الشفافية أهم شي: مين بيقرّر، وكيف." })),
      h("div", { class: "card stack" }, h("h3", { text: "منحة الفوج" }), h("p", { class: "muted", text: "كل فوج بيجمع بين أفراده لدعم طالب واحد من الفوج اللي بيتخرّج هالسنة: منحة، كتب، جهاز، أو مرافقة بالسنة الأولى." }))),
    h("p", { class: "banner warn", text: "التعهّد هون نيّة فقط. المنصة ما بتجمع مصاري ولا بتطلب تفاصيل دفع. أي تبرّع فعلي بيصير عن طريق المدرسة أو جهة رسمية بتنسّقها الإدارة." }),
    writeBanner(), f, board);
}, { order: 50 });

// ---------- private application tracker (158) – section «مساحتي» ----------
registerView("my-apps", "me", "طلبات المنح", () => {
  const list = h("div", { class: "stack" });
  let rows = [];
  const save = (r, patch) => setDoc(myCol(), r.id, { ...r, ...patch, id: undefined, updatedAt: Date.now() });
  const draw = () => {
    if (!rows.length) { list.replaceChildren(empty("ما في طلبات لسا", "أضف منحة بدك تقدّم عليها، أو اكبس «تابع طلبي» على أي منحة بقسم المنح.")); return; }
    list.replaceChildren(...rows.map((r) => {
      const docs = new Set(r.docs || []); const link = safeUrl(r.link);
      return h("article", { class: "card item" },
        h("div", { class: "spread" }, h("h3", { text: r.name }), r.deadline ? schBadge(r) : null),
        h("div", { class: "form" },
          h("label", { class: "field" }, h("span", { text: "الحالة" }), h("select", { id: "sch-t-st-" + r.id, onchange: (e) => save(r, { status: e.target.value }) }, SCH_STATUS.map((s) => opt(s, s, r.status === s)))),
          h("label", { class: "field" }, h("span", { text: "آخر موعد" }), h("input", { type: "date", id: "sch-t-dl-" + r.id, value: r.deadline || "", onchange: (e) => save(r, { deadline: e.target.value }) })),
          h("label", { class: "field" }, h("span", { text: "تاريخ التقديم" }), h("input", { type: "date", id: "sch-t-sub-" + r.id, value: r.submitted || "", onchange: (e) => save(r, { submitted: e.target.value }) }))),
        h("details", null, h("summary", { class: "link small", text: `الوثائق (${docs.size}/${SCH_DOCS.length})` }),
          h("div", { class: "sch-docs" }, SCH_DOCS.map((d, i) => h("label", { class: "check" }, h("input", { type: "checkbox", id: `sch-t-doc-${r.id}-${i}`, checked: docs.has(d) ? true : null, onchange: (e) => { e.target.checked ? docs.add(d) : docs.delete(d); save(r, { docs: [...docs] }); } }), d)))),
        h("label", { class: "field" }, h("span", { text: "ملاحظات" }), h("input", { type: "text", id: "sch-t-note-" + r.id, maxlength: 300, value: r.note || "", onchange: (e) => save(r, { note: e.target.value.trim() }) })),
        h("div", { class: "row" }, link ? h("a", { class: "small", href: link, target: "_blank", rel: "noopener", text: "رابط المنحة" }) : null,
          h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تحذف هذا الطلب من المتابعة؟", () => delDoc(myCol(), r.id)), text: "حذف" })));
    }));
  };
  const f = h("form", { class: "card form" },
    h("label", { class: "field" }, h("span", { text: "اسم المنحة" }), h("input", { type: "text", id: "sch-t-name", required: true, maxlength: 120, list: "sch-t-names" })),
    h("label", { class: "field" }, h("span", { text: "آخر موعد" }), h("input", { type: "date", id: "sch-t-deadline" })),
    h("label", { class: "field" }, h("span", { text: "رابط (اختياري)" }), h("input", { type: "url", id: "sch-t-link", maxlength: 400, placeholder: "https://" })),
    h("div", { class: "field" }, h("span", { text: " " }), h("button", { class: "btn blue", type: "submit", text: "أضف للمتابعة" })),
    h("datalist", { id: "sch-t-names" }, schData.rows.map((r) => opt(r.name))));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite()) return;
    const name = $("#sch-t-name").value.trim(); if (!name) return;
    const known = schData.rows.find((r) => r.name === name);
    if (await addDoc(myCol(), { kind: "schapp", uid: S.uid, name, schId: known?.id || "", link: safeUrl($("#sch-t-link").value) || safeUrl(known?.link) || "", deadline: $("#sch-t-deadline").value || known?.deadline || "", status: SCH_STATUS[0], docs: [], note: "", createdAt: Date.now() })) { f.reset(); toast("انضافت"); }
  });
  if (S.uid) onLeave(subscribe(myCol(), { limit: 300 }, (all) => { rows = all.filter((r) => r.kind === "schapp"); draw(); }));
  return h("div", { class: "view" },
    head("مساحتي", "متابعة طلبات المنح", "كل منحة قدّمت أو بدك تقدّم عليها: الحالة، المواعيد، والوثائق. هالقائمة خاصة فيك، ما حدا غيرك بيشوفها."),
    S.uid ? f : h("p", { class: "banner warn", text: "لازم تسجّل دخول عشان تحفظ طلباتك." }),
    S.uid ? list : null,
    h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", "data-go": "grants", text: "تصفّح المنح" }), h("button", { class: "btn sm ghost", type: "button", "data-go": "grants-apply", text: "كيف أقدّم" })));
}, { order: 60 });
