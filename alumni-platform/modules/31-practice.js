// ===== learning: psychometric practice (45), leaderboard (58), question of the day (57), weekly challenges (182) =====
// Data: psyq (member questions), scores (one doc per person), qotd, challenges, chsubs (one answer per person per challenge).
const LN_PSY = ["تفكير كمّي", "تفكير كلامي", "إنجليزي"];
const lnPsyState = { section: "all", n: 10 };

views["ln-practice"] = () => {
  let qs = [], scores = [];
  const runBox = h("div", { class: "stack" }), board = h("div"), bank = h("div", { class: "stack" }), countEl = h("p", { class: "muted small" });
  const pool = () => qs.filter((q) => !isMod("hidden", "psyq:" + q.id) && (lnPsyState.section === "all" || q.section === lnPsyState.section));
  const start = () => {
    const p = pool();
    if (!p.length) { toast("ما في أسئلة بهالقسم لسا"); return; }
    const items = lnShuffle(p).slice(0, lnPsyState.n).map((q) => ({ q: q.q, options: q.options, correct: q.correct, explain: q.explain }));
    const r = lnRunner(items, { onDone: (s, n) => lnAddScore("psy", s, n), onAgain: start });
    runBox.replaceChildren(r);
    queueMicrotask(() => { r.focus({ preventScroll: true }); r.scrollIntoView({ block: "nearest" }); });
  };
  const f = h("form", { class: "card form" },
    lnField("القسم", h("select", { id: "ln-pq-section" }, LN_PSY.map((s) => opt(s)))),
    lnField("السؤال", h("textarea", { id: "ln-pq-q", required: true, maxlength: 1200, dir: "auto" }), true),
    ...[0, 1, 2, 3].map((i) => lnField(`خيار ${i + 1}`, h("input", { type: "text", id: "ln-pq-o" + i, required: true, maxlength: 200, dir: "auto" }))),
    lnField("الجواب الصحيح", h("select", { id: "ln-pq-correct" }, [0, 1, 2, 3].map((i) => opt(i, `خيار ${i + 1}`)))),
    lnField("شرح الحل", h("textarea", { id: "ln-pq-ex", maxlength: 1500, dir: "auto", placeholder: "اشرح ليش هاد الجواب صح، خطوة بخطوة." }), true),
    h("p", { class: "muted small full", text: "اكتب أسئلة من عندك أو بأسلوبك. لا تنسخ أسئلة من كتب أو امتحانات محمية بحقوق نشر." }),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف السؤال" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const options = [0, 1, 2, 3].map((i) => $("#ln-pq-o" + i).value.trim());
    if (new Set(options).size < 4) { toast("الخيارات لازم تكون مختلفة"); return; }
    const d = { uid: S.uid, section: $("#ln-pq-section").value, q: $("#ln-pq-q").value.trim(), options, correct: +$("#ln-pq-correct").value, explain: $("#ln-pq-ex").value.trim(), createdAt: Date.now() };
    if (await addDoc("psyq", d)) { f.reset(); toast("انضاف السؤال، يسلمو"); }
  });
  const draw = () => {
    const p = pool();
    countEl.textContent = `${p.length} سؤال بالبنك`;
    if (!runBox.firstChild || runBox.firstChild.classList.contains("empty")) runBox.replaceChildren(p.length ? h("div", { class: "plain spread" }, h("span", { text: "جاهز؟ الأسئلة بتطلع بترتيب عشوائي." }), h("button", { class: "btn blue", type: "button", onclick: start, text: "ابدأ التدريب" }))
      : empty("بنك الأسئلة فاضي", "الأسئلة هون بيكتبها الأعضاء. إذا خلصت البسيخومتري، أضف سؤال مع شرح من الزر تحت."));
    // leaderboard
    const rows = scores.filter((s) => !isMod("hidden", "scores:" + s.id)).map((s) => ({ ...s, c: (s.psyC || 0) + (s.quizC || 0), t: (s.psyT || 0) + (s.quizT || 0) })).filter((s) => s.t > 0).sort((a, b) => b.c - a.c || a.t - b.t);
    const myRank = rows.findIndex((r) => r.uid === S.uid);
    board.replaceChildren(rows.length ? h("div", { class: "stack" },
      h("ol", { class: "ln-board" }, rows.slice(0, 10).map((r, i) => h("li", { class: r.uid === S.uid ? "me" : null },
        h("span", { class: "num ln-rank", text: String(i + 1) }), h("span", { class: "ln-min" }, lnWho(r.uid)),
        h("span", { class: "num", text: `${r.c} صح` }), h("span", { class: "muted small num", text: `${Math.round((r.c / r.t) * 100)}%` })))),
      myRank >= 10 ? h("p", { class: "small", text: `أنت بالمرتبة ${myRank + 1}` }) : null)
      : empty("لوحة الصدارة فاضية", "حلّ جولة تدريب أو اختبار بطاقات، ونتيجتك بتنضاف هون."));
    // bank (contributors can see and moderate questions)
    const mine = qs.filter((q) => !isMod("hidden", "psyq:" + q.id)).slice(0, 30);
    bank.replaceChildren(...(mine.length ? mine.map((q) => {
      const ans = h("p", { class: "ln-pre small", hidden: true, dir: "auto", text: `الجواب: ${q.options[q.correct]}${q.explain ? "\n" + q.explain : ""}` });
      return h("div", { class: "plain item" }, h("div", { class: "row" }, h("span", { class: "pill", text: q.section }), h("span", { class: "muted small", text: nameOf(q.uid) })),
        h("p", { dir: "auto", text: q.q }), ans,
        h("div", { class: "row ln-actions" }, h("button", { class: "link small", type: "button", onclick: (e) => { ans.hidden = !ans.hidden; e.target.textContent = ans.hidden ? "اعرض الجواب" : "خبّي الجواب"; }, text: "اعرض الجواب" }),
          lnReportBtn("psyq:" + q.id), rowActions("psyq", q)));
    }) : [h("p", { class: "muted small", text: "لسا ما في أسئلة." })]));
  };
  lnSetDraw(draw);
  lnLive("psyq", { limit: 500 }, (rows) => { qs = rows; draw(); });
  lnLive("scores", { order: "updatedAt", limit: 300 }, (rows) => { scores = rows; draw(); });
  draw();
  return h("div", { class: "view ln" },
    head("التعلّم", "تدريب بسيخومتري ومسابقة", "أسئلة تدريب بيكتبها خريجون مرّوا بالبسيخومتري، مع شرح لكل حل. هاي مش أسئلة رسمية. للامتحانات التجريبية الرسمية ومواعيد الامتحان: موقع المركز القطري للامتحانات."),
    h("div", { class: "row" }, h("a", { class: "btn sm ghost", href: "https://www.nite.org.il", target: "_blank", rel: "noopener", text: "nite.org.il ↖" })),
    writeBanner(),
    h("section", { class: "section" },
      h("h2", { text: "جولة تدريب" }),
      h("div", { class: "chips" }, ["all", ...LN_PSY].map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(lnPsyState.section === s), onclick: () => { lnPsyState.section = s; renderView(); }, text: s === "all" ? "كل الأقسام" : s }))),
      h("div", { class: "spread" }, lnField("عدد الأسئلة", h("select", { id: "ln-psy-n", onchange: (e) => { lnPsyState.n = +e.target.value; } }, [5, 10, 20].map((n) => opt(n, `${n} أسئلة`, lnPsyState.n === n)))), countEl),
      runBox),
    h("section", { class: "section" }, h("h2", { text: "لوحة الصدارة" }), h("p", { class: "muted small", text: "مجموع الإجابات الصحيحة بجولات البسيخومتري واختبارات البطاقات." }), board),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ أضف سؤال تدريب" }), f),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "تصفّح بنك الأسئلة" }), bank));
};

