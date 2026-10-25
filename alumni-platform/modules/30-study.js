// community: study groups (subject, time, place or link; join/leave via studymembers/<groupId>__<uid>)
const sgState = { subject: "all", groups: [], members: [], form: null };

views["cm-study"] = () => {
  const u1 = subscribe("studygroups", { limit: 300 }, (rows) => { sgState.groups = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); });
  const u2 = subscribe("studymembers", { limit: 5000 }, (rows) => { sgState.members = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); });
  onLeave(u1); onLeave(u2);
  const f = h("form", { class: "card form", id: "sg-form" },
    h("h3", { class: "full", text: "افتح مجموعة دراسة" }),
    h("label", { class: "field" }, h("span", { text: "الموضوع" }), h("select", { id: "sg-subject" }, SUBJECTS.map((s) => opt(s)))),
    h("label", { class: "field" }, h("span", { text: "اسم المجموعة أو الهدف" }), h("input", { type: "text", id: "sg-title", required: true, maxlength: 80, placeholder: "مثال: تحضير لبجروت رياضيات 5 وحدات" })),
    h("label", { class: "field" }, h("span", { text: "إيمتى؟" }), h("input", { type: "text", id: "sg-when", required: true, maxlength: 80, placeholder: "مثال: كل ثلاثاء 17:00" })),
    h("label", { class: "field" }, h("span", { text: "وين؟ (مكان أو رابط لقاء)" }), h("input", { type: "text", id: "sg-where", required: true, maxlength: 200, placeholder: "مثال: مكتبة المدرسة، أو رابط Zoom" })),
    h("label", { class: "field" }, h("span", { text: "أقصى عدد (اختياري)" }), h("input", { type: "number", id: "sg-cap", min: 2, max: 50, inputmode: "numeric" })),
    h("label", { class: "field full" }, h("span", { text: "تفاصيل (المستوى، شو نحضّر…)" }), h("textarea", { id: "sg-note", maxlength: 600 })),
    h("p", { class: "full muted small", text: "اللقاءات وجهًا لوجه خلّوها بأماكن عامة زي المدرسة أو المكتبة. لا تنشر عنوان بيت." }),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "افتح المجموعة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const doc = { uid: S.uid, subject: $("#sg-subject").value, title: $("#sg-title").value.trim(), when: $("#sg-when").value.trim(), where: $("#sg-where").value.trim(), note: $("#sg-note").value.trim(), createdAt: Date.now() };
    const cap = +$("#sg-cap").value; if (cap >= 2) doc.cap = Math.min(50, cap);
    if (!doc.title || !doc.when || !doc.where) return;
    if (!(await addDoc("studygroups", doc))) return;
    // creator joins automatically (find the new group by its timestamp)
    f.reset(); toast("انفتحت المجموعة");
    const g = await new Promise((res) => setTimeout(() => res(sgState.groups.find((x) => x.uid === S.uid && x.createdAt === doc.createdAt)), 400));
    if (g) await setDoc("studymembers", g.id + "__" + S.uid, { uid: S.uid, group: g.id, createdAt: Date.now() });
  });
  const subjects = ["all", ...SUBJECTS];
  return h("div", { class: "view" },
    head("مجموعات دراسة", "ادرس مع غيرك", "افتح مجموعة لموضوع معيّن أو انضم لمجموعة موجودة: بجروت، بسيخومتري، أو مساقات جامعية."),
    writeBanner(), f,
    h("label", { class: "field", style: "max-width:320px" }, h("span", { text: "فلترة حسب الموضوع" }),
      h("select", { id: "sg-filter", onchange: (e) => { sgState.subject = e.target.value; renderLists(); } }, subjects.map((s) => opt(s, s === "all" ? "كل المواضيع" : s, sgState.subject === s)))),
    h("div", { class: "grid", id: "sg-list" }));
};
async function sgJoin(g, members) {
  if (!guardWrite() || !needProfile()) return;
  if (g.cap && members.length >= g.cap) { toast("المجموعة مليانة"); return; }
  if (await setDoc("studymembers", g.id + "__" + S.uid, { uid: S.uid, group: g.id, createdAt: Date.now() })) {
    toast("انضميت للمجموعة");
    cmNotify(g.uid, "study", `${nameOf(S.uid)} انضم لمجموعة الدراسة «${cmSnippet(g.title, 50)}»`, "cm-study");
  }
}
function sgCard(g, members) {
  const mine = members.some((m) => m.uid === S.uid);
  const full = g.cap && members.length >= g.cap;
  const link = safeUrl(g.where);
  return h("article", { class: "card item" + (cmPinned(g.id) ? " cm-pinned" : "") },
    h("div", { class: "row" }, h("span", { class: "pill", text: g.subject }), cmPinPill(g.id), mine ? h("span", { class: "pill good", text: "إنت عضو" }) : null, full ? h("span", { class: "pill warn", text: "مليانة" }) : null),
    h("h3", { text: g.title }),
    h("dl", { class: "cm-dl" },
      h("dt", { text: "إيمتى" }), h("dd", { text: g.when }),
      h("dt", { text: "وين" }), h("dd", null, link ? h("a", { href: link, target: "_blank", rel: "noopener", text: "رابط اللقاء" }) : g.where),
      h("dt", { text: "فتحها" }), h("dd", null, nameOf(g.uid), cmVerified(g.uid))),
    g.note ? h("p", { class: "muted", text: g.note }) : null,
    h("div", { class: "row cm-members", "aria-label": "الأعضاء" },
      members.slice(0, 6).map((m) => h("span", { title: nameOf(m.uid) }, avatar(nameOf(m.uid), m.uid))),
      h("span", { class: "muted small num", text: (g.cap ? `${members.length} من ${g.cap}` : `${members.length}`) + " عضو" })),
    members.length ? h("p", { class: "small muted", text: members.map((m) => nameOf(m.uid)).join("، ") }) : null,
    h("div", { class: "spread" },
      mine ? h("button", { class: "btn sm ghost", type: "button", onclick: () => confirmBox("تطلع من المجموعة؟", () => delDoc("studymembers", g.id + "__" + S.uid)), text: "اطلع من المجموعة" })
        : h("button", { class: "btn sm blue", type: "button", disabled: full ? true : null, onclick: () => sgJoin(g, members), text: full ? "مليانة" : "انضم" }),
      h("div", { class: "row" }, g.uid !== S.uid ? cmReportBtn("studygroups:" + g.id) : null, rowActions("studygroups", g))));
}
HOOKS.lists.push(() => {
  const el = $("#sg-list");
  cmDraw(el, [sgState.groups, sgState.members, S.mod, S.alumni, sgState.subject, cmNamesKey()], () => {
    const by = {};
    for (const m of sgState.members) (by[m.group] ||= []).push(m);
    const rows = cmVisible("studygroups", sgState.groups.filter((g) => sgState.subject === "all" || g.subject === sgState.subject));
    return rows.length ? rows.map((g) => sgCard(g, (by[g.id] || []).sort((a, b) => a.createdAt - b.createdAt)))
      : [empty(sgState.subject === "all" ? "لسا ما في مجموعات دراسة" : "ما في مجموعات لهالموضوع", "افتح أول مجموعة من الصندوق فوق، وابعت الرابط لصحابك.")];
  });
});
registerSearch("مجموعات الدراسة", (q) => cmVisible("studygroups", sgState.groups).filter((g) => matches([g.title, g.subject, g.note, g.when].join(" "), q)).slice(0, 6)
  .map((g) => ({ title: g.title, sub: `${g.subject} · ${g.when}`, go: "cm-study" })));
registerView("cm-study", "community", "مجموعات الدراسة", null, { order: 60 });
