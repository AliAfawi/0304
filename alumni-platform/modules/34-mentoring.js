// ---------- mentoring: big brother/sister pairing, 20-minute sessions + ratings, counsellor hours, class visits ----------
const MT = { reqs: [], slots: [], bookings: [], ratings: [], visits: [], ready: false };
const mtState = { tab: "pair", field: "all", mineOnly: false };
const MT_TABS = [["pair", "الأخ الكبير"], ["sessions", "جلسات إرشاد"], ["counsel", "المستشارة"], ["visits", "زيارات للصفوف"], ["meet", "لقاءات"]];
const MT_GRADES = ["العاشر", "الحادي عشر", "الثاني عشر", "خريج/ة سنة أولى", "أكثر من صف"];
const mtMe = () => S.alumni[S.uid] || {};
const mtIsMentor = () => !!mtMe().mentor;

HOOKS.lists.push(() => mtDraw());
const mtStars = (n) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));
function mtRating(uid) {
  const rs = MT.ratings.filter((r) => r.mentor === uid);
  if (!rs.length) return null;
  const avg = rs.reduce((s, r) => s + (+r.stars || 0), 0) / rs.length;
  return h("span", { class: "mt-stars", title: `معدّل ${avg.toFixed(1)} من 5`, "aria-label": `تقييم ${avg.toFixed(1)} من 5 من ${rs.length} جلسة` }, h("span", { "aria-hidden": "true", text: mtStars(avg) }), h("span", { class: "num small", text: ` ${avg.toFixed(1)} (${rs.length})` }));
}
const mtSlotEnd = (s) => s.start + (s.mins || 20) * 60000;
const mtBooking = (slotId) => MT.bookings.find((b) => b.id === slotId || b.slot === slotId);
const mtSlots = (kind) => crVisible("slots", MT.slots).filter((s) => (s.kind || "mentor") === kind);

