// Collects every Arabic string literal from the page sources into i18n-strings.json (keys as the runtime
// dictionary expects: whitespace collapsed, ${…} placeholders as "#"). Used to build he-dict.js.
const fs = require("fs");
const dir = __dirname;
const files = ["ideas.js", "institutions.js", "page.html", ...fs.readdirSync(dir + "/modules").filter((f) => f.endsWith(".js")).map((f) => "modules/" + f)];
const AR = /[؀-ۿ]/;
const keys = new Set();
const add = (s) => {
  s = s.replace(/\\n/g, " ").replace(/\\(["'`\\])/g, "$1").replace(/\$\{[^}]*\}/g, "#").replace(/\s+/g, " ").trim();
  if (!AR.test(s)) return;
  keys.add(s);
  // Strings shown with surrounding punctuation trimmed or split on " · " also appear at runtime.
  s.split(" · ").forEach((p) => AR.test(p) && keys.add(p.trim()));
};
for (const f of files) {
  let src = fs.readFileSync(dir + "/" + f, "utf8");
  if (f.endsWith(".html")) { src.replace(/>([^<>]+)</g, (_, t) => add(t)); src.replace(/(?:placeholder|aria-label|title)="([^"]+)"/g, (_, t) => add(t)); continue; }
  src.replace(/"((?:[^"\\\n]|\\.)*)"/g, (_, s) => add(s));
  src.replace(/'((?:[^'\\\n]|\\.)*)'/g, (_, s) => add(s));
  src.replace(/`((?:[^`\\]|\\.)*)`/gs, (_, s) => { add(s); s.split(/\$\{[^}]*\}/).forEach(add); });
}
const out = [...keys].sort();
fs.writeFileSync(dir + "/i18n-strings.json", JSON.stringify(out, null, 0));
console.log(out.length, "strings,", out.reduce((n, s) => n + s.length, 0), "chars");
