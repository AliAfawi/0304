// ---------- utilities ----------
// Modules build optional children as `cond ? el : null`; make append/prepend/replaceChildren skip
// null/undefined/false instead of printing "null" on the page.
for (const m of ["append", "prepend", "replaceChildren"]) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...nodes) { return orig.apply(this, nodes.filter((n) => n != null && n !== false)); };
}
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString("ar-EG-u-nu-latn");
function safeUrl(u) {
  try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
}
function rel(ts) {
  if (!ts) return "";
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return "قبل " + Math.floor(s / 60) + " د";
  if (s < 86400) return "قبل " + Math.floor(s / 3600) + " س";
  if (s < 86400 * 30) return "قبل " + Math.floor(s / 86400) + " يوم";
  return new Date(ts).toLocaleDateString("ar-EG-u-nu-latn");
}
function hue(str) { let x = 0; for (const c of String(str)) x = (x * 31 + c.charCodeAt(0)) % 360; return x; }
function avatar(name, key) { return h("span", { class: "avatar", style: `background:hsl(${hue(key || name)} 45% 42%)`, text: (name || "؟").trim().charAt(0) }); }
function lsGet(k, d) { try { const v = localStorage.getItem("gp:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem("gp:" + k, JSON.stringify(v)); } catch {} }
// Interface language: "ar" (default) or "he". L(ar, he) picks the right string for data that carries both.
let LANG = lsGet("lang", "ar") === "he" ? "he" : "ar";
const L = (ar, he) => (LANG === "he" && he ? he : ar);
let toastTimer;
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2600); }
function opt(v, label, sel) { return h("option", { value: v, selected: sel ? true : null, text: label ?? v }); }
const regUrl = (i) => i.reg || "https://www.google.com/search?q=" + encodeURIComponent((i.dom ? "site:" + i.dom + " " : i.he + " ") + "הרשמה");
const instMatches = (i, q) => !q || i.ar.includes(q) || i.he.includes(q) || Object.values(i.majors).some((list) => list.some((m) => m.includes(q)));

// ---------- data layer: shared db when the viewer grants it, this browser otherwise ----------
const S = {
  view: "home", mode: "loading", uid: null, canWrite: true, isAdmin: false,
  alumni: {}, posts: [], materials: [], tutors: [], names: {}, mod: {},
};
let db = null, userCap = null;
const localSubs = {};
function localRead(col) { return lsGet("c:" + col, []); }
function localEmit(col) { (localSubs[col] || new Set()).forEach((f) => f()); }

function subscribe(col, { order = "createdAt", dir = "desc", limit = 300 } = {}, cb) {
  if (db) {
    try {
      return db.collection(col).orderBy(order, dir).limit(limit).onSnapshot(
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => { console.warn(col, e); toast("تعذّر تحميل جزء من البيانات، حدّث الصفحة"); }
      );
    } catch (e) { console.warn(e); return () => {}; }
  }
  const emit = () => {
    const rows = localRead(col).sort((a, b) => ((a[order] || 0) - (b[order] || 0)) * (dir === "desc" ? -1 : 1));
    cb(rows.slice(0, limit));
  };
  (localSubs[col] ||= new Set()).add(emit);
  emit();
  return () => localSubs[col].delete(emit);
}
function writeFailed(e) {
  console.warn(e);
  if (e && e.code === "invalid_argument") { S.canWrite = false; toast("ما عندك صلاحية المشاركة هنا، اطلب صلاحية «مساهم» من صاحب المنصة"); renderView(); }
  else if (e && e.code === "quota_exceeded") toast("امتلأت مساحة المنصة، لازم تحذف الإدارة محتوى قديم");
  else toast("ما انحفظ، جرّب مرة ثانية");
  return false;
}
async function addDoc(col, data) {
  if (!guardWrite()) return false;
  try {
    if (db) await db.collection(col).add(data);
    else { const a = localRead(col); a.push({ id: Math.random().toString(36).slice(2, 11), ...data }); lsSet("c:" + col, a); localEmit(col); }
    return true;
  } catch (e) { return writeFailed(e); }
}
async function setDoc(col, id, data) {
  if (!guardWrite()) return false;
  try {
    if (db) await db.collection(col).doc(id).set(data);
    else { const a = localRead(col).filter((x) => x.id !== id); a.push({ id, ...data }); lsSet("c:" + col, a); localEmit(col); }
    return true;
  } catch (e) { return writeFailed(e); }
}
async function getDoc(col, id) {
  try {
    if (db) { const s = await db.collection(col).doc(id).get(); return s.exists ? { id: s.id, ...s.data() } : null; }
    return localRead(col).find((x) => x.id === id) || null;
  } catch (e) { console.warn(e); return null; }
}
function subscribeDoc(col, id, cb) {
  if (db) {
    try { return db.collection(col).doc(id).onSnapshot((s) => cb(s.exists ? { id: s.id, ...s.data() } : null), (e) => console.warn(col, e)); }
    catch (e) { console.warn(e); return () => {}; }
  }
  const emit = () => cb(localRead(col).find((x) => x.id === id) || null);
  (localSubs[col] ||= new Set()).add(emit); emit();
  return () => localSubs[col].delete(emit);
}
async function delDoc(col, id) {
  try {
    if (db) await db.collection(col).doc(id).delete();
    else { lsSet("c:" + col, localRead(col).filter((x) => x.id !== id)); localEmit(col); }
    toast("انحذف");
  } catch (e) { writeFailed(e); }
}
function guardWrite() {
  if (!S.canWrite || !S.uid) { toast("المشاركة غير متاحة لك هنا. تقدر تتصفّح كل شي."); return false; }
  return true;
}
function needProfile() {
  if (S.alumni[S.uid]) return true;
  toast("أنشئ ملفك أولًا عشان يظهر اسمك وفوجك");
  openProfile();
  return false;
}
const nameOf = (uid) => S.alumni[uid]?.name || S.names[uid] || "خريج/ة";
const canDelete = (row) => row.uid === S.uid || S.isAdmin;

async function resolveNames(uids) {
  if (!userCap) return;
  const missing = [...new Set(uids)].filter((u) => u && !S.alumni[u] && !(u in S.names));
  if (!missing.length) return;
  const ps = await userCap.profiles(missing);
  let changed = false;
  for (const u of missing) { S.names[u] = ps[u]?.name || ""; if (S.names[u]) changed = true; }
  if (changed) renderLists();
}

// ---------- navigation: sections in the top bar, views inside each section ----------
const views = {};
const SECTIONS = [
  ["home", "الرئيسية"], ["uni", "جامعة"], ["tools", "أدوات"], ["community", "المجتمع"], ["learn", "التعلّم"],
  ["grants", "المنح"], ["career", "المسار المهني"], ["events", "الفعاليات"], ["guides", "الأدلة"], ["me", "مساحتي"], ["admin", "الإدارة"], ["ideas", "الأفكار"],
];
const VIEW_META = [];
// registerView(id, section, label, render?, {order, admin})
function registerView(id, section, label, render, opts = {}) {
  if (render) views[id] = render;
  VIEW_META.push({ id, section, label, order: opts.order ?? 50, admin: !!opts.admin });
}
const visibleViews = () => VIEW_META.filter((v) => !v.admin || S.isAdmin);
const sectionViews = (sec) => visibleViews().filter((v) => v.section === sec).sort((a, b) => a.order - b.order);
const sectionOf = (id) => VIEW_META.find((v) => v.id === id)?.section || "home";
function resolveView(v) {
  if (visibleViews().some((m) => m.id === v)) return v;
  const first = sectionViews(v)[0];
  return first ? first.id : "home";
}
function buildTabs() {
  const cur = sectionOf(S.view);
  $("#tabs").replaceChildren(...SECTIONS.filter(([id]) => sectionViews(id).length).map(([id, label]) =>
    h("button", { class: "tab", type: "button", "data-go": id, "aria-current": cur === id ? "page" : null, text: label })));
}
function subNav() {
  const list = sectionViews(sectionOf(S.view));
  if (list.length < 2) return null;
  return h("nav", { class: "subnav chips", "aria-label": "أقسام فرعية" }, list.map((m) =>
    h("button", { class: "chip", type: "button", "data-go": m.id, "aria-pressed": String(m.id === S.view), text: m.label })));
}
function go(v) {
  S.view = resolveView(v);
  buildTabs();
  renderView();
  window.scrollTo({ top: 0 });
  try { history.replaceState(null, "", "#" + S.view); } catch {}
  const cur = $(`.tab[aria-current="page"]`); cur && cur.scrollIntoView({ inline: "center", block: "nearest" });
}
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) { e.preventDefault(); go(g.getAttribute("data-go")); }
});

