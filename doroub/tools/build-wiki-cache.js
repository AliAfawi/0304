/* يبني data/wiki-cache.js من ملخّصات ويكيبيديا لكل عنوان مذكور في الكتالوج.
   الهدف: ظهور الصور وإحداثيات الخريطة فورًا دون انتظار أي استعلام من متصفح الزائر.

   الاستعمال:  node tools/build-wiki-cache.js [--out data/wiki-cache.js] [--state .wiki-state.json]
   يحترم حدود واجهة ويكيبيديا: طلب واحد كل ثانيتين مع تراجع تدريجي عند 429،
   ويحفظ تقدّمه فيمكن تشغيله مرة أخرى لإكمال ما تبقّى. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const OUT = path.join(ROOT, arg('out', 'data/wiki-cache.js'));
const STATE = path.join(ROOT, arg('state', '.wiki-state.json'));
const UA = 'DoroubSiteBuilder/1.0 (static catalogue build; contact via repository)';

global.window = {};
require(path.join(ROOT, 'data/trails.js'));
require(path.join(ROOT, 'data/heritage.js'));
require(path.join(ROOT, 'data/places.js'));

const fallbacks = global.window.DOROUB_WIKI_FALLBACK || {};
const titles = [...new Set(global.window.DOROUB_TRAILS
  .map(p => p.photoWiki || fallbacks[p.id])
  .filter(Boolean))].sort();

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { }

const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const fetchText = url => execFileSync('curl',
  ['-sS', '--max-time', '30', '-A', UA, '-H', 'Accept: application/json', '-w', '\n%{http_code}', url],
  { encoding: 'utf8', maxBuffer: 1e7 });

const pending = titles.filter(t => !(t in state) || (state[t] && state[t].error && state[t].error !== '404'));
console.log(`العناوين: ${titles.length} · المتبقّي: ${pending.length}`);

for (const title of pending) {
  let done = false;
  for (let attempt = 0; attempt < 5 && !done; attempt++) {
    try {
      const raw = fetchText('https://en.wikipedia.org/api/rest_v1/page/summary/'
        + encodeURIComponent(title.replace(/ /g, '_')));
      const cut = raw.lastIndexOf('\n');
      const code = raw.slice(cut + 1).trim();
      if (code === '429') { sleep(15000 + attempt * 15000); continue; }
      if (code !== '200') { state[title] = { error: code }; done = true; break; }
      const d = JSON.parse(raw.slice(0, cut));
      state[title] = {
        title: d.title || title,
        coord: d.coordinates ? { lat: +d.coordinates.lat.toFixed(5), lng: +d.coordinates.lon.toFixed(5) } : null,
        img: (d.originalimage && d.originalimage.source || '').split('?')[0] || null,
        desc: d.description || null,
        extract: d.extract || null
      };
      done = true;
    } catch (e) { sleep(6000); }
  }
  if (!done) state[title] = { error: 'retry' };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  process.stdout.write(state[title].coord ? '+' : state[title].error ? '!' : '.');
  sleep(2000);
}

const rows = {};
for (const [title, row] of Object.entries(state)) {
  if (!row || row.error || (!row.img && !row.coord)) continue;
  rows[title] = {
    title: row.title,
    coord: row.coord || null,
    img: row.img || null,
    extract: row.extract ? String(row.extract).replace(/\s+/g, ' ').slice(0, 420) : null
  };
}

const header = `/* دُروب — نتائج ويكيبيديا المجهّزة مسبقًا (صورة وإحداثيات مرجعية).
   مولّد آليًا بواسطة tools/build-wiki-cache.js — لا تحرّره يدويًا.
   آخر توليد: ${new Date().toISOString().slice(0, 10)} · ${Object.keys(rows).length} عنوانًا من ${titles.length}.
   الإحداثيات مرجعية للمعلم وليست نقطة انطلاق مسار. */\n`;
fs.writeFileSync(OUT, header + 'window.DOROUB_WIKI_CACHE = ' + JSON.stringify(rows, null, 1) + ';\n');
console.log(`\nكُتب ${Object.keys(rows).length} عنوانًا إلى ${path.relative(ROOT, OUT)}`);
