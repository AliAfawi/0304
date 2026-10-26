// ===== platform team: global search, accessibility panel, read aloud, share link, presence, smart suggestions =====

// ---------- accessibility (classes on <html>, remembered per browser) ----------
const UX_A11Y_DEFAULT = { size: 0, contrast: false, calm: false, spaced: false };
let uxA11y = { ...UX_A11Y_DEFAULT, ...lsGet("a11y", {}) };
function uxApplyA11y() {
  const c = document.documentElement.classList;
  c.toggle("ux-fs-1", uxA11y.size === 1); c.toggle("ux-fs-2", uxA11y.size === 2);
  c.toggle("ux-contrast", !!uxA11y.contrast); c.toggle("ux-calm", !!uxA11y.calm); c.toggle("ux-spaced", !!uxA11y.spaced);
}
uxApplyA11y();
function uxSetA11y(patch) { uxA11y = { ...uxA11y, ...patch }; lsSet("a11y", uxA11y); uxApplyA11y(); }
function uxOpenA11y() {
  const sizes = [[0, "عادي"], [1, "كبير"], [2, "أكبر"]];
  const sw = (id, key, label, hint) => h("label", { class: "check ux-sw" }, h("input", { type: "checkbox", id, checked: uxA11y[key] ? true : null, onchange: (e) => uxSetA11y({ [key]: e.target.checked }) }),
    h("span", null, h("b", { text: label }), h("span", { class: "muted small", text: hint })));
  const body = h("div", { class: "stack" },
    h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: "حجم الخط" }),
      h("div", { class: "chips", role: "group", "aria-label": "حجم الخط", id: "ux-size" }, sizes.map(([n, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(uxA11y.size === n), text: l,
        onclick: () => { uxSetA11y({ size: n }); document.querySelectorAll("#ux-size .chip").forEach((c, i) => c.setAttribute("aria-pressed", String(i === n))); } })))),
    sw("ux-contrast", "contrast", "تباين عالٍ", "ألوان أغمق وحدود أوضح."),
    sw("ux-calm", "calm", "تخفيف الحركة", "بدون انتقالات وحركات."),
    sw("ux-spaced", "spaced", "مسافات أوسع للقراءة", "مسافة أكبر بين الأسطر والكلمات، بتريّح بعسر القراءة."),
    h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", onclick: () => { uxSetA11y({ ...UX_A11Y_DEFAULT }); close(); toast("رجعت الإعدادات للأصل"); }, text: "رجّع للأصل" })),
    h("p", { class: "muted small", text: "الإعدادات بتنحفظ على هالجهاز. اختصار البحث: زر «/»." }));
  const close = modal("سهولة الوصول", body);
}

// ---------- read aloud ----------
const UX_TTS = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
let uxSpeaking = null;
function uxVoice() {
  try { const v = speechSynthesis.getVoices(); return v.find((x) => x.lang === "ar-SA") || v.find((x) => /^ar/i.test(x.lang)) || null; } catch { return null; }
}
function uxStop() { try { speechSynthesis.cancel(); } catch {} if (uxSpeaking) { uxSpeaking.dispatchEvent(new Event("ux-stop")); uxSpeaking = null; } }
function readAloud(text, btn) {
  if (!UX_TTS) return;
  if (uxSpeaking && uxSpeaking === btn) { uxStop(); return; }
  uxStop();
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 4000); if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  const v = uxVoice(); u.lang = v ? v.lang : "ar-SA"; if (v) u.voice = v; u.rate = 0.95;
  const reset = () => { if (btn) uxBtnState(btn, false); if (uxSpeaking === btn) uxSpeaking = null; };
  u.onend = reset; u.onerror = reset;
  if (btn) { uxSpeaking = btn; uxBtnState(btn, true); btn.addEventListener("ux-stop", reset, { once: true }); }
  if (!v) toast("ما في صوت عربي على هالجهاز، رح نقرأ بالصوت الافتراضي");
  try { speechSynthesis.speak(u); } catch { reset(); }
}
function uxBtnState(btn, on) { btn.replaceChildren(plIcon(on ? "stop" : "speaker", 16), on ? "وقّف القراءة" : "اقرأ لي"); btn.setAttribute("aria-pressed", String(on)); }
// A «اقرأ لي» button for long text; getText is called on click. Returns null when speech is unavailable.
function uxReadBtn(getText) {
  if (!UX_TTS) return null;
  const b = h("button", { class: "btn sm ghost ux-read", type: "button", "aria-pressed": "false" });
  uxBtnState(b, false);
  b.addEventListener("click", () => readAloud(typeof getText === "function" ? getText() : getText, b));
  return b;
}
function uxPageText() {
  const sel = String(window.getSelection ? window.getSelection() : "").trim();
  if (sel.length > 3) return sel;
  const main = $("#main"); const out = [];
  main.querySelectorAll("h1, .lede, h2, h3, p, li").forEach((el) => { if (!el.closest(".ux-pagebar, .subnav, form, [hidden]")) out.push(el.textContent.trim()); });
  return out.filter(Boolean).join(". ");
}

