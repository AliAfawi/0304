// ===== platform team: admin section (editors only) + public announcements =====

async function adModSet(key, id, value) {
  const map = { ...(S.mod[key] || {}) };
  if (value) map[id] = value; else delete map[id];
  return setDoc("mod", key, { map, updatedAt: Date.now() });
}
function adToggleBtn(on, onLabel, offLabel, fn) {
  return h("button", { class: "btn sm " + (on ? "blue" : "ghost"), type: "button", "aria-pressed": String(!!on), onclick: fn, text: on ? onLabel : offLabel });
}
function adHead(title, lede) { return head("الإدارة", title, lede); }
function adWeekStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); }
const adCols = { posts: "منشور", replies: "رد", materials: "مادة", tutors: "درس/طلب", alumni: "ملف", thanks: "شكر", stories: "قصة", polls: "استطلاع", photos: "صورة",
  contests: "مسابقة", studygroups: "مجموعة دراسة", decks: "بطاقات حفظ", vocab: "مفردات", psyq: "سؤال بسيخومتري", qotd: "سؤال اليوم", challenges: "تحدّي", chsubs: "حل تحدّي",
  tutorreviews: "تقييم درس", books: "كتاب", clubs: "نادي", sciprojects: "مشروع علمي", jobs: "وظيفة", businesses: "مصلحة", freelancers: "مستقل", careerstories: "قصة مهنية",
  startups: "مشروع ناشئ", incubator: "حاضنة", events: "فعالية", reviews: "مراجعة", deadlines: "موعد", guides: "دليل", articles: "مقال", media: "ميديا", exchange: "تبادل",
  pledges: "تعهّد", scholarship_suggestions: "اقتراح منحة" };
const adColLabel = (col) => adCols[col] || adCols[String(col).split("/").pop()] || "محتوى";
const adPeek = {};
function adFind(target) {
  const t = String(target || ""); const i = t.lastIndexOf(":");
  const col = i > 0 ? t.slice(0, i) : t, id = i > 0 ? t.slice(i + 1) : "";
  const list = { posts: S.posts, materials: S.materials, tutors: S.tutors, thanks: PL.thanks }[col];
  if (col === "alumni") return { col, id, row: S.alumni[id] || null };
  if (list) return { col, id, row: list.find((r) => r.id === id) || null };
  if (!(t in adPeek) && id && /^[\w/-]+$/.test(col)) { adPeek[t] = null; getDoc(col, id).then((r) => { adPeek[t] = r; if (r) renderLists(); }); }
  return { col, id, row: adPeek[t] || null };
}
const adRowText = (col, r) => !r ? "" : col === "materials" ? r.title : col === "tutors" ? `${r.subject} — ${r.note || ""}` : col === "alumni" ? r.name : r.title || r.name || r.text || r.question || r.note || "";

