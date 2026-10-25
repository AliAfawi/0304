// ===== 35 · tools & AI team: «اسأل Claude», calculators, planners, generators =====
// Private data lives in myCol() with a `kind` field starting with "p35-". Per-browser drafts use lsGet/lsSet("p35:…").

// ---------- shared helpers ----------
function t35Key(i) { let x = 5381; for (const c of i.he) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return "in" + x.toString(36); }
const t35Inst = (key) => INST.find((i) => t35Key(i) === key) || null;
function t35InstSelect(id, val, onchange, allLabel) {
  const groups = Object.entries(TYPES).map(([t, label]) => h("optgroup", { label: label === "كلية" ? "كليات" : label === "جامعة" ? "جامعات" : "هندسائيين" },
    INST.filter((i) => i.t === t).map((i) => opt(t35Key(i), i.ar, t35Key(i) === val))));
  return h("select", { id, onchange }, allLabel ? opt("", allLabel, !val) : null, groups);
}
function t35Field(label, control, cls) { return h("label", { class: "field" + (cls ? " " + cls : "") }, h("span", { text: label }), control); }
function t35Esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function t35Ymd(d = new Date()) { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function t35DateAr(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function t35DaysTo(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  const a = new Date(y, m - 1, d), b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}
function t35In(n) { return n === 0 ? "اليوم" : n === 1 ? "بكرا" : n > 1 ? `بعد ${n} يوم` : n === -1 ? "مبارح" : `قبل ${-n} يوم`; }
const t35N = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
// Text with clickable official links, without Markdown leftovers.
function t35Rich(el, text) {
  const clean = String(text || "").replace(/\*\*/g, "").replace(/^#{1,4}\s*/gm, "");
  el.replaceChildren(...clean.split(/(https?:\/\/[^\s)»"،]+)/g).map((part, k) => {
    if (k % 2 === 0) return part;
    const u = safeUrl(part.replace(/[.,;:]+$/, ""));
    return u ? h("a", { href: u, target: "_blank", rel: "noopener", text: part }) : part;
  }));
}
// Note shown wherever a feature needs Claude; hidden by the HOOKS.lists refresh once CAP.sample arrives.
function t35AiGate(what) {
  return h("div", { class: "banner t35-aigate", hidden: CAP.sample ? true : null },
    h("span", null, h("b", { text: "هاي الميزة بتحتاج المساعد الذكي. " }), what || "بتشتغل لما تفتح المنصة من رابطها على claude.ai وتسمح لـ Claude يجاوب. كل الباقي بالصفحة بيشتغل بدونه."));
}
HOOKS.lists.push(() => document.querySelectorAll(".t35-aigate").forEach((el) => (el.hidden = !!CAP.sample)));
// One Claude call with "thinking" placeholder, streaming, Stop and errors. out: div or textarea.
async function t35Ai({ prompt, out, btn, stop, onDone, tier }) {
  const set = (t) => (out.tagName === "TEXTAREA" ? (out.value = t) : t35Rich(out, t));
  if (!CAP.sample) { set(aiError({ code: "not_granted" })); return; }
  const ctl = new AbortController();
  set("عم بفكّر…"); out.classList.add("t35-thinking");
  if (btn) btn.disabled = true;
  if (stop) { stop.hidden = false; stop.onclick = () => ctl.abort(); }
  try {
    const text = await ai(prompt, { signal: ctl.signal, ...(tier ? { modelTier: tier } : {}), onText: ({ text }) => { out.classList.remove("t35-thinking"); set(text); } });
    set(text); onDone && onDone(text);
  } catch (e) {
    const keep = e && e.text ? e.text : "";
    set(keep || (e && e.code === "cancelled" ? "وقّفنا الجواب." : aiError(e)));
  } finally {
    out.classList.remove("t35-thinking");
    if (btn) btn.disabled = false;
    if (stop) stop.hidden = true;
  }
}
function t35StopBtn() { return h("button", { class: "btn sm ghost", type: "button", hidden: true, text: "وقّف" }); }
function t35Copy(getText, selectEl) {
  return h("button", { class: "btn sm ghost", type: "button", text: "انسخ", onclick: () => {
    const t = getText();
    if (!t.trim()) { toast("ما في نص تنسخه"); return; }
    const fallback = () => { if (selectEl) { selectEl.focus(); selectEl.select(); } toast("حدّدنا النص، انسخه من القائمة"); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast("انسخ"), fallback);
      else fallback();
    } catch { fallback(); }
  } });
}
// Private data: whole-collection subscription filtered by kind.
function t35Mine(kind, cb) {
  if (!S.uid) { cb([]); return () => {}; }
  return subscribe(myCol(), { limit: 300 }, (rows) => cb(rows.filter((r) => r.kind === kind)));
}
function t35PrivNote() {
  if (S.mode === "loading") return h("p", { class: "muted small", text: "جارِ التحميل…" });
  if (!S.uid) return h("div", { class: "banner warn" }, "سجّل دخول لـ Claude عشان ننحفظلك هاي البيانات بشكل خاص.");
  if (!S.canWrite) return h("div", { class: "banner warn" }, "الحفظ غير متاح لك بهذا العرض. اطلب صلاحية «مساهم» من صاحب المنصة.");
  return h("p", { class: "muted small t35-lock", text: "خاص فيك: ما حدا غيرك بيشوف هاي البيانات." });
}
function t35Wrap(title, lede, ...kids) { return h("div", { class: "t35 stack" }, h("h2", { text: title }), lede ? h("p", { class: "muted", text: lede }) : null, ...kids); }

// ---------- 117 · «اسأل Claude» ----------
const ASK = { turns: lsGet("p35:chat", []), busy: false, ctl: null, partial: "", draft: "" };
const ASK_STARTERS = [
  "شو الفرق بين جامعة وكلية وهندسائيين؟",
  "بدي أتعلم تمريض بالجنوب، وين بقدر وشو الشروط؟",
  "شو يعني سيخم وكيف بيحسبوه تقريبًا؟",
  "كيف بسجّل لبن غوريون وشو الوثائق اللي بحتاجها؟",
  "شو امتحان ياعيل ومين لازم يقدّمه؟",
  "شو المنح اللي بقدر أطلبها كطالب من النقب؟",
];
const ASK_GENERIC = new Set(["جامعه", "كليه", "معهد", "مركز", "اكاديمي", "اكاديميه", "في", "هندسائيين", "مدرسه", "للتكنولوجيا", "التكنولوجيه", "التكنولوجي", "للهندسه", "هندسه", "للعلوم", "للتربيه", "تربيه", "متعدد", "المجالات", "سابقا", "فقط", "القاب", "متقدمه", "العربيه", "عربيه", "الحكومي", "والتصميم", "للفنون"]);
const ASK_MAJOR_GENERIC = new Set(["هندسه", "علوم", "علم", "اداره", "لغه", "تربيه", "تعليم", "دراسات", "ادب", "نظم", "تكنولوجيا", "الخدمات", "مسار", "لقب", "اول", "ثاني"]);
const askWords = (s) => norm(s).split(/[\s\-–()/]+/).map((w) => w.replace(/^ال/, "")).filter((w) => w.length >= 3);
function askContext(text) {
  const q = norm(text);
  const scored = [];
  for (const i of INST) {
    let score = 0;
    const nameW = askWords(i.ar).filter((w) => !ASK_GENERIC.has(w) && !ASK_GENERIC.has("ال" + w));
    if (nameW.some((w) => q.includes(w))) score += 10;
    if (i.he.split(/\s+/).some((w) => w.length >= 4 && !/אוניברסיט|מכלל|האקדמ|הנדסאי|המרכז|הספר|לחינוך|להנדסה/.test(w) && text.includes(w))) score += 10;
    const hitMajors = [];
    for (const list of Object.values(i.majors)) for (const m of list) {
      if (q.includes(norm(m)) || askWords(m).some((w) => w.length >= 4 && !ASK_MAJOR_GENERIC.has(w) && q.includes(w))) hitMajors.push(m);
    }
    score += Math.min(hitMajors.length, 3);
    if (/جنوب|نقب|سبع/.test(q) && i.r === "الجنوب") score += 1;
    if (score) scored.push({ i, score, hitMajors });
  }
  scored.sort((a, b) => b.score - a.score);
  const full = scored.filter((s) => s.score >= 2 || s.hitMajors.length).slice(0, 6);
  const more = scored.slice(full.length).filter((s) => s.hitMajors.length).slice(0, 25);
  const block = (s) => [
    `### ${s.i.ar} (${s.i.he}) — ${TYPES[s.i.t]}، ${s.i.r}`,
    `نبذة: ${s.i.about}`,
    `رابط التسجيل: ${regUrl(s.i)}${s.i.reg ? "" : " (بحث Google، ما في صفحة رسمية مؤكدة)"}`,
    `شروط مكتوبة عنها: ${s.i.req.length ? s.i.req.join(" | ") : "ما في شروط خاصة منشورة عنا؛ الشروط العامة لنوعها بتنطبق."}`,
    s.score >= 10 ? "التخصصات: " + Object.entries(s.i.majors).map(([f, l]) => `${f}: ${l.join("، ")}`).join(" / ") : "تخصصات مطابقة للسؤال: " + s.hitMajors.join("، "),
  ].join("\n");
  return [
    full.length ? "## مؤسسات مطابقة للسؤال (من دليل المنصة)\n" + full.map(block).join("\n\n") : "## ما لقينا مؤسسة محددة بالسؤال",
    more.length ? "## كمان بيدرّسوا تخصص مشابه\n" + more.map((s) => `- ${s.i.ar} (${TYPES[s.i.t]}، ${s.i.r}): ${s.hitMajors.join("، ")} — ${regUrl(s.i)}`).join("\n") : "",
    "## فهرس كل المؤسسات بالدليل\n" + INST.map((i) => `${i.ar} | ${TYPES[i.t]} | ${i.r}`).join("\n"),
    "## الشروط العامة\n" + Object.entries(GENERAL_REQ).map(([t, l]) => `${{ u: "الجامعات", c: "الكليات", e: "الهندسائيين" }[t]}:\n- ${l.join("\n- ")}`).join("\n"),
    "## مصطلحات (عبري | لفظ | معنى)\n" + DICT.map((d) => d.join(" | ")).join("\n"),
    "## منح ومصادر\n" + SCHOLARSHIPS.map(([t, d, u]) => `- ${t}: ${d} ${u.startsWith("#") ? "(قسم «جامعة» بالمنصة)" : u}`).join("\n"),
  ].filter(Boolean).join("\n\n");
}
const t35Lang = () => (typeof LANG !== "undefined" ? LANG : "ar");
function askLangRule() {
  return t35Lang() === "he"
    ? "1. ענה בעברית פשוטה וברורה (הממשק כרגע בעברית), במשפטים קצרים וישירים. אם הצגת מונח בערבית, הוסף הסבר. כתוב מונחים מקצועיים בעברית התקנית."
    : "1. جاوب بالعربي العامي الفلسطيني نفس لغة المنصة (بدك، هلّق، شو، لسا، منيح)، بجمل قصيرة ومباشرة. المصطلحات العبرية اكتبها بالعبري ومعها شرح.";
}
function askRules(ctx) {
  return `أنت «مساعد بوابة الخريجين»: بتساعد طلاب وخريجي مدرسة ثانوية عربية بالنقب بأسئلة التسجيل للجامعات والكليات ومعاهد الهندسائيين بالبلاد: التخصصات، شروط البجروت والبسيخومتري والعبري والإنجليزي، السيخم، الوثائق والمواعيد، والمنح.

قواعد ملزمة:
${askLangRule()}
2. اعتمد على المعلومات تحت عن المؤسسات. لا تخترع أبدًا حد قبول أو علامة سيخم أو معدّل أو موعد أو سعر أو رابط. إذا الرقم مش مكتوب تحت، قول بوضوح إنه مش موجود عندك ووجّه لرابط التسجيل للمؤسسة.
3. كل ما تذكر رقم (حد أدنى، رسوم، موعد) قول إنه بيتغيّر كل سنة ولازم يفحصه بصفحة التخصص الرسمية.
4. لما تحكي عن مؤسسة معيّنة، حط رابط التسجيل تبعها من المعلومات تحت كما هو.
5. إذا السؤال مش عن التعليم والتسجيل، رجّع الحديث بلطف لموضوع المنصة.
6. بدون Markdown: لا نجوم ولا عناوين بـ #. استعمل أسطر قصيرة، و«-» للقوائم. خلّي الجواب أقصر من 200 كلمة إلا إذا انطلب تفصيل.
7. إذا محتاج معلومة من الطالب (مثلًا علاماته أو المنطقة)، اسأله سؤال واحد واضح.
8. بالآخر، إذا مناسب، اقترح خطوة عملية وحدة (مثلًا: افتح دليل المرشحين، احكي مع مستشارة المدرسة، استعمل حاسبة البجروت بقسم «أدوات»).

تاريخ اليوم: ${t35Ymd()}.

معلومات المنصة:
${ctx}`;
}
function askSave() { lsSet("p35:chat", ASK.turns.slice(-30)); }
function askSend(textIn) {
  const text = String(textIn || "").trim();
  if (!text || ASK.busy) return;
  if (!CAP.sample) { toast(aiError({ code: "not_granted" })); return; }
  ASK.turns.push({ role: "user", content: text.slice(0, 2000) });
  ASK.busy = true; ASK.partial = ""; ASK.draft = "";
  askSave(); askDraw();
  const recent = ASK.turns.filter((t) => t.role === "user").slice(-3).map((t) => t.content).join("\n");
  const history = ASK.turns.slice(-24);
  while (history.length && history[0].role !== "user") history.shift();
  const ctl = (ASK.ctl = new AbortController());
  ai([{ role: "user", content: askRules(askContext(recent)) }, ...history], {
    signal: ctl.signal,
    onText: ({ text: t }) => { ASK.partial = t; const live = $("#t35-ask-live"); if (live) { live.classList.remove("t35-thinking"); t35Rich(live, t); askScroll(); } },
  }).then((answer) => {
    ASK.turns.push({ role: "assistant", content: answer });
  }).catch((e) => {
    const keep = e && e.text ? e.text : ASK.partial;
    if (keep) ASK.turns.push({ role: "assistant", content: keep + (e && e.code === "cancelled" ? "\n\n(وقّفت الجواب)" : "") });
    if (!e || e.code !== "cancelled") toast(aiError(e));
  }).finally(() => {
    ASK.busy = false; ASK.ctl = null; ASK.partial = "";
    askSave(); askDraw();
  });
}
function askScroll() { const b = $("#t35-ask-body"); if (b) b.scrollTop = b.scrollHeight; }
function askBubble(t, live) {
  const p = h("p", { id: live ? "t35-ask-live" : null, class: live && !ASK.partial ? "t35-thinking" : null });
  t35Rich(p, live ? ASK.partial || "عم بفكّر…" : t.content);
  return h("div", { class: "msg" + (t.role === "user" ? " mine" : " t35-bot") },
    h("div", { class: "meta" }, h("b", { text: t.role === "user" ? "أنت" : "Claude" })), p);
}
function askDraw() {
  const body = $("#t35-ask-body"); if (!body) return;
  if (!ASK.turns.length) {
    body.replaceChildren(h("div", { class: "t35-ask-hello" },
      h("b", { text: "أهلا! اسألني عن التسجيل والتخصصات." }),
      h("p", { class: "muted small", text: "بعرف المؤسسات اللي بدليل المنصة وشروطها المكتوبة، والمصطلحات والمنح. ما بخترع أرقام: إذا الحد الأدنى مش مكتوب، بقلّك وين تفحصه." }),
      h("div", { class: "chips" }, ASK_STARTERS.map((s) => h("button", { class: "chip", type: "button", text: s, onclick: () => askSend(s) })))));
  } else {
    body.replaceChildren(...ASK.turns.map((t) => askBubble(t)), ASK.busy ? askBubble({ role: "assistant" }, true) : null);
  }
  const send = $("#t35-ask-send"), stop = $("#t35-ask-stop"), clear = $("#t35-ask-clear");
  if (send) send.hidden = ASK.busy;
  if (stop) stop.hidden = !ASK.busy;
  if (clear) clear.disabled = ASK.busy || !ASK.turns.length;
  askScroll();
}
function askView() {
  const box = h("textarea", { id: "t35-ask-input", rows: 2, maxlength: 2000, placeholder: "اكتب سؤالك… مثلًا: شو شروط القبول للصيدلة؟", "aria-label": "سؤالك",
    onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go1(); } },
    oninput: (e) => (ASK.draft = e.target.value) });
  box.value = ASK.draft;
  const go1 = () => { const v = box.value; if (!v.trim()) { box.focus(); return; } box.value = ""; askSend(v); };
  const v = h("div", { class: "view" },
    head("المساعد الذكي", "اسأل Claude", "أسئلة عن التسجيل، التخصصات، شروط البجروت والبسيخومتري والعبري، والمنح. بيجاوب بالعربي، ومن معلومات دليل المنصة."),
    t35AiGate("المساعد بيشتغل لما تفتح المنصة من رابطها على claude.ai وتسمح لـ Claude يجاوب (بيستعمل حسابك على Claude). لهلّق تقدر تستعمل دليل المؤسسات، القاموس وحاسبات البجروت والسيخم."),
    h("section", { class: "card chat t35-chat" },
      h("div", { class: "chat-head spread" },
        h("div", { class: "row" }, h("span", { class: "t35-dot", "aria-hidden": "true" }), h("b", { text: "Claude · مساعد التسجيل" })),
        h("button", { class: "link small", type: "button", id: "t35-ask-clear", text: "محادثة جديدة", onclick: () => confirmBox("تمسح المحادثة؟", () => { ASK.turns = []; askSave(); askDraw(); }) })),
      h("div", { class: "chat-body", id: "t35-ask-body", "aria-live": "polite" }),
      h("form", { class: "chat-form", onsubmit: (e) => { e.preventDefault(); go1(); } }, box,
        h("button", { class: "btn blue", type: "submit", id: "t35-ask-send", text: "ابعث" }),
        h("button", { class: "btn ghost", type: "button", id: "t35-ask-stop", hidden: true, text: "وقّف", onclick: () => ASK.ctl && ASK.ctl.abort() }))),
    h("p", { class: "muted small", text: "Claude ممكن يغلط. الحدود الدنيا والمواعيد بتتغيّر كل سنة، والرقم الرسمي دايمًا بصفحة التخصص بموقع المؤسسة. لا تكتب معلومات شخصية حساسة بالمحادثة." }),
    h("section", { class: "section" }, h("h2", { text: "أدوات بتساعدك قبل ما تسأل" }),
      h("div", { class: "tool-cards" }, [["sekhem", "حاسبة السيخم التقريبية"], ["admit", "هل أنا مقبول؟"], ["english", "مستويات الإنجليزي"], ["translate", "ترجم نص عبري"]].map(([id, t]) =>
        h("button", { class: "tool-card", type: "button", onclick: () => { toolTab = id; go("tools"); } }, h("b", { text: t })))),
    ),
  );
  queueMicrotask(askDraw);
  return v;
}
registerView("ask-claude", "tools", "اسأل Claude", askView, { order: 5 });

