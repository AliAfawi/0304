/* دُروب V9 — فكرة ٢: المساهمة، وفكرة ٦: الحفظ للعمل دون اتصال.

   الموقع ثابت بلا خادم، فالمساهمة تُبنى كبيانات منظّمة ثم تُسلَّم بثلاث طرق
   يختارها الزائر: نسخ النص، أو تنزيله ملفًا، أو فتح بلاغ مُعبّأ على GitHub.
   لا شيء يُرسل تلقائيًا، ولا تُجمع أي بيانات عن الزائر. */
(function (w) {
  'use strict';
  const D = w.D;
  const { $, $$, esc, icon } = D;

  const REPO = 'AliAfawi/0304';

  const FIELDS = [
    { id: 'start', label: 'نقطة الانطلاق والمواقف', hint: 'أين تركن السيارة بالضبط، وهل الطريق معبّد، وإحداثية إن أمكن' },
    { id: 'hours', label: 'ساعات الزيارة', hint: 'ما رأيته على اللافتة أو سمعته هاتفيًا، مع تاريخ تحقّقك' },
    { id: 'story', label: 'حكاية المكان', hint: 'لمن سُمّي، أي قرية كانت هنا، اسمه المحلي، ومن أين عرفت ذلك' },
    { id: 'route', label: 'المسار: مسافة أو مدة أو ملف GPX', hint: 'ما مشيته أنت، وبأي جهاز سجّلته' },
    { id: 'photo', label: 'صورة التقطتها', hint: 'أرفقها بالبلاغ على GitHub، واذكر تاريخها' },
    { id: 'fix', label: 'تصحيح معلومة خاطئة', hint: 'ما الخطأ، وما الصواب، وما مصدرك' }
  ];

  let field = 'start';
  let place = null;

  function render(preselect) {
    const body = $('#contributeBody');
    if (!body) return;
    body.innerHTML = `
      <p class="note" style="margin-bottom:12px">
        عن: <b>${esc(place ? place.n : 'الموقع عمومًا')}</b>${place ? ' · ' + esc(place.zoneName) : ''}
      </p>
      <div class="f-group"><label>نوع المساهمة</label>
        <div class="f-opts">${FIELDS.map(f =>
          `<button type="button" class="f-opt" data-cfield="${esc(f.id)}">${esc(f.label)}</button>`
        ).join('')}</div>
      </div>
      <label class="field"><span id="contribHint"></span>
        <textarea id="contribText" rows="5" maxlength="2000" placeholder="اكتب ما تعرفه بدقّة…"></textarea></label>
      <label class="field"><span>مصدرك — اختياري، لكنه يرفع قيمة المساهمة كثيرًا</span>
        <input type="text" id="contribSource" maxlength="200" placeholder="مثلًا: زرته بتاريخ…، أو لافتة في الموقع، أو كتاب"></label>
      <div class="map-tools">
        <button type="button" data-act="contrib-github">${icon('link')} افتح بلاغًا على GitHub</button>
        <button type="button" data-act="contrib-copy">${icon('bookmark')} انسخ النص</button>
        <button type="button" data-act="contrib-file">${icon('download')} نزّله ملفًا</button>
      </div>
      <p class="note" style="margin-top:12px">
        لا نرسل شيئًا نيابةً عنك ولا نجمع بياناتك؛ أنت تختار كيف تُرسل مساهمتك.
        وتبقى موسومة بـ«من زائر — غير متحقَّق» حتى تُراجَع.
      </p>`;
    select(preselect || 'start');
  }

  function select(id) {
    const f = FIELDS.find(x => x.id === id) || FIELDS[0];
    field = f.id;
    $$('#contributeBody [data-cfield]').forEach(b => b.classList.toggle('on', b.dataset.cfield === f.id));
    const hint = $('#contribHint');
    if (hint) hint.textContent = f.label + ' — ' + f.hint;
  }

  function payload() {
    const f = FIELDS.find(x => x.id === field) || FIELDS[0];
    const textEl = $('#contribText'), srcEl = $('#contribSource');
    return {
      app: 'doroub', kind: 'contribution',
      place: place ? { id: place.id, name: place.n, zone: place.zoneName } : null,
      field: f.id, fieldLabel: f.label,
      text: (textEl ? textEl.value : '').trim(),
      source: (srcEl ? srcEl.value : '').trim(),
      submittedAt: new Date().toISOString().slice(0, 10),
      status: 'من زائر — غير متحقَّق'
    };
  }

  function asText() {
    const d = payload();
    return 'مساهمة في دُروب\n'
      + 'المكان: ' + (d.place ? d.place.name + ' (' + d.place.id + ')' : 'عام') + '\n'
      + 'النوع: ' + d.fieldLabel + '\n\n'
      + d.text + '\n\n'
      + (d.source ? 'المصدر: ' + d.source + '\n' : '')
      + 'التاريخ: ' + d.submittedAt + '\n'
      + 'الحالة: ' + d.status + '\n';
  }

  function valid() {
    const d = payload();
    if (d.text.length < 10) { D.toast('اكتب المعلومة أولًا (١٠ أحرف على الأقل)'); return null; }
    return d;
  }

  function toGithub() {
    const d = valid();
    if (!d) return;
    const title = 'مساهمة: ' + d.fieldLabel + (d.place ? ' — ' + d.place.name : '');
    const url = 'https://github.com/' + REPO + '/issues/new'
      + '?title=' + encodeURIComponent(title)
      + '&body=' + encodeURIComponent(asText());
    w.open(url, '_blank', 'noopener');
  }

  function toClipboard() {
    if (!valid()) return;
    const text = asText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => D.toast('نُسخت المساهمة')).catch(() => D.toast('تعذّر النسخ'));
    } else D.toast('تعذّر النسخ في هذا المتصفح');
  }

  function toFile() {
    const d = valid();
    if (!d) return;
    const blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doroub-contribution-' + d.submittedAt + '.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    D.toast('نُزّلت المساهمة ملفًا');
  }

  function open(target, preselect) {
    place = target || null;
    render(preselect);
    $('#contributeSheet').classList.add('open');
    document.body.classList.add('is-locked');
  }

  function close() {
    $('#contributeSheet').classList.remove('open');
  }

  /* ---------- فكرة ٦: الحفظ للعمل دون اتصال ---------- */
  const KEY = 'doroub8-offline';
  const CACHE = 'doroub-offline-places';
  const list = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const persist = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } };

  async function save(target) {
    if (!target || !w.caches) { D.toast('متصفحك لا يدعم الحفظ دون اتصال'); return; }
    try {
      const cache = await caches.open(CACHE);
      const urls = [location.pathname];
      const img = document.querySelector('.detail-hero img');
      if (img && img.src) urls.push(img.src);
      await Promise.all(urls.map(u => cache.add(u).catch(() => { })));
      const saved = list();
      if (!saved.includes(target.id)) { saved.push(target.id); persist(saved); }
      state(target);
      D.toast('حُفظ المكان للعمل دون اتصال');
    } catch (e) {
      D.toast('تعذّر الحفظ دون اتصال');
    }
  }

  function forget(target) {
    if (!target) return;
    persist(list().filter(id => id !== target.id));
    state(target);
    D.toast('حُذف من المحفوظات');
  }

  function state(target) {
    const el = $('#offlineState');
    if (!el || !target) return;
    const all = list();
    el.textContent = all.includes(target.id)
      ? `محفوظ ✓ — مع ${all.length} مكانًا على هذا الجهاز.`
      : 'غير محفوظ بعد.';
  }

  w.DContribute = { open, close, select, toGithub, toClipboard, toFile };
  w.DOffline = { save, forget, state, list };
})(window);
