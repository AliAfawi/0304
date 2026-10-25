// ===== learning: flashcards with SM-2 spaced repetition (52), self-quiz (53), vocabulary lists (51) =====
// Private decks: myCol() docs {t:"ln-deck"}; per-deck progress: myCol() doc "ln-prog-<deckKey>" {states:{cardKey:{e,i,r,due}}}.
// Public decks: collection "decks". Vocabulary lists: collection "vocab".
const lnMyDecks = () => LN.mine.filter((r) => r.t === "ln-deck").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const lnDeckKey = (d, pub) => (pub ? "p-" : "m-") + d.id;
function lnHash(s) { let x = 5381; for (const c of String(s)) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return x.toString(36); }
const lnCardKey = (c) => lnHash(c.f + "\u0001" + c.b);
const lnProg = (key) => lnMine("ln-prog-" + key)?.states || {};
function lnDue(d, key) {
  const st = lnProg(key), t = lnToday();
  return (d.cards || []).filter((c) => { const s = st[lnCardKey(c)]; return !s || s.due <= t; }).length;
}
// SM-2: q = 1 (ما عرفتها), 3 (صعبة), 5 (سهلة).
function lnSm2(s, q) {
  let { e = 2.5, i = 0, r = 0 } = s || {};
  if (q < 3) { r = 0; i = 1; } else { r += 1; i = r === 1 ? 1 : r === 2 ? 6 : Math.round(i * e); }
  e = Math.max(1.3, e + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { e: +e.toFixed(2), i, r, due: lnAddDays(lnToday(), i) };
}
function lnParseLines(text, cols) {
  return String(text).split("\n").map((l) => l.split(/\s*[|\t]\s*/).map((x) => x.trim())).filter((p) => p[0] && (cols === 3 ? p.length >= 2 : p[1]))
    .slice(0, 300);
}

// Generic multiple-choice runner (used by deck quizzes and psychometric practice). items: [{q, options, correct, explain}]
function lnRunner(items, { onDone, onAgain } = {}) {
  let i = 0, score = 0, picked = null;
  const root = h("div", { class: "card stack ln-run", tabindex: "0", "aria-live": "polite" });
  const choose = (k) => { if (picked != null || i >= items.length || k >= items[i].options.length) return; picked = k; if (k === items[i].correct) score++; paint(); };
  const next = () => { if (picked == null) return; i++; picked = null; if (i >= items.length && onDone) onDone(score, items.length); paint(); };
  const paint = () => {
    if (i >= items.length) {
      const pct = Math.round((score / items.length) * 100);
      root.replaceChildren(h("div", { class: "result" }, h("span", { text: "النتيجة" }), h("b", { class: "num", text: `${score} / ${items.length}` }),
        h("span", { text: pct >= 85 ? "ممتاز! كمّل هيك." : pct >= 60 ? "منيح، راجع اللي غلطت فيه وعيد." : "ولا يهمك، المراجعة هي التدريب. عيد كمان مرة." })),
        h("div", { class: "row" }, onAgain ? h("button", { class: "btn blue", type: "button", onclick: onAgain, text: "جولة جديدة" }) : null));
      return;
    }
    const it = items[i];
    root.replaceChildren(
      h("div", { class: "spread" }, h("span", { class: "muted small num", text: `سؤال ${i + 1} من ${items.length}` }), h("span", { class: "pill", text: `صح: ${score}` })),
      h("div", { class: "bar" }, h("i", { style: `width:${(i / items.length) * 100}%` })),
      h("p", { class: "ln-q", dir: "auto", text: it.q }),
      h("div", { class: "stack ln-opts" }, it.options.map((o, k) => h("button", {
        class: "ln-opt" + (picked != null && k === it.correct ? " ok" : "") + (picked === k && k !== it.correct ? " bad" : ""),
        type: "button", disabled: picked != null ? true : null, onclick: () => choose(k),
      }, h("span", { class: "ln-key num", text: String(k + 1) }), h("span", { dir: "auto", text: o })))),
      picked != null ? h("div", { class: picked === it.correct ? "banner" : "banner warn" },
        h("div", null, h("b", { text: picked === it.correct ? "صح!" : "مش هالمرة." }), it.explain ? h("p", { class: "ln-pre", dir: "auto", text: it.explain }) : null)) : null,
      h("div", { class: "spread" }, h("span", { class: "muted small", text: "مفاتيح: 1-4 للاختيار، Enter للتالي" }),
        picked != null ? h("button", { class: "btn blue", type: "button", onclick: next, text: i + 1 < items.length ? "التالي" : "شوف النتيجة" }) : null));
    if (picked != null) queueMicrotask(() => root.querySelector(".ln-run .btn.blue")?.focus({ preventScroll: true }));
  };
  root.addEventListener("keydown", (e) => {
    if (/^[1-9]$/.test(e.key)) { e.preventDefault(); choose(+e.key - 1); }
    else if (e.key === "Enter" && picked != null && e.target === root) { e.preventDefault(); next(); }
  });
  paint();
  return root;
}
async function lnAddScore(kind, c, t) {
  if (!S.uid || !S.canWrite || S.mode === "loading") return;
  const old = (await getDoc("scores", S.uid)) || {};
  const d = { uid: S.uid, psyC: old.psyC || 0, psyT: old.psyT || 0, quizC: old.quizC || 0, quizT: old.quizT || 0, runs: (old.runs || 0) + 1, createdAt: old.createdAt || Date.now(), updatedAt: Date.now() };
  d[kind + "C"] += c; d[kind + "T"] += t;
  setDoc("scores", S.uid, d);
}
const lnShuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

// ---------- study (flip cards, SM-2) ----------
function lnStudy(d, key) {
  const cards = d.cards || [];
  if (!cards.length) { toast("الرزمة فاضية"); return; }
  const t = lnToday(), st0 = lnProg(key);
  let queue = cards.filter((c) => { const s = st0[lnCardKey(c)]; return !s || s.due <= t; });
  const free = !queue.length;
  if (free) queue = lnShuffle(cards);
  let i = 0, flipped = false, done = 0;
  const states = { ...st0 };
  const box = h("div", { class: "stack ln" });
  const grade = (q) => {
    const c = queue[i]; const k = lnCardKey(c);
    states[k] = lnSm2(states[k], q); done++;
    if (q < 3) queue.push(c);
    if (S.uid && S.canWrite) lnSaveMine("ln-prog-" + key, { t: "ln-prog", deck: key, states });
    i++; flipped = false; paint();
  };
  const paint = () => {
    if (i >= queue.length) {
      box.replaceChildren(h("div", { class: "result" }, h("span", { text: "خلصت الجلسة" }), h("b", { class: "num", text: `${done}` }), h("span", { text: "بطاقة راجعتها. البطاقات بترجعلك بالوقت المناسب حسب كيف عرفتها." })),
        h("div", { class: "row" }, h("button", { class: "btn ghost", type: "button", onclick: () => { queue = lnShuffle(cards); i = 0; paint(); }, text: "مراجعة حرّة لكل البطاقات" })));
      return;
    }
    const c = queue[i];
    const cardEl = h("div", { class: "ln-flash" + (flipped ? " flipped" : ""), role: "button", tabindex: "0", "aria-label": flipped ? "الجواب" : "السؤال، اكبس لتقلب", onclick: () => { flipped = !flipped; paint(); } },
      h("span", { class: "muted small", text: flipped ? "الظهر" : "الوجه" }), h("span", { class: "ln-flash-t", dir: "auto", text: flipped ? c.b : c.f }));
    box.replaceChildren(
      h("div", { class: "spread" }, h("span", { class: "muted small num", text: `${i + 1} / ${queue.length}` }), free ? h("span", { class: "pill grey", text: "ما في مستحق اليوم، مراجعة حرّة" }) : h("span", { class: "pill", text: "مستحقة اليوم" })),
      cardEl,
      flipped ? h("div", { class: "row ln-grades" },
        h("button", { class: "btn ghost", type: "button", onclick: () => grade(1), text: "1 · ما عرفتها" }),
        h("button", { class: "btn ghost", type: "button", onclick: () => grade(3), text: "2 · صعبة" }),
        h("button", { class: "btn blue", type: "button", onclick: () => grade(5), text: "3 · سهلة" }))
        : h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: () => { flipped = true; paint(); }, text: "اقلب البطاقة" }),
          h("button", { class: "btn ghost", type: "button", disabled: i === 0 ? true : null, onclick: () => { i = Math.max(0, i - 1); paint(); }, text: "السابقة" }),
          h("button", { class: "btn ghost", type: "button", onclick: () => { i++; paint(); }, text: "تخطّى" })),
      h("p", { class: "muted small", text: "مفاتيح: مسافة أو Enter للقلب، 1/2/3 للتقييم، الأسهم للتنقّل." }));
    queueMicrotask(() => box.querySelector(".ln-flash")?.focus({ preventScroll: true }));
  };
  box.addEventListener("keydown", (e) => {
    if (i >= queue.length) return;
    if ((e.key === " " || e.key === "Enter") && e.target.classList.contains("ln-flash")) { e.preventDefault(); flipped = !flipped; paint(); }
    else if (flipped && ["1", "2", "3"].includes(e.key)) { e.preventDefault(); grade([1, 3, 5][+e.key - 1]); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); i++; flipped = false; paint(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); i = Math.max(0, i - 1); flipped = false; paint(); }
  });
  paint();
  modal("ادرس: " + d.title, box);
}
function lnQuiz(d) {
  const cards = (d.cards || []).filter((c) => c.f && c.b);
  const backs = [...new Set(cards.map((c) => c.b))];
  if (backs.length < 4) { toast("الاختبار بدّه 4 بطاقات مختلفة على الأقل"); return; }
  const make = () => lnShuffle(cards).slice(0, 10).map((c) => {
    const opts = lnShuffle([c.b, ...lnShuffle(backs.filter((b) => b !== c.b)).slice(0, 3)]);
    return { q: c.f, options: opts, correct: opts.indexOf(c.b) };
  });
  const wrap = h("div", { class: "ln" });
  const start = () => { const r = lnRunner(make(), { onDone: (s, n) => lnAddScore("quiz", s, n), onAgain: start }); wrap.replaceChildren(r); queueMicrotask(() => r.focus({ preventScroll: true })); };
  start();
  modal("اختبرني: " + d.title, wrap);
}
function lnDeckEditor(d, onSave) {
  const ta = h("textarea", { id: "ln-dk-cards", rows: 10, maxlength: 30000, placeholder: "كل سطر بطاقة: الوجه | الظهر\nمثال:\nmitochondria | الميتوكوندريا، مصنع الطاقة بالخلية\nמכינה | سنة تحضيرية" });
  ta.value = (d?.cards || []).map((c) => c.f + " | " + c.b).join("\n");
  const f = h("form", { class: "form ln" },
    lnField("اسم الرزمة", h("input", { type: "text", id: "ln-dk-title", required: true, maxlength: 80, value: d?.title || "" }), true),
    lnField("الموضوع", h("select", { id: "ln-dk-subject" }, LN_SUBJECTS.map((s) => opt(s, s, d?.subject === s)))),
    lnField("البطاقات", ta, true),
    h("p", { class: "muted small full", text: "افصل بين الوجه والظهر بخط | أو Tab. تقدر تنسخ عمودين من جدول وتلصقهم." }),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "احفظ الرزمة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cards = lnParseLines(ta.value, 2).map((p) => ({ f: p[0].slice(0, 300), b: p[1].slice(0, 500) }));
    if (!cards.length) { toast("اكتب بطاقة وحدة على الأقل: الوجه | الظهر"); return; }
    if (await onSave({ title: $("#ln-dk-title").value.trim(), subject: $("#ln-dk-subject").value, cards })) { close(); toast("انحفظت الرزمة"); }
  });
  const close = modal(d ? "عدّل الرزمة" : "رزمة بطاقات جديدة", f);
}
const lnNewMyDeck = (data) => lnSaveMine("ln-deck-" + lnId(), { t: "ln-deck", ...data });

