// ===== content: articles (267, 155), magazine (278), media shelf (268, 269), info cards (272), printable guide (273) =====
const CT_KINDS = ["تجربة شخصية", "نصيحة", "قصة منحة", "عن تخصص", "عن مؤسسة", "رأي"];
const CT_MEDIA = ["بودكاست", "فيديو قصير", "محاضرة أو ورشة"];
const ctData = { articles: [], featured: {} };
const ctState = { kind: "all", q: "", media: "all" };
const ctCardState = { src: "", theme: "light" };
const ctVisible = (col, r) => !isMod("hidden", col + ":" + r.id);

HOOKS.boot.push(() => {
  subscribe("articles", { limit: 300 }, (rows) => { ctData.articles = rows; resolveNames(rows.map((r) => r.uid)); ctDrawArticles(); ctDrawMagazine(); });
  subscribeDoc("config", "featured_articles", (d) => { ctData.featured = (d && d.map) || {}; ctDrawArticles(); ctDrawMagazine(); });
});
HOOKS.lists.push(() => { ctDrawArticles(); ctDrawMagazine(); });

// ---------- articles ----------
registerView("gd-articles", "guides", "مقالات الخريجين", () => {
  const f = h("form", { class: "card form" },
    h("label", { class: "field full" }, h("span", { text: "العنوان" }), h("input", { type: "text", id: "ct-title", required: true, maxlength: 120, placeholder: "مثال: شو تعلّمت بأول فصل تمريض" })),
    h("label", { class: "field" }, h("span", { text: "النوع" }), h("select", { id: "ct-kind" }, CT_KINDS.map((k) => opt(k)))),
    h("label", { class: "field" }, h("span", { text: "رابط إضافي (اختياري)" }), h("input", { type: "url", id: "ct-link", maxlength: 300, placeholder: "https://" })),
    h("label", { class: "field full" }, h("span", { text: "المقال" }), h("textarea", { id: "ct-body", required: true, maxlength: 8000, rows: 10, placeholder: "احكي من تجربتك: شو صار، شو تعلّمت، وشو نصيحتك لطالب بالثانوية. فقرات قصيرة أسهل للقراءة." })),
    h("p", { class: "full muted small", text: "لا تكتب أسماء ناس بدون إذنهم ولا معلومات شخصية. المقالات المختارة بتدخل المجلة السنوية." }),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر المقال" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const title = $("#ct-title").value.trim(), body = $("#ct-body").value.trim(); if (!title || !body) return;
    const raw = $("#ct-link").value.trim(), link = raw ? safeUrl(raw) : "";
    if (raw && !link) { toast("الرابط لازم يبلّش بـ https://"); return; }
    if (await addDoc("articles", { uid: S.uid, title, kind: $("#ct-kind").value, body, link, createdAt: Date.now() })) { f.reset(); f.closest("details").open = false; toast("انتشر المقال، شكرًا"); }
  });
  const v = h("div", { class: "view" },
    head("مدوّنة الخريجين", "مقالات من تجربة ناس مرقوا بالطريق", "خريجون بيكتبوا عن التخصص، المؤسسة، المنح، والسنة الأولى. اكتب إنت كمان: تجربتك ممكن توفّر على طالب سنة كاملة."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ اكتب مقال" }), f),
    h("div", { class: "form" }, h("label", { class: "field" }, h("span", { text: "بحث بالمقالات" }), h("input", { type: "search", id: "ct-q", value: ctState.q }))),
    h("div", { class: "chips", id: "ct-kinds" }, [["all", "الكل"], ["featured", "مختارة"], ...CT_KINDS.map((k) => [k, k])].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(ctState.kind === k),
      onclick: (e) => { ctState.kind = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); ctDrawArticles(); }, text: l }))),
    h("div", { class: "stack", id: "ct-list" }),
  );
  queueMicrotask(() => { const q = $("#ct-q"); q && q.addEventListener("input", (e) => { ctState.q = e.target.value; ctDrawArticles(); }); ctDrawArticles(); });
  return v;
}, { order: 20 });

