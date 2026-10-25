// ===== platform team: about-the-platform pages (section "ideas"): changelog, roadmap, contribute + ambassadors,
// impact report, sponsors, satisfaction survey =====

function pfIdeaStats() {
  let n = 0;
  return IDEAS.map((g) => {
    const items = g.items.map((t) => ({ n: ++n, done: t[0] === "*", t: t.replace(/^\*/, "") }));
    return { c: g.c, items, done: items.filter((x) => x.done).length, total: items.length };
  });
}

// ---------- 203 changelog ----------
registerView("changelog", "ideas", "سجل التحديثات", () => {
  const cats = pfIdeaStats();
  const built = cats.reduce((s, g) => s + g.done, 0);
  return h("div", { class: "view" },
    head("عن المنصة", "سجل التحديثات", "شو تغيّر بالمنصة، وشو موجود فيها هلّق."),
    h("section", { class: "section" }, h("h2", { text: "آخر التحديثات" }), h("div", { class: "stack", id: "pf-log" })),
    h("section", { class: "section" },
      h("h2", { text: `موجود بهالنسخة (${built})` }),
      h("div", { class: "stack" }, cats.filter((g) => g.done).map((g) => h("details", { class: "plain pf-det" },
        h("summary", null, h("b", { text: g.c }), h("span", { class: "pill good", text: `${g.done}` })),
        h("ul", { class: "req" }, g.items.filter((x) => x.done).map((x) => h("li", { text: x.t }))))))));
}, { order: 10 });
HOOKS.lists.push(() => {
  const el = $("#pf-log"); if (!el) return;
  const items = plCfgItems("changelog");
  el.replaceChildren(...(items.length ? items.map((x) => h("article", { class: "card item" },
    h("div", { class: "meta" }, h("span", { class: "pill", text: "تحديث" }), h("span", { text: new Date(x.createdAt).toLocaleDateString("ar-EG-u-nu-latn") })),
    h("h3", { text: x.title }), x.text ? h("p", { text: x.text }) : null))
    : [empty("لسا ما انكتب تحديث", "الإدارة بتضيف هون كل تغيير بالمنصة من «المحتوى والإعدادات».")]));
});

// ---------- 266 roadmap ----------
registerView("roadmap", "ideas", "خطة التطوير", () => {
  const cats = pfIdeaStats();
  const total = cats.reduce((s, g) => s + g.total, 0), done = cats.reduce((s, g) => s + g.done, 0);
  const pct = Math.round((done / total) * 100);
  return h("div", { class: "view" },
    head("عن المنصة", "خطة التطوير", "وين وصلنا بكل محور من أفكار المنصة، وشو الخطوات الجاية. الترتيب مقترح وبيتغيّر حسب حاجة الأعضاء."),
    h("div", { class: "result" }, h("span", { class: "muted", text: "تقدّم المنصة" }), h("b", { text: `${pct}%` }), h("span", { class: "small", text: `${done} من ${total} فكرة صارت موجودة` })),
    h("section", { class: "section" }, h("h2", { text: "حسب المحور" }),
      h("div", { class: "ad-bars" }, cats.map((g) => h("div", { class: "ad-bar-row", title: `${g.c}: ${g.done}/${g.total}` }, h("span", { class: "ad-bar-k", text: g.c }),
        h("span", { class: "ad-bar-track" }, h("i", { style: `width:${Math.max(2, (g.done / g.total) * 100)}%` })), h("span", { class: "ad-bar-v num", text: `${g.done}/${g.total}` }))))),
    h("section", { class: "section" }, h("h2", { text: "الخطوات الجاية بكل محور" }),
      h("div", { class: "grid" }, cats.filter((g) => g.done < g.total).map((g) => h("div", { class: "card stack" }, h("h3", { text: g.c }),
        h("ul", { class: "req" }, g.items.filter((x) => !x.done).slice(0, 3).map((x) => h("li", { text: x.t }))),
        h("button", { class: "link small", type: "button", onclick: () => { ideaState.cat = String(cats.indexOf(g)); ideaState.built = false; go("ideas"); }, text: "كل أفكار المحور" }))))),
    h("p", { class: "muted small", text: "عندك فكرة أو بدك تساعد بتنفيذ وحدة؟ شوف «شارك بالتطوير»." }));
}, { order: 20 });

