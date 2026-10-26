// ===== platform team: points, badges, levels, leaderboards, thanks, certificate, streak, challenges =====
// Everything is computed in the browser from the public collections already loaded (S.posts, S.materials,
// S.tutors, S.alumni, PL.thanks). Replies and other teams' collections are not counted.

const PT_RULES = [
  ["material", "مادة أو امتحان بالمكتبة", 10],
  ["offer", "عرض درس", 8],
  ["free", "إضافة لكل درس مجاني أو تطوّعي", 4],
  ["post", "منشور بالمجتمع (سؤال، نصيحة، فرصة)", 3],
  ["request", "طلب مساعدة بالدروس", 1],
  ["thanks", "شخص جديد شكرك", 5],
  ["profile", "ملف كامل (مرة وحدة)", 5],
  ["mentor", "متاح للمساعدة (مرة وحدة)", 5],
];
const PT_W = Object.fromEntries(PT_RULES.map(([k, , w]) => [k, w]));
const PT_LEVELS = [
  { min: 0, name: "بداية الطريق" }, { min: 20, name: "مشارك" }, { min: 60, name: "فعّال" },
  { min: 150, name: "ملهم" }, { min: 300, name: "سند الفوج" },
];
const ptBlank = () => ({ material: 0, offer: 0, free: 0, post: 0, question: 0, request: 0, thanks: 0, thanksSent: 0, profile: 0, mentor: 0, points: 0, help: 0 });
// Compute stats for every uid since `since` (ms). Profile/mentor points only count in all-time totals.
function ptCompute(since = 0) {
  const m = {};
  const get = (u) => (m[u] ||= ptBlank());
  const ok = (r) => r.uid && (r.createdAt || 0) >= since;
  S.posts.forEach((p) => { if (!ok(p) || !plVisible("posts", p)) return; const s = get(p.uid); s.post++; if (p.cat === "سؤال" || p.cat === "طلب مساعدة") s.question++; });
  S.materials.forEach((x) => { if (ok(x) && plVisible("materials", x)) get(x.uid).material++; });
  S.tutors.forEach((t) => {
    if (!ok(t) || !plVisible("tutors", t)) return;
    const s = get(t.uid);
    if (t.type === "offer") { s.offer++; if (!t.price) s.free++; } else { s.request++; s.question++; }
  });
  const seen = new Set();
  PL.thanks.forEach((t) => {
    if (!ok(t) || !t.to || t.to === t.uid) return;
    get(t.uid).thanksSent++;
    const key = t.to + "|" + t.uid; if (seen.has(key)) return; seen.add(key);
    get(t.to).thanks++;
  });
  if (!since) Object.values(S.alumni).forEach((a) => {
    const u = a.uid || a.id; if (!u) return; const s = get(u);
    if (a.name && a.year && a.status && (a.field || a.place)) s.profile = 1;
    if (a.mentor) s.mentor = 1;
  });
  for (const s of Object.values(m)) {
    s.points = s.material * PT_W.material + s.offer * PT_W.offer + s.free * PT_W.free + s.post * PT_W.post + s.request * PT_W.request + s.thanks * PT_W.thanks + s.profile * PT_W.profile + s.mentor * PT_W.mentor;
    s.help = s.material + s.offer + s.thanks;
  }
  return m;
}
function ptLevel(points) {
  let i = 0; PT_LEVELS.forEach((l, j) => { if (points >= l.min) i = j; });
  const next = PT_LEVELS[i + 1];
  return { ...PT_LEVELS[i], i, next, pct: next ? Math.round(((points - PT_LEVELS[i].min) / (next.min - PT_LEVELS[i].min)) * 100) : 100 };
}
function ptStatsFor(uid, since = 0) {
  const s = (uid && ptCompute(since)[uid]) || ptBlank();
  return { ...s, level: ptLevel(s.points) };
}
const PT_BADGES = [
  { id: "first-q", name: "أول سؤال", how: "اسأل أول سؤال بالمجتمع أو اطلب مساعدة بدرس.", test: (s) => s.question >= 1 },
  { id: "first-help", name: "أول مساعدة", how: "شارك مادة، اعرض درس، أو خلّي حدا يشكرك.", test: (s) => s.material + s.offer + s.thanks >= 1 },
  { id: "library", name: "مكتبة متنقلة", how: "شارك 5 مواد أو امتحانات.", test: (s) => s.material >= 5 },
  { id: "volunteer", name: "معلّم متطوّع", how: "اعرض درس مجاني أو تطوّعي.", test: (s) => s.free >= 1 },
  { id: "voice", name: "صوت الفوج", how: "انشر 10 منشورات بالمجتمع.", test: (s) => s.post >= 10 },
  { id: "loved", name: "محبوب الفوج", how: "5 أشخاص مختلفين يشكروك.", test: (s) => s.thanks >= 5 },
  { id: "gold", name: "مرشد ذهبي", how: "كون متاح للمساعدة ويشكرك 3 أشخاص.", test: (s) => s.mentor && s.thanks >= 3 },
  { id: "grateful", name: "قلب شاكر", how: "اشكر 3 أشخاص ساعدوك.", test: (s) => s.thanksSent >= 3 },
];
const ptBadgesOf = (s) => PT_BADGES.filter((b) => b.test(s));

