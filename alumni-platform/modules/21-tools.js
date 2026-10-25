// tools
let toolTab = "cost";
views.tools = () => {
  const list = TOOLS.slice().sort((a, b) => a.order - b.order);
  if (!list.some((x) => x.id === toolTab)) toolTab = list[0].id;
  const body = h("div", { class: "card", id: "tool-body" });
  const v = h("div", { class: "view" },
    head("وكمان بنفس القسم", `${list.length} أداة للجامعة`),
    h("div", { class: "tool-cards" }, list.map((x) => h("button", { class: "tool-card", type: "button", "aria-pressed": String(toolTab === x.id), onclick: () => { toolTab = x.id; go("tools"); } }, h("b", { text: x.title }), h("span", { text: x.desc })))),
    body,
  );
  queueMicrotask(() => list.find((x) => x.id === toolTab).render(body));
  return v;
};
registerView("tools", "tools", "الأدوات", null, { order: 0 });
registerTool("cost", "حاسبة تكلفة التعليم", "قدّيش رح تكلّفك سنين التعليم", (el) => toolCost(el), 10);
registerTool("bagrut", "معدّل البجروت", "المعدّل الموزون مع البونوس", (el) => toolBagrut(el), 20);
registerTool("quiz", "اختبار الميول المهني", "اكتشف أي تخصّص بيناسبك", (el) => toolQuiz(el), 30);
registerTool("dict", "قاموس الجامعة", "مصطلحات الجامعة بالعبري، وشو معناها بالعربي", (el) => toolDict(el), 40);
registerTool("grants", "المنح", "منح ومساعدات للطلاب بمكان واحد", (el) => toolGrants(el), 50);
function toolCost(el) {
  const saved = lsGet("cost", { years: 3, tuition: 10900, rent: 1600, months: 10, travel: 350, books: 1500, grant: 0, live: "dorm" });
  const fields = [
    ["years", "عدد سنوات اللقب", 1, 7, 1],
    ["tuition", "رسوم التعليم بالسنة (₪)", 0, 60000, 100],
    ["rent", "سكن بالشهر (₪)", 0, 6000, 50],
    ["months", "أشهر السكن بالسنة", 0, 12, 1],
    ["travel", "مواصلات بالشهر (₪)", 0, 3000, 10],
    ["books", "كتب ومعدات بالسنة (₪)", 0, 10000, 100],
    ["grant", "منح متوقّعة بالسنة (₪)", 0, 60000, 100],
  ];
  const out = h("div", { class: "result" });
  const calc = () => {
    const v = {}; fields.forEach(([k]) => (v[k] = Math.max(0, +$("#cost-" + k).value || 0)));
    lsSet("cost", v);
    const perYear = v.tuition + v.rent * v.months + v.travel * 12 + v.books - v.grant;
    const total = perYear * v.years;
    out.replaceChildren(h("span", { class: "muted", text: "التكلفة التقديرية للّقب كله" }), h("b", { text: "₪ " + fmt(Math.max(0, total)) }),
      h("span", { class: "small", text: `بالسنة: ₪ ${fmt(Math.max(0, perYear))} · بالشهر تقريبًا: ₪ ${fmt(Math.max(0, perYear / 12))}` }));
  };
  el.replaceChildren(
    h("h2", { text: "حاسبة تكلفة التعليم" }),
    h("p", { class: "muted", text: "الأرقام المعبّاة تقديرية كمثال. رسوم الجامعات والكليات المدعومة قريبة من بعض، والكليات الخاصة أغلى بكثير. افحص الرقم الدقيق بموقع المؤسسة." }),
    h("div", { class: "form" }, fields.map(([k, l, min, max, step]) => h("label", { class: "field" }, h("span", { text: l }), h("input", { type: "number", id: "cost-" + k, min, max, step, value: saved[k] ?? 0, oninput: calc })))),
    out,
  );
  calc();
}
function toolBagrut() {
  const el = arguments[0];
  const rows = lsGet("bagrut", [
    ["رياضيات", 5, 85], ["إنجليزي", 5, 90], ["عربي", 3, 88], ["عبري", 3, 80], ["مدنيات", 2, 84], ["تاريخ", 2, 79], ["بيولوجيا", 5, 92],
  ]);
  const tbody = h("tbody");
  const out = h("div", { class: "result" });
  const readRows = () => [...tbody.querySelectorAll("tr")].map((tr) => [tr.querySelector(".s").value, +tr.querySelector(".u").value, +tr.querySelector(".g").value]);
  const bonus = (subj, u, g) => (g < 60 ? 0 : u >= 5 ? (subj.includes("رياض") ? +$("#bg-math").value : 25) : u === 4 ? 12.5 : 0);
  const calc = () => {
    const r = readRows(); lsSet("bagrut", r);
    let su = 0, plain = 0, withB = 0;
    r.forEach(([s, u, g]) => { if (!u || isNaN(g)) return; su += u; plain += g * u; withB += (g + bonus(s, u, g)) * u; });
    const units = su;
    out.replaceChildren(
      h("span", { class: "muted", text: "المعدّل الموزون مع البونوس" }), h("b", { text: su ? (withB / su).toFixed(2) : "—" }),
      h("span", { class: "small", text: `بدون بونوس: ${su ? (plain / su).toFixed(2) : "—"} · مجموع الوحدات: ${units}${units < 21 ? " (أغلب المؤسسات بتطلب 21 وحدة على الأقل)" : ""}` }));
  };
  const addRow = ([s, u, g]) => tbody.append(h("tr", null,
    h("td", null, h("input", { class: "s", type: "text", value: s, "aria-label": "الموضوع", oninput: calc })),
    h("td", null, h("select", { class: "u", "aria-label": "الوحدات", onchange: calc }, [1, 2, 3, 4, 5].map((x) => opt(x, String(x), x === u)))),
    h("td", null, h("input", { class: "g", type: "number", min: 0, max: 100, value: g, "aria-label": "العلامة", oninput: calc })),
    h("td", null, h("button", { class: "link danger", type: "button", onclick: (e) => { e.target.closest("tr").remove(); calc(); }, text: "×", "aria-label": "إزالة" }))));
  rows.forEach(addRow);
  el.replaceChildren(
    h("h2", { text: "حاسبة معدّل البجروت" }),
    h("p", { class: "muted", text: "القاعدة الشائعة: 5 وحدات بعلامة 60 وفوق بتاخذ بونوس 25، و4 وحدات 12.5. الرياضيات 5 وحدات بتاخذ 35 بمؤسسات كثيرة. كل مؤسسة إلها قواعد، فاعتبر النتيجة تقريبية. العلامات المعبّاة مثال، غيّرها لعلاماتك." }),
    h("label", { class: "field", style: "max-width:260px" }, h("span", { text: "بونوس رياضيات 5 وحدات" }), h("select", { id: "bg-math", onchange: calc }, opt(35, "35", true), opt(30, "30"), opt(25, "25"))),
    h("div", { class: "table-wrap" }, h("table", null, h("thead", null, h("tr", null, h("th", { text: "الموضوع" }), h("th", { text: "وحدات" }), h("th", { text: "العلامة" }), h("th", null))), tbody)),
    h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", onclick: () => { addRow(["", 2, 80]); calc(); }, text: "+ موضوع" })),
    out,
  );
  calc();
}
function toolQuiz(el) {
  const ans = lsGet("quiz", {});
  const out = h("div", { class: "stack" });
  const scale = [["0", "مش أنا"], ["1", "شوي"], ["2", "كثير أنا"]];
  const calc = () => {
    lsSet("quiz", ans);
    const done = Object.keys(ans).length;
    if (done < QUIZ.length) { out.replaceChildren(h("p", { class: "muted", text: `جاوبت ${done} من ${QUIZ.length}. كمّل لتشوف النتيجة.` })); return; }
    const sc = {}; QUIZ.forEach(([, t], i) => (sc[t] = (sc[t] || 0) + (+ans[i] || 0)));
    const ranked = Object.entries(sc).sort((a, b) => b[1] - a[1]);
    out.replaceChildren(h("h3", { text: "النتيجة" }), ...ranked.map(([t, s], idx) => h("div", { class: "stack", style: "gap:4px" },
      h("div", { class: "spread" }, h("b", { text: RIASEC[t][0] }), h("span", { class: "num muted", text: `${s}/4` })),
      h("div", { class: "bar" }, h("i", { style: `width:${(s / 4) * 100}%` })),
      idx < 2 ? h("span", { class: "small", text: "تخصصات ممكن تناسبك: " + RIASEC[t][1] }) : null)),
      h("p", { class: "muted small", text: "هذا اختبار قصير للتوجيه فقط. احكي مع مستشارة المدرسة ومع خريجين من التخصص قبل ما تقرر." }),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => { lsSet("quiz", {}); toolQuiz(el); }, text: "ابدأ من جديد" }));
  };
  el.replaceChildren(
    h("h2", { text: "اختبار الميول المهني" }),
    h("p", { class: "muted", text: "12 جملة. اختار قدّيش كل جملة بتوصفك." }),
    h("div", null, QUIZ.map(([q], i) => h("div", { class: "q" }, h("span", { text: `${i + 1}. ${q}` }),
      h("div", { class: "scale" }, scale.map(([v, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(ans[i] === v), onclick: (e) => { ans[i] = v; e.target.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.target))); calc(); }, text: l })))))),
    out,
  );
  calc();
}
function toolDict(el) {
  const list = h("div", { class: "table-wrap" });
  const draw = (q) => {
    q = q.trim();
    const rows = DICT.filter((d) => !q || d.some((x) => x.includes(q)));
    list.replaceChildren(rows.length ? h("table", null, h("thead", null, h("tr", null, h("th", { text: "بالعبري" }), h("th", { text: "كيف بتنلفظ" }), h("th", { text: "المعنى" }))),
      h("tbody", null, rows.map(([he, tr, ar]) => h("tr", null, h("td", { class: "he", text: he }), h("td", { class: "muted", text: tr }), h("td", { text: ar })))))
      : empty("ما لقينا المصطلح", "اقترحه بالمجتمع تحت تصنيف «سؤال»."));
  };
  el.replaceChildren(h("h2", { text: "قاموس الجامعة" }), h("p", { class: "muted", text: `${DICT.length} مصطلح بتسمعها من أول يوم بالجامعة.` }),
    h("label", { class: "field" }, h("span", { text: "ابحث بالعبري أو العربي" }), h("input", { type: "search", id: "dict-q", oninput: (e) => draw(e.target.value) })), list);
  draw("");
}
function toolGrants(el) {
  el.replaceChildren(h("h2", { text: "المنح والمساعدات" }),
    h("p", { class: "muted", text: "نقطة بداية. المواعيد والشروط بتتغير كل سنة، فافحص بالمصدر. وإذا بتعرف منحة، انشرها بالمجتمع تحت تصنيف «منحة»." }),
    h("div", { class: "stack" }, SCHOLARSHIPS.map(([t, d, u]) => h("div", { class: "plain item" },
      h("h3", { text: t }), h("p", { class: "muted", text: d }),
      u.startsWith("#") ? h("button", { class: "link", type: "button", "data-go": u.slice(1), text: "افتح قسم جامعة" }) : h("a", { href: u, target: "_blank", rel: "noopener", text: "افتح" })))));
}

