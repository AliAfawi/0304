// ===== learning: tutoring extras — slots & booking (68), group lessons (69), reviews (67), matching (80),
// time bank (70), volunteer hours (78) and certificate (79). Data: bookings, bookconf (written by the tutor), tutorreviews.
const LN_BSTATUS = { pending: "بانتظار ردّ المعلّم", accepted: "مؤكّد", declined: "انرفض أو انلغى", done: "تمّ الدرس" };
const lnStatus = (b) => lnTut.conf[b.id]?.status || "pending";
const lnOfferFree = (o) => !!o && (o.format === LN_FREE || (o.type === "offer" && !o.price));
const lnLive2 = (b) => lnStatus(b) !== "declined";
const lnSlotTaken = (offerId, slot) => lnTut.bookings.some((b) => b.offer === offerId && b.slot === slot && lnLive2(b));
const lnGroupCount = (offerId) => lnTut.bookings.filter((b) => b.offer === offerId && b.group && lnLive2(b)).length;
function lnRating(offerId) {
  const r = lnTut.reviews.filter((x) => x.target === offerId);
  return { n: r.length, avg: r.length ? r.reduce((s, x) => s + (+x.stars || 0), 0) / r.length : 0, list: r };
}

// Score how well an offer fits a help request (80).
function lnMatchScore(req, o) {
  if (o.subject !== req.subject || o.uid === req.uid) return -1;
  let s = 5; const why = [];
  const nums = (t) => new Set(String(t || "").match(/\d/g) || []);
  const a = nums(req.level), b = nums(o.level);
  if (a.size && b.size && [...a].some((x) => b.has(x))) { s += 2; why.push("نفس المستوى"); }
  const online = (m) => m === "أونلاين" || m === "الطريقتين";
  const face = (m) => m === "وجهًا لوجه" || m === "الطريقتين";
  if ((online(req.mode) && online(o.mode)) || (face(req.mode) && face(o.mode))) s += 1; else s -= 2;
  if (req.area && o.area && norm(req.area).trim() === norm(o.area).trim()) { s += 2; why.push("نفس المنطقة"); }
  else if (online(o.mode) && online(req.mode)) why.push("أونلاين");
  if (!o.price) s += 0.5;
  const r = lnRating(o.id); if (r.n) s += r.avg / 5;
  return { s, why };
}