// ---------- question of the day (57) ----------
function lnFeatured(rows) {
  const t = lnToday();
  return rows.filter((r) => r.day === t && !isMod("hidden", "qotd:" + r.id)).sort((a, b) => (b.admin ? 1 : 0) - (a.admin ? 1 : 0) || (a.createdAt || 0) - (b.createdAt || 0))[0] || null;
}
function lnAskClaude(q, out, btn) {
  btn.disabled = true;
  const p = h("p", { class: "ln-pre" }); out.replaceChildren(p); out.hidden = false;
  const input = "أنت معلّم صبور لطلاب ثانوية عرب بالنقب. اشرح حل السؤال التالي خطوة بخطوة بالعربي البسيط، وبالآخر اكتب الجواب النهائي بسطر لحاله. إذا السؤال ناقص معلومات أو مش واضح، قول هيك وما تخترع.\n\n" +
    `الموضوع: ${q.subject || "—"}\nالسؤال:\n${q.q || q.text}\n` + (q.answer ? `\nالحل اللي كتبه صاحب السؤال (للمقارنة، صحّحه إذا فيه غلط):\n${q.answer}` : "");
  ai(input, { onText: ({ text }) => { p.textContent = text; } }).then((t) => { p.textContent = t; }, (e) => { p.textContent = aiError(e); }).finally(() => { btn.disabled = false; });
}
function lnQotdCard(q, big) {
  const ans = h("div", { class: "result", hidden: true }, h("span", { class: "small", text: "الحل" }), h("p", { class: "ln-pre", dir: "auto", text: q.answer || "صاحب السؤال ما كتب حل. جرّب تسأل Claude." }));
  const aiOut = h("div", { class: "plain ln-ai", hidden: true, "aria-live": "polite" });
  const aiBtn = h("button", { class: "btn sm ghost", type: "button", onclick: () => lnAskClaude(q, aiOut, aiBtn), text: "اسأل Claude عن الحل" });
  return h("article", { class: (big ? "card" : "plain") + " item ln-qotd" },
    h("div", { class: "row" }, h("span", { class: "pill", text: q.subject }), h("span", { class: "muted small", text: lnDate(q.day, true) })),
    h("p", { class: big ? "ln-q" : "", dir: "auto", text: q.q }),
    h("div", { class: "row" }, h("button", { class: "btn sm blue", type: "button", "aria-expanded": "false", onclick: (e) => { ans.hidden = !ans.hidden; e.target.setAttribute("aria-expanded", String(!ans.hidden)); e.target.textContent = ans.hidden ? "اكشف الحل" : "خبّي الحل"; }, text: "اكشف الحل" }),
      CAP.sample ? aiBtn : null),
    ans, aiOut,
    h("div", { class: "meta" }, lnWho(q.uid), lnReportBtn("qotd:" + q.id), rowActions("qotd", q)));
}

