// community: stories («وين صاروا؟»، «تعلّمت من غلطتي»، قصص نجاح، مقابلات، أرشيف المدرسة) + home widget
const STORY_TYPES = [
  { t: "وين صاروا؟", hint: "قصة قصيرة: من وين طلعت من المدرسة، ووين وصلت اليوم.", qs: ["شو كان حلمك بالثانوية؟", "شو اخترت بعد التخرج وليش؟", "شو بتعمل اليوم؟", "نصيحة وحدة لطلاب المدرسة"] },
  { t: "تعلّمت من غلطتي", hint: "غلطة أو فشل صار معك، وشو تعلّمت منه. هاي القصص بتوفّر على غيرك سنين.", qs: ["شو كانت الغلطة؟", "كيف عرفت إنها غلطة؟", "كيف صلّحت الوضع؟", "شو بتعمل غير لو رجع الزمن؟"] },
  { t: "قصة نجاح", hint: "نجاح بمهنتك أو دراستك، مع الطريق الحقيقي اللي مشيته، مش بس النتيجة.", qs: ["وين بتشتغل أو شو حققت؟", "شو الصعوبات اللي واجهتك؟", "مين ساعدك بالطريق؟", "كيف بيقدر طالب اليوم يبدأ بنفس الطريق؟"] },
  { t: "مقابلة", hint: "مقابلة مع خريج/ة (مثلًا من أوائل الأفواج)، بأسئلة وأجوبة. انشرها بس بعد موافقته/ا.", qs: ["عرّفنا عن حالك وعن فوجك", "كيف كانت المدرسة بوقتك؟", "شو مسارك من بعدها؟", "شو بتحكي لطلاب اليوم؟"] },
  { t: "أرشيف", hint: "ذكرى أو حدث من تاريخ المدرسة والأفواج: افتتاح، رحلة، إنجاز، أول فوج… مع السنة.", qs: ["شو الحدث؟", "إمتى صار؟", "مين كان مشارك (بدون أسماء إذا ما في موافقة)؟", "ليش مهم نتذكره؟"] },
];
const stState = { type: "all", open: new Set() };

HOOKS.boot.push(() => {
  subscribe("stories", { limit: 300 }, (rows) => { CM.stories = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); });
  subscribe("polls", { limit: 100 }, (rows) => { CM.polls = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); });
});

