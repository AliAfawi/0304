// Builds index.html: page.html + every modules/*.js (in file-name order) + modules/*.css,
// with ideas.js and institutions.js inlined. Also writes IDEAS.md from the ideas list.
const fs = require("fs");
(function main() {
const dir = __dirname;
const read = (f) => fs.readFileSync(dir + "/" + f, "utf8");
// GP_ONLY="30,31" limits the build to the core files (00-29, 99) plus modules starting with those prefixes.
// GP_OUT sets the output file (default index.html) so parallel checks don't overwrite each other.
const only = (process.env.GP_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const keep = (f) => !only.length || /^(0|1|2|99)/.test(f) || only.some((p) => f.startsWith(p));
const files = fs.readdirSync(dir + "/modules").sort().filter(keep);
const js = files.filter((f) => f.endsWith(".js")).map((f) => `// ===== ${f} =====\n` + read("modules/" + f)).join("\n")
  .split("/*IDEAS*/").join(read("ideas.js"))
  .split("/*INSTITUTIONS*/").join(read("institutions.js"));
const css = files.filter((f) => f.endsWith(".css")).map((f) => read("modules/" + f)).join("\n");
const page = read("page.html").split("/*MODULES*/").join(js).split("/*MODULE_CSS*/").join(css);
const out = process.env.GP_OUT || dir + "/index.html";
fs.writeFileSync(out, page);
if (process.env.GP_OUT) { console.log("built " + out); return; }
const IDEAS = new Function(read("ideas.js") + "; return IDEAS;")();
const total = IDEAS.reduce((s, g) => s + g.items.length, 0);
const built = IDEAS.reduce((s, g) => s + g.items.filter((t) => t[0] === "*").length, 0);
let n = 0, md = `# أفكار تطوير بوابة الخريجين\n\n${total} فكرة في ${IDEAS.length} محورًا. ✅ = موجودة في النسخة الحالية (${built}).\n`;
for (const g of IDEAS) {
  md += `\n## ${g.c}\n\n`;
  for (const t of g.items) md += `${++n}. ${t[0] === "*" ? "✅ " + t.slice(1) : t}\n`;
}
fs.writeFileSync(dir + "/IDEAS.md", md);
console.log(`built index.html (${(page.length / 1024).toFixed(0)} KB), ideas ${built}/${total}`);
})();