// ----- big brother / sister (23) -----
function mtPairTab() {
  const box = h("div", { class: "stack" });
  const myReqs = MT.reqs.filter((r) => r.uid === S.uid && r.status !== "closed");
  const paired = myReqs.find((r) => r.status === "paired"), open = myReqs.find((r) => r.status === "open");
  box.append(h("p", { class: "lede", text: "طالب/ة بالثانوية أو سنة أولى؟ اطلب خريج/ة من التخصص اللي بيهمك يرافقك: أسئلة، قرارات، وتشجيع. الخريجين المتاحين للإرشاد بيقبلوا الطلبات." }));
  if (paired) {
    const a = S.alumni[paired.mentor] || {};
    box.append(h("div", { class: "card stack mt-pair" }, h("h3", { text: "أخوك/أختك الكبير/ة" }), crWho(paired.mentor, a.field || ""), mtRating(paired.mentor),
      a.place ? h("p", { class: "muted", text: [a.field, a.place].filter(Boolean).join(" · ") }) : null,
      a.bio ? h("p", { text: a.bio }) : null,
      a.contact ? h("div", { class: "small" }, "تواصل: ", h("b", { text: a.contact })) : h("p", { class: "muted small", text: "ما في طريقة تواصل بملفه/ا لسا. احجز جلسة أو اكتب بالمجتمع." }),
      h("div", { class: "row" }, h("button", { class: "btn sm blue", type: "button", text: "احجز جلسة معه/ا", onclick: () => { mtState.tab = "sessions"; mtState.mentor = paired.mentor; go("mentoring"); } }),
        h("button", { class: "link small danger", type: "button", text: "أنهِ التوأمة", onclick: () => confirmBox("تنهي التوأمة؟", async () => { const { id, ...d } = paired; if (await setDoc("mentorreqs", id, { ...d, status: "closed", closedAt: Date.now() })) crNote(paired.mentor, "mentor", `${nameOf(S.uid)} أنهى التوأمة. شكرًا على وقتك!`, "mentoring"); }) }))));
  } else if (open) {
    box.append(h("div", { class: "card stack" }, h("div", { class: "row" }, h("span", { class: "pill warn", text: "طلبك مستني خريج" }), h("span", { class: "pill grey", text: open.field })),
      open.note ? h("p", { text: open.note }) : null,
      h("p", { class: "muted small", text: "أول ما حدا يقبل بيوصلك إشعار، وبيظهر هون مع طريقة التواصل." }),
      h("div", { class: "row" }, h("button", { class: "link small danger", type: "button", text: "ألغِ الطلب", onclick: () => confirmBox("تلغي طلبك؟", () => delDoc("mentorreqs", open.id)) }))));
  } else {
    const f = h("form", { class: "card form cr-form" },
      h("h3", { class: "full", text: "اطلب أخ/أخت كبير/ة" }),
      crField("بأي مجال؟", crSelect("mt-r-field", CR_FIELDS, CR_FIELDS.includes(mtMe().field) ? mtMe().field : CR_FIELDS[0])),
      crField("صفّك", crSelect("mt-r-grade", MT_GRADES, MT_GRADES[2])),
      crField("شو بتحتاج؟", h("textarea", { id: "mt-r-note", maxlength: 500, placeholder: "مثال: محتار بين تمريض وطب أسنان، وبدي حدا يحكيلي عن السنة الأولى" }), "full"),
      h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "أرسل الطلب" })));
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!guardWrite() || !needProfile()) return;
      if (await addDoc("mentorreqs", { uid: S.uid, field: $("#mt-r-field", f).value, grade: $("#mt-r-grade", f).value, note: $("#mt-r-note", f).value.trim(), status: "open", mentor: null, createdAt: Date.now() })) toast("انبعث طلبك للخريجين المرشدين");
    });
    box.append(f);
  }
  // mentor side
  if (mtIsMentor()) {
    const mine = MT.reqs.filter((r) => r.mentor === S.uid && r.status === "paired");
    const myField = norm(mtMe().field || "");
    const openReqs = crVisible("mentorreqs", MT.reqs).filter((r) => r.status === "open" && r.uid !== S.uid && (!mtState.mineOnly || !myField || norm(r.field).includes(myField) || myField.includes(norm(r.field))));
    box.append(h("h2", { text: "طلابي" }),
      h("div", { class: "grid" }, mine.length ? mine.map((r) => { const s = S.alumni[r.uid] || {}; return h("article", { class: "card item" }, crWho(r.uid, r.grade || ""),
        h("div", { class: "row" }, h("span", { class: "pill", text: r.field })), r.note ? h("p", { text: r.note }) : null,
        s.contact ? h("div", { class: "small" }, "تواصل: ", h("b", { text: s.contact })) : h("p", { class: "muted small", text: "ما في طريقة تواصل بملفه/ا. اطلب منه/ا يضيفها." }),
        h("div", { class: "row" }, h("button", { class: "link small danger", type: "button", text: "أنهِ التوأمة", onclick: () => confirmBox("تنهي التوأمة؟", async () => { const { id, ...d } = r; if (await setDoc("mentorreqs", id, { ...d, status: "closed", closedAt: Date.now() })) crNote(r.uid, "mentor", `${nameOf(S.uid)} أنهى التوأمة. بتقدر تطلب مرشد جديد.`, "mentoring"); }) }))); })
        : [empty("لسا ما عندك طلاب", "اقبل طلب من القائمة تحت.")]),
      h("div", { class: "spread" }, h("h2", { text: "طلاب بيدوّروا على مرشد" }),
        h("label", { class: "check small" }, h("input", { type: "checkbox", id: "mt-mine-only", checked: mtState.mineOnly ? true : null, onchange: (e) => { mtState.mineOnly = e.target.checked; mtDraw(); } }), "بمجالي بس")),
      h("div", { class: "grid" }, openReqs.length ? openReqs.map((r) => h("article", { class: "card item" }, crWho(r.uid, rel(r.createdAt)),
        h("div", { class: "row" }, h("span", { class: "pill", text: r.field }), r.grade ? h("span", { class: "pill grey", text: r.grade }) : null),
        r.note ? h("p", { text: r.note }) : null,
        h("div", { class: "row" }, h("button", { class: "btn sm blue", type: "button", text: "بقبل أرافقه/ا", onclick: async () => {
          if (!guardWrite()) return;
          const fresh = await getDoc("mentorreqs", r.id);
          if (!fresh || fresh.status !== "open") { toast("حدا سبقك وقبل الطلب"); return; }
          const { id, ...d } = fresh;
          if (await setDoc("mentorreqs", id, { ...d, status: "paired", mentor: S.uid, pairedAt: Date.now() })) { crNote(r.uid, "mentor", `${nameOf(S.uid)} قبل/ت تكون أخوك/أختك الكبير/ة بمجال ${r.field}`, "mentoring"); toast("صرتوا توأم! تواصل معه/ا قريبًا"); }
        } }), crReport("mentorreqs", r))))
        : [empty("ما في طلبات مفتوحة", "لما طالب يطلب مرشد بمجالك، بيظهر هون.")]));
  } else {
    box.append(h("div", { class: "plain row" }, h("span", { text: "خريج/ة وبدك ترافق طالب؟ فعّل «متاح/ة أساعد» بملفك وبتشوف الطلبات." }), h("button", { class: "btn sm", type: "button", text: "افتح ملفي", onclick: openProfile })));
  }
  return box;
}