// ---------- 106 · approximate sekhem ----------
function t35BagrutAvg() {
  const rows = lsGet("bagrut", null); if (!rows) return null;
  let su = 0, s = 0;
  rows.forEach(([subj, u, g]) => { if (!u || isNaN(g)) return; const b = g < 60 ? 0 : u >= 5 ? (String(subj).includes("رياض") ? 35 : 25) : u === 4 ? 12.5 : 0; su += u; s += (g + b) * u; });
  return su ? +(s / su).toFixed(2) : null;
}
function toolSekhem(el) {
  const st = lsGet("p35:nums", { bagrut: "", psy: "", w: 50, max: 120 });
  const out = h("div", { class: "result" });
  const inp = (k, attrs) => h("input", { type: "number", id: "t35-sk-" + k, value: st[k], oninput: calc, ...attrs });
  const bag = inp("bagrut", { min: 0, max: 130, step: 0.01, placeholder: "مثال: 98.5" });
  const psy = inp("psy", { min: 200, max: 800, step: 1, placeholder: "200–800" });
  const max = inp("max", { min: 100, max: 130, step: 0.5 });
  const w = h("input", { type: "range", id: "t35-sk-w", min: 0, max: 100, step: 5, value: st.w, oninput: calc });
  const wLbl = h("b", { class: "num" });
  function calc() {
    Object.assign(st, { bagrut: bag.value, psy: psy.value, w: +w.value, max: +max.value || 120 }); lsSet("p35:nums", st);
    wLbl.textContent = `${st.w}% بسيخومتري · ${100 - st.w}% بجروت`;
    const b = t35N(st.bagrut), p = t35N(st.psy);
    if (!b || !p) { out.replaceChildren(h("span", { class: "muted", text: "عبّي معدّل البجروت وعلامة البسيخومتري لتشوف التقدير." })); return; }
    const bScaled = 200 + (Math.min(b, st.max) / st.max) * 600;
    const sk = (st.w / 100) * p + (1 - st.w / 100) * bScaled;
    st.sekhem = Math.round(sk); lsSet("p35:nums", st);
    out.replaceChildren(h("span", { class: "muted", text: "سيخم تقريبي على سلّم 200–800" }), h("b", { text: fmt(sk) }),
      h("span", { class: "small", text: `البجروت بعد التحويل للسلّم: ${fmt(bScaled)} · البسيخومتري: ${fmt(p)}` }));
  }
  el.replaceChildren(t35Wrap("حاسبة السيخم التقريبية", "السيخم (סכם) بيجمع معدّل البجروت مع علامة البسيخومتري. هون منحسبه بطريقة تقريبية وشفافة عشان تفهم شو بأثّر أكثر.",
    h("div", { class: "banner warn" }, h("span", null, h("b", { text: "مهم: " }), "كل جامعة إلها معادلة خاصة، وفي جامعات بتحسب على سلّم ثاني (مثلًا لـ1000 أو لـ100). النتيجة هون للتقدير الشخصي بس، ما بتنفع تقارنها مباشرة مع حد قبول منشور. حاسبة الجامعة الرسمية موجودة بموقع كل جامعة.")),
    h("div", { class: "form" },
      t35Field("معدّل البجروت الموزون (مع البونوس)", bag),
      t35Field("علامة البسيخومتري", psy),
      t35Field("أعلى معدّل بجروت محسوب (حسب المؤسسة)", max),
      h("div", { class: "field full" }, h("span", { text: "وزن البسيخومتري مقابل البجروت" }), w, wLbl)),
    h("div", { class: "row" },
      h("button", { class: "btn sm ghost", type: "button", text: "خذ المعدّل من حاسبة البجروت", onclick: () => { const a = t35BagrutAvg(); if (a == null) { toast("لسا ما عبّيت حاسبة البجروت"); return; } bag.value = a; calc(); } }),
      h("a", { class: "btn sm ghost", href: "https://www.google.com/search?q=" + encodeURIComponent("מחשבון סכם אוניברסיטה"), target: "_blank", rel: "noopener", text: "حاسبات الجامعات الرسمية" })),
    out,
    h("p", { class: "muted small", text: "طريقة الحساب: بنحوّل معدّل البجروت خطّيًا لسلّم 200–800 (أعلى معدّل = 800)، وبعدين معدّل موزون مع البسيخومتري حسب الوزن اللي اخترته. الحاسبة ما بتعرف معادلة أي مؤسسة." }),
    h("p", { class: "muted small", text: "ليش ما في «محوّل امتحان تجريبي لعلامة»؟ لأنه طريقة تدريج البسيخومتري الرسمية مش منشورة، وأي تحويل رح يكون تخمين." }),
  ));
  calc();
}

