// community
let feedTab = "posts", feedCat = "all", chatRoom = "general", chatUnsub = null;
const openReplies = new Map();
views.feed = () => {
  const v = h("div", { class: "view" },
    head("المجتمع", "اسأل، ساعد، وشارك", "نقاشات مفتوحة لكل الأفواج، ودردشة خاصة بكل فوج."),
    writeBanner(),
    h("div", { class: "chips" },
      h("button", { class: "chip", type: "button", "aria-pressed": String(feedTab === "posts"), onclick: () => { feedTab = "posts"; go("feed"); }, text: "النقاشات" }),
      h("button", { class: "chip", type: "button", "aria-pressed": String(feedTab === "chat"), onclick: () => { feedTab = "chat"; go("feed"); }, text: "دردشة الأفواج" })),
  );
  if (feedTab === "posts") {
    const f = h("form", { class: "card form" },
      h("label", { class: "field" }, h("span", { text: "التصنيف" }), h("select", { id: "post-cat" }, POST_CATS.map((c) => opt(c)))),
      h("label", { class: "field full" }, h("span", { text: "شو بدك تحكي؟" }), h("textarea", { id: "post-text", required: true, maxlength: 2000, placeholder: "مثال: حدا بيعرف إذا تمريض ببن غوريون بيطلب مقابلة؟" })),
      h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر" })));
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      const text = $("#post-text").value.trim(); if (!text) return;
      if (await addDoc("posts", { uid: S.uid, cat: $("#post-cat").value, text, createdAt: Date.now() })) { $("#post-text").value = ""; toast("انتشر"); }
    });
    v.append(f,
      h("div", { class: "chips", id: "feed-cats" }, ["all", ...POST_CATS].map((c) => h("button", { class: "chip", type: "button", "aria-pressed": String(feedCat === c), onclick: () => { feedCat = c; renderLists(); document.querySelectorAll("#feed-cats .chip").forEach((x) => x.setAttribute("aria-pressed", String(x.textContent === (c === "all" ? "الكل" : c)))); }, text: c === "all" ? "الكل" : c }))),
      h("div", { class: "stack", id: "feed-list" }));
  } else {
    const years = new Set([THIS_YEAR, ...Object.values(S.alumni).map((a) => a.year)]);
    const mine = S.alumni[S.uid]?.year;
    const rooms = [["general", "كل الأفواج"], ...[...years].sort((a, b) => b - a).map((y) => ["y" + y, "فوج " + y + (y === mine ? " (فوجك)" : "")])];
    if (!rooms.some(([r]) => r === chatRoom)) chatRoom = "general";
    const form = h("form", { class: "chat-form" }, h("input", { type: "text", id: "chat-text", maxlength: 600, placeholder: "اكتب رسالة…", autocomplete: "off", "aria-label": "رسالة" }), h("button", { class: "btn blue", type: "submit", text: "أرسل" }));
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      const t = $("#chat-text").value.trim(); if (!t) return;
      $("#chat-text").value = "";
      await addDoc(`chat/${chatRoom}/msgs`, { uid: S.uid, text: t, createdAt: Date.now() });
    });
    v.append(h("div", { class: "card chat" },
      h("div", { class: "chat-head row" }, h("label", { class: "field", style: "flex:1" }, h("span", { text: "الغرفة" }),
        h("select", { id: "chat-room", onchange: (e) => { chatRoom = e.target.value; startChat(); } }, rooms.map(([r, l]) => opt(r, l, r === chatRoom))))),
      h("div", { class: "chat-body", id: "chat-body" }, empty("الغرفة فاضية", "اكتب أول رسالة وسلّم على فوجك.")),
      form));
    queueMicrotask(startChat);
  }
  return v;
};
function startChat() {
  chatUnsub && chatUnsub();
  chatUnsub = subscribe(`chat/${chatRoom}/msgs`, { limit: 120 }, (rows) => {
    const body = $("#chat-body"); if (!body) return;
    rows = rows.slice().reverse();
    resolveNames(rows.map((r) => r.uid));
    if (!rows.length) { body.replaceChildren(empty("الغرفة فاضية", "اكتب أول رسالة وسلّم على فوجك.")); return; }
    body.replaceChildren(...rows.map((m) => h("div", { class: "msg" + (m.uid === S.uid ? " mine" : "") },
      h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(m.uid) }), h("span", { text: rel(m.createdAt) })), h("p", { text: m.text }))));
    body.scrollTop = body.scrollHeight;
  });
}
function postCard(p, compact) {
  const a = S.alumni[p.uid];
  const repliesBox = h("div", { class: "replies", hidden: !openReplies.has(p.id) });
  const card = h("article", { class: "card item" },
    h("div", { class: "row" }, avatar(nameOf(p.uid), p.uid),
      h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(p.uid) }), a ? h("span", { text: "فوج " + a.year }) : null, h("span", { text: rel(p.createdAt) })),
      h("span", { class: "pill", style: "margin-inline-start:auto", text: p.cat })),
    h("p", { text: compact && p.text.length > 220 ? p.text.slice(0, 220) + "…" : p.text }),
    compact ? null : h("div", { class: "row" },
      h("button", { class: "link small", type: "button", onclick: () => toggleReplies(p, repliesBox), text: "الردود" }),
      rowActions("posts", p)),
    compact ? null : repliesBox);
  if (!compact && openReplies.has(p.id)) fillReplies(p, repliesBox);
  return card;
}
function toggleReplies(p, box) {
  if (openReplies.has(p.id)) { openReplies.get(p.id).unsub(); openReplies.delete(p.id); box.hidden = true; return; }
  if (openReplies.size > 20) { const [k, v] = openReplies.entries().next().value; v.unsub(); openReplies.delete(k); }
  box.hidden = false;
  const entry = { rows: [], unsub: () => {} };
  openReplies.set(p.id, entry);
  entry.unsub = subscribe(`posts/${p.id}/replies`, { dir: "asc", limit: 200 }, (rows) => { entry.rows = rows; resolveNames(rows.map((r) => r.uid)); const b = document.querySelector(`[data-replies="${p.id}"]`) || box; fillReplies(p, b); });
}
function fillReplies(p, box) {
  box.setAttribute("data-replies", p.id);
  const rows = openReplies.get(p.id)?.rows || [];
  const f = h("form", { class: "row" }, h("input", { type: "text", maxlength: 1000, placeholder: "اكتب ردّ…", "aria-label": "رد", style: "flex:1;min-width:0" }), h("button", { class: "btn sm", type: "submit", text: "ردّ" }));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const inp = f.querySelector("input"); const t = inp.value.trim(); if (!t) return;
    if (await addDoc(`posts/${p.id}/replies`, { uid: S.uid, text: t, createdAt: Date.now() })) inp.value = "";
  });
  box.replaceChildren(
    ...(rows.length ? rows.map((r) => h("div", { class: "item" }, h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(r.uid) }), h("span", { text: rel(r.createdAt) }), rowActions(`posts/${p.id}/replies`, r)), h("p", { text: r.text })))
      : [h("p", { class: "muted small", text: "ما في ردود لسا." })]),
    f);
}

registerView("feed", "community", "النقاشات والدردشة", null, { order: 10 });
