// community: photo albums per cohort + photo contest (one like per person per contest)
const albState = { tab: "cohorts", year: null, contest: null, photos: [], contests: [], cvotes: [] };

function albImg(p, cls) {
  const src = safeUrl(p.url);
  const alt = p.caption || "صورة من الألبوم";
  if (!src) return h("span", { class: "cm-ph-missing " + (cls || ""), text: "الصورة مش متاحة" });
  const img = h("img", { src, alt, loading: "lazy", class: cls || null, referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(h("span", { class: "cm-ph-missing " + (cls || ""), text: "الصورة مش متاحة" })));
  return img;
}
views["cm-albums"] = () => {
  albForms.clear();
  const unsub1 = subscribe("photos", { limit: 1500 }, (rows) => { albState.photos = rows; resolveNames(rows.map((r) => r.uid)); renderLists(); });
  const unsub2 = subscribe("contests", { limit: 60 }, (rows) => { albState.contests = rows; renderLists(); });
  onLeave(unsub1); onLeave(unsub2);
  if (albState.tab === "contest") { const u = subscribe("contestvotes", { limit: 5000 }, (rows) => { albState.cvotes = rows; renderLists(); }); onLeave(u); }
  const tabs = [["cohorts", "ألبومات الأفواج"], ["contest", "مسابقة التصوير"]];
  return h("div", { class: "view" },
    head("الألبومات", "صور الأفواج", "ألبوم لكل فوج، ومسابقة تصوير بين الطلاب. شارك صورك من المدرسة والرحلات والتخرّج."),
    writeBanner(),
    h("div", { class: "banner" }, "انشر بس صور إلك حق تنشرها. إذا في ناس بالصورة، تأكد إنهم موافقين، وخصوصًا الطلاب الصغار. أي صورة مزعجة بلّغ عنها والإدارة بتشيلها."),
    h("div", { class: "chips", role: "group", "aria-label": "الألبومات" }, tabs.map(([id, l]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(albState.tab === id), onclick: () => { albState.tab = id; albState.year = null; albState.contest = null; go("cm-albums"); }, text: l }))),
    h("div", { class: "stack", id: "alb-body" }));
};