// ---------- 107 / 87 · «هل أنا مقبول؟» ----------
function toolAdmit(el) {
  const st = lsGet("p35:nums", {});
  const my = lsGet("p35:admit", { inst: t35Key(INST[0]), eng: "", heb: "", major: "" });
  const card = h("div", { class: "stack" });
  const aiOut = h("div", { class: "t35-ai-out" });
  const stop = t35StopBtn();
  const nums = () => [
    ["معدّل البجروت", st.bagrut], ["البسيخومتري", st.psy], ["سيخم تقريبي (من الحاسبة)", st.sekhem], ["مستوى الإنجليزي", my.eng], ["علامة ياعيل (عبري)", my.heb],
  ];
  const engSel = h("select", { id: "t35-ad-eng", onchange: (e) => { my.eng = e.target.value; save(); } }, opt("", "ما بعرف لسا", !my.eng), T35_ENG.map((l) => opt(l[0], l[1] + " · " + l[0], my.eng === l[0])));
  const heb = h("input", { type: "number", id: "t35-ad-heb", min: 50, max: 150, value: my.heb, placeholder: "إذا قدّمت", oninput: (e) => { my.heb = e.target.value; save(); } });
  const save = () => { lsSet("p35:admit", my); draw(); };
  function draw() {
    const i = t35Inst(my.inst) || INST[0];
    const majors = Object.values(i.majors).flat();
    card.replaceChildren(
      h("div", { class: "t35-two" },
        h("div", { class: "plain stack" }, h("h4", { text: "أرقامك" }),
          h("dl", { class: "t35-dl" }, nums().map(([k, v]) => [h("dt", { text: k }), h("dd", { class: "num", text: v ? String(v) : "—" })])),
          h("button", { class: "link small", type: "button", text: "عدّل البجروت والبسيخومتري بحاسبة السيخم", onclick: () => { toolTab = "sekhem"; go("tools"); } })),
        h("div", { class: "plain stack" },
          h("div", { class: "spread" }, h("h4", { text: "المكتوب بالدليل" }), h("span", { class: "pill grey", text: TYPES[i.t] })), h("b", { text: i.ar }),
          i.req.length ? reqList(i.req) : h("p", { class: "muted small", text: "ما في شروط خاصة مكتوبة بالدليل لهاي المؤسسة." }),
          h("h4", { text: { u: "الشروط العامة للجامعات", c: "الشروط العامة للكليات", e: "الشروط العامة للهندسائيين" }[i.t] }), reqList(GENERAL_REQ[i.t]),
          h("a", { class: "btn sm blue", href: regUrl(i), target: "_blank", rel: "noopener", text: "شروط التخصص الرسمية والتسجيل" }))),
      h("p", { class: "muted small", text: `الأرقام الوحيدة اللي منقارن فيها هي المكتوبة فوق. حد القبول لكل تخصص (${majors.length} تخصص هون) بينشر بصفحة التخصص وبيتغيّر كل سنة، فما منقدر نحكيلك «مقبول» أو «لا».` }),
    );
  }
  const majorSel = h("select", { id: "t35-ad-major", onchange: (e) => { my.major = e.target.value; lsSet("p35:admit", my); } });
  const fillMajors = () => { const i = t35Inst(my.inst) || INST[0]; majorSel.replaceChildren(opt("", "كل التخصصات", !my.major), Object.values(i.majors).flat().map((m) => opt(m, m, my.major === m))); };
  const askBtn = h("button", { class: "btn sm", type: "button", text: "خلّي Claude يفسّر الشروط مقابل أرقامي", onclick: () => {
    const i = t35Inst(my.inst) || INST[0];
    t35Ai({ out: aiOut, btn: askBtn, stop, prompt:
`أنت مستشار تسجيل بتحكي بالعربي العامي الفلسطيني (بدك، هلّق، شو). طالب بدو يعرف وين واقف مقابل شروط مؤسسة.
قواعد: قارن أرقامه فقط مع الأرقام المكتوبة حرفيًا بالشروط تحت. إذا الشرط ما فيه رقم، قول إنه الرقم مش منشور هون. لا تخترع حدود قبول ولا تحكي «مقبول» أو «مرفوض» بشكل قاطع. قول إن الأرقام بتتغيّر كل سنة ووجّه للرابط. بدون Markdown، أسطر قصيرة، أقل من 180 كلمة. اختم بخطوتين عمليتين.

المؤسسة: ${i.ar} (${i.he}) — ${TYPES[i.t]}
التخصص اللي مهتم فيه: ${my.major || "مش محدد"}
شروط خاصة مكتوبة: ${i.req.join(" | ") || "لا يوجد"}
شروط عامة: ${GENERAL_REQ[i.t].join(" | ")}
رابط التسجيل: ${regUrl(i)}

أرقام الطالب: ${nums().map(([k, v]) => `${k}: ${v || "غير معروف"}`).join("، ")}
(السيخم محسوب بحاسبة تقريبية مش رسمية.)` });
  } });
  el.replaceChildren(t35Wrap("هل أنا مقبول؟", "اختار مؤسسة وشوف شروطها المكتوبة جنب أرقامك. منعرض بس اللي مكتوب بالدليل، بدون تخمين.",
    h("div", { class: "form" },
      t35Field("المؤسسة", t35InstSelect("t35-ad-inst", my.inst, (e) => { my.inst = e.target.value; my.major = ""; fillMajors(); save(); })),
      t35Field("التخصص (اختياري)", majorSel),
      t35Field("مستوى الإنجليزي", engSel),
      t35Field("علامة ياعيل", heb)),
    card,
    h("div", { class: "row" }, askBtn, stop),
    t35AiGate(), aiOut,
  ));
  fillMajors(); draw();
}

// ---------- 116 · English levels ----------
const T35_ENG = [
  ["טרום בסיסי א'", "ترום بسيسي أ", "أول درجة بالسلّم. بتبلّش بمساق أساسي جدًا: قراءة جمل وفهم كلمات أكاديمية بسيطة."],
  ["טרום בסיסי ב'", "ترום بسيسي ب", "مساق تأسيسي ثاني. بمؤسسات كثيرة هالمستويات بتنعطى كمساق تحضيري برسوم إضافية أو بمكيناه."],
  ["בסיסי", "بسيسي", "قراءة نصوص قصيرة واستراتيجيات فهم المقروء. لسا في مساقين قبل الإعفاء."],
  ["מתקדמים א'", "متكدميم أ", "نصوص أكاديمية أطول وأصعب. مساق واحد بعده قبل الإعفاء."],
  ["מתקדמים ב'", "متكدميم ب", "آخر مساق. بعد ما تنجح فيه بتوصل للإعفاء."],
  ["פטור", "بطور", "إعفاء: ما بتحتاج مساقات إنجليزي إضافية وبتقدر تركّز على تخصصك."],
];
function toolEnglish(el) {
  let pick = lsGet("p35:eng", "");
  const path = h("div", { class: "result" });
  const drawPath = () => {
    const k = T35_ENG.findIndex((l) => l[0] === pick);
    if (k < 0) { path.replaceChildren(h("span", { class: "muted", text: "اكبس على مستواك (أو المستوى اللي بتتوقعه) لتشوف الطريق للإعفاء." })); return; }
    const left = T35_ENG.length - 1 - k;
    path.replaceChildren(h("span", { class: "muted", text: "عدد المساقات للوصول للإعفاء حسب السلّم" }), h("b", { text: left ? String(left) : "ولا مساق" }),
      h("span", { class: "small", text: left ? `الطريق: ${T35_ENG.slice(k).map((l) => l[1]).join(" ← ")}` : "مبروك، أنت معفى من الإنجليزي." }));
  };
  el.replaceChildren(t35Wrap("مستويات الإنجليزي بالجامعة", "كل طالب بيتصنّف لمستوى إنجليزي. كل مستوى تحت «بطور» يعني مساق إنجليزي لازم تنجح فيه، بالترتيب، لحد ما توصل للإعفاء.",
    h("ol", { class: "t35-ladder" }, T35_ENG.map(([he, ar, d]) => h("li", null,
      h("button", { class: "t35-rung", type: "button", "aria-pressed": String(pick === he), onclick: (e) => { pick = he; lsSet("p35:eng", pick); el.querySelectorAll(".t35-rung").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); drawPath(); } },
        h("span", { class: "t35-rung-name" }, h("b", { class: "he", text: he }), h("span", { class: "muted small", text: ar })), h("span", { class: "small", text: d }))))),
    path,
    h("div", { class: "grid" },
      h("div", { class: "plain stack" }, h("h4", { text: "كيف بيتحدّد مستواك؟" }), reqList([
        "من قسم الإنجليزي بامتحان البسيخومتري.",
        "أو من امتحان אמי\"ר (ورقي) أو אמיר\"ם (محوسب) من المركز القطري للامتحانات، وهو امتحان إنجليزي لحاله.",
        "المؤسسة بتاخذ آخر أو أعلى علامة حسب أنظمتها. افحص بالידיעון.",
      ])),
      h("div", { class: "plain stack" }, h("h4", { text: "شو لازم تعرف" }), reqList([
        "كل مؤسسة بتحدّد لإيمتى لازم توصل للإعفاء (مثلًا قبل السنة الثانية أو قبل ما تخلّص اللقب).",
        "الحدود بين المستويات بتختلف من مؤسسة لمؤسسة وبتتغيّر، فما حطّينا أرقام هون.",
        "إذا طلعت بمستوى منخفض، بتقدر تقدّم אמיר\"ם مرة ثانية قبل بداية السنة وتنط مستويات.",
        "مساقات الإنجليزي أحيانًا ما بتدخل بالمعدّل وأحيانًا إلها رسوم، اسأل السكرتارية.",
      ]))),
    h("div", { class: "row" },
      h("a", { class: "btn sm ghost", href: "https://www.nite.org.il", target: "_blank", rel: "noopener", text: "المركز القطري للامتحانات" }),
      h("button", { class: "btn sm ghost", type: "button", text: "اسأل Claude عن الإنجليزي", onclick: () => { ASK.draft = "شو بصير إذا تصنّفت بمستوى إنجليزي منخفض بالجامعة؟"; go("ask-claude"); } })),
  ));
  drawPath();
}

