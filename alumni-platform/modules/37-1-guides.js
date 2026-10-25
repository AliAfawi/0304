// ===== guides library + reader (ideas 27, 29-38, 90-95, 99, 100, 128, 135, 136, 152, 153, 176-178, 184, 191, 192, 253, 276) =====
const gdState = { open: null, cat: "all", q: "", track: lsGet("gd:track", ""), grade: "all" };
const gdCatLabel = (c) => (GD_CATS.find((x) => x[0] === c) || [, ""])[1];
const gdSteps = (g) => g.steps.map((s) => (typeof s === "string" ? { t: s } : s));
const gdDone = (id) => lsGet("gd:steps:" + id, []);
function gdText(g) {
  const parts = [g.title, g.lede];
  g.sections.forEach((s) => { parts.push(s.h); s.body.forEach((b) => parts.push(typeof b === "string" ? b : b.ul ? b.ul.join(" ") : b.note)); });
  return parts.join(" ");
}
const gdMinutes = (g) => Math.max(2, Math.round(gdText(g).split(/\s+/).length / 180));
function gdOpen(id) { gdState.open = id; gdState.grade = "all"; go("guides"); }
function gdEsc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// «إبلاغ» on member content, shared by modules 37 and 38. Writes `reports`.
function gdReportBtn(col, id) {
  if (!S.uid) return null;
  return h("button", { class: "link small", type: "button", onclick: () => gdReport(col + ":" + id, "إبلاغ عن محتوى", "شو المشكلة؟") , text: "إبلاغ" });
}
function gdReport(target, title, label, placeholder) {
  if (!guardWrite()) return;
  const ta = h("textarea", { id: "gd-report-text", required: true, maxlength: 1000, placeholder: placeholder || "مثال: معلومة غلط، رابط ما بيشتغل، محتوى مسيء" });
  const f = h("form", { class: "stack" }, h("label", { class: "field" }, h("span", { text: label }), ta),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "submit", text: "أرسل" }), h("span", { class: "muted small", text: "بيوصل لإدارة المنصة فقط." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reason = ta.value.trim(); if (!reason) return;
    if (await addDoc("reports", { uid: S.uid, target, reason, createdAt: Date.now() })) { close(); toast("وصل، شكرًا إلك"); }
  });
  const close = modal(title, f);
  setTimeout(() => ta.focus(), 30);
}
// Author line with verified pill and cohort.
function gdWho(uid, ts) {
  const a = S.alumni[uid];
  return h("div", { class: "row gd-who" }, avatar(nameOf(uid), uid),
    h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(uid) }),
      isMod("verified", uid) ? h("span", { class: "pill good", text: "موثّق" }) : null,
      a ? h("span", { text: "فوج " + a.year }) : null, ts ? h("span", { text: rel(ts) }) : null));
}

// ---------- library ----------
views.guides = () => (gdState.open && GD_BY_ID[gdState.open] ? gdReader(GD_BY_ID[gdState.open]) : gdLibrary());
registerView("guides", "guides", "مكتبة الأدلة", null, { order: 10 });