// ----- slots + booking (24, 26, 39) -----
function mtSlotForm(kind) {
  const counsel = kind === "counsellor";
  const f = h("form", { class: "card form cr-form" },
    h("h3", { class: "full", text: counsel ? "أضف ساعات استقبال للمستشارة" : "انشر موعد إرشاد (20 دقيقة)" }),
    crField("متى", h("input", { type: "datetime-local", id: "mt-s-start", required: true })),
    counsel ? crField("المدة", crSelect("mt-s-mins", [[15, "ربع ساعة"], [20, "20 دقيقة"], [30, "نص ساعة"], [45, "45 دقيقة"]], 20)) : null,
    crField("كم موعد ورا بعض؟", crSelect("mt-s-count", [[1, "موعد واحد"], [2, "موعدين"], [3, "3 مواعيد"], [4, "4 مواعيد"]], 1)),
    counsel ? crField("مين بتستقبل", h("input", { type: "text", id: "mt-s-host", required: true, maxlength: 60, value: "مستشارة المدرسة" })) : crField("عن شو؟", h("input", { type: "text", id: "mt-s-topic", maxlength: 80, placeholder: "مثال: سنة أولى هندسة، التسجيل، السكن" })),
    crField("رابط أونلاين أو مكان", h("input", { type: "text", id: "mt-s-where", maxlength: 200, placeholder: "رابط Zoom/Meet أو «غرفة المستشارة»" })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر المواعيد" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const start = crParseDT($("#mt-s-start", f).value); if (!start) return;
    if (start < Date.now()) { toast("اختار موعد بالمستقبل"); return; }
    const mins = counsel ? +$("#mt-s-mins", f).value : 20, count = +$("#mt-s-count", f).value;
    const where = $("#mt-s-where", f).value.trim();
    let ok = true;
    for (let i = 0; i < count && ok; i++) ok = await addDoc("slots", { uid: S.uid, kind, start: start + i * mins * 60000, mins, topic: counsel ? "" : $("#mt-s-topic", f).value.trim(),
      host: counsel ? $("#mt-s-host", f).value.trim() : "", link: safeUrl(where) || "", place: safeUrl(where) ? "" : where, createdAt: Date.now() });
    if (ok) { f.reset(); toast(count > 1 ? "انتشرت المواعيد" : "انتشر الموعد"); }
  });
  return f;
}
function mtBook(s) {
  if (!guardWrite() || !needProfile()) return;
  const counsel = s.kind === "counsellor";
  const ta = h("textarea", { id: "mt-b-note", maxlength: 300, placeholder: counsel ? "اختياري. لا تكتب تفاصيل حساسة، احكيها بالجلسة." : "عن شو بدك تحكي؟ هيك بيتحضّر المرشد" });
  const close = modal("احجز موعد", h("div", { class: "stack" },
    h("p", { text: crDate(s.start) + " · " + (s.mins || 20) + " دقيقة" }),
    crField("ملاحظة للحجز", ta),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", text: "ثبّت الحجز", onclick: async () => {
      const taken = await getDoc("bookings", s.id);
      if (taken) { close(); toast("انحجز هالموعد قبل شوي، اختار موعد ثاني"); return; }
      if (await setDoc("bookings", s.id, { uid: S.uid, slot: s.id, owner: s.uid, kind: s.kind || "mentor", note: ta.value.trim(), createdAt: Date.now() })) {
        crNote(s.uid, "booking", `${nameOf(S.uid)} حجز/ت موعد ${crDate(s.start)}`, "mentoring"); close(); toast("انحجز الموعد. بتلاقيه تحت «حجوزاتي»");
      }
    } }))));
}
function mtRate(s) {
  let stars = 5;
  const chips = h("div", { class: "chips", role: "group", "aria-label": "عدد النجوم" }, [1, 2, 3, 4, 5].map((n) => h("button", { class: "chip", type: "button", "aria-pressed": String(n === 5), "aria-label": n + " من 5", text: "★".repeat(n), onclick: (e) => { stars = n; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); } })));
  const ta = h("textarea", { id: "mt-rate-text", maxlength: 400, placeholder: "شو أفادك؟ شو كان ممكن يكون أحسن؟ (اختياري)" });
  const close = modal("قيّم الجلسة", h("div", { class: "stack" }, h("p", { class: "muted", text: "التقييم بيساعد الطلاب يختاروا، وبيوصل للمرشد." }), chips, crField("كلمتين", ta),
    h("button", { class: "btn blue", type: "button", text: "أرسل التقييم", onclick: async () => {
      if (await setDoc("ratings", s.id + "__" + S.uid, { uid: S.uid, slot: s.id, mentor: s.uid, stars, text: ta.value.trim(), createdAt: Date.now() })) {
        crNote(s.uid, "rating", `${nameOf(S.uid)} قيّم/ت جلستكم بـ ${stars} من 5`, "mentoring"); close(); toast("شكرًا على التقييم");
      }
    } })));
}
function mtWhere(s) { return safeUrl(s.link) ? h("a", { class: "btn sm", href: safeUrl(s.link), target: "_blank", rel: "noopener", text: "رابط الجلسة" }) : s.place ? h("span", { class: "small muted", text: s.place }) : null; }
function mtCalBtn(s, title) { return h("a", { class: "btn sm ghost", target: "_blank", rel: "noopener", text: "أضف لتقويم Google", href: evGoogleUrl({ id: s.id, title, start: s.start, end: mtSlotEnd(s), desc: s.topic || "", place: s.place, online: s.link }) }); }
// my bookings (as the booker) for one kind
function mtMyBookings(kind) {
  const mine = MT.bookings.filter((b) => b.uid === S.uid).map((b) => ({ b, s: MT.slots.find((x) => x.id === b.slot) })).filter((x) => x.s && (x.s.kind || "mentor") === kind).sort((a, b) => b.s.start - a.s.start);
  if (!mine.length) return null;
  return h("section", { class: "section" }, h("h2", { text: "حجوزاتي" }), h("div", { class: "grid" }, mine.map(({ b, s }) => {
    const past = mtSlotEnd(s) < Date.now(), rated = MT.ratings.some((r) => r.slot === s.id && r.uid === S.uid);
    return h("article", { class: "card item" },
      kind === "counsellor" ? h("div", { class: "row" }, h("b", { text: s.host || "المستشارة" })) : crWho(s.uid, S.alumni[s.uid]?.field || ""),
      h("div", { class: "meta" }, h("span", { text: crDate(s.start) }), !past ? h("span", { class: "pill good", text: crUntil(s.start) }) : h("span", { class: "pill grey", text: "خلصت" })),
      s.topic ? h("p", { class: "muted", text: s.topic }) : null,
      h("div", { class: "row" },
        !past ? mtWhere(s) : null, !past ? mtCalBtn(s, kind === "counsellor" ? "موعد مع " + (s.host || "المستشارة") : "جلسة إرشاد مع " + nameOf(s.uid)) : null,
        !past ? h("button", { class: "link small danger", type: "button", text: "ألغِ الحجز", onclick: () => confirmBox("تلغي الحجز؟", async () => { await delDoc("bookings", b.id); crNote(s.uid, "booking", `${nameOf(S.uid)} ألغى/ت حجز ${crDate(s.start)}`, "mentoring"); }) }) : null,
        past && kind === "mentor" && !rated ? h("button", { class: "btn sm blue", type: "button", text: "قيّم الجلسة", onclick: () => mtRate(s) }) : null,
        past && rated ? h("span", { class: "pill good", text: "قيّمتها" }) : null));
  })));
}
// slots I published (as mentor / counsellor admin)
function mtMySlots(kind) {
  const mine = mtSlots(kind).filter((s) => s.uid === S.uid && mtSlotEnd(s) > Date.now() - 14 * 86400000).sort((a, b) => a.start - b.start);
  if (!mine.length) return h("p", { class: "muted small", text: "ما نشرت مواعيد لسا." });
  return h("div", { class: "table-wrap" }, h("table", { class: "mt-table" },
    h("thead", null, h("tr", null, ["الموعد", "الحالة", "ملاحظة", ""].map((t) => h("th", { text: t })))),
    h("tbody", null, mine.map((s) => { const b = mtBooking(s.id), past = mtSlotEnd(s) < Date.now(); const rt = MT.ratings.find((r) => r.slot === s.id);
      return h("tr", null, h("td", { text: crDate(s.start) }),
        h("td", null, b ? h("div", { class: "stack mt-cell" }, h("b", { text: nameOf(b.uid) }), S.alumni[b.uid]?.contact ? h("span", { class: "small muted", text: S.alumni[b.uid].contact }) : null) : h("span", { class: past ? "pill grey" : "pill", text: past ? "ما انحجز" : "فاضي" })),
        h("td", { class: "small" }, b?.note || "", rt ? h("div", { class: "mt-stars", text: mtStars(rt.stars) + (rt.text ? " – " + rt.text : "") }) : null),
        h("td", null, rowActions("slots", s)));
    }))));
}
function mtSessionsTab() {
  const box = h("div", { class: "stack" });
  box.append(h("p", { class: "lede", text: "احجز 20 دقيقة مع خريج/ة من التخصص اللي بيهمك: أسئلة عن القبول، السنة الأولى، الشغل. بعد الجلسة قيّمها." }));
  const now = Date.now();
  const free = mtSlots("mentor").filter((s) => s.start > now && s.uid !== S.uid && !mtBooking(s.id));
  const byMentor = new Map(); free.forEach((s) => { if (!byMentor.has(s.uid)) byMentor.set(s.uid, []); byMentor.get(s.uid).push(s); });
  const fields = [...new Set([...byMentor.keys()].map((u) => S.alumni[u]?.field).filter(Boolean))];
  let mentors = [...byMentor.keys()].filter((u) => (mtState.field === "all" || S.alumni[u]?.field === mtState.field) && (!mtState.mentor || u === mtState.mentor));
  box.append(h("div", { class: "row" },
    crField("التخصص", h("select", { id: "mt-field", onchange: (e) => { mtState.field = e.target.value; mtDraw(); } }, opt("all", "كل التخصصات", mtState.field === "all"), fields.map((f) => opt(f, f, mtState.field === f)))),
    mtState.mentor ? h("button", { class: "chip", type: "button", "aria-pressed": "true", text: nameOf(mtState.mentor) + " ✕", onclick: () => { mtState.mentor = null; mtDraw(); } }) : null));
  box.append(h("div", { class: "grid" }, mentors.length ? mentors.map((u) => { const a = S.alumni[u] || {}; const list = byMentor.get(u).sort((x, y) => x.start - y.start);
    return h("article", { class: "card item" }, crWho(u, a.field || ""), mtRating(u),
      a.place ? h("p", { class: "muted", text: a.place }) : null,
      h("h4", { text: "مواعيد فاضية" }),
      h("div", { class: "mt-slots" }, list.slice(0, 8).map((s) => h("button", { class: "mt-slot", type: "button", onclick: () => mtBook(s), "aria-label": "احجز " + crDate(s.start) },
        h("b", { text: new Date(s.start).toLocaleDateString(CR_LOC, { weekday: "short", day: "numeric", month: "short" }) }), h("span", { class: "num", text: crTime(s.start) }), s.topic ? h("small", { text: s.topic }) : null))));
  }) : [empty("ما في مواعيد فاضية هلّق", mtIsMentor() ? "انشر مواعيدك من النموذج تحت، والطلاب بيحجزوا." : "الخريجين المرشدين بينشروا مواعيد هون. ارجع بعدين، أو اطلب أخ/أخت كبير/ة.")]));
  const mb = mtMyBookings("mentor"); if (mb) box.append(mb);
  if (mtIsMentor()) box.append(h("section", { class: "section" }, h("h2", { text: "مواعيدي كمرشد/ة" }), mtSlotForm("mentor"), mtMySlots("mentor")));
  else box.append(h("div", { class: "plain row" }, h("span", { text: "خريج/ة وبدك تنشر مواعيد إرشاد؟ فعّل «متاح/ة أساعد» بملفك." }), h("button", { class: "btn sm", type: "button", text: "افتح ملفي", onclick: openProfile })));
  return box;
}
function mtCounselTab() {
  const box = h("div", { class: "stack" });
  box.append(h("p", { class: "lede", text: "ساعات استقبال لمستشارة المدرسة، للطلاب وللخريجين بأول سنة. الإدارة بتنشر المواعيد، وإنت بتحجز." }),
    h("div", { class: "banner" }, "الحجز بيظهر بالمنصة كـ «محجوز». ما تكتب تفاصيل شخصية بملاحظة الحجز، احكيها بالجلسة نفسها."));
  const free = mtSlots("counsellor").filter((s) => s.start > Date.now() && !mtBooking(s.id)).sort((a, b) => a.start - b.start);
  box.append(h("div", { class: "mt-slots mt-slots-wide" }, free.length ? free.slice(0, 24).map((s) => h("button", { class: "mt-slot", type: "button", onclick: () => mtBook(s) },
    h("b", { text: new Date(s.start).toLocaleDateString(CR_LOC, { weekday: "short", day: "numeric", month: "short" }) }), h("span", { class: "num", text: crTime(s.start) + " · " + (s.mins || 20) + " د" }), h("small", { text: s.host || "المستشارة" })))
    : [empty("ما في ساعات استقبال منشورة هلّق", S.isAdmin ? "انشر ساعات الاستقبال من النموذج تحت." : "الإدارة بتنشر المواعيد هون. ارجع بعدين.")]));
  const mb = mtMyBookings("counsellor"); if (mb) box.append(mb);
  box.append(h("section", { class: "section" }, h("h2", { text: "لقاءات استماع لطلاب السنة الأولى" }),
    h("p", { class: "muted", text: "لقاءات جماعية مع المستشارة أو مرشد/ة: كيف ماشية السنة الأولى، ضغط، سكن، دراسة." }),
    evEmbed(["لقاء دعم سنة أولى"], "لما ينتشر لقاء دعم، بيظهر هون.", { type: "لقاء دعم سنة أولى", host: "مستشارة المدرسة" })));
  if (S.isAdmin) box.append(h("section", { class: "section" }, h("h2", { text: "إدارة ساعات الاستقبال" }), mtSlotForm("counsellor"), mtMySlots("counsellor")));
  return box;
}