// ---------- 118 · translate a Hebrew text ----------
function toolTranslate(el) {
  const box = h("textarea", { id: "t35-tr-in", rows: 6, maxlength: 6000, placeholder: "الصق هون نص من موقع الجامعة، رسالة من السكرتارية، أو مصطلح…", dir: "rtl" });
  box.value = lsGet("p35:tr", "");
  const terms = h("div", { class: "stack" });
  const out = h("div", { class: "t35-ai-out" });
  const stop = t35StopBtn();
  const local = () => {
    lsSet("p35:tr", box.value.slice(0, 6000));
    const t = box.value;
    const hits = t ? DICT.filter(([he]) => he.split(/\s*\/\s*|\s*\(/)[0].split(" ").every((w) => t.includes(w.replace(/[()]/g, "")))) : [];
    terms.replaceChildren(hits.length ? h("div", { class: "plain stack" }, h("h4", { text: `مصطلحات من قاموس المنصة لقيناها بالنص (${hits.length})` }),
      h("div", { class: "table-wrap" }, h("table", null, h("tbody", null, hits.map(([he, tr, ar]) => h("tr", null, h("td", { class: "he", text: he }), h("td", { class: "muted", text: tr }), h("td", { text: ar }))))))) : null);
  };
  box.addEventListener("input", local);
  const btn = h("button", { class: "btn blue", type: "button", text: "ترجم واشرح", onclick: () => {
    const t = box.value.trim();
    if (!t) { toast("الصق نص أول"); box.focus(); return; }
    t35Ai({ out, btn, stop, prompt:
`ترجم النص العبري التالي للعربي لطالب عربي من النقب لسا بلّش بالجامعة.
1. أول شي: الترجمة بعربي واضح وبسيط (فصحى سهلة أو عامية مفهومة)، بنفس ترتيب النص.
2. بعدين تحت عنوان «مصطلحات»: كل مصطلح جامعي أو إداري بالنص، بالعبري، وجنبه شو معناه عمليًا بجملة.
3. إذا النص فيه موعد، رسوم أو طلب منه يعمل شي، لخّصه بالآخر تحت «شو المطلوب منك» بنقاط.
لا تزيد معلومات مش موجودة بالنص. بدون Markdown (لا نجوم ولا #)، استعمل «-» للقوائم.

النص:
"""${t.slice(0, 6000)}"""` });
  } });
  el.replaceChildren(t35Wrap("ترجم نص عبري من الجامعة", "الصق نص من موقع الجامعة أو مودل أو إيميل، وبنترجمه وبنشرح المصطلحات. المصطلحات المعروفة بتظهر فورًا من قاموس المنصة حتى بدون المساعد.",
    t35Field("النص بالعبري", box, "full"),
    terms,
    h("div", { class: "row" }, btn, stop, h("button", { class: "btn sm ghost", type: "button", text: "امسح", onclick: () => { box.value = ""; local(); out.replaceChildren(); } })),
    t35AiGate(), out,
    h("p", { class: "muted small", text: "لترجمة وثائق رسمية (شهادات، عقود) بتحتاج مترجم معتمد. هاي الأداة للفهم بس." }),
  ));
  local();
}

// ---------- 122 · major roadmap ----------
function toolRoadmap(el) {
  const st = lsGet("p35:road", { inst: t35Key(INST[0]), major: "", note: "" });
  const majorSel = h("select", { id: "t35-rm-major", onchange: (e) => { st.major = e.target.value; lsSet("p35:road", st); } });
  const fill = () => { const i = t35Inst(st.inst) || INST[0]; const all = Object.values(i.majors).flat(); if (!all.includes(st.major)) st.major = all[0] || ""; majorSel.replaceChildren(all.map((m) => opt(m, m, st.major === m))); };
  const note = h("input", { type: "text", id: "t35-rm-note", maxlength: 200, value: st.note, placeholder: "مثلًا: بحب البحث، بدي أشتغل بالنقب، بفكّر بلقب ثاني", oninput: (e) => { st.note = e.target.value; lsSet("p35:road", st); } });
  const out = h("div", { class: "t35-ai-out t35-road" });
  const stop = t35StopBtn();
  const btn = h("button", { class: "btn blue", type: "button", text: "ابني خريطة الطريق", onclick: () => {
    const i = t35Inst(st.inst) || INST[0];
    if (!st.major) { toast("اختار تخصص"); return; }
    t35Ai({ out, btn, stop, prompt:
`اكتب «خريطة طريق» عامة لطالب عربي من النقب بدو يدرس «${st.major}» في «${i.ar}» (${TYPES[i.t]}).
بالعربي العامي الفلسطيني البسيط (بدك، هلّق، شو)، بدون Markdown (لا نجوم ولا #). استعمل عناوين بسطر لحالها مثل «قبل ما تبلّش»، «السنة الأولى»، «السنة الثانية»… حسب طول اللقب المعتاد لهذا النوع، و«بعد اللقب».
لكل مرحلة، 3-5 أسطر تبدأ بـ «-»: أنواع المساقات (عامة، مش أسماء مساقات رسمية)، مهارات لازم تبنيها، تدريب عملي أو ستاج إذا التخصص بيطلبه، شغل طلابي أو تطوع مفيد، وشو تحضّر للمرحلة الجاية.
بالآخر: «وين ممكن تشتغل» (5 مسارات مهنية)، و«نصيحة من خريج» بسطرين.
ممنوع: أرقام رواتب، نسب قبول، حدود قبول، أسماء محاضرين، أو تفاصيل خاصة بالمؤسسة مش متأكد منها. قول مرة وحدة إنه البرنامج الرسمي بالידיעון تبع المؤسسة.
${st.note ? "ملاحظة من الطالب: " + st.note : ""}` });
  } });
  el.replaceChildren(t35Wrap("خريطة طريق التخصص", "اختار مؤسسة وتخصص، وClaude بيرسملك صورة عامة سنة بسنة: مساقات، تدريب، مهارات، وشغل بعد اللقب.",
    h("div", { class: "form" },
      t35Field("المؤسسة", t35InstSelect("t35-rm-inst", st.inst, (e) => { st.inst = e.target.value; fill(); lsSet("p35:road", st); })),
      t35Field("التخصص", majorSel),
      t35Field("شي عنك (اختياري)", note, "full")),
    h("div", { class: "row" }, btn, stop),
    t35AiGate(), out,
    h("p", { class: "muted small", text: "خريطة عامة من الذكاء الاصطناعي، مش برنامج رسمي. المساقات الحقيقية وترتيبها بالידיעון تبع المؤسسة، واحكي مع خريج من التخصص بقسم «الأفواج»." }),
  ));
  fill();
}

// ---------- 108 · weekly timetable (private) ----------
const T35_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const T35_SLOT = ["محاضرة", "ترچول", "مختبر", "دراسة ذاتية", "شغل", "غير ذلك"];
function toolTimetable(el) {
  let doc = null;
  const list = h("div", { class: "t35-week" });
  const draw = () => {
    const slots = (doc && doc.slots) || [];
    if (!slots.length) { list.replaceChildren(empty("الجدول فاضي", "أضف أول محاضرة أو ترچول من النموذج فوق. الجدول بينحفظ إلك لحالك.")); return; }
    list.replaceChildren(...T35_DAYS.map((d, di) => {
      const day = slots.filter((s) => s.day === di).sort((a, b) => a.start.localeCompare(b.start));
      if (!day.length) return null;
      const mins = day.reduce((n, s) => n + Math.max(0, t35Min(s.end) - t35Min(s.start)), 0);
      return h("div", { class: "plain stack t35-day" },
        h("div", { class: "spread" }, h("h4", { text: d }), h("span", { class: "muted small num", text: `${(mins / 60).toFixed(1)} ساعة` })),
        ...day.map((s) => h("div", { class: "t35-slot", style: `border-inline-start-color:hsl(${hue(s.title)} 55% 48%)` },
          h("span", { class: "num t35-time", text: `${s.start}–${s.end}` }),
          h("div", { style: "min-width:0" }, h("b", { text: s.title }), h("div", { class: "muted small", text: [s.type, s.room].filter(Boolean).join(" · ") })),
          h("button", { class: "link danger small", type: "button", text: "حذف", "aria-label": `حذف: ${s.title}`, onclick: () => save(slots.filter((x) => x !== s)) }))));
    }));
    const total = slots.reduce((n, s) => n + Math.max(0, t35Min(s.end) - t35Min(s.start)), 0);
    list.append(h("p", { class: "muted small", text: `المجموع: ${(total / 60).toFixed(1)} ساعة بالأسبوع، ${slots.length} حصة.` }));
  };
  const save = async (slots) => {
    if (!S.uid) { toast("سجّل دخول أول"); return false; }
    return setDoc(myCol(), "p35-timetable", { uid: S.uid, kind: "p35-tt", slots, createdAt: (doc && doc.createdAt) || Date.now(), updatedAt: Date.now() });
  };
  const f = h("form", { class: "form" },
    t35Field("اليوم", h("select", { id: "t35-tt-day" }, T35_DAYS.map((d, i) => opt(i, d)))),
    t35Field("من", h("input", { type: "time", id: "t35-tt-start", value: "08:30", required: true })),
    t35Field("لـ", h("input", { type: "time", id: "t35-tt-end", value: "10:00", required: true })),
    t35Field("المساق", h("input", { type: "text", id: "t35-tt-title", maxlength: 60, required: true, placeholder: "مثال: مقدمة بالإحصاء" })),
    t35Field("النوع", h("select", { id: "t35-tt-type" }, T35_SLOT.map((s) => opt(s)))),
    t35Field("القاعة (اختياري)", h("input", { type: "text", id: "t35-tt-room", maxlength: 40, placeholder: "مبنى 72، غرفة 104" })),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "أضف للجدول" }),
      h("button", { class: "btn sm ghost", type: "button", text: "نزّل الجدول (.txt)", onclick: () => {
        const slots = (doc && doc.slots) || []; if (!slots.length) { toast("الجدول فاضي"); return; }
        saveFile("جدولي-الأسبوعي.txt", T35_DAYS.map((d, di) => { const day = slots.filter((s) => s.day === di).sort((a, b) => a.start.localeCompare(b.start)); return day.length ? d + "\n" + day.map((s) => `  ${s.start}-${s.end}  ${s.title}${s.type ? " (" + s.type + ")" : ""}${s.room ? " · " + s.room : ""}`).join("\n") : ""; }).filter(Boolean).join("\n\n"));
      } })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const s = { day: +$("#t35-tt-day").value, start: $("#t35-tt-start").value, end: $("#t35-tt-end").value, title: $("#t35-tt-title").value.trim(), type: $("#t35-tt-type").value, room: $("#t35-tt-room").value.trim() };
    if (!s.title || !s.start || !s.end) return;
    if (t35Min(s.end) <= t35Min(s.start)) { toast("وقت النهاية لازم يكون بعد البداية"); return; }
    const slots = ((doc && doc.slots) || []).concat(s);
    const clash = slots.find((x) => x !== s && x.day === s.day && t35Min(x.start) < t35Min(s.end) && t35Min(s.start) < t35Min(x.end));
    if (await save(slots)) { $("#t35-tt-title").value = ""; $("#t35-tt-room").value = ""; toast(clash ? `انضاف، بس في تضارب مع «${clash.title}»` : "انضاف للجدول"); }
  });
  el.replaceChildren(t35Wrap("الجدول الأسبوعي", "رتّب محاضراتك وترچولاتك وساعات الشغل بمكان واحد، وشوف كم ساعة عندك كل يوم.", t35PrivNote(), f, list));
  if (S.uid) onLeave(subscribeDoc(myCol(), "p35-timetable", (d) => { doc = d; draw(); })); else draw();
}
const t35Min = (hm) => { const [a, b] = String(hm || "0:0").split(":").map(Number); return (a || 0) * 60 + (b || 0); };

// ---------- 109 · university GPA by credit points ----------
function toolGpa(el) {
  const rows = lsGet("p35:gpa", [["", 4, ""], ["", 3, ""], ["", 2, ""]]);
  const tbody = h("tbody");
  const out = h("div", { class: "result" });
  const read = () => [...tbody.querySelectorAll("tr")].map((tr) => [tr.querySelector(".c").value, t35N(tr.querySelector(".n").value), tr.querySelector(".g").value, tr.querySelector(".p").checked]);
  const calc = () => {
    const r = read(); lsSet("p35:gpa", r);
    let nz = 0, sum = 0, all = 0, passOnly = 0;
    r.forEach(([, n, g, p]) => { if (!n) return; if (p) { passOnly += n; all += n; return; } if (g === "" || isNaN(+g)) return; nz += n; sum += n * +g; all += n; });
    if (!nz) { out.replaceChildren(h("span", { class: "muted", text: "عبّي النقاط والعلامة لكل مساق لتشوف المعدّل." })); return; }
    out.replaceChildren(h("span", { class: "muted", text: "المعدّل الموزون حسب נ\"ז" }), h("b", { text: (sum / nz).toFixed(2) }),
      h("span", { class: "small", text: `نقاط بالمعدّل: ${nz}${passOnly ? ` · «עובר» بدون علامة: ${passOnly}` : ""} · مجموع النقاط: ${all}` }));
  };
  const add = ([c, n, g, p]) => tbody.append(h("tr", null,
    h("td", null, h("input", { class: "c", type: "text", value: c, maxlength: 60, placeholder: "اسم المساق", "aria-label": "المساق", oninput: calc })),
    h("td", null, h("input", { class: "n t35-narrow", type: "number", min: 0, max: 20, step: 0.5, value: n, "aria-label": "נקודות זכות", oninput: calc })),
    h("td", null, h("input", { class: "g t35-narrow", type: "number", min: 0, max: 100, value: g, "aria-label": "العلامة", oninput: calc })),
    h("td", null, h("input", { class: "p", type: "checkbox", checked: p ? true : null, "aria-label": "עובר بدون علامة", onchange: calc })),
    h("td", null, h("button", { class: "link danger", type: "button", text: "×", "aria-label": "إزالة", onclick: (e) => { e.target.closest("tr").remove(); calc(); } }))));
  rows.forEach(add);
  el.replaceChildren(t35Wrap("حاسبة المعدّل الجامعي", "كل مساق إله نقاط زخوت (נ\"ז). المعدّل = مجموع (العلامة × النقاط) ÷ مجموع النقاط. المساقات اللي علامتها «עובר» بدون رقم ما بتدخل بالمعدّل.",
    h("div", { class: "table-wrap" }, h("table", null, h("thead", null, h("tr", null, h("th", { text: "المساق" }), h("th", { text: "נ\"ז" }), h("th", { text: "العلامة" }), h("th", { text: "עובר" }), h("th"))), tbody)),
    h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", text: "+ مساق", onclick: () => { add(["", 2, "", false]); calc(); } })),
    out,
    h("p", { class: "muted small", text: "بعض المؤسسات بتحسب المعدّل التراكمي بطريقة مختلفة (مثلًا امتحان مُعاد أو مساقات إضافية). الرقم الرسمي بكشف العلامات بمنظومة المؤسسة." })));
  calc();
}

