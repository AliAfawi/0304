// ===== platform team: shared platform state + «مساحتي» (my space, notifications, privacy, account) =====
// Globals here are shared by 41–44 (they load after this file). Prefixes: pl* shared, me* my-space.

const PL = {
  notes: [], lastSeen: 0, thanks: [], ann: [], config: {}, ready: false,
};
const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const PL_ICONS = {
  search: "M10.5 3.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM21 21l-5.5-5.5",
  bell: "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2ZM10 21h4",
  access: "M12 3.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM5 8.5l7 1.6 7-1.6M12 10.1v4.6M12 14.7 9 21M12 14.7 15 21",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  speaker: "M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7",
  stop: "M7 7h10v10H7z",
};
function plIcon(name, size = 20) {
  return svgEl("svg", { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": "true", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", focusable: "false" },
    svgEl("path", { d: PL_ICONS[name] }));
}
// Month / week helpers
function plMonthStart(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
const PL_MONTHS = ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"];
const plMonthName = (ts = Date.now()) => PL_MONTHS[new Date(ts).getMonth()] + " " + new Date(ts).getFullYear();
const plVisible = (col, row) => !isMod("hidden", col + ":" + row.id);
const plCfg = (id) => PL.config[id] || null;
const plCfgItems = (id) => (plCfg(id) && Array.isArray(plCfg(id).items) ? plCfg(id).items : []);
function plCopy(text, okMsg) {
  const fallback = () => {
    const inp = h("input", { type: "text", id: "pl-copy-input", value: text, readonly: true, "aria-label": "النص للنسخ" });
    modal("انسخ يدويًا", h("div", { class: "stack" }, h("p", { class: "muted", text: "ما قدرنا ننسخ تلقائيًا بهالعرض. علّم النص وانسخه:" }), inp));
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  };
  try {
    if (!navigator.clipboard) return fallback();
    navigator.clipboard.writeText(text).then(() => toast(okMsg || "انسخ"), fallback);
  } catch { fallback(); }
}
const plKinds = { reply: "رد", mention: "إشارة", thanks: "شكر", booking: "حجز", event: "فعالية", announcement: "إعلان", mentor: "إرشاد", report: "بلاغ" };

// ---------- notifications (notes for me + announcements) ----------
function plMyNotes() {
  if (!S.uid) return [];
  const notes = PL.notes.filter((n) => n.to === S.uid).map((n) => ({ ...n, _k: "note" }));
  const ann = PL.ann.filter((a) => a.uid !== S.uid).map((a) => ({ id: "ann-" + a.id, kind: "announcement", from: a.uid, text: a.text ? `${a.title} — ${a.text.slice(0, 140)}` : a.title, go: "announcements", createdAt: a.createdAt, _k: "ann" }));
  return [...notes, ...ann].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
const plUnread = () => plMyNotes().filter((n) => (n.createdAt || 0) > PL.lastSeen).length;
async function plMarkSeen() {
  const ts = Date.now();
  PL.lastSeen = ts; lsSet("pl-seen:" + S.uid, ts); plBadge();
  if (S.mode === "db" && S.canWrite && S.uid) {
    try { await db.collection(myCol()).doc("notes-read").set({ uid: S.uid, lastSeen: ts, createdAt: ts }); } catch (e) { console.warn(e); }
  } else if (S.uid && S.mode === "local") {
    const a = localRead(myCol()).filter((x) => x.id !== "notes-read"); a.push({ id: "notes-read", uid: S.uid, lastSeen: ts, createdAt: ts }); lsSet("c:" + myCol(), a);
  }
}
function plBadge() {
  const b = $("#pl-bell"); if (!b) return;
  const n = plUnread();
  b.hidden = !S.uid;
  const badge = b.querySelector(".pl-badge");
  badge.textContent = n > 9 ? "9+" : String(n);
  badge.hidden = !n;
  b.setAttribute("aria-label", n ? `الإشعارات: ${n} جديد` : "الإشعارات");
  b.title = b.getAttribute("aria-label");
}
function plNoteItem(n, isNew) {
  const from = n.from || n.uid;
  return h("article", { class: "plain me-note" + (isNew ? " new" : "") },
    h("div", { class: "row" },
      from ? avatar(nameOf(from), from) : null,
      h("div", { class: "me-note-body" },
        h("div", { class: "meta" },
          h("span", { class: "pill" + (n.kind === "announcement" ? " warn" : ""), text: plKinds[n.kind] || "تنبيه" }),
          from ? h("span", { class: "who", text: nameOf(from) }) : null,
          h("span", { text: rel(n.createdAt) }),
          isNew ? h("span", { class: "pill good", text: "جديد" }) : null),
        h("p", { text: n.text || "" })),
      n.go ? h("button", { class: "btn sm ghost", type: "button", "data-go": n.go, text: "افتح" }) : null));
}

// header: notifications bell inside the lead's #top-tools (44 prepends search + accessibility before it)
(function plHeader() {
  const tools = $("#top-tools"); if (!tools) return;
  tools.prepend(h("button", { class: "icon-btn pl-bell", id: "pl-bell", type: "button", hidden: true, "aria-label": "الإشعارات", title: "الإشعارات", onclick: () => go("me-notes") },
    plIcon("bell"), h("span", { class: "pl-badge", hidden: true, "aria-hidden": "true" })));
})();

HOOKS.boot.push(() => {
  PL.lastSeen = lsGet("pl-seen:" + S.uid, 0);
  subscribe("notes", { limit: 300 }, (rows) => { PL.notes = rows; resolveNames(rows.filter((r) => r.to === S.uid).map((r) => r.from || r.uid)); plBadge(); renderLists(); });
  subscribe("thanks", { limit: 500 }, (rows) => { PL.thanks = rows; renderLists(); });
  subscribe("announcements", { limit: 30 }, (rows) => { PL.ann = rows; plBadge(); renderLists(); });
  subscribe("config", { order: "updatedAt", limit: 50 }, (rows) => { PL.config = Object.fromEntries(rows.map((r) => [r.id, r])); renderLists(); });
  if (S.uid) subscribeDoc(myCol(), "notes-read", (d) => { if (d && d.lastSeen > PL.lastSeen) { PL.lastSeen = d.lastSeen; plBadge(); } });
  PL.ready = true; plBadge();
});

// ---------- my contributions ----------
function meContribs(uid = S.uid) {
  const out = [];
  S.posts.filter((p) => p.uid === uid).forEach((p) => out.push({ col: "posts", row: p, type: "منشور", title: p.text, sub: p.cat, go: "feed" }));
  S.materials.filter((m) => m.uid === uid).forEach((m) => out.push({ col: "materials", row: m, type: "مادة", title: m.title, sub: [m.subject, m.kind].filter(Boolean).join(" · "), go: "library" }));
  S.tutors.filter((t) => t.uid === uid).forEach((t) => out.push({ col: "tutors", row: t, type: t.type === "offer" ? "عرض درس" : "طلب مساعدة", title: t.subject + (t.note ? " — " + t.note : ""), sub: t.type === "offer" ? (t.price ? `₪${t.price} للساعة` : "مجاني / تطوّعي") : t.level || "", go: "tutors" }));
  PL.thanks.filter((t) => t.uid === uid).forEach((t) => out.push({ col: "thanks", row: t, type: "شكر أرسلته", title: t.text, sub: `إلى: ${nameOf(t.to)}`, go: "me-thanks" }));
  return out.sort((a, b) => (b.row.createdAt || 0) - (a.row.createdAt || 0));
}
function meContribList(limit) {
  const all = meContribs();
  if (!all.length) return empty("لسا ما شاركت بشي", "شارك ملخص بالمكتبة، اعرض درس، أو اسأل سؤال بالمجتمع، وكل مساهمة بتظهر هون.");
  return h("div", { class: "stack" }, all.slice(0, limit || all.length).map((c) => h("article", { class: "plain me-contrib" },
    h("div", { class: "row" }, h("span", { class: "pill", text: c.type }), c.sub ? h("span", { class: "muted small", text: c.sub }) : null,
      !plVisible(c.col, c.row) ? h("span", { class: "pill warn", text: "مخفي من الإدارة" }) : null,
      h("span", { class: "muted small", style: "margin-inline-start:auto", text: rel(c.row.createdAt) })),
    h("p", { class: "me-clip", text: c.title }),
    h("div", { class: "row" }, h("button", { class: "link small", type: "button", "data-go": c.go, text: "روح للقسم" }), rowActions(c.col, c.row)))));
}

// ---------- views ----------
function meNeedUid() {
  return S.uid ? null : h("div", { class: "view" }, head("مساحتي", "مساحتك الشخصية", "هون بتلاقي ملفك، إشعاراتك، ونقاطك."),
    empty("لازم تكون مسجّل دخول", "افتح المنصة من حسابك على Claude عشان تصير إلك مساحة شخصية."));
}
function meProfileCard() {
  const p = S.alumni[S.uid];
  if (!p) return h("div", { class: "card stack" }, h("h3", { text: "لسا ما عندك ملف" }),
    h("p", { class: "muted", text: "الملف بيخلّي فوجك يلاقيك، وبيحسب نقاطك ومساهماتك باسمك. بياخذ دقيقة." }),
    h("div", null, h("button", { class: "btn blue", type: "button", onclick: openProfile, text: "أنشئ ملفك" })));
  const st = typeof ptStatsFor === "function" ? ptStatsFor(S.uid) : null;
  return h("div", { class: "card stack me-profile" },
    h("div", { class: "row" }, avatar(p.name, S.uid),
      h("div", { style: "min-width:0;flex:1" },
        h("div", { class: "row" }, h("h3", { text: p.name }), isMod("verified", S.uid) ? h("span", { class: "pill good", text: "موثّق" }) : null,
          S.mod.roles && S.mod.roles[S.uid] ? h("span", { class: "pill", text: "مشرف/ة الفوج" }) : null),
        h("div", { class: "muted small", text: [`فوج ${p.year}`, p.status, p.city].filter(Boolean).join(" · ") }))),
    p.place || p.field ? h("p", { class: "me-line", text: [p.field, p.place].filter(Boolean).join(" · ") }) : null,
    p.bio ? h("p", { class: "muted me-line", text: p.bio }) : null,
    h("div", { class: "row" },
      p.mentor ? h("span", { class: "pill good", text: "متاح للمساعدة" }) : h("span", { class: "pill grey", text: "مش ظاهر كمرشد" }),
      p.contact ? h("span", { class: "pill grey", text: "طريقة التواصل ظاهرة" }) : h("span", { class: "pill grey", text: "بدون طريقة تواصل" }),
      st ? h("span", { class: "pill", text: `${st.level.name} · ${fmt(st.points)} نقطة` }) : null),
    h("div", { class: "row" },
      h("button", { class: "btn sm blue", type: "button", onclick: openProfile, text: "عدّل ملفي" }),
      typeof openMemberCard === "function" ? h("button", { class: "btn sm ghost", type: "button", onclick: () => openMemberCard(S.uid), text: "شوف بطاقتي مثل ما بيشوفها غيري" }) : null,
      h("button", { class: "btn sm ghost", type: "button", "data-go": "me-settings", text: "الخصوصية" })));
}
function meSavedLink() {
  const v = visibleViews().find((m) => /save|saved|bookmark|fav/i.test(m.id));
  return v ? h("button", { class: "tool-card", type: "button", "data-go": v.id }, h("b", { text: "المحفوظات" }), h("span", { text: "المنشورات والمواد اللي حفظتها لترجعلها." })) : null;
}

registerView("me", "me", "لوحتي", () => {
  const need = meNeedUid(); if (need) return need;
  const p = S.alumni[S.uid];
  const v = h("div", { class: "view" },
    head("مساحتي", p ? `أهلا ${p.name.split(" ")[0]}` : "أهلا فيك", "ملفك، إشعاراتك، مساهماتك ونقاطك بمكان واحد. ما حدا غيرك بيشوف هالصفحة."),
    writeBanner(),
    meProfileCard(),
    h("section", { class: "grid-3", id: "me-stats" }),
    h("section", { class: "section" },
      h("div", { class: "spread" }, h("h2", { text: "آخر الإشعارات" }), h("button", { class: "link", type: "button", "data-go": "me-notes", text: "كل الإشعارات" })),
      h("div", { class: "stack", id: "me-notes-preview" })),
    h("section", { class: "section" },
      h("h2", { text: "اختصارات" }),
      h("div", { class: "tool-cards" },
        h("button", { class: "tool-card", type: "button", "data-go": "me-points" }, h("b", { text: "نقاطي وشاراتي" }), h("span", { text: "مستواك، الشارات، الأيام المتتالية وشهادة التطوع." })),
        h("button", { class: "tool-card", type: "button", "data-go": "me-thanks" }, h("b", { text: "رسائل الشكر" }), h("span", { text: "اشكر حدا ساعدك، وشوف مين شكرك." })),
        h("button", { class: "tool-card", type: "button", "data-go": "me-board" }, h("b", { text: "لوحة الصدارة" }), h("span", { text: "مين ساعد أكثر هالشهر، وأي فوج بيتصدّر." })),
        meSavedLink())),
    h("section", { class: "section" },
      h("div", { class: "spread" }, h("h2", { text: "سجل مساهماتي" }), h("span", { class: "muted small", id: "me-contrib-count" })),
      h("div", { id: "me-contribs" })));
  return v;
});
HOOKS.lists.push(() => {
  plBadge();
  const st = $("#me-stats");
  if (st) {
    const pts = typeof ptStatsFor === "function" ? ptStatsFor(S.uid).points : 0;
    st.replaceChildren(
      h("div", { class: "stat" }, h("b", { text: fmt(plUnread()) }), h("span", { text: "إشعار جديد" })),
      h("div", { class: "stat" }, h("b", { text: fmt(meContribs().length) }), h("span", { text: "مساهمة" })),
      h("div", { class: "stat" }, h("b", { text: fmt(pts) }), h("span", { text: "نقطة" })));
  }
  const pv = $("#me-notes-preview");
  if (pv) {
    const list = plMyNotes().slice(0, 4);
    pv.replaceChildren(...(list.length ? list.map((n) => plNoteItem(n, (n.createdAt || 0) > PL.lastSeen)) : [empty("ما في إشعارات", "لما حدا يرد عليك أو يشكرك أو تنشر الإدارة إعلان، بيوصلك هون.")]));
  }
  const mc = $("#me-contribs");
  if (mc) { mc.replaceChildren(meContribList(8)); const c = $("#me-contrib-count"); if (c) c.textContent = meContribs().length > 8 ? `آخر 8 من ${meContribs().length}` : ""; }
});

// notification center
let meNoteFilter = "all", meNotePrevSeen = 0;
registerView("me-notes", "me", "الإشعارات", () => {
  const need = meNeedUid(); if (need) return need;
  meNotePrevSeen = PL.lastSeen;
  const kinds = [...new Set(plMyNotes().map((n) => n.kind))];
  const v = h("div", { class: "view" },
    head("مساحتي", "الإشعارات", "ردود، إشارات، شكر، حجوزات وإعلانات الإدارة. بنعلّمها كمقروءة لما تفتح هالصفحة."),
    h("div", { class: "spread" },
      h("div", { class: "chips", id: "me-note-chips" }, [["all", "الكل"], ["new", "الجديد"], ...kinds.map((k) => [k, plKinds[k] || k])].map(([k, l]) =>
        h("button", { class: "chip", type: "button", "aria-pressed": String(meNoteFilter === k), onclick: () => { meNoteFilter = k; document.querySelectorAll("#me-note-chips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.textContent === l))); renderLists(); }, text: l }))),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => { meNotePrevSeen = Date.now(); plMarkSeen().then(renderLists); }, text: "علّم الكل كمقروء" })),
    h("div", { class: "stack", id: "me-note-list" }));
  queueMicrotask(() => plMarkSeen());
  return v;
});
HOOKS.lists.push(() => {
  const el = $("#me-note-list"); if (!el) return;
  const rows = plMyNotes().filter((n) => meNoteFilter === "all" || (meNoteFilter === "new" ? (n.createdAt || 0) > meNotePrevSeen : n.kind === meNoteFilter));
  el.replaceChildren(...(rows.length ? rows.map((n) => plNoteItem(n, (n.createdAt || 0) > meNotePrevSeen))
    : [empty(meNoteFilter === "new" ? "ما في شي جديد" : "ما في إشعارات لسا", "لما حدا يرد على منشورك، يشكرك، أو يحجز عندك درس، بيوصلك إشعار هون.")]));
});

// privacy + account
registerView("me-settings", "me", "الخصوصية والحساب", () => {
  const need = meNeedUid(); if (need) return need;
  const p = S.alumni[S.uid];
  const fields = [["name", "الاسم"], ["year", "الفوج"], ["status", "وضعك اليوم"], ["place", "مكان الدراسة أو العمل"], ["field", "التخصص"], ["city", "البلد"], ["contact", "طريقة التواصل"], ["bio", "النبذة"]];
  const hiddenBox = h("div", { class: "stack", id: "me-contact-box" }, h("p", { class: "muted small", text: "جارِ الفحص…" }));
  const v = h("div", { class: "view" },
    head("مساحتي", "الخصوصية والحساب", "انت بتقرّر شو بيظهر عنك. كل حقل بتتركه فاضي ما بيظهر لحدا."),
    writeBanner(),
    h("section", { class: "section" },
      h("h2", { text: "شو بيشوف الأعضاء عنك" }),
      p ? h("div", { class: "table-wrap" }, h("table", null,
        h("thead", null, h("tr", null, h("th", { text: "الحقل" }), h("th", { text: "القيمة" }), h("th", { text: "مين بيشوفه" }))),
        h("tbody", null, fields.map(([k, l]) => h("tr", null, h("td", { text: l }), h("td", { class: "me-cell", text: p[k] ? String(p[k]) : "—" }),
          h("td", null, p[k] ? h("span", { class: "pill", text: "كل أعضاء المنصة" }) : h("span", { class: "pill grey", text: "ما بيظهر" }))))))) :
        empty("ما عندك ملف", "لسا ما في أي معلومة عنك بالدليل. لما تنشئ ملف، بتختار شو تعبّي."),
      h("p", { class: "muted small", text: "بدك تخفي حقل؟ افتح «عدّل ملفي» وامسحه. التخصص والفوج بيساعدوا الطلاب يلاقوا مين يسألوا، فإذا مرتاح خلّيهم." }),
      p ? h("div", null, h("button", { class: "btn sm blue", type: "button", onclick: openProfile, text: "عدّل ملفي" })) : null),
    h("section", { class: "section" },
      h("h2", { text: "إخفاء طريقة التواصل" }),
      h("p", { class: "muted", text: "بنشيل طريقة التواصل من ملفك العام وبنحفظها بمساحتك الخاصة (ما حدا غيرك بيقدر يقرأها)، وبترجّعها بكبسة وقت ما بدك." }),
      hiddenBox),
    h("section", { class: "section" },
      h("h2", { text: "شو ما بنعمله" }),
      reqList([
        "ما في «مين شاف ملفي»: ما بنسجّل مين فتح ملف مين.",
        "النقاط والأيام المتتالية والإشعارات المقروءة محفوظة إلك لحالك.",
        "ما في رسائل خاصة بالمنصة، فما حدا بيقدر يراسلك إلا بطريقة التواصل اللي انت بتختارها.",
        "حفظ البيانات وتأمينها بيصير من منصة Claude نفسها، مش من الصفحة.",
      ])),
    h("section", { class: "section me-danger" },
      h("h2", { text: "حذف حسابي" }),
      h("p", { text: "بنحذف من المنصة:" }),
      reqList(["ملفك بدليل الأفواج.", "كل منشوراتك بالنقاشات.", "كل المواد اللي شاركتها بالمكتبة.", "عروض الدروس وطلبات المساعدة تبعك.", "رسائل الشكر اللي بعثتها، وتسجيلك كسفير.", "الإعدادات الخاصة فيك (الإشعارات المقروءة، طريقة التواصل المخفية)."]),
      h("p", { text: "ما بننحذف تلقائيًا:" }),
      reqList(["ردودك على منشورات غيرك ورسائلك بدردشة الأفواج (احذفها من مكانها).", "رسائل الشكر والإشعارات اللي وصلت لغيرك منك.", "مشاركاتك بأقسام ثانية مثل الفعاليات أو الإرشاد، احذفها من كل قسم.", "النسخ الاحتياطية اللي حمّلتها الإدارة قبل الحذف."]),
      h("div", null, h("button", { class: "btn me-del", type: "button", id: "me-del-btn", onclick: meDeleteAccount, text: "احذف حسابي ومساهماتي" }))));
  queueMicrotask(() => meDrawContact());
  return v;
}, { order: 80 });

async function meDrawContact() {
  const box = $("#me-contact-box"); if (!box) return;
  const p = S.alumni[S.uid];
  const saved = await getDoc(myCol(), "contact-hidden");
  if (!$("#me-contact-box")) return;
  if (saved && saved.contact) {
    box.replaceChildren(h("div", { class: "banner" }, `طريقة التواصل مخفية هلّق. محفوظة عندك: «${saved.contact}»`),
      h("div", null, h("button", { class: "btn sm blue", type: "button", onclick: meRestoreContact, text: "رجّع طريقة التواصل لملفي" })));
  } else if (p && p.contact) {
    box.replaceChildren(h("label", { class: "check" }, h("input", { type: "checkbox", id: "me-hide-contact", onchange: (e) => e.target.checked && meHideContact() }), "إخفاء طريقة التواصل من ملفي العام"),
      h("p", { class: "muted small", text: "طريقة التواصل بعروض الدروس منفصلة، عدّل العرض أو احذفه من «دروس ومساعدة»." }));
  } else {
    box.replaceChildren(h("p", { class: "muted small", text: p ? "ما في طريقة تواصل بملفك أصلًا، فما في شي ظاهر." : "أنشئ ملف أولًا." }));
  }
}
async function meHideContact() {
  const p = S.alumni[S.uid]; if (!p || !p.contact || !guardWrite()) return;
  if (!(await setDoc(myCol(), "contact-hidden", { uid: S.uid, contact: p.contact, createdAt: Date.now() }))) return;
  if (await setDoc("alumni", S.uid, { ...p, contact: "", updatedAt: Date.now() })) toast("انخفت طريقة التواصل");
  meDrawContact();
}
async function meRestoreContact() {
  const saved = await getDoc(myCol(), "contact-hidden"); const p = S.alumni[S.uid];
  if (!saved || !p || !guardWrite()) return;
  if (await setDoc("alumni", S.uid, { ...p, contact: saved.contact, updatedAt: Date.now() })) {
    await delDoc(myCol(), "contact-hidden"); toast("رجعت طريقة التواصل لملفك");
  }
  meDrawContact();
}
function meDeleteAccount() {
  if (!guardWrite()) return;
  const mine = meContribs().filter((c) => c.col !== "thanks" || c.row.uid === S.uid);
  confirmBox(`متأكد؟ رح ننحذف ملفك و${mine.length} مساهمة، وما في رجعة.`, async () => {
    const btn = $("#me-del-btn"); if (btn) { btn.disabled = true; btn.textContent = "جارِ الحذف…"; }
    for (const c of mine) await delDoc(c.col, c.row.id);
    const amb = await getDoc("ambassadors", S.uid); if (amb) await delDoc("ambassadors", S.uid);
    for (const id of ["notes-read", "contact-hidden"]) if (await getDoc(myCol(), id)) await delDoc(myCol(), id);
    if (S.alumni[S.uid]) await delDoc("alumni", S.uid);
    lsSet("pl-seen:" + S.uid, 0); lsSet("pt-days", []);
    toast("انحذف حسابك ومساهماتك. بنتمنّالك التوفيق");
    go("home");
  });
}
