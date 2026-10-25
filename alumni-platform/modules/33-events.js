// ---------- events: calendar, registration with capacity + waiting list, management, calendar links ----------
const EV_TYPES = [
  ["لقاء فوج", "لقاء شهري، بالمدرسة أو أونلاين"], ["لمّ شمل", "لمّة الأفواج بالمدرسة"], ["يوم الخريجين", "اليوم السنوي لكل الأفواج"],
  ["يوم مفتوح", "يوم مفتوح بجامعة أو كلية"], ["جولة جامعات", "زيارة منظّمة لمؤسسة"], ["محاضرة", "بالمدرسة أو أونلاين"],
  ["ورشة", "ورشة عامة"], ["ورشة تسجيل للجامعات", "نعبّي طلبات التسجيل سوا"], ["ورشة مهارات حياتية", "ميزانية، عقد إيجار، ضرائب"],
  ["ورشة ريادة أعمال", "من الفكرة للمشروع"], ["يوم مهن", "خريجين بيعرّفوا عن شغلهم بالمدرسة"], ["أمسية اسأل الخريج", "طلاب الثاني عشر بيسألوا الخريجين"],
  ["يوم في حياة طالب", "خريج بيحكي كيف بيمرق يومه بتخصصه"], ["لقاء دعم سنة أولى", "لقاء استماع مع المستشارة أو مرشد"],
  ["لقاء أهالي", "أهالي الطلاب الجدد مع أهالي خريجين"], ["تعارف طلاب جدد", "طلابنا الجدد بنفس المؤسسة"],
  ["معسكر بسيخومتري", "تحضير جماعي بالصيف"], ["رحلة", ""], ["رياضة", "دوري أو مباراة بين الأفواج"], ["تطوع", "مبادرة تطوع بالبلد"],
  ["معرض", "معرض مشاريع تخرج"], ["مسابقة", "مسابقة ثقافية أو غيرها"], ["حفل تكريم", "تكريم خريجين متميزين"],
];
const EV_TYPE_NAMES = EV_TYPES.map((t) => t[0]);
const EV_INST_TYPES = ["يوم مفتوح", "جولة جامعات", "تعارف طلاب جدد"];
const EV_DURS = [[30, "نص ساعة"], [60, "ساعة"], [90, "ساعة ونص"], [120, "ساعتين"], [180, "3 ساعات"], [240, "4 ساعات"], [480, "يوم كامل"]];
const EV_WEEK = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const EV = { events: [], regs: [], ready: false };
const evState = { when: "up", type: "all", inst: "all", q: "", day: null, month: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); })() };

HOOKS.boot.push(() => {
  subscribe("events", { order: "start", dir: "asc", limit: 500 }, (rows) => { EV.events = rows; EV.ready = true; evDrawAll(); });
  subscribe("eventregs", { limit: 3000 }, (rows) => { EV.regs = rows; evDrawAll(); });
});
HOOKS.lists.push(() => evDrawAll());

const evEnd = (e) => e.end || (e.start + 90 * 60000);
const evPast = (e) => evEnd(e) < Date.now();
const evVisible = () => EV.events.filter((e) => e.start && !crHidden("events", e.id));
const evUpcoming = () => evVisible().filter((e) => !evPast(e) && !e.cancelled).sort((a, b) => a.start - b.start);
function evRegs(id) { return EV.regs.filter((r) => r.event === id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); }
// → {regs, going, waiting, mine: null | {i, wait}}
function evStatus(e) {
  const regs = evRegs(e.id), cap = +e.cap || 0;
  const going = cap ? regs.slice(0, cap) : regs, waiting = cap ? regs.slice(cap) : [];
  const i = regs.findIndex((r) => r.uid === S.uid);
  return { regs, going, waiting, cap, mine: i < 0 ? null : { i, wait: cap && i >= cap ? i - cap + 1 : 0 } };
}