// ---------- streak (private to this browser) ----------
const ptDay = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function ptStreak() {
  const days = new Set(lsGet("pt-days", []));
  let cur = 0; const d = new Date();
  if (!days.has(ptDay(d))) d.setDate(d.getDate() - 1);
  while (days.has(ptDay(d))) { cur++; d.setDate(d.getDate() - 1); }
  const sorted = [...days].sort(); let best = 0, run = 0, prev = null;
  sorted.forEach((s) => { const t = new Date(s + "T12:00:00").getTime(); run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
  return { cur, best, total: days.size };
}
(function ptMarkToday() {
  const days = lsGet("pt-days", []); const t = ptDay();
  if (!days.includes(t)) { days.push(t); lsSet("pt-days", days.slice(-400)); }
})();

// ---------- cohorts ----------
function ptCohorts(since = 0) {
  const stats = ptCompute(since); const c = {};
  for (const [u, s] of Object.entries(stats)) {
    const y = S.alumni[u]?.year; if (!y) continue;
    const r = (c[y] ||= { year: y, points: 0, help: 0, people: 0 });
    r.points += s.points; r.help += s.help; if (s.points) r.people++;
  }
  return Object.values(c).sort((a, b) => b.points - a.points || b.year - a.year);
}
function ptCohortMedals() {
  const all = ptCohorts(0).filter((c) => c.points > 0).slice(0, 3);
  const names = ["وسام ذهبي", "وسام فضي", "وسام برونزي"];
  const out = {}; all.forEach((c, i) => (out[c.year] = { i, name: names[i] }));
  return out;
}
function ptMedal(i) { return h("span", { class: "pt-medal m" + i, "aria-hidden": "true", text: String(i + 1) }); }

// ---------- member card (also used by search and the leaderboard) ----------
function openMemberCard(uid) {
  const a = S.alumni[uid];
  const s = ptStatsFor(uid);
  const badges = ptBadgesOf(s);
  const got = PL.thanks.filter((t) => t.to === uid && t.uid !== uid).slice(0, 5);
  const body = h("div", { class: "stack" },
    h("div", { class: "row" }, avatar(nameOf(uid), uid),
      h("div", { style: "min-width:0;flex:1" },
        h("div", { class: "row" }, h("h3", { text: nameOf(uid) }), isMod("verified", uid) ? h("span", { class: "pill good", text: "موثّق" }) : null,
          S.mod.roles && S.mod.roles[uid] ? h("span", { class: "pill", text: "مشرف/ة الفوج" }) : null),
        a ? h("div", { class: "muted small", text: [`فوج ${a.year}`, a.status, a.city].filter(Boolean).join(" · ") }) : h("div", { class: "muted small", text: "ما عنده ملف بالدليل" }))),
    a && (a.field || a.place) ? h("p", { class: "me-line", text: [a.field, a.place].filter(Boolean).join(" · ") }) : null,
    a && a.bio ? h("p", { class: "muted me-line", text: a.bio }) : null,
    a && a.contact ? h("span", { class: "small" }, "تواصل: ", h("b", { text: a.contact })) : null,
    h("div", { class: "row" }, h("span", { class: "pill", text: s.level.name }), h("span", { class: "pill grey", text: `${fmt(s.points)} نقطة` }), a && a.mentor ? h("span", { class: "pill good", text: "متاح للمساعدة" }) : null),
    badges.length ? h("div", { class: "stack" }, h("h4", { text: "الشارات" }), h("div", { class: "chips" }, badges.map((b) => h("span", { class: "tag", text: b.name })))) : null,
    h("div", { class: "stack" }, h("h4", { text: "رسائل شكر" }),
      got.length ? got.map((t) => h("div", { class: "plain pt-thx" }, h("p", { text: t.text }), h("div", { class: "meta" }, h("span", { class: "who", text: nameOf(t.uid) }), h("span", { text: rel(t.createdAt) }))))
        : h("p", { class: "muted small", text: "لسا ما وصله رسائل شكر." })),
    uid !== S.uid && S.uid ? h("div", null, h("button", { class: "btn sm blue", type: "button", onclick: () => { ptThanksTo = uid; go("me-thanks"); $("#modal-root").replaceChildren(); }, text: "ابعثله رسالة شكر" })) : null);
  modal("بطاقة عضو", body);
}

// ---------- certificate (SVG) ----------
const ptEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
function ptCertificate(uid) {
  const a = S.alumni[uid] || {}; const s = ptStatsFor(uid);
  const date = new Date().toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
  const lines = [
    [`${fmt(s.material)} مادة وامتحان`, `${fmt(s.offer)} عرض درس، منها ${fmt(s.free)} تطوّعي`],
    [`${fmt(s.post)} منشور بالمجتمع`, `${fmt(s.thanks)} شخص شكره/ا`],
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850" direction="rtl" font-family="Alexandria, 'IBM Plex Sans Arabic', Tahoma, sans-serif">
<rect width="1200" height="850" fill="#FBFAF6"/>
<rect x="30" y="30" width="1140" height="790" fill="none" stroke="#2B5FD9" stroke-width="6"/>
<rect x="48" y="48" width="1104" height="754" fill="none" stroke="#2B5FD9" stroke-width="1.5"/>
<circle cx="600" cy="140" r="42" fill="#2B5FD9"/><text x="600" y="156" text-anchor="middle" font-size="44" font-weight="900" fill="#fff">خ</text>
<text x="600" y="250" text-anchor="middle" font-size="64" font-weight="900" fill="#16171C">شهادة تطوّع</text>
<text x="600" y="310" text-anchor="middle" font-size="26" fill="#5D606D">بوابة الخريجين · منصة خريجي وطلاب المدرسة</text>
<text x="600" y="400" text-anchor="middle" font-size="28" fill="#16171C">تقديرًا لمساهمة</text>
<text x="600" y="470" text-anchor="middle" font-size="54" font-weight="800" fill="#2B5FD9">${ptEsc(a.name || nameOf(uid))}</text>
<text x="600" y="520" text-anchor="middle" font-size="24" fill="#5D606D">${ptEsc(a.year ? `فوج ${a.year}` : "")}</text>
<text x="600" y="580" text-anchor="middle" font-size="26" fill="#16171C">${ptEsc(`بمساعدة طلاب المدرسة والأفواج: ${fmt(s.points)} نقطة · مستوى «${s.level.name}»`)}</text>
${lines.map((l, i) => `<text x="600" y="${635 + i * 40}" text-anchor="middle" font-size="22" fill="#5D606D">${ptEsc(l.join(" · "))}</text>`).join("\n")}
<text x="600" y="760" text-anchor="middle" font-size="18" fill="#5D606D">${ptEsc(`صدرت تلقائيًا من المنصة حسب المساهمات المسجّلة بتاريخ ${date}. ما بتغني عن شهادة رسمية من المدرسة.`)}</text>
</svg>`;
}
function ptCertPreview(uid) {
  try { const doc = new DOMParser().parseFromString(ptCertificate(uid), "image/svg+xml"); const el = document.importNode(doc.documentElement, true); el.removeAttribute("width"); el.removeAttribute("height"); el.setAttribute("class", "pt-cert"); el.setAttribute("role", "img"); el.setAttribute("aria-label", "معاينة شهادة التطوع"); return el; }
  catch { return null; }
}

// ---------- views ----------
let ptThanksTo = "";
registerView("me-points", "me", "نقاطي وشاراتي", () => {
  const need = meNeedUid(); if (need) return need;
  return h("div", { class: "view" },
    head("مساحتي", "نقاطي وشاراتي", "كل مساعدة بتقدّمها بتنحسب. النقاط بتنحسب من المساهمات الظاهرة بالمنصة، ومش منافسة: الهدف نشجّع المساعدة."),
    h("section", { class: "section", id: "pt-me" }),
    h("section", { class: "section" }, h("h2", { text: "الشارات" }), h("div", { class: "pt-badges", id: "pt-badges" })),
    h("section", { class: "section", id: "pt-challenges" }),
    h("section", { class: "section", id: "pt-rewards", hidden: true }),
    h("section", { class: "section" },
      h("h2", { text: "شهادة تطوّع" }),
      h("p", { class: "muted", text: "شهادة بإسمك فيها نقاطك ومساهماتك، بتنفع لملف التطوع أو لطلبات المنح. بتطلع كملف صورة SVG." }),
      h("div", { id: "pt-cert" })),
    h("section", { class: "section" },
      h("h2", { text: "كيف بنحسب النقاط" }),
      h("div", { class: "table-wrap" }, h("table", null, h("thead", null, h("tr", null, h("th", { text: "المساهمة" }), h("th", { text: "نقاط" }))),
        h("tbody", null, PT_RULES.map(([, l, w]) => h("tr", null, h("td", { text: l }), h("td", { class: "num", text: String(w) })))))),
      h("p", { class: "muted small", text: "المحتوى اللي بتخفيه الإدارة ما بينحسب. الردود على المنشورات والمشاركات بأقسام ثانية لسا ما بتنحسب." }),
      h("div", { class: "stack" }, h("h4", { text: "المستويات" }), h("div", { class: "chips" }, PT_LEVELS.map((l) => h("span", { class: "tag", text: `${l.name}: ${l.min}+` }))))));
});
HOOKS.lists.push(() => {
  const me = $("#pt-me"); if (!me || !S.uid) return;
  const s = ptStatsFor(S.uid); const month = ptStatsFor(S.uid, plMonthStart()); const st = ptStreak();
  me.replaceChildren(
    h("div", { class: "grid-3" },
      h("div", { class: "stat" }, h("b", { text: fmt(s.points) }), h("span", { text: "نقطة بالمجموع" })),
      h("div", { class: "stat" }, h("b", { text: fmt(month.points) }), h("span", { text: "نقطة هالشهر" })),
      h("div", { class: "stat" }, h("b", { text: fmt(st.cur) }), h("span", { text: "يوم ورا بعض" }))),
    h("div", { class: "card stack" },
      h("div", { class: "spread" }, h("h3", { text: `مستواك: ${s.level.name}` }), s.level.next ? h("span", { class: "muted small", text: `باقي ${fmt(s.level.next.min - s.points)} نقطة لـ «${s.level.next.name}»` }) : h("span", { class: "pill good", text: "أعلى مستوى" })),
      h("div", { class: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": s.level.pct, "aria-label": "التقدم للمستوى الجاي" }, h("i", { style: `width:${s.level.pct}%` })),
      h("p", { class: "muted small", text: `أطول سلسلة أيام: ${st.best} · أيام فتحت فيها المنصة من هالجهاز: ${st.total}. الأيام المتتالية محفوظة على جهازك بس.` })));
  const b = $("#pt-badges");
  if (b) b.replaceChildren(...PT_BADGES.map((x) => { const on = x.test(s); return h("div", { class: "pt-badge" + (on ? " on" : "") }, h("span", { class: "pt-badge-ic", "aria-hidden": "true", text: on ? "★" : "☆" }), h("b", { text: x.name }), h("span", { class: "small muted", text: on ? "حصلت عليها" : x.how })); }));
  const ch = $("#pt-challenges");
  if (ch) {
    const items = plCfgItems("challenges").filter((c) => !c.until || new Date(c.until + "T23:59:59").getTime() >= Date.now());
    ch.replaceChildren(h("h2", { text: "تحديات قصيرة" }), ...(items.length ? items.map((c) => {
      const prog = Math.min(c.target || 1, ptStatsFor(S.uid, c.createdAt || 0)[c.metric] || 0); const pct = Math.round((prog / (c.target || 1)) * 100);
      return h("div", { class: "card stack" }, h("div", { class: "spread" }, h("h3", { text: c.title }), pct >= 100 ? h("span", { class: "pill good", text: "خلّصته" }) : h("span", { class: "muted small num", text: `${prog} / ${c.target}` })),
        c.prize ? h("p", { class: "small", text: `الجائزة الرمزية: ${c.prize}` }) : null,
        h("div", { class: "bar" }, h("i", { style: `width:${pct}%` })), c.until ? h("span", { class: "muted small", text: `لغاية ${c.until}` }) : null);
    }) : [empty("ما في تحديات هلّق", "الإدارة بتنشر تحديات قصيرة من وقت لوقت، مثل «شارك 3 ملخصات هالأسبوع».")]));
  }
  const rw = $("#pt-rewards");
  if (rw) {
    const sp = plCfgItems("sponsors").filter((x) => x.rewards);
    rw.hidden = !sp.length;
    if (sp.length) rw.replaceChildren(h("h2", { text: "مكافآت من الرعاة" }), h("p", { class: "muted", text: "مصالح محلية بتدعم المنصة وبتقدّم مكافآت رمزية للمساهمين. التفاصيل والتسليم عن طريق الإدارة." }),
      h("div", { class: "grid" }, sp.map((x) => h("div", { class: "card stack" }, h("h3", { text: x.name }), h("p", { text: x.rewards })))));
  }
  const cert = $("#pt-cert");
  if (cert) {
    const has = !!S.alumni[S.uid];
    cert.replaceChildren(has ? h("div", { class: "stack" }, ptCertPreview(S.uid),
      h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", disabled: !CAP.downloads || null, onclick: () => saveFile("شهادة-تطوع.svg", new Blob([ptCertificate(S.uid)], { type: "image/svg+xml" })).then((ok) => ok && toast("انحفظت الشهادة")), text: "نزّل الشهادة" }),
        !CAP.downloads ? h("span", { class: "muted small", text: "التنزيل مش متاح بهالعرض." }) : null))
      : empty("بدك ملف أول", "الشهادة بتطلع باسمك وفوجك، فأنشئ ملفك أولًا."));
  }
});

// thanks
registerView("me-thanks", "me", "رسائل الشكر", () => {
  const need = meNeedUid(); if (need) return need;
  const people = Object.values(S.alumni).filter((a) => (a.uid || a.id) !== S.uid).sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
  const f = h("form", { class: "card form" },
    h("label", { class: "field" }, h("span", { text: "لمين؟" }), h("select", { id: "pt-to", required: true }, opt("", "اختار شخص", !ptThanksTo), people.map((a) => opt(a.uid || a.id, `${a.name} · فوج ${a.year}`, (a.uid || a.id) === ptThanksTo)))),
    h("label", { class: "field full" }, h("span", { text: "رسالتك" }), h("textarea", { id: "pt-text", required: true, maxlength: 300, placeholder: "مثال: شكرًا على ملخص الكيمياء، ساعدني بالبجروت." })),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "ابعث الشكر" }), h("span", { class: "muted small", text: "الرسالة بتظهر على بطاقته، وبيوصله إشعار." })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const to = $("#pt-to").value, text = $("#pt-text").value.trim();
    if (!to || !text) { toast("اختار شخص واكتب رسالة"); return; }
    if (to === S.uid) return;
    if (await addDoc("thanks", { uid: S.uid, to, text, createdAt: Date.now() })) {
      await addDoc("notes", { uid: S.uid, to, from: S.uid, kind: "thanks", text: `وصلتك رسالة شكر: ${text.slice(0, 120)}`, go: "me-thanks", createdAt: Date.now() });
      ptThanksTo = ""; f.reset(); toast("وصل الشكر");
    }
  });
  return h("div", { class: "view" },
    head("مساحتي", "رسائل الشكر", "حدا ساعدك بملخص، درس، أو نصيحة؟ كلمة شكر بتفرق معه، وبتنضاف لبطاقته."),
    writeBanner(),
    people.length ? f : empty("لسا ما في أعضاء بالدليل", "لما ينضم خريجين للدليل، بتقدر تشكرهم من هون."),
    h("section", { class: "section" }, h("h2", { text: "وصلني" }), h("div", { class: "stack", id: "pt-thx-in" })),
    h("section", { class: "section" }, h("h2", { text: "بعثت" }), h("div", { class: "stack", id: "pt-thx-out" })));
});
function ptThxItem(t, other, canDel) {
  return h("article", { class: "plain pt-thx" }, h("p", { text: t.text }),
    h("div", { class: "meta" }, avatar(nameOf(other), other), h("span", { class: "who", text: nameOf(other) }), h("span", { text: rel(t.createdAt) }), canDel ? rowActions("thanks", t) : null));
}
HOOKS.lists.push(() => {
  const i = $("#pt-thx-in"), o = $("#pt-thx-out"); if (!i || !o) return;
  const inn = PL.thanks.filter((t) => t.to === S.uid), out = PL.thanks.filter((t) => t.uid === S.uid);
  resolveNames(inn.map((t) => t.uid));
  i.replaceChildren(...(inn.length ? inn.map((t) => ptThxItem(t, t.uid, false)) : [empty("لسا ما وصلك شكر", "ساعد حدا بدرس أو شارك ملخص، والشكر بيجي لحاله.")]));
  o.replaceChildren(...(out.length ? out.map((t) => ptThxItem(t, t.to, true)) : [empty("ما بعثت شكر لسا", "اختار شخص من فوق واكتبله كلمتين.")]));
});

// leaderboard
let ptBoardTab = "members";
registerView("me-board", "me", "لوحة الصدارة", () => {
  const tabs = [["members", "الأعضاء هالشهر"], ["cohorts", "الأفواج هالشهر"], ["challenge", "تحدّي الفوج"], ["medals", "أوسمة الأفواج"]];
  return h("div", { class: "view" },
    head("مساحتي", "لوحة الصدارة", `مين ساعد أكثر بشهر ${plMonthName()}. اللوحة بتتصفّر أول كل شهر.`),
    h("div", { class: "chips", id: "pt-board-tabs" }, tabs.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(ptBoardTab === k), onclick: () => { ptBoardTab = k; go("me-board"); }, text: l }))),
    h("div", { class: "stack", id: "pt-board" }));
});
function ptBoardRow(rank, avatarEl, title, sub, value, onClick) {
  return h(onClick ? "button" : "div", { class: "plain pt-row", type: onClick ? "button" : null, onclick: onClick || null },
    rank < 3 ? ptMedal(rank) : h("span", { class: "pt-rank num", text: String(rank + 1) }),
    avatarEl, h("span", { class: "pt-row-t" }, h("b", { text: title }), sub ? h("span", { class: "muted small", text: sub }) : null),
    h("span", { class: "pt-row-v num", text: value }));
}
HOOKS.lists.push(() => {
  const el = $("#pt-board"); if (!el) return;
  const since = plMonthStart();
  if (ptBoardTab === "members") {
    const rows = Object.entries(ptCompute(since)).filter(([, s]) => s.points > 0).sort((a, b) => b[1].points - a[1].points).slice(0, 15);
    resolveNames(rows.map(([u]) => u));
    el.replaceChildren(...(rows.length ? rows.map(([u, s], i) => ptBoardRow(i, avatar(nameOf(u), u), nameOf(u), S.alumni[u] ? `فوج ${S.alumni[u].year}` : "", `${fmt(s.points)} نقطة`, () => openMemberCard(u)))
      : [empty("لسا ما في مساهمات هالشهر", "أول مادة أو درس بتشاركه هالشهر بيحطك بأول اللوحة.")]));
  } else if (ptBoardTab === "cohorts") {
    const rows = ptCohorts(since).filter((c) => c.points > 0);
    el.replaceChildren(...(rows.length ? rows.map((c, i) => ptBoardRow(i, null, `فوج ${c.year}`, `${c.people} مساهم/ة`, `${fmt(c.points)} نقطة`)) : [empty("ما في نشاط للأفواج هالشهر", "النقاط بتنحسب لفوج كل عضو حسب ملفه بالدليل.")]));
  } else if (ptBoardTab === "challenge") {
    const rows = ptCohorts(since).filter((c) => c.help > 0).sort((a, b) => b.help - a.help);
    el.replaceChildren(
      h("p", { class: "muted", text: "تحدّي الفوج بيعدّ المساعدة بس: مواد بالمكتبة، عروض دروس، ورسائل شكر وصلت لأعضاء الفوج هالشهر." }),
      ...(rows.length ? [h("div", { class: "result" }, h("span", { class: "muted", text: "بيتصدّر هالشهر" }), h("b", { text: `فوج ${rows[0].year}` }), h("span", { class: "small", text: `${fmt(rows[0].help)} مساعدة` })),
        ...rows.map((c, i) => ptBoardRow(i, null, `فوج ${c.year}`, null, `${fmt(c.help)} مساعدة`))]
        : [empty("التحدّي لسا مفتوح", "ولا فوج ساعد هالشهر لسا. فوجك بيقدر يكون الأول.")]));
  } else {
    const medals = ptCohortMedals(); const ys = Object.keys(medals);
    const mentors = {}, members = {};
    Object.values(S.alumni).forEach((a) => { members[a.year] = (members[a.year] || 0) + 1; if (a.mentor) mentors[a.year] = (mentors[a.year] || 0) + 1; });
    const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    const tm = top(mentors), tb = top(members);
    el.replaceChildren(
      h("p", { class: "muted", text: "أوسمة على كل الوقت، مش بس هالشهر." }),
      ...(ys.length ? ys.sort((a, b) => medals[a].i - medals[b].i).map((y) => ptBoardRow(medals[y].i, null, `فوج ${y}`, medals[y].name, ""))
        : [empty("لسا ما في أوسمة", "الأوسمة بتروح لأكثر 3 أفواج جمعت نقاط على مر الوقت.")]),
      tm || tb ? h("div", { class: "grid" },
        tm ? h("div", { class: "card stack" }, h("h4", { text: "وسام «فوج المرشدين»" }), h("b", { class: "num", text: `فوج ${tm[0]}` }), h("span", { class: "muted small", text: `${tm[1]} متاحين للمساعدة` })) : null,
        tb ? h("div", { class: "card stack" }, h("h4", { text: "وسام «الفوج الأكبر بالدليل»" }), h("b", { class: "num", text: `فوج ${tb[0]}` }), h("span", { class: "muted small", text: `${tb[1]} عضو بالدليل` })) : null) : null);
  }
});

// home: top contributors this month + cohort challenge
registerHome(() => h("section", { class: "section", id: "pt-home" }), 40);
HOOKS.lists.push(() => {
  const el = $("#pt-home"); if (!el) return;
  const rows = Object.entries(ptCompute(plMonthStart())).filter(([, s]) => s.points > 0).sort((a, b) => b[1].points - a[1].points).slice(0, 5);
  const ch = ptCohorts(plMonthStart()).filter((c) => c.help > 0).sort((a, b) => b.help - a.help)[0];
  resolveNames(rows.map(([u]) => u));
  el.replaceChildren(...[
    h("div", { class: "spread" }, h("h2", { text: "المساهمين المميزين هالشهر" }), h("button", { class: "link", type: "button", "data-go": "me-board", text: "لوحة الصدارة" })),
    rows.length ? h("div", { class: "pt-top" }, rows.map(([u, s], i) => h("button", { class: "pt-top-i", type: "button", onclick: () => openMemberCard(u) },
      h("span", { class: "pt-top-av" }, avatar(nameOf(u), u), i < 3 ? ptMedal(i) : null), h("b", { text: nameOf(u) }), h("span", { class: "muted small num", text: `${fmt(s.points)} نقطة` }))))
      : empty("الشهر لسا بأوّله", "شارك مادة أو اعرض درس تطوّعي، وبتظهر هون لكل المنصة."),
    ch ? h("p", { class: "small" }, "تحدّي الفوج هالشهر: ", h("b", { text: `فوج ${ch.year}` }), ` بيتصدّر بـ ${fmt(ch.help)} مساعدة.`) : null].filter(Boolean));
});
