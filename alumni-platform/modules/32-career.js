// ---------- career: opportunities board, mock interview, stories, businesses & freelancers, startups, recommendations, statistics ----------
const CR = { jobs: [], biz: [], stories: [], free: [], startups: [], votes: [], inc: [], incJoins: [], recs: [], jobsReady: false, bizReady: false };
const CR_KINDS = [["part", "شغل جزئي"], ["intern", "تدريب صيفي"], ["ref", "إحالة لشركة"], ["vol", "تطوع"]];
const CR_KIND = Object.fromEntries(CR_KINDS);
const CR_MODES = ["حضوري", "عن بُعد", "مختلط"];
const crState = { kind: "all", field: "all", q: "", bizTab: "biz", bizField: "all", bizTown: "all", bizQ: "", freeQ: "", stTab: "comp", recQ: "", statYear: "all" };

HOOKS.boot.push(() => {
  subscribe("jobs", { limit: 300 }, (rows) => { CR.jobs = rows; CR.jobsReady = true; crDrawJobs(); crDrawHomeJob(); });
  subscribe("businesses", { limit: 400 }, (rows) => { CR.biz = rows; CR.bizReady = true; crDrawBiz(); });
});
HOOKS.lists.push(() => { crDrawJobs(); crDrawHomeJob(); crDrawBiz(); crDrawFree(); crDrawStories(); crDrawStartups(); crDrawInc(); crDrawRecs(); crDrawStats(); crIvCap(); });
// Per-view subscription that stores rows in CR[key] and redraws.
function crSub(col, opts, key, draw) { onLeave(subscribe(col, opts, (rows) => { CR[key] = rows; resolveNames(rows.map((r) => r.uid)); draw(); })); }

