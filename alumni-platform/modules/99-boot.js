// ---------- rendering ----------
function renderView() {
  if (S.view !== "feed" && chatUnsub) { chatUnsub(); chatUnsub = null; }
  leaveFns.forEach((f) => { try { f(); } catch {} }); leaveFns = [];
  let content;
  try { content = views[S.view](); } catch (e) { console.error(e); content = empty("صار خطأ بهذا القسم", "حدّث الصفحة أو جرّب قسم ثاني."); }
  $("#main").replaceChildren(...[subNav(), content].filter(Boolean));
  $("#me-btn").textContent = S.alumni[S.uid] ? S.alumni[S.uid].name.split(" ")[0] + " · ملفّي" : "ملفّي";
  $("#mode-note").textContent = S.mode === "db" ? "المشاركات مشتركة بين كل الأعضاء" : S.mode === "local" ? "وضع تجريبي على هذا الجهاز" : "جارِ الاتصال…";
  renderLists();
}
function renderLists() {
  resolveNames([...S.posts, ...S.materials, ...S.tutors].map((r) => r.uid));
  const live = $("#live-stats");
  if (live) live.replaceChildren(
    h("div", { class: "stat" }, h("b", { text: Object.keys(S.alumni).length }), h("span", { text: "خريج بالدليل" })),
    h("div", { class: "stat" }, h("b", { text: S.materials.length }), h("span", { text: "مادة وامتحان" })),
    h("div", { class: "stat" }, h("b", { text: S.tutors.length }), h("span", { text: "درس وطلب مساعدة" })));
  const hp = $("#home-posts");
  if (hp) hp.replaceChildren(...(S.posts.length ? S.posts.slice(0, 3).map((p) => postCard(p, true)) : [empty("لسا ما في نقاشات", "افتح «المجتمع» واكتب أول سؤال أو نصيحة لفوجك.")]));
  const fl = $("#feed-list");
  if (fl) {
    const rows = S.posts.filter((p) => feedCat === "all" || p.cat === feedCat);
    fl.replaceChildren(...(rows.length ? rows.map((p) => postCard(p)) : [empty("ما في منشورات هون لسا", "كن أول واحد يكتب بهذا التصنيف.")]));
  }
  const ll = $("#lib-list");
  if (ll) {
    const q = libState.q.trim();
    const rows = S.materials.filter((m) => (libState.subject === "all" || m.subject === libState.subject) && (libState.kind === "all" || m.kind === libState.kind) && (!q || (m.title + " " + m.note + " " + m.level).includes(q)));
    ll.replaceChildren(...(rows.length ? rows.map((m) => h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: "pill", text: m.subject }), h("span", { class: "pill grey", text: m.kind }), m.level ? h("span", { class: "muted small", text: m.level }) : null),
      h("h3", { text: m.title }), m.note ? h("p", { class: "muted", text: m.note }) : null,
      h("div", { class: "meta" }, h("span", { text: "من " + nameOf(m.uid) }), h("span", { text: rel(m.createdAt) })),
      h("div", { class: "row" }, safeUrl(m.url) ? h("a", { class: "btn sm blue", href: safeUrl(m.url), target: "_blank", rel: "noopener", text: "افتح المادة" }) : null, rowActions("materials", m))))
      : [empty("المكتبة فاضية هون", "شارك أول ملخص أو امتحان من زر «شارك مادة».")]));
  }
  const tl = $("#tutor-list");
  if (tl) {
    const rows = S.tutors.filter((t) => tutorFilter === "all" || (tutorFilter === "free" ? t.type === "offer" && !t.price : t.type === tutorFilter));
    tl.replaceChildren(...(rows.length ? rows.map((t) => h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: t.type === "offer" ? "pill good" : "pill warn", text: t.type === "offer" ? "بعلّم" : "بحتاج مساعدة" }), h("span", { class: "pill", text: t.subject }), t.level ? h("span", { class: "muted small", text: t.level }) : null),
      h("div", { class: "row" }, avatar(nameOf(t.uid), t.uid), h("div", null, h("div", { class: "who", text: nameOf(t.uid) }), h("div", { class: "muted small", text: [S.alumni[t.uid] ? "فوج " + S.alumni[t.uid].year : "", t.area, t.mode].filter(Boolean).join(" · ") }))),
      t.note ? h("p", { text: t.note }) : null,
      t.type === "offer" ? h("div", { class: "num", style: "font-weight:800", text: t.price ? `₪${t.price} للساعة` : "مجاني / تطوّعي" }) : null,
      h("div", { class: "spread" }, t.contact ? h("span", { class: "small" }, "تواصل: ", h("b", { text: t.contact })) : h("span"), rowActions("tutors", t))))
      : [empty("ما في شي هون لسا", tutorType === "offer" ? "إذا بتقدر تعلّم موضوع، أضف عرضك." : "اكتب شو بتحتاج، وخريج بيتواصل معك.")]));
  }
  const al = $("#al-list");
  if (al) {
    const q = alState.q.trim();
    const rows = Object.values(S.alumni).filter((a) => (alState.year === "all" || String(a.year) === String(alState.year)) && (!alState.mentor || a.mentor) && (!q || [a.name, a.place, a.field, a.city].join(" ").includes(q)))
      .sort((a, b) => b.year - a.year || (a.name || "").localeCompare(b.name || "", "ar"));
    al.replaceChildren(...(rows.length ? rows.map((a) => h("article", { class: "card item" },
      h("div", { class: "row" }, avatar(a.name, a.uid), h("div", { style: "min-width:0" }, h("h3", { text: a.name }), h("div", { class: "muted small", text: `فوج ${a.year}${a.city ? " · " + a.city : ""}` }))),
      h("div", { class: "row" }, h("span", { class: "pill grey", text: a.status }), a.mentor ? h("span", { class: "pill good", text: "متاح للمساعدة" }) : null),
      a.place || a.field ? h("p", { text: [a.field, a.place].filter(Boolean).join(" · ") }) : null,
      a.bio ? h("p", { class: "muted", text: a.bio }) : null,
      a.contact ? h("span", { class: "small" }, "تواصل: ", h("b", { text: a.contact })) : null,
      a.uid === S.uid ? h("button", { class: "link small", type: "button", onclick: openProfile, text: "عدّل ملفي" }) : null))
      : [empty("الدليل فاضي هون", "أضف حالك للدليل، وابعث الرابط لفوجك.")]));
  }
  HOOKS.lists.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
}

