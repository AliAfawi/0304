// library
const libState = { subject: "all", kind: "all", q: "" };
views.library = () => {
  const f = h("form", { class: "card form" },
    h("label", { class: "field full" }, h("span", { text: "العنوان" }), h("input", { type: "text", id: "m-title", required: true, maxlength: 120, placeholder: "مثال: ملخص بيولوجيا – الخلية، 5 وحدات" })),
    h("label", { class: "field" }, h("span", { text: "الموضوع" }), h("select", { id: "m-subject" }, SUBJECTS.map((s) => opt(s)))),
    h("label", { class: "field" }, h("span", { text: "النوع" }), h("select", { id: "m-kind" }, KINDS.map((s) => opt(s)))),
    h("label", { class: "field" }, h("span", { text: "المستوى / الوحدات" }), h("input", { type: "text", id: "m-level", maxlength: 40, placeholder: "مثال: 5 وحدات" })),
    h("label", { class: "field full" }, h("span", { text: "الرابط (Google Drive أو غيره، مفتوح للمشاهدة)" }), h("input", { type: "url", id: "m-url", required: true, maxlength: 500, placeholder: "https://drive.google.com/…" })),
    h("label", { class: "field full" }, h("span", { text: "ملاحظة (اختياري)" }), h("input", { type: "text", id: "m-note", maxlength: 200 })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: "شارك المادة" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const url = safeUrl($("#m-url").value); if (!url) { toast("الرابط لازم يبلّش بـ https://"); return; }
    const ok = await addDoc("materials", { uid: S.uid, title: $("#m-title").value.trim(), subject: $("#m-subject").value, kind: $("#m-kind").value, level: $("#m-level").value.trim(), url, note: $("#m-note").value.trim(), createdAt: Date.now() });
    if (ok) { f.reset(); toast("انضافت المادة"); }
  });
  const v = h("div", { class: "view" },
    head("مكتبة الخريجين", "مواد، امتحانات ومساعدات", "ملخصات وامتحانات سابقة وحلول، بيشاركها الخريجون لطلاب المدرسة وللأفواج الجاية."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ شارك مادة" }), f),
    h("div", { class: "form" },
      h("label", { class: "field" }, h("span", { text: "بحث" }), h("input", { type: "search", id: "lib-q", value: libState.q })),
      h("label", { class: "field" }, h("span", { text: "الموضوع" }), h("select", { id: "lib-subject" }, opt("all", "كل المواضيع", libState.subject === "all"), SUBJECTS.map((s) => opt(s, s, libState.subject === s)))),
      h("label", { class: "field" }, h("span", { text: "النوع" }), h("select", { id: "lib-kind" }, opt("all", "كل الأنواع", libState.kind === "all"), KINDS.map((s) => opt(s, s, libState.kind === s))))),
    h("div", { class: "grid", id: "lib-list" }),
  );
  queueMicrotask(() => {
    $("#lib-q").addEventListener("input", (e) => { libState.q = e.target.value; renderLists(); });
    $("#lib-subject").addEventListener("change", (e) => { libState.subject = e.target.value; renderLists(); });
    $("#lib-kind").addEventListener("change", (e) => { libState.kind = e.target.value; renderLists(); });
  });
  return v;
};

// tutors
let tutorType = "offer", tutorFilter = "all";
views.tutors = () => {
  const isOffer = tutorType === "offer";
  const f = h("form", { class: "card form" },
    h("div", { class: "chips full" },
      h("button", { class: "chip", type: "button", "aria-pressed": String(isOffer), onclick: () => { tutorType = "offer"; go("tutors"); }, text: "بعلّم درس" }),
      h("button", { class: "chip", type: "button", "aria-pressed": String(!isOffer), onclick: () => { tutorType = "request"; go("tutors"); }, text: "بحتاج مساعدة" })),
    h("label", { class: "field" }, h("span", { text: "الموضوع" }), h("select", { id: "t-subject" }, SUBJECTS.map((s) => opt(s)))),
    h("label", { class: "field" }, h("span", { text: "المستوى" }), h("input", { type: "text", id: "t-level", maxlength: 40, placeholder: "مثال: 4-5 وحدات" })),
    isOffer ? h("label", { class: "field" }, h("span", { text: "السعر للساعة (₪، اكتب 0 إذا مجاني)" }), h("input", { type: "number", id: "t-price", min: 0, max: 1000, value: 0 })) : null,
    h("label", { class: "field" }, h("span", { text: "الطريقة" }), h("select", { id: "t-mode" }, opt("وجهًا لوجه"), opt("أونلاين"), opt("الطريقتين"))),
    h("label", { class: "field" }, h("span", { text: "المنطقة / البلد" }), h("input", { type: "text", id: "t-area", maxlength: 40 })),
    h("label", { class: "field" }, h("span", { text: "طريقة تواصل" }), h("input", { type: "text", id: "t-contact", maxlength: 80, placeholder: "إنستغرام أو إيميل" })),
    h("label", { class: "field full" }, h("span", { text: isOffer ? "عن الدرس" : "شو بتحتاج بالضبط؟" }), h("textarea", { id: "t-note", maxlength: 600 })),
    h("div", { class: "full" }, h("button", { class: "btn blue", type: "submit", text: isOffer ? "أضف عرض الدرس" : "أضف الطلب" })));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!guardWrite() || !needProfile()) return;
    const ok = await addDoc("tutors", { uid: S.uid, type: tutorType, subject: $("#t-subject").value, level: $("#t-level").value.trim(), price: isOffer ? Math.max(0, +$("#t-price").value || 0) : null, mode: $("#t-mode").value, area: $("#t-area").value.trim(), contact: $("#t-contact").value.trim(), note: $("#t-note").value.trim(), createdAt: Date.now() });
    if (ok) { f.reset(); toast("انضاف"); }
  });
  return h("div", { class: "view" },
    head("دروس خصوصية ومساعدات", "خريج بيعلّم، وطالب بيتعلّم", "الخريجون بيعرضوا دروس (مدفوعة أو تطوعية)، وطلاب المدرسة بيطلبوا مساعدة بموضوع معيّن."),
    writeBanner(),
    h("details", { class: "section" }, h("summary", { class: "btn ghost", style: "width:max-content", text: "+ أضف عرض أو طلب" }), f),
    h("div", { class: "chips" }, [["all", "الكل"], ["offer", "عروض دروس"], ["request", "طلبات مساعدة"], ["free", "مجاني"]].map(([k, l]) =>
      h("button", { class: "chip", type: "button", "aria-pressed": String(tutorFilter === k), onclick: () => { tutorFilter = k; go("tutors"); }, text: l }))),
    h("div", { class: "grid", id: "tutor-list" }),
  );
};

registerView("library", "learn", "المواد والامتحانات", null, { order: 10 });
registerView("tutors", "learn", "دروس ومساعدة", null, { order: 20 });