function gdCard(g) {
  const done = gdDone(g.id).length, total = g.steps.length;
  return h("button", { class: "gd-card", type: "button", onclick: () => gdOpen(g.id) },
    h("span", { class: "gd-card-cat", text: gdCatLabel(g.cat) }),
    h("b", { text: g.title }),
    h("span", { class: "gd-card-lede", text: g.lede }),
    h("span", { class: "gd-card-meta" },
      h("span", { text: `${gdMinutes(g)} دقائق قراءة` }),
      done ? h("span", { class: "pill good", text: `${done}/${total} خطوات` }) : h("span", { text: `${total} خطوات` })));
}
function gdLibrary() {
  const v = h("div", { class: "view" },
    head("الأدلة", "أدلة عملية، بالعربي، من الثانوية لسوق العمل", "كل دليل فيه شرح قصير، قائمة خطوات بتعلّم عليها لحالك، وروابط رسمية. اختار صفّك أو ابحث عن موضوع."),
    h("section", { class: "section" },
      h("h2", { class: "gd-h2", text: "أنا هلّق…" }),
      h("div", { class: "chips", id: "gd-tracks" }, GD_TRACKS.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(gdState.track === k),
        onclick: () => { gdState.track = gdState.track === k ? "" : k; lsSet("gd:track", gdState.track); go("guides"); }, text: l }))),
      gdState.track ? h("div", { class: "gd-track plain stack" },
        h("h4", { text: "أدلة بتناسب مرحلتك" }),
        h("div", { class: "gd-cards" }, (GD_TRACKS.find((t) => t[0] === gdState.track) || [, , []])[2].map((id) => GD_BY_ID[id]).filter(Boolean).map(gdCard))) : null),
    h("section", { class: "section" },
      h("div", { class: "form" },
        h("label", { class: "field" }, h("span", { text: "ابحث بالأدلة" }), h("input", { type: "search", id: "gd-q", value: gdState.q, placeholder: "مثال: سكن، عبري، قرض" }))),
      h("div", { class: "chips", id: "gd-cats" }, [["all", "الكل"], ...GD_CATS.map((c) => [c[0], c[1]])].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(gdState.cat === k),
        onclick: (e) => { gdState.cat = k; document.querySelectorAll("#gd-cats .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); gdDrawLib(); }, text: l }))),
      h("div", { id: "gd-lib", class: "stack gd-lib" })),
    h("section", { class: "section" },
      h("div", { class: "plain gd-help spread" },
        h("div", null, h("h3", { text: "بدك دليل عن موضوع ناقص؟" }), h("p", { class: "muted small", text: "اكتب اقتراحك، والإدارة بتشوفه. أو اكتب مقال من تجربتك بقسم «مقالات الخريجين»." })),
        h("div", { class: "row" },
          h("button", { class: "btn sm ghost", type: "button", onclick: () => gdReport("guides:new", "اقتراح دليل جديد", "عن شو بدك الدليل؟", "مثال: دليل عن السكن ببئر السبع للطلاب من الشمال"), text: "اقترح دليل" }),
          h("button", { class: "btn sm", type: "button", "data-go": "gd-articles", text: "اكتب مقال" })))),
  );
  queueMicrotask(() => { const q = $("#gd-q"); if (q) q.addEventListener("input", (e) => { gdState.q = e.target.value; gdDrawLib(); }); gdDrawLib(); });
  return v;
}
function gdDrawLib() {
  const box = $("#gd-lib"); if (!box) return;
  const q = gdState.q.trim();
  const list = GUIDES.filter((g) => (gdState.cat === "all" || g.cat === gdState.cat) && matches(gdText(g), q));
  if (!list.length) { box.replaceChildren(empty("ما لقينا دليل بهالكلمة", "جرّب كلمة أقصر، أو اقترح دليل جديد من تحت.")); return; }
  const cats = GD_CATS.filter((c) => list.some((g) => g.cat === c[0]));
  box.replaceChildren(...cats.map(([k, l, d]) => h("div", { class: "stack" },
    h("div", { class: "gd-cat-head" }, h("h2", { class: "gd-h2", text: l }), h("span", { class: "muted small", text: d })),
    h("div", { class: "gd-cards" }, list.filter((g) => g.cat === k).map(gdCard)))));
}

// ---------- reader ----------
function gdBlock(b) {
  if (typeof b === "string") return h("p", { text: b });
  if (b.ul) return h("ul", { class: "gd-ul" }, b.ul.map((x) => h("li", { text: x })));
  if (b.note) return h("p", { class: "gd-note", text: b.note });
  return null;
}
function gdReader(g) {
  const steps = gdSteps(g);
  const grades = [...new Set(steps.map((s) => s.g).filter(Boolean))];
  const gradeName = { 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر" };
  const scrollTo = (id) => { const el = document.getElementById(id); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const toc = [...g.sections.map((s, i) => [`gd-s${i}`, s.h]), ["gd-steps", "خطوات"], ...(g.widget ? [["gd-widget", "خطّط رحلتك"]] : []), ["gd-links", "روابط مفيدة"]];
  const stepsBox = h("div", { class: "stack", id: "gd-steps-list" });
  const progress = h("div", { class: "gd-progress" });
  const drawSteps = () => {
    const done = new Set(gdDone(g.id));
    const shown = steps.map((s, i) => [s, i]).filter(([s]) => gdState.grade === "all" || s.g === gdState.grade);
    stepsBox.replaceChildren(...shown.map(([s, i]) => h("label", { class: "gd-step" + (done.has(i) ? " done" : "") },
      h("input", { type: "checkbox", id: `gd-step-${i}`, checked: done.has(i) ? true : null, onchange: (e) => {
        const cur = new Set(gdDone(g.id)); e.target.checked ? cur.add(i) : cur.delete(i); lsSet("gd:steps:" + g.id, [...cur]); drawSteps();
      } }),
      h("span", { text: s.t }), s.g ? h("span", { class: "pill grey", text: gradeName[s.g] }) : null)));
    const n = done.size;
    progress.replaceChildren(h("div", { class: "spread small" }, h("b", { text: `${n} من ${steps.length}` }), h("span", { class: "muted", text: n === steps.length ? "خلّصت كل الخطوات" : "بتنحفظ على جهازك فقط" })),
      h("div", { class: "bar" }, h("i", { style: `width:${(n / steps.length) * 100}%` })));
  };
  drawSteps();
  const fb = h("div", { class: "gd-feedback plain", id: "gd-feedback" });
  const v = h("div", { class: "view gd-reader" },
    h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", onclick: () => { gdState.open = null; go("guides"); }, text: "→ كل الأدلة" })),
    h("header", { class: "head gd-head" },
      eyebrow(gdCatLabel(g.cat)),
      h("h1", { text: g.title }),
      h("p", { class: "lede", text: g.lede }),
      h("div", { class: "meta" }, h("span", { text: `${gdMinutes(g)} دقائق قراءة` }), h("span", { text: `${steps.length} خطوات` }), h("span", { text: "معلومات عامة، افحص التفاصيل بالمصدر الرسمي" }))),
    h("div", { class: "gd-layout" },
      h("nav", { class: "gd-toc plain", "aria-label": "محتوى الدليل" }, h("h4", { text: "بهالدليل" }),
        h("ol", null, toc.map(([id, t]) => h("li", null, h("button", { class: "link", type: "button", onclick: () => scrollTo(id), text: t }))))),
      h("article", { class: "gd-article" },
        h("aside", { class: "gd-tip" }, h("b", { text: "الزبدة" }), h("p", { text: g.tip })),
        ...g.sections.map((s, i) => h("section", { class: "gd-sec" + (s.grade && gdState.track === s.grade ? " gd-mine" : ""), id: `gd-s${i}` },
          h("h2", { text: s.h }), s.grade && gdState.track === s.grade ? h("span", { class: "pill", text: "مرحلتك" }) : null, ...s.body.map(gdBlock))),
        h("section", { class: "gd-sec", id: "gd-steps" },
          h("h2", { text: "خطوات" }),
          h("p", { class: "muted small", text: "علّم على اللي خلّصته. ما حدا بيشوف هالقائمة غيرك." }),
          grades.length ? h("div", { class: "chips" }, [["all", "الكل"], ...grades.map((x) => [x, gradeName[x]])].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(gdState.grade === k),
            onclick: (e) => { gdState.grade = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); drawSteps(); }, text: l }))) : null,
          progress, stepsBox),
        g.widget === "transport" ? h("section", { class: "gd-sec", id: "gd-widget" }, h("h2", { text: "خطّط رحلتك" }), gdTransportWidget()) : null,
        h("section", { class: "gd-sec", id: "gd-links" },
          h("h2", { text: "روابط مفيدة" }),
          g.links.length ? h("div", { class: "links" }, g.links.map(([t, u]) => h("a", { href: u, target: "_blank", rel: "noopener", text: t }))) : h("p", { class: "muted", text: "ما في رابط رسمي واحد لهالموضوع. اسأل المستشار الأكاديمي بمؤسستك." }),
          g.go.length ? h("div", { class: "row" }, g.go.map(([t, id]) => h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (id.startsWith("tool:")) { toolTab = id.slice(5); go("tools"); } else go(id); }, text: t }))) : null),
        fb,
        h("div", { class: "row gd-actions" },
          h("button", { class: "btn sm ghost", type: "button", onclick: () => gdReport("guides:" + g.id, "اقترح تعديل على الدليل", "شو بدك نصلّح أو نضيف؟", "مثال: الرابط الثاني ما بيشتغل، أو في معلومة تغيّرت"), text: "اقترح تعديل" }),
          h("button", { class: "btn sm ghost", type: "button", onclick: () => { ctCardState.src = "g:" + g.id; go("gd-cards"); }, text: "اعمل بطاقة من الزبدة" }),
          h("button", { class: "btn sm ghost", type: "button", onclick: () => saveFile(`دليل-${g.id}.html`, gdBookHtml([g], g.title, true)), text: "نزّل الدليل" })),
        h("div", { class: "stack" }, h("h4", { text: "أدلة قريبة" }),
          h("div", { class: "gd-cards" }, g.related.map((id) => GD_BY_ID[id]).filter(Boolean).map(gdCard))),
      )),
  );
  gdFeedback(g, fb);
  return v;
}
function gdFeedback(g, box) {
  let rows = [];
  const draw = () => {
    const mine = rows.find((r) => r.id === `${g.id}__${S.uid}`);
    const yes = rows.filter((r) => r.helpful).length;
    const vote = async (helpful) => {
      if (!guardWrite()) return;
      if (await setDoc("guide_feedback", `${g.id}__${S.uid}`, { uid: S.uid, guide: g.id, helpful, createdAt: Date.now() })) {
        toast("شكرًا على رأيك");
        if (!helpful) gdReport("guides:" + g.id, "شو الناقص بالدليل؟", "ساعدنا نحسّنه", "مثال: بدي معلومات أكثر عن…");
      }
    };
    box.replaceChildren(
      h("div", { class: "spread" }, h("h3", { text: "هل ساعدك الدليل؟" }),
        rows.length ? h("span", { class: "muted small", text: `${yes} من ${rows.length} قالوا إنه ساعدهم` }) : h("span", { class: "muted small", text: "كن أول واحد بيقيّم" })),
      h("div", { class: "row" },
        h("button", { class: "chip", type: "button", "aria-pressed": String(mine?.helpful === true), onclick: () => vote(true), text: "إي، ساعدني" }),
        h("button", { class: "chip", type: "button", "aria-pressed": String(mine?.helpful === false), onclick: () => vote(false), text: "مش كثير" })));
  };
  draw();
  onLeave(subscribe("guide_feedback", { limit: 1000 }, (all) => { rows = all.filter((r) => r.guide === g.id); draw(); }));
}
function gdTransportWidget() {
  const town = h("input", { type: "text", id: "gd-town", maxlength: 40, value: lsGet("gd:town", ""), placeholder: "مثال: رهط" });
  const reg = h("select", { id: "gd-region" }, REGIONS.map((r) => opt(r, r, r === lsGet("gd:region", "الجنوب"))));
  const list = h("div", { class: "stack" });
  const draw = () => {
    lsSet("gd:town", town.value.trim()); lsSet("gd:region", reg.value);
    const insts = INST.filter((i) => i.r === reg.value);
    if (reg.value === "عن بُعد") { list.replaceChildren(h("p", { class: "muted", text: "الدراسة عن بُعد ما بدها سفر يومي. افحص بموقع المؤسسة وين أقرب مركز دراسة أو امتحانات." })); return; }
    list.replaceChildren(insts.length ? h("ul", { class: "gd-trip" }, insts.map((i) => {
      const u = "https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=" + encodeURIComponent(i.he) + (town.value.trim() ? "&origin=" + encodeURIComponent(town.value.trim()) : "");
      return h("li", null, h("span", { text: i.ar }), h("a", { class: "btn sm ghost", href: u, target: "_blank", rel: "noopener", text: "افتح الطريق" }));
    })) : empty("ما في مؤسسات بهالمنطقة بالقائمة", "اختار منطقة ثانية."));
  };
  town.addEventListener("change", draw); reg.addEventListener("change", draw);
  draw();
  return h("div", { class: "stack" },
    h("p", { class: "muted small", text: "اكتب بلدك واختار منطقة. الزر بيفتح خرائط Google بالمواصلات العامة، وهناك بتشوف الوقت الحقيقي وبتقدر تغيّر ساعة الوصول." }),
    h("div", { class: "form" }, h("label", { class: "field" }, h("span", { text: "بلدك" }), town), h("label", { class: "field" }, h("span", { text: "المنطقة" }), reg)),
    list);
}