// ---------- boot ----------
let subsStarted = false;
function startSubs() {
  if (subsStarted) return; subsStarted = true;
  subscribe("alumni", { order: "updatedAt", limit: 1000 }, (rows) => {
    const prevMine = !!S.alumni[S.uid];
    S.alumni = Object.fromEntries(rows.map((r) => [r.uid || r.id, r]));
    if (prevMine !== !!S.alumni[S.uid]) renderView(); else renderLists();
  });
  subscribe("posts", { limit: 200 }, (rows) => { S.posts = rows; renderLists(); });
  subscribe("materials", { limit: 500 }, (rows) => { S.materials = rows; renderLists(); });
  subscribe("tutors", { limit: 300 }, (rows) => { S.tutors = rows; renderLists(); });
  subscribe("mod", { order: "updatedAt", limit: 100 }, (rows) => {
    S.mod = Object.fromEntries(rows.map((r) => [r.id, r.map || {}]));
    renderLists();
  });
  HOOKS.boot.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });
}
function goLocal() {
  db = null; S.mode = "local"; S.canWrite = true;
  S.uid = lsGet("uid", null) || (() => { const u = "local-" + Math.random().toString(36).slice(2, 10); lsSet("uid", u); return u; })();
}
async function boot() {
  const start = location.hash.slice(1);
  S.view = resolveView(start || "home");
  buildTabs(); renderView();
  const c = window.claude;
  if (!c || typeof c.use !== "function") { goLocal(); startSubs(); renderView(); return; }
  ["sample", "assets", "downloads", "room"].forEach((name) => c.use(name).then((x) => { CAP[name] = x; if (x) renderLists(); }, () => {}));
  const [d, u] = await Promise.all([c.use("db"), c.use("user")]);
  userCap = u;
  if (d) {
    db = d; S.mode = "db";
    S.uid = u ? await u.id() : null;
    S.isAdmin = u ? await u.canEdit() : false;
    const cw = u ? await u.can("data.write") : null;
    S.canWrite = !!S.uid && cw !== false;
  } else goLocal();
  startSubs(); buildTabs(); S.view = resolveView(start || S.view); renderView();
}
boot();