// ----- calendar links -----
const evGDate = (ts) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function evDetails(e) { return [e.desc, safeUrl(e.online) ? "رابط الانضمام: " + safeUrl(e.online) : "", "من بوابة الخريجين"].filter(Boolean).join("\n\n"); }
function evGoogleUrl(e) {
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.title) +
    "&dates=" + encodeURIComponent(evGDate(e.start) + "/" + evGDate(evEnd(e))) +
    "&details=" + encodeURIComponent(evDetails(e)) + "&location=" + encodeURIComponent(e.place || safeUrl(e.online) || "");
}
function evIcs(e) {
  const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//alumni-portal//events//AR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    "UID:" + e.id + "@alumni-portal", "DTSTAMP:" + evGDate(Date.now()), "DTSTART:" + evGDate(e.start), "DTEND:" + evGDate(evEnd(e)),
    "SUMMARY:" + esc(e.title), "DESCRIPTION:" + esc(evDetails(e)), "LOCATION:" + esc(e.place || safeUrl(e.online) || ""),
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:" + esc(e.title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
function evCalButtons(e) {
  return [h("a", { class: "btn sm ghost", href: evGoogleUrl(e), target: "_blank", rel: "noopener", text: "أضف لتقويم Google" }),
    CAP.downloads ? h("button", { class: "btn sm ghost", type: "button", text: "ملف تقويم .ics", onclick: async () => { if (await saveFile("event-" + e.id + ".ics", evIcs(e))) toast("انحفظ ملف التقويم"); } }) : null];
}

// ----- registration -----
async function evRegister(e) {
  if (!guardWrite() || !needProfile()) return;
  const st = evStatus(e);
  if (st.mine) return;
  const willWait = st.cap && st.regs.length >= st.cap;
  if (await setDoc("eventregs", e.id + "__" + S.uid, { uid: S.uid, event: e.id, createdAt: Date.now() })) {
    toast(willWait ? "انضفت لقائمة الانتظار. إذا انفتح مكان بنبلّغك" : "تسجّلت! لاقيها بـ «فعالياتي»");
    crNote(e.uid, "event", `${nameOf(S.uid)} ${willWait ? "انضاف لقائمة الانتظار بـ" : "تسجّل لـ"} «${e.title}»`, "events");
  }
}
function evUnregister(e) {
  confirmBox("تلغي تسجيلك بـ «" + e.title + "»؟", async () => {
    const st = evStatus(e);
    const wasGoing = st.mine && !st.mine.wait;
    await delDoc("eventregs", e.id + "__" + S.uid);
    if (wasGoing && st.waiting.length && !evPast(e)) crNote(st.waiting[0].uid, "event", `انفتح إلك مكان بـ «${e.title}». أنت هلّق من المسجّلين.`, "myevents");
  });
}
function evCancel(e) {
  confirmBox("تلغي الفعالية؟ المسجّلين رح يوصلهم إشعار.", async () => {
    const { id, ...data } = e;
    if (await setDoc("events", id, { ...data, cancelled: true, updatedAt: Date.now() })) {
      evRegs(id).slice(0, 80).forEach((r) => crNote(r.uid, "event", `انلغت فعالية «${e.title}» (${crDate(e.start)})`, "myevents"));
      toast("انلغت الفعالية");
    }
  });
}
function evAttendees(e) {
  const st = evStatus(e);
  const row = (r, i, wait) => { const a = S.alumni[r.uid]; return h("tr", null, h("td", { class: "num", text: String(i + 1) }), h("td", null, h("b", { text: nameOf(r.uid) }), " ", crVer(r.uid)),
    h("td", { text: a ? String(a.year) : "" }), h("td", { text: a?.contact || "" }), h("td", null, h("span", { class: wait ? "pill warn" : "pill good", text: wait ? "انتظار" : "مسجّل" }))); };
  const body = h("div", { class: "stack" },
    h("p", { class: "muted", text: `${st.going.length} مسجّل${st.cap ? " من " + st.cap + " مكان" : ""} · ${st.waiting.length} بالانتظار` }),
    st.regs.length ? h("div", { class: "table-wrap" }, h("table", null,
      h("thead", null, h("tr", null, ["#", "الاسم", "الفوج", "تواصل", "الحالة"].map((t) => h("th", { text: t })))),
      h("tbody", null, st.going.map((r, i) => row(r, i, false)), st.waiting.map((r, i) => row(r, st.going.length + i, true)))))
      : empty("لسا ما حدا سجّل", "ابعث رابط المنصة للفوج، والمسجّلين بيظهروا هون."),
    st.regs.length && CAP.downloads ? h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", text: "نزّل القائمة (CSV)", onclick: () => {
      const q = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
      const csv = "\ufeff" + [["#", "الاسم", "الفوج", "تواصل", "الحالة"], ...st.regs.map((r, i) => [i + 1, nameOf(r.uid), S.alumni[r.uid]?.year || "", S.alumni[r.uid]?.contact || "", st.cap && i >= st.cap ? "انتظار" : "مسجّل"])].map((l) => l.map(q).join(",")).join("\r\n");
      saveFile("attendees-" + e.id + ".csv", csv);
    } })) : null);
  modal("المسجّلون: " + e.title, body);
}

