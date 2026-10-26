// ---------- views ----------

views.home = () => {
  const counts = { u: 0, c: 0, e: 0 }; INST.forEach((i) => counts[i.t]++);
  const sections = [
    ["uni", "قسم جامعة", "المؤسسات، شروط القبول لكل تخصص، ورابط التسجيل."],
    ["grants", "المنح", "كل المنح بمكان واحد، ومواعيد التقديم."],
    ["tools", "أدوات للجامعة", "حاسبات، اختبار الميول، القاموس، المساعد الذكي وأكثر."],
    ["learn", "التعلّم", "مواد وامتحانات، بطاقات حفظ ودروس خصوصية."],
    ["community", "المجتمع", "نقاشات، دردشة لكل فوج، قصص واستطلاعات."],
    ["career", "المسار المهني", "فرص عمل، إرشاد، ومقابلة تجريبية."],
    ["events", "الفعاليات", "لقاءات، أيام مفتوحة وورشات مع تسجيل."],
    ["guides", "الأدلة", "أدلة عملية من الصف العاشر لحد التخرج."],
  ];
  return h("div", { class: "view" },
    h("section", { class: "section" },
      eyebrow("منصة خريجي المدرسة · كل الأفواج"),
      h("h1", { text: "من الثانوية للجامعة، ومعك كل الأفواج" }),
      h("p", { class: "lede", text: "مكان واحد للخريجين وطلاب المدرسة: دليل الجامعات بالعربي، أدوات للتخطيط، مواد وامتحانات، دروس خصوصية، ودردشة بين الأفواج." }),
      h("div", { class: "row" },
        h("button", { class: "btn blue", type: "button", onclick: openProfile, text: S.alumni[S.uid] ? "عدّل ملفك" : "انضم وأنشئ ملفك" }),
        h("button", { class: "btn ghost", type: "button", "data-go": "uni", text: "تصفّح الجامعات" })),
      writeBanner(),
    ),
    h("section", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { text: counts.u }), h("span", { text: "جامعة" })),
      h("div", { class: "stat" }, h("b", { text: counts.c }), h("span", { text: "كلّيّة" })),
      h("div", { class: "stat" }, h("b", { text: counts.e }), h("span", { text: "معهد هندسائيين" })),
    ),
    h("section", { class: "section" },
      h("h2", { text: "شو في بالمنصة" }),
      h("div", { class: "tool-cards home-sections" }, sections.map(([id, t, d]) => h("button", { class: "tool-card", type: "button", "data-go": id }, h("b", { text: t }), h("span", { text: d })))),
    ),
    h("section", { class: "grid-3", id: "live-stats" }),
    // Feature widgets; a widget showing only an empty state is hidden by CSS until it has content.
    h("div", { class: "home-widgets" }, HOOKS.home.slice().sort((a, b) => a.order - b.order).map((f) => {
      try { const el = f(); return el ? h("div", { class: "home-w" }, el) : null; } catch (e) { console.warn(e); return null; }
    })),
    h("section", { class: "section" },
      h("div", { class: "spread" }, h("h2", { text: "آخر النقاشات" }), h("button", { class: "link", type: "button", "data-go": "feed", text: "كل النقاشات" })),
      h("div", { class: "stack", id: "home-posts" }),
    ),
  );
};

