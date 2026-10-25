// community: discussions (best answer, @mentions, anonymous questions, saved, report) + chat rooms by cohort/major/institution
let feedTab = "posts", feedCat = "all", chatRoom = "general", chatUnsub = null;
const openReplies = new Map();
const CM = { stories: [], polls: [], saved: new Set(), savedRows: [] };

// ---------- shared community helpers (also used by modules/30-*) ----------
const cmHidden = (col, id) => isMod("hidden", col + ":" + id);
const cmPinned = (id) => isMod("pinned", id);
// skip hidden, float pinned first, keep the rest in the given order
function cmVisible(col, rows) {
  const v = rows.filter((r) => !cmHidden(col, r.id));
  return [...v.filter((r) => cmPinned(r.id)), ...v.filter((r) => !cmPinned(r.id))];
}
const cmVerified = (uid) => (uid && isMod("verified", uid) ? h("span", { class: "pill good cm-ver", title: "الإدارة أكّدت إنه خريج/ة من المدرسة", text: "موثّق" }) : null);
const cmPinPill = (id) => (cmPinned(id) ? h("span", { class: "pill warn", text: "مثبّت" }) : null);
// author line: avatar + name (+ verified) + cohort; anonymous rows show «مجهول» (admins see who wrote it)
function cmAuthorName(row) {
  if (!row.anon) return nameOf(row.uid);
  return S.isAdmin ? "مجهول · للإدارة: " + nameOf(row.uid) : "مجهول";
}
function cmWho(row, extra) {
  const a = row.anon ? null : S.alumni[row.uid];
  return h("div", { class: "row cm-who" },
    row.anon ? h("span", { class: "avatar cm-anon", "aria-hidden": "true", text: "؟" }) : avatar(nameOf(row.uid), row.uid),
    h("div", { class: "meta" }, h("span", { class: "who", text: cmAuthorName(row) }), row.anon ? null : cmVerified(row.uid),
      a ? h("span", { text: "فوج " + a.year }) : null, h("span", { text: rel(row.createdAt) }), extra || null));
}
// redraw a list only when its inputs changed (keeps typed text and focus inside lists)
function cmDraw(el, deps, build) {
  if (!el) return;
  const prev = el._cmDeps;
  if (prev && prev.length === deps.length && prev.every((d, i) => d === deps[i])) return;
  el._cmDeps = deps;
  el.replaceChildren(...build());
}
const cmNamesKey = () => Object.keys(S.names).length;
const cmSafeId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, "_");
function cmHash(s) { let x = 5381; for (const c of norm(s).trim()) x = ((x * 33) ^ c.charCodeAt(0)) >>> 0; return x.toString(36); }

// in-app notification for another person (contract: notes)
async function cmNotify(to, kind, text, goId, anon) {
  if (!to || to === S.uid) return;
  await addDoc("notes", { uid: S.uid, to, from: anon ? "" : S.uid, kind, text: text.slice(0, 200), go: goId, createdAt: Date.now() });
}
const cmSnippet = (t, n = 60) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };

// report (contract: reports). One report per person per item.
const REPORT_REASONS = ["إساءة أو تنمّر", "معلومات شخصية لحدا", "محتوى غير لائق", "معلومة غلط أو مضللة", "إعلان مزعج (سبام)", "غير ذلك"];
function cmReportBtn(target) {
  return h("button", { class: "link small cm-report", type: "button", onclick: () => cmReport(target), text: "إبلاغ" });
}
function cmReport(target) {
  if (!guardWrite()) return;
  const f = h("form", { class: "form" },
    h("p", { class: "full muted small", text: "البلاغ بيوصل للإدارة لحالها، وصاحب المنشور ما بيعرف مين بلّغ. إذا في خطر عليك أو على حدا، احكي كمان مع المستشار/ة بالمدرسة." }),
    h("label", { class: "field full" }, h("span", { text: "شو المشكلة؟" }), h("select", { id: "cm-rep-reason" }, REPORT_REASONS.map((r) => opt(r)))),
    h("label", { class: "field full" }, h("span", { text: "تفاصيل (اختياري)" }), h("textarea", { id: "cm-rep-note", maxlength: 400 })),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "ابعث البلاغ" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const note = $("#cm-rep-note").value.trim();
    const reason = $("#cm-rep-reason").value + (note ? " — " + note : "");
    if (await setDoc("reports", cmSafeId(target) + "__" + S.uid, { uid: S.uid, target, reason, createdAt: Date.now() })) { close(); toast("وصل البلاغ للإدارة، شكرًا إنك بتحمي المجتمع"); }
  });
  const close = modal("إبلاغ عن محتوى", f);
}