views["cm-stories"] = () => {
  const v = h("div", { class: "view" },
    head("قصص الخريجين", "وين صاروا؟", "قصص حقيقية من خريجي المدرسة: وين وصلوا، شو غلطوا وتعلّموا، ونجاحات بكل المهن. وكمان أرشيف لتاريخ المدرسة والأفواج."),
    writeBanner(),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: () => stCompose(stState.type === "all" ? STORY_TYPES[0].t : stState.type), text: "اكتب قصة" })),
    h("div", { class: "chips", id: "st-types", role: "group", "aria-label": "نوع القصة" }, ["all", ...STORY_TYPES.map((x) => x.t)].map((t) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(stState.type === t), onclick: () => { stState.type = t; go("cm-stories"); }, text: t === "all" ? "الكل" : t }))),
    stState.type !== "all" ? stGuide(STORY_TYPES.find((x) => x.t === stState.type)) : null,
    h("div", { class: "stack", id: "st-list" }));
  return v;
};
function stGuide(T) {
  return h("div", { class: "plain stack cm-guide" }, h("h4", { text: T.t }), h("p", { class: "muted", style: "margin:0", text: T.hint }),
    h("div", null, h("span", { class: "small", style: "font-weight:700", text: "أسئلة بتساعدك تكتب:" }), reqList(T.qs)));
}
function stCompose(type) {
  if (!guardWrite() || !needProfile()) return;
  const me = S.alumni[S.uid] || {};
  const years = []; for (let y = THIS_YEAR + 1; y >= 1970; y--) years.push(y);
  const f = h("form", { class: "form", id: "st-form" },
    h("label", { class: "field" }, h("span", { text: "نوع القصة" }), h("select", { id: "st-type" }, STORY_TYPES.map((x) => opt(x.t, x.t, x.t === type)))),
    h("label", { class: "field" }, h("span", { text: "القصة عن مين؟" }), h("select", { id: "st-about" }, opt("me", "عني أنا", true), opt("other", "عن حدا ثاني وافق على النشر"))),
    h("label", { class: "field full", id: "st-person-wrap", hidden: true }, h("span", { text: "اسم صاحب/ة القصة" }), h("input", { type: "text", id: "st-person", maxlength: 60 })),
    h("label", { class: "check full", id: "st-consent-wrap", hidden: true }, h("input", { type: "checkbox", id: "st-consent" }), "أخذت موافقته/ا إنه القصة تنتشر هون"),
    h("label", { class: "field full" }, h("span", { text: "العنوان" }), h("input", { type: "text", id: "st-title", required: true, maxlength: 90, placeholder: "مثال: من صف الأحياء لقسم التمريض" })),
    h("label", { class: "field" }, h("span", { id: "st-year-label", text: "الفوج" }), h("select", { id: "st-year" }, years.map((y) => opt(y, String(y), y === (me.year || THIS_YEAR))))),
    h("label", { class: "field", id: "st-role-wrap" }, h("span", { text: "شو بيعمل/بتعمل اليوم؟" }), h("input", { type: "text", id: "st-role", maxlength: 80, value: [me.field, me.place].filter(Boolean).join(" · "), placeholder: "مثال: ممرضة بمستشفى سوروكا" })),
    h("label", { class: "field full" }, h("span", { text: "القصة" }), h("textarea", { id: "st-text", required: true, maxlength: 4000, rows: 8 })),
    h("p", { class: "full muted small", text: "اكتب الحقيقة كما هي. لا تنشر أرقام هواتف أو تفاصيل شخصية عن حدا بدون إذنه." }),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "انشر القصة" })));
  const sync = () => {
    const t = $("#st-type").value, other = $("#st-about").value === "other";
    $("#st-person-wrap").hidden = !other; $("#st-consent-wrap").hidden = !other;
    $("#st-year-label").textContent = t === "أرشيف" ? "سنة الحدث" : "الفوج";
    $("#st-role-wrap").hidden = t === "أرشيف";
    if (other && $("#st-role").value === [me.field, me.place].filter(Boolean).join(" · ")) $("#st-role").value = "";
  };
  f.addEventListener("change", sync);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const other = $("#st-about").value === "other";
    const person = $("#st-person").value.trim();
    if (other && (!person || !$("#st-consent").checked)) { toast("اكتب الاسم وأكّد إنك أخذت الموافقة"); return; }
    const type = $("#st-type").value;
    const doc = { uid: S.uid, type, title: $("#st-title").value.trim(), text: $("#st-text").value.trim(), year: +$("#st-year").value, createdAt: Date.now() };
    if (!doc.title || !doc.text) return;
    if (type !== "أرشيف" && $("#st-role").value.trim()) doc.role = $("#st-role").value.trim();
    if (other) doc.person = person;
    if (await addDoc("stories", doc)) { close(); toast("انتشرت القصة، شكرًا إنك شاركت"); stState.type = type; if (S.view === "cm-stories") go("cm-stories"); }
  });
  const close = modal("اكتب قصة", f);
  sync();
}
function stCard(s, compact) {
  const about = s.person || nameOf(s.uid);
  const long = s.text.length > 320;
  const open = stState.open.has(s.id);
  const body = h("p", { class: "cm-story-text", text: long && !open ? s.text.slice(0, 320) + "…" : s.text });
  return h("article", { class: "card item cm-story" + (cmPinned(s.id) ? " cm-pinned" : "") },
    h("div", { class: "row" }, h("span", { class: "pill", text: s.type }), cmPinPill(s.id),
      s.year ? h("span", { class: "pill grey", text: s.type === "أرشيف" ? `سنة ${s.year}` : `فوج ${s.year}` }) : null),
    h("h3", { text: s.title }),
    s.type !== "أرشيف" ? h("div", { class: "meta" }, h("span", { class: "who", text: about }), s.person ? null : cmVerified(s.uid), s.role ? h("span", { text: s.role }) : null) : null,
    compact ? h("p", { class: "cm-story-text", text: s.text.length > 160 ? s.text.slice(0, 160) + "…" : s.text }) : body,
    compact ? h("button", { class: "link small", type: "button", "data-go": "cm-stories", style: "justify-self:start", text: "اقرأ بقسم القصص" }) : h("div", { class: "spread" },
      h("div", { class: "row" }, long ? h("button", { class: "link small", type: "button", "aria-expanded": String(open), onclick: () => { open ? stState.open.delete(s.id) : stState.open.add(s.id); cmRedrawStories(); }, text: open ? "اختصر" : "اقرأ القصة كاملة" }) : null),
      h("div", { class: "meta" }, s.person ? h("span", null, "نشرها: ", h("b", { text: nameOf(s.uid) })) : null, h("span", { text: rel(s.createdAt) }), s.uid !== S.uid ? cmReportBtn("stories:" + s.id) : null, rowActions("stories", s))));
}
function cmRedrawStories() { const el = $("#st-list"); if (el) el._cmDeps = null; renderLists(); }
HOOKS.lists.push(() => {
  const el = $("#st-list");
  cmDraw(el, [CM.stories, S.mod, S.alumni, stState.type, cmNamesKey()], () => {
    let rows = cmVisible("stories", CM.stories.filter((s) => stState.type === "all" || s.type === stState.type));
    if (!rows.length) return [empty(stState.type === "all" ? "لسا ما في قصص" : `لسا ما في قصص «${stState.type}»`, "قصتك ممكن تفرق مع طالب محتار. اضغط «اكتب قصة» وكون أول واحد.")];
    if (stState.type !== "أرشيف") return rows.map((s) => stCard(s));
    // archive: a timeline by year, oldest first (pinned stays on top)
    const pinned = rows.filter((s) => cmPinned(s.id)), rest = rows.filter((s) => !cmPinned(s.id)).sort((a, b) => (a.year || 0) - (b.year || 0) || a.createdAt - b.createdAt);
    const out = pinned.map((s) => stCard(s)); let last = null;
    for (const s of rest) {
      if (s.year !== last) { last = s.year; out.push(h("h2", { class: "cm-year", text: String(s.year || "") })); }
      out.push(stCard(s));
    }
    return out;
  });
  const hw = $("#cm-home-body");
  cmDraw(hw, [CM.stories, CM.polls, S.mod, S.alumni, cmNamesKey()], () => {
    const story = cmVisible("stories", CM.stories)[0];
    const poll = cmVisible("polls", CM.polls.filter((p) => !pollClosed(p)))[0];
    if (!story && !poll) return [empty("لسا ما في قصص أو استطلاعات", "شارك قصتك بقسم «القصص»، أو اسأل الأفواج رأيهم باستطلاع.")];
    return [story ? stCard(story, true) : null, poll ? h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: "pill", text: "استطلاع" }), cmPinPill(poll.id)),
      h("h3", { text: poll.q }),
      h("ul", { class: "cm-home-opts" }, poll.options.map((o) => h("li", { text: o }))),
      h("div", { class: "spread" }, h("span", { class: "muted small", text: "من " + cmAuthorName(poll) }), h("button", { class: "btn sm blue", type: "button", "data-go": "cm-polls", text: "صوّت" }))) : null].filter(Boolean);
  });
});
registerHome(() => h("section", { class: "section" },
  h("div", { class: "spread" }, h("h2", { text: "من مجتمع الخريجين" }), h("button", { class: "link", type: "button", "data-go": "cm-stories", text: "كل القصص" })),
  h("div", { class: "grid", id: "cm-home-body" })), 40);

registerSearch("قصص الخريجين", (q) => cmVisible("stories", CM.stories).filter((s) => matches([s.title, s.text, s.type, s.role, s.person, s.year].join(" "), q)).slice(0, 8)
  .map((s) => ({ title: s.title, sub: `${s.type} · ${s.person || nameOf(s.uid)}`, go: "cm-stories", onOpen: () => { stState.type = s.type; stState.open.add(s.id); } })));
registerView("cm-stories", "community", "القصص", null, { order: 30 });