// ----- create / edit -----
function evForm(e, preset) {
  e = e || {};
  const type0 = e.type || preset?.type || EV_TYPE_NAMES[0];
  const dur0 = e.end ? Math.round((e.end - e.start) / 60000) : 90;
  const instSel = crSelect("ev-f-inst", INST.map((i) => i.ar), e.inst || "", ["", "اختر المؤسسة"]);
  const instWrap = crField("المؤسسة", instSel);
  const f = h("form", { class: "form cr-form", id: "ev-form" },
    crField("اسم الفعالية", h("input", { type: "text", id: "ev-f-title", required: true, maxlength: 90, value: e.title || preset?.title || "", placeholder: "مثال: أمسية اسأل الخريج – طب وتمريض" }), "full"),
    crField("النوع", h("select", { id: "ev-f-type" }, EV_TYPES.map(([t, d]) => opt(t, d ? t + " – " + d : t, t === type0)))),
    crField("متى", h("input", { type: "datetime-local", id: "ev-f-start", required: true, value: crDTValue(e.start) })),
    crField("المدة", crSelect("ev-f-dur", EV_DURS, EV_DURS.some((d) => d[0] === dur0) ? dur0 : 90)),
    crField("المكان", h("input", { type: "text", id: "ev-f-place", maxlength: 90, value: e.place || "", placeholder: "مثال: قاعة المدرسة، أو اتركه فاضي إذا أونلاين" })),
    crField("رابط أونلاين (Zoom / Meet)", h("input", { type: "url", id: "ev-f-online", maxlength: 300, value: e.online || "", placeholder: "https://" })),
    instWrap,
    crField("عدد الأماكن (0 = بدون حد)", h("input", { type: "number", id: "ev-f-cap", min: 0, max: 5000, value: e.cap ?? 0 })),
    crField("مين بيقدّم (اختياري)", h("input", { type: "text", id: "ev-f-host", maxlength: 80, value: e.host || preset?.host || "", placeholder: "مثال: مستشارة المدرسة" })),
    crField("تفاصيل", h("textarea", { id: "ev-f-desc", maxlength: 1500, text: e.desc || "", placeholder: "لمين الفعالية، شو البرنامج، شو لازم تجيب معك" }), "full"),
    crField("رابط التسجيل المصوّر (للفعاليات اللي صارت)", h("input", { type: "url", id: "ev-f-rec", maxlength: 300, value: e.recording || "", placeholder: "https://youtube.com/…" }), "full"),
    h("div", { class: "full row" }, h("button", { class: "btn blue", type: "submit", text: e.id ? "احفظ التعديلات" : "انشر الفعالية" }),
      h("span", { class: "muted small", text: "انشر بس فعاليات حقيقية متفق عليها مع المنظّمين." })));
  const syncInst = () => { instWrap.hidden = !EV_INST_TYPES.includes($("#ev-f-type", f).value); };
  f.querySelector("#ev-f-type").addEventListener("change", syncInst); syncInst();
  f.addEventListener("submit", async (ev) => {
    ev.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const start = crParseDT($("#ev-f-start", f).value);
    const title = $("#ev-f-title", f).value.trim();
    if (!title || !start) { toast("لازم اسم وموعد"); return; }
    const type = $("#ev-f-type", f).value;
    const data = {
      uid: e.uid || S.uid, title, type, start, end: start + +$("#ev-f-dur", f).value * 60000,
      place: $("#ev-f-place", f).value.trim(), online: safeUrl($("#ev-f-online", f).value) || "",
      inst: EV_INST_TYPES.includes(type) ? $("#ev-f-inst", f).value : "", cap: Math.max(0, +$("#ev-f-cap", f).value || 0),
      host: $("#ev-f-host", f).value.trim(), desc: $("#ev-f-desc", f).value.trim(), recording: safeUrl($("#ev-f-rec", f).value) || "",
      cancelled: !!e.cancelled, createdAt: e.createdAt || Date.now(), updatedAt: Date.now(),
    };
    const ok = e.id ? await setDoc("events", e.id, data) : await addDoc("events", data);
    if (ok) {
      close(); toast(e.id ? "انحفظت التعديلات" : "انتشرت الفعالية");
      if (e.id && e.start !== start) evRegs(e.id).slice(0, 80).forEach((r) => crNote(r.uid, "event", `تغيّر موعد «${title}»: ${crDate(start)}`, "myevents"));
    }
  });
  const close = modal(e.id ? "تعديل فعالية" : "فعالية جديدة", f);
}
function evNew(preset) { if (!guardWrite() || !needProfile()) return; evForm(null, preset); }

