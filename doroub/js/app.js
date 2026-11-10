/* دُروب V8 — الهيكل: أربع شاشات، بحث واحد، ورقة فلاتر واحدة، وصفحة مكان واحدة. */
(function (w) {
  'use strict';
  const D = w.D, P = w.DPhotos, M = w.DMap, Detail = w.DDetail;
  const { $, $$, esc, icon, state, store } = D;

  /* ===================== الإعدادات والمظهر ===================== */
  const media = w.matchMedia ? w.matchMedia('(prefers-color-scheme: dark)') : null;

  function applySettings() {
    const st = store.settings;
    const dark = st.theme === 'dark' || (st.theme === 'auto' && media && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.setProperty('--font-scale', st.fontScale);
    document.documentElement.dataset.motion = st.reduceMotion ? 'reduce' : 'full';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#06150f' : '#0d2a1f');
  }
  if (media && media.addEventListener) media.addEventListener('change', () => { if (store.settings.theme === 'auto') applySettings(); });

  let installPrompt = null;
  w.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; renderSettings(); });

  function setOnline() {
    const on = navigator.onLine;
    document.body.classList.toggle('is-offline', !on);
    const bar = $('#offlineBar');
    if (bar) bar.hidden = on;
  }
  w.addEventListener('online', () => { setOnline(); D.toast('عاد الاتصال'); });
  w.addEventListener('offline', () => { setOnline(); D.toast('أنت دون اتصال — ما حُفظ يعمل، والصور والخرائط لا'); });

  const SETTING_GROUPS = () => [
    { key: 'theme', label: 'المظهر', opts: [['auto', 'حسب الجهاز'], ['light', 'فاتح'], ['dark', 'داكن']] },
    { key: 'fontScale', label: 'حجم الخط', opts: [[1, 'عادي'], [1.12, 'كبير'], [1.25, 'أكبر']] },
    { key: 'units', label: 'وحدة القياس', opts: [['metric', 'كيلومتر'], ['imperial', 'ميل']] },
    { key: 'pace', label: 'سرعة مشيك (لتقدير الزمن)', opts: [[3, 'متأنّية ٣'], [4.5, 'عادية ٤٫٥'], [6, 'سريعة ٦']] },
    { key: 'reduceMotion', label: 'الحركة والانتقالات', opts: [[false, 'كاملة'], [true, 'مخفّفة']] }
  ];

  function renderSettings() {
    const body = $('#settingsBody');
    if (!body) return;
    const visited = Object.keys(store.visited).length;
    body.innerHTML = SETTING_GROUPS().map(g => `
      <div class="f-group"><label>${esc(g.label)}</label>
        <div class="f-opts">${g.opts.map(([v, t]) =>
          `<button type="button" class="f-opt ${String(store.settings[g.key]) === String(v) ? 'on' : ''}"
             data-set="${esc(g.key)}" data-val="${esc(String(v))}">${esc(t)}</button>`).join('')}</div>
      </div>`).join('') + `
      <div class="f-group"><label>بياناتك على هذا الجهاز</label>
        <div class="trip-sum" style="margin-bottom:10px">
          <span>${Object.keys(store.favorites).length} مفضلة</span>
          <span>${store.trips.length} رحلة</span>
          <span>${visited} مكانًا زرته</span>
          <span>${Object.keys(store.notes).length} ملاحظة</span>
        </div>
        <div class="map-tools">
          <button type="button" data-act="export-data">${icon('download')} تصدير نسخة</button>
          <button type="button" data-act="import-data">${icon('filePlus')} استيراد نسخة</button>
          <input id="importFile" type="file" accept="application/json,.json" hidden>
          <button type="button" data-act="clear-cache">${icon('reset')} تفريغ ذاكرة الصور</button>
        </div>
        <p class="note" style="margin-top:9px">كل شيء محفوظ على جهازك وحده. التصدير يتيح نقله إلى جهاز آخر.</p>
      </div>
      <div class="f-group"><label>التطبيق</label>
        <div class="map-tools">
          ${installPrompt ? `<button type="button" data-act="install">${icon('download')} ثبّت دُروب على جهازك</button>` : ''}
          <button type="button" data-act="shortcuts">${icon('info')} اختصارات لوحة المفاتيح</button>
        </div>
        ${installPrompt ? '' : '<p class="note" style="margin-top:9px">للتثبيت على آيفون: زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».</p>'}
      </div>`;
  }

  const openSettings = () => { renderSettings(); $('#settingsSheet').classList.add('open'); document.body.classList.add('is-locked'); };
  const closeSettings = () => { $('#settingsSheet').classList.remove('open'); if (!anySheetOpen()) document.body.classList.remove('is-locked'); };
  const anySheetOpen = () => $('#filterSheet').classList.contains('open')
    || $('#settingsSheet').classList.contains('open')
    || $('#contributeSheet').classList.contains('open')
    || $('#detailRoot').classList.contains('open');

  /* ===================== بطاقات مشتركة ===================== */
  function placeCard(p) {
    const fav = !!store.favorites[p.id];
    const dist = state.sort === 'near' && state.pos && D.latLng(p) ? D.distanceTo(p) : null;
    return `<article class="place-card" data-open="${esc(p.id)}" role="button" tabindex="0">
      ${P.box(p)}
      <div class="pc-tags">
        <span class="chip-glass">${esc(p.zoneName)}</span>
        ${dist != null ? `<span class="chip-glass">${esc(D.fmtKm(dist))} جوًا</span>` : ''}
        ${store.visited[p.id] ? `<span class="chip-glass visited">${icon('check')} زرته</span>` : ''}
        ${p.provenance === 'open' ? `<span class="chip-glass open-src">مصدر مفتوح</span>` : ''}
      </div>
      <button type="button" class="pc-fav ${fav ? 'on' : ''}" data-fav="${esc(p.id)}"
        aria-label="${fav ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}">${icon('heart')}</button>
      <div class="pc-body">
        <span class="pc-kicker">${icon('pin')} ${esc(p.kindLabel)}</span>
        <h3>${D.highlight(p.n, state.query)}</h3>
        <div class="pc-en">${D.highlight(p.en || '', state.query)}</div>
        <p class="pc-feature">${D.highlight(p.highlight, state.query)}</p>
        <div class="pc-meta">
          <span class="meta-pill lv-${esc(p.lv)}">${esc(p.levelLabel)}</span>
          <span class="meta-pill">${icon('route')} ${esc(D.kmText(p))}</span>
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
    const curated = D.PLACES.filter(p => p.provenance === 'curated').length;
    $('#homeHero').innerHTML = `
      <div class="hero-img">${hero ? P.box(hero) : ''}</div>
      <div class="hero-body wrap">
        <span class="eyebrow">${icon('compass')} دليلك العربي للطبيعة والتراث</span>
        <h1>الطبيعة تناديك.<br><em>وين دربك اليوم؟</em></h1>
        <p class="hero-sub">${D.PLACES.length} مسارًا وموقعًا بين النقب والجليل، بمعلومات من مصادرها وخرائط داخل الموقع.</p>
        <div class="hero-cta">
          <button type="button" class="btn btn-primary" data-go="explore">${icon('compass')} ابدأ الاستكشاف</button>
          <button type="button" class="btn btn-ghost" data-act="near-me">${icon('locate')} القريب مني</button>
        </div>
        <div class="hero-stats">
          <div><strong>${D.PLACES.length}</strong><span>مسار وموقع</span></div>
          <div><strong id="heroCoords">${withCoords}</strong><span>بإحداثيات على الخريطة</span></div>
          <div><strong>${curated}</strong><span>موثّق في الدليل</span></div>
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

      ${store.recent.length >= 2 ? `<section class="block">
        <div class="block-head">
          <div><h2>تابع من حيث وقفت</h2><p>آخر ما تصفّحته على هذا الجهاز</p></div>
          <button type="button" class="more" data-act="recent-clear">${icon('trash')} امسح</button>
        </div>
        <div class="rail">${store.recent.map(D.byId).filter(Boolean).slice(0, 8).map(placeCard).join('')}</div>
      </section>` : ''}

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
      `<button type="button" class="chip ${state.theme === t.id ? 'on' : ''}" data-topic="${esc(t.id)}">
        <span class="ic">${t.ic}</span> ${esc(t.name)}</button>`).join('')
      + `<button type="button" class="chip ${state.favoritesOnly ? 'on' : ''}" data-act="toggle-favs">♥ المفضلة</button>`;
    const n = D.activeFilterCount();
    const dot = $('#filterDot');
    dot.hidden = n === 0;
    dot.textContent = n;
  }

  /* اقتراحات فورية: أسماء أماكن ومناطق ثم عمليات البحث الأخيرة. */
  function renderSuggestions() {
    const box = $('#suggestions');
    if (!box) return;
    const q = D.normalize(state.query);
    if (!q) {
      const recent = store.searches;
      box.innerHTML = recent.length
        ? `<div class="sugg-head">عمليات بحث سابقة</div>` + recent.map(t =>
            `<button type="button" class="sugg" data-suggest="${esc(t)}">${icon('clock')} ${esc(t)}</button>`).join('')
          + `<button type="button" class="sugg clear" data-act="clear-searches">${icon('trash')} امسح السجل</button>`
        : '';
      box.hidden = !recent.length;
      return;
    }
    const places = D.PLACES.filter(p => p.searchText.includes(q)).slice(0, 5);
    const zones = D.ZONES.filter(z => z.count && D.normalize(z.name).includes(q)).slice(0, 3);
    box.innerHTML = [
      ...zones.map(z => `<button type="button" class="sugg" data-zone="${esc(z.id)}">${icon('map')} ${D.highlight(z.name, state.query)} <small>${z.count} مكانًا</small></button>`),
      ...places.map(p => `<button type="button" class="sugg" data-open="${esc(p.id)}">${icon('pin')} ${D.highlight(p.n, state.query)} <small>${esc(p.zoneName)}</small></button>`)
    ].join('');
    box.hidden = !places.length && !zones.length;
  }

  /* حالة الفلاتر في الرابط، فيمكن مشاركة بحث كامل أو حفظه. */
  const URL_KEYS = ['query', 'theme', 'region', 'zone', 'level', 'kind', 'visit', 'era', 'sort', 'radius'];
  function syncUrl() {
    if (state.screen !== 'explore') return;
    const params = new URLSearchParams();
    URL_KEYS.forEach(k => { if (state[k] && state[k] !== 'all') params.set(k, state[k]); });
    if (state.favoritesOnly) params.set('fav', '1');
    const qs = params.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + '#explore'); } catch (e) { }
  }
  function readUrlFilters() {
    const params = new URLSearchParams(location.search);
    if (![...params.keys()].length) return false;
    URL_KEYS.forEach(k => { if (params.has(k)) state[k] = params.get(k); });
    if (params.get('fav') === '1') state.favoritesOnly = true;
    const input = $('#searchInput');
    if (input) input.value = state.query;
    return true;
  }

  function renderExplore() {
    renderChips();
    const list = D.query();
    const shown = list.slice(0, state.limit);
    $('#exploreCount').innerHTML = `<b>${list.length}</b> من ${D.PLACES.length} وجهة`;
    $('#exploreHint').textContent = state.seasonOnly ? 'ما يناسب الموسم الحالي'
      : state.mapBoundsOnly ? 'ضمن إطار الخريطة الحالي'
      : state.radius !== 'all' && state.pos ? `ضمن ${state.radius} كم منك`
        : state.favoritesOnly ? 'المحفوظة على جهازك'
          : state.sort === 'near' && state.pos ? 'مرتّبة بالمسافة الجوية'
            : 'اضغط البطاقة لكل التفاصيل';
    $('#exploreCards').innerHTML = shown.map(placeCard).join('');
    $('#exploreEmpty').hidden = list.length > 0;
    syncUrl();
    renderSuggestions();
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
    { key: 'radius', label: 'ضمن مسافة مني', opts: () => [['all', 'بلا حد'], ['10', '١٠ كم'], ['25', '٢٥ كم'], ['50', '٥٠ كم'], ['100', '١٠٠ كم']] },
    { key: 'provenance', label: 'مصدر البيانات', opts: () => [['all', 'الكل'], ['curated', 'الدليل المحرَّر'], ['open', 'مصدر مفتوح']] },
    { key: 'sort', label: 'الترتيب', opts: () => [['featured', 'المقترحة'], ['short', 'الأقصر أولًا'], ['level', 'حسب الصعوبة'], ['name', 'الاسم'], ['near', 'الأقرب إليّ'], ['complete', 'الأكمل بيانات']] }
  ];

  /* كم نتيجة سيعطي كل خيار لو اخترته الآن؟ يُحسب بتجربة القيمة ثم إعادتها. */
  function facetCount(key, value) {
    if (key === 'sort') return null;
    const before = state[key];
    state[key] = value;
    const n = D.query().length;
    state[key] = before;
    return n;
  }

  function renderFilterSheet() {
    $('#filterBody').innerHTML = FILTER_GROUPS.map(g => `
      <div class="f-group"><label>${esc(g.label)}</label>
        <div class="f-opts">${g.opts().map(([v, t]) => {
          const n = facetCount(g.key, v);
          return `<button type="button" class="f-opt ${state[g.key] === v ? 'on' : ''} ${n === 0 ? 'empty' : ''}"
            data-f="${esc(g.key)}" data-v="${esc(v)}">${esc(t)}${n != null ? `<i>${n}</i>` : ''}</button>`;
        }).join('')}</div>
      </div>`).join('') + `
      <div class="f-group"><label>نطاق البحث</label>
        <div class="f-opts">
          <button type="button" class="f-opt ${state.seasonOnly ? 'on' : ''}" data-act="toggle-season">${icon('sun')} ما يناسب الموسم الآن</button>
          <button type="button" class="f-opt ${state.mapBoundsOnly ? 'on' : ''}" data-act="toggle-bounds">${icon('map')} ضمن إطار الخريطة فقط</button>
          <button type="button" class="f-opt" data-act="surprise">${icon('compass')} فاجئني بمكان</button>
        </div>
      </div>`;
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

    if (tab === 'log') {
      const rows = Object.entries(store.visited)
        .map(([id, date]) => ({ p: D.byId(id), date }))
        .filter(x => x.p)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      body.innerHTML = rows.length
        ? `<div class="panel">${rows.map(r => `<div class="trip-item">
              ${P.box(r.p)}
              <div><b>${esc(r.p.n)}</b><small>${esc(r.p.zoneName)} · زرته في ${esc(r.date)}</small></div>
              <button type="button" class="rm" data-open="${esc(r.p.id)}" aria-label="افتح">${icon('arrow')}</button>
            </div>`).join('')}</div>
           <div class="trip-sum" style="margin-top:12px"><span>${rows.length} مكانًا زرته</span>
             <span>${new Set(rows.map(r => r.p.z)).size} منطقة</span>
             <span>${new Set(rows.map(r => r.date.slice(0, 4))).size} سنة</span></div>`
        : `<div class="empty">${icon('checkCircle')}<h3>لا زيارات مسجّلة</h3><p>افتح أي مكان واضغط «سجّل أنني زرته».</p></div>`;
      P.watch(body);
      return;
    }

    const trip = store.trip;
    const items = trip.ids.map(D.byId).filter(Boolean);
    const known = items.filter(p => typeof p.km === 'number');
    const km = known.reduce((n, p) => n + p.km, 0);
    /* المسافة الجوية بين المحطات المتتالية — مؤشر على حجم الانتقال بينها. */
    let hop = 0, hopKnown = 0;
    for (let i = 1; i < items.length; i++) {
      const a = D.latLng(items[i - 1]), b = D.latLng(items[i]);
      if (a && b) { hop += D.haversine(a, b); hopKnown++; }
    }
    const walk = items.reduce((n, p) => { const e = D.estimateWalk(p); return n + (e ? e.hours : 0); }, 0);

    body.innerHTML = `
      <div class="panel">
        <label class="field"><span>الرحلة</span>
          <div class="f-opts" id="tripPicker">
            ${store.trips.map(t => `<button type="button" class="f-opt ${t.id === trip.id ? 'on' : ''}" data-trip-pick="${esc(t.id)}">${esc(t.name)} <i>${t.ids.length}</i></button>`).join('')}
            <button type="button" class="f-opt" data-act="new-trip">${icon('plus')} رحلة جديدة</button>
          </div>
        </label>
        <label class="field"><span>اسم الرحلة</span><input type="text" id="tripName" maxlength="40" value="${esc(trip.name || '')}"></label>
        <label class="field"><span>موعد الرحلة</span><input type="date" id="tripDate" value="${esc(trip.date || '')}"></label>
        <label class="field" style="margin-bottom:4px"><span>ملاحظات</span>
          <input type="text" id="tripNotes" maxlength="190" placeholder="مثلاً: طلعة صباحية مع العائلة" value="${esc(trip.notes || '')}"></label>
      </div>
      <div class="panel" style="margin-top:12px">
        ${items.length ? items.map((p, i) => `
          <div class="trip-item">
            ${P.box(p)}
            <div><b>${i + 1}. ${esc(p.n)}</b><small>${esc(p.zoneName)} · ${esc(D.kmText(p))} · ${esc(p.h || 'مدة غير موثقة')}</small></div>
            <div class="trip-move">
              <button type="button" data-trip-up="${esc(p.id)}" aria-label="أعلى" ${i === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" data-trip-down="${esc(p.id)}" aria-label="أسفل" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
            </div>
            <button type="button" class="rm" data-trip-remove="${esc(p.id)}" aria-label="إزالة">${icon('close')}</button>
          </div>
          ${legMarkup(items[i], items[i + 1])}`).join('')
          : `<div class="empty" style="padding:30px 10px">${icon('bag')}<h3>خطتك فارغة</h3><p>افتح أي مكان واضغط «أضف إلى رحلتي».</p></div>`}
        ${items.length ? `<div class="trip-sum">
          <span>${items.length} محطة</span>
          <span>مشي معروف: ${esc(D.fmtKm(km))}</span>
          <span>${items.length - known.length} بمسافة غير موثقة</span>
          ${hopKnown ? `<span>انتقال بين المحطات: ~${esc(D.fmtKm(hop))} جوًا</span>` : ''}
          ${walk ? `<span>تقدير المشي: ${Math.floor(walk)} س ${Math.round((walk % 1) * 60)} د</span>` : ''}
        </div>` : ''}
      </div>
      ${items.length > 1 ? `<details class="fold" style="margin-top:12px">
        <summary>${icon('sliders')} قارن محطات الرحلة</summary>
        <div class="fold-body" style="overflow-x:auto">${compareTable(items)}</div>
      </details>` : ''}
      ${items.length ? `<div class="map-tools" style="margin-top:12px">
        <button type="button" data-act="share-trip">${icon('share')} شارك الخطة</button>
        <button type="button" data-act="share-whatsapp-trip">${icon('share')} واتساب</button>
        <button type="button" data-act="trip-gpx">${icon('download')} نقاط GPX</button>
        <button type="button" data-act="trip-ics">${icon('calendar')} أضف للتقويم</button>
        <button type="button" data-act="print">${icon('print')} طباعة</button>
        <button type="button" data-act="clear-trip">${icon('trash')} إفراغ الخطة</button>
        ${store.trips.length > 1 ? `<button type="button" data-act="delete-trip">${icon('close')} احذف هذه الرحلة</button>` : ''}
      </div>` : ''}
      <p class="note" style="margin-top:12px">المحطات أماكن منفصلة وليست طريقًا واحدًا متصلًا؛ خطّط الانتقال بينها وتحقق من المواعيد والحجوزات.</p>`;
    P.watch(body);
    $('#tripBadge').hidden = !items.length;
    $('#tripBadge').textContent = items.length;
  }

  /* ---------- تصدير الخطة ---------- */
  /* بعض المتصفحات ترفض أسماء الملفات غير اللاتينية وتسمّيها download،
     فنولّد اسمًا لاتينيًا آمنًا ونُبقي الاسم العربي داخل محتوى الملف. */
  function safeName(base, ext) {
    const slug = String(base || '').trim()
      .replace(/[^\w\u0600-\u06FF-]+/g, '-')
      .replace(/[\u0600-\u06FF]+/g, '')
      .replace(/-+/g, '-').replace(/^-|-$/g, '');
    return 'doroub-' + (slug || 'trip') + '-' + new Date().toISOString().slice(0, 10) + '.' + ext;
  }

  function download(name, mime, text) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
  }

  function tripGpx() {
    const items = store.trip.ids.map(D.byId).filter(Boolean).filter(p => D.latLng(p));
    if (!items.length) { D.toast('لا توجد محطات بإحداثيات موثقة في خطتك'); return; }
    const xml = '<?xml version="1.0" encoding="UTF-8"?>'
      + '<gpx version="1.1" creator="Doroub" xmlns="http://www.topografix.com/GPX/1/1">'
      + items.map(p => {
        const ll = D.latLng(p);
        return `<wpt lat="${ll[0]}" lon="${ll[1]}"><name>${esc(p.n)}</name><desc>${esc(p.kindLabel + ' — ' + p.zoneName)}</desc></wpt>`;
      }).join('')
      + '</gpx>';
    download(safeName(store.trip.name, 'gpx'), 'application/gpx+xml', xml);
    D.toast(`صُدِّرت ${items.length} نقطة — نقاط مواقع لا خط مشي`);
  }

  function tripIcs() {
    const trip = store.trip;
    const items = trip.ids.map(D.byId).filter(Boolean);
    if (!items.length) { D.toast('أضف محطة أولًا'); return; }
    if (!trip.date) { D.toast('اختر موعد الرحلة أولًا'); return; }
    const day = trip.date.replace(/-/g, '');
    const fold = t => t.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Doroub//AR//', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + trip.id + '@doroub',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART;VALUE=DATE:' + day,
      'DTEND;VALUE=DATE:' + day,
      'SUMMARY:' + fold('دُروب — ' + (trip.name || 'رحلة')),
      'DESCRIPTION:' + fold(items.map((p, i) => `${i + 1}. ${p.n} (${D.kmText(p)})`).join('\n')
        + (trip.notes ? '\n' + trip.notes : '') + '\nتحقق من المواعيد والإغلاقات قبل الانطلاق.'),
      'LOCATION:' + fold(items[0].n),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    download(safeName(trip.name, 'ics'), 'text/calendar', ics);
    D.toast('أُنشئ ملف تقويم للرحلة');
  }

  function tripText() {
    const trip = store.trip;
    const items = trip.ids.map(D.byId).filter(Boolean);
    return (trip.name || 'رحلتي') + ' — دُروب\n'
      + (trip.date ? 'الموعد: ' + trip.date + '\n' : '')
      + items.map((p, i) => `${i + 1}. ${p.n} (${D.kmText(p)})`).join('\n')
      + (trip.notes ? '\nملاحظات: ' + trip.notes : '')
      + '\nتحقق من حالة الأماكن قبل الانطلاق.';
  }

  function moveStop(id, delta) {
    const ids = store.trip.ids;
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    store.saveTrip();
    renderTrip();
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
    store.pushRecent(id);
    sunLoaded = galleryLoaded = null;
    loadStory(p);
    loadExtract(p);
    w.DOffline.state(p);
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
    if (el) el.textContent = 'الطبقة: ' + M.tileLabel(M.detailKind);
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
      pos => { state.pos = [pos.coords.latitude, pos.coords.longitude]; state.accuracy = pos.coords.accuracy; then && then(); },
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
        + '&current=temperature_2m,wind_speed_10m,precipitation,weather_code'
        + '&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code'
        + '&timezone=auto&forecast_days=7';
      const res = await fetch(url, { signal: AbortSignal.timeout(11000) });
      if (!res.ok) throw new Error('weather');
      const data = await res.json();
      const c = data.current || {}, d = data.daily || {};
      const code = c.weather_code;
      const face = code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : '🌦️';
      const hour = t => t ? new Date(t).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : '—';
      const daily = d.time ? d.time.map((t, i) => ({
        t, max: d.temperature_2m_max && d.temperature_2m_max[i],
        min: d.temperature_2m_min && d.temperature_2m_min[i],
        rain: d.precipitation_sum && d.precipitation_sum[i],
        code: d.weather_code && d.weather_code[i]
      })) : [];
      const faceOf = c => c === 0 ? '☀️' : c <= 3 ? '⛅' : c <= 48 ? '🌫️' : c <= 67 ? '🌧️' : c <= 77 ? '❄️' : '🌦️';
      const dayName = t => new Date(t).toLocaleDateString('ar', { weekday: 'short' });
      box.innerHTML = `<div class="weather-now">
          <span class="emoji">${face}</span>
          <div><span class="deg">${Number.isFinite(c.temperature_2m) ? Math.round(c.temperature_2m) + '°' : '—'}</span>
          <small style="display:block;opacity:.8;font-size:11.5px;margin-top:4px">الحرارة في محيط الموقع</small></div>
        </div>
        <div class="weather-grid">
          <span>الرياح<b>${Number.isFinite(c.wind_speed_10m) ? Math.round(c.wind_speed_10m) + ' كم/س' : '—'}</b></span>
          <span>هطول<b>${Number.isFinite(c.precipitation) ? c.precipitation + ' مم' : '—'}</b></span>
          <span>الغروب<b>${hour(d.sunset && d.sunset[0])}</b></span>
        </div>
        ${daily.length > 1 ? `<div class="forecast">${daily.map(x => `
          <div class="fc-day"><b>${esc(dayName(x.t))}</b><span class="fc-i">${faceOf(x.code)}</span>
            <i>${Number.isFinite(x.max) ? Math.round(x.max) + '°' : '—'}</i>
            <u>${Number.isFinite(x.min) ? Math.round(x.min) + '°' : '—'}</u>
            ${x.rain > 0 ? `<em>${x.rain} مم</em>` : '<em></em>'}
          </div>`).join('')}</div>
        <p class="note" style="margin-top:8px">مطر على وادٍ صحراوي يعني خطر سيول حتى لو كانت السماء صافية فوقك. راجع التحذيرات الرسمية.</p>` : ''}`;
    } catch (e) {
      box.textContent = 'تعذّر تحميل الطقس. راجع النشرة الجوية الرسمية قبل الرحلة.';
      weatherLoaded = null;
    }
  }

  /* ---------- الشمس وحاسبة العودة الآمنة ---------- */
  let sunLoaded = null;
  async function loadSun() {
    const p = D.byId(state.detailId);
    const box = $('#sunBox');
    if (!p || !box || sunLoaded === p.id) return;
    sunLoaded = p.id;
    const ll = D.latLng(p);
    if (!ll) { box.textContent = 'غير متاح لأن إحداثيات هذا المكان لم تُوثق بعد.'; return; }
    box.textContent = 'جارٍ الحساب…';
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ll[0]}&longitude=${ll[1]}`
        + '&daily=sunrise,sunset&timezone=auto&forecast_days=1', { signal: AbortSignal.timeout(11000) });
      if (!res.ok) throw new Error('sun');
      const d = (await res.json()).daily || {};
      const rise = d.sunrise && d.sunrise[0], set = d.sunset && d.sunset[0];
      if (!rise || !set) throw new Error('sun');
      const fmt = t => new Date(t).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
      const dayMs = new Date(set) - new Date(rise);
      const left = new Date(set) - Date.now();
      const est = D.estimateWalk(p);
      const hrs = ms => Math.floor(ms / 3600000) + ' س ' + Math.round((ms % 3600000) / 60000) + ' د';
      let verdict = '';
      if (est) {
        const needMs = est.hours * 3600000;
        const latest = new Date(new Date(set) - needMs - 45 * 60000);
        verdict = left <= 0
          ? `<div class="callout warn">${icon('warn')}<div><b>غربت الشمس</b>لا تبدأ مسارًا الآن دون إضاءة وخبرة ليلية.</div></div>`
          : needMs + 45 * 60000 > left
            ? `<div class="callout warn">${icon('warn')}<div><b>الوقت لا يكفي اليوم</b>يحتاج المسار ~${esc(est.label)} وبقي ${esc(hrs(left))} ضوء فقط. أجّله أو اختر جزءًا منه.</div></div>`
            : `<div class="callout ok">${icon('check')}<div><b>الوقت يكفي</b>آخر وقت مناسب للانطلاق اليوم: ${esc(latest.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }))} — مع هامش ٤٥ دقيقة قبل الغروب.</div></div>`;
      }
      box.innerHTML = `<div class="weather-grid">
          <span>الشروق<b>${esc(fmt(rise))}</b></span>
          <span>الغروب<b>${esc(fmt(set))}</b></span>
          <span>طول النهار<b>${esc(hrs(dayMs))}</b></span>
        </div>
        ${left > 0 ? `<p class="note" style="margin-top:9px">بقي من ضوء النهار: <b>${esc(hrs(left))}</b></p>` : ''}
        ${verdict}
        <p class="note">الحساب تقديري ويعتمد على سرعة مشيك في الإعدادات، ولا يراعي وعورة الأرض ولا الراحة.</p>`;
    } catch (e) {
      box.textContent = 'تعذّر حساب أوقات الشمس الآن.';
      sunLoaded = null;
    }
  }

  /* ---------- معرض الصور ---------- */
  let galleryLoaded = null;
  async function loadGallery() {
    const p = D.byId(state.detailId);
    const grid = $('#galleryGrid');
    if (!p || !grid || galleryLoaded === p.id) return;
    galleryLoaded = p.id;
    const shots = await P.gallery(p);
    if (!$('#galleryGrid') || state.detailId !== p.id) return;
    $('#galleryGrid').innerHTML = shots.length
      ? shots.map(g => `<a class="shot" href="${esc(g.page)}" target="_blank" rel="noopener noreferrer" title="${esc(g.caption)}">
          <img src="${esc(g.url)}" alt="${esc(g.caption)}" loading="lazy" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='${esc(g.fallback)}'"></a>`).join('')
      : '<p class="note">لم نجد صورًا موثّقة إضافية لهذا المكان.</p>';
  }

  /* ---------- فكرة ٣: الحكاية بالعربية ----------
     نقدّم ويكيبيديا العربية على الإنجليزية: ما يُكتب بالعربية عن هذه الأماكن
     ليس ترجمة لمصدر أجنبي، بل معرفة محلية لا توجد فيه. */
  async function loadStory(p) {
    if (p.story) return;
    const found = await P.arabicStory(p);
    if (!found || state.detailId !== p.id) return;
    const sec = $('#storySection'), body = $('#storyBody'), credit = $('#storyCredit');
    if (!sec || !body) return;
    body.textContent = found.text;
    if (credit) {
      credit.innerHTML = `المصدر: <a href="${esc(found.page)}" target="_blank" rel="noopener noreferrer">ويكيبيديا العربية</a>`
        + ' — نص موسوعي بترخيص CC BY-SA، وقد لا يصف حالة المكان اليوم.';
    }
    sec.hidden = false;
  }

  /* ---------- فكرة ٥: الانتقال بين محطتين ---------- */
  function legMarkup(from, to) {
    if (!from || !to) return '';
    const leg = D.travelBetween(from, to);
    const oneWay = from.rt && from.rt.type === 'line';
    if (!leg && !oneWay) return '';
    return `<div class="trip-leg">
      ${leg ? `<span>${icon('route')} ${esc(D.fmtKm(leg.road))} · ${esc(leg.label)} قيادة تقريبًا</span>
        <a href="${esc(leg.directions)}" target="_blank" rel="noopener noreferrer">${icon('link')} الطريق</a>` : ''}
      ${oneWay ? `<span class="warn-leg">${icon('warn')} المحطة السابقة باتجاه واحد — رتّب عودتك أو سيارتين</span>` : ''}
    </div>`;
  }

  /* ---------- نبذة ويكيبيديا ---------- */
  async function loadExtract(place) {
    const found = await P.extractFor(place);
    if (!found || state.detailId !== place.id) return;
    const sec = $('#wikiSection'), body = $('#wikiExtract'), credit = $('#wikiCredit');
    if (!sec || !body) return;
    body.textContent = found.text;
    if (credit) credit.innerHTML = `المصدر: <a href="${esc(found.page)}" target="_blank" rel="noopener noreferrer">ويكيبيديا الإنجليزية</a> — نص موسوعي قد لا يصف حالة المسار اليوم.`;
    sec.hidden = false;
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
    /* سمة الشريحة اسمها data-topic لا data-theme، لأن الوضع الداكن
       يضع data-theme على عنصر الجذر فيلتقطه closest لكل ضغطة. */
    if ((el = e.target.closest('[data-topic]'))) {
      state.theme = el.dataset.topic; state.favoritesOnly = false; state.limit = 12; renderExplore(); return;
    }
    if ((el = e.target.closest('[data-f]'))) {
      state[el.dataset.f] = el.dataset.v;
      if (el.dataset.f === 'sort' && el.dataset.v === 'near' && !state.pos) askLocation(() => { renderFilterSheet(); renderExplore(); });
      state.limit = 12;
      renderFilterSheet(); renderExplore(); return;
    }
    if ((el = e.target.closest('[data-triptab]'))) { state.tripTab = el.dataset.triptab; renderTrip(); return; }
    if ((el = e.target.closest('[data-cfield]'))) { w.DContribute.select(el.dataset.cfield); return; }
    if ((el = e.target.closest('[data-suggest]'))) {
      state.query = el.dataset.suggest; $('#searchInput').value = state.query; state.limit = 12; renderExplore(); return;
    }
    if ((el = e.target.closest('[data-set]'))) {
      const key = el.dataset.set; let v = el.dataset.val;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (!isNaN(parseFloat(v)) && key !== 'theme' && key !== 'units') v = parseFloat(v);
      store.settings[key] = v; store.saveSettings(); applySettings(); renderSettings();
      if (key === 'units' || key === 'pace') { renderExplore(); renderTrip(); if (state.detailId) redrawDetail(); }
      return;
    }
    if ((el = e.target.closest('[data-trip-pick]'))) { store.activeTrip = el.dataset.tripPick; store.saveTrip(); renderTrip(); return; }
    if ((el = e.target.closest('[data-trip-up]'))) { moveStop(el.dataset.tripUp, -1); return; }
    if ((el = e.target.closest('[data-trip-down]'))) { moveStop(el.dataset.tripDown, 1); return; }
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
      case 'recent-clear': store.recent = []; try { localStorage.removeItem('doroub8-recent'); } catch (err) { } renderHome(); break;
      case 'map-layer': { const kind = M.toggleMainLayer(); el.classList.toggle('on', kind !== 'standard'); D.toast('الطبقة: ' + M.tileLabel(kind)); break; }
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

      /* ---- الإعدادات والبيانات ---- */
      case 'settings': openSettings(); break;
      case 'close-settings': closeSettings(); break;
      case 'shortcuts': showShortcuts(); break;
      case 'install':
        if (installPrompt) { installPrompt.prompt(); installPrompt = null; renderSettings(); }
        else D.toast('في Safari: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»');
        break;
      case 'export-data':
        download('doroub-backup-' + new Date().toISOString().slice(0, 10) + '.json',
          'application/json', JSON.stringify(store.exportAll(), null, 1));
        D.toast('صُدِّرت بياناتك في ملف واحد');
        break;
      case 'import-data': $('#importFile').click(); break;
      case 'clear-cache':
        try { localStorage.removeItem('doroub8-photos'); } catch (err) { }
        D.toast('فُرّغت ذاكرة الصور — ستُجلب من جديد');
        break;
      case 'clear-searches': store.searches = []; try { localStorage.removeItem('doroub8-searches'); } catch (err) { } renderSuggestions(); break;

      /* ---- فكرة ٢: المساهمة ---- */
      case 'contribute': w.DContribute.open(place, el.dataset.field); break;
      case 'close-contribute':
        w.DContribute.close();
        if (!anySheetOpen()) document.body.classList.remove('is-locked');
        break;
      case 'contrib-github': w.DContribute.toGithub(); break;
      case 'contrib-copy': w.DContribute.toClipboard(); break;
      case 'contrib-file': w.DContribute.toFile(); break;

      /* ---- فكرة ٦: الحفظ دون اتصال ---- */
      case 'save-offline': w.DOffline.save(place); break;
      case 'forget-offline': w.DOffline.forget(place); break;

      /* ---- فكرة ٤: الموسم ---- */
      case 'toggle-season':
        state.seasonOnly = !state.seasonOnly;
        state.limit = 12; renderFilterSheet(); renderExplore();
        break;

      /* ---- فكرة ١: نقطة الانطلاق ---- */
      case 'copy-start':
        if (place && D.startLatLng(place)) {
          const st = D.startLatLng(place);
          navigator.clipboard?.writeText(`${st[0].toFixed(5)}, ${st[1].toFixed(5)}`)
            .then(() => D.toast('نُسخت إحداثيات نقطة الانطلاق')).catch(() => { });
        }
        break;

      /* ---- البحث والاكتشاف ---- */
      case 'surprise': closeSheet(); surprise(); break;
      case 'toggle-bounds':
        state.mapBoundsOnly = !state.mapBoundsOnly;
        if (state.mapBoundsOnly && !state.bounds) { M.buildMain(openDetail); M.publishBounds(); }
        state.limit = 12; renderFilterSheet(); renderExplore();
        break;
      case 'search-here':
        state.mapBoundsOnly = true; M.publishBounds(); state.limit = 24; go('explore');
        D.toast('عرضنا الأماكن ضمن إطار الخريطة');
        break;

      /* ---- المكان ---- */
      case 'visited':
        if (place) {
          store.visited[place.id] = new Date().toISOString().slice(0, 10);
          store.saveVisited(); D.toast('سجّلنا زيارتك'); redrawDetail();
        }
        break;
      case 'unvisited':
        if (place) { delete store.visited[place.id]; store.saveVisited(); redrawDetail(); }
        break;
      case 'copy-coords':
        if (place && D.latLng(place)) {
          const ll = D.latLng(place);
          navigator.clipboard?.writeText(`${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`)
            .then(() => D.toast('نُسخت الإحداثيات')).catch(() => D.toast(`${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}`));
        }
        break;
      case 'share-whatsapp':
        if (place) {
          const url = location.origin + location.pathname + '#place=' + encodeURIComponent(place.id);
          w.open('https://wa.me/?text=' + encodeURIComponent(`${place.n} على دُروب\n${url}`), '_blank', 'noopener');
        }
        break;

      /* ---- الرحلة ---- */
      case 'new-trip': { const t = store.newTrip('رحلة ' + (store.trips.length)); renderTrip(); D.toast('أنشأنا «' + t.name + '»'); break; }
      case 'delete-trip': store.removeTrip(store.activeTrip); renderTrip(); D.toast('حُذفت الرحلة'); break;
      case 'trip-gpx': tripGpx(); break;
      case 'trip-ics': tripIcs(); break;
      case 'share-whatsapp-trip':
        w.open('https://wa.me/?text=' + encodeURIComponent(tripText()), '_blank', 'noopener');
        break;
    }
  });

  /* اختصارات لوحة المفاتيح — تتجاهل الكتابة داخل الحقول. */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#contributeSheet').classList.contains('open')) {
        w.DContribute.close();
        if (!anySheetOpen()) document.body.classList.remove('is-locked');
      }
      else if ($('#settingsSheet').classList.contains('open')) closeSettings();
      else if ($('#filterSheet').classList.contains('open')) closeSheet();
      else if ($('#detailRoot').classList.contains('open')) closeDetail();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    const map = { '1': 'home', '2': 'explore', '3': 'map', '4': 'trip' };
    if (map[e.key]) { go(map[e.key]); return; }
    if (e.key === '/' || e.key === 's') { e.preventDefault(); go('explore'); setTimeout(() => $('#searchInput').focus(), 200); return; }
    if (e.key === 'f') { go('explore'); openSheet(); return; }
    if (e.key === 'g') { openSettings(); return; }
    if (e.key === 'r') { surprise(); return; }
    if (e.key === '?') { showShortcuts(); return; }
  });

  function showShortcuts() {
    D.toast('1-4 الشاشات · / بحث · f فلاتر · g إعدادات · r فاجئني · Esc إغلاق');
  }

  function surprise() {
    const list = D.query();
    if (!list.length) { D.toast('لا نتائج ضمن الفلاتر الحالية'); return; }
    openDetail(list[Math.floor(Math.random() * list.length)].id);
  }

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

  let searchTimer = null;
  document.addEventListener('input', e => {
    if (e.target.id === 'searchInput') {
      state.query = e.target.value; state.limit = 12; renderExplore();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => store.pushSearch(state.query), 1200);
    }
    if (e.target.id === 'tripNotes') { store.trip.notes = e.target.value; store.saveTrip(); }
    if (e.target.id === 'tripName') { store.trip.name = e.target.value || 'رحلتي'; store.saveTrip(); }
    if (e.target.id === 'placeNote' && state.detailId) {
      const v = e.target.value.trim();
      if (v) store.notes[state.detailId] = v; else delete store.notes[state.detailId];
      store.saveNotes();
    }
  });

  document.addEventListener('toggle', e => {
    if (!e.target.matches('details.fold') || !e.target.open) return;
    if (e.target.querySelector('#weatherBox')) loadWeather();
    if (e.target.id === 'sunFold') loadSun();
    if (e.target.id === 'galleryFold') loadGallery();
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
    if (readUrlFilters()) state.screen = 'explore';
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
    applySettings();
    setOnline();
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

    $('#settingsSheet').addEventListener('click', e => { if (e.target.id === 'settingsVeil') closeSettings(); });
    $('#contributeSheet').addEventListener('click', e => {
      if (e.target.id !== 'contributeVeil') return;
      w.DContribute.close();
      if (!anySheetOpen()) document.body.classList.remove('is-locked');
    });
    document.addEventListener('change', e => {
      if (e.target.id !== 'importFile') return;
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      file.text().then(txt => {
        store.importAll(JSON.parse(txt));
        applySettings(); renderSettings(); renderExplore(); renderTrip();
        D.toast('استُوردت بياناتك');
      }).catch(err => D.toast('تعذّر الاستيراد: ' + err.message));
      e.target.value = '';
    });

    M.onBoundsChange(() => { if (state.mapBoundsOnly && state.screen === 'explore') renderExplore(); });

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
