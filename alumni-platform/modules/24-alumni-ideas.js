// alumni
const alState = { q: "", year: "all", mentor: false };
views.alumni = () => {
  const years = [...new Set(Object.values(S.alumni).map((a) => a.year))].sort((a, b) => b - a);
  const v = h("div", { class: "view" },
    head("كل الأفواج", "مين وين؟", "دليل خريجي المدرسة على مدار السنين: شو بيدرسوا، وين، ومين جاهز يساعد."),
    writeBanner(),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: openProfile, text: S.alumni[S.uid] ? "عدّل ملفك" : "أضف حالك للدليل" })),
    h("div", { class: "form" },
      h("label", { class: "field" }, h("span", { text: "بحث بالاسم، المؤسسة، التخصص أو البلد" }), h("input", { type: "search", id: "al-q", value: alState.q })),
      h("label", { class: "field" }, h("span", { text: "الفوج" }), h("select", { id: "al-year" }, opt("all", "كل الأفواج", alState.year === "all"), years.map((y) => opt(y, "فوج " + y, String(alState.year) === String(y))))),
      h("label", { class: "check", style: "align-self:end;padding-bottom:8px" }, h("input", { type: "checkbox", id: "al-mentor", checked: alState.mentor ? true : null }), "المتاحين للمساعدة فقط")),
    h("div", { class: "grid", id: "al-list" }),
  );
  queueMicrotask(() => {
    $("#al-q").addEventListener("input", (e) => { alState.q = e.target.value; renderLists(); });
    $("#al-year").addEventListener("change", (e) => { alState.year = e.target.value; renderLists(); });
    $("#al-mentor").addEventListener("change", (e) => { alState.mentor = e.target.checked; renderLists(); });
  });
  return v;
};

// ideas
const ideaState = { cat: "all", q: "", built: false };
views.ideas = () => {
  const total = IDEAS.reduce((s, g) => s + g.items.length, 0);
  const built = IDEAS.reduce((s, g) => s + g.items.filter((x) => x[0] === "*").length, 0);
  const list = h("div", { class: "stack", id: "idea-list" });
  const v = h("div", { class: "view" },
    head("خطة تطوير المنصة", `${total} فكرة للمنصة`, `أفكار لتطوير بوابة الخريجين، مقسّمة على ${IDEAS.length} محور. ${built} منها موجودة بهذه النسخة ومعلّمة بـ «موجود».`),
    h("div", { class: "form" },
      h("label", { class: "field" }, h("span", { text: "بحث بالأفكار" }), h("input", { type: "search", id: "id-q", value: ideaState.q })),
      h("label", { class: "field" }, h("span", { text: "المحور" }), h("select", { id: "id-cat" }, opt("all", "كل المحاور", true), IDEAS.map((g, i) => opt(i, `${g.c} (${g.items.length})`)))),
      h("label", { class: "check", style: "align-self:end;padding-bottom:8px" }, h("input", { type: "checkbox", id: "id-built" }), "الموجود فقط")),
    list);
  const draw = () => {
    const q = ideaState.q.trim(); let n = 0; const out = [];
    IDEAS.forEach((g, gi) => {
      const items = g.items.map((t) => ({ done: t[0] === "*", t: t.replace(/^\*/, ""), n: ++n }))
        .filter((x) => (ideaState.cat === "all" || +ideaState.cat === gi) && (!ideaState.built || x.done) && (!q || x.t.includes(q)));
      if (!items.length) return;
      out.push(h("section", { class: "section" }, h("h2", { text: g.c }),
        h("ul", { class: "idea-list" }, items.map((x) => h("li", null, h("span", { class: "n", text: x.n }), h("span", { class: "t", text: x.t }), x.done ? h("span", { class: "pill good", text: "موجود" }) : null)))));
    });
    list.replaceChildren(...(out.length ? out : [empty("ما في أفكار مطابقة", "جرّب كلمة ثانية.")]));
  };
  queueMicrotask(() => {
    $("#id-q").addEventListener("input", (e) => { ideaState.q = e.target.value; draw(); });
    $("#id-cat").addEventListener("change", (e) => { ideaState.cat = e.target.value; draw(); });
    $("#id-built").addEventListener("change", (e) => { ideaState.built = e.target.checked; draw(); });
    draw();
  });
  return v;
};

registerView("alumni", "community", "دليل الأفواج", null, { order: 20 });
registerView("ideas", "ideas", "أفكار التطوير", null, { order: 0 });