// ----- cards -----
function evDateBlock(e) {
  const d = new Date(e.start);
  return h("div", { class: "ev-date", "aria-hidden": "true" }, h("b", { class: "num", text: String(d.getDate()) }), h("span", { text: d.toLocaleDateString(CR_LOC, { month: "short" }) }));
}
function evCard(e, compact) {
  const st = evStatus(e), past = evPast(e);
  const status = e.cancelled ? h("span", { class: "pill warn", text: "انلغت" }) : past ? h("span", { class: "pill grey", text: "صارت" }) : st.mine ? h("span", { class: st.mine.wait ? "pill warn" : "pill good", text: st.mine.wait ? "بالانتظار #" + st.mine.wait : "مسجّل/ة" }) : null;
  const full = st.cap && st.going.length >= st.cap;
  const where = [e.place, safeUrl(e.online) ? "أونلاين" : "", e.inst].filter(Boolean).join(" · ");
  const actions = [];
  if (!compact) {
    if (!past && !e.cancelled) {
      if (st.mine) actions.push(h("button", { class: "btn sm ghost", type: "button", text: st.mine.wait ? "اطلع من الانتظار" : "ألغِ تسجيلي", onclick: () => evUnregister(e) }));
      else actions.push(h("button", { class: "btn sm blue", type: "button", text: full ? "انضم لقائمة الانتظار" : "سجّلني", onclick: () => evRegister(e) }));
      actions.push(...evCalButtons(e));
      if (st.mine && !st.mine.wait && safeUrl(e.online)) actions.push(crLink(e.online, "رابط الانضمام", "btn sm"));
    }
    if (past && safeUrl(e.recording)) actions.push(crLink(e.recording, "تسجيل", "btn sm"));
  }
  const manage = !compact && crCanManage(e) ? h("div", { class: "row ev-manage" },
    h("span", { class: "muted small", text: "إدارة:" }),
    h("button", { class: "link small", type: "button", text: "المسجّلون (" + st.regs.length + ")", onclick: () => evAttendees(e) }),
    h("button", { class: "link small", type: "button", text: past ? "أضف رابط التسجيل / عدّل" : "تعديل", onclick: () => evForm(e) }),
    !past && !e.cancelled ? h("button", { class: "link small danger", type: "button", text: "ألغِ الفعالية", onclick: () => evCancel(e) }) : null,
    rowActions("events", e)) : null;
  return h("article", { class: "card ev-card" + (e.cancelled ? " ev-off" : "") + (compact ? " ev-compact" : "") },
    evDateBlock(e),
    h("div", { class: "ev-body" },
      h("div", { class: "row" }, h("span", { class: "pill", text: e.type }), status),
      h("h3", { text: e.title }),
      h("div", { class: "meta" }, h("span", { text: crDate(e.start) }), !past && !e.cancelled ? h("span", { text: crUntil(e.start) }) : null),
      where ? h("div", { class: "meta" }, h("span", { text: where })) : null,
      !compact && e.host ? h("div", { class: "small" }, "بيقدّم: ", h("b", { text: e.host })) : null,
      !compact && e.desc ? h("p", { class: "ev-desc", text: e.desc }) : null,
      !compact ? h("div", { class: "ev-cap" },
        h("span", { class: "small num", text: st.cap ? `${st.going.length}/${st.cap} مسجّل${st.waiting.length ? " · " + st.waiting.length + " بالانتظار" : ""}` : `${st.regs.length} مسجّل` }),
        st.cap ? h("div", { class: "bar", role: "img", "aria-label": `امتلأ ${Math.min(100, Math.round(st.going.length / st.cap * 100))}% من الأماكن` }, h("i", { style: `width:${Math.min(100, st.going.length / st.cap * 100)}%` })) : null) : null,
      !compact ? h("div", { class: "meta" }, h("span", { text: "نشرها " + nameOf(e.uid) }), crVer(e.uid), crReport("events", e)) : null,
      actions.length ? h("div", { class: "row" }, actions) : null,
      manage,
      compact ? h("button", { class: "link small", type: "button", text: "التفاصيل والتسجيل", onclick: () => evOpen(e) }) : null));
}
function evOpen(e) { evState.open = e.id; modal(e.type, h("div", { class: "stack", id: "ev-open" }, evCard(e))); }
function evDrawOpen() { const box = $("#ev-open"); if (!box) return; const e = EV.events.find((x) => x.id === evState.open); if (e) box.replaceChildren(evCard(e)); }