// ===== 124/125/126/134 opportunities board =====
const crJobsVisible = () => crVisible("jobs", CR.jobs).filter((j) => !j.until || j.until + 86400000 > Date.now() || j.uid === S.uid);
function crJobForm() {
  if (!guardWrite() || !needProfile()) return;
  const me = S.alumni[S.uid] || {};
  const f = h("form", { class: "form cr-form" },
    crField("نوع الفرصة", crSelect("cr-j-kind", CR_KINDS, crState.kind === "all" ? "part" : crState.kind)),
    crField("المسمّى", h("input", { type: "text", id: "cr-j-title", required: true, maxlength: 90, placeholder: "مثال: موظف/ة مبيعات بالمسا" })),
    crField("الشركة أو الجهة", h("input", { type: "text", id: "cr-j-company", required: true, maxlength: 80, value: "" })),
    crField("المجال", crSelect("cr-j-field", CR_FIELDS, me.field && CR_FIELDS.includes(me.field) ? me.field : CR_FIELDS[0])),
    crField("البلد / المنطقة", h("input", { type: "text", id: "cr-j-town", maxlength: 50 })),
    crField("طريقة الشغل", crSelect("cr-j-mode", CR_MODES, CR_MODES[0])),
    crField("الساعات أو المدة", h("input", { type: "text", id: "cr-j-hours", maxlength: 60, placeholder: "مثال: 3 مسايات بالأسبوع" })),
    crField("آخر موعد للتقديم (اختياري)", h("input", { type: "date", id: "cr-j-until" })),
    crField("كيف بقدّموا؟", h("textarea", { id: "cr-j-how", required: true, maxlength: 1200, placeholder: "الخطوات، شو لازم يبعتوا، لمين يتوجهوا" }), "full"),
    crField("رابط الإعلان الرسمي (اختياري)", h("input", { type: "url", id: "cr-j-link", maxlength: 300, placeholder: "https://" })),
    crField("تواصل (اختياري)", h("input", { type: "text", id: "cr-j-contact", maxlength: 80, value: me.contact || "" })),
    h("p", { class: "full muted small", id: "cr-j-hint" }),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "انشر الفرصة" })));
  const hint = () => { $("#cr-j-hint", f).textContent = $("#cr-j-kind", f).value === "ref"
    ? "الإحالة بس من شركة إنت بتشتغل فيها فعلًا. اكتب اسم الشركة الحقيقي وشو المجالات اللي بتقدر تحيل عليها."
    : "انشر فرص حقيقية بس، ومع شروط واضحة. لا تطلب من الطلاب أي دفعة مقابل الشغل."; };
  f.querySelector("#cr-j-kind").addEventListener("change", hint); hint();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const until = $("#cr-j-until", f).value ? new Date($("#cr-j-until", f).value).getTime() : null;
    const data = { uid: S.uid, kind: $("#cr-j-kind", f).value, title: $("#cr-j-title", f).value.trim(), company: $("#cr-j-company", f).value.trim(),
      field: $("#cr-j-field", f).value, town: $("#cr-j-town", f).value.trim(), mode: $("#cr-j-mode", f).value, hours: $("#cr-j-hours", f).value.trim(),
      until, how: $("#cr-j-how", f).value.trim(), link: safeUrl($("#cr-j-link", f).value) || "", contact: $("#cr-j-contact", f).value.trim(), closed: false, createdAt: Date.now() };
    if (!data.title || !data.company || !data.how) return;
    if (await addDoc("jobs", data)) { close(); toast("انتشرت الفرصة"); }
  });
  const close = modal("انشر فرصة", f);
}
function crJobCard(j, compact) {
  const pillCls = { part: "pill", intern: "pill good", ref: "pill warn", vol: "pill grey" }[j.kind] || "pill";
  return h("article", { class: "card item cr-job" + (j.closed ? " cr-closed" : "") },
    h("div", { class: "row" }, h("span", { class: pillCls, text: CR_KIND[j.kind] || j.kind }), j.field ? h("span", { class: "pill grey", text: j.field }) : null,
      j.closed ? h("span", { class: "pill warn", text: "انملت" }) : null, h("span", { class: "muted small cr-push", text: rel(j.createdAt) })),
    h("h3", { text: j.title }),
    h("div", { class: "meta" }, h("b", { class: "cr-co", text: j.company }), j.town ? h("span", { text: j.town }) : null, j.mode ? h("span", { text: j.mode }) : null, j.hours ? h("span", { text: j.hours }) : null),
    j.until ? h("div", { class: "small" }, "آخر موعد: ", h("b", { text: crDate(j.until, false) })) : null,
    compact ? null : h("div", { class: "cr-how" }, h("h4", { text: j.kind === "ref" ? "كيف تطلب الإحالة" : "كيف تقدّم" }), h("p", { text: j.how })),
    compact ? null : crWho(j.uid, j.kind === "ref" ? "بيحيل من شغله" : "نشر الفرصة"),
    compact ? null : h("div", { class: "row" },
      crLink(j.link, "الإعلان الرسمي", "btn sm blue"),
      j.contact ? h("span", { class: "small" }, "تواصل: ", h("b", { text: j.contact })) : null,
      j.kind === "ref" && j.uid !== S.uid && !j.closed ? h("button", { class: "btn sm", type: "button", text: "اطلب إحالة", onclick: () => crAskRef(j) }) : null),
    compact ? h("button", { class: "link small", type: "button", "data-go": "jobs", text: "كل الفرص" }) : h("div", { class: "row" },
      crCanManage(j) ? h("button", { class: "link small", type: "button", text: j.closed ? "رجّعها مفتوحة" : "علّمها «انملت»", onclick: async () => { const { id, ...d } = j; await setDoc("jobs", id, { ...d, closed: !j.closed }); } }) : null,
      rowActions("jobs", j), crReport("jobs", j)));
}
function crAskRef(j) {
  if (!guardWrite() || !needProfile()) return;
  const ta = h("textarea", { id: "cr-ref-msg", maxlength: 400, placeholder: "عرّف عن حالك بجملتين: شو بتدرس، شو الوظيفة اللي بدك إياها، وكيف يتواصل معك" });
  const close = modal("اطلب إحالة", h("div", { class: "stack" },
    h("p", { class: "muted", text: "الطلب بيوصل لصاحب الإحالة كإشعار، وهو بيقرّر إذا مناسب. تأكد إنه ملفك فيه طريقة تواصل." }),
    crField("رسالتك", ta),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", text: "أرسل الطلب", onclick: () => {
      const t = ta.value.trim(); if (!t) { toast("اكتب رسالة قصيرة"); return; }
      crNote(j.uid, "referral", `طلب إحالة لـ «${j.title}» من ${nameOf(S.uid)}: ${t}`, "jobs"); close(); toast("وصل طلبك. إذا مناسب، رح يتواصل معك");
    } }))));
}
function crDrawJobs() {
  if (!$("#cr-jobs")) return;
  const q = crState.q.trim();
  const rows = crJobsVisible().filter((j) => (crState.kind === "all" || j.kind === crState.kind) && (crState.field === "all" || j.field === crState.field) &&
    matches([j.title, j.company, j.town, j.how, j.field].join(" "), q)).sort((a, b) => (a.closed - b.closed) || b.createdAt - a.createdAt);
  const emptyMsg = { ref: ["لسا ما في إحالات", "إذا بتشتغل بشركة وبتقدر تحيل طلاب أو خريجين، انشر «إحالة لشركة»."], intern: ["ما في تدريبات صيفية منشورة", "خريجين بالشركات: إذا في تدريب صيفي عندكم، انشروه هون."], vol: ["ما في فرص تطوع لسا", "جمعية أو مبادرة بتحتاج متطوعين؟ انشرها وخلي الطلاب يبنوا خبرة."] }[crState.kind] || ["ما في فرص هون لسا", "شفت شغل بيناسب الطلاب؟ انشره من «انشر فرصة»."];
  crFill("cr-jobs", rows.length ? rows.map((j) => crJobCard(j)) : [CR.jobsReady ? empty(emptyMsg[0], emptyMsg[1]) : h("p", { class: "muted", text: "جارِ التحميل…" })]);
}
views.jobs = () => {
  const v = h("div", { class: "view" },
    head("المسار المهني", "فرص شغل وتدريب", "شغل جزئي بيناسب الدراسة، تدريب صيفي، إحالات من خريجين بالشركات، وفرص تطوع بتبني خبرة."),
    writeBanner(),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", text: "انشر فرصة", onclick: crJobForm })),
    h("div", { class: "section" },
      h("div", { class: "chips", role: "group", "aria-label": "نوع الفرصة" }, [["all", "الكل"], ...CR_KINDS].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(crState.kind === k), text: l, onclick: () => { crState.kind = k; go("jobs"); } }))),
      h("div", { class: "form" },
        crField("بحث", h("input", { type: "search", id: "cr-jobs-q", value: crState.q, placeholder: "مسمّى، شركة، بلد" })),
        crField("المجال", crSelect("cr-jobs-field", CR_FIELDS, crState.field, ["all", "كل المجالات"]))),
      h("div", { class: "grid", id: "cr-jobs" })),
    h("section", { class: "section" }, h("h2", { text: "فعاليات مهنية" }),
      h("p", { class: "muted", text: "يوم المهن بالمدرسة، ورشات ريادة أعمال ومهارات حياتية." }),
      evEmbed(["يوم مهن", "ورشة ريادة أعمال", "ورشة مهارات حياتية"], "إذا بتنظّم يوم مهن أو ورشة، انشر موعدها هون.")),
  );
  queueMicrotask(() => {
    $("#cr-jobs-q")?.addEventListener("input", (e) => { crState.q = e.target.value; crDrawJobs(); });
    $("#cr-jobs-field")?.addEventListener("change", (e) => { crState.field = e.target.value; crDrawJobs(); });
  });
  return v;
};
registerView("jobs", "career", "فرص", null, { order: 10 });
registerHome(() => h("section", { class: "section" },
  h("div", { class: "spread" }, h("h2", { text: "أحدث فرصة" }), h("button", { class: "link", type: "button", "data-go": "jobs", text: "كل الفرص" })),
  h("div", { id: "cr-home-job" })), 35);
function crDrawHomeJob() {
  if (!$("#cr-home-job")) return;
  const j = crJobsVisible().filter((x) => !x.closed).sort((a, b) => b.createdAt - a.createdAt)[0];
  crFill("cr-home-job", [j ? crJobCard(j, true) : empty("لسا ما في فرص منشورة", "بتعرف عن شغل جزئي أو تدريب للطلاب؟ انشره بقسم «المسار المهني».")]);
}
registerSearch("فرص شغل وتدريب", (q) => crJobsVisible().filter((j) => matches([j.title, j.company, j.town, j.field].join(" "), q)).slice(0, 8)
  .map((j) => ({ title: j.title, sub: (CR_KIND[j.kind] || "") + " · " + j.company, go: "jobs", onOpen: () => modal(CR_KIND[j.kind] || "فرصة", h("div", { class: "stack" }, crJobCard(j))) })));

