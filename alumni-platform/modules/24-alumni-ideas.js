// alumni
const alState = { q: "", year: "all", mentor: false, verified: false };
views.alumni = () => {
  const years = [...new Set(Object.values(S.alumni).map((a) => a.year))].sort((a, b) => b - a);
  const v = h("div", { class: "view" },
    head("كل الأفواج", "مين وين؟", "دليل خريجي المدرسة على مدار السنين: شو بيدرسوا، وين، ومين جاهز يساعد."),
    writeBanner(),
    h("div", { class: "row" }, h("button", { class: "btn blue", type: "button", onclick: openProfile, text: S.alumni[S.uid] ? "عدّل ملفك" : "أضف حالك للدليل" }),
      h("button", { class: "btn ghost", type: "button", "data-go": "cm-where", text: "وين خريجينا؟ بالأرقام" })),
    h("div", { class: "form" },
      h("label", { class: "field" }, h("span", { text: "بحث بالاسم، المؤسسة، التخصص أو البلد" }), h("input", { type: "search", id: "al-q", value: alState.q })),
      h("label", { class: "field" }, h("span", { text: "الفوج" }), h("select", { id: "al-year" }, opt("all", "كل الأفواج", alState.year === "all"), years.map((y) => opt(y, "فوج " + y, String(alState.year) === String(y))))),
      h("label", { class: "check", style: "align-self:end;padding-bottom:8px" }, h("input", { type: "checkbox", id: "al-mentor", checked: alState.mentor ? true : null }), "المتاحين للمساعدة فقط"),
      h("label", { class: "check", style: "align-self:end;padding-bottom:8px" }, h("input", { type: "checkbox", id: "al-verified", checked: alState.verified ? true : null }), "الموثّقين فقط")),
    h("p", { class: "muted small", id: "al-count", "aria-live": "polite" }),
    h("div", { class: "grid", id: "cm-al-list" }),
  );
  queueMicrotask(() => {
    $("#al-q").addEventListener("input", (e) => { alState.q = e.target.value; renderLists(); });
    $("#al-year").addEventListener("change", (e) => { alState.year = e.target.value; renderLists(); });
    $("#al-mentor").addEventListener("change", (e) => { alState.mentor = e.target.checked; renderLists(); });
    $("#al-verified").addEventListener("change", (e) => { alState.verified = e.target.checked; renderLists(); });
  });
  return v;
};
function alCard(a) {
  return h("article", { class: "card item" },
    h("div", { class: "row" }, avatar(a.name, a.uid), h("div", { style: "min-width:0;flex:1" },
      h("div", { class: "row" }, h("h3", { text: a.name }), cmVerified(a.uid)),
      h("div", { class: "muted small", text: `فوج ${a.year}${a.city ? " · " + a.city : ""}` }))),
    h("div", { class: "row" }, a.status ? h("span", { class: "pill grey", text: a.status }) : null, a.mentor ? h("span", { class: "pill good", text: "متاح للمساعدة" }) : null),
    a.place || a.field ? h("p", { text: [a.field, a.place].filter(Boolean).join(" · ") }) : null,
    a.bio ? h("p", { class: "muted", text: a.bio }) : null,
    a.contact ? h("span", { class: "small", style: "overflow-wrap:anywhere" }, "تواصل: ", h("b", { text: a.contact })) : null,
    a.uid === S.uid ? h("button", { class: "link small", type: "button", onclick: openProfile, text: "عدّل ملفي" }) : null);
}
HOOKS.lists.push(() => {
  const al = $("#cm-al-list"); if (!al) return;
  cmDraw(al, [S.alumni, S.mod, alState.q, alState.year, alState.mentor, alState.verified], () => {
    const q = alState.q.trim();
    const rows = Object.values(S.alumni).filter((a) => !cmHidden("alumni", a.uid) && (alState.year === "all" || String(a.year) === String(alState.year))
      && (!alState.mentor || a.mentor) && (!alState.verified || isMod("verified", a.uid)) && matches([a.name, a.place, a.field, a.city, a.status].join(" "), q))
      .sort((a, b) => b.year - a.year || (a.name || "").localeCompare(b.name || "", "ar"));
    const c = $("#al-count"); if (c) c.textContent = rows.length ? `${rows.length} من ${Object.keys(S.alumni).length} بالدليل` : "";
    if (rows.length) return rows.map(alCard);
    return [Object.keys(S.alumni).length ? empty("ما في حدا بهالبحث", "جرّب كلمة ثانية أو شيل الفلاتر.") : empty("الدليل فاضي لسا", "أضف حالك للدليل، وابعث الرابط لفوجك عشان ينضمّوا.")];
  });
});
registerSearch("الخريجين", (q) => Object.values(S.alumni).filter((a) => !cmHidden("alumni", a.uid) && matches([a.name, a.place, a.field, a.city].join(" "), q)).slice(0, 8)
  .map((a) => ({ title: a.name, sub: [`فوج ${a.year}`, a.field, a.place].filter(Boolean).join(" · "), go: "alumni", onOpen: () => { alState.q = a.name; alState.year = "all"; } })));

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

registerView("alumni", "community", "الأفواج", null, { order: 20 });
registerView("ideas", "ideas", "أفكار التطوير", null, { order: 0 });
