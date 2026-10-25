// ===== learning: exam countdown (55), revision-plan generator (54), bagrut progress tracker (186), home widget =====
// Private: myCol() docs "ln-exams" {list}, "ln-plan" {days, settings, done}, "ln-bagrut" {rows}. Shared: "examdates" (admins add).
const lnMyExams = () => (lnMine("ln-exams")?.list || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
const lnUpcoming = (list) => list.filter((e) => e.date && lnDaysTo(e.date) >= 0).sort((a, b) => (a.date < b.date ? -1 : 1));
function lnSaveExams(list) { return lnSaveMine("ln-exams", { t: "ln-exams", list }); }

function lnExamForm(onAdded) {
  const f = h("form", { class: "form" },
    lnField("الموضوع", h("select", { id: "ln-ex-subject" }, LN_SUBJECTS.map((s) => opt(s)))),
    lnField("وصف قصير (اختياري)", h("input", { type: "text", id: "ln-ex-title", maxlength: 60, placeholder: "مثال: بجروت 5 وحدات، موعد أ" })),
    lnField("التاريخ", h("input", { type: "date", id: "ln-ex-date", required: true, min: lnToday() })),
    lnField("قدّيش صعب عليك؟", h("select", { id: "ln-ex-diff" }, opt(1, "سهل"), opt(2, "عادي", true), opt(3, "صعب"))),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف الموعد" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite()) return;
    const x = { id: lnId(), subject: $("#ln-ex-subject").value, title: $("#ln-ex-title").value.trim(), date: $("#ln-ex-date").value, diff: +$("#ln-ex-diff").value };
    if (!x.date) return;
    if (await lnSaveExams([...lnMyExams(), x])) { f.reset(); toast("انضاف الموعد"); onAdded && onAdded(); }
  });
  return f;
}
function lnExamRows(list, { del, add } = {}) {
  return list.map((e) => {
    const n = lnDaysTo(e.date);
    return h("div", { class: "plain spread ln-exam" },
      h("div", { class: "row ln-min" }, h("span", { class: "ln-days num" + (n <= 7 ? " soon" : ""), text: n < 0 ? "—" : String(n) }),
        h("div", { class: "ln-min" }, h("b", { text: e.title ? e.subject + " · " + e.title : e.subject }), h("div", { class: "muted small", text: lnDate(e.date, true) + " · " + lnLeft(n) }))),
      h("div", { class: "row" }, add ? add(e) : null, del ? del(e) : null));
  });
}
function lnCountdownCard(e, shared) {
  if (!e) return null;
  const n = lnDaysTo(e.date);
  return h("div", { class: "card ln-count" },
    h("span", { class: "muted small", text: shared ? "أقرب موعد عام" : "أقرب امتحان إلك" }),
    h("div", { class: "row" }, h("b", { class: "ln-big num", text: String(n) }), h("span", { class: "ln-big-l", text: n === 0 ? "الامتحان اليوم" : n === 1 ? "يوم واحد ضايل" : "يوم ضايلين" })),
    h("div", { text: (e.title ? e.subject + " · " + e.title : e.subject) + " — " + lnDate(e.date, true) }));
}