views["ln-daily"] = () => {
  let qrows = [], chs = [], subs = [];
  const today = h("div"), archive = h("div", { class: "stack" }), queueNote = h("p", { class: "muted small" }), chList = h("div", { class: "stack" });
  const freeDay = () => { const used = new Set(qrows.map((r) => r.day)); let d = lnToday(); for (let i = 0; i < 60 && used.has(d); i++) d = lnAddDays(d, 1); return d; };
  const dayIn = h("input", { type: "date", id: "ln-qd-day", required: true, min: lnToday(), value: lnToday() });
  const qf = h("form", { class: "card form" },
    lnField("الموضوع", h("select", { id: "ln-qd-subject" }, LN_SUBJECTS.map((s) => opt(s)))),
    lnField("لأي يوم؟", dayIn),
    lnField("السؤال", h("textarea", { id: "ln-qd-q", required: true, maxlength: 1200, dir: "auto" }), true),
    lnField("الحل المفصّل", h("textarea", { id: "ln-qd-a", maxlength: 2000, dir: "auto" }), true),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف السؤال" })));
  qf.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, admin: !!S.isAdmin, subject: $("#ln-qd-subject").value, day: dayIn.value, q: $("#ln-qd-q").value.trim(), answer: $("#ln-qd-a").value.trim(), createdAt: Date.now() };
    if (!d.day || !d.q) return;
    if (await addDoc("qotd", d)) { qf.reset(); dayIn.value = freeDay(); toast("انضاف السؤال، بيطلع بيومه"); }
  });
  const revealIn = h("input", { type: "date", id: "ln-ch-reveal", required: true, min: lnToday(), value: lnAddDays(lnToday(), 7) });
  const cf = h("form", { class: "card form" },
    lnField("الموضوع", h("select", { id: "ln-ch-subject" }, opt("رياضيات"), opt("إنجليزي"))),
    lnField("الحل بينكشف يوم", revealIn),
    lnField("عنوان التحدي", h("input", { type: "text", id: "ln-ch-title", required: true, maxlength: 100 }), true),
    lnField("التحدي", h("textarea", { id: "ln-ch-text", required: true, maxlength: 2000, dir: "auto" }), true),
    lnField("الحل (بيظهر بعد يوم الكشف)", h("textarea", { id: "ln-ch-sol", maxlength: 2000, dir: "auto" }), true),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر التحدي" })));
  cf.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, subject: $("#ln-ch-subject").value, reveal: revealIn.value, title: $("#ln-ch-title").value.trim(), text: $("#ln-ch-text").value.trim(), solution: $("#ln-ch-sol").value.trim(), createdAt: Date.now() };
    if (await addDoc("challenges", d)) { cf.reset(); revealIn.value = lnAddDays(lnToday(), 7); toast("انتشر التحدي"); }
  });
  const chCard = (c) => {
    const left = lnDaysTo(c.reveal), open = left <= 0;
    const answers = subs.filter((s) => s.target === c.id && !isMod("hidden", "chsubs:" + s.id));
    const mine = answers.find((s) => s.uid === S.uid);
    const ta = h("textarea", { id: "ln-chans-" + c.id, maxlength: 1500, dir: "auto", placeholder: "اكتب حلّك هون…", "aria-label": "حلّك" });
    ta.value = mine?.answer || "";
    const form = !open && S.uid && c.uid !== S.uid ? h("form", { class: "stack" }, ta, h("div", null, h("button", { class: "btn sm blue", type: "submit", text: mine ? "عدّل حلّي" : "ابعث حلّي" }))) : null;
    form && form.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      const a = ta.value.trim(); if (!a) return;
      if (await setDoc("chsubs", `${c.id}__${S.uid}`, { uid: S.uid, target: c.id, answer: a, createdAt: mine?.createdAt || Date.now() })) toast("انحفظ حلّك. الحلول بتنكشف بيوم الكشف");
    });
    return h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: "pill", text: c.subject }), h("span", { class: open ? "pill good" : "pill warn", text: open ? "انكشف الحل" : "الكشف " + lnLeft(left) }),
        h("span", { class: "muted small", text: `${answers.length} حل` })),
      h("h3", { text: c.title }), h("p", { dir: "auto", text: c.text }),
      h("div", { class: "meta" }, lnWho(c.uid), h("span", { text: rel(c.createdAt) })),
      form,
      mine && !open ? h("p", { class: "muted small", text: "بعثت حلّك. بتقدر تعدّله لحد يوم الكشف." }) : null,
      open ? h("div", { class: "stack" },
        h("div", { class: "result" }, h("span", { class: "small", text: "الحل" }), h("p", { class: "ln-pre", dir: "auto", text: c.solution || "صاحب التحدي ما كتب حل." })),
        answers.length ? h("details", null, h("summary", { class: "link", text: `حلول المشاركين (${answers.length})` }),
          h("div", { class: "stack ln-answers" }, answers.map((s) => h("div", { class: "plain item" }, lnWho(s.uid), h("p", { dir: "auto", text: s.answer }), h("div", { class: "row" }, lnReportBtn("chsubs:" + s.id), rowActions("chsubs", s)))))) : null) : null,
      h("div", { class: "row ln-actions" }, lnReportBtn("challenges:" + c.id), rowActions("challenges", c)));
  };
  const draw = () => {
    const f = lnFeatured(qrows);
    today.replaceChildren(f ? lnQotdCard(f, true) : empty("ما في سؤال لليوم لسا", "أضف سؤال لليوم من الزر تحت، والكل بيشوفه بالصفحة الرئيسية."));
    const t = lnToday();
    const upcoming = qrows.filter((r) => r.day > t).length;
    queueNote.textContent = upcoming ? `في ${upcoming} أسئلة جاهزة للأيام الجاية.` : "ما في أسئلة مجدولة للأيام الجاية.";
    const past = qrows.filter((r) => r.day < t && !isMod("hidden", "qotd:" + r.id)).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 10);
    archive.replaceChildren(...(past.length ? past.map((q) => lnQotdCard(q, false)) : [h("p", { class: "muted small", text: "الأرشيف فاضي لسا." })]));
    const cr = chs.filter((c) => !isMod("hidden", "challenges:" + c.id));
    if (!chList.contains(document.activeElement)) chList.replaceChildren(...(cr.length ? cr.slice(0, 12).map(chCard) : [empty("ما في تحديات لسا", "انشر أول تحدي رياضيات أو إنجليزي للأسبوع، وحدّد يوم كشف الحل.")]));
    if (!dayIn.matches(":focus")) dayIn.value = dayIn.value && dayIn.value >= t && !qrows.some((r) => r.day === dayIn.value) ? dayIn.value : freeDay();
  };
  lnSetDraw(draw);
  lnLive("qotd", { limit: 200 }, (rows) => { qrows = rows; draw(); });
  lnLive("challenges", { limit: 60 }, (rows) => { chs = rows; draw(); });
  lnLive("chsubs", { limit: 1000 }, (rows) => { subs = rows; draw(); });
  draw();
  return h("div", { class: "view ln" },
    head("التعلّم", "سؤال اليوم وتحديات الأسبوع", "كل يوم سؤال واحد مع حل مفصّل، وكل أسبوع تحديات رياضيات وإنجليزي. حاول قبل ما تكشف الحل."),
    writeBanner(),
    h("section", { class: "section" }, h("h2", { text: "سؤال اليوم" }), today, queueNote,
      h("details", { class: "stack" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ اقترح سؤال ليوم معيّن" }), qf)),
    h("section", { class: "section" }, h("h2", { text: "تحديات الأسبوع" }),
      h("details", { class: "stack" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ انشر تحدي" }), cf), chList),
    h("section", { class: "section" }, h("h2", { text: "أسئلة الأيام الماضية" }), archive));
};
registerView("ln-practice", "learn", "تدريب ومسابقة", null, { order: 30 });
registerView("ln-daily", "learn", "سؤال اليوم والتحديات", null, { order: 50 });