// ---------- 195 dashboard + 205 monthly report ----------
function adBars(rows, label) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return h("div", { class: "ad-bars", role: "list", "aria-label": label }, rows.map(([k, v]) =>
    h("div", { class: "ad-bar-row", role: "listitem", title: `${k}: ${v}` }, h("span", { class: "ad-bar-k", text: k }),
      h("span", { class: "ad-bar-track" }, h("i", { style: `width:${Math.max(2, (v / max) * 100)}%` })), h("span", { class: "ad-bar-v num", text: fmt(v) }))));
}
function adWeekChart(counts) {
  const W = 320, H = 150, pad = 22, bw = (W - pad) / counts.length;
  const max = Math.max(1, ...counts.map((c) => c.n));
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H + 24}`, class: "ad-chart", role: "img", "aria-label": "منشورات بكل أسبوع، آخر 8 أسابيع" },
    svgEl("line", { x1: 0, x2: W, y1: H, y2: H, class: "ad-axis" }),
    ...counts.map((c, i) => {
      const bh = (c.n / max) * (H - 24); const x = W - (i + 1) * bw + 4;
      return svgEl("g", null,
        svgEl("rect", { x, y: H - Math.max(bh, c.n ? 3 : 0), width: bw - 8, height: Math.max(bh, c.n ? 3 : 0), rx: 3, class: "ad-col" }, svgEl("title", null, `${c.label}: ${c.n}`)),
        c.n ? svgEl("text", { x: x + (bw - 8) / 2, y: H - bh - 6, "text-anchor": "middle", class: "ad-val" }, String(c.n)) : null,
        svgEl("text", { x: x + (bw - 8) / 2, y: H + 16, "text-anchor": "middle", class: "ad-lbl" }, c.short));
    }));
  return svg;
}
registerView("ad-dash", "admin", "لوحة التحكم", () => {
  const v = h("div", { class: "view" },
    adHead("لوحة التحكم", "أرقام حقيقية من المنصة، بتتحدّث لحالها. للإدارة بس."),
    h("section", { class: "ad-tiles", id: "ad-tiles" }),
    h("section", { class: "grid" },
      h("div", { class: "card stack" }, h("h3", { text: "الخريجين حسب الفوج" }), h("div", { id: "ad-cohort-chart" })),
      h("div", { class: "card stack" }, h("h3", { text: "منشورات بكل أسبوع" }), h("div", { id: "ad-week-chart" }))),
    h("section", { class: "section" },
      h("h2", { text: "تقرير شهري" }),
      h("div", { class: "form" }, h("label", { class: "field" }, h("span", { text: "الشهر" }),
        h("select", { id: "ad-month", onchange: renderLists }, Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return opt(d.getFullYear() + "-" + d.getMonth(), plMonthName(d.getTime()), i === 0); })))),
      h("div", { id: "ad-month-report" })),
    h("section", { class: "section" }, h("h2", { text: "روابط سريعة" }),
      h("div", { class: "tool-cards" },
        h("button", { class: "tool-card", type: "button", "data-go": "ad-queue" }, h("b", { text: "البلاغات" }), h("span", { id: "ad-q-count", text: "محتوى بحاجة لمراجعة" })),
        h("button", { class: "tool-card", type: "button", "data-go": "ad-ann" }, h("b", { text: "إعلان جديد" }), h("span", { text: "رسالة لكل الأعضاء بالرئيسية والإشعارات." })),
        h("button", { class: "tool-card", type: "button", "data-go": "events" }, h("b", { text: "إدارة الفعاليات" }), h("span", { text: "الفعاليات والتسجيل عند فريق الفعاليات." })))));
  return v;
}, { order: 0, admin: true });
function adMonthReport(y, m) {
  const a = new Date(y, m, 1).getTime(), b = new Date(y, m + 1, 1).getTime();
  const inM = (r) => (r.createdAt || 0) >= a && (r.createdAt || 0) < b;
  const al = Object.values(S.alumni).filter(inM);
  const rows = [
    ["أعضاء جدد بالدليل", al.length], ["منشورات", S.posts.filter(inM).length], ["مواد وامتحانات", S.materials.filter(inM).length],
    ["عروض دروس", S.tutors.filter((t) => t.type === "offer" && inM(t)).length], ["طلبات مساعدة", S.tutors.filter((t) => t.type !== "offer" && inM(t)).length],
    ["رسائل شكر", PL.thanks.filter(inM).length], ["إعلانات", PL.ann.filter(inM).length],
  ];
  const top = ptCohorts(a).filter((c) => c.points > 0)[0];
  return { rows, top, title: plMonthName(a) };
}
HOOKS.lists.push(() => {
  const t = $("#ad-tiles"); if (!t) return;
  const al = Object.values(S.alumni);
  const years = new Set(al.map((a) => a.year));
  const tiles = [["أعضاء بالدليل", al.length], ["فوج", years.size], ["متاحين للمساعدة", al.filter((a) => a.mentor).length], ["موثّقين", Object.keys(S.mod.verified || {}).length],
    ["منشورات", S.posts.length], ["مواد", S.materials.length], ["دروس وطلبات", S.tutors.length], ["رسائل شكر", PL.thanks.length]];
  t.replaceChildren(...tiles.map(([l, n]) => h("div", { class: "stat" }, h("b", { text: fmt(n) }), h("span", { text: l }))));
  const byYear = {}; al.forEach((a) => (byYear[a.year] = (byYear[a.year] || 0) + 1));
  const yrs = Object.entries(byYear).sort((a, b) => b[0] - a[0]).slice(0, 14).map(([y, n]) => [`فوج ${y}`, n]);
  $("#ad-cohort-chart").replaceChildren(yrs.length ? adBars(yrs, "الخريجين حسب الفوج") : empty("الدليل فاضي", "لما ينضم خريجين بيبيّن التوزيع هون."));
  const now = adWeekStart(Date.now()); const weeks = [];
  for (let i = 0; i < 8; i++) { const s = now - i * 7 * 864e5; const d = new Date(s); weeks.push({ s, e: s + 7 * 864e5, n: 0, label: `أسبوع ${d.getDate()}/${d.getMonth() + 1}`, short: `${d.getDate()}/${d.getMonth() + 1}` }); }
  S.posts.forEach((p) => { const w = weeks.find((w) => p.createdAt >= w.s && p.createdAt < w.e); if (w) w.n++; });
  $("#ad-week-chart").replaceChildren(weeks.some((w) => w.n) ? adWeekChart(weeks) : empty("ما في منشورات بآخر 8 أسابيع", "لما يبلّش النشاط بالمجتمع بيبيّن الرسم هون."));
  const sel = $("#ad-month"); const box = $("#ad-month-report");
  if (sel && box) {
    const [y, m] = sel.value.split("-").map(Number); const r = adMonthReport(y, m);
    const text = [`تقرير نشاط بوابة الخريجين – ${r.title}`, ...r.rows.map(([l, n]) => `${l}: ${n}`), r.top ? `الفوج الأنشط: ${r.top.year}` : ""].filter(Boolean).join("\n");
    box.replaceChildren(h("div", { class: "card stack" },
      h("div", { class: "table-wrap" }, h("table", null, h("tbody", null, r.rows.map(([l, n]) => h("tr", null, h("td", { text: l }), h("td", { class: "num", text: fmt(n) })))))),
      r.top ? h("p", { class: "small" }, "الفوج الأنشط بهالشهر: ", h("b", { text: `فوج ${r.top.year}` })) : null,
      h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", onclick: () => plCopy(text, "انسخ التقرير"), text: "انسخ التقرير" }),
        h("button", { class: "btn sm ghost", type: "button", onclick: () => saveFile(`تقرير-${y}-${m + 1}.txt`, text), text: "نزّله كملف" }))));
  }
});

// ---------- 197 reports queue ----------
let adReports = [];
registerView("ad-queue", "admin", "البلاغات", () => {
  const v = h("div", { class: "view" },
    adHead("البلاغات", "محتوى بلّغ عنه الأعضاء. «إخفاء» بيشيله من القوائم عند الكل بدون ما ينحذف، و«تجاهل» بيمسح البلاغ."),
    h("div", { class: "stack", id: "ad-report-list" }),
    h("section", { class: "section" }, h("h2", { text: "محتوى مخفي" }), h("div", { class: "stack", id: "ad-hidden-list" })));
  onLeave(subscribe("reports", { limit: 300 }, (rows) => { adReports = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); }));
  return v;
}, { order: 10, admin: true });
HOOKS.lists.push(() => {
  const el = $("#ad-report-list"); if (!el) return;
  const groups = {};
  adReports.forEach((r) => (groups[r.target] ||= []).push(r));
  const list = Object.entries(groups).filter(([t]) => !isMod("hidden", t));
  el.replaceChildren(...(list.length ? list.map(([target, reps]) => {
    const f = adFind(target);
    return h("article", { class: "card item" },
      h("div", { class: "row" }, h("span", { class: "pill warn", text: `${reps.length} بلاغ` }), h("span", { class: "pill grey", text: adColLabel(f.col) }),
        f.row ? h("span", { class: "muted small", text: `من ${nameOf(f.row.uid)}` }) : h("span", { class: "muted small", text: "المحتوى مش محمّل هون أو انحذف" })),
      f.row ? h("p", { class: "me-clip", text: adRowText(f.col, f.row) }) : h("p", { class: "muted small", text: target }),
      h("ul", { class: "req" }, reps.slice(0, 5).map((r) => h("li", null, h("b", { text: nameOf(r.uid) }), ": ", r.reason || "بدون سبب", h("span", { class: "muted small", text: ` · ${rel(r.createdAt)}` })))),
      h("div", { class: "row" },
        h("button", { class: "btn sm blue", type: "button", onclick: async () => { if (await adModSet("hidden", target, true)) { for (const r of reps) await delDoc("reports", r.id); toast("انخفى المحتوى"); } }, text: "إخفاء المحتوى" }),
        h("button", { class: "btn sm ghost", type: "button", onclick: async () => { for (const r of reps) await delDoc("reports", r.id); toast("انتجاهل البلاغ"); }, text: "تجاهل" }),
        f.row && f.col !== "alumni" ? h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تحذف المحتوى نهائيًا؟", async () => { await delDoc(f.col, f.id); for (const r of reps) await delDoc("reports", r.id); }), text: "حذف نهائي" }) : null));
  }) : [empty("ما في بلاغات مفتوحة", "لما حدا يبلّغ عن منشور أو مادة، بيظهر البلاغ هون.")]));
  const hl = $("#ad-hidden-list");
  if (hl) {
    const keys = Object.keys(S.mod.hidden || {});
    hl.replaceChildren(...(keys.length ? keys.map((k) => { const f = adFind(k); return h("div", { class: "plain spread" },
      h("span", { class: "me-clip small", text: f.row ? `${adColLabel(f.col)}: ${adRowText(f.col, f.row)}` : k }),
      h("button", { class: "btn sm ghost", type: "button", onclick: () => adModSet("hidden", k, null).then((ok) => ok && toast("رجع يظهر")), text: "إظهار" })); })
      : [h("p", { class: "muted small", text: "ما في محتوى مخفي." })]));
  }
});

// ---------- 198 pinned posts ----------
registerView("ad-pin", "admin", "تثبيت المنشورات", () => h("div", { class: "view" },
  adHead("تثبيت المنشورات", "المنشور المثبّت بيطلع أول بالنقاشات. ثبّت المهم بس (موعد تسجيل، قوانين، فرصة كبيرة)."),
  h("div", { class: "stack", id: "ad-pin-list" })), { order: 20, admin: true });
HOOKS.lists.push(() => {
  const el = $("#ad-pin-list"); if (!el) return;
  const rows = S.posts.slice().sort((a, b) => (isMod("pinned", b.id) ? 1 : 0) - (isMod("pinned", a.id) ? 1 : 0)).slice(0, 60);
  el.replaceChildren(...(rows.length ? rows.map((p) => h("article", { class: "plain item" },
    h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(p.uid) }), h("span", { class: "pill", text: p.cat || "منشور" }), h("span", { text: rel(p.createdAt) }), isMod("hidden", "posts:" + p.id) ? h("span", { class: "pill warn", text: "مخفي" }) : null),
    h("p", { class: "me-clip", text: p.text }),
    h("div", null, adToggleBtn(isMod("pinned", p.id), "مثبّت · إلغاء", "ثبّت", () => adModSet("pinned", p.id, isMod("pinned", p.id) ? null : true)))))
    : [empty("ما في منشورات", "لما ينشر الأعضاء بالمجتمع بتقدر تثبّت المهم من هون.")]));
});

// ---------- 13/246 verify, 196 moderators, 201 cohorts, 200 CSV ----------
let adMemQ = "", adMemTab = "verify";
registerView("ad-members", "admin", "الأعضاء والأفواج", () => {
  const tabs = [["verify", "التوثيق"], ["tutors", "توثيق المعلّمين"], ["mods", "مشرفين الأفواج"], ["cohorts", "الأفواج"]];
  const v = h("div", { class: "view" },
    adHead("الأعضاء والأفواج", "وثّق الخريجين والمعلّمين بعد ما تتأكد منهم، وعيّن مشرف/ة لكل فوج."),
    h("div", { class: "chips" }, tabs.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(adMemTab === k), onclick: () => { adMemTab = k; go("ad-members"); }, text: l }))),
    adMemTab === "verify" || adMemTab === "tutors" ? h("label", { class: "field" }, h("span", { text: "بحث بالاسم أو الفوج" }), h("input", { type: "search", id: "ad-mem-q", value: adMemQ, oninput: (e) => { adMemQ = e.target.value; renderLists(); } })) : null,
    h("div", { id: "ad-mem-body" }),
    h("div", { class: "row" }, h("button", { class: "btn ghost", type: "button", onclick: adExportCsv, text: "صدّر قائمة الخريجين (CSV)" })));
  return v;
}, { order: 30, admin: true });
function adMemberRow(a, extra) {
  const u = a.uid || a.id;
  return h("div", { class: "plain ad-mem" }, avatar(a.name, u),
    h("span", { class: "ad-mem-t" }, h("b", { text: a.name }), h("span", { class: "muted small", text: [`فوج ${a.year}`, a.field, a.place].filter(Boolean).join(" · ") })),
    extra);
}
HOOKS.lists.push(() => {
  const el = $("#ad-mem-body"); if (!el) return;
  const all = Object.values(S.alumni).sort((a, b) => b.year - a.year || (a.name || "").localeCompare(b.name || "", "ar"));
  const q = adMemQ.trim();
  if (adMemTab === "verify") {
    const rows = all.filter((a) => matches(`${a.name} ${a.year} ${a.place} ${a.field}`, q));
    el.replaceChildren(h("p", { class: "muted small", text: "«موثّق» يعني إنك تأكدت إنه فعلًا خريج/ة من المدرسة (بتعرفه، أو أكّد معلّم). الشارة بتظهر جنب اسمه بكل المنصة." }),
      h("div", { class: "stack" }, rows.length ? rows.map((a) => adMemberRow(a, adToggleBtn(isMod("verified", a.uid || a.id), "موثّق · إلغاء", "وثّق", () => adModSet("verified", a.uid || a.id, isMod("verified", a.uid || a.id) ? null : true)))) : empty("ما في أعضاء", "لما ينضم خريجين للدليل بيظهروا هون.")));
  } else if (adMemTab === "tutors") {
    const ids = [...new Set(S.tutors.filter((t) => t.type === "offer").map((t) => t.uid))];
    resolveNames(ids);
    const rows = ids.filter((u) => matches(`${nameOf(u)} ${S.alumni[u]?.year || ""}`, q));
    el.replaceChildren(h("p", { class: "muted small", text: "قبل ما توثّق معلّم/ة خصوصي: تأكد من هويته وإنه فعلًا بيعرف الموضوع. التوثيق ما بيعني إن المنصة مسؤولة عن الدرس." }),
      h("div", { class: "stack" }, rows.length ? rows.map((u) => adMemberRow(S.alumni[u] || { uid: u, name: nameOf(u), year: "؟" },
        h("span", { class: "row" }, h("span", { class: "muted small", text: `${S.tutors.filter((t) => t.uid === u && t.type === "offer").length} عرض` }), adToggleBtn(isMod("verified", u), "موثّق · إلغاء", "وثّق", () => adModSet("verified", u, isMod("verified", u) ? null : true)))))
        : empty("ما في عروض دروس", "لما حدا يعرض درس بيظهر هون للتوثيق.")));
  } else if (adMemTab === "mods") {
    const years = [...new Set(all.map((a) => a.year))].sort((a, b) => b - a);
    const roles = S.mod.roles || {};
    el.replaceChildren(h("p", { class: "muted small", text: "مشرف/ة الفوج بيظهر بشارة، وهو حلقة الوصل بين الإدارة وفوجه. صلاحية الحذف الفعلية بتيجي من مشاركة المنصة كـ «محرّر» (Editor)." }),
      years.length ? h("div", { class: "grid" }, years.map((y) => {
        const members = all.filter((a) => a.year === y);
        const mods = members.filter((a) => roles[a.uid || a.id]);
        const sel = h("select", { id: `ad-mod-${y}`, "aria-label": `اختار مشرف لفوج ${y}` }, opt("", "اختار عضو"), members.filter((a) => !roles[a.uid || a.id]).map((a) => opt(a.uid || a.id, a.name)));
        return h("div", { class: "card stack" }, h("h3", { text: `فوج ${y}` }),
          mods.length ? mods.map((a) => h("div", { class: "spread" }, h("span", { class: "who", text: a.name }), h("button", { class: "link danger small", type: "button", onclick: () => adModSet("roles", a.uid || a.id, null), text: "شيل" }))) : h("p", { class: "muted small", text: "ما في مشرف لسا." }),
          h("div", { class: "row" }, sel, h("button", { class: "btn sm", type: "button", onclick: () => sel.value && adModSet("roles", sel.value, "moderator").then((ok) => ok && toast("انعيّن")), text: "عيّن" })));
      })) : empty("ما في أفواج لسا", "الأفواج بتنبني من ملفات الخريجين."));
  } else {
    const years = {};
    all.forEach((a) => { const r = (years[a.year] ||= { n: 0, mentors: 0, verified: 0, last: 0 }); r.n++; if (a.mentor) r.mentors++; if (isMod("verified", a.uid || a.id)) r.verified++; r.last = Math.max(r.last, a.createdAt || 0); });
    const rows = Object.entries(years).sort((a, b) => b[0] - a[0]);
    el.replaceChildren(rows.length ? h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, ["الفوج", "أعضاء", "متاحين", "موثّقين", "آخر انضمام"].map((x) => h("th", { text: x })))),
      h("tbody", null, rows.map(([y, r]) => h("tr", null, h("td", { class: "num", text: y }), h("td", { class: "num", text: fmt(r.n) }), h("td", { class: "num", text: fmt(r.mentors) }), h("td", { class: "num", text: fmt(r.verified) }), h("td", { class: "small", text: rel(r.last) }))))))
      : empty("ما في أفواج لسا", "كل خريج بينضم للدليل بيضيف فوجه هون تلقائيًا."));
  }
});
const adCsvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function adExportCsv() {
  const rows = Object.values(S.alumni);
  if (!rows.length) { toast("الدليل فاضي"); return; }
  const cols = [["name", "الاسم"], ["year", "الفوج"], ["status", "الوضع"], ["place", "المكان"], ["field", "التخصص"], ["city", "البلد"], ["contact", "التواصل"], ["mentor", "متاح للمساعدة"]];
  const lines = [[...cols.map((c) => c[1]), "موثّق", "تاريخ الانضمام"].map(adCsvCell).join(",")];
  rows.forEach((a) => lines.push([...cols.map(([k]) => k === "mentor" ? (a.mentor ? "نعم" : "لا") : a[k]), isMod("verified", a.uid || a.id) ? "نعم" : "لا", a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : ""].map(adCsvCell).join(",")));
  saveFile("خريجين.csv", new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })).then((ok) => ok && toast("انحفظ الملف"));
}

// ---------- 199 announcements (+ 20 read-only channel for everyone) ----------
registerView("ad-ann", "admin", "الإعلانات", () => {
  const f = h("form", { class: "card form" },
    h("label", { class: "field full" }, h("span", { text: "العنوان" }), h("input", { type: "text", id: "ad-ann-title", required: true, maxlength: 100 })),
    h("label", { class: "field full" }, h("span", { text: "نص الإعلان" }), h("textarea", { id: "ad-ann-text", maxlength: 1500 })),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "انشر لكل الأعضاء" }), h("span", { class: "muted small", text: "بيظهر بالرئيسية، بقناة الإعلانات، وبإشعارات كل عضو." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#ad-ann-title").value.trim(); if (!title) return;
    if (await addDoc("announcements", { uid: S.uid, title, text: $("#ad-ann-text").value.trim(), createdAt: Date.now() })) { f.reset(); toast("انتشر الإعلان"); }
  });
  return h("div", { class: "view" }, adHead("الإعلانات", "إعلان رسمي من الإدارة: مواعيد تسجيل، فعاليات، تغييرات بالمنصة."), f, h("div", { class: "stack", id: "ad-ann-list" }));
}, { order: 40, admin: true });
function plAnnCard(a, admin) {
  return h("article", { class: "card item pl-ann" },
    h("div", { class: "meta" }, h("span", { class: "pill warn", text: "إعلان" }), h("span", { text: rel(a.createdAt) })),
    h("h3", { text: a.title }), a.text ? h("p", { text: a.text }) : null,
    h("div", { class: "row" }, typeof uxReadBtn === "function" ? uxReadBtn(() => `${a.title}. ${a.text || ""}`) : null, admin ? rowActions("announcements", a) : null));
}
registerView("announcements", "community", "إعلانات الإدارة", () => h("div", { class: "view" },
  head("المجتمع", "إعلانات الإدارة", "قناة رسمية للقراءة بس: مواعيد، فعاليات وتحديثات من إدارة المنصة."),
  h("div", { class: "stack", id: "pl-ann-list" })), { order: 90 });
HOOKS.lists.push(() => {
  const a = $("#ad-ann-list"), b = $("#pl-ann-list");
  const none = () => empty("ما في إعلانات", "أول إعلان بتنشره الإدارة بيظهر هون.");
  if (a) a.replaceChildren(...(PL.ann.length ? PL.ann.map((x) => plAnnCard(x, true)) : [none()]));
  if (b) b.replaceChildren(...(PL.ann.length ? PL.ann.map((x) => plAnnCard(x, false)) : [none()]));
  const hw = $("#pl-ann-home");
  if (hw) {
    const x = PL.ann[0]; hw.hidden = !x;
    if (x) hw.replaceChildren(h("div", { class: "spread" }, h("h2", { text: "آخر إعلان" }), h("button", { class: "link", type: "button", "data-go": "announcements", text: "كل الإعلانات" })), plAnnCard(x, false));
  }
});
registerHome(() => h("section", { class: "section", id: "pl-ann-home", hidden: true }), 5);

// ---------- config editors: sponsors (255), challenges (219), survey (204), changelog (203) ----------
async function adCfgSave(id, data) { return setDoc("config", id, { ...data, uid: S.uid, updatedAt: Date.now() }); }
function adListEditor(id, title, lede, fields, describe) {
  const f = h("form", { class: "card form" }, fields.map(([k, l, type, req, extra]) => h("label", { class: "field" + (type === "textarea" ? " full" : "") }, h("span", { text: l }),
    type === "textarea" ? h("textarea", { id: `ad-${id}-${k}`, maxlength: 600, required: req || null }) :
      type === "select" ? h("select", { id: `ad-${id}-${k}` }, extra.map(([v, t]) => opt(v, t))) :
        h("input", { type, id: `ad-${id}-${k}`, required: req || null, maxlength: type === "text" ? 120 : null, min: type === "number" ? 1 : null }))),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أضف" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const item = { id: Math.random().toString(36).slice(2, 10), createdAt: Date.now() };
    for (const [k, , type] of fields) { const v = $(`#ad-${id}-${k}`).value.trim(); item[k] = type === "number" ? +v || 1 : type === "url" ? safeUrl(v) || "" : v; }
    if (await adCfgSave(id, { items: [item, ...plCfgItems(id)] })) { f.reset(); toast("انضاف"); }
  });
  return h("section", { class: "section" }, h("h2", { text: title }), h("p", { class: "muted", text: lede }), f, h("div", { class: "stack", "data-ad-list": id, "data-ad-desc": describe }));
}
const adDescribe = {
  sponsors: (x) => [x.name, [x.note, x.rewards ? `مكافأة: ${x.rewards}` : ""].filter(Boolean).join(" · ")],
  challenges: (x) => [x.title, `${x.target} × ${({ material: "مادة", offer: "عرض درس", post: "منشور", thanksSent: "شكر", free: "درس تطوعي" })[x.metric] || x.metric}${x.until ? ` · لغاية ${x.until}` : ""}`],
  changelog: (x) => [x.title, x.text],
};
registerView("ad-config", "admin", "المحتوى والإعدادات", () => {
  const sv = plCfg("survey");
  const sf = h("form", { class: "card form" },
    h("label", { class: "field full" }, h("span", { text: "عنوان الاستبيان" }), h("input", { type: "text", id: "ad-sv-title", maxlength: 100, value: sv?.title || "استبيان رضا عن المنصة" })),
    h("label", { class: "field full" }, h("span", { text: "الأسئلة (سؤال بكل سطر، الجواب من 1 لـ 5)" }), h("textarea", { id: "ad-sv-q", text: (sv?.questions || ["قديش المنصة بتفيدك؟", "قديش سهل تلاقي اللي بدك إياه؟", "قديش بتنصح فيها لطالب بالمدرسة؟"]).join("\n") })),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: sv?.active ? "افتح استبيان جديد" : "افتح الاستبيان" }),
      sv?.active ? h("button", { class: "btn ghost", type: "button", onclick: () => adCfgSave("survey", { ...sv, active: false }).then((ok) => ok && toast("انسكّر الاستبيان")), text: "سكّر الاستبيان الحالي" }) : null));
  sf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const qs = $("#ad-sv-q").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (!qs.length) { toast("اكتب سؤال واحد على الأقل"); return; }
    if (await adCfgSave("survey", { id: "s" + Date.now().toString(36), title: $("#ad-sv-title").value.trim() || "استبيان", questions: qs, active: true, createdAt: Date.now() })) toast("انفتح الاستبيان");
  });
  const v = h("div", { class: "view" },
    adHead("المحتوى والإعدادات", "رعاة، تحديات، استبيان الرضا وسجل التحديثات. كل شي هون بيظهر للأعضاء."),
    adListEditor("sponsors", "الرعاة", "اكتب بس رعاة حقيقيين وافقوا. المكافأة اختيارية وبتظهر بصفحة النقاط.", [["name", "اسم المصلحة", "text", true], ["url", "الموقع (اختياري)", "url"], ["note", "شو بيقدّموا للمنصة", "text"], ["rewards", "مكافأة للمساهمين (اختياري)", "text"]], "sponsors"),
    adListEditor("challenges", "تحديات قصيرة", "تحدّي بيتعدّ من يوم ما تضيفه. مثال: «شارك 3 ملخصات قبل الامتحانات».", [["title", "اسم التحدي", "text", true], ["metric", "شو بنعدّ", "select", true, [["material", "مواد بالمكتبة"], ["offer", "عروض دروس"], ["free", "دروس تطوعية"], ["post", "منشورات"], ["thanksSent", "رسائل شكر"]]], ["target", "الهدف (عدد)", "number", true], ["until", "لغاية تاريخ", "date"], ["prize", "جائزة رمزية (اختياري)", "text"]], "challenges"),
    adListEditor("changelog", "سجل التحديثات", "شو تغيّر بالمنصة؟ بيظهر بصفحة «سجل التحديثات».", [["title", "العنوان", "text", true], ["text", "التفاصيل", "textarea"]], "changelog"),
    h("section", { class: "section" }, h("h2", { text: "استبيان الرضا" }), h("p", { class: "muted", text: "كل عضو بيجاوب مرة وحدة. النتائج بتظهر هون كمعدّلات، بدون أسماء." }), sf, h("div", { id: "ad-sv-results" })));
  if (sv?.id) onLeave(subscribe("survey-answers", { limit: 1000 }, (rows) => { adSvRows = rows.filter((r) => r.survey === sv.id); renderLists(); }));
  return v;
}, { order: 50, admin: true });
let adSvRows = [];
HOOKS.lists.push(() => {
  document.querySelectorAll("[data-ad-list]").forEach((el) => {
    const id = el.getAttribute("data-ad-list"); const items = plCfgItems(id);
    el.replaceChildren(...(items.length ? items.map((x) => { const [t, s] = adDescribe[id](x); return h("div", { class: "plain spread" },
      h("span", { class: "ad-mem-t" }, h("b", { text: t || "—" }), s ? h("span", { class: "muted small", text: s }) : null),
      h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تشيله؟", () => adCfgSave(id, { items: plCfgItems(id).filter((y) => y.id !== x.id) })), text: "شيل" })); })
      : [h("p", { class: "muted small", text: "لسا فاضي." })]));
  });
  const r = $("#ad-sv-results"); const sv = plCfg("survey");
  if (r) {
    if (!sv?.id) { r.replaceChildren(h("p", { class: "muted small", text: "ما في استبيان لسا." })); return; }
    const rows = adSvRows;
    r.replaceChildren(h("div", { class: "card stack" }, h("div", { class: "spread" }, h("h3", { text: sv.title }), h("span", { class: "pill " + (sv.active ? "good" : "grey"), text: sv.active ? "مفتوح" : "مسكّر" })),
      h("p", { class: "muted small", text: `${rows.length} جواب` }),
      ...sv.questions.map((q, i) => { const vals = rows.map((x) => x.scores?.[i]).filter((n) => n >= 1); const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return h("div", { class: "stack", style: "gap:4px" }, h("span", { class: "small", text: q }), h("div", { class: "ad-bar-row" }, h("span", { class: "ad-bar-track" }, h("i", { style: `width:${(avg / 5) * 100}%` })), h("span", { class: "ad-bar-v num", text: vals.length ? avg.toFixed(1) : "—" }))); }),
      rows.filter((x) => x.comment).length ? h("div", { class: "stack" }, h("h4", { text: "ملاحظات" }), rows.filter((x) => x.comment).slice(0, 30).map((x) => h("p", { class: "plain small", text: x.comment }))) : null));
  }
});

// ---------- 206 institution suggestions ----------
let adSugg = [];
registerView("ad-sugg", "admin", "اقتراحات المؤسسات", () => {
  onLeave(subscribe("suggestions", { limit: 300 }, (rows) => { adSugg = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); }));
  return h("div", { class: "view" },
    adHead("اقتراحات المؤسسات", "مؤسسات ناقصة أو معلومات غلط بعتها الأعضاء من قسم «جامعة». بعد ما تضيفها لملف المؤسسات، علّمها كمراجَعة."),
    h("div", { class: "stack", id: "ad-sugg-list" }));
}, { order: 60, admin: true });
HOOKS.lists.push(() => {
  const el = $("#ad-sugg-list"); if (!el) return;
  el.replaceChildren(...(adSugg.length ? adSugg.map((s) => { const url = safeUrl(s.url); const known = INST.find((i) => matches(i.ar + " " + i.he, s.name || "")); return h("article", { class: "plain item" },
    h("div", { class: "meta" }, h("span", { class: "who", text: s.name || "—" }), h("span", { text: `من ${nameOf(s.uid)}` }), h("span", { text: rel(s.createdAt) }), known ? h("span", { class: "pill grey", text: "شبيهة بمؤسسة موجودة" }) : h("span", { class: "pill", text: "جديدة" })),
    url ? h("a", { href: url, target: "_blank", rel: "noopener", class: "small me-clip", text: url }) : null,
    h("div", { class: "row" }, h("a", { class: "btn sm ghost", target: "_blank", rel: "noopener", href: "https://www.google.com/search?q=" + encodeURIComponent(s.name || ""), text: "ابحث عنها" }),
      h("button", { class: "btn sm", type: "button", onclick: () => delDoc("suggestions", s.id), text: "تمت المراجعة" }))); })
    : [empty("ما في اقتراحات", "الأعضاء بيقدروا يقترحوا مؤسسة من أسفل قسم «جامعة».")]));
});

// ---------- 208 backup + 200 export ----------
const AD_BACKUP = ["alumni", "posts", "materials", "tutors", "mod", "announcements", "thanks", "notes", "reports", "suggestions", "config", "ambassadors", "survey-answers"];
function adReadOnce(col) {
  return new Promise((res) => {
    let un = null, done = false;
    const finish = (rows) => { if (done) return; done = true; clearTimeout(t); setTimeout(() => un && un()); res(rows); };
    const t = setTimeout(() => finish(null), 8000);
    un = subscribe(col, { order: col === "mod" || col === "config" ? "updatedAt" : "createdAt", limit: 5000 }, finish);
  });
}
registerView("ad-backup", "admin", "نسخ احتياطي", () => {
  const status = h("p", { class: "muted small", id: "ad-bk-status" });
  const extra = h("input", { type: "text", id: "ad-bk-extra", placeholder: "مثال: events, mentors", "aria-label": "مجموعات إضافية" });
  const run = async () => {
    const cols = [...AD_BACKUP, ...extra.value.split(/[,،\s]+/).map((s) => s.trim()).filter((s) => /^[\w-]+$/.test(s))];
    const out = { app: "بوابة الخريجين", exportedAt: new Date().toISOString(), collections: {} };
    for (const c of [...new Set(cols)]) { status.textContent = `جارِ قراءة ${c}…`; const rows = await adReadOnce(c); if (rows) out.collections[c] = rows; }
    const n = Object.values(out.collections).reduce((s, r) => s + r.length, 0);
    status.textContent = `جاهز: ${n} عنصر.`;
    if (await saveFile(`نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }))) toast("انحفظت النسخة");
  };
  return h("div", { class: "view" },
    adHead("نسخ احتياطي وتصدير", "نزّل نسخة كاملة من بيانات المنصة المشتركة كملف JSON، أو قائمة الخريجين كملف Excel (CSV)."),
    h("div", { class: "card stack" }, h("h3", { text: "نسخة احتياطية كاملة" }),
      h("p", { class: "muted small", text: `بتشمل: ${AD_BACKUP.join("، ")}. ما بتشمل الردود داخل المنشورات ورسائل الدردشة، ولا المساحات الخاصة بالأعضاء.` }),
      h("label", { class: "field" }, h("span", { text: "مجموعات إضافية من أقسام ثانية (اختياري)" }), extra),
      h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: run, text: "نزّل النسخة الاحتياطية" })), status,
      h("p", { class: "muted small", text: "الملف فيه معلومات تواصل للأعضاء. خزّنه بمكان آمن وما تبعثه لحدا." })),
    h("div", { class: "card stack" }, h("h3", { text: "قائمة الخريجين" }), h("p", { class: "muted small", text: "ملف بينفتح بـ Excel أو Google Sheets." }),
      h("div", null, h("button", { class: "btn", type: "button", onclick: adExportCsv, text: "صدّر CSV" }))),
    !CAP.downloads ? h("div", { class: "banner warn" }, "التنزيل مش متاح بهالعرض. افتح المنصة من claude.ai.") : null);
}, { order: 70, admin: true });

// ---------- 252 permissions review ----------
registerView("ad-perms", "admin", "الصلاحيات", () => {
  const rows = [
    ["صاحب المنصة (Owner)", "كل شي: بيشارك المنصة، بيغيّر الصلاحيات، بيعدّل الصفحة نفسها، وكل صلاحيات المحرّر."],
    ["محرّر (Editor)", "قسم الإدارة كامل: توثيق، تثبيت، إخفاء، إعلانات، رعاة، تحديات، نسخ احتياطي، وحذف أي محتوى."],
    ["مساهم (Contributor)", "بينشئ ملف، بينشر، بيشارك مواد ودروس، بيرد، بيشكر، بيبلّغ، وبيحذف اللي كتبه هو بس."],
    ["مشاهد (Viewer)", "بيتصفّح كل شي بدون ما يكتب. بيقدر يستعمل الأدوات والبحث."],
  ];
  const mods = Object.keys(S.mod.roles || {});
  return h("div", { class: "view" },
    adHead("مراجعة الصلاحيات", "مين بيقدر يعمل شو. الصلاحيات نفسها بتنعطى من زر المشاركة بـ Claude، مش من هالصفحة."),
    h("div", { class: "table-wrap" }, h("table", null, h("thead", null, h("tr", null, h("th", { text: "الدور" }), h("th", { text: "شو بيقدر يعمل" }))),
      h("tbody", null, rows.map(([r, d]) => h("tr", null, h("td", null, h("b", { text: r })), h("td", { text: d })))))),
    h("section", { class: "section" }, h("h2", { text: "مراجعة دورية" }),
      reqList(["مرة بالفصل: افتح المشاركة وشيل صلاحية «محرّر» عن أي حدا ما عاد فعّال.", "تأكد إن مشرفين الأفواج لسا متطوعين (من «الأعضاء والأفواج»).", "راجع المحتوى المخفي: في شي لازم ينحذف نهائيًا أو يرجع؟", "نزّل نسخة احتياطية قبل أي تغيير كبير."]),
      h("p", { class: "small" }, "مشرفين الأفواج هلّق: ", h("b", { text: mods.length ? mods.map(nameOf).join("، ") : "ما في" }))));
}, { order: 90, admin: true });
