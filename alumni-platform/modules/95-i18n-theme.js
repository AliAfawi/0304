// ---------- theme (auto / light / dark) and interface language (Arabic / Hebrew) ----------
// Hebrew works as an exact-string dictionary (HE, from he-dict.js) applied to rendered text and a few
// attributes. Keys are whitespace-collapsed Arabic strings; digits inside a string are matched as "#".
const THEMES = ["auto", "light", "dark"];
const THEME_ICON = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};
const THEME_LABEL = { auto: "المظهر: حسب الجهاز", light: "المظهر: نهاري", dark: "المظهر: ليلي" };
let theme = THEMES.includes(lsGet("theme", "auto")) ? lsGet("theme", "auto") : "auto";
function applyTheme() {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
  const btn = $("#theme-btn");
  btn.innerHTML = THEME_ICON[theme];
  btn.setAttribute("aria-label", trString(THEME_LABEL[theme]));
  btn.title = btn.getAttribute("aria-label");
}
$("#theme-btn").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  lsSet("theme", theme);
  applyTheme();
  toast(trString(THEME_LABEL[theme]));
});

const I18N_ATTRS = ["placeholder", "aria-label", "title"];
const I18N_SKIP = "script, style, textarea, [data-i18n-skip], [contenteditable]";
const ARABIC = /[؀-ۿ]/;
const ORIG = new WeakMap();
const I18N_MISSING = new Set();
function trString(s) {
  if (LANG !== "he" || !s || !ARABIC.test(s)) return s;
  const key = s.replace(/\s+/g, " ").trim();
  if (HE[key]) return s.replace(s.trim(), HE[key]);
  const nums = key.match(/\d+(?:[.,]\d+)*/g);
  if (nums) {
    const tpl = HE[key.replace(/\d+(?:[.,]\d+)*/g, "#")];
    if (tpl) { let i = 0; return s.replace(s.trim(), tpl.replace(/#/g, () => nums[i++] ?? "")); }
  }
  I18N_MISSING.add(key);
  return s;
}
function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) { translateText(root); return; }
  if (root.nodeType !== 1 || root.closest?.(I18N_SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateText(n);
  [root, ...root.querySelectorAll("[placeholder], [aria-label], [title]")].forEach(translateAttrs);
}
function translateText(n) {
  const v = n.nodeValue;
  if (!v || !ARABIC.test(v) || n.parentElement?.closest(I18N_SKIP)) return;
  const t = trString(v);
  if (t !== v) { ORIG.set(n, v); n.nodeValue = t; }
}
function translateAttrs(el) {
  if (!el.getAttribute || el.closest(I18N_SKIP)) return;
  for (const a of I18N_ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !ARABIC.test(v)) continue;
    const t = trString(v);
    if (t !== v) { el.setAttribute("data-orig-" + a, v); el.setAttribute(a, t); }
  }
}
function restoreTree(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (ORIG.has(n)) { n.nodeValue = ORIG.get(n); ORIG.delete(n); }
  root.querySelectorAll("[data-orig-placeholder], [data-orig-aria-label], [data-orig-title]").forEach((el) => {
    for (const a of I18N_ATTRS) if (el.hasAttribute("data-orig-" + a)) { el.setAttribute(a, el.getAttribute("data-orig-" + a)); el.removeAttribute("data-orig-" + a); }
  });
}
const i18nObserver = new MutationObserver((list) => {
  if (LANG !== "he") return;
  for (const m of list) {
    if (m.type === "attributes") { translateAttrs(m.target); continue; }
    m.addedNodes.forEach(translateTree);
  }
});
function applyLang() {
  const root = document.documentElement;
  root.lang = LANG;
  const btn = $("#lang-btn");
  btn.textContent = LANG === "he" ? "العربية" : "עברית";
  btn.setAttribute("aria-label", LANG === "he" ? "التبديل للعربية" : "מעבר לעברית");
  btn.setAttribute("data-i18n-skip", "");
  if (LANG === "he") {
    translateTree(document.body);
    document.title = HE["بوابة الخريجين"] || document.title;
    i18nObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: I18N_ATTRS });
  } else {
    i18nObserver.disconnect();
    restoreTree(document.body);
    document.title = "بوابة الخريجين";
  }
  applyTheme();
}
$("#lang-btn").addEventListener("click", () => {
  LANG = LANG === "he" ? "ar" : "he";
  lsSet("lang", LANG);
  $("#modal-root").replaceChildren();
  applyLang();
  buildTabs();
  renderView();
});
applyTheme();
applyLang();