// ---------- 110 · pomodoro ----------
const POMO = { mode: "focus", running: false, endAt: 0, left: null, timer: null, cycle: 0 };
const pomoCfg = () => lsGet("p35:pomoCfg", { focus: 25, short: 5, long: 15 });
const POMO_LBL = { focus: "تركيز", short: "استراحة قصيرة", long: "استراحة طويلة" };
function pomoLen(m) { return pomoCfg()[m] * 60000; }
function pomoTick() {
  if (POMO.running) {
    POMO.left = POMO.endAt - Date.now();
    if (POMO.left <= 0) pomoDone();
  }
  const t = $("#t35-pomo-time"); if (!t) return;
  const left = Math.max(0, POMO.left ?? pomoLen(POMO.mode));
  t.textContent = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
  const bar = $("#t35-pomo-bar"); if (bar) bar.style.width = `${100 - (left / pomoLen(POMO.mode)) * 100}%`;
  const b = $("#t35-pomo-go"); if (b) b.textContent = POMO.running ? "وقّف مؤقتًا" : POMO.left != null && POMO.left < pomoLen(POMO.mode) ? "كمّل" : "ابدأ";
}
function pomoDone() {
  clearInterval(POMO.timer); POMO.timer = null; POMO.running = false;
  if (POMO.mode === "focus") {
    const stats = lsGet("p35:pomo", {}); const d = t35Ymd();
    stats[d] = { n: (stats[d]?.n || 0) + 1, min: (stats[d]?.min || 0) + pomoCfg().focus };
    lsSet("p35:pomo", stats);
    POMO.cycle++; POMO.mode = POMO.cycle % 4 === 0 ? "long" : "short";
    toast("خلصت جلسة تركيز. خذ استراحة");
  } else { POMO.mode = "focus"; toast("خلصت الاستراحة، يلا نرجع"); }
  POMO.left = null;
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 740; g.gain.value = 0.08; o.start(); o.stop(a.currentTime + 0.4); } catch {}
  if ($("#t35-pomo")) toolPomodoro($("#t35-pomo").parentNode);
}
function toolPomodoro(el) {
  const cfg = pomoCfg();
  const stats = lsGet("p35:pomo", {});
  const days = []; for (let k = 6; k >= 0; k--) { const d = new Date(); d.setDate(d.getDate() - k); days.push(t35Ymd(d)); }
  const maxMin = Math.max(25, ...days.map((d) => stats[d]?.min || 0));
  const today = stats[t35Ymd()] || { n: 0, min: 0 };
  const week = days.reduce((n, d) => n + (stats[d]?.min || 0), 0);
  const setMode = (m) => { if (POMO.running) return; POMO.mode = m; POMO.left = null; toolPomodoro(el); };
  const cfgIn = (k, label) => t35Field(label, h("input", { type: "number", id: "t35-pomo-" + k, min: 1, max: 90, value: cfg[k], onchange: (e) => { const c = pomoCfg(); c[k] = Math.min(90, Math.max(1, +e.target.value || 1)); lsSet("p35:pomoCfg", c); if (!POMO.running) { POMO.left = null; pomoTick(); } } }));
  el.replaceChildren(h("div", { class: "t35 stack", id: "t35-pomo" },
    h("h2", { text: "مؤقت دراسة (بومودورو)" }),
    h("p", { class: "muted", text: "ادرس فترة تركيز كاملة بدون تلفون، وبعدها استراحة قصيرة. كل 4 جلسات استراحة أطول. المؤقت بيضل شغّال لو تنقّلت بين الأدوات." }),
    h("div", { class: "chips", role: "group", "aria-label": "نوع الجلسة" }, Object.entries(POMO_LBL).map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(POMO.mode === k), disabled: POMO.running && POMO.mode !== k ? true : null, text: l, onclick: () => setMode(k) }))),
    h("div", { class: "t35-pomo-face" },
      h("span", { class: "muted small", text: POMO_LBL[POMO.mode] + (POMO.mode === "focus" ? ` · جلسة ${(POMO.cycle % 4) + 1} من 4` : "") }),
      h("b", { class: "num", id: "t35-pomo-time", role: "timer", "aria-live": "off" }),
      h("div", { class: "bar" }, h("i", { id: "t35-pomo-bar" }))),
    h("div", { class: "row" },
      h("button", { class: "btn blue", type: "button", id: "t35-pomo-go", onclick: () => {
        if (POMO.running) { POMO.running = false; POMO.left = POMO.endAt - Date.now(); clearInterval(POMO.timer); POMO.timer = null; }
        else { POMO.running = true; POMO.endAt = Date.now() + (POMO.left ?? pomoLen(POMO.mode)); clearInterval(POMO.timer); POMO.timer = setInterval(pomoTick, 500); }
        toolPomodoro(el);
      } }),
      h("button", { class: "btn ghost", type: "button", text: "من الأول", onclick: () => { clearInterval(POMO.timer); POMO.timer = null; POMO.running = false; POMO.left = null; toolPomodoro(el); } }),
      POMO.mode !== "focus" ? h("button", { class: "btn ghost", type: "button", text: "تخطّى الاستراحة", onclick: () => { clearInterval(POMO.timer); POMO.timer = null; POMO.running = false; POMO.mode = "focus"; POMO.left = null; toolPomodoro(el); } }) : null),
    h("div", { class: "form" }, cfgIn("focus", "دقائق التركيز"), cfgIn("short", "استراحة قصيرة"), cfgIn("long", "استراحة طويلة")),
    h("div", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { text: today.n }), h("span", { text: "جلسات اليوم" })),
      h("div", { class: "stat" }, h("b", { text: (today.min / 60).toFixed(1) }), h("span", { text: "ساعات اليوم" })),
      h("div", { class: "stat" }, h("b", { text: (week / 60).toFixed(1) }), h("span", { text: "ساعات آخر 7 أيام" }))),
    h("div", { class: "t35-week-bars", role: "img", "aria-label": "دقائق التركيز بآخر 7 أيام" }, days.map((d) => {
      const m = stats[d]?.min || 0;
      return h("div", { class: "t35-wb" }, h("span", { class: "num small", text: m ? String(m) : "" }), h("i", { style: `height:${Math.max(2, (m / maxMin) * 100)}%` }),
        h("span", { class: "small muted", text: new Date(d).toLocaleDateString("ar-EG", { weekday: "short" }) }));
    })),
    h("p", { class: "muted small", text: "الإحصائيات محفوظة على هذا المتصفح بس." }),
  ));
  pomoTick();
}

// ---------- 111 · registration checklist (private, per institution) ----------
const T35_CHECK = [
  ["docs", "وثائق", ["صورة الهوية (ת.ז) مع الملحق", "شهادة البجروت أو كشف العلامات من موقع وزارة التربية", "طلب إرسال علامة البسيخومتري للمؤسسة من المركز القطري", "صورة شخصية حديثة", "علامة امتحان العبري (ياعيل) إذا المؤسسة بتطلب", "وثائق للمنح: وضع العائلة ودخل الأهل"]],
  ["dates", "مواعيد", ["افحص آخر موعد للتسجيل للتخصص بموقع المؤسسة", "سجّل لموعد البسيخومتري المناسب", "موعد امتحان ياعيل أو أمير إذا لازم", "مواعيد المقابلات أو امتحانات القبول (إذا في)", "آخر موعد لطلب السكن الجامعي", "آخر موعد لطلبات المنح"]],
  ["pay", "دفعات", ["دفع رسوم التسجيل (דמי רישום)", "دفع المقداماه بعد القبول لتثبيت مكانك", "ترتيب طريقة دفع رسوم التعليم (دفعات، قرض، منحة)", "عربون السكن إذا رح تسكن بالمعونوت"]],
];
function toolChecklist(el) {
  let cur = lsGet("p35:checkInst", t35Key(INST[0]));
  let docs = [];
  const body = h("div", { class: "stack" });
  const started = h("div", { class: "chips" });
  const docOf = (k) => docs.find((d) => d.inst === k);
  const template = () => T35_CHECK.flatMap(([cat, , items]) => items.map((t, n) => ({ id: cat + n, cat, t, done: false, due: "" })));
  const save = (items) => {
    const d = docOf(cur);
    return setDoc(myCol(), "p35-check-" + cur, { uid: S.uid, kind: "p35-check", inst: cur, items, createdAt: d ? d.createdAt : Date.now(), updatedAt: Date.now() });
  };
  const draw = () => {
    started.replaceChildren(...docs.map((d) => { const i = t35Inst(d.inst); if (!i) return null; const n = d.items.filter((x) => x.done).length;
      return h("button", { class: "chip", type: "button", "aria-pressed": String(d.inst === cur), text: `${i.ar} · ${n}/${d.items.length}`, onclick: () => { cur = d.inst; lsSet("p35:checkInst", cur); sel.value = cur; draw(); } }); }));
    const i = t35Inst(cur) || INST[0];
    const d = docOf(cur); const items = d ? d.items : template();
    const done = items.filter((x) => x.done).length;
    body.replaceChildren(
      h("div", { class: "spread" }, h("h3", { text: i.ar }), h("a", { class: "btn sm blue", href: regUrl(i), target: "_blank", rel: "noopener", text: "صفحة التسجيل" })),
      h("div", { class: "stack", style: "gap:4px" }, h("div", { class: "spread small" }, h("span", { text: d ? "تقدّمك" : "قائمة مقترحة، اكبس على أي بند لتبلّش" }), h("b", { class: "num", text: `${done}/${items.length}` })),
        h("div", { class: "bar" }, h("i", { style: `width:${items.length ? (done / items.length) * 100 : 0}%` }))),
      ...T35_CHECK.concat([["mine", "بنود أضفتها", []]]).map(([cat, label]) => {
        const list = items.filter((x) => x.cat === cat);
        if (!list.length) return null;
        return h("div", { class: "plain stack" }, h("h4", { text: label }), ...list.map((x) => h("div", { class: "t35-check-row" + (x.done ? " done" : "") },
          h("label", { class: "check" }, h("input", { type: "checkbox", checked: x.done ? true : null, onchange: (e) => save(items.map((y) => (y.id === x.id ? { ...y, done: e.target.checked } : y))) }), h("span", { text: x.t })),
          h("input", { type: "date", value: x.due || "", "aria-label": `موعد: ${x.t}`, onchange: (e) => save(items.map((y) => (y.id === x.id ? { ...y, due: e.target.value } : y))) }),
          x.cat === "mine" ? h("button", { class: "link danger small", type: "button", text: "حذف", onclick: () => save(items.filter((y) => y.id !== x.id)) }) : null)));
      }),
      h("form", { class: "row t35-add", onsubmit: (e) => { e.preventDefault(); const inp = e.target.querySelector("input"); const t = inp.value.trim(); if (!t) return; save(items.concat({ id: "m" + Date.now().toString(36), cat: "mine", t, done: false, due: "" })).then((ok) => ok && (inp.value = "")); } },
        h("input", { type: "text", id: "t35-ck-new", maxlength: 120, placeholder: "بند خاص فيك: مثلًا «أبعث شهادة الهندسائي»", "aria-label": "بند جديد" }), h("button", { class: "btn sm", type: "submit", text: "أضف" })),
      d ? h("button", { class: "link danger small", type: "button", text: "امسح قائمة هاي المؤسسة", onclick: () => confirmBox("تمسح القائمة؟", () => delDoc(myCol(), "p35-check-" + cur)) }) : null,
    );
  };
  const sel = t35InstSelect("t35-ck-inst", cur, (e) => { cur = e.target.value; lsSet("p35:checkInst", cur); draw(); });
  el.replaceChildren(t35Wrap("قائمة مهام التسجيل", "لكل مؤسسة قائمة: وثائق، مواعيد ودفعات. أضف تاريخ لكل بند وعلّم اللي خلّصته. البنود عامة، والتفاصيل الدقيقة بموقع المؤسسة.",
    t35PrivNote(), t35Field("المؤسسة", sel), started, body));
  if (S.uid) onLeave(t35Mine("p35-check", (rows) => { docs = rows; draw(); })); else draw();
}