// ----- the calendar view -----
function evFiltered() {
  const q = evState.q.trim();
  let rows = evVisible().filter((e) => (evState.type === "all" || e.type === evState.type) &&
    (evState.inst === "all" || e.inst === evState.inst) && matches([e.title, e.type, e.place, e.desc, e.inst, e.host].join(" "), q));
  if (evState.day) { const d0 = evState.day, d1 = d0 + 86400000; return rows.filter((e) => e.start >= d0 && e.start < d1).sort((a, b) => a.start - b.start); }
  if (evState.when === "up") rows = rows.filter((e) => !evPast(e)).sort((a, b) => a.start - b.start);
  else if (evState.when === "past") rows = rows.filter((e) => evPast(e)).sort((a, b) => b.start - a.start);
  else if (evState.when === "rec") rows = rows.filter((e) => evPast(e) && safeUrl(e.recording)).sort((a, b) => b.start - a.start);
  return rows;
}
function evMonthGrid() {
  const m0 = new Date(evState.month), y = m0.getFullYear(), mo = m0.getMonth();
  const days = new Date(y, mo + 1, 0).getDate(), lead = new Date(y, mo, 1).getDay();
  const byDay = {};
  evVisible().filter((e) => !e.cancelled && (evState.type === "all" || e.type === evState.type) && (evState.inst === "all" || e.inst === evState.inst)).forEach((e) => {
    const d = new Date(e.start); if (d.getFullYear() === y && d.getMonth() === mo) (byDay[d.getDate()] ||= []).push(e);
  });
  const today = new Date(); const isToday = (d) => today.getFullYear() === y && today.getMonth() === mo && today.getDate() === d;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h("span", { class: "ev-cell ev-blank", "aria-hidden": "true" }));
  for (let d = 1; d <= days; d++) {
    const ts = new Date(y, mo, d).getTime(), list = byDay[d] || [];
    cells.push(h("button", { class: "ev-cell" + (list.length ? " has" : "") + (isToday(d) ? " today" : ""), type: "button", "aria-pressed": String(evState.day === ts),
      "aria-label": `${d} ${m0.toLocaleDateString(CR_LOC, { month: "long" })}: ${list.length ? list.length + " فعالية" : "ما في فعاليات"}`,
      onclick: () => { evState.day = evState.day === ts ? null : ts; evDrawAll(); } },
      h("span", { class: "num", text: String(d) }), list.length ? h("i", { class: "ev-dots", text: list.length > 1 ? String(list.length) : "" }) : null));
  }
  const shift = (n) => { evState.month = new Date(y, mo + n, 1).getTime(); evState.day = null; evDrawAll(); };
  return h("div", { class: "card ev-month" },
    h("div", { class: "spread" },
      h("button", { class: "btn sm ghost", type: "button", "aria-label": "الشهر السابق", text: "→ السابق", onclick: () => shift(-1) }),
      h("h3", { class: "ev-month-t", text: m0.toLocaleDateString(CR_LOC, { month: "long", year: "numeric" }) }),
      h("button", { class: "btn sm ghost", type: "button", "aria-label": "الشهر الجاي", text: "الجاي ←", onclick: () => shift(1) })),
    h("div", { class: "ev-grid", role: "group", "aria-label": "أيام الشهر" }, EV_WEEK.map((w) => h("span", { class: "ev-wd", "aria-hidden": "true", text: w })), cells));
}
function evDrawCalendar() {
  if (!$("#ev-cal")) return;
  crFill("ev-cal", [evMonthGrid()]);
  const rows = evFiltered();
  const title = evState.day ? "فعاليات " + crDate(evState.day, false) : { up: "الفعاليات الجاية", past: "فعاليات صارت", rec: "أرشيف التسجيلات", all: "كل الفعاليات" }[evState.when];
  crFill("ev-list-t", [h("h2", { text: title }), evState.day ? h("button", { class: "chip", type: "button", text: "كل الأيام ✕", onclick: () => { evState.day = null; evDrawAll(); } }) : null]);
  crFill("ev-list", rows.length ? rows.map((e) => evCard(e)) : [!EV.ready ? h("p", { class: "muted", text: "جارِ التحميل…" }) :
    evState.when === "rec" ? empty("لسا ما في تسجيلات", "منظّم الفعالية بيقدر يضيف رابط التسجيل بعد ما تخلص من «أضف رابط التسجيل».")
      : evState.type === "يوم مفتوح" ? empty("ما في أيام مفتوحة منشورة هون", "إذا بتعرف عن يوم مفتوح، أضفه مع اسم المؤسسة والموعد الرسمي من موقعها.")
        : empty("ما في فعاليات هون", "إذا في فعالية متفق عليها، انشرها من «فعالية جديدة» وخلي الكل يسجّل.")]);
}
views.events = () => {
  const whenChips = [["up", "الجاية"], ["past", "صارت"], ["rec", "تسجيلات"], ["all", "الكل"]];
  const typeSel = h("select", { id: "ev-type" }, opt("all", "كل الأنواع", evState.type === "all"), EV_TYPE_NAMES.map((t) => opt(t, t, evState.type === t)));
  const instSel = h("select", { id: "ev-inst" }, opt("all", "كل المؤسسات", evState.inst === "all"), INST.map((i) => opt(i.ar, i.ar, evState.inst === i.ar)));
  const instWrap = crField("المؤسسة", instSel); instWrap.hidden = !EV_INST_TYPES.includes(evState.type);
  const v = h("div", { class: "view" },
    head("الفعاليات", "شو في قريبًا؟", "لقاءات أفواج، أيام مفتوحة، ورشات، محاضرات ورحلات. سجّل، وأضف الموعد لتقويمك بكبسة."),
    writeBanner(),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", text: "فعالية جديدة", onclick: () => evNew() }),
      h("button", { class: "btn ghost", type: "button", "data-go": "myevents", text: "فعالياتي" }),
      h("button", { class: "btn ghost", type: "button", text: "الأيام المفتوحة", onclick: () => { evState.type = "يوم مفتوح"; evState.when = "up"; go("events"); } })),
    h("div", { class: "section" },
      h("div", { class: "chips", role: "group", "aria-label": "الوقت" }, whenChips.map(([k, l]) => h("button", { class: "chip", type: "button", "aria-pressed": String(evState.when === k && !evState.day), text: l, onclick: () => { evState.when = k; evState.day = null; go("events"); } }))),
      h("div", { class: "form" },
        crField("بحث", h("input", { type: "search", id: "ev-q", value: evState.q, placeholder: "اسم فعالية، مكان، مؤسسة" })),
        crField("النوع", typeSel), instWrap),
      h("div", { id: "ev-cal" })),
    h("div", { class: "section" }, h("div", { class: "spread", id: "ev-list-t" }), h("div", { class: "stack", id: "ev-list" })),
  );
  queueMicrotask(() => {
    $("#ev-q")?.addEventListener("input", (e) => { evState.q = e.target.value; evDrawCalendar(); });
    typeSel.addEventListener("change", () => { evState.type = typeSel.value; if (!EV_INST_TYPES.includes(evState.type)) evState.inst = "all"; go("events"); });
    instSel.addEventListener("change", () => { evState.inst = instSel.value; evDrawCalendar(); });
  });
  return v;
};
registerView("events", "events", "التقويم", null, { order: 10 });