function lnDeckCard(d, pub) {
  const key = lnDeckKey(d, pub), n = (d.cards || []).length, due = lnDue(d, key);
  const mine = pub ? d.uid === S.uid : true;
  return h("article", { class: "card item" },
    h("div", { class: "row" }, d.subject ? h("span", { class: "pill", text: d.subject }) : null, h("span", { class: "pill grey", text: `${n} بطاقة` }),
      due ? h("span", { class: "pill warn", text: `${due} مستحقة اليوم` }) : h("span", { class: "pill good", text: "ما في مستحق اليوم" })),
    h("h3", { text: d.title }),
    pub ? h("div", { class: "meta" }, lnWho(d.uid), h("span", { text: rel(d.createdAt) })) : (d.from ? h("div", { class: "muted small", text: "منسوخة من رزمة عامة" }) : null),
    h("div", { class: "row" },
      h("button", { class: "btn sm blue", type: "button", onclick: () => lnStudy(d, key), text: "ادرس" }),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => lnQuiz(d), text: "اختبرني" }),
      pub ? h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (guardWrite()) lnNewMyDeck({ title: d.title, subject: d.subject, cards: d.cards, from: d.id }).then((ok) => ok && toast("انضافت لبطاقاتي")); }, text: "انسخ لبطاقاتي" })
        : h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (!guardWrite() || !needProfile()) return; confirmBox("تنشر الرزمة للكل؟ نسخة منها بتصير عامة.", () => addDoc("decks", { uid: S.uid, title: d.title, subject: d.subject, cards: d.cards, createdAt: Date.now() }).then((ok) => ok && toast("انتشرت الرزمة، يسلمو"))); }, text: "انشرها للكل" })),
    h("div", { class: "row ln-actions" },
      mine ? h("button", { class: "link small", type: "button", onclick: () => lnDeckEditor(d, (x) => (pub ? setDoc("decks", d.id, { ...lnClean(d), ...x }) : lnSaveMine(d.id, { ...d, ...x }))), text: "عدّل" }) : null,
      pub ? lnReportBtn("decks:" + d.id) : null,
      pub ? rowActions("decks", d) : h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تحذف الرزمة؟", () => { delDoc(myCol(), d.id); delDoc(myCol(), "ln-prog-" + key); }), text: "حذف" })));
}