// ---------- 119 · personal reminders (private) ----------
function t35Ics(rows) {
  const esc = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ev = rows.map((r) => {
    const d = r.date.replace(/-/g, "");
    const start = r.time ? `DTSTART:${d}T${r.time.replace(":", "")}00` : `DTSTART;VALUE=DATE:${d}`;
    return ["BEGIN:VEVENT", `UID:${r.id}@alumni-portal`, `DTSTAMP:${stamp}`, start, `SUMMARY:${esc(r.title)}`, r.note ? `DESCRIPTION:${esc(r.note)}` : null,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(r.title)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//alumni-portal//ar", "CALSCALE:GREGORIAN", ...ev, "END:VCALENDAR"].join("\r\n");
}
async function t35AddReminder(title, date, note, time) {
  if (!S.uid) { toast("سجّل دخول عشان تنحفظ التذكيرات"); return false; }
  const ok = await addDoc(myCol(), { uid: S.uid, kind: "p35-rem", title: String(title).slice(0, 120), date, time: time || "", note: String(note || "").slice(0, 300), createdAt: Date.now() });
  if (ok) toast("انضاف لتذكيراتك");
  return ok;
}
function t35RemRow(r) {
  const n = t35DaysTo(r.date);
  return h("div", { class: "plain t35-rem" + (n < 0 ? " past" : "") },
    h("div", { class: "t35-rem-date" }, h("b", { class: "num", text: r.date.slice(8) }), h("span", { text: new Date(r.date + "T00:00").toLocaleDateString("ar-EG", { month: "short" }) })),
    h("div", { style: "min-width:0" }, h("b", { text: r.title }), h("div", { class: "muted small", text: `${t35In(n)}${r.time ? " · " + r.time : ""} · ${t35DateAr(r.date)}` }),
      r.note ? (safeUrl(r.note) ? h("a", { class: "small", href: safeUrl(r.note), target: "_blank", rel: "noopener", text: "المصدر" }) : h("p", { class: "small", text: r.note })) : null),
    h("button", { class: "link danger small", type: "button", text: "حذف", "aria-label": `حذف: ${r.title}`, onclick: () => delDoc(myCol(), r.id) }));
}
function toolReminders(el) {
  let rows = [];
  const list = h("div", { class: "stack" });
  const draw = () => {
    const today = t35Ymd();
    const up = rows.filter((r) => r.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const past = rows.filter((r) => r.date < today).sort((a, b) => b.date.localeCompare(a.date));
    list.replaceChildren(
      up.length ? h("div", { class: "stack" }, ...up.map(t35RemRow)) : empty("ما في مواعيد جاية", "أضف موعد مهم: آخر يوم تسجيل، امتحان بسيخومتري، مقابلة، دفعة."),
      up.length ? h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", text: "نزّل لتقويم تلفونك (.ics)", onclick: () => saveFile("تذكيرات-الجامعة.ics", t35Ics(up)) }),
        h("span", { class: "muted small", text: "افتح الملف بالتلفون وبينضافوا للتقويم مع تنبيه قبل بيوم." })) : null,
      past.length ? h("details", { class: "t35-past" }, h("summary", { text: `مواعيد فاتت (${past.length})` }), h("div", { class: "stack" }, ...past.slice(0, 30).map(t35RemRow))) : null,
    );
  };
  const f = h("form", { class: "form" },
    t35Field("شو الموعد", h("input", { type: "text", id: "t35-rm-title", required: true, maxlength: 120, placeholder: "مثال: آخر يوم تسجيل بسبير" }), "full"),
    t35Field("التاريخ", h("input", { type: "date", id: "t35-rm-date", required: true, min: t35Ymd() })),
    t35Field("الساعة (اختياري)", h("input", { type: "time", id: "t35-rm-time" })),
    t35Field("ملاحظة أو رابط المصدر", h("input", { type: "text", id: "t35-rm-note", maxlength: 300 })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف تذكير" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = $("#t35-rm-title").value.trim(), d = $("#t35-rm-date").value;
    if (!t || !d) return;
    if (await t35AddReminder(t, d, $("#t35-rm-note").value.trim(), $("#t35-rm-time").value)) f.reset();
  });
  el.replaceChildren(t35Wrap("تذكيرات المواعيد المهمة", "سجّل مواعيدك وبنعرض أقربها بالصفحة الرئيسية.",
    h("div", { class: "banner" }, "المنصة ما بتقدر تبعث إشعارات للمتصفح أو للتلفون. عشان توصلك تنبيهات حقيقية، نزّل المواعيد كملف تقويم وافتحه بتلفونك."),
    t35PrivNote(), f, list,
    h("button", { class: "link small", type: "button", "data-go": "uni-deadlines", text: "مواعيد تسجيل نشرها الأعضاء، وتقدر تضيفها لتذكيراتك" })));
  if (S.uid) onLeave(t35Mine("p35-rem", (r) => { rows = r; draw(); })); else draw();
}

// ---------- 114 · monthly budget ----------
const T35_IN = [["family", "مساعدة الأهل (₪)"], ["work", "شغل طلابي (₪)"], ["grant", "منح (₪ بالشهر)"], ["loan", "قرض (₪)"], ["otherIn", "دخل ثاني (₪)"]];
const T35_OUT = [["rent", "سكن (₪)"], ["food", "أكل (₪)"], ["travel", "مواصلات (₪)"], ["phone", "تلفون وإنترنت (₪)"], ["study", "كتب وتصوير ومعدات (₪)"], ["tuition", "قسط التعليم (₪ بالشهر)"], ["fun", "طلعات وترفيه (₪)"], ["otherOut", "مصاريف ثانية (₪)"]];
function toolBudget(el) {
  const v = lsGet("p35:budget", {});
  const out = h("div", { class: "stack" });
  const inp = ([k, l]) => t35Field(l, h("input", { type: "number", id: "t35-bd-" + k, min: 0, step: 10, value: v[k] || "", placeholder: "0", oninput: (e) => { v[k] = t35N(e.target.value); lsSet("p35:budget", v); calc(); } }));
  const calc = () => {
    const tin = T35_IN.reduce((n, [k]) => n + (v[k] || 0), 0), tout = T35_OUT.reduce((n, [k]) => n + (v[k] || 0), 0);
    if (!tin && !tout) { out.replaceChildren(empty("الميزانية فاضية", "عبّي قدّيش بيدخلك بالشهر وقدّيش بتصرف، وبنوريك وين بتروح المصاري.")); return; }
    const bal = tin - tout;
    const exp = T35_OUT.filter(([k]) => v[k]).sort((a, b) => v[b[0]] - v[a[0]]);
    out.replaceChildren(
      h("div", { class: "result" + (bal < 0 ? " t35-neg" : "") }, h("span", { class: "muted", text: bal >= 0 ? "بيضل معك آخر الشهر" : "ناقصك آخر الشهر" }), h("b", { text: "₪ " + fmt(Math.abs(bal)) }),
        h("span", { class: "small", text: `دخل: ₪ ${fmt(tin)} · مصاريف: ₪ ${fmt(tout)} · بالسنة: ₪ ${fmt(bal * 12)}` })),
      exp.length ? h("div", { class: "stack" }, ...exp.map(([k, l]) => h("div", { class: "stack", style: "gap:4px" },
        h("div", { class: "spread small" }, h("span", { text: l }), h("span", { class: "num", text: `₪ ${fmt(v[k])} · ${tout ? Math.round((v[k] / tout) * 100) : 0}%` })),
        h("div", { class: "bar" }, h("i", { style: `width:${tout ? (v[k] / tout) * 100 : 0}%` }))))) : null,
      bal < 0 ? h("p", { class: "small", text: "نصيحة: افحص المنح بقسم «أدوات ← المنح»، وشغل طلابي بيناسب الدراسة بقسم المسار المهني." }) : null);
  };
  el.replaceChildren(t35Wrap("ميزانية الطالب الشهرية", "حط أرقامك أنت (تقديرية). كل شي بينحفظ على هذا المتصفح بس.",
    h("h4", { text: "الدخل بالشهر" }), h("div", { class: "form" }, T35_IN.map(inp)),
    h("h4", { text: "المصاريف بالشهر" }), h("div", { class: "form" }, T35_OUT.map(inp)),
    out, h("button", { class: "link small", type: "button", text: "صفّر الأرقام", onclick: () => confirmBox("تصفّر كل الأرقام؟", () => { lsSet("p35:budget", {}); toolBudget(el); }) })));
  calc();
}

// ---------- 120 · Israel vs abroad ----------
const T35_AB = [["tuition", "رسوم التعليم بالسنة (₪)"], ["rent", "سكن بالشهر (₪)"], ["living", "معيشة: أكل ومواصلات بالشهر (₪)"], ["flights", "سفر ورحلات للبيت بالسنة (₪)"], ["once", "مصاريف لمرة وحدة: فيزا، تأمين، لغة (₪)"], ["grant", "منح بالسنة (₪)"], ["years", "عدد سنين اللقب"]];
function toolAbroad(el) {
  const v = lsGet("p35:abroad", { here: {}, there: {}, country: "" });
  const tbl = h("div", { class: "table-wrap" });
  const total = (s) => { const x = (k) => t35N(s[k]); const y = x("years") || 0; return { perYear: x("tuition") + x("rent") * 12 + x("living") * 12 + x("flights") - x("grant"), all: (x("tuition") + x("rent") * 12 + x("living") * 12 + x("flights") - x("grant")) * y + x("once") }; };
  const side = (key, title) => h("div", { class: "plain stack" }, h("h4", { text: title }),
    h("div", { class: "form" }, T35_AB.map(([k, l]) => t35Field(l, h("input", { type: "number", id: `t35-ab-${key}-${k}`, min: 0, step: k === "years" ? 1 : 50, value: v[key][k] ?? "", placeholder: "0", oninput: (e) => { v[key][k] = e.target.value; lsSet("p35:abroad", v); calc(); } })))));
  const calc = () => {
    const a = total(v.here), b = total(v.there);
    if (!a.all && !b.all) { tbl.replaceChildren(empty("لسا ما في أرقام", "عبّي الطرفين بأرقام لقيتها بمواقع المؤسسات، وبنحطهم جنب بعض.")); return; }
    const cn = v.country || "بالخارج";
    const r = (l, x, y, strong) => h("tr", null, h("td", { text: l }), h("td", { class: "num", text: "₪ " + fmt(x) }), h("td", { class: "num", text: "₪ " + fmt(y) }), strong ? null : null);
    const diff = b.all - a.all;
    tbl.replaceChildren(h("table", { class: "t35-cmp" }, h("thead", null, h("tr", null, h("th"), h("th", { text: "بالبلاد" }), h("th", { text: cn }))),
      h("tbody", null, r("بالسنة", a.perYear, b.perYear), r("اللقب كله", a.all, b.all))),
      h("p", { class: "small", text: diff === 0 ? "نفس التكلفة تقريبًا." : diff > 0 ? `الدراسة بالخارج أغلى بـ ₪ ${fmt(diff)} عاللقب كله.` : `الدراسة بالبلاد أغلى بـ ₪ ${fmt(-diff)} عاللقب كله.` }));
  };
  el.replaceChildren(t35Wrap("مقارنة: الدراسة بالبلاد أو بالخارج", "حط أرقام حقيقية لقيتها أنت (بالشيكل). ما في أرقام جاهزة لأنها بتختلف كثير حسب البلد والجامعة والتخصص.",
    t35Field("البلد بالخارج", h("input", { type: "text", id: "t35-ab-country", maxlength: 40, value: v.country, placeholder: "مثال: الأردن، ألمانيا، مولدوفا", oninput: (e) => { v.country = e.target.value; lsSet("p35:abroad", v); calc(); } })),
    h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", text: "خذ أرقام البلاد من حاسبة التكلفة", onclick: () => {
      const c = lsGet("cost", null); if (!c) { toast("لسا ما فتحت حاسبة التكلفة"); return; }
      v.here = { tuition: c.tuition, rent: c.months ? Math.round((c.rent * c.months) / 12) : 0, living: c.travel, flights: 0, once: 0, grant: c.grant, years: c.years }; lsSet("p35:abroad", v); toolAbroad(el);
    } })),
    h("div", { class: "grid" }, side("here", "بالبلاد"), side("there", "بالخارج")),
    tbl,
    h("div", { class: "banner warn" }, "قبل ما تقرر: افحص إذا الشهادة من الخارج معترف فيها بالبلاد، وإذا التخصص بيطلب امتحان ترخيص لما ترجع (مثل الطب والمهن الطبية)."),
    h("a", { class: "small", href: "https://www.google.com/search?q=" + encodeURIComponent("הכרה בתואר אקדמי מחו\"ל משרד החינוך"), target: "_blank", rel: "noopener", text: "معلومات عن الاعتراف بالشهادات من الخارج" })));
  calc();
}