// Standalone printable HTML for one or more guides (ideas 273 and «نزّل الدليل»).
function gdBookHtml(list, title, withSteps) {
  const body = list.map((g) => `<section class="g" id="g-${gdEsc(g.id)}"><p class="cat">${gdEsc(gdCatLabel(g.cat))}</p><h2>${gdEsc(g.title)}</h2><p class="lede">${gdEsc(g.lede)}</p>
<aside><b>الزبدة:</b> ${gdEsc(g.tip)}</aside>
${g.sections.map((s) => `<h3>${gdEsc(s.h)}</h3>${s.body.map((b) => typeof b === "string" ? `<p>${gdEsc(b)}</p>` : b.ul ? `<ul>${b.ul.map((x) => `<li>${gdEsc(x)}</li>`).join("")}</ul>` : `<p class="note">${gdEsc(b.note)}</p>`).join("")}`).join("\n")}
${withSteps ? `<h3>خطوات</h3><ul class="steps">${gdSteps(g).map((s) => `<li>${gdEsc(s.t)}</li>`).join("")}</ul>` : ""}
${g.links.length ? `<h3>روابط</h3><ul>${g.links.map(([t, u]) => `<li><a href="${gdEsc(u)}">${gdEsc(t)}</a></li>`).join("")}</ul>` : ""}</section>`).join("\n");
  const toc = list.length > 1 ? `<nav><h2>المحتوى</h2><ol>${list.map((g) => `<li><a href="#g-${gdEsc(g.id)}">${gdEsc(g.title)}</a></li>`).join("")}</ol></nav>` : "";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${gdEsc(title)}</title>
<style>body{margin:0;background:#EFECE3;color:#16171C;font:17px/1.75 "IBM Plex Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif}
main{max-width:68ch;margin:0 auto;padding:32px 18px 64px}h1,h2,h3{font-family:Alexandria,"Segoe UI",Tahoma,sans-serif;line-height:1.25}
h1{font-size:2.2em;margin:.2em 0}h2{font-size:1.6em;margin:.2em 0}h3{font-size:1.15em;margin:1.4em 0 .3em;color:#2B5FD9}
.cover{border-bottom:3px solid #2B5FD9;padding-bottom:12px;margin-bottom:24px}.cat{color:#2B5FD9;font-weight:700;margin:0}
.lede{font-size:1.1em}aside{background:#fff;border-inline-start:4px solid #2B5FD9;padding:10px 14px;margin:14px 0}
.note{color:#5D606D;font-size:.92em;border:1px dashed #DCD7CA;padding:8px 12px}.g{background:#fff;border:1px solid #DCD7CA;padding:20px;margin:0 0 24px;border-radius:6px;break-before:page}
nav{background:#fff;border:1px solid #DCD7CA;padding:16px 20px;margin-bottom:24px}.steps{list-style:none;padding:0}.steps li::before{content:"☐ ";color:#2B5FD9}
a{color:#2B5FD9}@media print{body{background:#fff}.g{border:0;padding:0}nav{break-after:page}}</style></head>
<body><main><header class="cover"><p class="cat">بوابة الخريجين</p><h1>${gdEsc(title)}</h1><p>معلومات عامة ومستقرة. التفاصيل اللي بتتغير كل سنة افحصها بالمصدر الرسمي.</p></header>${toc}${body}</main></body></html>`;
}

// ---------- search + home widget ----------
registerSearch("الأدلة", (q) => GUIDES.filter((g) => matches(gdText(g), q)).slice(0, 8)
  .map((g) => ({ title: g.title, sub: gdCatLabel(g.cat), go: "guides", onOpen: () => gdOpen(g.id) })));

// «مصطلح اليوم» (idea 276): rotates through DICT by local date.
function gdTermOfDay(offset = 0) {
  const d = new Date(); const day = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)) + offset;
  return DICT[((day % DICT.length) + DICT.length) % DICT.length];
}
registerHome(() => {
  const [he, tr, ar] = gdTermOfDay();
  return h("section", { class: "section" },
    h("div", { class: "gd-term card" },
      h("div", { class: "spread" }, h("h4", { text: "مصطلح اليوم" }), h("span", { class: "muted small", text: "بيتغيّر كل يوم" })),
      h("div", { class: "gd-term-word he", text: he }),
      h("div", { class: "muted", text: tr }),
      h("p", { class: "gd-term-mean", text: ar }),
      h("div", { class: "row" },
        h("button", { class: "link small", type: "button", onclick: () => { toolTab = "dict"; go("tools"); }, text: "كل القاموس" }),
        h("button", { class: "link small", type: "button", onclick: () => { ctCardState.src = "d:today"; go("gd-cards"); }, text: "اعمله بطاقة" }))));
}, 35);