// ----- class visits (185) -----
function mtVisitsTab() {
  const box = h("div", { class: "stack" });
  box.append(h("p", { class: "lede", text: "صف بدّه خريج/ة يحكيلهم عن تخصص أو شغل؟ اطلبوا زيارة. خريج/ة بدّه يزور؟ اعرض زيارة. لما تتثبّت، بتظهر بالجدول." }));
  const f = h("form", { class: "card form cr-form" },
    crField("نوع", crSelect("mt-v-type", [["req", "بنطلب زيارة لصف"], ["offer", "بعرض أزور صف"]], mtIsMentor() ? "offer" : "req")),
    crField("الصف", crSelect("mt-v-grade", MT_GRADES.slice(0, 3).concat(["أكثر من صف"]), "الثاني عشر")),
    crField("الموضوع / التخصص", h("input", { type: "text", id: "mt-v-topic", required: true, maxlength: 90, placeholder: "مثال: كيف تختار تخصص هندسة" })),
    crField("متى بيناسب؟", h("input", { type: "text", id: "mt-v-when", maxlength: 80, placeholder: "مثال: أيام الأحد بعد الظهر، أو قبل التسجيل" })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "انشر" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const d = { uid: S.uid, type: $("#mt-v-type", f).value, grade: $("#mt-v-grade", f).value, topic: $("#mt-v-topic", f).value.trim(), when: $("#mt-v-when", f).value.trim(), status: "open", by: null, at: null, createdAt: Date.now() };
    if (!d.topic) return;
    if (await addDoc("classvisits", d)) { f.reset(); toast("انتشر"); }
  });
  box.append(f);
  const rows = crVisible("classvisits", MT.visits);
  const sched = rows.filter((v) => v.status === "scheduled" && v.at).sort((a, b) => a.at - b.at);
  const up = sched.filter((v) => v.at > Date.now() - 86400000), done = sched.filter((v) => v.at <= Date.now() - 86400000);
  const visitor = (v) => v.type === "offer" ? v.uid : v.by;
  box.append(h("h2", { text: "زيارات مثبّتة" }), up.length ? h("div", { class: "grid" }, up.map((v) => h("article", { class: "card item" },
    h("div", { class: "row" }, h("span", { class: "pill good", text: "مثبّتة" }), h("span", { class: "pill grey", text: v.grade })),
    h("h3", { text: v.topic }), h("div", { class: "meta" }, h("span", { text: crDate(v.at) })),
    crWho(visitor(v), "الخريج/ة الزائر/ة"),
    h("div", { class: "row" }, mtCalBtn({ id: v.id, start: v.at, mins: 45, topic: v.topic, place: "المدرسة" }, "زيارة صف: " + v.topic),
      crCanManage(v) || v.by === S.uid ? h("button", { class: "link small danger", type: "button", text: "ألغِ الموعد", onclick: () => confirmBox("تلغي موعد الزيارة؟", async () => { const { id, ...d } = v; if (await setDoc("classvisits", id, { ...d, status: "open", by: null, at: null })) crNote(v.uid === S.uid ? v.by : v.uid, "visit", `انلغى موعد زيارة «${v.topic}»`, "mentoring"); }) }) : null))))
    : empty("ما في زيارات مثبّتة", "اقبل طلب أو عرض من تحت وحدّد موعد."));
  const open = rows.filter((v) => v.status === "open").sort((a, b) => b.createdAt - a.createdAt);
  box.append(h("h2", { text: "طلبات وعروض مفتوحة" }), open.length ? h("div", { class: "grid" }, open.map((v) => h("article", { class: "card item" },
    h("div", { class: "row" }, h("span", { class: v.type === "offer" ? "pill good" : "pill warn", text: v.type === "offer" ? "عرض زيارة" : "طلب زيارة" }), h("span", { class: "pill grey", text: v.grade })),
    h("h3", { text: v.topic }), v.when ? h("div", { class: "small" }, "بيناسب: ", h("b", { text: v.when })) : null,
    crWho(v.uid, rel(v.createdAt)),
    h("div", { class: "row" },
      v.uid !== S.uid ? h("button", { class: "btn sm blue", type: "button", text: v.type === "offer" ? "بدنا الزيارة" : "بزورهم أنا", onclick: () => mtSchedule(v) }) : null,
      rowActions("classvisits", v), crReport("classvisits", v)))))
    : empty("ما في طلبات مفتوحة", "اطلب زيارة لصفك أو اعرض زيارة من النموذج فوق."));
  if (done.length) box.append(h("p", { class: "muted small", text: `صار ${done.length} زيارة من خلال المنصة.` }));
  return box;
}
function mtSchedule(v) {
  if (!guardWrite() || !needProfile()) return;
  const dt = h("input", { type: "datetime-local", id: "mt-v-at", required: true });
  const close = modal(v.type === "offer" ? "ثبّت زيارة الخريج/ة" : "حدّد موعد زيارتك", h("div", { class: "stack cr-form" },
    h("p", { class: "muted", text: "اتفقوا على الموعد مع المعلّم/ة المسؤول/ة قبل ما تثبّتوه هون." }), crField("الموعد", dt),
    h("button", { class: "btn blue", type: "button", text: "ثبّت", onclick: async () => {
      const at = crParseDT(dt.value); if (!at) { toast("اختار موعد"); return; }
      const fresh = await getDoc("classvisits", v.id); if (!fresh || fresh.status !== "open") { close(); toast("انثبّتت قبلك"); return; }
      const { id, ...d } = fresh;
      if (await setDoc("classvisits", id, { ...d, status: "scheduled", by: S.uid, at })) { crNote(v.uid, "visit", `انثبّتت زيارة «${v.topic}»: ${crDate(at)}`, "mentoring"); close(); toast("انثبّتت الزيارة"); }
    } })));
}