// ----- «فعالياتي» in «مساحتي» -----
function evDrawMine() {
  if (!$("#ev-mine")) return;
  const mineIds = new Set(EV.regs.filter((r) => r.uid === S.uid).map((r) => r.event));
  const reg = evVisible().filter((e) => mineIds.has(e.id));
  const up = reg.filter((e) => !evPast(e)).sort((a, b) => a.start - b.start);
  const past = reg.filter((e) => evPast(e)).sort((a, b) => b.start - a.start).slice(0, 20);
  const soon = up.filter((e) => !e.cancelled && e.start - Date.now() < 48 * 3600000);
  const created = evVisible().filter((e) => e.uid === S.uid).sort((a, b) => b.start - a.start);
  crFill("ev-mine-soon", soon.map((e) => h("div", { class: "banner" }, h("span", null, h("b", { text: "تذكير: " }), `«${e.title}» ${crUntil(e.start)}، ${crTime(e.start)}${e.place ? " · " + e.place : ""}`))));
  crFill("ev-mine", up.length ? up.map((e) => evCard(e)) : [empty("ما سجّلت لأي فعالية جاية", "افتح «التقويم» واختار فعالية تناسبك.")]);
  crFill("ev-mine-past", past.length ? past.map((e) => evCard(e, true)) : [h("p", { class: "muted small", text: "الفعاليات اللي حضرتها بتظهر هون، مع رابط التسجيل إذا انضاف." })]);
  crFill("ev-mine-made", created.length ? created.map((e) => evCard(e)) : [h("p", { class: "muted small", text: "ما نشرت فعاليات لسا." })]);
}
views.myevents = () => h("div", { class: "view" },
  head("مساحتي", "فعالياتي", "الفعاليات اللي سجّلت إلها، تذكير قبل يومين، والفعاليات اللي نظّمتها."),
  h("div", { class: "stack", id: "ev-mine-soon" }),
  h("section", { class: "section" }, h("div", { class: "spread" }, h("h2", { text: "جاية" }), h("button", { class: "link", type: "button", "data-go": "events", text: "كل الفعاليات" })), h("div", { class: "stack", id: "ev-mine" })),
  h("section", { class: "section" }, h("h2", { text: "نظّمتها أنا" }), h("div", { class: "stack", id: "ev-mine-made" })),
  h("section", { class: "section" }, h("h2", { text: "حضرتها" }), h("div", { class: "grid", id: "ev-mine-past" })));