// universities
const uniState = { type: "all", region: "all", q: "", layout: "discs" };
views.uni = () => {
  const typeChips = [["all", "الكل"], ["u", "جامعات"], ["c", "كليات"], ["e", "هندسائيين"]];
  const v = h("div", { class: "view" },
    head("قسم «جامعة»", "اكبس على المؤسسة وفوت عالمعلومات", "كل جامعة وكلية ومعهد هندسائيين: نبذة، شروط القبول، التخصصات، ورابط التسجيل. ابحث باسم المؤسسة أو باسم التخصص."),
    h("div", { class: "section" },
      h("div", { class: "spread" },
        h("div", { class: "chips" }, typeChips.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(uniState.type === k), onclick: () => { uniState.type = k; go("uni"); }, text: l }))),
        h("div", { class: "chips" }, [["discs", "شعارات"], ["full", "كل التفاصيل"]].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(uniState.layout === k), onclick: () => { uniState.layout = k; go("uni"); }, text: l })))),
      h("div", { class: "form" },
        h("label", { class: "field" }, h("span", { text: "بحث بالمؤسسة أو التخصص" }), h("input", { type: "search", id: "uni-q", value: uniState.q, placeholder: "مثال: تمريض، سبير، בן גוריון" })),
        h("label", { class: "field" }, h("span", { text: "المنطقة" }), h("select", { id: "uni-region" }, opt("all", "كل المناطق", uniState.region === "all"), REGIONS.map((r) => opt(r, r, uniState.region === r))))),
      h("p", { class: "muted small", id: "uni-count" }),
      h("div", { id: "uni-grid" }),
    ),
    h("section", { class: "section" },
      eyebrow("قبل ما تسجّل"),
      h("h2", { text: "شروط القبول العامة" }),
      h("div", { class: "grid" }, Object.entries(GENERAL_REQ).map(([t, list]) => h("div", { class: "card stack" }, h("h3", { text: { u: "الجامعات", c: "الكليات", e: "معاهد الهندسائيين" }[t] }), reqList(list)))),
      h("p", { class: "muted small", text: "الحدود الدنيا (سيخم، معدّل، علامات) بتتغير كل سنة. الأرقام هون مأخوذة من مواقع المؤسسات بتشرين الأول 2026، وبعضها من صفحات أقدم. الرقم الرسمي دايمًا بصفحة التخصص بموقع المؤسسة." }),
    ),
    h("section", { class: "section" },
      h("h2", { text: "مؤسسة ناقصة أو معلومة غلط؟" }),
      suggestForm(),
    ),
  );
  queueMicrotask(() => {
    $("#uni-q").addEventListener("input", (e) => { uniState.q = e.target.value; drawUni(); });
    $("#uni-region").addEventListener("change", (e) => { uniState.region = e.target.value; drawUni(); });
    drawUni();
  });
  return v;
};
function reqList(list) { return h("ul", { class: "req" }, list.map((x) => h("li", { text: x }))); }
function drawUni() {
  const g = $("#uni-grid"); if (!g) return;
  const q = uniState.q.trim();
  const list = INST.filter((i) => (uniState.type === "all" || i.t === uniState.type) && (uniState.region === "all" || i.r === uniState.region) && instMatches(i, q));
  $("#uni-count").textContent = `${list.length} مؤسسة` + (q ? ` فيها «${q}»` : "");
  if (!list.length) { g.className = ""; g.replaceChildren(empty("ما في نتائج", "جرّب كلمة ثانية أو منطقة ثانية.")); return; }
  if (uniState.layout === "full") { g.className = "stack"; g.replaceChildren(...list.map((i) => h("article", { class: "card stack" }, instDetails(i, q, false)))); return; }
  g.className = "inst-grid";
  g.replaceChildren(...list.map((i) => {
    let short = L(i.ar, i.he).replace(/^(جامعة|كلية|الجامعة|معهد|المركز الأكاديمي|مركز|الكلية|أكاديمية|هندسائيين –|مدرسة الهندسائيين في|אוניברסיטת|המכללה האקדמית|המרכז האקדמי|מכללת)\s+/, "").replace(/\s*\(.*\)/, "").split(" ").slice(0, 2).join(" ");
    if (short.length > 13) short = short.split(/[\s-]/)[0];
    return h("button", { class: "inst", type: "button", onclick: () => openInst(i) },
      h("span", { class: "disc", style: `--disc-h:${hue(i.he)}` }, short),
      h("small", { text: L(i.ar, i.he) }));
  }));
}
const majorReq = (i, m) => MAJOR_REQ[i.ar + "|" + m] || null;
const majorHe = (m) => MAJOR_HE[m] || MAJOR_HE[m.replace(/\s*\(.*\)$/, "")] || "";
function majorSearchUrl(i, m) {
  const he = majorHe(m) || m;
  return "https://www.google.com/search?q=" + encodeURIComponent((i.dom ? "site:" + i.dom + " " : i.he + " ") + `"${he}" תנאי קבלה`);
}
function instDetails(i, q, inModal) {
  const here = Object.values(S.alumni).filter((a) => a.place && (a.place.includes(i.ar) || i.ar.includes(a.place) || a.place.includes(i.he)));
  const majorCount = Object.values(i.majors).reduce((n, l) => n + l.length, 0);
  const verified = Object.values(i.majors).flat().filter((m) => majorReq(i, m)).length;
  return [
    h("div", { class: "spread" }, inModal ? h("span") : h("h3", { class: "inst-title", text: L(i.ar, i.he) }),
      h("a", { class: "btn blue sm", href: regUrl(i), target: "_blank", rel: "noopener", text: i.reg ? (i.regLabel || "رابط التسجيل") : "ابحث عن صفحة التسجيل" })),
    h("div", { class: "row" }, h("span", { class: "pill", text: TYPES[i.t] }), h("span", { class: "pill grey", text: i.r }), h("span", { class: "he muted small", "data-i18n-skip": "", text: LANG === "he" ? i.ar : i.he })),
    h("p", { class: "about", text: i.about }),
    h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: "شروط القبول العامة للمؤسسة" }),
      i.req.length ? reqList(i.req) : h("p", { class: "muted small", text: "ما لقينا شروط خاصة منشورة. الشروط العامة تحت الصفحة بتنطبق." })),
    h("div", { class: "stack", style: "gap:6px" },
      h("div", { class: "spread" }, h("h4", { text: `التخصصات (${majorCount})` }), verified ? h("span", { class: "pill good", text: `${verified} فيها شروط موثّقة` }) : null),
      h("p", { class: "muted small", text: "اكبس على أي تخصص لتشوف شروط قبوله." }),
      ...Object.entries(i.majors).map(([fac, list]) => h("div", { class: "fac" }, h("span", { class: "fac-name", text: fac }),
        h("div", { class: "chips" }, list.map((m) => h("button", {
          type: "button", class: "tag tag-btn" + (q && matches(m, q) ? " hit" : "") + (majorReq(i, m) ? " verified" : ""),
          onclick: () => openMajor(i, m), text: L(m, majorHe(m)) })))))),
    !i.reg ? h("p", { class: "muted small", text: "ما لقينا صفحة تسجيل رسمية مؤكدة، فالزر بيفتح بحث Google عن صفحة التسجيل." }) : null,
    here.length ? h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: `خريجونا هناك (${here.length})` }),
      here.map((a) => h("div", { class: "row" }, avatar(a.name, a.uid), h("span", { class: "who", text: a.name }), h("span", { class: "muted small", text: `فوج ${a.year}${a.field ? " · " + a.field : ""}` }), a.mentor ? h("span", { class: "pill good", text: "متاح للمساعدة" }) : null))) : null,
  ];
}
function openInst(i) { modal(L(i.ar, i.he), h("div", { class: "stack" }, instDetails(i, uniState.q.trim(), true))); }
function openMajor(i, m) {
  const r = majorReq(i, m);
  const others = INST.filter((x) => x !== i && Object.values(x.majors).flat().some((y) => y === m));
  const src = r && safeUrl(r.src);
  modal(L(m, majorHe(m)), h("div", { class: "stack" },
    h("div", { class: "row" }, h("button", { class: "link", type: "button", onclick: () => openInst(i), text: "→ " + L(i.ar, i.he) }),
      majorHe(m) && LANG !== "he" ? h("span", { class: "he muted small", "data-i18n-skip": "", text: majorHe(m) }) : null),
    h("h4", { text: "شروط القبول لهالتخصص" }),
    r ? h("div", { class: "stack", style: "gap:8px" },
          reqList(r.req),
          h("p", { class: "muted small" }, r.year && !/غير/.test(r.year) ? L(`حسب موقع المؤسسة لسنة ${r.year}.`, `לפי אתר המוסד לשנת ${r.year}.`) : "حسب موقع المؤسسة.", " ",
            "الحدود بتتغير كل سنة، فتأكد من المصدر قبل ما تقرر.", " ", src ? h("a", { href: src, target: "_blank", rel: "noopener", text: "صفحة المصدر" }) : null))
      : h("div", { class: "banner" }, "لسا ما وثّقنا شروط هالتخصص بالذات. الشروط العامة للمؤسسة بتنطبق، والزر تحت بيفتح صفحة الشروط الرسمية."),
    h("div", { class: "row" },
      h("a", { class: "btn ghost sm", href: majorSearchUrl(i, m), target: "_blank", rel: "noopener", text: "صفحة الشروط الرسمية" }),
      h("a", { class: "btn blue sm", href: regUrl(i), target: "_blank", rel: "noopener", text: i.reg ? (i.regLabel || "رابط التسجيل") : "ابحث عن صفحة التسجيل" })),
    !r && i.req.length ? h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: "شروط المؤسسة العامة" }), reqList(i.req)) : null,
    h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: ({ u: "شروط عامة لكل الجامعات", c: "شروط عامة لكل الكليات", e: "شروط عامة لكل معاهد الهندسائيين" })[i.t] }), reqList(GENERAL_REQ[i.t])),
    others.length ? h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: `مؤسسات ثانية بتدرّس ${L(m, majorHe(m))} (${others.length})` }),
      h("div", { class: "chips" }, others.map((x) => h("button", { class: "tag tag-btn" + (majorReq(x, m) ? " verified" : ""), type: "button", onclick: () => openMajor(x, m), text: L(x.ar, x.he) })))) : null,
  ));
}
function suggestForm() {
  const f = h("form", { class: "form" },
    h("label", { class: "field" }, h("span", { text: "اسم المؤسسة" }), h("input", { type: "text", id: "sg-name", required: true, maxlength: 80 })),
    h("label", { class: "field" }, h("span", { text: "رابط موقعها (إذا بتعرف)" }), h("input", { type: "url", id: "sg-url", maxlength: 200, placeholder: "https://" })),
    h("div", { class: "field" }, h("span", { text: " " }), h("button", { class: "btn", type: "submit", text: "أرسل الاقتراح" })),
  );
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await addDoc("suggestions", { uid: S.uid, name: $("#sg-name").value.trim(), url: safeUrl($("#sg-url").value) || "", createdAt: Date.now() });
    if (ok) { f.reset(); toast("وصل الاقتراح، شكرًا"); }
  });
  return f;
}

registerView("home", "home", "الرئيسية", null, { order: 0 });
registerView("uni", "uni", "دليل المؤسسات", null, { order: 0 });