function lnTutorCard(t, offers) {
  const isOffer = t.type === "offer";
  const al = S.alumni[t.uid];
  const r = isOffer ? lnRating(t.id) : null;
  const futureSlots = (t.slots || []).filter((s) => new Date(s) > new Date());
  const parts = [];
  if (isOffer && t.format === "درس جماعي") {
    const n = lnGroupCount(t.id), cap = t.capacity || 0;
    const mineB = lnTut.bookings.find((b) => b.offer === t.id && b.group && b.uid === S.uid && lnLive2(b));
    parts.push(h("div", { class: "plain stack ln-tight" },
      t.when ? h("div", { class: "small" }, "الموعد: ", h("b", { text: t.when })) : null,
      h("div", { class: "spread" }, h("span", { class: "small num", text: `المسجّلين ${n} من ${cap}` }),
        t.uid === S.uid ? null : mineB ? h("button", { class: "btn sm ghost", type: "button", onclick: () => confirmBox("تلغي تسجيلك بالدرس الجماعي؟", () => delDoc("bookings", mineB.id)), text: "ألغِ تسجيلي" })
          : h("button", { class: "btn sm blue", type: "button", disabled: n >= cap ? true : null, onclick: () => lnBook(t, ""), text: n >= cap ? "مكتمل" : "سجّلني" })),
      h("div", { class: "bar" }, h("i", { style: `width:${cap ? Math.min(100, (n / cap) * 100) : 0}%` }))));
  }
  if (isOffer && t.format !== "درس جماعي" && (futureSlots.length || t.uid === S.uid)) {
    parts.push(h("div", { class: "stack ln-tight" }, h("h4", { text: "مواعيد متاحة" }),
      futureSlots.length ? h("div", { class: "chips" }, futureSlots.map((s) => {
        const taken = lnSlotTaken(t.id, s);
        return h("button", { class: "chip ln-slot", type: "button", disabled: taken || t.uid === S.uid ? true : null, title: taken ? "محجوز" : "احجز هالموعد", onclick: () => lnBook(t, s) }, lnSlot(s) + (taken ? " · محجوز" : ""));
      })) : h("p", { class: "muted small", text: "ما في مواعيد جاية. أضف مواعيد عشان الطلاب يحجزوا." }),
      t.uid === S.uid ? h("button", { class: "link small", type: "button", onclick: () => lnEditSlots(t), text: "عدّل المواعيد" }) : null));
  }
  if (!isOffer) {
    const best = (offers || []).map((o) => ({ o, m: lnMatchScore(t, o) })).filter((x) => x.m !== -1 && x.m.s > 3).sort((a, b) => b.m.s - a.m.s).slice(0, 3);
    parts.push(h("div", { class: "plain stack ln-tight" }, h("h4", { text: "الأنسب لهالطلب" }),
      best.length ? h("ul", { class: "ln-list" }, best.map(({ o, m }) => h("li", null, h("b", { text: nameOf(o.uid) }),
        h("span", { class: "muted small", text: " · " + [o.level, o.price ? `₪${o.price}` : "مجاني", ...m.why].filter(Boolean).join(" · ") }),
        o.contact ? h("div", { class: "small" }, "تواصل: ", h("b", { text: o.contact })) : null)))
        : h("p", { class: "muted small", text: "لسا ما في عرض بهالموضوع. إذا بتقدر تساعد، أضف عرض." })));
  }
  return h("article", { class: "card item" },
    h("div", { class: "row" }, h("span", { class: isOffer ? "pill good" : "pill warn", text: isOffer ? "بعلّم" : "بحتاج مساعدة" }),
      t.format && t.format !== "درس خصوصي" ? h("span", { class: "pill", text: t.format }) : null,
      h("span", { class: "pill grey", text: t.subject }), t.level ? h("span", { class: "muted small", text: t.level }) : null),
    lnPerson(t.uid, [al ? `فوج ${al.year}` : "", t.area, t.mode].filter(Boolean).join(" · ")),
    t.note ? h("p", { text: t.note }) : null,
    isOffer ? h("div", { class: "spread" }, h("div", { class: "num ln-price", text: t.price ? `₪${t.price} للساعة` : "مجاني / تطوّعي" }),
      h("button", { class: "link small", type: "button", onclick: () => lnReviews(t), "aria-label": "التقييمات" }, lnStars(r.avg, r.n))) : null,
    ...parts,
    h("div", { class: "spread" }, t.contact ? h("span", { class: "small" }, "تواصل: ", h("b", { text: t.contact })) : h("span"),
      h("div", { class: "row" }, lnReportBtn("tutors:" + t.id), rowActions("tutors", t))));
}

function lnBook(o, slot) {
  if (!guardWrite() || !needProfile()) return;
  if (o.uid === S.uid) return;
  const group = !slot;
  confirmBox(group ? "تسجّل بالدرس الجماعي؟ المعلّم بيوصله إشعار." : "تحجز هالموعد؟ " + lnSlot(slot), async () => {
    const id = group ? `${o.id}__g__${S.uid}` : `${o.id}__${slot.replace(/\D/g, "")}__${S.uid}`;
    const ok = await setDoc("bookings", id, { uid: S.uid, tutor: o.uid, offer: o.id, slot: slot || "", group, subject: o.subject, free: lnOfferFree(o), createdAt: Date.now() });
    if (ok) {
      toast(group ? "انسجّلت، بالتوفيق" : "انبعث طلب الحجز، استنى تأكيد المعلّم");
      lnNote(o.uid, "booking", group ? "تسجيل جديد بدرسك الجماعي: " + o.subject : "طلب حجز درس " + o.subject + ": " + lnSlot(slot), "tutors");
    }
  });
}

function lnEditSlots(o) {
  let slots = [...(o.slots || [])].filter((s) => new Date(s) > new Date());
  const list = h("div", { class: "chips" });
  const draw = () => list.replaceChildren(...(slots.length ? slots.map((s) => h("button", { class: "chip", type: "button", onclick: () => { slots = slots.filter((x) => x !== s); draw(); } }, lnSlot(s) + " ×")) : [h("span", { class: "muted small", text: "ما في مواعيد." })]));
  draw();
  const inp = h("input", { type: "datetime-local", id: "ln-es-slot", "aria-label": "موعد جديد" });
  const close = modal("مواعيدك المتاحة", h("div", { class: "stack ln" }, list,
    h("div", { class: "row" }, inp, h("button", { class: "btn sm ghost", type: "button", onclick: () => { if (inp.value && !slots.includes(inp.value)) { slots.push(inp.value); slots.sort(); draw(); inp.value = ""; } }, text: "أضف" })),
    h("div", null, h("button", { class: "btn blue", type: "button", onclick: async () => { if (await setDoc("tutors", o.id, { ...lnClean(o), slots })) { close(); toast("انحفظت المواعيد"); } }, text: "احفظ" }))));
}