// ---------- 262/263/265 contribute + ambassadors ----------
const PF_ROLES = ["سفير/ة الفوج", "برمجة", "تصميم", "كتابة محتوى", "ترجمة للعبري"];
let pfAmb = [];
registerView("contribute", "ideas", "شارك بالتطوير", () => {
  onLeave(subscribe("ambassadors", { limit: 500 }, (rows) => { pfAmb = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); }));
  const f = h("form", { class: "card form", id: "pf-amb-form" },
    h("fieldset", { class: "full pf-roles" }, h("legend", { class: "small muted", text: "شو بتحب تعمل؟" }),
      h("div", { class: "chips" }, PF_ROLES.map((r, i) => h("label", { class: "check" }, h("input", { type: "checkbox", id: `pf-role-${i}`, value: r }), r)))),
    h("label", { class: "field full" }, h("span", { text: "كلمتين عنك (اختياري)" }), h("input", { type: "text", id: "pf-amb-note", maxlength: 160, placeholder: "مثال: بدرس هندسة برمجيات وبقدر أساعد بالتصميم" })),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", id: "pf-amb-submit", text: "سجّلني" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const roles = PF_ROLES.filter((_, i) => $(`#pf-role-${i}`).checked);
    if (!roles.length) { toast("اختار شي واحد على الأقل"); return; }
    const prev = pfAmb.find((a) => a.uid === S.uid);
    if (await setDoc("ambassadors", S.uid, { uid: S.uid, year: S.alumni[S.uid]?.year || null, roles, note: $("#pf-amb-note").value.trim(), createdAt: prev?.createdAt || Date.now(), updatedAt: Date.now() })) toast("انسجّلت، شكرًا إلك");
  });
  return h("div", { class: "view" },
    head("عن المنصة", "شارك بتطوير المنصة", "المنصة إلنا كلنا. بتقدر تساعد كسفير/ة لفوجك، أو بالبرمجة والتصميم والمحتوى."),
    writeBanner(),
    h("div", { class: "grid" },
      h("div", { class: "card stack" }, h("h3", { text: "سفير/ة لكل فوج" }), h("p", { class: "muted", text: "بتعرّف فوجك على المنصة، بتجمع أسئلتهم، وبتوصّل ملاحظاتهم للإدارة." })),
      h("div", { class: "card stack" }, h("h3", { text: "فريق طلابي للتطوير" }), h("p", { class: "muted", text: "طلاب المدرسة والخريجين بيقدروا يطوّروا أقسام جديدة كمشروع تخرّج أو تطوّع، بمرافقة الإدارة." })),
      h("div", { class: "card stack" }, h("h3", { text: "مدرسة ثانية بدها منصة؟" }), h("p", { class: "muted", text: "المنصة مبنية كصفحة وحدة بتنقدر تنسخ لمدرسة ثانية بالمنطقة. احكوا مع إدارة المنصة." }))),
    h("section", { class: "section" }, h("h2", { text: "تطوّع معنا" }), f, h("div", { id: "pf-amb-mine" })),
    h("section", { class: "section" }, h("h2", { text: "السفراء والمتطوعين حسب الفوج" }), h("div", { class: "stack", id: "pf-amb-list" })));
}, { order: 30 });
HOOKS.lists.push(() => {
  const el = $("#pf-amb-list"); if (!el) return;
  const mine = pfAmb.find((a) => a.uid === S.uid);
  const m = $("#pf-amb-mine");
  if (m) m.replaceChildren(mine ? h("div", { class: "banner" }, h("span", { text: `انت مسجّل: ${(mine.roles || []).join("، ")}` }),
    h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تلغي تسجيلك؟", () => delDoc("ambassadors", S.uid)), text: "إلغاء التسجيل" })) : "");
  if (mine && !el.dataset.filled) { el.dataset.filled = "1"; PF_ROLES.forEach((r, i) => { const c = $(`#pf-role-${i}`); if (c) c.checked = (mine.roles || []).includes(r); }); const n = $("#pf-amb-note"); if (n) n.value = mine.note || ""; const b = $("#pf-amb-submit"); if (b) b.textContent = "حدّث تسجيلي"; }
  const groups = {};
  pfAmb.forEach((a) => { const y = S.alumni[a.uid]?.year || a.year || "بدون فوج"; (groups[y] ||= []).push(a); });
  const ys = Object.keys(groups).sort((a, b) => (+b || 0) - (+a || 0));
  el.replaceChildren(...(ys.length ? ys.map((y) => h("div", { class: "card stack" }, h("h3", { text: +y ? `فوج ${y}` : y }),
    ...groups[y].map((a) => h("div", { class: "row" }, avatar(nameOf(a.uid), a.uid), h("span", { class: "who", text: nameOf(a.uid) }),
      ...(a.roles || []).map((r) => h("span", { class: r === PF_ROLES[0] ? "pill good" : "pill grey", text: r })),
      a.note ? h("span", { class: "muted small pf-note", text: a.note }) : null))))
    : [empty("لسا ما في متطوعين", "كون أول سفير/ة لفوجك من النموذج فوق.")]));
});

// ---------- 264 impact report ----------
let pfImpactRange = "all";
registerView("impact", "ideas", "تقرير الأثر", () => h("div", { class: "view" },
  head("عن المنصة", "تقرير الأثر", "قديش المنصة ساعدت؟ أرقام محسوبة من المحتوى الموجود فعلًا، بتتحدّث لحالها."),
  h("div", { class: "chips" }, [["all", "من البداية"], ["year", "آخر 12 شهر"], ["month", "هالشهر"]].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(pfImpactRange === k), onclick: () => { pfImpactRange = k; go("impact"); }, text: l }))),
  h("div", { id: "pf-impact" })), { order: 40 });
