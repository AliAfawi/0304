// Inlines ideas.js into the page and writes IDEAS.md from the same list.
const fs = require("fs");
const ideasSrc = fs.readFileSync(__dirname + "/ideas.js", "utf8");
fs.writeFileSync(__dirname + "/index.html", fs.readFileSync(__dirname + "/src.html", "utf8").replace("/*IDEAS*/", ideasSrc).replace("/*INSTITUTIONS*/", fs.readFileSync(__dirname + "/institutions.js", "utf8")));
const IDEAS = new Function(ideasSrc + "; return IDEAS;")();
let n = 0, md = `# أفكار تطوير بوابة الخريجين\n\n${IDEAS.reduce((s, g) => s + g.items.length, 0)} فكرة في ${IDEAS.length} محورًا. ✅ = موجودة في النسخة الحالية.\n`;
for (const g of IDEAS) {
  md += `\n## ${g.c}\n\n`;
  for (const t of g.items) md += `${++n}. ${t[0] === "*" ? "✅ " + t.slice(1) : t}\n`;
}
fs.writeFileSync(__dirname + "/IDEAS.md", md);