function lnReviews(o) {
  const box = h("div", { class: "stack ln" });
  const draw = () => {
    const r = lnRating(o.id);
    const mine = r.list.find((x) => x.uid === S.uid);
    const canRate = S.uid && o.uid !== S.uid;
    const pick = lnStarPick("ln-rv-stars", mine?.stars || 0);
    const ta = h("textarea", { id: "ln-rv-text", maxlength: 500, placeholder: "كيف كان الدرس؟ شو استفدت؟" });
    ta.value = mine?.text || "";
    const form = canRate ? h("form", { class: "plain stack" }, h("h3", { text: mine ? "عدّل تقييمك" : "قيّم المعلّم" }), pick.el, ta,
      h("div", null, h("button", { class: "btn blue", type: "submit", text: "احفظ التقييم" }))) : null;
    form && form.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      if (!pick.get()) { toast("اختار عدد النجوم"); return; }
      if (await setDoc("tutorreviews", `${o.id}__${S.uid}`, { uid: S.uid, target: o.id, tutor: o.uid, stars: pick.get(), text: ta.value.trim(), createdAt: mine?.createdAt || Date.now() })) {
        toast("انحفظ تقييمك، يسلمو"); lnNote(o.uid, "review", "وصلك تقييم جديد على درس " + o.subject, "tutors");
        close();
      }
    });
    box.replaceChildren(h("div", { class: "row" }, lnStars(r.avg, r.n)),
      ...(r.list.length ? r.list.map((x) => h("div", { class: "plain item" },
        h("div", { class: "spread" }, lnWho(x.uid), h("span", { class: "ln-stars", "aria-label": `${x.stars} من 5`, text: "★".repeat(x.stars) + "☆".repeat(5 - x.stars) })),
        x.text ? h("p", { text: x.text }) : null,
        h("div", { class: "row" }, lnReportBtn("tutorreviews:" + x.id), rowActions("tutorreviews", x))))
        : [empty("لسا ما في تقييمات", "إذا أخذت درس مع هالمعلّم، كن أول واحد يقيّمه.")]),
      form);
  };
  let close = () => {};
  draw();
  close = modal("تقييمات " + nameOf(o.uid), box);
}

// Bookings that involve me, with actions (shown above the tutors list).
function lnMyLessonsPanel() {
  if (!S.uid) return h("span");
  const offerOf = (b) => S.tutors.find((t) => t.id === b.offer);
  const asStudent = lnTut.bookings.filter((b) => b.uid === S.uid);
  const asTutor = lnTut.bookings.filter((b) => b.tutor === S.uid);
  if (!asStudent.length && !asTutor.length) return h("span");
  const label = (b) => (b.group ? "درس جماعي" : lnSlot(b.slot));
  const pillCls = { pending: "pill warn", accepted: "pill good", declined: "pill grey", done: "pill" };
  const row = (b, who, actions) => h("div", { class: "plain spread" },
    h("div", { class: "ln-min" }, h("b", { text: b.subject || offerOf(b)?.subject || "درس" }), h("div", { class: "muted small", text: label(b) + " · " + nameOf(who) })),
    h("div", { class: "row" }, h("span", { class: pillCls[lnStatus(b)], text: LN_BSTATUS[lnStatus(b)] + (lnStatus(b) === "done" ? ` · ${lnTut.conf[b.id]?.hours || 0} س` : "") }), ...actions));
  const setConf = (b, status, hours) => {
    const old = lnTut.conf[b.id];
    setDoc("bookconf", b.id, { uid: S.uid, booking: b.id, student: b.uid, offer: b.offer, status, hours: hours || 0, free: offerOf(b) ? lnOfferFree(offerOf(b)) : !!b.free,
      createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() }).then((ok) => {
      if (!ok) return;
      const msg = { accepted: "تأكّد موعد درس " + b.subject, declined: "انلغى أو انرفض موعد درس " + b.subject, done: "علّم المعلّم درس " + b.subject + " كمنتهي، لا تنسى تقيّمه" }[status];
      lnNote(b.uid, "booking", msg, "tutors");
    });
  };
  const doneDialog = (b) => {
    const inp = h("input", { type: "number", id: "ln-done-hours", min: 0.5, max: 12, step: 0.5, value: 1 });
    const close = modal("تمّ الدرس", h("div", { class: "stack ln" }, lnField("كم ساعة؟", inp),
      h("p", { class: "muted small", text: "الساعات بتنحسب ببنك الساعات، وإذا الدرس مجاني بتنحسب كساعات تطوّع." }),
      h("div", null, h("button", { class: "btn blue", type: "button", onclick: () => { const v = Math.max(0.5, Math.min(12, +inp.value || 1)); setConf(b, "done", v); close(); }, text: "احفظ" }))));
  };
  const tutorActions = (b) => {
    const s = lnStatus(b);
    if (s === "pending") return [h("button", { class: "btn sm blue", type: "button", onclick: () => setConf(b, "accepted"), text: "قبول" }), h("button", { class: "btn sm ghost", type: "button", onclick: () => setConf(b, "declined"), text: "رفض" })];
    if (s === "accepted") return [h("button", { class: "btn sm blue", type: "button", onclick: () => doneDialog(b), text: "تمّ الدرس" }), h("button", { class: "link small danger", type: "button", onclick: () => confirmBox("تلغي الموعد؟", () => setConf(b, "declined")), text: "إلغاء" })];
    return [];
  };
  const studentActions = (b) => (lnStatus(b) === "done" || lnStatus(b) === "declined" ? [] :
    [h("button", { class: "link small danger", type: "button", onclick: () => confirmBox("تلغي الحجز؟", () => delDoc("bookings", b.id)), text: "ألغِ" })]);
  const recent = (arr) => arr.filter((b) => lnStatus(b) !== "declined" || Date.now() - (lnTut.conf[b.id]?.updatedAt || 0) < 7 * 86400000).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12);
  const t = recent(asTutor), s = recent(asStudent);
  return h("section", { class: "card stack" },
    h("div", { class: "spread" }, h("h2", { text: "دروسي وحجوزاتي" }), h("button", { class: "link", type: "button", "data-go": "ln-hours", text: "بنك الساعات" })),
    t.length ? h("div", { class: "stack" }, h("h4", { text: "طلبات على دروسك" }), ...t.map((b) => row(b, b.uid, tutorActions(b)))) : null,
    s.length ? h("div", { class: "stack" }, h("h4", { text: "حجوزاتك" }), ...s.map((b) => row(b, b.tutor, studentActions(b)))) : null);
}