// ---------- page bar: share link + read aloud + who is online (appended after every render) ----------
let uxPeers = [], uxRoomOn = false, uxPresView = null;
function uxPageBar() {
  return h("div", { class: "ux-pagebar", "data-ux": "bar" },
    h("button", { class: "btn sm ghost", type: "button", onclick: uxShareView }, plIcon("link", 16), "انسخ رابط هالقسم"),
    uxReadBtn(uxPageText),
    h("span", { class: "ux-online", id: "ux-online", hidden: true }));
}
function uxShareView() {
  const token = "#" + S.view;
  const done = () => modal("رابط هالقسم", h("div", { class: "stack" },
    h("p", { text: "نسخنا الرمز تبع هالقسم. أضفه لآخر رابط المنصة (بعد آخر حرف) وابعته بالواتساب، وبيفتح على هالقسم مباشرة." }),
    h("input", { type: "text", id: "ux-share-token", readonly: true, value: token, "aria-label": "رمز القسم", class: "num" }),
    h("p", { class: "muted small", text: `مثال: رابط المنصة اللي عندك وبآخره ${token}` })));
  try { navigator.clipboard.writeText(token).then(done, done); } catch { done(); }
}
const uxMo = new MutationObserver(() => {
  const main = $("#main"); if (!main || !main.firstChild) return;
  if (main.lastElementChild && main.lastElementChild.dataset.ux === "bar") return;
  main.append(uxPageBar()); uxDrawOnline();
});
if ($("#main")) uxMo.observe($("#main"), { childList: true });

// presence via CAP.room (optional)
function uxStartRoom() {
  if (uxRoomOn || !CAP.room) return;
  uxRoomOn = true;
  try {
    CAP.room.onPeers((ch) => { uxPeers = (ch.peers || []).filter((p) => p.kind !== "agent"); resolveNames(uxPeers.map((p) => p.by).filter(Boolean)); uxDrawOnline(); }, () => { uxPeers = []; uxDrawOnline(); });
  } catch (e) { console.warn(e); }
}
function uxDrawOnline() {
  const el = $("#ux-online"); if (!el) return;
  if (!CAP.room) { el.hidden = true; return; }
  const seen = new Map();
  uxPeers.forEach((p) => { const k = p.by || p.peer; if (!seen.has(k)) seen.set(k, p); });
  const people = [...seen.values()];
  if (!people.length) { el.hidden = true; return; }
  const here = people.filter((p) => p.presence && p.presence.view === S.view).length;
  el.hidden = false;
  el.replaceChildren(h("span", { class: "ux-dot", "aria-hidden": "true" }),
    h("span", { class: "ux-avs", "aria-hidden": "true" }, people.slice(0, 5).map((p) => avatar(p.isMe ? "أنا" : p.by ? nameOf(p.by) : "؟", p.by || p.peer))),
    h("span", { class: "small", text: `${people.length} متصلين الآن` }),
    here > 1 ? h("span", { class: "muted small", text: `منهم ${here} بهالقسم` }) : null);
}
HOOKS.lists.push(() => {
  if (CAP.room && !uxRoomOn) uxStartRoom();
  if (CAP.room && uxPresView !== S.view) { uxPresView = S.view; try { CAP.room.presence({ view: S.view }).catch(() => {}); } catch {} }
  uxDrawOnline();
});