function pfImpact() {
  const since = pfImpactRange === "month" ? plMonthStart() : pfImpactRange === "year" ? Date.now() - 365 * 864e5 : 0;
  const inR = (r) => (r.createdAt || 0) >= since;
  const al = Object.values(S.alumni);
  const helpers = new Set([...S.materials.filter(inR).map((m) => m.uid), ...S.tutors.filter((t) => t.type === "offer" && inR(t)).map((t) => t.uid)]);
  return [
    ["أعضاء بالدليل", (since ? al.filter(inR) : al).length, since ? "انضموا بهالفترة" : "من كل الأفواج"],
    ["أفواج ممثّلة", new Set(al.map((a) => a.year)).size, "على مر السنين"],
    ["متاحين للإرشاد", al.filter((a) => a.mentor).length, "خريجين جاهزين يساعدوا"],
    ["مواد وامتحانات", S.materials.filter(inR).length, "بالمكتبة المشتركة"],
    ["عروض دروس", S.tutors.filter((t) => t.type === "offer" && inR(t)).length, `منها ${S.tutors.filter((t) => t.type === "offer" && !t.price && inR(t)).length} مجانية أو تطوعية`],
    ["طلبات مساعدة", S.tutors.filter((t) => t.type !== "offer" && inR(t)).length, "من الطلاب"],
    ["أسئلة ونقاشات", S.posts.filter(inR).length, "بالمجتمع"],
    ["رسائل شكر", PL.thanks.filter(inR).length, "من ناس انساعدوا"],
    ["أشخاص ساعدوا", helpers.size, "شاركوا مادة أو عرضوا درس"],
  ];
}
HOOKS.lists.push(() => {
  const el = $("#pf-impact"); if (!el) return;
  const rows = pfImpact();
  const text = ["تقرير أثر بوابة الخريجين", ...rows.map(([l, n, s]) => `${l}: ${n} (${s})`)].join("\n");
  el.replaceChildren(h("div", { class: "stack" },
    h("div", { class: "ad-tiles" }, rows.map(([l, n, s]) => h("div", { class: "stat pf-stat" }, h("b", { text: fmt(n) }), h("span", { text: l }), h("small", { class: "muted", text: s })))),
    h("p", { class: "muted small", text: "الأرقام بتعدّ اللي موجود هلّق بالمنصة. محتوى انحذف ما بينعدّ، والردود ورسائل الدردشة مش محسوبة." }),
    h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onclick: () => plCopy(text, "انسخ التقرير"), text: "انسخ التقرير" }),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => saveFile("تقرير-الأثر.txt", text), text: "نزّله كملف" }))));
});