// ===== 127 mock job interview with Claude =====
const CR_IV_LANGS = [["ar", "عربي"], ["he", "עברית"], ["en", "English"]];
const crIv = { role: "", field: "", lang: "ar", level: "طالب/ة جامعي/ة", msgs: [], busy: false, done: false, ctrl: null, max: 6 };
function crIvPrompt() {
  const lang = { ar: "Arabic (simple, Palestinian-friendly Modern Standard Arabic)", he: "Hebrew", en: "English" }[crIv.lang];
  return `You are a professional, friendly job interviewer running a PRACTICE interview to train a young Arab candidate from the Negev, Israel.
Role: "${crIv.role}". Field: "${crIv.field}". Candidate level: "${crIv.level}". Interview language: ${lang}.
Rules: ask exactly ONE question per reply (max 2 short sentences), in the interview language. Start with a short greeting and an opening "tell me about yourself"-type question. Then mix motivation, behavioural (STAR), role-specific and situational questions, adapting to the previous answers. Do not answer for the candidate, do not give feedback or scores until asked. You may react with a few words before the next question. Do not invent facts about real companies. Plain text, no markdown.`;
}
const crIvFeedback = `[The candidate ended the interview.] Now give feedback in Arabic (clear, warm, direct), even if the interview was in another language; quote phrases in the interview language when useful. Structure in plain text with short headings:
1) نقاط القوة (2-3 bullets)
2) شو تحسّن (one concrete point per answer)
3) جواب أقوى: rewrite the weakest answer as a better example, in the interview language
4) علامة تقريبية من 10 مع جملة تفسير.
Be honest; if answers were very short or empty, say so kindly.`;
function crIvMsgs(extraForLast) {
  const list = crIv.msgs.map((m, i) => ({ role: m.role, content: i === 0 ? crIvPrompt() + "\n\n" + m.content : m.content }));
  if (extraForLast) list[list.length - 1] = { role: "user", content: list[list.length - 1].content + "\n\n" + extraForLast };
  return list;
}
async function crIvAsk(feedback) {
  if (!CAP.sample) { toast(aiError({ code: "not_granted" })); return; }
  crIv.busy = true; crIv.ctrl = new AbortController();
  const bubble = { role: "assistant", content: "", feedback: !!feedback, pending: true };
  const input = crIvMsgs(feedback ? crIvFeedback : null);
  crIv.msgs.push(bubble); crIvLog();
  try {
    const text = await ai(input, { signal: crIv.ctrl.signal, onText: ({ text }) => { bubble.content = text; const p = $("#cr-iv-live"); if (p) p.textContent = text; } });
    bubble.content = text;
    if (feedback) crIv.done = true;
  } catch (e) {
    if (e?.name === "AbortError" || e?.code === "aborted") { crIv.msgs.pop(); }
    else { bubble.content = aiError(e); bubble.error = true; }
  }
  bubble.pending = false; crIv.busy = false; crIvLog();
}
function crIvLog() {
  const log = $("#cr-iv-log"); if (!log) return;
  const qCount = crIv.msgs.filter((m) => m.role === "assistant" && !m.feedback && !m.error).length;
  log.replaceChildren(...crIv.msgs.map((m, i) => {
    if (i === 0) return h("div", { class: "cr-iv-sys small muted", text: m.content });
    return h("div", { class: "msg cr-iv-msg" + (m.role === "user" ? " mine" : "") + (m.feedback ? " cr-iv-fb" : "") },
      h("div", { class: "meta" }, h("span", { class: "who", text: m.role === "user" ? "إنت" : m.feedback ? "التقييم" : "المُقابِل" })),
      h("p", { id: m.pending ? "cr-iv-live" : null, dir: "auto", text: m.content || (m.pending ? "…" : "") }));
  }));
  log.scrollTop = log.scrollHeight;
  const st = $("#cr-iv-status");
  if (st) st.textContent = crIv.done ? "خلصت المقابلة. اقرأ التقييم، وجرّب مرة ثانية." : crIv.busy ? "المُقابِل بيكتب…" : `سؤال ${qCount} من ${crIv.max}`;
  const send = $("#cr-iv-send"), fin = $("#cr-iv-end"), ans = $("#cr-iv-answer");
  if (send) send.disabled = crIv.busy || crIv.done;
  if (ans) ans.disabled = crIv.busy || crIv.done;
  if (fin) fin.disabled = crIv.busy || crIv.done || qCount < 1;
}
function crIvCap() {
  const box = $("#cr-iv-cap"); if (!box) return;
  box.replaceChildren(...(CAP.sample ? [] : [h("div", { class: "banner warn" }, "المقابلة التجريبية بتشتغل مع المساعد الذكي بس. افتح المنصة من رابطها على claude.ai واسمح للمساعد، وبعدها ارجع لهون.")]));
  const b = $("#cr-iv-start"); if (b) b.disabled = !CAP.sample;
}
function crIvView() {
  const wrap = h("div", { class: "stack", id: "cr-iv-wrap" });
  const draw = () => {
    if (!crIv.msgs.length) {
      const f = h("form", { class: "card form cr-form", id: "cr-iv-setup" },
        crField("الوظيفة", h("input", { type: "text", id: "cr-iv-role", required: true, maxlength: 80, value: crIv.role, placeholder: "مثال: ممرض/ة متدرّب/ة، مطوّر/ة برمجيات، كاشير" })),
        crField("المجال", crSelect("cr-iv-field", CR_FIELDS, crIv.field || CR_FIELDS[0])),
        crField("لغة المقابلة", crSelect("cr-iv-lang", CR_IV_LANGS, crIv.lang)),
        crField("وضعك", crSelect("cr-iv-level", ["طالب/ة ثانوي/ة", "طالب/ة جامعي/ة", "خريج/ة جديد/ة", "عندي خبرة"], crIv.level)),
        h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", id: "cr-iv-start", disabled: CAP.sample ? null : true, text: "ابدأ المقابلة" }),
          h("span", { class: "muted small", text: `${crIv.max} أسئلة، سؤال سؤال، وبالآخر تقييم مفصّل.` })));
      f.addEventListener("submit", (e) => {
        e.preventDefault(); if (!CAP.sample) return;
        crIv.role = $("#cr-iv-role", f).value.trim(); crIv.field = $("#cr-iv-field", f).value; crIv.lang = $("#cr-iv-lang", f).value; crIv.level = $("#cr-iv-level", f).value;
        if (!crIv.role) return;
        crIv.msgs = [{ role: "user", content: "ابدأ المقابلة." }]; crIv.done = false;
        draw(); crIvAsk(false);
      });
      wrap.replaceChildren(f);
      return;
    }
    const ans = h("textarea", { id: "cr-iv-answer", dir: "auto", maxlength: 2500, placeholder: "اكتب جوابك هون كأنك بالمقابلة…", "aria-label": "جوابك" });
    const form = h("form", { class: "stack cr-iv-compose" }, ans,
      h("div", { class: "row" },
        h("button", { class: "btn blue", type: "submit", id: "cr-iv-send", text: "أرسل الجواب" }),
        h("button", { class: "btn ghost", type: "button", id: "cr-iv-end", text: "خلّص واعطيني تقييم", onclick: () => { if (crIv.msgs[crIv.msgs.length - 1].role !== "user") crIv.msgs.push({ role: "user", content: "(ما في جواب على هذا السؤال)" }); crIvAsk(true); } }),
        h("button", { class: "btn ghost", type: "button", text: "مقابلة جديدة", onclick: () => { crIv.ctrl?.abort(); crIv.msgs = []; crIv.done = false; crIv.busy = false; draw(); } })));
    ans.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });
    form.addEventListener("submit", (e) => {
      e.preventDefault(); if (crIv.busy || crIv.done) return;
      const t = ans.value.trim(); if (!t) return;
      ans.value = ""; crIv.msgs.push({ role: "user", content: t });
      const qCount = crIv.msgs.filter((m) => m.role === "assistant" && !m.feedback && !m.error).length;
      crIvAsk(qCount >= crIv.max);
    });
    wrap.replaceChildren(h("div", { class: "card cr-iv" },
      h("div", { class: "spread cr-iv-head" }, h("div", null, h("b", { text: crIv.role }), h("div", { class: "muted small", text: crIv.field + " · " + (CR_IV_LANGS.find((l) => l[0] === crIv.lang) || [])[1] })), h("span", { class: "pill", id: "cr-iv-status", "aria-live": "polite" })),
      h("div", { class: "cr-iv-log", id: "cr-iv-log" }), form));
    queueMicrotask(crIvLog);
  };
  draw();
  return wrap;
}
views.interview = () => {
  onLeave(() => { if (crIv.busy) crIv.ctrl?.abort(); });
  return h("div", { class: "view" },
    head("المسار المهني", "مقابلة عمل تجريبية", "تدرّب على مقابلة حقيقية مع المساعد الذكي: بيسألك سؤال سؤال بالعربي، العبري أو الإنجليزي، وبالآخر بيعطيك ملاحظات."),
    h("div", { id: "cr-iv-cap" }),
    crIvView(),
    h("div", { class: "plain stack" }, h("h4", { text: "قبل ما تبلّش" }),
      reqList(["جاوب كأنها مقابلة حقيقية: جمل كاملة، وأمثلة من تجربتك.", "استعمل طريقة STAR: الموقف، المهمة، شو عملت، وشو النتيجة.", "المحادثة ما بتنحفظ، ولا تكتب معلومات شخصية حساسة."])));
};
registerView("interview", "career", "مقابلة تجريبية", null, { order: 20 });