// ---------- global search ----------
const uxTerms = (q) => norm(q).split(/\s+/).filter(Boolean);
const uxMatch = (hay, terms) => { const n = norm(hay); return terms.every((t) => n.includes(t)); };
const uxClip = (s, n = 90) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
function uxSearch(q) {
  const t = uxTerms(q); if (!t.length) return [];
  const groups = [];
  const add = (label, items) => {
    if (!items.length) return;
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, all: [] }));
    g.all.push(...items); g.items = g.all.slice(0, 6); g.more = Math.max(0, g.all.length - 6);
  };
  add("أقسام المنصة", visibleViews().filter((v) => uxMatch(v.label, t)).map((v) => ({ title: v.label, sub: (SECTIONS.find(([id]) => id === v.section) || [])[1] || "", go: v.id })));
  add("الخريجين", Object.values(S.alumni).filter((a) => uxMatch([a.name, a.place, a.field, a.city, a.year, a.bio].join(" "), t))
    .map((a) => ({ title: a.name, sub: [`فوج ${a.year}`, a.field, a.place].filter(Boolean).join(" · "), onOpen: () => openMemberCard(a.uid || a.id) })));
  add("النقاشات", S.posts.filter((p) => plVisible("posts", p) && uxMatch(p.text + " " + p.cat, t)).map((p) => ({ title: uxClip(p.text), sub: `${p.cat || ""} · ${nameOf(p.uid)}`, onOpen: () => { feedTab = "posts"; feedCat = "all"; go("feed"); } })));
  add("المواد والامتحانات", S.materials.filter((m) => plVisible("materials", m) && uxMatch([m.title, m.note, m.subject, m.kind, m.level].join(" "), t))
    .map((m) => ({ title: m.title, sub: [m.subject, m.kind].filter(Boolean).join(" · "), onOpen: () => { libState.q = m.title; libState.subject = "all"; libState.kind = "all"; go("library"); } })));
  add("دروس ومساعدة", S.tutors.filter((x) => plVisible("tutors", x) && uxMatch([x.subject, x.note, x.area, x.level, x.mode].join(" "), t))
    .map((x) => ({ title: `${x.type === "offer" ? "بعلّم" : "بحتاج مساعدة"}: ${x.subject}`, sub: uxClip([nameOf(x.uid), x.note].filter(Boolean).join(" · "), 70), onOpen: () => { tutorFilter = x.type === "offer" ? "offer" : "request"; go("tutors"); } })));
  add("الجامعات والتخصصات", INST.map((i) => {
    if (uxMatch(i.ar + " " + i.he, t)) return { title: i.ar, sub: TYPES[i.t] + " · " + i.r, onOpen: () => openInst(i) };
    const majors = Object.values(i.majors).flat().filter((m) => uxMatch(m, t));
    return majors.length ? { title: i.ar, sub: `تخصص: ${majors.slice(0, 3).join("، ")}`, onOpen: () => { uniState.q = q.trim(); openInst(i); } } : null;
  }).filter(Boolean));
  add("قاموس الجامعة", DICT.filter((d) => uxMatch(d.join(" "), t)).map((d) => ({ title: `${d[0]} · ${d[1]}`, sub: d[2], onOpen: () => { toolTab = "dict"; go("tools"); } })));
  add("الإعلانات", PL.ann.filter((a) => uxMatch(a.title + " " + (a.text || ""), t)).map((a) => ({ title: a.title, sub: uxClip(a.text, 70), go: "announcements" })));
  const ideas = []; IDEAS.forEach((g) => g.items.forEach((x) => { const s = x.replace(/^\*/, ""); if (uxMatch(s, t)) ideas.push({ title: s, sub: g.c + (x[0] === "*" ? " · موجود" : ""), onOpen: () => { ideaState.q = ""; ideaState.cat = String(IDEAS.indexOf(g)); go("ideas"); } }); }));
  add("أفكار التطوير", ideas);
  SEARCH.forEach((p) => { try { const r = p.fn(q.trim()) || []; add(p.label, r.filter((x) => x && x.title)); } catch (e) { console.warn(e); } });
  return groups;
}
function uxOpenSearch(initial = "") {
  const input = h("input", { type: "search", id: "ux-q", value: initial, autocomplete: "off", placeholder: "اسم، تخصص، مادة، جامعة، مصطلح…", "aria-label": "بحث بكل المنصة", "aria-controls": "ux-results", role: "combobox", "aria-expanded": "true" });
  const list = h("div", { class: "ux-results", id: "ux-results", role: "listbox", "aria-label": "نتائج البحث" });
  let hits = [], active = -1;
  const setActive = (i) => {
    const els = list.querySelectorAll(".ux-hit"); if (!els.length) return;
    active = (i + els.length) % els.length;
    els.forEach((e, j) => e.setAttribute("aria-selected", String(j === active)));
    input.setAttribute("aria-activedescendant", els[active].id); els[active].scrollIntoView({ block: "nearest" });
  };
  const open = (x) => {
    const q = input.value.trim(); if (q) { const r = lsGet("ux-recent", []).filter((s) => s !== q); r.unshift(q); lsSet("ux-recent", r.slice(0, 6)); }
    close();
    if (x.onOpen) x.onOpen(); else if (x.go) go(x.go);
  };
  const draw = () => {
    const q = input.value; const groups = uxSearch(q); hits = []; active = -1; input.removeAttribute("aria-activedescendant");
    if (!q.trim()) {
      const recent = lsGet("ux-recent", []);
      list.replaceChildren(h("p", { class: "muted small", text: "ابحث بالخريجين، النقاشات، المواد، الدروس، الجامعات والتخصصات، القاموس والأفكار." }),
        recent.length ? h("div", { class: "stack", style: "gap:6px" }, h("h4", { text: "بحثت مؤخرًا" }), h("div", { class: "chips" }, recent.map((r) => h("button", { class: "chip", type: "button", text: r, onclick: () => { input.value = r; draw(); input.focus(); } })))) : null);
      return;
    }
    if (!groups.length) { list.replaceChildren(empty("ما لقينا إشي", "جرّب كلمة ثانية أو جزء من الكلمة. البحث بيتجاهل الهمزات والتشكيل.")); return; }
    list.replaceChildren(...groups.map((g) => h("div", { class: "ux-group", role: "group", "aria-label": g.label },
      h("h4", { text: g.label }),
      ...g.items.map((x) => { const i = hits.push(x) - 1; return h("button", { class: "ux-hit", type: "button", role: "option", id: `ux-hit-${i}`, "aria-selected": "false", tabindex: "-1", onclick: () => open(x), onmousemove: () => active !== i && setActive(i) },
        h("b", { text: x.title }), x.sub ? h("span", { class: "muted small", text: x.sub }) : null); }),
      g.more ? h("span", { class: "muted small", text: `و${g.more} كمان. دقّق البحث.` }) : null)));
  };
  input.addEventListener("input", draw);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const x = hits[active >= 0 ? active : 0]; if (x) open(x); }
  });
  const close = modal("بحث بكل المنصة", h("div", { class: "stack ux-search" }, input, list, h("p", { class: "muted small ux-keys", text: "↑↓ للتنقّل · Enter للفتح · Esc للإغلاق" })));
  draw();
  setTimeout(() => input.focus(), 20);
}
document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
  if ((e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
    if ($("#modal-root").firstChild && $("#ux-q")) return;
    e.preventDefault(); uxOpenSearch();
  }
});