// ---------- 121 · Hebrew reading-speed test ----------
const T35_READ = "ביום הראשון באוניברסיטה, נועה הגיעה לקמפוס מוקדם בבוקר. היא חיפשה את הבניין של הפקולטה למדעי החברה, אבל המפה באתר הייתה מבלבלת. סטודנטית משנה שנייה ראתה אותה עומדת ליד הספרייה והציעה לעזור. בדרך הן דיברו על מערכת השעות, על הקורסים הקשים בסמסטר הראשון ועל החשיבות של שעות הקבלה של המרצים. הסטודנטית סיפרה שבשנה שעברה היא כמעט נכשלה בקורס סטטיסטיקה, עד שהתחילה ללמוד בקבוצה עם חברים מהכיתה. נועה רשמה לעצמה את הטיפ הזה. אחרי ההרצאה הראשונה היא הלכה לדיקנאט הסטודנטים ושאלה על מלגות. העובדת שם הסבירה לה שצריך להגיש בקשה עד סוף החודש, ולצרף אישור לימודים ומסמכים על המצב הכלכלי של המשפחה. בערב נועה התקשרה לאמא שלה וסיפרה שהיום היה ארוך, אבל היא מרגישה שהיא במקום הנכון.";
const T35_READ_Q = [
  ["ليش نوعا احتاجت مساعدة بالصبح؟", ["الخريطة بموقع الجامعة كانت مربكة", "تأخرت عن المحاضرة", "نسيت بطاقة الطالب", "ما لقت موقف للسيارة"], 0],
  ["شو النصيحة اللي أخذتها من الطالبة؟", ["تأجّل مساق الإحصاء لسنة الجاي", "تدرس بمجموعة مع أصحاب من الصف", "تسكن بالمعونوت", "تسجّل لمساقات أقل"], 1],
  ["شو لازم ترفق مع طلب المنحة؟", ["شهادة البجروت بس", "رسالة توصية من محاضر", "إثبات تعليم ووثائق عن وضع العائلة المادي", "علامة البسيخومتري"], 2],
];
const READ = { phase: "intro", t0: 0, secs: 0, ans: {} };
function toolReading(el) {
  const words = T35_READ.split(/\s+/).length;
  const hist = lsGet("p35:read", []);
  const re = () => toolReading(el);
  let body;
  if (READ.phase === "intro") {
    body = [h("p", { text: `رح يظهر نص قصير بالعبري (${words} كلمة) عن أول يوم بالجامعة. اقرأه بسرعتك العادية وافهمه، مش بسرعة زيادة. بعدها 3 أسئلة فهم.` }),
      h("button", { class: "btn blue", type: "button", text: "ابدأ القراءة", onclick: () => { READ.phase = "read"; READ.t0 = Date.now(); READ.ans = {}; re(); } })];
  } else if (READ.phase === "read") {
    body = [h("p", { class: "t35-he-text", dir: "rtl", lang: "he", text: T35_READ }),
      h("button", { class: "btn blue", type: "button", text: "خلصت القراءة", onclick: () => { READ.secs = Math.max(1, (Date.now() - READ.t0) / 1000); READ.phase = "quiz"; re(); } })];
  } else {
    const wpm = Math.round(words / (READ.secs / 60));
    const done = Object.keys(READ.ans).length === T35_READ_Q.length;
    const score = T35_READ_Q.filter((q, k) => READ.ans[k] === q[2]).length;
    body = [h("div", { class: "result" }, h("span", { class: "muted", text: "سرعة القراءة" }), h("b", { text: `${wpm} كلمة/دقيقة` }), h("span", { class: "small", text: `قرأت ${words} كلمة بـ ${Math.round(READ.secs)} ثانية` })),
      ...T35_READ_Q.map(([q, opts, right], k) => h("div", { class: "q" }, h("b", { text: `${k + 1}. ${q}` }),
        h("div", { class: "chips" }, opts.map((o, n) => h("button", { class: "chip" + (done ? (n === right ? " t35-right" : READ.ans[k] === n ? " t35-wrong" : "") : ""), type: "button", "aria-pressed": String(READ.ans[k] === n), disabled: done ? true : null, text: o,
          onclick: () => { READ.ans[k] = n; if (Object.keys(READ.ans).length === T35_READ_Q.length) { const s = T35_READ_Q.filter((x, j) => READ.ans[j] === x[2]).length; hist.unshift({ d: Date.now(), wpm, s }); lsSet("p35:read", hist.slice(0, 10)); } re(); } }))))),
      done ? h("div", { class: "result" }, h("span", { class: "muted", text: "الفهم" }), h("b", { text: `${score} من 3` }), h("span", { class: "small", text: score === 3 ? "قراءة سريعة مع فهم كامل. ممتاز." : "السرعة بتفيد بس إذا الفهم كامل. جرّب تقرأ أبطأ شوي المرة الجاي." })) : null,
      done ? h("button", { class: "btn ghost", type: "button", text: "جرّب مرة ثانية", onclick: () => { READ.phase = "intro"; re(); } }) : null];
  }
  el.replaceChildren(t35Wrap("اختبار سرعة القراءة بالعبري", "الجامعة يعني قراءة كثير بالعبري. قيس سرعتك وفهمك، وارجع جرّب كل كم أسبوع لتشوف تقدّمك.", ...body,
    hist.length ? h("div", { class: "plain stack" }, h("h4", { text: "محاولاتك السابقة" }), h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, h("th", { text: "متى" }), h("th", { text: "كلمة/دقيقة" }), h("th", { text: "الفهم" }))),
      h("tbody", null, hist.map((x) => h("tr", null, h("td", { text: rel(x.d) }), h("td", { class: "num", text: x.wpm }), h("td", { class: "num", text: `${x.s}/3` }))))))) : null,
    h("p", { class: "muted small", text: "قارن حالك مع حالك. ما في «علامة نجاح» هون، والأسئلة للفهم بس." })));
}

// ---------- 112 · CV generator ----------
const T35_CV_L = {
  ar: { dir: "rtl", name: "العربية", summary: "نبذة", edu: "التعليم", exp: "الخبرة العملية", vol: "تطوع ونشاطات", skills: "مهارات", langs: "لغات" },
  he: { dir: "rtl", name: "עברית", summary: "תקציר", edu: "השכלה", exp: "ניסיון תעסוקתי", vol: "התנדבות ופעילויות", skills: "כישורים", langs: "שפות" },
  en: { dir: "ltr", name: "English", summary: "Summary", edu: "Education", exp: "Experience", vol: "Volunteering & Activities", skills: "Skills", langs: "Languages" },
};
const T35_CV_F = [["name", "الاسم الكامل", "input"], ["title", "عنوان قصير (مثلًا: طالب تمريض سنة ثانية)", "input"], ["phone", "تلفون", "input"], ["email", "إيميل", "input"], ["city", "البلد", "input"],
  ["summary", "نبذة (2-3 جمل)", "area"], ["edu", "التعليم (كل سطر بند)", "area"], ["exp", "الخبرة العملية (كل سطر بند)", "area"], ["vol", "تطوع ونشاطات", "area"], ["skills", "مهارات", "area"], ["langs", "لغات", "area"]];
function toolCv(el) {
  const v = lsGet("p35:cv", { lang: "he" });
  let prev = null;
  const preview = h("div", { class: "t35-cv" });
  const ctrls = {};
  const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const draw = () => {
    const L = T35_CV_L[v.lang];
    preview.setAttribute("dir", L.dir);
    const sec = (k) => lines(v[k]).length ? h("section", null, h("h4", { text: L[k] }), k === "summary" ? h("p", { text: v[k] }) : h("ul", null, lines(v[k]).map((x) => h("li", { text: x })))) : null;
    preview.replaceChildren(
      h("header", null, h("h3", { text: v.name || "اسمك هون" }), v.title ? h("p", { class: "muted", text: v.title }) : null,
        h("p", { class: "small", text: [v.phone, v.email, v.city].filter(Boolean).join(" · ") })),
      ...["summary", "edu", "exp", "vol", "skills", "langs"].map(sec));
  };
  const set = (k, val) => { v[k] = val; lsSet("p35:cv", v); draw(); };
  const fields = T35_CV_F.map(([k, l, kind]) => {
    const c = kind === "area" ? h("textarea", { id: "t35-cv-" + k, rows: 3, maxlength: 1200, oninput: (e) => set(k, e.target.value) }) : h("input", { type: "text", id: "t35-cv-" + k, maxlength: 120, value: v[k] || "", oninput: (e) => set(k, e.target.value) });
    if (kind === "area") c.value = v[k] || "";
    ctrls[k] = c;
    return t35Field(l, c, kind === "area" ? "full" : "");
  });
  const fillCtrls = () => T35_CV_F.forEach(([k]) => (ctrls[k].value = v[k] || ""));
  const htmlFile = () => {
    const L = T35_CV_L[v.lang];
    const sec = (k) => lines(v[k]).length ? `<h2>${t35Esc(L[k])}</h2>` + (k === "summary" ? `<p>${t35Esc(v[k])}</p>` : `<ul>${lines(v[k]).map((x) => `<li>${t35Esc(x)}</li>`).join("")}</ul>`) : "";
    return `<!doctype html><html lang="${v.lang}" dir="${L.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t35Esc(v.name || "CV")}</title>
<style>body{font:15px/1.6 Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#16171C}h1{margin:0;font-size:28px}h2{font-size:16px;color:#2B5FD9;border-bottom:2px solid #2B5FD9;padding-bottom:4px;margin-top:22px}.sub{color:#5D606D;margin:2px 0}ul{padding-inline-start:20px}@media print{body{margin:0}}</style></head>
<body><h1>${t35Esc(v.name)}</h1>${v.title ? `<p class="sub">${t35Esc(v.title)}</p>` : ""}<p class="sub">${t35Esc([v.phone, v.email, v.city].filter(Boolean).join(" · "))}</p>${["summary", "edu", "exp", "vol", "skills", "langs"].map(sec).join("")}</body></html>`;
  };
  const txtFile = () => { const L = T35_CV_L[v.lang]; return [v.name, v.title, [v.phone, v.email, v.city].filter(Boolean).join(" · "), ...["summary", "edu", "exp", "vol", "skills", "langs"].filter((k) => lines(v[k]).length).map((k) => `\n${L[k]}\n` + (k === "summary" ? v[k] : lines(v[k]).map((x) => "- " + x).join("\n")))].filter(Boolean).join("\n"); };
  const status = h("p", { class: "muted small", "aria-live": "polite" });
  const undo = h("button", { class: "btn sm ghost", type: "button", hidden: true, text: "رجّع النص قبل التحسين", onclick: () => { if (prev) { Object.assign(v, prev); lsSet("p35:cv", v); fillCtrls(); draw(); undo.hidden = true; } } });
  const better = h("button", { class: "btn sm", type: "button", text: "حسّن بالذكاء", onclick: async () => {
    if (!CAP.sample) { toast(aiError({ code: "not_granted" })); return; }
    const keys = ["title", "summary", "edu", "exp", "vol", "skills", "langs"];
    if (!keys.some((k) => (v[k] || "").trim())) { toast("عبّي شوية تفاصيل أول"); return; }
    better.disabled = true; status.textContent = "عم يحسّن Claude الصياغة…";
    try {
      const r = await aiJson(`Rewrite this student CV content in ${T35_CV_L[v.lang].name === "English" ? "English" : T35_CV_L[v.lang].name === "עברית" ? "Hebrew" : "Modern Standard Arabic"}.
Rules: keep every fact exactly (names of places, dates, grades). Never add jobs, dates, numbers, skills or achievements that are not given. Improve wording: short, active, professional lines. Translate if the input is in another language.
Reply with only a JSON object with these string keys: ${keys.join(", ")}. Use "\\n" between list lines. Keep a key empty if its input is empty.
Input: ${JSON.stringify(Object.fromEntries(keys.map((k) => [k, v[k] || ""])))}`);
      if (!r || typeof r !== "object") throw { code: "invalid_json" };
      prev = Object.fromEntries(keys.map((k) => [k, v[k] || ""]));
      keys.forEach((k) => { if (typeof r[k] === "string") v[k] = r[k].slice(0, 1200); });
      lsSet("p35:cv", v); fillCtrls(); draw(); undo.hidden = false;
      status.textContent = "تم. راجع كل سطر وتأكد إنه صحيح قبل ما تبعث.";
    } catch (e) { status.textContent = aiError(e); }
    finally { better.disabled = false; }
  } });
  el.replaceChildren(t35Wrap("مولّد السيرة الذاتية", "عبّي تفاصيلك مرة وحدة، اختار اللغة، وشوف المعاينة. بتقدر تنزّلها كملف وتفتحه وتطبعه PDF من المتصفح.",
    h("div", { class: "chips", role: "group", "aria-label": "لغة السيرة" }, Object.entries(T35_CV_L).map(([k, L]) => h("button", { class: "chip", type: "button", "aria-pressed": String(v.lang === k), text: L.name, onclick: (e) => { v.lang = k; lsSet("p35:cv", v); e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); draw(); } }))),
    h("p", { class: "muted small", text: "العناوين بتتغير حسب اللغة. اكتب المحتوى باللغة اللي بدك، أو اكتبه بالعربي وخلّي «حسّن بالذكاء» يترجم ويرتّب." }),
    h("div", { class: "form" }, fields),
    h("div", { class: "row" }, better, undo, t35AiGate("التحسين والترجمة بالذكاء بيشتغلوا لما تفتح المنصة من claude.ai. المعاينة والتنزيل بيشتغلوا دايمًا.")), status,
    h("h4", { text: "معاينة" }), preview,
    h("div", { class: "row" },
      h("button", { class: "btn blue", type: "button", text: "نزّل كصفحة (.html)", onclick: () => v.name ? saveFile(`CV-${v.name}.html`, htmlFile()) : toast("اكتب اسمك أول") }),
      h("button", { class: "btn ghost", type: "button", text: "نزّل كنص (.txt)", onclick: () => v.name ? saveFile(`CV-${v.name}.txt`, txtFile()) : toast("اكتب اسمك أول") })),
    h("p", { class: "muted small", text: "المسودة محفوظة على هذا المتصفح بس. لا تحط رقم هوية أو عنوان بيت كامل بالسيرة." })));
  draw();
}

