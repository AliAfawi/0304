/* يبني data/ar-cache.js من نبذ ويكيبيديا العربية للأماكن المضافة من مصادر مفتوحة.
   الهدف: ظهور الحكاية العربية فورًا دون أي استعلام من متصفح الزائر.

   الاستعمال:  node tools/build-ar-cache.js [--state ../scratch/ar-extracts.json]

   المصدر: ويكيبيديا العربية، رخصة CC BY-SA 3.0 — يجب إبقاء الإسناد في الواجهة. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const STATE = arg('state', path.join(ROOT, '.ar-state.json'));
const OUT = path.join(ROOT, 'data/ar-cache.js');
const LIMIT = 700; /* أقصى طول للنبذة المخزّنة */

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) {
  console.error('تعذّر قراءة ملف الحالة:', STATE);
  process.exit(1);
}

global.window = {};
require(path.join(ROOT, 'data/trails.js'));
require(path.join(ROOT, 'data/heritage.js'));
require(path.join(ROOT, 'data/open-places.js'));

const byQ = new Map();
for (const p of global.window.DOROUB_TRAILS) if (p.wikidata) byQ.set(p.wikidata, p);

const rows = {};
let kept = 0;
for (const [q, row] of Object.entries(state)) {
  if (!row || row.error || !row.extract) continue;
  const text = String(row.extract).replace(/\s+/g, ' ').trim();
  if (text.length < 40) continue;
  rows[q] = {
    title: row.title || (byQ.get(q) && byQ.get(q).arWiki) || '',
    extract: text.length > LIMIT ? text.slice(0, LIMIT).replace(/\s+\S*$/, '') + '…' : text
  };
  kept++;
}

const header = `/* دُروب — نبذ ويكيبيديا العربية المجهّزة مسبقًا.
   مولّد آليًا بواسطة tools/build-ar-cache.js — لا تحرّره يدويًا.
   آخر توليد: ${new Date().toISOString().slice(0, 10)} · ${kept} نبذة.
   المصدر: ويكيبيديا العربية، رخصة CC BY-SA 3.0 — الإسناد معروض في صفحة المكان. */
`;
fs.writeFileSync(OUT, header + 'window.DOROUB_AR_CACHE = ' + JSON.stringify(rows, null, 1) + ';\n');
console.log(`كُتبت ${kept} نبذة إلى ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