// ===== 130 career stories =====
function crDrawStories() {
  if (!$("#cr-stories")) return;
  const rows = crVisible("careerstories", CR.stories);
  crFill("cr-stories", rows.length ? rows.map((s) => h("article", { class: "card item cr-story" },
    crWho(s.uid, rel(s.createdAt)),
    h("h3", { text: s.role }), s.org ? h("div", { class: "meta" }, h("span", { text: s.org })) : null,
    h("p", { text: s.path }),
    s.tip ? h("div", { class: "cr-tip" }, h("h4", { text: "نصيحتي إلك" }), h("p", { text: s.tip })) : null,
    h("div", { class: "row" }, rowActions("careerstories", s), crReport("careerstories", s))))
    : [empty("لسا ما في قصص", "إذا بتشتغل، احكي لطلاب المدرسة كيف وصلت: شو درست، أول شغل، وشو كان صعب.")]);
}
views.stories = () => {
  crSub("careerstories", { limit: 200 }, "stories", crDrawStories);
  const f = h("form", { class: "card form cr-form" },
    crField("شو وظيفتك اليوم؟", h("input", { type: "text", id: "cr-s-role", required: true, maxlength: 80, placeholder: "مثال: ممرضة بقسم الأطفال" })),
    crField("وين (اختياري)", h("input", { type: "text", id: "cr-s-org", maxlength: 80, placeholder: "اسم المكان إذا بتحب" })),
    crField("كيف وصلت؟", h("textarea", { id: "cr-s-path", required: true, maxlength: 2500, placeholder: "من التوجيهي للشغل: شو درست، كيف لقيت أول وظيفة، شو كان صعب وشو ساعدك" }), "full"),
    crField("نصيحة وحدة للطلاب", h("input", { type: "text", id: "cr-s-tip", maxlength: 200 }), "full"),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "شارك قصتك" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, role: $("#cr-s-role", f).value.trim(), org: $("#cr-s-org", f).value.trim(), path: $("#cr-s-path", f).value.trim(), tip: $("#cr-s-tip", f).value.trim(), createdAt: Date.now() };
    if (!d.role || !d.path) return;
    if (await addDoc("careerstories", d)) { f.reset(); toast("انتشرت قصتك، شكرًا"); }
  });
  return h("div", { class: "view" },
    head("المسار المهني", "كيف وصلت لوظيفتي", "قصص حقيقية من خريجي المدرسة: الطريق من الصف للشغل، بكل تفاصيله."),
    writeBanner(), f, h("div", { class: "stack", id: "cr-stories" }));
};
registerView("stories", "career", "قصص مهنية", null, { order: 30 });