// text with @mentions highlighted (names resolved from uids, never stored)
function cmRich(text, mentions) {
  const names = [...new Set((mentions || []).map((u) => nameOf(u)).filter((n) => n && n !== "خريج/ة"))].sort((a, b) => b.length - a.length);
  const p = h("p");
  let rest = String(text || "");
  while (names.length && rest) {
    let best = -1, bn = "";
    for (const n of names) { const i = rest.indexOf("@" + n); if (i >= 0 && (best < 0 || i < best)) { best = i; bn = n; } }
    if (best < 0) break;
    p.append(rest.slice(0, best), h("span", { class: "cm-mention", text: "@" + bn }));
    rest = rest.slice(best + bn.length + 1);
  }
  if (rest) p.append(rest);
  return p;
}
// uids mentioned in a text ("@Full Name")
function cmMentions(text) {
  return Object.values(S.alumni).filter((a) => a.name && a.uid !== S.uid && text.includes("@" + a.name)).map((a) => a.uid).slice(0, 10);
}
// typing "@" suggests alumni names (keyboard: arrows, Enter/Tab, Escape)
function cmMentionInput(el) {
  const list = h("div", { class: "cm-suggest", role: "listbox", id: el.id + "-sug", hidden: true, "aria-label": "اقتراحات أسماء" });
  el.setAttribute("aria-autocomplete", "list"); el.setAttribute("aria-controls", list.id); el.setAttribute("aria-expanded", "false");
  let items = [], active = 0, start = -1;
  const close = () => { list.hidden = true; items = []; el.setAttribute("aria-expanded", "false"); };
  const draw = () => {
    list.replaceChildren(...items.map((a, i) => h("button", { type: "button", role: "option", class: "cm-sug-item", id: list.id + "-" + i, "aria-selected": String(i === active),
      onmousedown: (e) => e.preventDefault(), onclick: () => pick(a) }, avatar(a.name, a.uid), h("span", { class: "cm-sug-name", text: a.name }), h("span", { class: "muted small", text: "فوج " + a.year }))));
    list.hidden = false; el.setAttribute("aria-expanded", "true"); el.setAttribute("aria-activedescendant", list.id + "-" + active);
  };
  const pick = (a) => {
    const pos = el.selectionStart;
    el.value = el.value.slice(0, start) + "@" + a.name + " " + el.value.slice(pos);
    const c = start + a.name.length + 2;
    el.focus(); el.setSelectionRange(c, c); close();
  };
  el.addEventListener("input", () => {
    const before = el.value.slice(0, el.selectionStart);
    const m = before.match(/(^|\s)@([^\s@]{0,24})$/);
    if (!m) return close();
    start = el.selectionStart - m[2].length - 1;
    const q = norm(m[2]);
    items = Object.values(S.alumni).filter((a) => a.name && a.uid !== S.uid && (!q || norm(a.name).split(/\s+/).some((w) => w.startsWith(q))))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar")).slice(0, 6);
    if (!items.length) return close();
    active = 0; draw();
  });
  el.addEventListener("keydown", (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); active = (active + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length; draw(); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  el.addEventListener("blur", () => setTimeout(close, 150));
  return h("div", { class: "cm-mwrap" }, el, list);
}

// ---------- chat rooms: general, per cohort, per major, per institution (derived from profiles) ----------
function cmRooms() {
  const al = Object.values(S.alumni);
  const years = [...new Set([THIS_YEAR, ...al.map((a) => a.year).filter(Boolean)])].sort((a, b) => b - a);
  const group = (key, prefix) => {
    const m = new Map();
    for (const a of al) {
      const raw = (a[key] || "").trim(); if (!raw) continue;
      const id = prefix + cmHash(raw);
      const g = m.get(id) || { id, label: raw, n: 0, uids: new Set() };
      g.n++; g.uids.add(a.uid); m.set(id, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "ar"));
  };
  return {
    general: [{ id: "general", label: "كل الأفواج" }],
    years: years.map((y) => ({ id: "y" + y, label: "فوج " + y, y })),
    fields: group("field", "f-"),
    places: group("place", "p-"),
  };
}
function cmMyRooms(R) {
  const me = S.alumni[S.uid];
  const out = [R.general[0]];
  if (!me) return out;
  const y = R.years.find((r) => r.y === me.year); if (y) out.push({ ...y, label: "فوجك " + me.year });
  const f = me.field && R.fields.find((r) => r.id === "f-" + cmHash(me.field)); if (f) out.push({ ...f, label: "تخصصك: " + f.label });
  const p = me.place && R.places.find((r) => r.id === "p-" + cmHash(me.place)); if (p) out.push({ ...p, label: "مؤسستك: " + p.label });
  return out;
}

// ---------- the view ----------
views.feed = () => {
  const tabs = [["posts", "النقاشات"], ["chat", "الغرف والدردشة"], ["saved", "محفوظاتي"]];
  const v = h("div", { class: "view" },
    head("المجتمع", "اسأل، ساعد، وشارك", "نقاشات مفتوحة لكل الأفواج، وغرف دردشة حسب الفوج والتخصص والمؤسسة."),
    writeBanner(),
    h("div", { class: "chips", role: "group", "aria-label": "شو بدك تشوف" }, tabs.map(([id, l]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(feedTab === id), onclick: () => { feedTab = id; go("feed"); }, text: l }))));
  if (feedTab !== "chat" && S.uid) {
    const unsub = subscribe(myCol(), { limit: 300 }, (rows) => {
      CM.savedRows = rows.filter((r) => r.kind === "saved");
      CM.saved = new Set(CM.savedRows.map((r) => r.target));
      renderLists();
    });
    onLeave(() => { unsub(); });
  }
  if (feedTab === "posts") v.append(cmComposer(),
    h("div", { class: "chips", id: "feed-cats", role: "group", "aria-label": "التصنيف" }, ["all", ...POST_CATS].map((c) => h("button", { class: "chip", type: "button", "aria-pressed": String(feedCat === c),
      onclick: (e) => { feedCat = c; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === e.currentTarget))); renderLists(); }, text: c === "all" ? "الكل" : c }))),
    h("div", { class: "stack", id: "cm-feed-list" }));
  else if (feedTab === "saved") v.append(
    h("p", { class: "muted", text: "المنشورات اللي حفظتها بتضل هون. القائمة خاصة فيك، ما حدا غيرك بيشوفها." }),
    h("div", { class: "stack", id: "cm-saved-list" }));
  else v.append(cmChat());
  return v;
};