async function ctToggleFeature(a) {
  const map = { ...ctData.featured };
  if (map[a.id]) delete map[a.id]; else map[a.id] = new Date(a.createdAt || Date.now()).getFullYear();
  if (await setDoc("config", "featured_articles", { map, updatedAt: Date.now() })) toast(map[a.id] ? "انضاف للمجلة" : "انشال من المجلة");
}
function ctArticleCard(a) {
  const feat = !!ctData.featured[a.id];
  const excerpt = a.body.length > 260 ? a.body.slice(0, 260) + "…" : a.body;
  return h("article", { class: "card item ct-article" },
    h("div", { class: "row" }, h("span", { class: "pill", text: a.kind }), feat ? h("span", { class: "pill good", text: "مختار للمجلة" }) : null),
    h("h3", { class: "ct-title", text: a.title }),
    h("p", { class: "muted", text: excerpt }),
    gdWho(a.uid, a.createdAt),
    h("div", { class: "row" },
      h("button", { class: "btn sm", type: "button", onclick: () => ctReadArticle(a), text: "اقرأ" }),
      S.isAdmin ? h("button", { class: "link small", type: "button", onclick: () => ctToggleFeature(a), text: feat ? "شيل من المجلة" : "اختار للمجلة" }) : null,
      gdReportBtn("articles", a.id), rowActions("articles", a)));
}
function ctReadArticle(a) {
  const link = safeUrl(a.link);
  modal(a.kind, h("article", { class: "stack ct-read" },
    h("h2", { text: a.title }), gdWho(a.uid, a.createdAt),
    h("div", { class: "gd-prose" }, a.body.split(/\n{2,}/).map((p) => h("p", { text: p }))),
    link ? h("a", { href: link, target: "_blank", rel: "noopener", text: "الرابط المرفق" }) : null,
    h("div", { class: "row" }, gdReportBtn("articles", a.id))));
}
function ctDrawArticles() {
  const box = $("#ct-list"); if (!box) return;
  const q = ctState.q.trim();
  const rows = ctData.articles.filter((a) => ctVisible("articles", a) && (ctState.kind === "all" || (ctState.kind === "featured" ? ctData.featured[a.id] : a.kind === ctState.kind)) && matches(a.title + " " + a.body, q));
  box.replaceChildren(...(rows.length ? rows.map(ctArticleCard) : [empty(ctData.articles.length ? "ما في مقالات هون" : "المدوّنة لسا فاضية", "اكتب أول مقال من زر «اكتب مقال»: تجربتك بالتخصص، بالمنحة، أو بالسنة الأولى.")]));
}
registerSearch("مقالات الخريجين", (q) => ctData.articles.filter((a) => ctVisible("articles", a) && matches(a.title + " " + a.body, q)).slice(0, 8)
  .map((a) => ({ title: a.title, sub: a.kind + " · " + nameOf(a.uid), go: "gd-articles", onOpen: () => ctReadArticle(a) })));

// ---------- yearly magazine ----------
registerView("gd-magazine", "guides", "المجلة السنوية", () => h("div", { class: "view" },
  head("مجلة الخريجين", "كل سنة بعدد", "المقالات اللي اختارتها الإدارة من مدوّنة الخريجين، مرتّبة حسب السنة. كل عدد بينزل كملف بتقدر تبعته للفوج."),
  h("div", { class: "stack", id: "ct-mag" })), { order: 25 });