// ===== 132/133 businesses + 140 freelancers =====
function crBizForm() {
  if (!guardWrite() || !needProfile()) return;
  const me = S.alumni[S.uid] || {};
  const f = h("form", { class: "form cr-form" },
    crField("اسم المصلحة", h("input", { type: "text", id: "cr-b-name", required: true, maxlength: 80 })),
    crField("المجال", crSelect("cr-b-field", CR_FIELDS, CR_FIELDS[0])),
    crField("البلد", h("input", { type: "text", id: "cr-b-town", required: true, maxlength: 50, value: me.city || "" })),
    crField("تواصل", h("input", { type: "text", id: "cr-b-contact", required: true, maxlength: 80, value: me.contact || "", placeholder: "هاتف المصلحة، إنستغرام أو إيميل" })),
    crField("موقع أو صفحة (اختياري)", h("input", { type: "url", id: "cr-b-link", maxlength: 300, placeholder: "https://" })),
    crField("شو بتقدّموا؟", h("textarea", { id: "cr-b-desc", required: true, maxlength: 800 }), "full"),
    h("label", { class: "check full" }, h("input", { type: "checkbox", id: "cr-b-disc" }), "في خصم أو تعاون خاص لخريجي وطلاب المدرسة"),
    h("p", { class: "full muted small", text: "أضف بس مصلحة إلك أو إلك فيها شراكة، أو بموافقة صاحبها." }),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف للدليل" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = { uid: S.uid, name: $("#cr-b-name", f).value.trim(), field: $("#cr-b-field", f).value, town: $("#cr-b-town", f).value.trim(), contact: $("#cr-b-contact", f).value.trim(),
      link: safeUrl($("#cr-b-link", f).value) || "", desc: $("#cr-b-desc", f).value.trim(), discount: $("#cr-b-disc", f).checked, createdAt: Date.now() };
    if (!d.name || !d.town || !d.contact || !d.desc) return;
    if (await addDoc("businesses", d)) { close(); toast("انضافت المصلحة للدليل"); }
  });
  const close = modal("أضف مصلحة", f);
}
function crBizCard(b) {
  return h("article", { class: "card item" },
    h("div", { class: "row" }, h("span", { class: "pill", text: b.field }), h("span", { class: "pill grey", text: b.town }), b.discount ? h("span", { class: "pill good", text: "خصم لأبناء المدرسة" }) : null),
    h("h3", { text: b.name }), h("p", { text: b.desc }),
    h("div", { class: "small" }, "تواصل: ", h("b", { text: b.contact })),
    crWho(b.uid, "صاحب/ة المصلحة"),
    h("div", { class: "row" }, crLink(b.link, "الموقع"), rowActions("businesses", b), crReport("businesses", b)));
}
function crDrawBiz() {
  if (!$("#cr-biz")) return;
  const all = crVisible("businesses", CR.biz);
  const towns = [...new Set(all.map((b) => b.town).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  const ts = $("#cr-biz-town");
  if (ts && ts.options.length !== towns.length + 1) ts.replaceChildren(opt("all", "كل البلدان", crState.bizTown === "all"), ...towns.map((t) => opt(t, t, crState.bizTown === t)));
  const q = crState.bizQ.trim();
  const rows = all.filter((b) => (crState.bizField === "all" || b.field === crState.bizField) && (crState.bizTown === "all" || b.town === crState.bizTown) && matches([b.name, b.desc, b.town, b.field].join(" "), q));
  crFill("cr-biz", rows.length ? rows.map(crBizCard) : [CR.bizReady ? empty(all.length ? "ما في نتائج" : "الدليل فاضي لسا", all.length ? "جرّب مجال أو بلد ثاني." : "عندك مصلحة؟ أضفها، وخلي أبناء المدرسة يشتروا محلي ويتعاونوا معك.") : h("p", { class: "muted", text: "جارِ التحميل…" })]);
}
function crDrawFree() {
  if (!$("#cr-free")) return;
  const q = crState.freeQ.trim();
  const rows = crVisible("freelancers", CR.free).filter((x) => matches([x.title, x.skills, x.desc, nameOf(x.uid)].join(" "), q));
  crFill("cr-free", rows.length ? rows.map((x) => h("article", { class: "card item" },
    crWho(x.uid, S.alumni[x.uid]?.city || ""),
    h("h3", { text: x.title }),
    h("div", { class: "chips" }, String(x.skills || "").split(/[،,]/).map((s) => s.trim()).filter(Boolean).slice(0, 10).map((s) => h("span", { class: "tag", text: s }))),
    x.desc ? h("p", { text: x.desc }) : null,
    x.rate ? h("div", { class: "num cr-rate", text: x.rate }) : null,
    S.alumni[x.uid]?.contact ? h("div", { class: "small" }, "تواصل: ", h("b", { text: S.alumni[x.uid].contact })) : null,
    h("div", { class: "row" }, crLink(x.portfolio, "معرض الأعمال"), rowActions("freelancers", x), crReport("freelancers", x))))
    : [empty("لسا ما في مستقلين", "بتشتغل فريلانس (تصميم، برمجة، ترجمة، تصوير…)؟ أضف حالك بالنموذج فوق.")]);
}
function crFreeForm() {
  const mine = CR.free.find((x) => x.id === S.uid) || {};
  const f = h("form", { class: "card form cr-form" },
    h("h3", { class: "full", text: mine.title ? "بطاقتك ببنك المستقلين" : "أضف حالك لبنك المستقلين" }),
    crField("شو بتقدّم؟", h("input", { type: "text", id: "cr-f-title", required: true, maxlength: 80, value: mine.title || "", placeholder: "مثال: تصميم هويات ولوغوهات" })),
    crField("مهارات (افصل بفاصلة)", h("input", { type: "text", id: "cr-f-skills", maxlength: 200, value: mine.skills || "", placeholder: "Figma، فوتوشوب، موشن" })),
    crField("السعر (إنت بتحدده)", h("input", { type: "text", id: "cr-f-rate", maxlength: 60, value: mine.rate || "", placeholder: "مثال: ₪120 للساعة، أو حسب المشروع" })),
    crField("رابط معرض أعمال", h("input", { type: "url", id: "cr-f-port", maxlength: 300, value: mine.portfolio || "", placeholder: "https://behance.net/…" })),
    crField("نبذة", h("textarea", { id: "cr-f-desc", maxlength: 600, text: mine.desc || "" }), "full"),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: mine.title ? "حدّث بطاقتي" : "أضفني" }),
      h("span", { class: "muted small", text: "التواصل بيظهر من ملفك الشخصي." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, title: $("#cr-f-title", f).value.trim(), skills: $("#cr-f-skills", f).value.trim(), rate: $("#cr-f-rate", f).value.trim(),
      portfolio: safeUrl($("#cr-f-port", f).value) || "", desc: $("#cr-f-desc", f).value.trim(), createdAt: mine.createdAt || Date.now(), updatedAt: Date.now() };
    if (!d.title) return;
    if (await setDoc("freelancers", S.uid, d)) toast("انحفظت بطاقتك");
  });
  return f;
}
views.biz = () => {
  const tabs = h("div", { class: "chips", role: "group", "aria-label": "القسم" }, [["biz", "مصالح الخريجين"], ["free", "بنك المستقلين"]].map(([k, l]) =>
    h("button", { class: "chip", type: "button", "aria-pressed": String(crState.bizTab === k), text: l, onclick: () => { crState.bizTab = k; go("biz"); } })));
  const v = h("div", { class: "view" }, head("المسار المهني", "مصالح ومستقلين من المدرسة", "اشترِ محلي، تعاون، وشغّل أبناء مدرستك: دليل مصالح الخريجين وبنك المستقلين."), writeBanner(), tabs);
  if (crState.bizTab === "biz") {
    v.append(h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", text: "أضف مصلحتك", onclick: crBizForm })),
      h("div", { class: "form" },
        crField("بحث", h("input", { type: "search", id: "cr-biz-q", value: crState.bizQ, placeholder: "اسم، خدمة، بلد" })),
        crField("المجال", crSelect("cr-biz-field", CR_FIELDS, crState.bizField, ["all", "كل المجالات"])),
        crField("البلد", h("select", { id: "cr-biz-town" }, opt("all", "كل البلدان")))),
      h("div", { class: "grid", id: "cr-biz" }));
    queueMicrotask(() => {
      $("#cr-biz-q")?.addEventListener("input", (e) => { crState.bizQ = e.target.value; crDrawBiz(); });
      $("#cr-biz-field")?.addEventListener("change", (e) => { crState.bizField = e.target.value; crDrawBiz(); });
      $("#cr-biz-town")?.addEventListener("change", (e) => { crState.bizTown = e.target.value; crDrawBiz(); });
    });
  } else {
    crSub("freelancers", { order: "updatedAt", limit: 300 }, "free", () => {
      crDrawFree();
      const at = CR.free.find((x) => x.id === S.uid)?.updatedAt || 0, box = $("#cr-free-form");
      if (box && at !== crState.freeMineAt) { crState.freeMineAt = at; box.replaceChildren(crFreeForm()); }
    });
    v.append(h("div", { id: "cr-free-form" }, crFreeForm()),
      crField("بحث بالمهارة", h("input", { type: "search", id: "cr-free-q", value: crState.freeQ, placeholder: "تصميم، ترجمة، برمجة…" })),
      h("div", { class: "grid", id: "cr-free" }));
    queueMicrotask(() => $("#cr-free-q")?.addEventListener("input", (e) => { crState.freeQ = e.target.value; crDrawFree(); }));
  }
  return v;
};
registerView("biz", "career", "مصالح ومستقلين", null, { order: 40 });
registerSearch("مصالح الخريجين", (q) => crVisible("businesses", CR.biz).filter((b) => matches([b.name, b.field, b.town, b.desc].join(" "), q)).slice(0, 8)
  .map((b) => ({ title: b.name, sub: b.field + " · " + b.town, go: "biz", onOpen: () => { crState.bizTab = "biz"; modal("مصلحة", h("div", { class: "stack" }, crBizCard(b))); } })));