// upload form shared by cohort albums and contests
const albForms = new Map();
function albUploadForm(extra, label) {
  const key = JSON.stringify(extra) + !!CAP.assets;
  if (albForms.has(key)) return albForms.get(key);
  const hasUp = !!CAP.assets;
  const f = h("form", { class: "card form", id: "alb-form" },
    h("h3", { class: "full", text: label }),
    hasUp ? h("label", { class: "field full" }, h("span", { text: "اختر صورة من جهازك" }), h("input", { type: "file", id: "alb-file", accept: "image/*" })) : null,
    h("label", { class: "field full" }, h("span", { text: hasUp ? "أو الصق رابط صورة" : "رابط الصورة (يبدأ بـ https)" }), h("input", { type: "url", id: "alb-url", maxlength: 500, placeholder: "https://…", dir: "ltr" })),
    h("label", { class: "field full" }, h("span", { text: "وصف قصير (اختياري)" }), h("input", { type: "text", id: "alb-cap", maxlength: 120, placeholder: "مثال: رحلة الصف الثاني عشر" })),
    hasUp ? null : h("p", { class: "full muted small", text: "رفع الملفات مش متاح بهذا العرض، فبنستعمل روابط صور." }),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "أضف الصورة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const btn = f.querySelector("[type=submit]");
    const file = hasUp && $("#alb-file").files[0];
    let url = null, assetId = null;
    if (file) {
      if (!/^image\//.test(file.type)) { toast("لازم يكون الملف صورة"); return; }
      btn.disabled = true; btn.textContent = "جارِ الرفع…";
      const r = await uploadFile(file);
      btn.disabled = false; btn.textContent = "أضف الصورة";
      if (!r) return; url = r.url; assetId = r.id;
    } else {
      url = safeUrl($("#alb-url").value);
      if (!url) { toast(hasUp ? "اختر صورة أو الصق رابط صحيح" : "الصق رابط صحيح يبدأ بـ https"); return; }
    }
    const doc = { uid: S.uid, url, caption: $("#alb-cap").value.trim(), createdAt: Date.now(), ...extra };
    if (assetId) doc.assetId = assetId;
    if (await addDoc("photos", doc)) { f.reset(); toast("انضافت الصورة"); }
  });
  albForms.set(key, f);
  return f;
}
function albLightbox(list, i, opts = {}) {
  const p = list[i]; if (!p) return;
  const nav = h("div", { class: "spread" },
    h("button", { class: "btn sm ghost", type: "button", disabled: i <= 0 ? true : null, onclick: () => albLightbox(list, i - 1, opts), text: "→ السابقة" }),
    h("span", { class: "muted small num", text: `${i + 1} / ${list.length}` }),
    h("button", { class: "btn sm ghost", type: "button", disabled: i >= list.length - 1 ? true : null, onclick: () => albLightbox(list, i + 1, opts), text: "التالية ←" }));
  const body = h("div", { class: "stack cm-lightbox" }, albImg(p, "cm-lb-img"),
    p.caption ? h("p", { style: "margin:0", text: p.caption }) : null,
    h("div", { class: "spread" }, h("div", { class: "meta" }, h("span", null, "من ", h("b", { text: nameOf(p.uid) })), cmVerified(p.uid), h("span", { text: rel(p.createdAt) })),
      h("div", { class: "row" }, opts.vote ? opts.vote(p) : null, p.uid !== S.uid ? cmReportBtn("photos:" + p.id) : null,
        canDelete(p) ? h("button", { class: "link danger small", type: "button", onclick: () => confirmBox("تحذف الصورة؟", () => delDoc("photos", p.id)), text: "حذف" }) : null)),
    list.length > 1 ? nav : null);
  modal(opts.title || "صورة", body);
  body.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft" && i < list.length - 1) albLightbox(list, i + 1, opts); if (e.key === "ArrowRight" && i > 0) albLightbox(list, i - 1, opts); });
  const b = body.querySelector("button:not([disabled])"); b && b.focus({ preventScroll: true });
}
function albGrid(list, opts) {
  return h("div", { class: "cm-photo-grid" }, list.map((p, i) => h("figure", { class: "cm-photo" },
    h("button", { class: "cm-photo-btn", type: "button", "aria-label": "كبّر الصورة: " + (p.caption || "بدون وصف"), onclick: () => albLightbox(list, i, opts) }, albImg(p)),
    opts.badge ? opts.badge(p) : null)));
}

function albCohorts() {
  const vis = cmVisible("photos", albState.photos.filter((p) => p.year && !p.contest));
  if (albState.year) {
    const y = albState.year;
    const list = vis.filter((p) => p.year === y);
    return [
      h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", onclick: () => { albState.year = null; cmRedrawAlb(); }, text: "→ كل الألبومات" }), h("h2", { text: `ألبوم فوج ${y}` })),
      albUploadForm({ year: y }, `أضف صورة لألبوم فوج ${y}`),
      list.length ? albGrid(list, { title: `فوج ${y}` }) : empty("الألبوم فاضي لسا", "أضف أول صورة لفوجك من الصندوق فوق."),
    ];
  }
  const years = [...new Set([THIS_YEAR, ...Object.values(S.alumni).map((a) => a.year), ...vis.map((p) => p.year)].filter(Boolean))].sort((a, b) => b - a);
  const mine = S.alumni[S.uid]?.year;
  return [h("div", { class: "cm-album-grid" }, years.map((y) => {
    const ps = vis.filter((p) => p.year === y);
    return h("button", { class: "cm-album", type: "button", onclick: () => { albState.year = y; cmRedrawAlb(); } },
      h("span", { class: "cm-album-cover" }, ps[0] ? albImg(ps[0]) : h("span", { class: "cm-album-ph num", "aria-hidden": "true", text: String(y) })),
      h("span", { class: "cm-album-t" }, h("b", { text: `فوج ${y}` }), h("span", { class: "muted small", text: ps.length ? `${ps.length} صورة` : "لسا فاضي" }), y === mine ? h("span", { class: "pill good", text: "فوجك" }) : null));
  })), h("p", { class: "muted small", text: "في ألبوم لكل فوج موجود بالدليل. إذا فوجك مش ظاهر، أضف حالك للدليل." })];
}