// header buttons (before the notifications bell from 40)
(function uxHeader() {
  const tools = $("#top-tools"); if (!tools) return;
  tools.prepend(
    h("button", { class: "icon-btn", id: "ux-search-btn", type: "button", "aria-label": "بحث بكل المنصة (/)", title: "بحث بكل المنصة (/)", "aria-keyshortcuts": "/", onclick: () => uxOpenSearch() }, plIcon("search")),
    h("button", { class: "icon-btn", id: "ux-a11y-btn", type: "button", "aria-label": "سهولة الوصول", title: "سهولة الوصول", onclick: uxOpenA11y }, plIcon("access")));
})();

// ---------- 242 smart suggestions on home ----------
function uxMyTerms() {
  const p = S.alumni[S.uid] || {};
  const subj = lsGet("ux-subjects", []);
  const fieldTerms = String(p.field || "").split(/[\s,،/]+/).filter((w) => w.length > 2);
  return { subj, fieldTerms, p };
}
function uxSuggestions() {
  const { subj, fieldTerms } = uxMyTerms();
  const mats = S.materials.filter((m) => m.uid !== S.uid && plVisible("materials", m) && (subj.includes(m.subject) || fieldTerms.some((w) => matches(m.title + " " + (m.note || ""), w)))).slice(0, 4);
  const mentors = Object.values(S.alumni).filter((a) => (a.uid || a.id) !== S.uid && a.mentor && fieldTerms.some((w) => matches(`${a.field} ${a.place}`, w))).slice(0, 4);
  const tutors = S.tutors.filter((t) => t.uid !== S.uid && t.type === "offer" && plVisible("tutors", t) && subj.includes(t.subject)).slice(0, 3);
  return { mats, mentors, tutors };
}
function uxPickSubjects() {
  const cur = new Set(lsGet("ux-subjects", []));
  const close = modal("مواضيعك", h("div", { class: "stack" },
    h("p", { class: "muted", text: "اختار المواضيع اللي بتهمّك، وبنقترح عليك مواد ودروس فيها. الاختيار بينحفظ على هالجهاز بس." }),
    h("div", { class: "chips", id: "ux-subj" }, SUBJECTS.map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(cur.has(s)), text: s, onclick: (e) => { cur.has(s) ? cur.delete(s) : cur.add(s); e.target.setAttribute("aria-pressed", String(cur.has(s))); } }))),
    h("div", null, h("button", { class: "btn blue", type: "button", onclick: () => { lsSet("ux-subjects", [...cur]); close(); renderLists(); }, text: "احفظ" }))));
}
registerHome(() => h("section", { class: "section", id: "ux-sugg" }), 30);
HOOKS.lists.push(() => {
  const el = $("#ux-sugg"); if (!el) return;
  const { subj, fieldTerms, p } = uxMyTerms();
  const top = h("div", { class: "spread" }, h("h2", { text: "مقترح إلك" }), h("button", { class: "link", type: "button", onclick: uxPickSubjects, text: subj.length ? "عدّل مواضيعك" : "اختار مواضيعك" }));
  if (!subj.length && !fieldTerms.length) {
    el.replaceChildren(top, h("div", { class: "plain stack" }, h("p", { class: "muted", text: "قلّنا شو بتهمّك وبنقترح عليك مواد، دروس، ومرشدين من نفس مجالك." }),
      h("div", { class: "row" }, h("button", { class: "btn sm blue", type: "button", onclick: uxPickSubjects, text: "اختار مواضيعك" }), !p.field ? h("button", { class: "btn sm ghost", type: "button", onclick: openProfile, text: "أضف تخصصك لملفك" }) : null)));
    return;
  }
  const { mats, mentors, tutors } = uxSuggestions();
  const cards = [
    ...mats.map((m) => h("button", { class: "tool-card", type: "button", onclick: () => { libState.q = m.title; go("library"); } }, h("b", { text: m.title }), h("span", { text: `مادة · ${m.subject}` }))),
    ...tutors.map((t) => h("button", { class: "tool-card", type: "button", onclick: () => { tutorFilter = "offer"; go("tutors"); } }, h("b", { text: `درس ${t.subject}` }), h("span", { text: `${nameOf(t.uid)} · ${t.price ? `₪${t.price}` : "مجاني"}` }))),
    ...mentors.map((a) => h("button", { class: "tool-card", type: "button", onclick: () => openMemberCard(a.uid || a.id) }, h("b", { text: a.name }), h("span", { text: `مرشد/ة · ${[a.field, a.place].filter(Boolean).join(" · ")}` }))),
  ];
  el.replaceChildren(top, cards.length ? h("div", { class: "tool-cards" }, cards)
    : empty("لسا ما في شي بمجالك", "لما حدا يشارك مادة أو يعرض درس بمواضيعك بيظهر هون. بتقدر تكون أول واحد يشارك."));
});