function cmComposer() {
  const ta = h("textarea", { id: "post-text", required: true, maxlength: 2000, placeholder: "مثال: حدا بيعرف إذا تمريض ببن غوريون بيطلب مقابلة؟ اكتب @ لتذكر خريج/ة بالاسم." });
  const anonNote = h("p", { class: "full small cm-anon-note", hidden: true, text: "اسمك ما رح يظهر للأعضاء، رح يبيّن «مجهول». بس الإدارة بتقدر تعرف مين كتب، عشان تقدر توقف أي إساءة. الأسئلة المجهولة كمان لازم تلتزم بقوانين المجتمع." });
  const f = h("form", { class: "card form", id: "cm-composer" },
    h("label", { class: "field" }, h("span", { text: "التصنيف" }), h("select", { id: "post-cat" }, POST_CATS.map((c) => opt(c)))),
    h("label", { class: "field full" }, h("span", { text: "شو بدك تحكي؟" }), cmMentionInput(ta)),
    h("label", { class: "check full" }, h("input", { type: "checkbox", id: "post-anon", onchange: (e) => { anonNote.hidden = !e.target.checked; } }), "انشر بدون اسم (للأسئلة الحساسة)"),
    anonNote,
    h("div", { class: "full spread" }, h("button", { class: "btn blue", type: "submit", text: "انشر" }),
      h("button", { class: "link small", type: "button", "data-go": "cm-rules", text: "قوانين المجتمع" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const text = ta.value.trim(); if (!text) return;
    const anon = $("#post-anon").checked;
    const mentions = cmMentions(text);
    const doc = { uid: S.uid, cat: $("#post-cat").value, text, createdAt: Date.now() };
    if (anon) doc.anon = true;
    if (mentions.length) doc.mentions = mentions;
    if (await addDoc("posts", doc)) {
      ta.value = ""; $("#post-anon").checked = false; anonNote.hidden = true;
      toast(anon ? "انتشر بدون اسم" : "انتشر");
      const who = anon ? "حدا (بدون اسم)" : nameOf(S.uid);
      for (const u of mentions) cmNotify(u, "mention", `${who} ذكرك بمنشور: «${cmSnippet(text)}»`, "feed", anon);
    }
  });
  return f;
}

function cmChat() {
  const R = cmRooms();
  const all = [...R.general, ...R.years, ...R.fields, ...R.places];
  if (!all.some((r) => r.id === chatRoom)) chatRoom = "general";
  const cur = all.find((r) => r.id === chatRoom);
  const form = h("form", { class: "chat-form" }, h("input", { type: "text", id: "chat-text", maxlength: 600, placeholder: "اكتب رسالة…", autocomplete: "off", "aria-label": "رسالة" }), h("button", { class: "btn blue", type: "submit", text: "أرسل" }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const t = $("#chat-text").value.trim(); if (!t) return;
    $("#chat-text").value = "";
    await addDoc(`chat/${chatRoom}/msgs`, { uid: S.uid, text: t, createdAt: Date.now() });
  });
  const og = (label, rows, fmtL) => rows.length ? h("optgroup", { label }, rows.map((r) => opt(r.id, fmtL ? fmtL(r) : r.label, r.id === chatRoom))) : null;
  const switchTo = (id) => { chatRoom = id; go("feed"); };
  const mine = cmMyRooms(R);
  queueMicrotask(startChat);
  onLeave(() => { chatUnsub && chatUnsub(); chatUnsub = null; });
  return h("div", { class: "stack" },
    h("div", { class: "chips", role: "group", "aria-label": "غرفك" }, mine.map((r) => h("button", { class: "chip", type: "button", "aria-pressed": String(r.id === chatRoom), onclick: () => switchTo(r.id), text: r.label })),
      S.alumni[S.uid] ? null : h("button", { class: "chip", type: "button", onclick: openProfile, text: "+ أضف تخصصك ومؤسستك لتظهر غرفك" })),
    h("div", { class: "card chat" },
      h("div", { class: "chat-head stack" },
        h("label", { class: "field" }, h("span", { text: "كل الغرف" }),
          h("select", { id: "chat-room", onchange: (e) => switchTo(e.target.value) },
            og("عامة", R.general), og("حسب الفوج", R.years), og("حسب التخصص", R.fields, (r) => `${r.label} (${r.n})`), og("حسب المؤسسة", R.places, (r) => `${r.label} (${r.n})`))),
        h("p", { class: "muted small cm-room-note", text: cur && cur.uids ? `غرفة مفتوحة لكل الأعضاء، وفيها ${cur.n} من الخريجين اللي كاتبين «${cur.label}» بملفهم.` : "الغرف مفتوحة لكل أعضاء المنصة. غرف التخصصات والمؤسسات بتنعمل تلقائيًا من ملفات الخريجين." })),
      h("div", { class: "chat-body", id: "chat-body", "aria-live": "polite" }, empty("الغرفة فاضية", "اكتب أول رسالة وسلّم على اللي معك.")),
      form));
}
function startChat() {
  chatUnsub && chatUnsub();
  const col = `chat/${chatRoom}/msgs`;
  chatUnsub = subscribe(col, { limit: 120 }, (rows) => {
    const body = $("#chat-body"); if (!body) return;
    rows = rows.filter((m) => !cmHidden(col, m.id)).reverse();
    resolveNames(rows.map((r) => r.uid));
    if (!rows.length) { body.replaceChildren(empty("الغرفة فاضية", "اكتب أول رسالة وسلّم على اللي معك.")); return; }
    body.replaceChildren(...rows.map((m) => h("div", { class: "msg" + (m.uid === S.uid ? " mine" : "") },
      h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(m.uid) }), cmVerified(m.uid), h("span", { text: rel(m.createdAt) })), h("p", { text: m.text }))));
    body.scrollTop = body.scrollHeight;
  });
}

