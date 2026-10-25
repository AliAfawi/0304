// community: «وين خريجينا؟» counts by region / institution / field / status, drawn as accessible bars from S.alumni
const whState = { year: "all" };
function whInst(place) {
  const p = norm(place).trim(); if (!p) return null;
  return INST.find((i) => { const a = norm(i.ar), he = norm(i.he); return p === a || p.includes(a) || a.includes(p) || p.includes(he); }) || null;
}
function whCount(list, keyFn, top, qFn) {
  const m = new Map();
  for (const a of list) {
    const k = keyFn(a); if (!k) continue;
    const id = norm(k).trim();
    const g = m.get(id) || { label: k, n: 0, q: qFn ? qFn(a) : k }; g.n++; m.set(id, g);
  }
  let rows = [...m.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "ar"));
  if (top && rows.length > top) {
    const rest = rows.slice(top);
    rows = [...rows.slice(0, top), { label: `غيرها (${rest.length})`, n: rest.reduce((s, r) => s + r.n, 0), other: true }];
  }
  return rows;
}
function whBars(title, rows, total, note) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return h("section", { class: "card stack cm-bars-card" },
    h("h3", { text: title }), note ? h("p", { class: "muted small", style: "margin:0", text: note }) : null,
    rows.length ? h("ul", { class: "cm-bars" }, rows.map((r) => {
      const pct = Math.round((r.n / total) * 100);
      const inner = [h("span", { class: "cm-bar-label", text: r.label }), h("span", { class: "cm-bar-num num", text: `${r.n} · ${pct}%` }),
        h("span", { class: "cm-bar-track", "aria-hidden": "true" }, h("i", { style: `width:${(r.n / max) * 100}%` }))];
      return h("li", null, r.other || r.none ? h("div", { class: "cm-bar-row" }, inner)
        : h("button", { class: "cm-bar-row", type: "button", title: "شوف مين بالدليل", onclick: () => { alState.q = r.q || r.label; alState.year = whState.year; go("alumni"); } }, inner));
    })) : h("p", { class: "muted small", text: "ما في معلومات كفاية لهون لسا." }));
}
views["cm-where"] = () => {
  const years = [...new Set(Object.values(S.alumni).map((a) => a.year))].sort((a, b) => b - a);
  return h("div", { class: "view" },
    head("أين خريجونا", "وين صاروا خريجينا؟", "صورة بالأرقام من ملفات الخريجين بالدليل: بأي منطقة، بأي مؤسسة وبأي تخصص. كل ما ينضم حدا للدليل، الأرقام بتتحدّث."),
    h("div", { class: "row" },
      h("label", { class: "field", style: "min-width:200px" }, h("span", { text: "الفوج" }),
        h("select", { id: "wh-year", onchange: (e) => { whState.year = e.target.value; renderLists(); } }, opt("all", "كل الأفواج", whState.year === "all"), years.map((y) => opt(String(y), "فوج " + y, String(whState.year) === String(y))))),
      h("button", { class: "btn ghost", type: "button", style: "align-self:end", onclick: openProfile, text: S.alumni[S.uid] ? "حدّث ملفك" : "أضف حالك للأرقام" })),
    h("div", { class: "stack", id: "wh-body" }));
};
HOOKS.lists.push(() => {
  const el = $("#wh-body");
  cmDraw(el, [S.alumni, S.mod, whState.year], () => {
    const all = Object.values(S.alumni).filter((a) => !cmHidden("alumni", a.uid) && (whState.year === "all" || String(a.year) === String(whState.year)));
    if (!all.length) return [empty(whState.year === "all" ? "لسا ما في خريجين بالدليل" : "ما في حدا من هالفوج بالدليل لسا", "أول ما يضيف الخريجين ملفاتهم (المؤسسة والتخصص)، بتظهر هون الصورة كاملة.")];
    const n = all.length;
    const region = whCount(all, (a) => { const i = whInst(a.place); return i ? i.r : a.place ? "مكان مش من قائمة المؤسسات" : "ما كتبوا مكان"; });
    region.forEach((r) => { r.none = true; });
    const inst = whCount(all, (a) => { const i = whInst(a.place); return i ? i.ar : a.place; }, 12, (a) => a.place);
    const field = whCount(all, (a) => a.field, 12);
    const status = whCount(all, (a) => a.status);
    const withPlace = all.filter((a) => a.place).length, withField = all.filter((a) => a.field).length;
    return [
      h("div", { class: "grid-3" },
        h("div", { class: "stat" }, h("b", { text: n }), h("span", { text: "بالدليل" })),
        h("div", { class: "stat" }, h("b", { text: inst.filter((r) => !r.other).length + (inst.find((r) => r.other) ? "+" : "") }), h("span", { text: "مؤسسة ومكان" })),
        h("div", { class: "stat" }, h("b", { text: all.filter((a) => a.mentor).length }), h("span", { text: "متاح للمساعدة" }))),
      h("div", { class: "cm-bars-grid" },
        whBars("حسب المنطقة", region, n, "المنطقة محسوبة من اسم المؤسسة إذا كانت بقائمة الجامعات والكليات."),
        whBars("حسب المؤسسة أو مكان العمل", inst, withPlace || 1, `من ${withPlace} كتبوا وين بيدرسوا أو بيشتغلوا.`),
        whBars("حسب التخصص أو المجال", field, withField || 1, `من ${withField} كتبوا تخصصهم.`),
        whBars("حسب الوضع اليوم", status, n)),
      h("p", { class: "muted small", text: "الأرقام بتعكس بس اللي أضافوا حالهم للدليل، مش كل خريجي المدرسة. اضغط على أي سطر لتشوف الأسماء بدليل الأفواج." }),
    ];
  });
});
registerView("cm-where", "community", "أين خريجونا", null, { order: 70 });
