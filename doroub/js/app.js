/* دُروب V8 — الهيكل: أربع شاشات، بحث واحد، ورقة فلاتر واحدة، وصفحة مكان واحدة. */
(function (w) {
  'use strict';
  const D = w.D, P = w.DPhotos, M = w.DMap, Detail = w.DDetail;
  const { $, $$, esc, icon, state, store } = D;

  /* ===================== بطاقات مشتركة ===================== */
  function placeCard(p) {
    const fav = !!store.favorites[p.id];
    const dist = state.sort === 'near' && state.pos && D.latLng(p) ? D.distanceTo(p) : null;
    return `<article class="place-card" data-open="${esc(p.id)}" role="button" tabindex="0">
      ${P.box(p)}
      <div class="pc-tags">
        <span class="chip-glass">${esc(p.zoneName)}</span>
        ${dist != null ? `<span class="chip-glass">${dist.toFixed(0)} كم جوًا</span>` : ''}
      </div>
      <button type="button" class="pc-fav ${fav ? 'on' : ''}" data-fav="${esc(p.id)}"
        aria-label="${fav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}">${icon('heart')}</button>
      <div class="pc-body">
        <span class="pc-kicker">${icon('pin')} ${esc(p.kindLabel)}</span>
        <h3>${esc(p.n)}</h3>
        <div class="pc-en">${esc(p.en || '')}</div>
        <p class="pc-feature">${esc(p.highlight)}</p>
        <div class="pc-meta">
          <span class="meta-pill lv-${esc(p.lv)}">${esc(p.levelLabel)}</span>
          <span class="meta-pill">${icon('route')} ${esc(p.siteOnly ? 'جولة موقع' : p.kmLabel)}</span>
          <span class="meta-pill">${icon('clock')} ${esc(p.h || 'مدة غير موثقة')}</span>
          <span class="meta-pill v-${esc(p.visitStatus)}">${esc(D.VISIT[p.visitStatus] || D.VISIT.unknown)}</span>
        </div>
      </div>
    </article>`;
  }

  function anchorBox(id, cls = '') {
    const p = D.byId(id);
    const klass = ('quiet ' + cls).trim();
    return p ? P.box(p, klass) : `<div class="ph ${klass}"><div class="ph-fallback">${icon('mountain')}</div></div>`;
  }

  /* ===================== الشاشة 1: الرئيسية ===================== */
  function renderHome() {
    const hero = D.byId('redcanyon');
    const withCoords = D.PLACES.filter(p => D.latLng(p)).length;
    $('#homeHero').innerHTML = `
      <div class="hero-img">${hero ? P.box(hero) : ''}</div>
      <div class="hero-body wrap">
        <span class="eyebrow">${icon('compass')} دليلك العربي للطبيعة والتراث</span>
        <h1>الطبيعة تناديك.<br><em>وين دربك اليوم؟</em></h1>
        <p class="hero-sub">75 مسارًا وموقعًا بين النقب والجليل، بمعلومات من مصادرها وخرائط داخل الموقع.</p>
        <div class="hero-cta">
          <button type="button" class="btn btn-primary" data-go="explore">${icon('compass')} ابدأ الاستكشاف</button>
          <button type="button" class="btn btn-ghost" data-act="near-me">${icon('locate')} القريب مني</button>
        </div>
        <div class="hero-stats">
          <div><strong>75</strong><span>مسار وموقع</span></div>
          <div><strong id="heroCoords">${withCoords}</strong><span>بإحداثيات على الخريطة</span></div>
          <div><strong>12</strong><span>منطقة طبيعية</span></div>
        </div>
      </div>`;

    $('#homeBody').innerHTML = `
      <section class="block">
        <div class="block-head"><div><h2>اختر منطقتك</h2><p>ثلاث مناطق كبرى، اضغط لترى ما فيها</p></div></div>
        <div class="region-rail">
          ${D.REGIONS.map(r => `
            <button type="button" class="region-card" data-region="${esc(r.id)}">
              ${anchorBox(r.anchor)}
              <span class="rc-count">${r.count} موقعًا</span>
              <div class="rc-body"><h3>${esc(r.name)}</h3><p>${esc(r.tagline)}</p></div>
            </button>`).join('')}
        </div>
      </section>

      <section class="block">
        <div class="block-head">
          <div><h2>المناطق الطبيعية</h2><p>من جبال إيلات إلى بانياس</p></div>
          <button type="button" class="more" data-go="map">على الخريطة ${icon('arrow')}</button>
        </div>
        <div class="zone-rail">
          ${D.ZONES.filter(z => z.count).map(z => `
            <button type="button" class="zone-card" data-zone="${esc(z.id)}">
              ${anchorBox(z.anchor)}
              <div class="zc-body"><b>${esc(z.name)}</b><small>${z.count} موقعًا · ${esc(z.blurb)}</small></div>
            </button>`).join('')}
        </div>
      </section>

      <section class="block">
        <div class="block-head">
          <div><h2>وجهات مختارة</h2><p>بدايات جيدة إن لم تقرّر بعد</p></div>
          <button type="button" class="more" data-go="explore">الكل ${icon('arrow')}</button>
        </div>
        <div class="rail">
          ${['redcanyon', 'banias-fall', 'ein-avdat', 'hist-caesarea', 'tel-dan', 'masada-snake']
            .map(id => D.byId(id)).filter(Boolean).map(placeCard).join('')}
        </div>
      </section>

      <section class="block">
        <div class="block-head"><div><h2>جولات جاهزة</h2><p>أماكن منفصلة مقترحة معًا — وليست خط مشي واحدًا</p></div></div>
        <div class="zone-rail">
          ${D.COLLECTIONS.map(c => `
            <button type="button" class="zone-card" data-collection="${esc(c.id)}">
              ${anchorBox(c.anchor)}
              <div class="zc-body"><b>${esc(c.title)}</b><small>${c.ids.length} أماكن · ${esc(c.sub)}</small></div>
            </button>`).join('')}
        </div>
      </section>

      <section class="about">
        <h2>عن دُروب</h2>
        <p>دليل عربي لاكتشاف مسارات المشي والمواقع الطبيعية والتاريخية. نذكر مصدر كل معلومة، ونوضّح ما لم يتم التحقق منه بدل إخفائه.</p>
        <div class="about-grid">
          <div><b>لا نرسم مسارات مخمّنة</b><small>خط المشي يظهر فقط من ملف حقيقي تستورده أو من مصدر رسمي.</small></div>
          <div><b>نفرّق بين النقطة والمنطقة</b><small>الدبوس موقع معلم موثق، والدائرة منطقة تقريبية لا تصلح للتوجه.</small></div>
          <div><b>ساعات الزيارة منشورة لا لحظية</b><small>نذكر تاريخ آخر مراجعة، وتبقى الحاجة للتأكد هاتفيًا.</small></div>
          <div><b>الصور من مصادرها</b><small>ويكيميديا كومنز وويكيبيديا مع الرخصة؛ ولا نضع صورة مكان آخر.</small></div>
        </div>
        <p class="legal">© ٢٠٢٦ دُروب · الخرائط بواسطة Leaflet وبلاطات OpenStreetMap وOpenTopoMap · الطقس من Open-Meteo · المعلومات قابلة للتغيير، والمسؤولية عن السلامة تبقى على الزائر.</p>
      </section>`;
    P.watch($('#screen-home'));
  }

  /* ===================== الشاشة 2: الاستكشاف ===================== */
  function renderChips() {
    $('#themeChips').innerHTML = D.THEMES.map(t =>
      `<button type="button" class="chip ${state.theme === t.id ? 'on' : ''}" data-theme="${esc(t.id)}">
        <span class="ic">${t.ic}</span> ${esc(t.name)}</button>`).join('')
      + `<button type="button" class="chip ${state.favoritesOnly ? 'on' : ''}" data-act="toggle-favs">♥ المفضلة</button>`;
    const n = D.activeFilterCount();
    const dot = $('#filterDot');
    dot.hidden = n === 0;
    dot.textContent = n;
  }

  function renderExplore() {
    renderChips();
    const list = D.query();
    const shown = list.slice(0, state.limit);
    $('#exploreCount').innerHTML = `<b>${list.length}</b> من 75 وجهة`;
    $('#exploreHint').textContent = state.favoritesOnly ? 'المحفوظة على جهازك'
      : state.sort === 'near' && state.pos ? 'مرتّبة بالمسافة الجوية'
        : 'اضغط البطاقة لكل التفاصيل';
    $('#exploreCards').innerHTML = shown.map(placeCard).join('');
    $('#exploreEmpty').hidden = list.length > 0;
    const more = $('#exploreMore');
    more.hidden = state.limit >= list.length;
    more.textContent = `عرض ${Math.min(12, list.length - state.limit)} وجهة أخرى`;
    P.watch($('#exploreCards'));
  }

  /* ===================== ورقة الفلاتر ===================== */
  const FILTER_GROUPS = [
    { key: 'region', label: 'المنطقة', opts: () => [['all', 'الكل']].concat(D.REGIONS.map(r => [r.id, r.name])) },
    { key: 'zone', label: 'المنطقة الطبيعية', opts: () => [['all', 'الكل']].concat(D.ZONES.filter(z => z.count).map(z => [z.id, `${z.name} (${z.count})`])) },
    { key: 'level', label: 'الصعوبة', opts: () => [['all', 'الكل'], ['easy', 'سهل'], ['mid', 'متوسط'], ['hard', 'صعب'], ['exp', 'متقدم'], ['unk', 'غير محدد']] },
    { key: 'kind', label: 'نوع المكان', opts: () => [['all', 'الكل'], ['trail', 'مسارات مشي'], ['nature', 'معالم طبيعية'], ['ruins', 'آثار وتاريخ'], ['mosque', 'مساجد تاريخية'], ['maqam', 'مقامات'], ['religious', 'معالم دينية']] },
    { key: 'visit', label: 'حالة الزيارة', opts: () => [['all', 'الكل'], ['hours', 'ساعات منشورة'], ['appointment', 'بتنسيق مسبق'], ['unknown', 'بحاجة إلى تحقق']] },
    { key: 'era', label: 'الحضارة', opts: () => [['all', 'الكل']].concat([...new Set(D.PLACES.map(p => p.era).filter(Boolean))].sort().map(e => [e, e])) },
    { key: 'sort', label: 'الترتيب', opts: () => [['featured', 'المقترحة'], ['short', 'الأقصر أولًا'], ['level', 'حسب الصعوبة'], ['name', 'الاسم'], ['near', 'الأقرب إليّ']] }
  ];

  function renderFilterSheet() {
    $('#filterBody').innerHTML = FILTER_GROUPS.map(g => `
      <div class="f-group"><label>${esc(g.label)}</label>
        <div class="f-opts">${g.opts().map(([v, t]) =>
          `<button type="button" class="f-opt ${state[g.key] === v ? 'on' : ''}" data-f="${esc(g.key)}" data-v="${esc(v)}">${esc(t)}</button>`
        ).join('')}</div>
      </div>`).join('');
    $('#filterApply').textContent = `اعرض ${D.query().length} وجهة`;
  }

  const openSheet = () => { renderFilterSheet(); $('#filterSheet').classList.add('open'); document.body.classList.add('is-locked'); };
  const closeSheet = () => { $('#filterSheet').classList.remove('open'); if (!$('#detailRoot').classList.contains('open')) document.body.classList.remove('is-locked'); };

  /* ===================== الشاشة 3: الخريطة ===================== */
  let mapReady = false;
  function openMapScreen() {
    if (!mapReady) {
      M.buildMain(openDetail);
      P.warmCoordinates();
      mapReady = true;
    }
    setTimeout(() => M.main && M.main.invalidateSize(), 150);
  }
  P.onCoordinates(() => {
    M.refreshMain(openDetail);
    const el = $('#heroCoords');
    if (el) el.textContent = D.PLACES.filter(p => D.latLng(p)).length;
  });

  /* جدول مقارنة بين محطات الخطة — بلا أي زر إضافي على البطاقات. */
  function compareTable(items) {
    const rows = [
      ['المنطقة', p => p.zoneName],
      ['نوع المكان', p => p.kindLabel],
      ['الصعوبة', p => p.levelLabel],
      ['المسافة', p => p.siteOnly ? 'جولة موقع' : p.kmLabel],
      ['المدة', p => p.h || 'غير موثّقة'],
      ['الصعود', p => p.up || 'غير موثّق'],
      ['الرسوم', p => D.FEE[p.fee] || 'غير موثّقة'],
      ['الزيارة', p => D.VISIT[p.visitStatus] || D.VISIT.unknown],
      ['على الخريطة', p => D.latLng(p) ? 'موقع موثّق' : 'منطقة تقريبية']
    ];
    return `<table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:${110 + items.length * 120}px">
      <thead><tr><th style="text-align:start;padding:8px 6px;color:#6d8a7c">المعيار</th>
        ${items.map(p => `<th style="text-align:start;padding:8px 6px">${esc(p.n)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, get]) => `<tr>
        <th style="text-align:start;padding:8px 6px;color:#6d8a7c;font-weight:600;border-top:1px solid #eef1ee">${esc(label)}</th>
        ${items.map(p => `<td style="padding:8px 6px;border-top:1px solid #eef1ee">${esc(get(p))}</td>`).join('')}
      </tr>`).join('')}</tbody></table>
      <p class="note" style="margin-top:9px">القيم منقولة عن مصادر كل مكان، وقد تختلف نسخ المسارات.</p>`;
  }

  /* ===================== الشاشة 4: رحلتي ===================== */
  function renderTrip() {
    const tab = state.tripTab;
    $$('#tripTabs button').forEach(b => b.classList.toggle('on', b.dataset.triptab === tab));
    const body = $('#tripBody');

    if (tab === 'saved') {
      const favs = D.PLACES.filter(p => store.favorites[p.id]);
      body.innerHTML = favs.length
        ? `<div class="cards">${favs.map(placeCard).join('')}</div>`
        : `<div class="empty">${icon('heart')}<h3>لا توجد أماكن محفوظة</h3><p>اضغط القلب على أي بطاقة لحفظها هنا.</p></div>`;
      P.watch(body);
      return;
    }

    const items = store.trip.ids.map(D.byId).filter(Boolean);
    const known = items.filter(p => typeof p.km === 'number');
    const km = known.reduce((n, p) => n + p.km, 0);
    body.innerHTML = `
      <div class="panel">
        <label class="field"><span>${'موعد الرحلة'}</span><input type="date" id="tripDate" value="${esc(store.trip.date || '')}"></label>
        <label class="field" style="margin-bottom:4px"><span>ملاحظات</span>
          <input type="text" id="tripNotes" maxlength="190" placeholder="مثلاً: طلعة صباحية مع العائلة" value="${esc(store.trip.notes || '')}"></label>
      </div>
      <div class="panel" style="margin-top:12px">
        ${items.length ? items.map((p, i) => `
          <div class="trip-item">
            ${P.box(p)}
            <div><b>${i + 1}. ${esc(p.n)}</b><small>${esc(p.zoneName)} · ${esc(p.siteOnly ? 'جولة موقع' : p.kmLabel)} · ${esc(p.h || 'مدة غير موثقة')}</small></div>
            <button type="button" class="rm" data-trip-remove="${esc(p.id)}" aria-label="إزالة">${icon('close')}</button>
          </div>`).join('')
          : `<div class="empty" style="padding:30px 10px">${icon('bag')}<h3>خطتك فارغة</h3><p>افتح أي مكان واضغط «أضف إلى رحلتي».</p></div>`}
        ${items.length ? `<div class="trip-sum">
          <span>${items.length} محطة</span>
          <span>مسافات معروفة: ${km.toFixed(1)} كم</span>
          <span>${items.length - known.length} بمسافة غير موثقة</span>
        </div>` : ''}
      </div>
      ${items.length > 1 ? `<details class="fold" style="margin-top:12px">
        <summary>${icon('sliders')} قارن محطات الرحلة</summary>
        <div class="fold-body" style="overflow-x:auto">${compareTable(items)}</div>
      </details>` : ''}
      ${items.length ? `<div class="map-tools" style="margin-top:12px">
        <button type="button" data-act="share-trip">${icon('share')} شارك الخطة</button>
        <button type="button" data-act="print">${icon('print')} طباعة</button>
        <button type="button" data-act="clear-trip">${icon('trash')} إفراغ الخطة</button>
      </div>` : ''}
      <p class="note" style="margin-top:12px">المحطات أماكن منفصلة وليست طريقًا واحدًا متصلًا؛ خطّط الانتقال بينها وتحقق من المواعيد والحجوزات.</p>`;
    P.watch(body);
    $('#tripBadge').hidden = !items.length;
    $('#tripBadge').textContent = items.length;
  }

  /* ===================== التنقل بين الشاشات ===================== */
  function go(screen, opts = {}) {
    state.screen = screen;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + screen));
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === screen));
    $('#topbar').classList.toggle('on-photo', screen === 'home');
    if (!opts.keepScroll) w.scrollTo({ top: 0, behavior: opts.smooth === false ? 'auto' : 'smooth' });
    if (screen === 'explore') renderExplore();
    if (screen === 'map') openMapScreen();
    if (screen === 'trip') renderTrip();
    try { history.replaceState(null, '', location.pathname + location.search + (screen === 'home' ? '' : '#' + screen)); } catch (e) { }
  }

  /* ===================== صفحة المكان ===================== */
  let weatherLoaded = null;

  function openDetail(id) {
    const p = D.byId(id);
    if (!p) return;
    M.destroyDetail();
    state.detailId = id;
    weatherLoaded = null;
    const root = $('#detailRoot');
    $('#detailInner').innerHTML = Detail.render(p);
    root.classList.add('open');
    document.body.classList.add('is-locked');
    $('#detailInner').scrollTop = 0;
    P.watch($('#detailInner'));
    updateLayerLabel();
    setTimeout(() => M.buildDetail(p, state.tracks[p.id]), 90);
    updateGpsStats();
    const fileInput = $('#trackFile');
    if (fileInput) fileInput.addEventListener('change', onTrackFile);
    try { history.replaceState(null, '', location.pathname + location.search + '#place=' + encodeURIComponent(id)); } catch (e) { }
  }

  function closeDetail() {
    M.destroyDetail();
    stopGps();
    $('#detailRoot').classList.remove('open');
    if (!$('#filterSheet').classList.contains('open')) document.body.classList.remove('is-locked');
    state.detailId = null;
    try { history.replaceState(null, '', location.pathname + location.search + (state.screen === 'home' ? '' : '#' + state.screen)); } catch (e) { }
  }

  function redrawDetail() {
    const p = D.byId(state.detailId);
    if (!p) return;
    const scroll = $('#detailInner').scrollTop;
    openDetail(p.id);
    $('#detailInner').scrollTop = scroll;
  }

  const updateLayerLabel = () => {
    const el = $('#layerLabel');
    if (el) el.textContent = M.detailKind === 'standard' ? 'طبقة التضاريس' : 'خريطة الطرق';
  };

  /* ---------- ملفات المسار ---------- */
  async function onTrackFile(e) {
    const file = e.target.files && e.target.files[0];
    const id = state.detailId;
    if (!file || !id) return;
    if (file.size > 8 * 1024 * 1024) { D.toast('حجم الملف أكبر من ٨ ميغابايت'); return; }
    try {
      const track = Detail.parseTrack(await file.text(), file.name);
      state.tracks[id] = track;
      D.toast(`عُرضت ${track.points.length} نقطة من ملفك`);
      redrawDetail();
    } catch (err) {
      const msg = $('#trackMsg');
      if (msg) msg.textContent = 'تعذّر قراءة الملف: ' + err.message;
      D.toast('فشل تحميل ملف المسار');
    }
  }

  async function loadOfficialTrack() {
    const p = D.byId(state.detailId);
    if (!p || !p.officialGpx) return;
    const msg = $('#trackMsg');
    if (msg) msg.textContent = 'جاري جلب الملف الرسمي…';
    try {
      const res = await fetch('/api/official-track?id=' + encodeURIComponent(p.id), { signal: AbortSignal.timeout(16000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.tracks[p.id] = Detail.parseTrack(await res.text(), 'official.gpx');
      D.toast('عُرض المسار الرسمي داخل دُروب');
      redrawDetail();
    } catch (err) {
      if (msg) msg.textContent = 'تعذّر جلب الملف الرسمي الآن. يمكنك تنزيله من المصدر ثم استيراده.';
      D.toast('تعذّر جلب الملف الرسمي');
    }
  }

  /* ---------- الموقع والتتبّع ---------- */
  function askLocation(then) {
    if (!navigator.geolocation) { D.toast('متصفحك لا يدعم خدمة الموقع'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { state.pos = [pos.coords.latitude, pos.coords.longitude]; then && then(); },
      () => D.toast('لم يُسمح بالوصول إلى الموقع. يمكنك البحث يدويًا.'),
      { enableHighAccuracy: true, timeout: 14000, maximumAge: 120000 }
    );
  }

  function updateGpsStats() {
    const el = $('#gpsStats');
    if (!el) return;
    let km = 0;
    for (let i = 1; i < state.gps.points.length; i++) km += D.haversine(state.gps.points[i - 1], state.gps.points[i]);
    const sec = state.gps.start ? Math.floor((Date.now() - state.gps.start) / 1000) : 0;
    el.innerHTML = `<span>المسافة ${km.toFixed(2)} كم</span><span>${state.gps.points.length} نقطة</span>
      <span>الوقت ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}</span>`;
  }

  function startGps() {
    if (state.gps.on) { D.toast('التتبّع يعمل بالفعل'); return; }
    if (!navigator.geolocation) { D.toast('متصفحك لا يدعم تتبّع الموقع'); return; }
    state.gps.on = true; state.gps.points = []; state.gps.start = Date.now();
    state.gps.watch = navigator.geolocation.watchPosition(pos => {
      if (pos.coords.accuracy > 70) return;
      const point = [pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, Date.now()];
      const last = state.gps.points[state.gps.points.length - 1];
      if (!last || D.haversine(last, point) > 0.01) {
        state.gps.points.push(point);
        state.pos = [point[0], point[1]];
        M.showMe(M.detail, state.pos, state.gps.points);
      }
      updateGpsStats();
    }, err => { D.toast('تعذّر تتبّع الموقع: ' + err.message); stopGps(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 18000 });
    state.gps.timer = setInterval(updateGpsStats, 1000);
    const note = $('#gpsNote');
    if (note) note.textContent = 'بدأ التسجيل. أبقِ الصفحة مفتوحة، ولا تعتمد عليه بديلًا عن ملاحة معتمدة.';
    D.toast('طُلب إذن الوصول إلى الموقع');
  }

  function stopGps() {
    if (state.gps.watch != null) { navigator.geolocation.clearWatch(state.gps.watch); state.gps.watch = null; }
    if (state.gps.timer) { clearInterval(state.gps.timer); state.gps.timer = null; }
    if (state.gps.on) D.toast('تم إيقاف التتبّع');
    state.gps.on = false;
    updateGpsStats();
  }

  function exportGps() {
    const pts = state.gps.points;
    if (pts.length < 2) { D.toast('سجّل نقطتين على الأقل قبل التصدير'); return; }
    const xml = '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Doroub" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Doroub walk</name><trkseg>'
      + pts.map(p => `<trkpt lat="${p[0]}" lon="${p[1]}">${Number.isFinite(p[2]) ? `<ele>${p[2]}</ele>` : ''}<time>${new Date(p[3]).toISOString()}</time></trkpt>`).join('')
      + '</trkseg></trk></gpx>';
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/gpx+xml' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'doroub-walk.gpx';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    D.toast('أُنشئ ملف GPX لمشيك');
  }

  /* ---------- الطقس ---------- */
  async function loadWeather() {
    const p = D.byId(state.detailId);
    const box = $('#weatherBox');
    if (!p || !box || weatherLoaded === p.id) return;
    weatherLoaded = p.id;
    const ll = D.latLng(p);
    if (!ll) { box.textContent = 'الطقس غير متاح لأن إحداثيات هذا المكان لم تُوثق بعد.'; return; }
    box.textContent = 'جاري جلب حالة الطقس…';
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${ll[0]}&longitude=${ll[1]}`
        + '&current=temperature_2m,wind_speed_10m,precipitation,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=1';
      const res = await fetch(url, { signal: AbortSignal.timeout(11000) });
      if (!res.ok) throw new Error('weather');
      const data = await res.json();
      const c = data.current || {}, d = data.daily || {};
      const code = c.weather_code;
      const face = code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : '🌦️';
      const hour = t => t ? new Date(t).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : '—';
      box.innerHTML = `<div class="weather-now">
          <span class="emoji">${face}</span>
          <div><span class="deg">${Number.isFinite(c.temperature_2m) ? Math.round(c.temperature_2m) + '°' : '—'}</span>
          <small style="display:block;opacity:.8;font-size:11.5px;margin-top:4px">الحرارة في محيط الموقع</small></div>
        </div>
        <div class="weather-grid">
          <span>الرياح<b>${Number.isFinite(c.wind_speed_10m) ? Math.round(c.wind_speed_10m) + ' كم/س' : '—'}</b></span>
          <span>هطول<b>${Number.isFinite(c.precipitation) ? c.precipitation + ' مم' : '—'}</b></span>
          <span>الغروب<b>${hour(d.sunset && d.sunset[0])}</b></span>
        </div>`;
    } catch (e) {
      box.textContent = 'تعذّر تحميل الطقس. راجع النشرة الجوية الرسمية قبل الرحلة.';
      weatherLoaded = null;
    }
  }

  /* ---------- مشاركة ---------- */
  async function share(text, url) {
    if (navigator.share) {
      try { await navigator.share({ title: 'دُروب', text, url: url || location.href }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text + (url ? '\n' + url : '')); D.toast('نُسخ الرابط'); }
    catch (e) { D.toast('المشاركة غير متاحة هنا'); }
  }

  function shareTrip() {
    const items = store.trip.ids.map(D.byId).filter(Boolean);
    if (!items.length) { D.toast('أضف مكانًا إلى خطتك أولًا'); return; }
    const text = 'رحلتي على دُروب\n'
      + (store.trip.date ? 'الموعد: ' + store.trip.date + '\n' : '')
      + items.map((p, i) => `${i + 1}. ${p.n} (${p.siteOnly ? 'جولة موقع' : p.kmLabel})`).join('\n')
      + (store.trip.notes ? '\nملاحظات: ' + store.trip.notes : '')
      + '\nتحقق من حالة الأماكن قبل الانطلاق.';
    share(text, location.origin + location.pathname);
  }

  /* ---------- المفضلة والخطة ---------- */
  function toggleFavorite(id) {
    if (store.favorites[id]) delete store.favorites[id]; else store.favorites[id] = true;
    store.saveFavorites();
    $$(`[data-fav="${CSS.escape(id)}"]`).forEach(b => b.classList.toggle('on', !!store.favorites[id]));
    D.toast(store.favorites[id] ? 'أضيف إلى المفضلة' : 'أُزيل من المفضلة');
    if (state.screen === 'trip' && state.tripTab === 'saved') renderTrip();
    if (state.screen === 'explore' && state.favoritesOnly) renderExplore();
  }

  function addToTrip(id) {
    if (!D.byId(id)) return;
    if (store.trip.ids.includes(id)) { D.toast('المكان موجود في خطتك'); return; }
    store.trip.ids.push(id);
    store.saveTrip();
    D.toast('أضيف إلى رحلتك');
    $('#tripBadge').hidden = false;
    $('#tripBadge').textContent = store.trip.ids.length;
    if (state.detailId === id) redrawDetail();
    if (state.screen === 'trip') renderTrip();
  }

  /* ===================== الأحداث ===================== */
  document.addEventListener('click', e => {
    let el;

    if ((el = e.target.closest('[data-fav]'))) { e.preventDefault(); e.stopPropagation(); toggleFavorite(el.dataset.fav); return; }
    if ((el = e.target.closest('[data-open]'))) { openDetail(el.dataset.open); return; }
    if ((el = e.target.closest('[data-tab]'))) { go(el.dataset.tab); return; }
    if ((el = e.target.closest('[data-go]'))) { go(el.dataset.go); return; }

    if ((el = e.target.closest('[data-region]'))) {
      D.resetFilters(); state.region = el.dataset.region; go('explore'); return;
    }
    if ((el = e.target.closest('[data-zone]'))) {
      D.resetFilters(); state.zone = el.dataset.zone; go('explore'); return;
    }
    if ((el = e.target.closest('[data-collection]'))) {
      const c = D.COLLECTIONS.find(x => x.id === el.dataset.collection);
      if (c) {
        c.ids.forEach(id => { if (D.byId(id) && !store.trip.ids.includes(id)) store.trip.ids.push(id); });
        store.saveTrip();
        D.toast('أضفنا أماكن الجولة إلى رحلتك');
        go('trip');
      }
      return;
    }
    if ((el = e.target.closest('[data-theme]'))) {
      state.theme = el.dataset.theme; state.favoritesOnly = false; state.limit = 12; renderExplore(); return;
    }
    if ((el = e.target.closest('[data-f]'))) {
      state[el.dataset.f] = el.dataset.v;
      if (el.dataset.f === 'sort' && el.dataset.v === 'near' && !state.pos) askLocation(() => { renderFilterSheet(); renderExplore(); });
      state.limit = 12;
      renderFilterSheet(); renderExplore(); return;
    }
    if ((el = e.target.closest('[data-triptab]'))) { state.tripTab = el.dataset.triptab; renderTrip(); return; }
    if ((el = e.target.closest('[data-trip-remove]'))) {
      store.trip.ids = store.trip.ids.filter(id => id !== el.dataset.tripRemove);
      store.saveTrip(); renderTrip(); return;
    }

    el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const place = D.byId(state.detailId);

    switch (act) {
      case 'filters': openSheet(); break;
      case 'close-sheet': closeSheet(); break;
      case 'reset-filters': D.resetFilters(); $('#searchInput').value = ''; renderFilterSheet(); renderExplore(); break;
      case 'apply-filters': closeSheet(); renderExplore(); break;
      case 'toggle-favs': state.favoritesOnly = !state.favoritesOnly; state.limit = 60; renderExplore(); break;
      case 'more': state.limit += 12; renderExplore(); break;
      case 'search': go('explore'); setTimeout(() => $('#searchInput').focus(), 220); break;
      case 'near-me': askLocation(() => { D.resetFilters(); state.sort = 'near'; go('explore'); D.toast('رتّبنا الأماكن بالمسافة الجوية — وليست مسافة الطريق'); }); break;
      case 'close': closeDetail(); break;
      case 'fav': if (place) { toggleFavorite(place.id); el.classList.toggle('on', !!store.favorites[place.id]); } break;
      case 'share': if (place) share(`اكتشف ${place.n} على دُروب`, location.origin + location.pathname + '#place=' + encodeURIComponent(place.id)); break;
      case 'trip': if (place) addToTrip(place.id); break;
      case 'print': w.print(); break;
      case 'layer': M.toggleDetailLayer(); updateLayerLabel(); break;
      case 'map-layer': { const kind = M.toggleMainLayer(); el.classList.toggle('on', kind === 'terrain'); break; }
      case 'fit': if (place) M.fitDetail(place, state.tracks[place.id]); break;
      case 'locate':
        askLocation(() => { M.showMe(M.detail, state.pos, state.gps.points); if (M.detail) M.detail.setView(state.pos, 14); D.toast('أظهرنا موقعك على الخريطة'); });
        break;
      case 'map-locate':
        askLocation(() => { M.showMe(M.main, state.pos, null); if (M.main) M.main.setView(state.pos, 12); });
        break;
      case 'official': loadOfficialTrack(); break;
      case 'gps-start': startGps(); break;
      case 'gps-stop': stopGps(); break;
      case 'gps-export': exportGps(); break;
      case 'share-trip': shareTrip(); break;
      case 'clear-trip': store.trip.ids = []; store.saveTrip(); renderTrip(); break;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('#filterSheet').classList.contains('open')) closeSheet();
    else if ($('#detailRoot').classList.contains('open')) closeDetail();
  });

  document.addEventListener('keypress', e => {
    const card = e.target.closest && e.target.closest('[data-open]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(card.dataset.open); }
  });

  document.addEventListener('change', e => {
    if (e.target.matches('[data-check]') && state.detailId) {
      const id = state.detailId;
      store.checks[id] = store.checks[id] || {};
      store.checks[id][e.target.dataset.check] = e.target.checked;
      store.saveChecks();
    }
    if (e.target.id === 'tripDate') { store.trip.date = e.target.value; store.saveTrip(); }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'searchInput') { state.query = e.target.value; state.limit = 12; renderExplore(); }
    if (e.target.id === 'tripNotes') { store.trip.notes = e.target.value; store.saveTrip(); }
  });

  document.addEventListener('toggle', e => {
    if (e.target.matches('details.fold') && e.target.open && e.target.querySelector('#weatherBox')) loadWeather();
  }, true);

  w.addEventListener('scroll', () => {
    const bar = $('#topbar');
    const overHero = state.screen === 'home' && w.scrollY < (w.innerHeight * 0.62);
    bar.classList.toggle('on-photo', overHero);
    bar.classList.toggle('scrolled', w.scrollY > 12 && !overHero);
  }, { passive: true });

  /* ===================== العناوين والروابط ===================== */
  /* يستجيب الموقع لتغيّر الرابط: مشاركة رابط مكان، زر الرجوع، أو فتح تبويب محفوظ. */
  function applyHash(initial = false) {
    const hash = location.hash;
    if (hash.startsWith('#place=')) {
      const id = decodeURIComponent(hash.slice(7));
      if (D.byId(id)) { if (state.detailId !== id) openDetail(id); return; }
    }
    if ($('#detailRoot').classList.contains('open')) closeDetail();
    const screen = hash.slice(1);
    const target = ['explore', 'map', 'trip', 'home'].includes(screen) ? screen : 'home';
    if (initial || target !== state.screen) go(target, { smooth: false });
  }

  w.addEventListener('hashchange', () => applyHash());

  /* ===================== الإقلاع ===================== */
  function boot() {
    D.paintIcons();
    renderHome();
    renderExplore();
    renderTrip();
    $('#tripBadge').hidden = !store.trip.ids.length;
    $('#tripBadge').textContent = store.trip.ids.length;

    /* نسب الصورة يُكتب مرة واحدة لكل صورة تُحمَّل داخل صفحة المكان. */
    $('#detailInner').addEventListener('photo', e => {
      const box = $('#photoCredit');
      if (!box || !e.detail) return;
      box.innerHTML = e.detail.page
        ? `مصدر الصورة: <a href="${esc(e.detail.page)}" target="_blank" rel="noopener noreferrer">${esc(e.detail.credit || 'Wikimedia Commons')}</a>`
        : esc(e.detail.credit || '');
    });

    $('#filterSheet').addEventListener('click', e => { if (e.target.id === 'filterVeil') closeSheet(); });
    $('#detailRoot').addEventListener('click', e => { if (e.target.id === 'detailVeil') closeDetail(); });

    applyHash(true);

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      w.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
