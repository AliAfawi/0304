// Opens index.html at phone width, visits every registered view, reports page errors and horizontal overflow.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("file://" + (process.argv[2] || __dirname + "/index.html") + "#home");
  await p.waitForTimeout(600);
  const ids = await p.evaluate(() => VIEW_META.map((v) => v.id));
  const wide = [];
  for (const id of ids) {
    await p.evaluate((id) => { S.isAdmin = true; go(id); }, id);
    await p.waitForTimeout(120);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    if (w > 390) wide.push(id + ":" + w);
  }
  const tools = await p.evaluate(() => TOOLS.map((t) => t.id));
  for (const t of tools) { await p.evaluate((t) => { toolTab = t; go("tools"); }, t); await p.waitForTimeout(100); }
  console.log(`views ${ids.length}, tools ${tools.length}, overflow [${wide.join(", ")}], errors ${errs.length}`);
  errs.slice(0, 15).forEach((e) => console.log("  ERR", e));
  await b.close();
  if (errs.length || wide.length) process.exit(1);
})();