// ---------- posts ----------
function postCard(p, compact) {
  if (cmHidden("posts", p.id)) return h("div", { hidden: true });
  const entry = openReplies.get(p.id);
  const saved = CM.saved.has("posts:" + p.id);
  const card = h("article", { class: "card item cm-post" + (cmPinned(p.id) ? " cm-pinned" : "") },
    h("div", { class: "spread" }, cmWho(p),
      h("div", { class: "row" }, cmPinPill(p.id), p.best ? h("span", { class: "pill good", text: "فيه أفضل إجابة" }) : null, h("span", { class: "pill", text: p.cat }))),
    compact && p.text.length > 220 ? h("p", { text: p.text.slice(0, 220) + "…" }) : cmRich(p.text, p.mentions),
    compact ? null : h("div", { class: "row cm-actions" },
      h("button", { class: "btn sm ghost", type: "button", "aria-expanded": String(!!entry), onclick: () => toggleReplies(p), text: entry ? "سكّر الردود" : "الردود" }),
      h("button", { class: "link small", type: "button", "aria-pressed": String(saved), onclick: () => cmToggleSave("posts", p.id), text: saved ? "محفوظ ✓" : "احفظ" }),
      cmReportBtn("posts:" + p.id), rowActions("posts", p)),
    compact || !entry ? null : cmRepliesBox(p, entry));
  return card;
}
async function cmToggleSave(col, id) {
  if (!S.uid) return toast("لازم تسجّل دخول عشان تحفظ");
  const target = col + ":" + id, docId = "saved__" + cmSafeId(target);
  if (CM.saved.has(target)) { await delDoc(myCol(), docId); }
  else if (await setDoc(myCol(), docId, { uid: S.uid, kind: "saved", target, createdAt: Date.now() })) toast("انحفظ بمحفوظاتك");
}
function toggleReplies(p) {
  if (openReplies.has(p.id)) { openReplies.get(p.id).unsub(); openReplies.delete(p.id); cmRedrawPosts(); return; }
  if (openReplies.size >= 20) { const [k, v] = openReplies.entries().next().value; v.unsub(); openReplies.delete(k); }
  const entry = { rows: [], loaded: false, unsub: () => {}, form: null, list: h("div", { class: "stack" }) };
  openReplies.set(p.id, entry);
  entry.unsub = subscribe(`posts/${p.id}/replies`, { dir: "asc", limit: 200 }, (rows) => { entry.rows = rows; entry.loaded = true; resolveNames(rows.map((r) => r.uid)); fillReplies(p.id); });
  cmRedrawPosts();
}
function cmRepliesBox(p, entry) {
  if (!entry.form) {
    const inp = h("input", { type: "text", id: "cm-reply-" + p.id, maxlength: 1000, placeholder: "اكتب ردّ… (@ لتذكر حدا)", "aria-label": "رد", autocomplete: "off" });
    const f = h("form", { class: "row cm-reply-form" }, cmMentionInput(inp), h("button", { class: "btn sm", type: "submit", text: "ردّ" }));
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      const t = inp.value.trim(); if (!t) return;
      const post = S.posts.find((x) => x.id === p.id) || p;
      const mentions = cmMentions(t);
      const doc = { uid: S.uid, text: t, createdAt: Date.now() };
      if (mentions.length) doc.mentions = mentions;
      if (await addDoc(`posts/${p.id}/replies`, doc)) {
        inp.value = "";
        const me = nameOf(S.uid);
        cmNotify(post.uid, "reply", `${me} ردّ على ${post.anon ? "سؤالك المجهول" : "منشورك"}: «${cmSnippet(t)}»`, "feed");
        for (const u of mentions) if (u !== post.uid) cmNotify(u, "mention", `${me} ذكرك بردّ: «${cmSnippet(t)}»`, "feed");
      }
    });
    entry.form = f;
  }
  const box = h("div", { class: "replies", "data-replies": p.id }, entry.list, entry.form);
  fillReplies(p.id);
  return box;
}
function fillReplies(pid) {
  const entry = openReplies.get(pid); if (!entry) return;
  const p = S.posts.find((x) => x.id === pid) || { id: pid };
  const col = `posts/${pid}/replies`;
  let rows = entry.rows.filter((r) => !cmHidden(col, r.id));
  const best = rows.find((r) => r.id === p.best);
  if (best) rows = [best, ...rows.filter((r) => r !== best)];
  const isAuthor = p.uid && p.uid === S.uid;
  entry.list.replaceChildren(...(rows.length ? rows.map((r) => {
    const isBest = r.id === p.best;
    return h("div", { class: "item cm-reply" + (isBest ? " cm-best" : "") },
      isBest ? h("span", { class: "pill good cm-best-pill", text: "أفضل إجابة · اختارها صاحب السؤال" }) : null,
      h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(r.uid) }), cmVerified(r.uid), h("span", { text: rel(r.createdAt) })),
      cmRich(r.text, r.mentions),
      h("div", { class: "row" },
        isAuthor && r.uid !== S.uid ? h("button", { class: "link small", type: "button", onclick: () => cmSetBest(p, isBest ? null : r), text: isBest ? "إلغاء أفضل إجابة" : "أفضل إجابة" }) : null,
        r.uid !== S.uid ? cmReportBtn(col + ":" + r.id) : null, rowActions(col, r)));
  }) : [h("p", { class: "muted small", text: entry.loaded ? "ما في ردود لسا. كن أول واحد يساعد." : "جارِ تحميل الردود…" })]));
}
async function cmSetBest(p, r) {
  const cur = S.posts.find((x) => x.id === p.id) || p;
  const { id, ...data } = cur;
  if (r) data.best = r.id; else delete data.best;
  if (await setDoc("posts", p.id, data)) {
    toast(r ? "انعلّم كأفضل إجابة" : "انشال التعليم");
    if (r) cmNotify(r.uid, "best", `ردّك انختار «أفضل إجابة» على: «${cmSnippet(cur.text)}»`, "feed");
  }
}
function cmRedrawPosts() { const el = $("#cm-feed-list"); if (el) el._cmDeps = null; const s = $("#cm-saved-list"); if (s) s._cmDeps = null; renderLists(); }

