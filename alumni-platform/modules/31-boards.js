// ===== learning: reading corner (183), science & tech projects (187), clubs & competitions (188-190) =====
// Data: books, bookrates (`${bookId}__${uid}`), clubs, sciprojects, lnjoins (`${targetId}__${uid}`, v:1 joined / 0 left).
const LN_LANGS = ["عربي", "עברית", "English", "لغة ثانية"];
const LN_CLUBS = ["برمجة وروبوتيكا", "مناظرات ولغة", "أولمبياد ومسابقات", "نادي ثاني"];
const LN_FIELDS = ["علوم", "تكنولوجيا وبرمجة", "هندسة وروبوتيكا", "بيئة", "طب وصحة", "مجال ثاني"];
const LN_STAGES = ["فكرة", "قيد العمل", "خلص"];
const lnBoard = { lang: "all", club: "all", tab: "clubs" };

views["ln-books"] = () => {
  let books = [], rates = [];
  const list = h("div", { class: "grid" });
  const f = h("form", { class: "card form" },
    lnField("اسم الكتاب", h("input", { type: "text", id: "ln-bk-title", required: true, maxlength: 120, dir: "auto" }), true),
    lnField("الكاتب", h("input", { type: "text", id: "ln-bk-author", maxlength: 80, dir: "auto" })),
    lnField("اللغة", h("select", { id: "ln-bk-lang" }, LN_LANGS.map((l) => opt(l)))),
    lnField("ليش بتنصح فيه؟", h("textarea", { id: "ln-bk-note", required: true, maxlength: 800 }), true),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف الكتاب" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, title: $("#ln-bk-title").value.trim(), author: $("#ln-bk-author").value.trim(), lang: $("#ln-bk-lang").value, note: $("#ln-bk-note").value.trim(), createdAt: Date.now() };
    if (await addDoc("books", d)) { f.reset(); toast("انضاف الكتاب، يسلمو"); }
  });
  const rate = (b, n) => {
    if (!guardWrite()) return;
    setDoc("bookrates", `${b.id}__${S.uid}`, { uid: S.uid, target: b.id, stars: n, createdAt: Date.now() }).then((ok) => ok && toast("انحفظ تقييمك"));
  };
  const draw = () => {
    const stat = {};
    rates.forEach((r) => { const s = (stat[r.target] ||= { n: 0, sum: 0, mine: 0 }); s.n++; s.sum += +r.stars || 0; if (r.uid === S.uid) s.mine = r.stars; });
    const rows = books.filter((b) => !isMod("hidden", "books:" + b.id) && (lnBoard.lang === "all" || b.lang === lnBoard.lang))
      .sort((a, b) => ((stat[b.id]?.sum || 0) / (stat[b.id]?.n || 1)) - ((stat[a.id]?.sum || 0) / (stat[a.id]?.n || 1)) || (b.createdAt || 0) - (a.createdAt || 0));
    list.replaceChildren(...(rows.length ? rows.map((b) => {
      const s = stat[b.id] || { n: 0, sum: 0, mine: 0 };
      return h("article", { class: "card item" },
        h("div", { class: "row" }, h("span", { class: "pill", text: b.lang })),
        h("h3", { dir: "auto", text: b.title }), b.author ? h("div", { class: "muted small", dir: "auto", text: b.author }) : null,
        h("p", { text: b.note }),
        h("div", { class: "spread" }, lnStars(s.n ? s.sum / s.n : 0, s.n),
          h("div", { class: "ln-starpick", role: "group", "aria-label": "قيّم الكتاب" }, [1, 2, 3, 4, 5].map((n) =>
            h("button", { class: "ln-star", type: "button", "aria-pressed": String(n <= s.mine), "aria-label": `قيّم ${n} من 5`, onclick: () => rate(b, n) }, "★")))),
        h("div", { class: "meta" }, h("span", null, "نصيحة من ", lnWho(b.uid)), h("span", { text: rel(b.createdAt) }), lnReportBtn("books:" + b.id), rowActions("books", b)));
    }) : [empty(books.length ? "ما في كتب بهاللغة" : "ركن القراءة فاضي لسا", "شو آخر كتاب حبّيته؟ أضفه وقول ليش بتنصح فيه.")]));
  };
  lnSetDraw(draw);
  lnLive("books", { limit: 300 }, (rows) => { books = rows; draw(); });
  lnLive("bookrates", { limit: 2000 }, (rows) => { rates = rows; draw(); });
  draw();
  return h("div", { class: "view ln" },
    head("التعلّم", "ركن القراءة", "كتب بينصح فيها خريجون وطلاب، بالعربي والعبري والإنجليزي. قيّم اللي قرأته، ودوّر على كتابك الجاي."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ انصح بكتاب" }), f),
    h("div", { class: "chips" }, ["all", ...LN_LANGS].map((l) => h("button", { class: "chip", type: "button", "aria-pressed": String(lnBoard.lang === l), onclick: () => { lnBoard.lang = l; renderView(); }, text: l === "all" ? "كل اللغات" : l }))),
    list);
};