// ===== 137/138/139 entrepreneurship: idea competition + mini incubator =====
const crRound = () => "r" + THIS_YEAR;
function crDrawStartups() {
  if (!$("#cr-st")) return;
  const ideas = crVisible("startups", CR.startups).filter((x) => x.round === crRound());
  const votes = CR.votes.filter((v) => v.round === crRound());
  const count = {}; votes.forEach((v) => { count[v.idea] = (count[v.idea] || 0) + 1; });
  const myVote = votes.find((v) => v.uid === S.uid)?.idea;
  const ranked = ideas.slice().sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0) || a.createdAt - b.createdAt);
  crFill("cr-st", ranked.length ? ranked.map((x, i) => h("article", { class: "card item cr-idea" },
    h("div", { class: "spread" }, h("div", { class: "row" }, h("span", { class: "cr-rank num", "aria-label": "المرتبة " + (i + 1), text: String(i + 1) }), h("h3", { text: x.title })),
      h("span", { class: "pill num", text: `${count[x.id] || 0} صوت` })),
    h("div", { class: "cr-kv" }, h("h4", { text: "المشكلة" }), h("p", { text: x.problem })),
    h("div", { class: "cr-kv" }, h("h4", { text: "الحل" }), h("p", { text: x.solution })),
    x.team ? h("div", { class: "cr-kv" }, h("h4", { text: "الفريق" }), h("p", { text: x.team })) : null,
    crWho(x.uid, rel(x.createdAt)),
    h("div", { class: "row" },
      x.uid === S.uid ? h("span", { class: "muted small", text: "فكرتك (ما بتقدر تصوّت لحالك)" })
        : myVote === x.id ? h("span", { class: "pill good", text: "صوتك هون" })
          : h("button", { class: "btn sm blue", type: "button", text: myVote ? "انقل صوتي لهون" : "صوّت", onclick: async () => {
            if (!guardWrite() || !needProfile()) return;
            if (await setDoc("startupvotes", crRound() + "__" + S.uid, { uid: S.uid, round: crRound(), idea: x.id, createdAt: Date.now() })) toast("انحسب صوتك");
          } }),
      rowActions("startups", x), crReport("startups", x))))
    : [empty("لسا ما في أفكار بمسابقة هالسنة", "عندك فكرة مشروع؟ اكتب المشكلة والحل وقدّمها للمسابقة.")]);
}
function crDrawInc() {
  if (!$("#cr-inc")) return;
  const rows = crVisible("incubator", CR.inc);
  crFill("cr-inc", rows.length ? rows.map((p) => {
    const joins = CR.incJoins.filter((j) => j.project === p.id);
    const mine = joins.some((j) => j.uid === S.uid);
    return h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: "pill", text: p.stage }), p.field ? h("span", { class: "pill grey", text: p.field }) : null),
      h("h3", { text: p.name }), h("p", { text: p.desc }),
      h("div", { class: "cr-kv" }, h("h4", { text: "بندوّر على" }), h("div", { class: "chips" }, String(p.needs || "").split(/[،,]/).map((s) => s.trim()).filter(Boolean).map((s) => h("span", { class: "tag", text: s })))),
      p.offer ? h("div", { class: "cr-kv" }, h("h4", { text: "شو بنقدّم للشريك" }), h("p", { text: p.offer })) : null,
      crWho(p.uid, "صاحب/ة المشروع"),
      h("div", { class: "row" },
        p.uid === S.uid ? h("button", { class: "btn sm ghost", type: "button", text: `المهتمين (${joins.length})`, onclick: () => modal("المهتمين بـ " + p.name, h("div", { class: "stack" },
          ...(joins.length ? joins.map((j) => h("div", { class: "plain item" }, crWho(j.uid, S.alumni[j.uid]?.contact || ""), h("p", { text: j.text }))) : [empty("لسا ما حدا", "شارك رابط المنصة مع ناس ممكن يهتموا.")]))) })
          : mine ? h("span", { class: "pill good", text: "بعتت اهتمامك" })
            : h("button", { class: "btn sm blue", type: "button", text: "بدي أنضم", onclick: () => crIncJoin(p) }),
        rowActions("incubator", p), crReport("incubator", p)));
  }) : [empty("ما في مشاريع بالحاضنة لسا", "عندك مشروع وبدك شريك بمهارة معيّنة؟ اعرضه هون.")]);
}
function crIncJoin(p) {
  if (!guardWrite() || !needProfile()) return;
  const ta = h("textarea", { id: "cr-inc-msg", maxlength: 400, placeholder: "شو المهارة اللي بتجيبها، وقديش وقت عندك بالأسبوع؟" });
  const close = modal("بدي أنضم لـ " + p.name, h("div", { class: "stack" }, crField("عرّف عن حالك", ta),
    h("button", { class: "btn blue", type: "button", text: "أرسل", onclick: async () => {
      const t = ta.value.trim(); if (!t) return;
      if (await setDoc("incjoins", p.id + "__" + S.uid, { uid: S.uid, project: p.id, text: t, createdAt: Date.now() })) {
        crNote(p.uid, "join", `${nameOf(S.uid)} مهتم/ة ينضم لمشروع «${p.name}»: ${t}`, "startup"); close(); toast("وصل اهتمامك لصاحب المشروع");
      }
    } })));
}
views.startup = () => {
  const tabs = h("div", { class: "chips", role: "group", "aria-label": "القسم" }, [["comp", "مسابقة الأفكار"], ["inc", "الحاضنة الصغيرة"], ["work", "ورشات ريادة"]].map(([k, l]) =>
    h("button", { class: "chip", type: "button", "aria-pressed": String(crState.stTab === k), text: l, onclick: () => { crState.stTab = k; go("startup"); } })));
  const v = h("div", { class: "view" }, head("المسار المهني", "ريادة أعمال", "قدّم فكرة مشروع للمسابقة السنوية، لاقي شركاء لمشروعك، واحضر ورشات ريادة."), writeBanner(), tabs);
  if (crState.stTab === "comp") {
    crSub("startups", { limit: 300 }, "startups", crDrawStartups);
    crSub("startupvotes", { limit: 3000 }, "votes", crDrawStartups);
    const f = h("form", { class: "card form cr-form" },
      h("h3", { class: "full", text: `قدّم فكرة لمسابقة ${THIS_YEAR}` }),
      crField("اسم الفكرة", h("input", { type: "text", id: "cr-st-title", required: true, maxlength: 70 }), "full"),
      crField("شو المشكلة؟", h("textarea", { id: "cr-st-problem", required: true, maxlength: 600 })),
      crField("شو الحل؟", h("textarea", { id: "cr-st-sol", required: true, maxlength: 600 })),
      crField("مين بالفريق، وشو ناقصكم؟ (اختياري)", h("input", { type: "text", id: "cr-st-team", maxlength: 200 }), "full"),
      h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "قدّم الفكرة" }), h("span", { class: "muted small", text: "كل واحد إله صوت واحد بالمسابقة، وبيقدر ينقله لفكرة ثانية." })));
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      const d = { uid: S.uid, round: crRound(), title: $("#cr-st-title", f).value.trim(), problem: $("#cr-st-problem", f).value.trim(), solution: $("#cr-st-sol", f).value.trim(), team: $("#cr-st-team", f).value.trim(), createdAt: Date.now() };
      if (!d.title || !d.problem || !d.solution) return;
      if (await addDoc("startups", d)) { f.reset(); toast("انقدّمت فكرتك للمسابقة"); }
    });
    v.append(f, h("h2", { text: "الترتيب" }), h("div", { class: "stack", id: "cr-st" }));
  } else if (crState.stTab === "inc") {
    crSub("incubator", { limit: 200 }, "inc", crDrawInc);
    crSub("incjoins", { limit: 1000 }, "incJoins", crDrawInc);
    const f = h("form", { class: "card form cr-form" },
      h("h3", { class: "full", text: "اعرض مشروعك" }),
      crField("اسم المشروع", h("input", { type: "text", id: "cr-inc-name", required: true, maxlength: 70 })),
      crField("المرحلة", crSelect("cr-inc-stage", ["فكرة", "نموذج أولي", "شغّال وبدنا نكبر"], "فكرة")),
      crField("المجال", crSelect("cr-inc-field", CR_FIELDS, CR_FIELDS[1])),
      crField("عن المشروع", h("textarea", { id: "cr-inc-desc", required: true, maxlength: 800 }), "full"),
      crField("المهارات اللي بتدوّر عليها (افصل بفاصلة)", h("input", { type: "text", id: "cr-inc-needs", required: true, maxlength: 200, placeholder: "برمجة، تسويق، تصميم" })),
      crField("شو بتقدّم للشريك؟", h("input", { type: "text", id: "cr-inc-offer", maxlength: 200, placeholder: "شراكة، خبرة، نسبة من الأرباح…" })),
      h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر المشروع" })));
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      const d = { uid: S.uid, name: $("#cr-inc-name", f).value.trim(), stage: $("#cr-inc-stage", f).value, field: $("#cr-inc-field", f).value, desc: $("#cr-inc-desc", f).value.trim(), needs: $("#cr-inc-needs", f).value.trim(), offer: $("#cr-inc-offer", f).value.trim(), createdAt: Date.now() };
      if (!d.name || !d.desc || !d.needs) return;
      if (await addDoc("incubator", d)) { f.reset(); toast("انتشر مشروعك"); }
    });
    v.append(f, h("div", { class: "grid", id: "cr-inc" }));
  } else {
    v.append(h("p", { class: "muted", text: "ورشات ريادة أعمال من خريجين وجهات مختصّة. سجّل وأضف الموعد لتقويمك." }),
      evEmbed(["ورشة ريادة أعمال"], "إذا بتقدّم ورشة ريادة أو بتعرف عن وحدة للخريجين، انشر موعدها.", { type: "ورشة ريادة أعمال" }));
  }
  return v;
};
registerView("startup", "career", "ريادة", null, { order: 50 });