HOOKS.lists.push(() => {
  const fl = $("#cm-feed-list");
  cmDraw(fl, [S.posts, S.mod, S.alumni, CM.saved, feedCat, cmNamesKey(), CAP.assets], () => {
    const rows = cmVisible("posts", S.posts.filter((p) => feedCat === "all" || p.cat === feedCat));
    return rows.length ? rows.map((p) => postCard(p)) : [empty(feedCat === "all" ? "لسا ما في نقاشات" : "ما في منشورات بهذا التصنيف لسا", "اكتب أول سؤال أو نصيحة من الصندوق فوق، وخلّي الأفواج تساعد بعض.")];
  });
  const sl = $("#cm-saved-list");
  cmDraw(sl, [S.posts, S.mod, CM.saved, S.alumni, cmNamesKey()], () => {
    const rows = cmVisible("posts", S.posts.filter((p) => CM.saved.has("posts:" + p.id)));
    const gone = CM.savedRows.filter((r) => r.target.startsWith("posts:") && !S.posts.some((p) => "posts:" + p.id === r.target)).length;
    return [
      ...(rows.length ? rows.map((p) => postCard(p)) : [empty("ما حفظت إشي لسا", "اضغط «احفظ» تحت أي منشور مهم، وبترجعله من هون وقت ما بدك.")]),
      gone ? h("p", { class: "muted small", text: `في ${gone} منشور محفوظ انحذف أو قديم كثير وما عاد ظاهر.` }) : null,
    ].filter(Boolean);
  });
});
// close reply subscriptions when leaving the community feed
const cmLeaveReplies = () => { openReplies.forEach((e) => e.unsub()); openReplies.clear(); };
const cmFeedView = views.feed;
views.feed = () => { onLeave(cmLeaveReplies); return cmFeedView(); };

registerSearch("النقاشات", (q) => cmVisible("posts", S.posts).filter((p) => matches(p.text + " " + p.cat, q)).slice(0, 8)
  .map((p) => ({ title: cmSnippet(p.text, 70), sub: `${p.cat} · ${cmAuthorName(p)} · ${rel(p.createdAt)}`, go: "feed", onOpen: () => { feedTab = "posts"; feedCat = "all"; } })));

registerView("feed", "community", "النقاشات والدردشة", null, { order: 10 });