views["ln-exams"] = () => {
  let shared = [];
  const top = h("div", { class: "grid" }), sharedList = h("div", { class: "stack" }), mineList = h("div", { class: "stack" });
  const af = h("form", { class: "card form" },
    lnField("الامتحان", h("input", { type: "text", id: "ln-ed-title", required: true, maxlength: 80, placeholder: "مثال: بجروت رياضيات 5 وحدات، موعد صيفي" }), true),
    lnField("الموضوع", h("select", { id: "ln-ed-subject" }, LN_SUBJECTS.map((s) => opt(s)))),
    lnField("التاريخ", h("input", { type: "date", id: "ln-ed-date", required: true })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف للمواعيد العامة" })));
  af.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!S.isAdmin || !guardWrite()) return;
    if (await addDoc("examdates", { uid: S.uid, title: $("#ln-ed-title").value.trim(), subject: $("#ln-ed-subject").value, date: $("#ln-ed-date").value, createdAt: Date.now() })) { af.reset(); toast("انضاف الموعد للكل"); }
  });
  const draw = () => {
    const sh = lnUpcoming(shared.filter((x) => !isMod("hidden", "examdates:" + x.id)));
    const mine = lnUpcoming(lnMyExams());
    top.replaceChildren(...[lnCountdownCard(mine[0], false), lnCountdownCard(sh[0], true)].filter(Boolean));
    if (!top.childNodes.length) top.replaceChildren(empty("ما في مواعيد لسا", "أضف مواعيد امتحاناتك تحت، وبنعدّلك الأيام الضايلة."));
    sharedList.replaceChildren(...(sh.length ? lnExamRows(sh.map((x) => ({ ...x, title: x.title, subject: x.subject })), {
      add: (e) => (S.uid ? h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (lnMyExams().some((m) => m.src === e.id)) { toast("موجود بمواعيدك"); return; } if (guardWrite()) lnSaveExams([...lnMyExams(), { id: lnId(), src: e.id, subject: e.subject, title: e.title, date: e.date, diff: 2 }]).then((ok) => ok && toast("انضاف لمواعيدك")); }, text: "أضف لمواعيدي" }) : null),
      del: (e) => rowActions("examdates", e),
    }) : [empty("لسا الإدارة ما أضافت مواعيد عامة", "مسؤولو المنصة بيضيفوا هون مواعيد البجروت والمدرسة لما تنعلن.")]));
    const all = lnMyExams();
    mineList.replaceChildren(...(all.length ? lnExamRows(all, { del: (e) => h("button", { class: "link danger small", type: "button", onclick: () => lnSaveExams(all.filter((x) => x.id !== e.id)), text: "حذف" }) })
      : [empty("ما أضفت مواعيد", "أضف امتحاناتك الجاية. المواعيد خاصة فيك، وبتستعملها خطة المراجعة وفلتر المكتبة.")]));
  };
  lnSetDraw(draw);
  lnLive("examdates", { limit: 100 }, (rows) => { shared = rows; draw(); });
  draw();
  return h("div", { class: "view ln" },
    head("التعلّم", "مواعيد الامتحانات", "عدّاد تنازلي لامتحاناتك. المواعيد العامة بيضيفها مسؤولو المنصة، ومواعيدك الخاصة ما حدا بيشوفها غيرك."),
    writeBanner(),
    top,
    h("section", { class: "section" }, h("h2", { text: "مواعيد عامة" }),
      h("p", { class: "muted small", text: "المواعيد ممكن تتغيّر. تأكد دايمًا من المدرسة أو من موقع وزارة التربية، وللبسيخومتري من nite.org.il." }),
      sharedList,
      S.isAdmin ? h("details", { class: "stack" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ موعد عام (للإدارة)" }), af) : null),
    h("section", { class: "section" }, h("h2", { text: "مواعيدي" }), mineList, h("div", { class: "card" }, lnExamForm())),
    h("div", { class: "row" }, h("button", { class: "btn ghost", type: "button", "data-go": "ln-plan", text: "ولّد خطة مراجعة من مواعيدي" })));
};

// ---------- revision plan (54) ----------
function lnMakePlan(exams, { start, hours, rest }) {
  const ex = exams.filter((e) => e.date >= start).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!ex.length) return [];
  const last = ex[ex.length - 1].date, days = [];
  for (let d = start, k = 0; d <= last && k < 150; d = lnAddDays(d, 1), k++) {
    const dow = new Date(d + "T00:00").getDay();
    const todayEx = ex.filter((e) => e.date === d);
    const items = todayEx.map((e) => ({ s: e.subject, h: 0, note: "يوم الامتحان" }));
    const next = ex.filter((e) => e.date > d);
    const tomorrow = lnAddDays(d, 1);
    const eve = next.find((e) => e.date === tomorrow);
    if (!next.length) { days.push({ d, items }); continue; }
    if (rest !== "" && dow === +rest && !eve) { days.push({ d, items: [...items, { s: "", h: 0, note: "راحة" }] }); continue; }
    let avail = todayEx.length ? Math.floor(hours) / 2 : hours;
    avail = Math.round(avail * 2) / 2;
    if (avail <= 0) { days.push({ d, items }); continue; }
    if (eve) { items.push({ s: eve.subject, h: avail, note: "مراجعة نهائية وامتحان سابق بوقت" }); days.push({ d, items }); continue; }
    const w = next.map((e) => ({ e, w: (e.diff || 2) / Math.max(1, (new Date(e.date + "T00:00") - new Date(d + "T00:00")) / 86400000) }))
      .sort((a, b) => b.w - a.w).slice(0, hours >= 5 ? 3 : 2);
    const tot = w.reduce((s, x) => s + x.w, 0);
    let left = avail;
    w.forEach((x, i) => {
      let hh = i === w.length - 1 ? left : Math.max(0.5, Math.round((avail * x.w / tot) * 2) / 2);
      hh = Math.min(hh, left); left -= hh;
      if (hh <= 0) return;
      const n = Math.round((new Date(x.e.date + "T00:00") - new Date(d + "T00:00")) / 86400000);
      items.push({ s: x.e.subject, h: hh, note: n > 14 ? "فهم وتلخيص المادة" : n > 6 ? "تمارين وأسئلة" : "امتحانات سابقة بوقت" });
    });
    days.push({ d, items });
  }
  return days;
}
const LN_DOW = [["", "بدون يوم راحة"], ["5", "الجمعة"], ["6", "السبت"], ["0", "الأحد"], ["1", "الاثنين"], ["2", "الثلاثاء"], ["3", "الأربعاء"], ["4", "الخميس"]];
views["ln-plan"] = () => {
  const saved = lnMine("ln-plan");
  const st = saved?.settings || { start: lnToday(), hours: 3, rest: "5" };
  let draft = null;
  const examsBox = h("div", { class: "stack" }), planBox = h("div", { class: "stack" });
  const setF = h("div", { class: "form" },
    lnField("من أي يوم؟", h("input", { type: "date", id: "ln-pl-start", value: st.start < lnToday() ? lnToday() : st.start })),
    lnField("ساعات دراسة باليوم", h("input", { type: "number", id: "ln-pl-hours", min: 1, max: 12, step: 0.5, value: st.hours })),
    lnField("يوم راحة", h("select", { id: "ln-pl-rest" }, LN_DOW.map(([v, l]) => opt(v, l, String(st.rest) === v)))));
  const settings = () => ({ start: $("#ln-pl-start").value || lnToday(), hours: Math.max(1, Math.min(12, +$("#ln-pl-hours").value || 3)), rest: $("#ln-pl-rest").value });
  const gen = () => {
    const ex = lnUpcoming(lnMyExams());
    if (!ex.length) { toast("أضف موعد امتحان واحد على الأقل"); return; }
    draft = { days: lnMakePlan(ex, settings()), settings: settings() };
    draw();
  };
  const dayRow = (day, plan, editable) => {
    const isToday = day.d === lnToday(), done = !!plan.done?.[day.d];
    const total = day.items.reduce((s, x) => s + (x.h || 0), 0);
    return h("div", { class: "plain ln-day" + (isToday ? " today" : "") + (done ? " done" : "") },
      h("div", { class: "spread" }, h("b", { text: lnDate(day.d, true) + (isToday ? " · اليوم" : "") }),
        editable ? h("label", { class: "check small" }, h("input", { type: "checkbox", id: "ln-pl-d" + day.d.replace(/-/g, ""), checked: done ? true : null, onchange: (e) => {
          const map = { ...(plan.done || {}) }; if (e.target.checked) map[day.d] = true; else delete map[day.d];
          lnSaveMine("ln-plan", { ...plan, done: map });
        } }), "خلّصت") : total ? h("span", { class: "muted small num", text: `${total} س` }) : null),
      h("ul", { class: "ln-list" }, day.items.map((x) => h("li", null, x.s ? h("b", { text: x.s }) : null, h("span", { class: "muted", text: (x.s ? " · " : "") + x.note + (x.h ? ` · ${x.h} س` : "") })))));
  };
  const draw = () => {
    const ex = lnUpcoming(lnMyExams());
    examsBox.replaceChildren(...(ex.length ? lnExamRows(ex, { del: (e) => h("button", { class: "link danger small", type: "button", onclick: () => lnSaveExams(lnMyExams().filter((x) => x.id !== e.id)), text: "حذف" }) })
      : [empty("ما في امتحانات جاية", "أضف موعد امتحان وحدّد قدّيش صعب عليك، والخطة بتعطي وقت أكثر للصعب والقريب.")]));
    const plan = draft || lnMine("ln-plan");
    if (!plan || !plan.days?.length) { planBox.replaceChildren(...(draft ? [empty("ما طلعت خطة", "تأكد إن تاريخ البداية قبل الامتحانات.")] : [])); return; }
    const editable = !draft;
    const upcoming = plan.days.filter((d) => d.d >= lnToday());
    const doneN = Object.keys(plan.done || {}).length;
    planBox.replaceChildren(
      h("div", { class: "spread" }, h("h2", { text: draft ? "الخطة المقترحة" : "خطتي" }),
        draft ? h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: async () => { if (await lnSaveMine("ln-plan", { t: "ln-plan", ...draft, done: {} })) { draft = null; toast("انحفظت الخطة، ما حدا بيشوفها غيرك"); draw(); } }, text: "احفظ الخطة" }),
          h("button", { class: "btn ghost", type: "button", onclick: () => { draft = null; draw(); }, text: "إلغاء" }))
          : h("span", { class: "pill good", text: `خلّصت ${doneN} من ${plan.days.length} يوم` })),
      upcoming.length ? h("div", { class: "stack" }, upcoming.map((d) => dayRow(d, plan, editable))) : empty("الخطة خلصت", "ولّد خطة جديدة للامتحانات الجاية."));
  };
  lnSetDraw(draw);
  draw();
  return h("div", { class: "view ln" },
    head("مساحتي", "خطة المراجعة", "حط مواعيد امتحاناتك وقدّيش بتقدر تدرس باليوم، وبنقسّملك المواد يوم بيوم: القريب والصعب بياخذ وقت أكثر، وآخر يوم قبل كل امتحان مراجعة نهائية."),
    writeBanner(),
    h("section", { class: "section" }, h("h2", { text: "1. امتحاناتك" }), examsBox,
      h("details", { class: "card" }, h("summary", { class: "link", text: "+ أضف امتحان" }), lnExamForm())),
    h("section", { class: "section" }, h("h2", { text: "2. وقتك" }), setF, h("div", null, h("button", { class: "btn blue", type: "button", onclick: gen, text: "ولّد الخطة" }))),
    h("section", { class: "section" }, planBox));
};