// ---------- vocabulary lists (51) ----------
function lnVocabEditor(v) {
  const ta = h("textarea", { id: "ln-vc-words", rows: 10, maxlength: 30000, placeholder: "كل سطر كلمة: عربي | עברית | English\nمثال:\nمعدّل | ממוצע | average\nمنحة | מלגה | scholarship" });
  ta.value = (v?.words || []).map((w) => [w.ar, w.he, w.en].join(" | ")).join("\n");
  const f = h("form", { class: "form ln" },
    lnField("اسم القائمة", h("input", { type: "text", id: "ln-vc-title", required: true, maxlength: 80, value: v?.title || "", placeholder: "مثال: مفردات بسيخومتري – وحدة 1" }), true),
    lnField("الكلمات", ta, true),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "احفظ القائمة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const words = lnParseLines(ta.value, 3).map((p) => ({ ar: (p[0] || "").slice(0, 120), he: (p[1] || "").slice(0, 120), en: (p[2] || "").slice(0, 120) }));
    if (!words.length) { toast("اكتب كلمة وحدة على الأقل"); return; }
    const data = { uid: v?.uid || S.uid, title: $("#ln-vc-title").value.trim(), words, createdAt: v?.createdAt || Date.now() };
    if (await (v ? setDoc("vocab", v.id, data) : addDoc("vocab", data))) { close(); toast("انحفظت القائمة"); }
  });
  const close = modal(v ? "عدّل القائمة" : "قائمة مفردات جديدة", f);
}
function lnVocabCard(v) {
  const words = v.words || [];
  const tbl = h("div", { class: "table-wrap", hidden: true }, h("table", null,
    h("thead", null, h("tr", null, h("th", { text: "عربي" }), h("th", { text: "עברית" }), h("th", { text: "English" }))),
    h("tbody", null, words.map((w) => h("tr", null, h("td", { text: w.ar }), h("td", { dir: "rtl", class: "he", text: w.he }), h("td", { dir: "ltr", text: w.en }))))));
  const toggle = h("button", { class: "btn sm ghost", type: "button", "aria-expanded": "false", onclick: () => { tbl.hidden = !tbl.hidden; toggle.setAttribute("aria-expanded", String(!tbl.hidden)); toggle.textContent = tbl.hidden ? "اعرض الكلمات" : "خبّي الكلمات"; }, text: "اعرض الكلمات" });
  return h("article", { class: "card item" },
    h("div", { class: "row" }, h("span", { class: "pill", text: "عربي · עברית · English" }), h("span", { class: "pill grey", text: `${words.length} كلمة` })),
    h("h3", { text: v.title }),
    h("div", { class: "meta" }, lnWho(v.uid), h("span", { text: rel(v.createdAt) })),
    h("div", { class: "row" }, toggle,
      h("button", { class: "btn sm blue", type: "button", onclick: () => { if (guardWrite()) lnNewMyDeck({ title: v.title, subject: "بسيخومتري", cards: words.map((w) => ({ f: [w.he, w.en].filter(Boolean).join(" · "), b: w.ar })), from: "vocab:" + v.id }).then((ok) => ok && toast("صارت رزمة ببطاقاتي")); }, text: "حوّلها لبطاقات" })),
    tbl,
    h("div", { class: "row ln-actions" }, canDelete(v) ? h("button", { class: "link small", type: "button", onclick: () => lnVocabEditor(v), text: "عدّل أو زيد كلمات" }) : null, lnReportBtn("vocab:" + v.id), rowActions("vocab", v)));
}

