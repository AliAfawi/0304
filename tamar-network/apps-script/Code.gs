/**
 * רשת תמר – קליטת טפסים מהאתר לגיליון Google אחד.
 * כל סוג טופס נשמר בלשונית משלו, עם עמודת סטטוס לטיפול, והתראה בדוא"ל על כל פנייה חדשה.
 *
 * התקנה: ראו apps-script/README.md
 */

// ===== הגדרות =====
const NOTIFY_EMAIL = '';                 // הדוא"ל שלך לקבלת התראה על כל פנייה חדשה (ריק = ללא התראות)
const CV_FOLDER_NAME = 'רשת תמר – קורות חיים';
const MAX_PER_10_MIN = 60;               // הגבלת קצב כללית נגד הצפה
const STATUSES = ['חדש', 'בטיפול', 'טופל', 'לא רלוונטי'];

const TABS = {
  enroll:  { name: 'הרשמה',     cols: [['parent','שם ההורה'],['phone','טלפון'],['email','דוא"ל'],['child','שם התלמיד/ה'],['grade','כיתה'],['school','בית ספר'],['interest','תחום עניין'],['notes','הערות']] },
  job:     { name: 'מועמדויות', cols: [['job','משרה'],['name','שם'],['phone','טלפון'],['email','דוא"ל'],['message','הודעה'],['cv','קורות חיים']] },
  donate:  { name: 'תרומות',    cols: [['name','שם'],['phone','טלפון'],['email','דוא"ל'],['amount','סכום (₪)'],['note','הקדשה / הערה']] },
  contact: { name: 'פניות',     cols: [['subject','נושא'],['school','בית ספר'],['name','שם'],['phone','טלפון'],['email','דוא"ל'],['message','הודעה']] }
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return out({ ok: false, err: 'busy' });
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > 6500000) return out({ ok: false, err: 'too_large' });
    const body = JSON.parse(raw || '{}');
    const def = TABS[body.type];
    if (!def) return out({ ok: false, err: 'type' });
    // spam traps: hidden field filled, or form sent faster than a person can type
    if (body.hp || !(Number(body.elapsed) >= 2500)) return out({ ok: true });
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get('n') || 0);
    if (n >= MAX_PER_10_MIN) return out({ ok: false, err: 'rate' });
    cache.put('n', String(n + 1), 600);

    const d = body.data || {};
    if (!clean(d.phone) && !clean(d.email)) return out({ ok: false, err: 'contact' });
    const cvUrl = body.type === 'job' && d.cv && d.cv.data ? saveCv(d.cv) : '';
    const row = [new Date(), STATUSES[0], clean(body.lang)].concat(
      def.cols.map(function (c) { return c[0] === 'cv' ? cvUrl : clean(d[c[0]]); }));
    sheetFor(def).appendRow(row);
    notify(def, row);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, err: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, service: 'tamar-forms' }); }

/** הריצו פעם אחת מהעורך כדי ליצור את כל הלשוניות ולאשר הרשאות. */
function setup() { Object.keys(TABS).forEach(function (k) { sheetFor(TABS[k]); }); }

// Plain text only, length-limited, and never starting with = + - @ (blocks spreadsheet formula injection).
function clean(v) {
  let s = String(v == null ? '' : v).slice(0, 2000).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function sheetFor(def) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.name);
  if (!sh) {
    sh = ss.insertSheet(def.name);
    const head = ['תאריך', 'סטטוס', 'שפה'].concat(def.cols.map(function (c) { return c[1]; }));
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#eef3e1');
    sh.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm');
    sh.getRange('B2:B').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
  }
  return sh;
}

function saveCv(cv) {
  const name = clean(cv.name).replace(/^'/, '').replace(/[\\/:*?"<>|]/g, '_');
  if (!/\.(pdf|docx?)$/i.test(name) || String(cv.data).length > 5600000) return 'קובץ נדחה';
  const blob = Utilities.newBlob(Utilities.base64Decode(cv.data), 'application/octet-stream', name);
  const it = DriveApp.getFoldersByName(CV_FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CV_FOLDER_NAME);
  return folder.createFile(blob).getUrl();   // stays private to your Drive
}

function notify(def, row) {
  if (!NOTIFY_EMAIL) return;
  const lines = def.cols.map(function (c, i) { return c[1] + ': ' + row[3 + i]; });
  MailApp.sendEmail(NOTIFY_EMAIL, 'רשת תמר – ' + def.name + ' חדשה',
    lines.join('\n') + '\n\nלצפייה בגיליון: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