function ctDrawMagazine() {
  const box = $("#ct-mag"); if (!box) return;
  const feat = ctData.articles.filter((a) => ctData.featured[a.id] && ctVisible("articles", a));
  if (!feat.length) { box.replaceChildren(empty("لسا ما في أعداد", S.isAdmin ? "افتح «مقالات الخريجين» واكبس «اختار للمجلة» على مقال." : "الإدارة بتختار مقالات من المدوّنة. اكتب مقال وممكن يدخل العدد الجاي."), h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", "data-go": "gd-articles", text: "للمدوّنة" }))); return; }
  const byYear = {};
  feat.forEach((a) => { const y = ctData.featured[a.id] || new Date(a.createdAt).getFullYear(); (byYear[y] ||= []).push(a); });
  box.replaceChildren(...Object.keys(byYear).sort((a, b) => b - a).map((y) => h("section", { class: "card ct-issue" },
    h("div", { class: "spread" }, h("div", null, h("p", { class: "eyebrow", text: "عدد" }), h("h2", { class: "num ct-year", text: y })),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => saveFile(`مجلة-الخريجين-${y}.html`, ctIssueHtml(y, byYear[y])), text: "نزّل العدد" })),
    h("ol", { class: "ct-toc" }, byYear[y].map((a) => h("li", null, h("button", { class: "link", type: "button", onclick: () => ctReadArticle(a), text: a.title }), h("span", { class: "muted small", text: a.kind + " · " + nameOf(a.uid) })))))));
}
function ctIssueHtml(y, list) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مجلة الخريجين ${y}</title>
<style>body{margin:0;background:#EFECE3;color:#16171C;font:17px/1.8 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif}main{max-width:66ch;margin:0 auto;padding:32px 18px}
h1,h2{font-family:Alexandria,"Segoe UI",Tahoma,sans-serif;line-height:1.2}h1{font-size:2.6em;border-bottom:4px solid #2B5FD9}article{background:#fff;border:1px solid #DCD7CA;padding:20px;margin:20px 0;break-before:page}
.by{color:#5D606D;font-size:.9em}.k{color:#2B5FD9;font-weight:700}</style></head><body><main><p class="k">بوابة الخريجين</p><h1>مجلة الخريجين ${y}</h1>
${list.map((a) => `<article><p class="k">${gdEsc(a.kind)}</p><h2>${gdEsc(a.title)}</h2><p class="by">${gdEsc(nameOf(a.uid))}</p>${a.body.split(/\n{2,}/).map((p) => `<p>${gdEsc(p)}</p>`).join("")}</article>`).join("")}</main></body></html>`;
}

// ---------- media shelf ----------
registerView("gd-media", "guides", "بودكاست وفيديو", () => {
  let rows = [];
  const list = h("div", { class: "grid", id: "ct-media-list" });
  const draw = () => {
    const shown = rows.filter((r) => ctVisible("media", r) && (ctState.media === "all" || r.kind === ctState.media));
    list.replaceChildren(...(shown.length ? shown.map((m) => {
      const u = safeUrl(m.url); let host = ""; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch {}
      return h("article", { class: "card item ct-media" },
        h("div", { class: "row" }, h("span", { class: "pill", text: m.kind }), host ? h("span", { class: "muted small", text: host }) : null),
        h("h3", { text: m.title }), m.note ? h("p", { class: "muted", text: m.note }) : null,
        gdWho(m.uid, m.createdAt),
        h("div", { class: "row" }, u ? h("a", { class: "btn sm blue", href: u, target: "_blank", rel: "noopener", text: m.kind === "بودكاست" ? "اسمع" : "شاهد" }) : null, gdReportBtn("media", m.id), rowActions("media", m)));
    }) : [empty("الرف فاضي", "شارك رابط حلقة بودكاست أو فيديو قصير بيشرح تخصص، جامعة، أو تجربة. خلّي الرابط من موقع معروف.")]));
  };
  const f = h("form", { class: "card form" },
    h("label", { class: "field" }, h("span", { text: "النوع" }), h("select", { id: "ct-m-kind" }, CT_MEDIA.map((k) => opt(k)))),
    h("label", { class: "field" }, h("span", { text: "العنوان" }), h("input", { type: "text", id: "ct-m-title", required: true, maxlength: 120 })),
    h("label", { class: "field full" }, h("span", { text: "الرابط" }), h("input", { type: "url", id: "ct-m-url", required: true, maxlength: 400, placeholder: "https://" })),
    h("label", { class: "field full" }, h("span", { text: "عن شو؟ (اختياري)" }), h("input", { type: "text", id: "ct-m-note", maxlength: 200, placeholder: "مثال: خريجة بتحكي عن أول سنة هندسة" })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف للرف" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const url = safeUrl($("#ct-m-url").value); if (!url) { toast("الرابط لازم يبلّش بـ https://"); return; }
    if (await addDoc("media", { uid: S.uid, kind: $("#ct-m-kind").value, title: $("#ct-m-title").value.trim(), url, note: $("#ct-m-note").value.trim(), createdAt: Date.now() })) { f.reset(); toast("انضاف للرف"); }
  });
  onLeave(subscribe("media", { limit: 200 }, (r) => { rows = r; resolveNames(r.map((x) => x.uid)); draw(); }));
  return h("div", { class: "view" },
    head("رف الوسائط", "بودكاست وفيديوهات قصيرة", "حلقات وفيديوهات بيشاركها الأعضاء عن الجامعات والتخصصات والتجارب. المنصة بتعرض الرابط بس، والمحتوى على موقعه الأصلي."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ شارك رابط" }), f),
    h("div", { class: "chips" }, [["all", "الكل"], ...CT_MEDIA.map((k) => [k, k])].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(ctState.media === k),
      onclick: (e) => { ctState.media = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); draw(); }, text: l }))),
    list);
}, { order: 30 });

// ---------- info cards (SVG 1080×1350) ----------
let ctMeasure = null;
function ctWrap(text, px, weight, maxW, maxLines) {
  ctMeasure ||= document.createElement("canvas").getContext("2d");
  ctMeasure.font = `${weight} ${px}px Tahoma, "Segoe UI", Arial, sans-serif`;
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctMeasure.measureText(t).width * 1.05 > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += " …"; }
  return lines;
}
function ctCardData(src) {
  const [kind, id] = (src || "").split(":");
  if (kind === "i") { const i = INST[+id]; if (i) { const majors = Object.values(i.majors).flat().slice(0, 6).join("، "); return { label: TYPES[i.t], title: i.ar, body: i.about, extra: majors ? "تخصصات: " + majors : "", foot: i.he, name: "مؤسسة" }; } }
  if (kind === "d") { const [he, tr, ar] = id === "today" ? gdTermOfDay() : DICT[+id] || DICT[0]; return { label: "مصطلح من قاموس الجامعة", title: he, body: ar, extra: "بتنلفظ: " + tr, foot: "قاموس الجامعة", name: "مصطلح" }; }
  const g = GD_BY_ID[id] || GUIDES[0];
  return { label: gdCatLabel(g.cat), title: g.title, body: g.tip, extra: "", foot: "من دليل «" + g.title + "»", name: "نصيحة" };
}
function ctCardSvg(d, dark) {
  const c = dark ? { bg: "#111319", grid: "rgba(130,160,255,0.08)", card: "#1A1D25", ink: "#ECEDF2", muted: "#9DA1AE", accent: "#7AA2FF", on: "#0C1224", line: "#2B2F3A" }
    : { bg: "#EFECE3", grid: "rgba(46,76,150,0.09)", card: "#FFFFFF", ink: "#16171C", muted: "#5D606D", accent: "#2B5FD9", on: "#FFFFFF", line: "#DCD7CA" };
  const disp = `Alexandria, 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif`;
  const R = 980; // right text edge
  const tl = ctWrap(d.title, 84, 900, 860, 4), bl = ctWrap(d.body, 46, 500, 860, 8), el = d.extra ? ctWrap(d.extra, 34, 500, 860, 3) : [];
  let y = 360;
  const txt = (lines, size, weight, color, lh, font) => lines.map((l) => { y += lh; return `<text x="${R}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="${font}" direction="rtl" text-anchor="start">${gdEsc(l)}</text>`; }).join("");
  const titleSvg = txt(tl, 84, 900, c.ink, 100, disp); y += 40;
  const bar = `<rect x="${R - 120}" y="${y - 10}" width="120" height="10" fill="${c.accent}"/>`; y += 30;
  const bodySvg = txt(bl, 46, 500, c.ink, 70, disp); y += 20;
  const extraSvg = txt(el, 34, 500, c.muted, 50, disp);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<defs><pattern id="g" width="54" height="54" patternUnits="userSpaceOnUse"><path d="M54 0H0V54" fill="none" stroke="${c.grid}" stroke-width="2"/></pattern></defs>
<rect width="1080" height="1350" fill="${c.bg}"/><rect width="1080" height="1350" fill="url(#g)"/>
<rect x="60" y="150" width="960" height="1040" rx="14" fill="${c.card}" stroke="${c.line}" stroke-width="2"/>
<rect x="60" y="150" width="960" height="16" rx="8" fill="${c.accent}"/>
<circle cx="${R - 30}" cy="80" r="34" fill="${c.accent}"/><text x="${R - 30}" y="94" fill="${c.on}" font-size="38" font-weight="900" font-family="${disp}" text-anchor="middle">خ</text>
<text x="${R - 82}" y="94" fill="${c.ink}" font-size="38" font-weight="800" font-family="${disp}" direction="rtl" text-anchor="start">بوابة الخريجين</text>
<text x="${R}" y="270" fill="${c.accent}" font-size="38" font-weight="800" font-family="${disp}" direction="rtl" text-anchor="start">${gdEsc(d.label)}</text>
<rect x="100" y="300" width="${R - 100}" height="4" fill="${c.accent}"/>
${titleSvg}${bar}${bodySvg}${extraSvg}
<text x="${R}" y="1140" fill="${c.muted}" font-size="32" font-weight="600" font-family="${disp}" direction="rtl" text-anchor="start">${gdEsc(d.foot)}</text>
<text x="540" y="1275" fill="${c.muted}" font-size="30" font-weight="600" font-family="${disp}" text-anchor="middle" direction="rtl">من الثانوية للجامعة، ومعك كل الأفواج</text>
</svg>`;
}
const ctSvgUrl = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
async function ctSavePng(svg, name) {
  try {
    const img = new Image(); img.src = ctSvgUrl(svg); await img.decode();
    const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1350;
    cv.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    if (!blob) throw new Error("png");
    await saveFile(name + ".png", blob);
  } catch (e) { console.warn(e); toast("ما زبط PNG هون، نزّل SVG بدلًا منه"); }
}

registerView("gd-cards", "guides", "بطاقات وتنزيل", () => {
  if (!ctCardState.src) ctCardState.src = "g:" + GUIDES[0].id;
  const sel = h("select", { id: "ct-card-src" },
    h("optgroup", { label: "نصيحة من دليل" }, GUIDES.map((g) => opt("g:" + g.id, g.title, ctCardState.src === "g:" + g.id))),
    h("optgroup", { label: "مؤسسة" }, INST.map((i, n) => opt("i:" + n, i.ar, ctCardState.src === "i:" + n))),
    h("optgroup", { label: "مصطلح" }, opt("d:today", "مصطلح اليوم", ctCardState.src === "d:today"), DICT.map((d, n) => opt("d:" + n, d[0] + " – " + d[2], ctCardState.src === "d:" + n))));
  const img = h("img", { class: "ct-card-img", alt: "معاينة البطاقة", width: 1080, height: 1350 });
  let svg = "";
  const draw = () => { ctCardState.src = sel.value; svg = ctCardSvg(ctCardData(sel.value), ctCardState.theme === "dark"); img.src = ctSvgUrl(svg); };
  sel.addEventListener("change", draw);
  const fileName = () => "بطاقة-" + ctCardData(sel.value).name + "-" + sel.value.replace(":", "-");
  // printable guide (273)
  const defaults = ["first-year", "hebrew", "dean", "arab-support", "housing", "rights", "sch-apply", "digital"];
  const picks = h("div", { class: "ct-picks" }, GUIDES.map((g) => h("label", { class: "check" }, h("input", { type: "checkbox", id: "ct-pick-" + g.id, value: g.id, checked: defaults.includes(g.id) ? true : null }), g.title)));
  const bookTitle = h("input", { type: "text", id: "ct-book-title", maxlength: 80, value: "دليل الطالب الجديد" });
  const withSteps = h("input", { type: "checkbox", id: "ct-book-steps", checked: true });
  const v = h("div", { class: "view" },
    head("بطاقات وتنزيل", "شارك المعلومة، أو نزّلها كدليل", "اعمل بطاقة جاهزة للإنستغرام والستوري من نصيحة، مؤسسة أو مصطلح. أو جمّع أدلة بملف واحد بتقدر تطبعه أو تبعته للطلاب الجدد."),
    h("section", { class: "section" },
      h("h2", { text: "بطاقة معلومات" }),
      h("div", { class: "ct-card-wrap" },
        h("div", { class: "stack" },
          h("label", { class: "field" }, h("span", { text: "من وين المعلومة؟" }), sel),
          h("div", { class: "chips" }, [["light", "فاتح"], ["dark", "غامق"]].map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(ctCardState.theme === k),
            onclick: (e) => { ctCardState.theme = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); draw(); }, text: l }))),
          h("p", { class: "muted small", text: "المقاس 1080×1350، مناسب لمنشور إنستغرام. الخط بالملف بيتبدّل بخط الجهاز إذا Alexandria مش موجود." }),
          h("div", { class: "row" },
            h("button", { class: "btn blue sm", type: "button", onclick: () => saveFile(fileName() + ".svg", svg), text: "نزّل SVG" }),
            h("button", { class: "btn sm ghost", type: "button", onclick: () => ctSavePng(svg, fileName()), text: "نزّل PNG" }))),
        h("div", { class: "ct-card-preview" }, img))),
    h("section", { class: "section" },
      h("h2", { text: "دليل مطبوع للطلاب الجدد" }),
      h("div", { class: "card stack" },
        h("label", { class: "field" }, h("span", { text: "عنوان الملف" }), bookTitle),
        h("div", { class: "spread" }, h("h4", { text: "اختار الأدلة" }),
          h("div", { class: "row" },
            h("button", { class: "link small", type: "button", onclick: () => picks.querySelectorAll("input").forEach((c) => (c.checked = true)), text: "الكل" }),
            h("button", { class: "link small", type: "button", onclick: () => picks.querySelectorAll("input").forEach((c) => (c.checked = false)), text: "ولا واحد" }))),
        picks,
        h("label", { class: "check" }, withSteps, "ضيف قوائم الخطوات"),
        h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: () => {
          const list = [...picks.querySelectorAll("input:checked")].map((c) => GD_BY_ID[c.value]);
          if (!list.length) { toast("اختار دليل واحد على الأقل"); return; }
          saveFile((bookTitle.value.trim() || "دليل") .replace(/\s+/g, "-") + ".html", gdBookHtml(list, bookTitle.value.trim() || "دليل الطالب الجديد", withSteps.checked));
        }, text: "نزّل الدليل (HTML)" }), h("span", { class: "muted small", text: "افتح الملف بالمتصفح واطبعه أو احفظه PDF." })))),
  );
  queueMicrotask(draw);
  return v;
}, { order: 40 });