function albContests() {
  const contests = cmVisible("contests", albState.contests);
  if (albState.contest) {
    const c = contests.find((x) => x.id === albState.contest);
    if (!c) { albState.contest = null; return albContests(); }
    const over = c.ends && c.ends < Date.now();
    const list = cmVisible("photos", albState.photos.filter((p) => p.contest === c.id));
    const votes = albState.cvotes.filter((v) => v.contest === c.id && list.some((p) => p.id === v.photo));
    const count = (pid) => votes.filter((v) => v.photo === pid).length;
    const myVote = votes.find((v) => v.uid === S.uid)?.photo;
    const top = list.filter((p) => count(p.id) > 0).sort((a, b) => count(b.id) - count(a.id) || a.createdAt - b.createdAt).slice(0, 3);
    const vote = (p) => {
      if (p.uid === S.uid) return h("span", { class: "pill grey", text: "صورتك" });
      if (over) return h("span", { class: "pill grey num", text: `${count(p.id)} إعجاب` });
      const on = myVote === p.id;
      return h("button", { class: "btn sm " + (on ? "blue" : "ghost"), type: "button", "aria-pressed": String(on),
        onclick: async () => { if (!guardWrite()) return; if (on) await delDoc("contestvotes", c.id + "__" + S.uid); else if (await setDoc("contestvotes", c.id + "__" + S.uid, { uid: S.uid, contest: c.id, photo: p.id, createdAt: Date.now() })) toast("انحسب إعجابك. إلك إعجاب واحد بالمسابقة"); },
        text: (on ? "أعجبتني ✓ " : "أعجبتني ") + count(p.id) });
    };
    return [
      h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", onclick: () => { albState.contest = null; cmRedrawAlb(); }, text: "→ كل المسابقات" })),
      h("div", { class: "card stack" }, h("div", { class: "row" }, h("span", { class: over ? "pill grey" : "pill good", text: over ? "انتهت" : "مفتوحة" }), cmPinPill(c.id)),
        h("h2", { text: c.title }), c.theme ? h("p", { style: "margin:0", text: c.theme }) : null,
        h("p", { class: "muted small", style: "margin:0", text: c.ends ? (over ? "انتهت المسابقة بـ " : "آخر يوم للمشاركة والتصويت: ") + new Date(c.ends).toLocaleDateString("ar-EG-u-nu-latn") : "بدون موعد نهاية" }),
        h("p", { class: "muted small", style: "margin:0", text: "كل شخص إله إعجاب واحد بالمسابقة. بتقدر تنقله لصورة ثانية طول ما المسابقة مفتوحة، وما بتقدر تعجب بصورتك." })),
      h("section", { class: "section" }, h("h2", { text: over ? "الفائزين" : "الأعلى لهلّق" }),
        top.length ? h("ol", { class: "cm-podium" }, top.map((p, i) => h("li", null,
          h("button", { class: "cm-photo-btn", type: "button", "aria-label": `المرتبة ${i + 1}: ${p.caption || "صورة"}`, onclick: () => albLightbox(top, i, { title: c.title, vote }) }, albImg(p)),
          h("div", { class: "meta" }, h("b", { class: "num", text: `#${i + 1}` }), h("span", { class: "who", text: nameOf(p.uid) }), h("span", { class: "num", text: `${count(p.id)} إعجاب` })))))
          : empty("لسا ما حدا أعجب بصورة", list.length ? "تصفّح الصور تحت واختار الصورة اللي عجبتك." : "أول ما تنضاف صور، الأعلى إعجابًا بيظهروا هون.")),
      over ? null : albUploadForm({ contest: c.id }, "شارك بصورة بالمسابقة"),
      h("h2", { text: "كل المشاركات" }),
      list.length ? albGrid(list, { title: c.title, vote, badge: vote }) : empty("ما في مشاركات لسا", over ? "المسابقة انتهت بدون مشاركات." : "كن أول مشارك، أضف صورتك من الصندوق فوق."),
    ];
  }
  const f = albContestForm();
  const cnt = (c) => albState.photos.filter((p) => p.contest === c.id && !cmHidden("photos", p.id)).length;
  return [
    contests.length ? h("div", { class: "grid" }, contests.map((c) => {
      const over = c.ends && c.ends < Date.now();
      return h("article", { class: "card item" + (cmPinned(c.id) ? " cm-pinned" : "") },
        h("div", { class: "row" }, h("span", { class: over ? "pill grey" : "pill good", text: over ? "انتهت" : "مفتوحة" }), cmPinPill(c.id), h("span", { class: "muted small", text: `${cnt(c)} مشاركة` })),
        h("h3", { text: c.title }), c.theme ? h("p", { class: "muted", text: c.theme }) : null,
        h("div", { class: "spread" }, h("button", { class: "btn sm blue", type: "button", onclick: () => { albState.contest = c.id; cmRedrawAlb(); }, text: over ? "شوف الفائزين" : "شارك وصوّت" }),
          h("div", { class: "row" }, c.uid !== S.uid ? cmReportBtn("contests:" + c.id) : null, rowActions("contests", c))));
    })) : empty("ما في مسابقات لسا", "افتح أول مسابقة تصوير بموضوع بيحمّس الطلاب."),
    f,
  ];
}
function albContestForm() {
  if (albForms.has("newc")) return albForms.get("newc");
  const f = h("form", { class: "card form", id: "alb-cform" },
    h("h3", { class: "full", text: "افتح مسابقة جديدة" }),
    h("label", { class: "field full" }, h("span", { text: "اسم المسابقة" }), h("input", { type: "text", id: "alb-ct", required: true, maxlength: 80, placeholder: "مثال: النقب بعيوننا" })),
    h("label", { class: "field full" }, h("span", { text: "الموضوع والشروط" }), h("textarea", { id: "alb-cth", maxlength: 500, placeholder: "مثال: صورة من بلدك، إنت اللي صوّرتها، بدون وجوه ناس بدون إذنهم." })),
    h("label", { class: "field" }, h("span", { text: "مدة المسابقة" }), h("select", { id: "alb-cd" }, opt("7", "أسبوع"), opt("14", "أسبوعين", true), opt("30", "شهر"))),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: "افتح المسابقة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const title = $("#alb-ct").value.trim(); if (!title) return;
    if (await addDoc("contests", { uid: S.uid, title, theme: $("#alb-cth").value.trim(), ends: Date.now() + +$("#alb-cd").value * 86400000, createdAt: Date.now() })) { f.reset(); toast("انفتحت المسابقة"); }
  });
  albForms.set("newc", f);
  return f;
}
function cmRedrawAlb() { const el = $("#alb-body"); if (el) el._cmDeps = null; renderLists(); window.scrollTo({ top: 0 }); }
HOOKS.lists.push(() => {
  const el = $("#alb-body");
  cmDraw(el, [albState.photos, albState.contests, albState.cvotes, S.mod, S.alumni, albState.tab, albState.year, albState.contest, cmNamesKey(), CAP.assets], () =>
    albState.tab === "contest" ? albContests() : albCohorts());
});
registerView("cm-albums", "community", "الألبومات", null, { order: 50 });