views["ln-cards"] = () => {
  const decks = h("div", { class: "grid" }), vocab = h("div", { class: "grid" });
  let vrows = [];
  const draw = () => {
    const rows = LN.decks.filter((d) => !isMod("hidden", "decks:" + d.id));
    decks.replaceChildren(...(rows.length ? rows.map((d) => lnDeckCard(d, true)) : [empty("لسا ما في رزم عامة", "اعمل رزمة ببطاقاتي وانشرها للكل، أو أضف رزمة هون مباشرة.")]));
    const vr = vrows.filter((v) => !isMod("hidden", "vocab:" + v.id));
    vocab.replaceChildren(...(vr.length ? vr.map(lnVocabCard) : [empty("لسا ما في قوائم مفردات", "ابني أول قائمة: كلمة بالعربي، بالعبري وبالإنجليزي. بتفيد للبسيخومتري وللجامعة.")]));
  };
  lnSetDraw(draw);
  lnLive("vocab", { limit: 200 }, (rows) => { vrows = rows; draw(); });
  draw();
  return h("div", { class: "view ln" },
    head("التعلّم", "بطاقات حفظ ومفردات", "رزم بطاقات بيشاركها الأعضاء، وقوائم مفردات عربي-عبري-إنجليزي. ادرس بالبطاقات وبيرجعولك بالوقت المناسب، أو اختبر حالك."),
    writeBanner(),
    h("section", { class: "section" },
      h("div", { class: "spread" }, h("h2", { text: "رزم البطاقات" }),
        h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (guardWrite() && needProfile()) lnDeckEditor(null, (x) => addDoc("decks", { uid: S.uid, ...x, createdAt: Date.now() })); }, text: "+ رزمة عامة" })),
      decks),
    h("section", { class: "section" },
      h("div", { class: "spread" }, h("h2", { text: "قوائم المفردات" }), h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (guardWrite() && needProfile()) lnVocabEditor(null); }, text: "+ قائمة مفردات" })),
      vocab));
};