// ===== 141 recommendations =====
function crDrawRecs() {
  if (!$("#cr-recs")) return;
  const rows = crVisible("recommendations", CR.recs);
  const by = new Map(); rows.forEach((r) => { if (!by.has(r.to)) by.set(r.to, []); by.get(r.to).push(r); });
  const q = crState.recQ.trim();
  let people = [...by.keys()].filter((u) => matches([nameOf(u), S.alumni[u]?.field, S.alumni[u]?.place].join(" "), q));
  people.sort((a, b) => (b === S.uid) - (a === S.uid) || by.get(b).length - by.get(a).length);
  crFill("cr-recs", people.length ? people.map((u) => {
    const a = S.alumni[u] || {};
    return h("article", { class: "card item cr-reccard" },
      crWho(u, a.status || ""),
      a.field || a.place ? h("p", { class: "muted", text: [a.field, a.place].filter(Boolean).join(" · ") }) : null,
      h("h4", { text: `توصيات (${by.get(u).length})` }),
      ...by.get(u).map((r) => h("blockquote", { class: "cr-rec" },
        h("p", { text: r.text }),
        h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(r.uid) }), crVer(r.uid), r.relation ? h("span", { text: r.relation }) : null, h("span", { text: rel(r.createdAt) })),
        h("div", { class: "row" }, canDelete(r) || r.to === S.uid ? h("button", { class: "link danger small", type: "button", text: "حذف", onclick: () => confirmBox("تحذف هذه التوصية؟", () => delDoc("recommendations", r.id)) }) : null, crReport("recommendations", r)))));
  }) : [empty(rows.length ? "ما في نتائج" : "لسا ما في توصيات", rows.length ? "جرّب اسم ثاني." : "اشتغلت أو درست مع طالب من المدرسة؟ اكتبله توصية بتساعده بالتقديم لشغل أو منحة.")]);
}
views.recs = () => {
  crSub("recommendations", { limit: 500 }, "recs", crDrawRecs);
  const people = Object.values(S.alumni).filter((a) => a.uid && a.uid !== S.uid).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  const f = h("form", { class: "card form cr-form" },
    h("h3", { class: "full", text: "اكتب توصية" }),
    crField("لمين؟", h("select", { id: "cr-r-to", required: true }, opt("", people.length ? "اختر من الدليل" : "لسا ما في ملفات بالدليل"), people.map((a) => opt(a.uid, `${a.name} · فوج ${a.year}`)))),
    crField("شو علاقتك فيه/ا؟", h("input", { type: "text", id: "cr-r-rel", required: true, maxlength: 80, placeholder: "مثال: درّسته بمشروع تطوع، اشتغلنا سوا" })),
    crField("التوصية", h("textarea", { id: "cr-r-text", required: true, maxlength: 1000, placeholder: "شو بيميّزه/ا؟ مثال محدد بيعطي التوصية وزن." }), "full"),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "انشر التوصية" }), h("span", { class: "muted small", text: "اكتب بس عن ناس بتعرفهم فعلًا. صاحب التوصية بيوصله إشعار وبيقدر يحذفها." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, to: $("#cr-r-to", f).value, relation: $("#cr-r-rel", f).value.trim(), text: $("#cr-r-text", f).value.trim(), createdAt: Date.now() };
    if (!d.to || !d.text) return;
    if (await addDoc("recommendations", d)) { crNote(d.to, "recommendation", `${nameOf(S.uid)} كتب/ت إلك توصية`, "recs"); f.reset(); toast("انتشرت التوصية"); }
  });
  const v = h("div", { class: "view" },
    head("المسار المهني", "توصيات", "خريجين ومعلّمين بيكتبوا توصيات لطلاب المدرسة. التوصيات بتظهر على بطاقة الطالب هون."),
    writeBanner(), f,
    crField("بحث باسم الطالب", h("input", { type: "search", id: "cr-r-q", value: crState.recQ })),
    h("div", { class: "grid", id: "cr-recs" }));
  queueMicrotask(() => $("#cr-r-q")?.addEventListener("input", (e) => { crState.recQ = e.target.value; crDrawRecs(); }));
  return v;
};
registerView("recs", "career", "توصيات", null, { order: 60 });