views["ln-clubs"] = () => {
  let clubs = [], projects = [], joins = [];
  const list = h("div", { class: "grid" });
  const isClubs = lnBoard.tab === "clubs";
  const f = isClubs ? h("form", { class: "card form" },
    lnField("نوع النادي", h("select", { id: "ln-cl-type" }, LN_CLUBS.map((c) => opt(c)))),
    lnField("الاسم", h("input", { type: "text", id: "ln-cl-title", required: true, maxlength: 80, placeholder: "مثال: نادي روبوتيكا للصف العاشر" })),
    lnField("متى ووين؟", h("input", { type: "text", id: "ln-cl-when", maxlength: 100, placeholder: "مثال: كل أربعاء بعد الدوام، أونلاين" })),
    lnField("رابط (اختياري)", h("input", { type: "url", id: "ln-cl-link", maxlength: 300, placeholder: "https://…" })),
    lnField("عن النادي أو المسابقة", h("textarea", { id: "ln-cl-text", required: true, maxlength: 1000 }), true),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف" })))
    : h("form", { class: "card form" },
      lnField("اسم المشروع", h("input", { type: "text", id: "ln-pj-title", required: true, maxlength: 100 }), true),
      lnField("المجال", h("select", { id: "ln-pj-field" }, LN_FIELDS.map((c) => opt(c)))),
      lnField("المرحلة", h("select", { id: "ln-pj-stage" }, LN_STAGES.map((c) => opt(c)))),
      lnField("بتدوّر على؟ (اختياري)", h("input", { type: "text", id: "ln-pj-need", maxlength: 100, placeholder: "مثال: شريك بيعرف Arduino، أو مرشد" })),
      lnField("رابط (اختياري)", h("input", { type: "url", id: "ln-pj-link", maxlength: 300, placeholder: "https://…" })),
      lnField("وصف المشروع", h("textarea", { id: "ln-pj-text", required: true, maxlength: 1200 }), true),
      h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف المشروع" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const p = isClubs ? "ln-cl-" : "ln-pj-";
    const raw = $("#" + p + "link").value.trim(), link = raw ? safeUrl(raw) : "";
    if (raw && !link) { toast("الرابط لازم يبلّش بـ https://"); return; }
    const d = isClubs
      ? { uid: S.uid, type: $("#ln-cl-type").value, title: $("#ln-cl-title").value.trim(), when: $("#ln-cl-when").value.trim(), link, text: $("#ln-cl-text").value.trim(), createdAt: Date.now() }
      : { uid: S.uid, field: $("#ln-pj-field").value, stage: $("#ln-pj-stage").value, title: $("#ln-pj-title").value.trim(), need: $("#ln-pj-need").value.trim(), link, text: $("#ln-pj-text").value.trim(), createdAt: Date.now() };
    if (await addDoc(isClubs ? "clubs" : "sciprojects", d)) { f.reset(); toast("انضاف"); }
  });
  const toggleJoin = (item, col, label) => {
    if (!guardWrite() || !needProfile()) return;
    const on = !joins.some((j) => j.target === item.id && j.uid === S.uid && j.v);
    setDoc("lnjoins", `${item.id}__${S.uid}`, { uid: S.uid, target: item.id, col, v: on ? 1 : 0, createdAt: Date.now() }).then((ok) => {
      if (!ok) return;
      toast(on ? "انضفت" : "انشلت");
      if (on) lnNote(item.uid, "join", label + ": " + item.title, "ln-clubs");
    });
  };
  const draw = () => {
    const rowsIn = isClubs ? clubs.filter((c) => !isMod("hidden", "clubs:" + c.id) && (lnBoard.club === "all" || c.type === lnBoard.club)) : projects.filter((p) => !isMod("hidden", "sciprojects:" + p.id));
    list.replaceChildren(...(rowsIn.length ? rowsIn.map((x) => {
      const members = joins.filter((j) => j.target === x.id && j.v);
      const joined = members.some((j) => j.uid === S.uid);
      const link = safeUrl(x.link);
      return h("article", { class: "card item" },
        h("div", { class: "row" }, h("span", { class: "pill", text: isClubs ? x.type : x.field }), !isClubs ? h("span", { class: "pill grey", text: x.stage }) : null),
        h("h3", { text: x.title }),
        isClubs && x.when ? h("div", { class: "small" }, "متى: ", h("b", { text: x.when })) : null,
        h("p", { text: x.text }),
        !isClubs && x.need ? h("div", { class: "banner" }, h("span", null, "بدوّروا على: ", h("b", { text: x.need }))) : null,
        h("div", { class: "meta" }, lnWho(x.uid), h("span", { text: rel(x.createdAt) })),
        members.length ? h("div", { class: "muted small", text: (isClubs ? "الأعضاء: " : "مهتمّين: ") + members.slice(0, 6).map((m) => nameOf(m.uid)).join("، ") + (members.length > 6 ? ` و${members.length - 6} كمان` : "") }) : null,
        h("div", { class: "spread" },
          h("div", { class: "row" },
            x.uid === S.uid ? null : h("button", { class: "btn sm " + (joined ? "ghost" : "blue"), type: "button", onclick: () => toggleJoin(x, isClubs ? "clubs" : "sciprojects", isClubs ? "عضو جديد بناديك" : "حدا مهتم بمشروعك"), text: joined ? (isClubs ? "اطلع من النادي" : "شيل الاهتمام") : (isClubs ? "انضم" : "مهتم/ة") }),
            h("span", { class: "muted small num", text: `${members.length}` + (isClubs ? " عضو" : " مهتم") }),
            link ? h("a", { class: "btn sm ghost", href: link, target: "_blank", rel: "noopener", text: "الرابط" }) : null),
          h("div", { class: "row" }, lnReportBtn((isClubs ? "clubs:" : "sciprojects:") + x.id), rowActions(isClubs ? "clubs" : "sciprojects", x))));
    }) : [isClubs ? empty("ما في نوادي لسا", "بتعلّم برمجة أو روبوتيكا؟ بتحضّر لأولمبياد أو مناظرة؟ افتح نادي وخلّي الطلاب ينضمّوا.")
      : empty("ما في مشاريع لسا", "عندك مشروع علوم أو تكنولوجيا؟ أضفه وقول إذا بتدوّر على شريك أو مرشد.")]));
  };
  lnSetDraw(draw);
  lnLive(isClubs ? "clubs" : "sciprojects", { limit: 200 }, (rows) => { if (isClubs) clubs = rows; else projects = rows; draw(); });
  lnLive("lnjoins", { limit: 2000 }, (rows) => { joins = rows; draw(); });
  draw();
  return h("div", { class: "view ln" },
    head("التعلّم", "نوادي ومسابقات ومشاريع", "نوادي برمجة وروبوتيكا، مناظرات ولغة، تحضير للأولمبياد، ولوحة مشاريع علوم وتكنولوجيا بيدوّر أصحابها على شركاء ومرشدين."),
    writeBanner(),
    h("div", { class: "chips" }, [["clubs", "نوادي ومسابقات"], ["projects", "مشاريع علوم وتكنولوجيا"]].map(([k, l]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(lnBoard.tab === k), onclick: () => { lnBoard.tab = k; renderView(); }, text: l }))),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: isClubs ? "+ افتح نادي أو أعلن عن مسابقة" : "+ أضف مشروع" }), f),
    isClubs ? h("div", { class: "chips" }, ["all", ...LN_CLUBS].map((c) => h("button", { class: "chip", type: "button", "aria-pressed": String(lnBoard.club === c), onclick: () => { lnBoard.club = c; renderView(); }, text: c === "all" ? "الكل" : c }))) : null,
    list);
};
registerView("ln-exams", "learn", "مواعيد الامتحانات", null, { order: 60 });
registerView("ln-books", "learn", "ركن القراءة", null, { order: 70 });
registerView("ln-clubs", "learn", "نوادي ومشاريع", null, { order: 80 });
registerView("ln-plan", "me", "خطة المراجعة", null, { order: 61 });
registerView("ln-bagrut", "me", "تقدّمي بالبجروت", null, { order: 62 });