// ----- events-based sessions (28, 33, 168) -----
function mtMeetTab() {
  return h("div", { class: "stack" },
    h("section", { class: "section" }, h("h2", { text: "يوم في حياة طالب" }), h("p", { class: "muted", text: "خريج/ة من كل تخصص بيحكي كيف بيمرق يومه: محاضرات، دوام، امتحانات، سكن." }),
      evEmbed(["يوم في حياة طالب"], "بتدرس تخصص وبدك تحكي عنه؟ انشر جلسة «يوم في حياة طالب».", { type: "يوم في حياة طالب", title: "يوم في حياة طالب " })),
    h("section", { class: "section" }, h("h2", { text: "أمسيات «اسأل الخريج»" }), evEmbed(["أمسية اسأل الخريج"], "انشر أمسية لطلاب الثاني عشر.")),
    h("section", { class: "section" }, h("h2", { text: "لقاءات أهالي" }), h("p", { class: "muted", text: "أهالي الطلاب الجدد بيلتقوا بأهالي خريجين: سكن، مصاريف، وكيف تدعم ابنك بأول سنة." }),
      evEmbed(["لقاء أهالي"], "لما ينتشر لقاء أهالي بيظهر هون.")));
}

// ----- view -----
function mtDraw() {
  const box = $("#mt-body"); if (!box) return;
  if (box.contains(document.activeElement) && document.activeElement.matches("input:not([type=checkbox]), textarea, select")) { mtState.dirty = true; return; }
  mtState.dirty = false;
  const fn = { pair: mtPairTab, sessions: mtSessionsTab, counsel: mtCounselTab, visits: mtVisitsTab, meet: mtMeetTab }[mtState.tab] || mtPairTab;
  box.replaceChildren(MT.ready || mtState.tab === "meet" ? fn() : h("p", { class: "muted", text: "جارِ التحميل…" }));
  if (mtState.tab === "meet") evDrawEmbeds();
  if (mtState.tab === "counsel") evDrawEmbeds();
}
views.mentoring = () => {
  const keys = ["reqs", "slots", "bookings", "ratings", "visits"];
  const got = new Set();
  [["mentorreqs", "reqs", 500], ["slots", "slots", 1000], ["bookings", "bookings", 1000], ["ratings", "ratings", 1000], ["classvisits", "visits", 300]].forEach(([col, key, limit]) =>
    onLeave(subscribe(col, { limit }, (rows) => { MT[key] = rows; got.add(key); MT.ready = keys.every((k) => got.has(k)); resolveNames(rows.map((r) => r.uid)); mtDraw(); })));
  const body = h("div", { id: "mt-body", onfocusout: () => setTimeout(() => { if (mtState.dirty && !$("#mt-body")?.contains(document.activeElement)) mtDraw(); }, 0) });
  queueMicrotask(mtDraw);
  return h("div", { class: "view" },
    head("الإرشاد", "خريجين بيرافقوا طلاب", "توأمة مع أخ/أخت كبير/ة، جلسات إرشاد قصيرة، مواعيد مع المستشارة، وزيارات خريجين للصفوف."),
    writeBanner(),
    h("div", { class: "chips", role: "group", "aria-label": "أقسام الإرشاد" }, MT_TABS.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(mtState.tab === k), text: l, onclick: () => { mtState.tab = k; go("mentoring"); } }))),
    body);
};
registerView("mentoring", "career", "الإرشاد", null, { order: 15 });