views["ln-mycards"] = () => {
  const list = h("div", { class: "grid" }), sum = h("div");
  const draw = () => {
    const rows = lnMyDecks();
    const due = rows.reduce((s, d) => s + lnDue(d, lnDeckKey(d, false)), 0);
    sum.replaceChildren(rows.length ? h("div", { class: "result" }, h("span", { text: "بطاقات مستحقة اليوم" }), h("b", { class: "num", text: fmt(due) }),
      h("span", { class: "muted small", text: due ? "ابدأ بالرزمة اللي فيها أكثر بطاقات مستحقة." : "خلصت مراجعة اليوم. يعطيك العافية." })) : null);
    list.replaceChildren(...(rows.length ? rows.map((d) => lnDeckCard(d, false)) : [empty("لسا ما عندك رزم", "اعمل رزمة جديدة، أو انسخ رزمة عامة من «بطاقات ومفردات». البطاقات خاصة فيك وما حدا بيشوفها.")]));
  };
  lnSetDraw(draw);
  draw();
  return h("div", { class: "view ln" },
    head("مساحتي", "بطاقاتي", "رزمك الخاصة. كل بطاقة بترجعلك حسب كيف عرفتها (تكرار متباعد): اللي بتعرفه منيح بيبعد، واللي صعب بيرجع بسرعة."),
    writeBanner(),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: () => { if (guardWrite()) lnDeckEditor(null, lnNewMyDeck); }, text: "+ رزمة جديدة" }),
      h("button", { class: "btn ghost", type: "button", "data-go": "ln-cards", text: "تصفّح الرزم العامة" })),
    sum, list);
};
registerView("ln-cards", "learn", "بطاقات ومفردات", null, { order: 40 });
registerView("ln-mycards", "me", "بطاقاتي", null, { order: 60 });