// ---------- extension points for feature modules ----------
// HOOKS.lists: run after shared data changes. HOOKS.boot: run once the data layer is ready (start subscriptions here).
// HOOKS.home: functions returning a home-page widget element (or null); sorted by .order.
const HOOKS = { lists: [], boot: [], home: [] };
function registerHome(fn, order = 50) { fn.order = order; HOOKS.home.push(fn); }
// Cleanup functions for the current view (unsubscribe, timers); run when the view changes.
let leaveFns = [];
function onLeave(fn) { leaveFns.push(fn); }
// Global search providers: fn(q) returns [{title, sub, go: viewId, onOpen?: fn}] (max ~8 each).
const SEARCH = [];
function registerSearch(label, fn) { SEARCH.push({ label, fn }); }
// Tools shown in the «أدوات» section.
const TOOLS = [];
function registerTool(id, title, desc, render, order = 50) { TOOLS.push({ id, title, desc, render, order }); }
// Optional runtime capabilities; each stays null when the viewer cannot use it.
const CAP = { sample: null, assets: null, downloads: null, room: null };
// Ask Claude. Resolves the answer text; rejects with {code} ("not_granted" when unavailable).
async function ai(input, opts = {}) {
  if (!CAP.sample) throw { code: "not_granted", message: "المساعد الذكي غير متاح هنا" };
  const r = await CAP.sample(input, { cache: false, ...opts });
  return r.text;
}
async function aiJson(input, opts = {}) {
  if (!CAP.sample) throw { code: "not_granted", message: "المساعد الذكي غير متاح هنا" };
  return CAP.sample.json(input, opts);
}
function aiError(e) {
  if (e && e.code === "rate_limited") return "المساعد مشغول، جرّب بعد شوي.";
  if (e && e.code === "not_granted") return "المساعد الذكي غير متاح بهذا العرض. افتح المنصة من claude.ai واسمح له.";
  return "ما قدر المساعد يجاوب هلّق.";
}
// Offer a generated file to the viewer. Returns true when saved.
async function saveFile(filename, data) {
  if (!CAP.downloads) { toast("التنزيل غير متاح بهذا العرض"); return false; }
  try { await CAP.downloads.save({ filename, data }); return true; }
  catch (e) { if (e?.code !== "declined") toast("ما انحفظ الملف"); return false; }
}
// Upload an image or PDF; resolves {id, url} or null.
async function uploadFile(file) {
  if (!CAP.assets) { toast("رفع الملفات غير متاح لك هنا، استخدم رابط بدلًا منه"); return null; }
  try { const r = await CAP.assets.upload(file); return { id: r.id, url: r.url }; }
  catch (e) { toast(e?.code === "too_large" ? "الملف كبير كثير" : "ما انرفع الملف"); return null; }
}
// The viewer's private collection (only they can read it): "data/users/<uid>".
const myCol = () => "data/users/" + S.uid;
const isMod = (key, id) => !!(S.mod[key] && S.mod[key][id]);
// Arabic-insensitive search: folds alef/ya/ta-marbuta forms and diacritics.
function norm(s) { return String(s || "").replace(/[ً-ْـ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase(); }
const matches = (hay, q) => !q || norm(hay).includes(norm(q));

// ---------- shared pieces ----------
function eyebrow(t) { return h("p", { class: "eyebrow", text: t }); }
function head(eb, title, lede) { return h("div", { class: "head" }, eyebrow(eb), h("h1", { text: title }), lede ? h("p", { class: "lede", text: lede }) : null); }
function empty(title, text) { return h("div", { class: "empty" }, h("b", { text: title }), text); }
function writeBanner() {
  if (S.mode === "loading") return null;
  if (!S.canWrite) return h("div", { class: "banner warn" }, "أنت بوضع التصفّح فقط. للنشر والمشاركة اطلب من صاحب المنصة صلاحية «مساهم» (Contributor).");
  if (S.mode === "local") return h("div", { class: "banner warn" }, "وضع تجريبي: كل ما تضيفه بينحفظ على هذا الجهاز فقط. افتح المنصة من رابطها على Claude لتصير المشاركات مشتركة بين الكل.");
  return null;
}
function rowActions(col, row) {
  return canDelete(row) ? h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تحذف هذا؟", () => delDoc(col, row.id)), text: "حذف" }) : null;
}
function confirmBox(text, ok) {
  const close = () => $("#modal-root").replaceChildren();
  $("#modal-root").replaceChildren(h("div", { class: "modal", onclick: (e) => e.target.classList.contains("modal") && close() },
    h("div", { class: "modal-box" }, h("h3", { text }),
      h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: () => { close(); ok(); }, text: "نعم" }), h("button", { class: "btn ghost", type: "button", onclick: close, text: "إلغاء" })))));
}
function modal(title, body) {
  const close = () => $("#modal-root").replaceChildren();
  const box = h("div", { class: "modal-box", role: "dialog", "aria-label": title },
    h("div", { class: "spread" }, h("h2", { text: title }), h("button", { class: "btn sm ghost", type: "button", onclick: close, text: "إغلاق" })), body);
  $("#modal-root").replaceChildren(h("div", { class: "modal", onclick: (e) => e.target.classList.contains("modal") && close() }, box));
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  return close;
}

