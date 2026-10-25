// community: polls (2-6 options, one vote per person: pollvotes/<pollId>__<uid>, live result bars)
const pollState = { show: new Set(), votes: [] };
const pollClosed = (p) => p.closed || (p.ends && p.ends < Date.now());

views["cm-polls"] = () => {
  const optsBox = h("div", { class: "stack", id: "pl-opts" });
  const addOpt = (val = "") => {
    if (optsBox.children.length >= 6) return;
    const i = optsBox.children.length + 1;
    const row = h("div", { class: "row cm-opt-row" },
      h("input", { type: "text", id: "pl-opt-" + i, maxlength: 80, value: val, placeholder: "خيار " + i, "aria-label": "خيار " + i, style: "flex:1;min-width:0" }),
      h("button", { class: "link danger small", type: "button", "aria-label": "شيل الخيار", onclick: () => { if (optsBox.children.length > 2) { row.remove(); syncAdd(); } }, text: "شيل" }));
    optsBox.append(row); syncAdd();
  };
  const addBtn = h("button", { class: "btn sm ghost", type: "button", onclick: () => addOpt(), text: "+ خيار" });
  const syncAdd = () => { addBtn.disabled = optsBox.children.length >= 6; };
  addOpt(); addOpt();
  const f = h("form", { class: "card form", id: "pl-form" },
    h("label", { class: "field full" }, h("span", { text: "سؤال الاستطلاع" }), h("input", { type: "text", id: "pl-q", required: true, maxlength: 140, placeholder: "مثال: إيمتى أنسب وقت للقاء الأفواج السنوي؟" })),
    h("div", { class: "field full" }, h("span", { text: "الخيارات (من 2 لـ 6)" }), optsBox, h("div", null, addBtn)),
    h("label", { class: "field" }, h("span", { text: "مدة التصويت" }), h("select", { id: "pl-dur" }, opt("1", "يوم"), opt("3", "3 أيام"), opt("7", "أسبوع", true), opt("30", "شهر"), opt("0", "مفتوح بدون موعد"))),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "انشر الاستطلاع" }), h("span", { class: "muted small", text: "كل شخص بيصوّت مرة وحدة، وبيقدر يغيّر صوته طول ما الاستطلاع مفتوح." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const q = $("#pl-q").value.trim();
    const options = [...optsBox.querySelectorAll("input")].map((x) => x.value.trim()).filter(Boolean);
    if (!q) return;
    if (options.length < 2) { toast("لازم خيارين على الأقل"); return; }
    if (new Set(options).size !== options.length) { toast("في خيارين متشابهين"); return; }
    const d = +$("#pl-dur").value;
    const doc = { uid: S.uid, q, options, createdAt: Date.now() };
    if (d) doc.ends = Date.now() + d * 86400000;
    if (await addDoc("polls", doc)) { toast("انتشر الاستطلاع"); go("cm-polls"); }
  });
  const unsub = subscribe("pollvotes", { limit: 5000 }, (rows) => { pollState.votes = rows; renderLists(); });
  onLeave(unsub);
  return h("div", { class: "view" },
    head("استطلاعات", "شو رأي الأفواج؟", "اسأل سؤال بخيارات، وشوف النتائج مباشرة. مناسب لتحديد مواعيد، اختيار مواضيع لقاءات، أو معرفة رأي الطلاب."),
    writeBanner(), f, h("div", { class: "stack", id: "pl-list" }));
};
async function pollVote(p, i) {
  if (!guardWrite() || !needProfile()) return;
  if (pollClosed(p)) { toast("الاستطلاع مسكّر"); return; }
  if (await setDoc("pollvotes", p.id + "__" + S.uid, { uid: S.uid, poll: p.id, choice: i, createdAt: Date.now() })) toast("انحسب صوتك");
}
async function pollClose(p) {
  const { id, ...data } = p;
  if (await setDoc("polls", p.id, { ...data, closed: true })) toast("تسكّر الاستطلاع");
}
function pollCard(p, votes) {
  const counts = p.options.map(() => 0);
  let mine = null;
  for (const v of votes) { if (counts[v.choice] != null) counts[v.choice]++; if (v.uid === S.uid) mine = v.choice; }
  const total = counts.reduce((a, b) => a + b, 0);
  const closed = pollClosed(p);
  const showRes = closed || mine != null || pollState.show.has(p.id) || !S.canWrite || p.uid === S.uid;
  const max = Math.max(...counts);
  const opts = h("div", { class: "stack cm-poll-opts", role: "group", "aria-label": p.q }, p.options.map((o, i) => {
    const pct = total ? Math.round((counts[i] / total) * 100) : 0;
    const lead = closed && total && counts[i] === max;
    return h("button", { class: "cm-poll-opt" + (mine === i ? " mine" : "") + (lead ? " lead" : ""), type: "button", disabled: closed ? true : null, "aria-pressed": String(mine === i),
      onclick: () => pollVote(p, i) },
      showRes ? h("span", { class: "cm-poll-fill", style: `width:${pct}%`, "aria-hidden": "true" }) : null,
      h("span", { class: "cm-poll-label", text: o }),
      mine === i ? h("span", { class: "pill good", text: "صوتك" }) : null,
      showRes ? h("span", { class: "num cm-poll-num", text: `${pct}% · ${counts[i]}` }) : null);
  }));
  return h("article", { class: "card item cm-poll" + (cmPinned(p.id) ? " cm-pinned" : "") },
    h("div", { class: "spread" }, cmWho(p), h("div", { class: "row" }, cmPinPill(p.id), h("span", { class: closed ? "pill grey" : "pill good", text: closed ? "مسكّر" : "مفتوح" }))),
    h("h3", { text: p.q }), opts,
    h("div", { class: "spread" },
      h("span", { class: "muted small", text: (total === 1 ? "صوت واحد" : `${total} صوت`) + (p.ends && !closed ? " · بيسكّر " + new Date(p.ends).toLocaleDateString("ar-EG-u-nu-latn") : "") }),
      h("div", { class: "row" },
        !showRes ? h("button", { class: "link small", type: "button", onclick: () => { pollState.show.add(p.id); cmRedrawPolls(); }, text: "شوف النتائج بدون تصويت" }) : null,
        p.uid === S.uid && !closed ? h("button", { class: "link small", type: "button", onclick: () => confirmBox("تسكّر الاستطلاع؟ ما حدا رح يقدر يصوّت بعدها.", () => pollClose(p)), text: "سكّر التصويت" }) : null,
        p.uid !== S.uid ? cmReportBtn("polls:" + p.id) : null, rowActions("polls", p))));
}
function cmRedrawPolls() { const el = $("#pl-list"); if (el) el._cmDeps = null; renderLists(); }
HOOKS.lists.push(() => {
  const el = $("#pl-list");
  cmDraw(el, [CM.polls, pollState.votes, S.mod, S.alumni, cmNamesKey()], () => {
    const by = {};
    for (const v of pollState.votes) (by[v.poll] ||= []).push(v);
    const rows = cmVisible("polls", CM.polls);
    const open = rows.filter((p) => !pollClosed(p)), closed = rows.filter(pollClosed);
    if (!rows.length) return [empty("لسا ما في استطلاعات", "اكتب سؤال وخيارين فوق، وخلّي الأفواج تصوّت.")];
    return [
      ...open.map((p) => pollCard(p, by[p.id] || [])),
      open.length ? null : h("p", { class: "muted", text: "ما في استطلاع مفتوح هلّق." }),
      closed.length ? h("h2", { text: "استطلاعات مسكّرة" }) : null,
      ...closed.map((p) => pollCard(p, by[p.id] || [])),
    ].filter(Boolean);
  });
});
registerSearch("الاستطلاعات", (q) => cmVisible("polls", CM.polls).filter((p) => matches(p.q + " " + p.options.join(" "), q)).slice(0, 6)
  .map((p) => ({ title: p.q, sub: pollClosed(p) ? "استطلاع مسكّر" : "استطلاع مفتوح", go: "cm-polls" })));
registerView("cm-polls", "community", "الاستطلاعات", null, { order: 40 });