// ===== 142 statistics from alumni profiles =====
function crBars(title, entries, total, note) {
  const max = entries.reduce((m, e) => Math.max(m, e[1]), 0) || 1;
  return h("div", { class: "card stack cr-chart" },
    h("h3", { text: title }), note ? h("p", { class: "muted small", text: note }) : null,
    entries.length ? h("ul", { class: "cr-bars" }, entries.map(([label, n]) => {
      const pct = total ? Math.round(n / total * 100) : 0;
      return h("li", { title: `${label}: ${n} (${pct}%)` },
        h("span", { class: "cr-bar-l", text: label }),
        h("span", { class: "cr-bar-t", "aria-hidden": "true" }, h("i", { style: `width:${Math.max(2, n / max * 100)}%` })),
        h("span", { class: "cr-bar-v num", text: `${n} · ${pct}%` }));
    })) : h("p", { class: "muted small", text: "ما في بيانات كافية لهذا الرسم." }));
}
function crTop(entries, k) { if (entries.length <= k) return entries; const rest = entries.slice(k).reduce((s, e) => s + e[1], 0); return [...entries.slice(0, k), ["غير ذلك", rest]]; }
function crDrawStats() {
  if (!$("#cr-stats")) return;
  const all = Object.values(S.alumni);
  const years = [...new Set(all.map((a) => a.year))].sort((a, b) => b - a);
  const ys = $("#cr-stat-year");
  if (ys && ys.options.length !== years.length + 1) ys.replaceChildren(opt("all", "كل الأفواج", crState.statYear === "all"), ...years.map((y) => opt(y, "فوج " + y, String(crState.statYear) === String(y))));
  const rows = all.filter((a) => crState.statYear === "all" || String(a.year) === String(crState.statYear));
  if (!rows.length) { crFill("cr-stats", [empty("ما في ملفات كافية", "الإحصائيات بتنبني من ملفات الخريجين بالدليل. أنشئ ملفك وابعث الرابط لفوجك.")]); return; }
  const n = rows.length, mentors = rows.filter((a) => a.mentor).length;
  const clean = (s) => String(s || "").trim();
  crFill("cr-stats", [
    h("div", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { text: n }), h("span", { text: "ملف" })),
      h("div", { class: "stat" }, h("b", { text: mentors }), h("span", { text: "متاح للإرشاد" })),
      h("div", { class: "stat" }, h("b", { text: crState.statYear === "all" ? years.length : rows.filter((a) => clean(a.field)).length }), h("span", { text: crState.statYear === "all" ? "فوج" : "كتبوا تخصص" }))),
    h("div", { class: "grid" },
      crBars("الوضع اليوم", crCount(rows, "status"), n),
      crBars("التخصصات والمجالات", crTop(crCount(rows, (a) => clean(a.field)), 10), n, "من خانة «التخصص أو المجال» بالملف، كما كتبها كل واحد."),
      crBars("المؤسسات وأماكن العمل", crTop(crCount(rows, (a) => clean(a.place)), 10), n, "من خانة «وين بتدرس أو بتشتغل»."),
      crState.statYear === "all" ? crBars("عدد الملفات حسب الفوج", crCount(rows, (a) => "فوج " + a.year).sort((a, b) => b[0].localeCompare(a[0])), n) : null),
  ]);
}
views.cstats = () => {
  const v = h("div", { class: "view" },
    head("المسار المهني", "وين راح خريجونا؟", "شو اختاروا خريجي المدرسة: تخصصات، مؤسسات وأوضاع، حسب الفوج."),
    h("div", { class: "banner" }, "الأرقام محسوبة من الملفات اللي أضافها الخريجين للمنصة بس، فهي مش صورة كاملة لكل الأفواج. كل ما زادت الملفات، صارت أدق."),
    crField("الفوج", h("select", { id: "cr-stat-year" }, opt("all", "كل الأفواج"))),
    h("div", { class: "stack", id: "cr-stats" }));
  queueMicrotask(() => $("#cr-stat-year")?.addEventListener("change", (e) => { crState.statYear = e.target.value; crDrawStats(); }));
  return v;
};
registerView("cstats", "career", "إحصائيات", null, { order: 70 });