// ---------- profile ----------
function openProfile() {
  if (!S.uid) { toast("لازم تسجّل دخول لـ Claude عشان تعمل ملف"); return; }
  const p = S.alumni[S.uid] || {};
  const years = []; for (let y = THIS_YEAR + 2; y >= 1990; y--) years.push(y);
  const f = h("form", { class: "form", id: "profile-form" },
    h("label", { class: "field full" }, h("span", { text: "الاسم كما تحب يظهر" }), h("input", { type: "text", id: "pf-name", required: true, maxlength: 60, value: p.name || "" })),
    h("label", { class: "field" }, h("span", { text: "سنة التخرج (الفوج)" }), h("select", { id: "pf-year" }, years.map((y) => opt(y, String(y), (p.year || THIS_YEAR) == y)))),
    h("label", { class: "field" }, h("span", { text: "وضعك اليوم" }), h("select", { id: "pf-status" }, STATUS.map((s) => opt(s, s, p.status === s)))),
    h("label", { class: "field" }, h("span", { text: "وين بتدرس أو بتشتغل" }), h("input", { type: "text", id: "pf-place", list: "inst-names", maxlength: 80, value: p.place || "", placeholder: "مثال: جامعة بن غوريون" })),
    h("label", { class: "field" }, h("span", { text: "التخصص أو المجال" }), h("input", { type: "text", id: "pf-field", maxlength: 60, value: p.field || "", placeholder: "مثال: تمريض" })),
    h("label", { class: "field" }, h("span", { text: "البلد" }), h("input", { type: "text", id: "pf-city", maxlength: 40, value: p.city || "" })),
    h("label", { class: "field" }, h("span", { text: "طريقة تواصل (تظهر للكل)" }), h("input", { type: "text", id: "pf-contact", maxlength: 80, value: p.contact || "", placeholder: "إنستغرام أو إيميل" })),
    h("label", { class: "field full" }, h("span", { text: "نبذة قصيرة" }), h("textarea", { id: "pf-bio", maxlength: 400, text: p.bio || "" })),
    h("label", { class: "check full" }, h("input", { type: "checkbox", id: "pf-mentor", checked: p.mentor ? true : null }), "متاح/ة أساعد وأرشد طلاب المدرسة"),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "احفظ ملفي" }), h("span", { class: "muted small", text: "لا تكتب رقم هاتف إذا ما بدك يظهر لكل الأعضاء." })),
  );
  f.append(h("datalist", { id: "inst-names" }, INST.map((i) => opt(i.ar))));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      uid: S.uid, name: $("#pf-name").value.trim(), year: +$("#pf-year").value, status: $("#pf-status").value,
      place: $("#pf-place").value.trim(), field: $("#pf-field").value.trim(), city: $("#pf-city").value.trim(),
      contact: $("#pf-contact").value.trim(), bio: $("#pf-bio").value.trim(), mentor: $("#pf-mentor").checked,
      createdAt: p.createdAt || Date.now(), updatedAt: Date.now(),
    };
    if (!data.name) return;
    if (await setDoc("alumni", S.uid, data)) { close(); toast("انحفظ ملفك"); }
  });
  const close = modal(p.name ? "ملفّي" : "أنشئ ملفك", f);
}
$("#me-btn").addEventListener("click", openProfile);