// ---------- «ساعاتي وتطوّعي» (me) ----------
function lnHoursOf(uid) {
  let taught = 0, learned = 0, vol = 0; const lines = [];
  for (const b of lnTut.bookings) {
    const c = lnTut.conf[b.id];
    if (!c || c.status !== "done" || c.uid !== b.tutor) continue;
    const hrs = +c.hours || 0;
    if (b.tutor === uid) { taught += hrs; if (c.free) vol += hrs; lines.push({ b, c, role: "علّمت" }); }
    if (b.uid === uid) { learned += hrs; lines.push({ b, c, role: "تعلّمت" }); }
  }
  return { taught, learned, vol, lines };
}
const lnCertEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function lnCertHtml(name, hours, date) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>شهادة تقدير</title>
<style>body{margin:0;background:#EFECE3;font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;color:#16171C;display:grid;place-items:center;min-height:100vh}
.c{width:min(800px,92vw);background:#fff;border:10px double #2B5FD9;padding:48px 32px;text-align:center}
.k{color:#2B5FD9;font-weight:700;letter-spacing:.02em;margin:0}h1{font-size:44px;margin:12px 0}h2{font-size:34px;margin:8px 0;color:#2B5FD9}
.n{font-size:26px;font-weight:800}.s{color:#5D606D;font-size:13px;margin-top:28px}</style></head><body><div class="c">
<p class="k">بوابة الخريجين</p><h1>شهادة تقدير</h1><p>بكل فخر وامتنان، نشكر</p><h2>${lnCertEsc(name)}</h2>
<p>على تطوّعه بتعليم ومساعدة طلاب المدرسة</p><p class="n">${lnCertEsc(hours)} ساعة تطوّع</p><p>${lnCertEsc(date)}</p>
<p class="s">الساعات محسوبة من الدروس المجانية وحصص التقوية المسجّلة على المنصة.</p></div></body></html>`;
}
views["ln-hours"] = () => {
  const box = h("div", { class: "stack" });
  const draw = () => {
    if (!S.uid) { box.replaceChildren(empty("لازم تسجّل دخول", "سجّل دخول لـ Claude عشان نحسبلك ساعاتك.")); return; }
    const me = lnHoursOf(S.uid);
    let total = 0; for (const c of Object.values(lnTut.conf)) if (c.status === "done" && c.free) total += +c.hours || 0;
    const name = S.alumni[S.uid]?.name;
    const date = new Date().toLocaleDateString("ar-EG-u-nu-latn", { year: "numeric", month: "long", day: "numeric" });
    box.replaceChildren(
      h("div", { class: "grid-3" },
        h("div", { class: "stat" }, h("b", { text: fmt(me.taught) }), h("span", { text: "ساعات علّمتها" })),
        h("div", { class: "stat" }, h("b", { text: fmt(me.learned) }), h("span", { text: "ساعات تعلّمتها" })),
        h("div", { class: "stat" }, h("b", { text: (me.taught - me.learned > 0 ? "+" : "") + fmt(me.taught - me.learned) }), h("span", { text: "رصيدك" }))),
      h("p", { class: "muted small", text: "بنك الساعات: كل ساعة بتعلّمها بتعطيك حق تطلب ساعة من حدا ثاني. الساعات بتنحسب من الدروس اللي علّمها المعلّم «تمّ الدرس»." }),
      h("section", { class: "section" }, h("h2", { text: "ساعات التطوّع" }),
        h("div", { class: "result" }, h("span", { text: "ساعات تطوّعك (دروس مجانية وحصص تقوية)" }), h("b", { text: fmt(me.vol) }), h("span", { class: "muted small", text: `مجموع ساعات التطوّع بكل المنصة: ${fmt(total)}` })),
        me.vol > 0 ? h("div", { class: "stack" },
          lnCertPreview(name || "اسمك هون", me.vol, date),
          h("div", { class: "row" },
            name ? null : h("button", { class: "btn ghost", type: "button", onclick: openProfile, text: "أنشئ ملفك عشان يطلع اسمك" }),
            CAP.downloads ? h("button", { class: "btn blue", type: "button", disabled: name ? null : true, onclick: () => saveFile("شهادة-تطوع.html", lnCertHtml(name, me.vol, date)), text: "نزّل الشهادة" })
              : h("span", { class: "muted small", text: "التنزيل مش متاح بهالعرض. افتح المنصة من claude.ai عشان تنزّل الشهادة." })))
          : empty("لسا ما في ساعات تطوّع", "أضف «حصة تقوية مجانية» أو درس مجاني بقسم «دروس ومساعدة». بعد كل درس علّمه «تمّ الدرس» وبتنحسب ساعاتك وبتقدر تنزّل شهادة تقدير.")),
      h("section", { class: "section" }, h("h2", { text: "سجلّ الدروس" }),
        me.lines.length ? h("div", { class: "stack" }, me.lines.sort((a, b) => (b.c.updatedAt || 0) - (a.c.updatedAt || 0)).map(({ b, c, role }) => h("div", { class: "plain spread" },
          h("div", { class: "ln-min" }, h("b", { text: role + " " + (b.subject || "") }), h("div", { class: "muted small", text: nameOf(role === "علّمت" ? b.uid : b.tutor) + " · " + rel(c.updatedAt) })),
          h("span", { class: c.free ? "pill good" : "pill grey", text: `${c.hours} س` + (c.free ? " · تطوّع" : "") }))))
          : empty("السجلّ فاضي", "لما تحجز درس أو تعلّم درس ويتعلّم «تمّ الدرس»، بيطلع هون.")));
  };
  lnSetDraw(draw);
  lnLive("bookings", { limit: 1000 }, (rows) => { lnTut.bookings = rows; draw(); });
  lnLive("bookconf", { limit: 1000 }, (rows) => { lnTut.conf = Object.fromEntries(rows.map((r) => [r.id, r])); draw(); });
  draw();
  return h("div", { class: "view ln" }, head("مساحتي", "ساعاتي وتطوّعي", "بنك الساعات وساعات التطوّع بتنحسب من الدروس اللي تمّت على المنصة. شهادة التقدير بتنزل باسمك."), box);
};
function lnCertPreview(name, hours, date) {
  return h("div", { class: "ln-cert", role: "img", "aria-label": "معاينة شهادة التقدير" },
    h("p", { class: "ln-cert-k", text: "بوابة الخريجين" }), h("h3", { text: "شهادة تقدير" }),
    h("p", { text: "بكل فخر وامتنان، نشكر" }), h("b", { class: "ln-cert-name", text: name }),
    h("p", { text: "على تطوّعه بتعليم ومساعدة طلاب المدرسة" }), h("b", { class: "num", text: `${fmt(hours)} ساعة تطوّع` }), h("p", { class: "muted small", text: date }));
}
registerView("ln-hours", "me", "ساعاتي وتطوّعي", null, { order: 64 });
