// Switches the built page to Hebrew, visits every view and tool, and lists Arabic strings still untranslated.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem("gp:lang", JSON.stringify("he")); } catch {} });
  await p.goto("file://" + __dirname + "/index.html#home"); await p.waitForTimeout(700);
  const ids = await p.evaluate(() => VIEW_META.map((v) => v.id));
  const wide = [];
  for (const id of ids) { await p.evaluate((id) => { S.isAdmin = true; go(id); }, id); await p.waitForTimeout(80); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 390) wide.push(id); }
  for (const t of await p.evaluate(() => TOOLS.map((t) => t.id))) { await p.evaluate((t) => { toolTab = t; go("tools"); }, t); await p.waitForTimeout(60); }
  const miss = await p.evaluate(() => [...I18N_MISSING]);
  console.log(`missing ${miss.length}, overflow [${wide}], errors ${errs.length}`);
  require("fs").writeFileSync(__dirname + "/i18n/missing.json", JSON.stringify(miss, null, 1));
  miss.slice(0, 25).forEach((m) => console.log("  ", m.slice(0, 90)));
  await b.close();
})();