// ---------- bagrut progress (186) ----------
views["ln-bagrut"] = () => {
  const box = h("div", { class: "stack" }), sum = h("div");
  const rows = () => lnMine("ln-bagrut")?.rows || [];
  const save = (r) => lnSaveMine("ln-bagrut", { t: "ln-bagrut", rows: r });
  const f = h("form", { class: "card form" },
    lnField("الموضوع", h("input", { type: "text", id: "ln-bg-subject", required: true, maxlength: 40, list: "ln-bg-subjects", placeholder: "مثال: رياضيات" })),
    h("datalist", { id: "ln-bg-subjects" }, SUBJECTS.filter((s) => !["أخرى", "بسيخومتري", "مساقات جامعية"].includes(s)).map((s) => opt(s))),
    lnField("وحدات", h("select", { id: "ln-bg-units" }, [1, 2, 3, 4, 5].map((u) => opt(u, String(u), u === 5)))),
    lnField("العلامة (إذا خلصت)", h("input", { type: "number", id: "ln-bg-grade", min: 0, max: 100 })),
    lnField("هدفك", h("input", { type: "number", id: "ln-bg-target", min: 0, max: 100, value: 90 })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف الموضوع" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite()) return;
    const g = $("#ln-bg-grade").value;
    const r = { id: lnId(), subject: $("#ln-bg-subject").value.trim(), units: +$("#ln-bg-units").value, grade: g === "" ? null : Math.max(0, Math.min(100, +g)), target: Math.max(0, Math.min(100, +$("#ln-bg-target").value || 0)) };
    if (!r.subject) return;
    if (await save([...rows(), r])) { f.reset(); toast("انضاف"); }
  });
  const draw = () => {
    const r = rows();
    const graded = r.filter((x) => x.grade != null);
    const wsum = (arr, k) => arr.reduce((s, x) => s + x[k] * x.units, 0), usum = (arr) => arr.reduce((s, x) => s + x.units, 0);
    const avg = graded.length ? wsum(graded, "grade") / usum(graded) : null;
    const tgt = r.length ? wsum(r, "target") / usum(r) : null;
    sum.replaceChildren(r.length ? h("div", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { text: avg == null ? "—" : avg.toFixed(1) }), h("span", { text: "معدّلك لهلّق" })),
      h("div", { class: "stat" }, h("b", { text: tgt == null ? "—" : tgt.toFixed(1) }), h("span", { text: "معدّل هدفك" })),
      h("div", { class: "stat" }, h("b", { text: usum(r) }), h("span", { text: "وحدات" }))) : null);
    if (box.contains(document.activeElement)) return;
    box.replaceChildren(...(r.length ? r.map((x) => {
      const upd = (k, v) => save(rows().map((y) => (y.id === x.id ? { ...y, [k]: v } : y)));
      const gap = x.grade != null && x.grade < x.target;
      return h("div", { class: "plain stack ln-bg" },
        h("div", { class: "spread" }, h("div", { class: "row" }, h("b", { text: x.subject }), h("span", { class: "pill grey", text: `${x.units} وحدات` }),
          x.grade == null ? h("span", { class: "pill warn", text: "لسا" }) : gap ? h("span", { class: "pill warn", text: `ناقصك ${x.target - x.grade}` }) : h("span", { class: "pill good", text: "وصلت هدفك" })),
          h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تحذف الموضوع؟", () => save(rows().filter((y) => y.id !== x.id))), text: "حذف" })),
        h("div", { class: "form" },
          lnField("العلامة", h("input", { type: "number", id: "ln-bg-g-" + x.id, min: 0, max: 100, value: x.grade ?? "", onchange: (e) => upd("grade", e.target.value === "" ? null : Math.max(0, Math.min(100, +e.target.value))) })),
          lnField("الهدف", h("input", { type: "number", id: "ln-bg-t-" + x.id, min: 0, max: 100, value: x.target, onchange: (e) => upd("target", Math.max(0, Math.min(100, +e.target.value || 0))) }))),
        x.grade != null ? h("div", { class: "bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.min(100, x.grade)}%` })) : null);
    }) : [empty("لسا ما أضفت مواضيع", "أضف مواضيع البجروت تبعتك، عدد الوحدات وهدفك. كل إشي هون خاص فيك وما حدا بيشوفه.")]));
  };
  lnSetDraw(draw);
  draw();
  return h("div", { class: "view ln" },
    head("مساحتي", "تقدّمي بالبجروت", "تابع علاماتك وأهدافك بكل موضوع. المعدّل هون موزون بعدد الوحدات بدون بونوس، لأن البونوس بيختلف بين المؤسسات. لحساب السيخم جرّب قسم «أدوات»."),
    writeBanner(), sum, box, f);
};

// ---------- home widget: question of the day + nearest countdown ----------
registerHome(() => {
  const qBox = h("div", { class: "card stack" }), cBox = h("div", { class: "card stack" });
  let qrows = [], shared = [];
  const draw = () => {
    const f = lnFeatured(qrows);
    qBox.replaceChildren(h("h3", { text: "سؤال اليوم" }),
      f ? h("p", { class: "ln-clamp", dir: "auto", text: f.q }) : h("p", { class: "muted", text: "لسا ما في سؤال لليوم. كن أول واحد يقترح." }),
      h("div", null, h("button", { class: "btn sm " + (f ? "blue" : "ghost"), type: "button", "data-go": "ln-daily", text: f ? "حاول واكشف الحل" : "اقترح سؤال" })));
    const mine = lnUpcoming(lnMyExams())[0], sh = lnUpcoming(shared.filter((x) => !isMod("hidden", "examdates:" + x.id)))[0];
    const e = mine && (!sh || mine.date <= sh.date) ? mine : sh;
    cBox.replaceChildren(h("h3", { text: "أقرب امتحان" }),
      e ? h("div", { class: "row" }, h("b", { class: "ln-big num", text: String(lnDaysTo(e.date)) }), h("div", { class: "ln-min" }, h("div", { text: e.title || e.subject }), h("div", { class: "muted small", text: lnLeft(lnDaysTo(e.date)) + " · " + lnDate(e.date, true) })))
        : h("p", { class: "muted", text: "أضف مواعيد امتحاناتك وبنعدّلك الأيام." }),
      h("div", null, h("button", { class: "btn sm ghost", type: "button", "data-go": "ln-exams", text: e ? "كل المواعيد" : "أضف موعد" })));
  };
  // home is re-rendered often; these subscriptions live only while home is open
  lnLive("qotd", { limit: 60 }, (rows) => { qrows = rows; draw(); });
  lnLive("examdates", { limit: 100 }, (rows) => { shared = rows; draw(); });
  lnSetDraw(draw);
  draw();
  return h("section", { class: "section ln" }, h("h2", { text: "للدراسة اليوم" }), h("div", { class: "grid" }, qBox, cBox));
}, 40);