// ---------- 113 · scholarship letter ----------
function toolLetter(el) {
  const v = lsGet("p35:letter", { lang: "he", text: "" });
  const inp = (k, label, ph, area) => {
    const c = area ? h("textarea", { id: "t35-lt-" + k, rows: 3, maxlength: 800, placeholder: ph, oninput: (e) => { v[k] = e.target.value; lsSet("p35:letter", v); } }) : h("input", { type: "text", id: "t35-lt-" + k, maxlength: 120, value: v[k] || "", placeholder: ph, oninput: (e) => { v[k] = e.target.value; lsSet("p35:letter", v); } });
    if (area) c.value = v[k] || "";
    return t35Field(label, c, area ? "full" : "");
  };
  const out = h("textarea", { id: "t35-lt-out", class: "t35-letter", rows: 14, placeholder: "الرسالة بتظهر هون، وبتقدر تعدّل عليها مثل ما بدك.", oninput: (e) => { v.text = e.target.value; lsSet("p35:letter", v); } });
  out.value = v.text || "";
  const stop = t35StopBtn();
  const btn = h("button", { class: "btn blue", type: "button", text: "اكتبلي مسودة", onclick: () => {
    if (!(v.study || v.why)) { toast("اكتب على الأقل شو بتدرس وليش محتاج المنحة"); return; }
    const lang = { he: "Hebrew", ar: "Modern Standard Arabic", en: "English" }[v.lang];
    t35Ai({ out, btn, stop, onDone: (t) => { v.text = t; lsSet("p35:letter", v); }, prompt:
`Write a scholarship application letter in ${lang}, written by the student in first person. About 220-300 words, warm but formal, clear paragraphs, no headings, no Markdown.
Use ONLY the facts below. Do not invent grades, numbers, awards, family details or dates. If a useful detail is missing, put a short placeholder in square brackets in the letter's language (e.g. [اسم المنحة]).
Facts:
- Scholarship / organisation: ${v.grant || "[unknown]"}
- Student name: ${v.name || "[name]"}
- Studies (institution, major, year): ${v.study || ""}
- Why I need support (financial/family situation): ${v.why || ""}
- Achievements: ${v.ach || ""}
- Volunteering / community: ${v.vol || ""}
- Goals after graduation: ${v.goal || ""}
Start with a greeting suitable for a scholarship committee, end with thanks and the student's name.` });
  } });
  el.replaceChildren(t35Wrap("رسالة طلب منحة", "اكتب الحقائق عنك، وClaude بيكتب مسودة مرتّبة. بعدها عدّل عليها بحرية، وانسخها لطلب المنحة.",
    h("div", { class: "chips", role: "group", "aria-label": "لغة الرسالة" }, [["he", "עברית"], ["ar", "العربية"], ["en", "English"]].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(v.lang === k), text: l, onclick: (e) => { v.lang = k; lsSet("p35:letter", v); e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); } }))),
    h("div", { class: "form" },
      inp("grant", "المنحة أو الجهة", "مثال: منحة پراح، منحة الجامعة الاجتماعية"),
      inp("name", "اسمك", ""),
      inp("study", "شو وين بتدرس", "مثال: تمريض، سنة أولى، جامعة بن غوريون", true),
      inp("why", "ليش محتاج الدعم", "وضع العائلة، عدد الإخوة الطلاب، شغل جنب التعليم…", true),
      inp("ach", "إنجازات (اختياري)", "علامات، جوائز، مشاريع", true),
      inp("vol", "تطوع ونشاط بالمجتمع (اختياري)", "", true),
      inp("goal", "هدفك بعد اللقب (اختياري)", "", true)),
    h("div", { class: "row" }, btn, stop), t35AiGate("كتابة المسودة بتحتاج المساعد. بتقدر تكتب الرسالة بنفسك بالمربّع تحت وتنسخها."),
    out,
    h("div", { class: "row" }, t35Copy(() => out.value, out), h("button", { class: "btn sm ghost", type: "button", text: "نزّل (.txt)", onclick: () => out.value.trim() ? saveFile("رسالة-منحة.txt", out.value) : toast("الرسالة فاضية") })),
    h("p", { class: "muted small", text: "اقرأ الرسالة كلها قبل ما تبعثها، وكمّل كل [فراغ]. لجان المنح بتحب التفاصيل الحقيقية والصادقة." })));
}

// ---------- register tools, search, home widget ----------
registerTool("sekhem", "حاسبة السيخم التقريبية", "بجروت + بسيخومتري بوزن بتختاره", toolSekhem, 22);
registerTool("admit", "هل أنا مقبول؟", "أرقامك جنب شروط المؤسسة المكتوبة", toolAdmit, 24);
registerTool("checklist", "قائمة مهام التسجيل", "وثائق، مواعيد ودفعات لكل مؤسسة", toolChecklist, 26);
registerTool("reminders", "تذكيرات المواعيد", "مواعيدك المهمة، وملف تقويم للتلفون", toolReminders, 28);
registerTool("roadmap", "خريطة طريق التخصص", "سنة بسنة: مساقات، تدريب وشغل (بالذكاء)", toolRoadmap, 34);
registerTool("english", "مستويات الإنجليزي", "من ترום بسيسي للإعفاء: شو يعني كل مستوى", toolEnglish, 42);
registerTool("reading", "سرعة القراءة بالعبري", "نص قصير، مؤقت، و3 أسئلة فهم", toolReading, 44);
registerTool("translate", "ترجم نص عبري", "الصق نص من الجامعة وافهم المطلوب", toolTranslate, 46);
registerTool("timetable", "الجدول الأسبوعي", "محاضرات وترچولات وساعات شغل", toolTimetable, 60);
registerTool("gpa", "المعدّل الجامعي", "معدّل موزون حسب נקודות זכות", toolGpa, 62);
registerTool("pomodoro", "مؤقت دراسة", "بومودورو مع إحصائيات يومية", toolPomodoro, 64);
registerTool("budget", "الميزانية الشهرية", "دخلك ومصاريفك، ووين بتروح المصاري", toolBudget, 66);
registerTool("abroad", "بالبلاد أو بالخارج؟", "قارن تكلفة اللقب جنب بعض", toolAbroad, 68);
registerTool("cv", "مولّد السيرة الذاتية", "عربي، عبري أو إنجليزي، وتنزيل ملف", toolCv, 70);
registerTool("letter", "رسالة طلب منحة", "مسودة من الحقائق عنك، وبتعدّلها", toolLetter, 72);

registerSearch("أدوات", (q) => {
  const out = [];
  if (matches("اسأل Claude مساعد ذكي سؤال تسجيل", q)) out.push({ title: "اسأل Claude", sub: "المساعد الذكي للتسجيل والتخصصات", go: "ask-claude" });
  for (const t of TOOLS) if (matches(t.title + " " + t.desc, q)) out.push({ title: t.title, sub: t.desc, go: "tools", onOpen: () => { toolTab = t.id; go("tools"); } });
  return out.slice(0, 8);
});

registerHome(() => {
  const remBox = h("div", { class: "t35-home-rem" });
  const draw = (rows) => {
    const today = t35Ymd();
    const next = rows.filter((r) => r.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    remBox.replaceChildren(next
      ? h("div", { class: "plain t35-rem" }, h("div", { class: "t35-rem-date" }, h("b", { class: "num", text: next.date.slice(8) }), h("span", { text: new Date(next.date + "T00:00").toLocaleDateString("ar-EG", { month: "short" }) })),
        h("div", { style: "min-width:0" }, h("span", { class: "muted small", text: "أقرب موعد عندك · " + t35In(t35DaysTo(next.date)) }), h("b", { style: "display:block", text: next.title })),
        h("button", { class: "link small", type: "button", text: "كل التذكيرات", onclick: () => { toolTab = "reminders"; go("tools"); } }))
      : h("button", { class: "link small", type: "button", text: "سجّل مواعيدك المهمة (تسجيل، امتحانات، دفعات) وبتظهر هون", onclick: () => { toolTab = "reminders"; go("tools"); } }));
  };
  if (S.uid) onLeave(t35Mine("p35-rem", draw)); else draw([]);
  return h("section", { class: "card stack t35-home" },
    eyebrow("المساعد الذكي"),
    h("div", { class: "spread" }, h("h2", { text: "عندك سؤال عن التسجيل؟ اسأل Claude" }), h("button", { class: "btn blue", type: "button", "data-go": "ask-claude", text: "افتح المساعد" })),
    h("p", { class: "muted", text: "شروط القبول، التخصصات، البسيخومتري والعبري، والمنح. بالعربي، ومن معلومات دليل المنصة، وبدون أرقام مخترعة." }),
    h("div", { class: "chips" }, ASK_STARTERS.slice(0, 3).map((s) => h("button", { class: "chip", type: "button", text: s, onclick: () => { ASK.draft = s; go("ask-claude"); } }))),
    remBox);
}, 15);