// ---------- 255 sponsors ----------
registerView("sponsors", "ideas", "الرعاة", () => h("div", { class: "view" },
  head("عن المنصة", "الرعاة والداعمين", "مصالح ومؤسسات محلية بتدعم المنصة مقابل ظهور بسيط هون. الدعم بيروح لتطوير المنصة ومكافآت رمزية للمساهمين."),
  h("div", { class: "grid", id: "pf-sponsors" }),
  h("section", { class: "section" }, h("h2", { text: "بدك تدعم؟" }),
    reqList(["الرعاية بتظهر هون باسم المصلحة وجملة عنها، بدون إعلانات مزعجة.", "بتقدر تقدّم مكافأة رمزية للمساهمين (قسيمة، كتاب، دورة).", "تواصل مع إدارة المنصة أو مع المدرسة."]))), { order: 50 });
HOOKS.lists.push(() => {
  const el = $("#pf-sponsors"); if (!el) return;
  const items = plCfgItems("sponsors");
  el.replaceChildren(...(items.length ? items.map((x) => { const u = safeUrl(x.url); return h("div", { class: "card stack" }, h("div", { class: "row" }, avatar(x.name, x.name), h("h3", { text: x.name })),
    x.note ? h("p", { text: x.note }) : null, x.rewards ? h("p", { class: "small" }, "مكافأة للمساهمين: ", h("b", { text: x.rewards })) : null,
    u ? h("a", { class: "btn sm ghost", href: u, target: "_blank", rel: "noopener", text: "موقعهم" }) : null); })
    : [empty("لسا ما في رعاة", "المنصة شغّالة بجهود تطوعية. أول مصلحة بتدعم بتظهر هون.")]));
});

// ---------- 204 satisfaction survey ----------
let pfMyAnswer = undefined;
registerView("survey", "ideas", "استبيان الرضا", () => {
  const sv = plCfg("survey");
  pfMyAnswer = undefined;
  const v = h("div", { class: "view" }, head("عن المنصة", "استبيان الرضا", "رأيك بيحدّد شو نطوّر بعدين. بتجاوب مرة وحدة، والنتائج بتوصل للإدارة بدون أسماء."), h("div", { id: "pf-survey" }));
  if (sv?.active && S.uid) onLeave(subscribeDoc("survey-answers", `${sv.id}__${S.uid}`, (d) => { pfMyAnswer = d; renderLists(); }));
  return v;
}, { order: 60 });
HOOKS.lists.push(() => {
  const el = $("#pf-survey"); if (!el) return;
  const sv = plCfg("survey");
  if (!sv || !sv.active) { el.replaceChildren(empty("ما في استبيان مفتوح هلّق", "لما تفتح الإدارة استبيان جديد بيظهر هون.")); return; }
  if (!S.uid) { el.replaceChildren(empty("لازم تسجّل دخول", "الاستبيان للأعضاء بس.")); return; }
  if (pfMyAnswer === undefined) { if (!el.firstChild) el.replaceChildren(h("p", { class: "muted", text: "جارِ التحميل…" })); return; }
  if (pfMyAnswer) { el.replaceChildren(h("div", { class: "result" }, h("b", { text: "شكرًا!" }), h("span", { text: "وصل جوابك. منحكيلكم شو تغيّر بسجل التحديثات." }))); return; }
  if (el.querySelector("form")) return;
  const scores = sv.questions.map(() => 0);
  const f = h("form", { class: "card stack" }, h("h3", { text: sv.title }),
    ...sv.questions.map((q, i) => h("fieldset", { class: "q pf-q" }, h("legend", { text: q }),
      h("div", { class: "scale", role: "radiogroup" }, [1, 2, 3, 4, 5].map((n) => h("button", { class: "chip", type: "button", "aria-pressed": "false", "aria-label": `${n} من 5`, text: String(n),
        onclick: (e) => { scores[i] = n; e.target.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.target))); } }))),
      h("div", { class: "spread small muted" }, h("span", { text: "1 = أبدًا" }), h("span", { text: "5 = كثير" })))),
    h("label", { class: "field" }, h("span", { text: "شو ناقص؟ شو بدك نحسّن؟ (اختياري)" }), h("textarea", { id: "pf-sv-comment", maxlength: 800 })),
    h("div", null, h("button", { class: "btn blue", type: "submit", text: "أرسل" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite()) return;
    if (scores.some((s) => !s)) { toast("جاوب على كل الأسئلة"); return; }
    if (await setDoc("survey-answers", `${sv.id}__${S.uid}`, { uid: S.uid, survey: sv.id, scores, comment: $("#pf-sv-comment").value.trim(), createdAt: Date.now() })) toast("وصل جوابك، شكرًا");
  });
  el.replaceChildren(writeBanner() || "", f);
});