registerView("myevents", "me", "فعالياتي", null, { order: 30 });

// ----- embedded lists of chosen types (career day, mentoring sessions…) -----
// Usage: evEmbed(["يوم مهن", "ورشة ريادة أعمال"], "نص الفراغ") → element that refreshes itself.
function evEmbed(types, emptyText, preset) {
  return h("div", { class: "stack", "data-ev-types": types.join("|"), "data-ev-empty": emptyText || "", "data-ev-preset": preset ? JSON.stringify(preset) : "" });
}
function evDrawEmbeds() {
  document.querySelectorAll("[data-ev-types]").forEach((box) => {
    const types = box.getAttribute("data-ev-types").split("|");
    const rows = evUpcoming().filter((e) => types.includes(e.type));
    const preset = box.getAttribute("data-ev-preset");
    box.replaceChildren(...(rows.length ? rows.slice(0, 6).map((e) => evCard(e, true)) : [empty("ما في مواعيد جاية", box.getAttribute("data-ev-empty") || "انشر أول موعد.")]),
      h("div", { class: "row" }, h("button", { class: "btn sm ghost", type: "button", text: "انشر موعد جديد", onclick: () => evNew(preset ? JSON.parse(preset) : { type: types[0] }) })));
  });
}

// ----- home widget + search -----
registerHome(() => h("section", { class: "section" },
  h("div", { class: "spread" }, h("h2", { text: "فعاليات جاية" }), h("button", { class: "link", type: "button", "data-go": "events", text: "التقويم" })),
  h("div", { class: "stack", id: "ev-home" })), 30);
function evDrawHome() {
  if (!$("#ev-home")) return;
  const rows = evUpcoming().slice(0, 3);
  crFill("ev-home", rows.length ? rows.map((e) => evCard(e, true)) : [empty("لسا ما في فعاليات جاية", "إذا بتنظّم لقاء فوج أو ورشة، انشره من قسم «الفعاليات».")]);
}
registerSearch("الفعاليات", (q) => evVisible().filter((e) => matches([e.title, e.type, e.place, e.inst, e.host].join(" "), q))
  .sort((a, b) => evPast(a) - evPast(b) || a.start - b.start).slice(0, 8)
  .map((e) => ({ title: e.title, sub: e.type + " · " + crDate(e.start, false), go: "events", onOpen: () => evOpen(e) })));

function evDrawAll() { evDrawOpen(); evDrawCalendar(); evDrawMine(); evDrawEmbeds(); evDrawHome(); }
