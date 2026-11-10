/* دُروب V8 — النواة: الكتالوج الموحّد، التسميات، الحالة، والتخزين المحلي. */
window.D = (function () {
  'use strict';

  /* ---------- أدوات عامة ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const httpsOnly = u => /^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : null;

  /* ---------- تطبيع النص العربي للبحث ----------
     يوحّد الهمزات والألف المقصورة والتاء المربوطة ويزيل التشكيل والتطويل،
     فيجد «الاقصى» و«الأقصى»، و«قلعه» و«قلعة»، و«مقام» بأي تشكيل. */
  const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  function normalize(text) {
    return String(text ?? '')
      .toLowerCase()
      .replace(AR_DIACRITICS, '')
      .replace(/[إأآٱا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* يحوّل حرفًا واحدًا إلى صورته المطبّعة دون قصّ أو دمج مسافات،
     حتى تبقى مواضع الحروف قابلة للمطابقة مع النص الأصلي. */
  function normalizeChar(ch) {
    const low = ch.toLowerCase();
    if (AR_DIACRITICS.test(low)) { AR_DIACRITICS.lastIndex = 0; return ''; }
    AR_DIACRITICS.lastIndex = 0;
    if ('إأآٱا'.includes(low)) return 'ا';
    if (low === 'ى' || low === 'ئ') return 'ي';
    if (low === 'ؤ') return 'و';
    if (low === 'ة') return 'ه';
    return /[\p{L}\p{N}]/u.test(low) ? low : ' ';
  }

  /* يبرز أجزاء النص المطابقة للبحث، ويعيد HTML مُهرَّبًا جاهزًا للعرض. */
  function highlight(text, needle) {
    const raw = String(text ?? '');
    const words = [...new Set(normalize(needle).split(' ').filter(w => w.length > 1))];
    if (!words.length) return esc(raw);

    let flat = '';
    const map = [];
    for (let i = 0; i < raw.length; i++) {
      for (const ch of normalizeChar(raw[i])) { flat += ch; map.push(i); }
    }

    const marks = new Array(raw.length).fill(false);
    for (const w of words) {
      let from = 0, at;
      while ((at = flat.indexOf(w, from)) > -1) {
        for (let k = at; k < at + w.length; k++) marks[map[k]] = true;
        from = at + 1;
      }
    }

    let out = '', open = false;
    for (let i = 0; i < raw.length; i++) {
      if (marks[i] && !open) { out += '<mark>'; open = true; }
      else if (!marks[i] && open) { out += '</mark>'; open = false; }
      out += esc(raw[i]);
    }
    return out + (open ? '</mark>' : '');
  }

  /* ---------- أيقونات خطية موحّدة ---------- */
  const PATHS = {
    home: '<path d="m3 11 9-8 9 8v10H3V11Z"/><path d="M9 21v-7h6v7"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4z"/>',
    map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><path d="M9 3v15m6-12v15"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
    bag: '<rect x="3" y="7" width="18" height="14" rx="2.5"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',
    heart: '<path d="M20.8 4.7a5.3 5.3 0 0 0-7.5 0L12 6l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.8a5.3 5.3 0 0 0 0-7.5Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    sliders: '<path d="M4 7h16m-16 10h16"/><circle cx="9" cy="7" r="2.4"/><circle cx="15" cy="17" r="2.4"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    back: '<path d="M5 12h14m-7-7-7 7 7 7"/>',
    arrow: '<path d="M19 12H5m7 7-7-7 7-7"/>',
    route: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h7a5 5 0 0 1 0 10H9a5 5 0 0 0-4 2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mountain: '<path d="m2 20 8-15 5 9 2-4 5 10H2Z"/>',
    steps: '<path d="M8 11c-1-2-4-1-4 3s2 6 4 6 3-4 0-9Zm8-6c1-2 4-1 4 3s-2 6-4 6-3-4 0-9Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    warn: '<path d="M12 3 2 21h20L12 3Zm0 7v5m0 3h.01"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-5"/>',
    plus: '<path d="M12 4v16m-8-8h16"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.5 10.5 7-4m-7 8 7 3"/>',
    print: '<path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6z"/>',
    link: '<path d="M12 4h8v8m0-8-10 10M20 14v6H4V4h6"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19 19 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.8l-1.9 1.9a16 16 0 0 0 6.1 6.1l1.9-1.9a2 2 0 0 1 1.8-.6l2.8.5a2 2 0 0 1 1.7 2Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4m0-15.6-1.4 1.4M5.6 18.4l-1.4 1.4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2.4"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    book: '<path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Z"/><path d="M4 17a3 3 0 0 1 3-3h13"/>',
    trash: '<path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-7M3 4v6h6"/>',
    filePlus: '<path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4m-6 4v6m-3-3h6"/>'
  };
  const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[n] || PATHS.info}</svg>`;
  const paintIcons = (root = document) => $$('[data-i]', root).forEach(el => {
    const n = el.dataset.i; el.removeAttribute('data-i'); el.innerHTML = icon(n);
  });

  /* ---------- التسميات ---------- */
  const LEVEL = { easy: 'سهل', mid: 'متوسط', hard: 'صعب', exp: 'متقدم', unk: 'غير محدد' };
  const REGION = { S: 'الجنوب والنقب', C: 'المركز والقدس', N: 'الشمال والجليل' };
  const FEE = { ok: 'مجاني حسب المصدر', q: 'تحقق من الرسوم', u: 'غير موثّق', p: 'بتذكرة', c: 'الدخول بشروط', f: 'قد توجد رسوم' };
  const VISIT = { hours: 'ساعات منشورة', appointment: 'حجز مسبق', unknown: 'تأكد من الفتح' };
  const KIND = { mosque: 'مسجد تاريخي', maqam: 'مقام', religious: 'معلم ديني', ruins: 'موقع أثري', nature: 'معلم طبيعي', trail: 'مسار مشي' };
  const THEMES = [
    { id: 'all', name: 'الكل', ic: '🧭' },
    { id: 'water', name: 'مياه وشلالات', ic: '💦' },
    { id: 'views', name: 'جبال وإطلالات', ic: '⛰️' },
    { id: 'forest', name: 'غابات وخضرة', ic: '🌿' },
    { id: 'desert', name: 'صحراء وأودية', ic: '🏜️' },
    { id: 'family', name: 'للعائلة', ic: '👨‍👩‍👧' },
    { id: 'history', name: 'تاريخ وآثار', ic: '🏛️' },
    { id: 'religious', name: 'معالم دينية', ic: '🕌' }
  ];

  /* ---------- بناء الكتالوج الموحّد ---------- */
  const ZONES = window.DOROUB_ZONES || [];
  const REGIONS = window.DOROUB_REGIONS || [];
  const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));
  const WIKI_FB = window.DOROUB_WIKI_FALLBACK || {};
  const HERITAGE_IDS = new Set((window.DOROUB_HERITAGE || []).map(h => h.id));

  const PLACES = (window.DOROUB_TRAILS || []).map(raw => {
    const t = Object.assign({}, raw);
    if (!t.heritageType) t.heritageType = t.category === 'مسار مشي' ? 'trail' : 'nature';
    if (!t.visitStatus) t.visitStatus = 'unknown';
    t.source = HERITAGE_IDS.has(t.id) ? 'heritage' : 'trail';
    t.wiki = t.photoWiki || WIKI_FB[t.id] || null;
    t.zone = ZONE_BY_ID[t.z] || null;
    t.zoneName = t.zone ? t.zone.name : REGION[t.r];
    t.kindLabel = KIND[t.heritageType] || 'معلم طبيعي';
    t.levelLabel = LEVEL[t.lv] || LEVEL.unk;
    t.regionLabel = REGION[t.r] || '';
    t.kmLabel = t.kr ? t.kr + ' كم' : (t.km != null ? t.km + ' كم' : 'غير موثقة');
    t.highlight = t.feature || t.land ||
      ({ S: 'أخاديد وجبال وألوان الصحراء', C: 'طبيعة وآثار قريبة من المدن', N: 'غابات وينابيع وإطلالات' }[t.r] || '');
    t.searchText = normalize([t.n, t.en, t.d, t.feature, t.land, t.wz, t.era, t.opening, t.kindLabel, t.zoneName]
      .filter(Boolean).join(' '));
    /* نسبة اكتمال البيانات: مؤشر صادق يُعرض للزائر بدل إخفاء النقص. */
    const fields = [t.d, t.feature || t.land, t.place, t.opening, t.src,
      t.siteOnly ? t.era : (t.km != null || t.kr), t.siteOnly ? t.visitKind : t.h, t.siteOnly ? t.phone : t.up];
    t.completeness = Math.round(fields.filter(Boolean).length / fields.length * 100);
    return t;
  });
  const BY_ID = Object.fromEntries(PLACES.map(p => [p.id, p]));
  const byId = id => BY_ID[id] || null;

  /* الإحداثيات المجهّزة مسبقًا تُطبَّق فور التحميل، فتظهر الخريطة كاملة
     دون انتظار أي استعلام شبكي. تبقى موسومة بأنها مرجعية لا نقطة انطلاق. */
  const BAKED = window.DOROUB_WIKI_CACHE || {};
  PLACES.forEach(p => {
    if (p.place || !p.wiki) return;
    const row = BAKED[p.wiki];
    if (!row || !row.coord) return;
    p.place = { lat: row.coord.lat, lng: row.coord.lng, label: 'إحداثيات مرجعية من ويكيبيديا، وليست بداية مسار مشي' };
    p.geoPrecision = 'wiki';
  });

  ZONES.forEach(z => { z.count = PLACES.filter(p => p.z === z.id).length; });
  REGIONS.forEach(r => { r.count = PLACES.filter(p => p.r === r.id).length; });

  /* ---------- جغرافيا ---------- */
  const AREA = {
    eilat: { c: [29.62, 34.93], z: 10, r: 30000 }, dead: { c: [31.1, 35.35], z: 9, r: 55000 },
    timna: { c: [29.79, 34.96], z: 11, r: 18000 }, coast: { c: [32.18, 34.84], z: 10, r: 40000 },
    negev: { c: [30.86, 34.8], z: 9, r: 75000 }, jer: { c: [31.82, 35.18], z: 10, r: 45000 },
    galilee: { c: [32.82, 35.45], z: 9, r: 55000 }, shfela: { c: [31.85, 34.99], z: 10, r: 25000 },
    carmel: { c: [32.62, 34.92], z: 10, r: 22000 }, south_coast: { c: [31.68, 34.58], z: 10, r: 22000 },
    golan: { c: [33.25, 35.69], z: 11, r: 20000 }, coastnorth: { c: [32.54, 34.92], z: 11, r: 18000 }
  };
  const areaOf = p => AREA[p.z] || AREA[p.r === 'S' ? 'negev' : p.r === 'N' ? 'galilee' : 'jer'];
  const latLng = p => p && p.place && Number.isFinite(p.place.lat) && Number.isFinite(p.place.lng)
    ? [p.place.lat, p.place.lng] : null;
  const centerOf = p => latLng(p) || areaOf(p).c;
  function haversine(a, b) {
    const d = Math.PI / 180, x = (b[0] - a[0]) * d, y = (b[1] - a[1]) * d;
    const h = Math.sin(x / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(y / 2) ** 2;
    return 12742 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  /* ---------- التخزين على الجهاز ---------- */
  const read = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch (e) { return fb; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  const DEFAULT_SETTINGS = {
    theme: 'auto',        /* auto | light | dark */
    fontScale: 1,         /* 1 | 1.12 | 1.25 */
    units: 'metric',      /* metric | imperial */
    pace: 4.5,            /* كم/ساعة لتقدير زمن المشي */
    reduceMotion: false
  };

  const blankTrip = (name = 'رحلتي') => ({ id: 't' + Date.now().toString(36), name, ids: [], date: '', notes: '' });

  const store = {
    favorites: read('doroub8-favorites', {}),
    checks: read('doroub8-checks', {}),
    notes: read('doroub8-notes', {}),          /* ملاحظات شخصية لكل مكان */
    visited: read('doroub8-visited', {}),      /* سجل الزيارات: id -> تاريخ */
    recent: read('doroub8-recent', []),        /* آخر ما تصفّحه الزائر */
    searches: read('doroub8-searches', []),    /* عمليات البحث الأخيرة */
    settings: Object.assign({}, DEFAULT_SETTINGS, read('doroub8-settings', {})),
    trips: (() => {
      const saved = read('doroub8-trips', null);
      if (Array.isArray(saved) && saved.length) return saved;
      /* ترقية من نسخة الرحلة الواحدة القديمة دون فقدان بيانات الزائر. */
      const legacy = read('doroub8-trip', null);
      const first = blankTrip();
      if (legacy && Array.isArray(legacy.ids)) Object.assign(first, { ids: legacy.ids, date: legacy.date || '', notes: legacy.notes || '' });
      return [first];
    })(),
    activeTrip: read('doroub8-active-trip', ''),

    get trip() {
      const found = this.trips.find(t => t.id === this.activeTrip);
      if (found) return found;
      this.activeTrip = this.trips[0].id;
      return this.trips[0];
    },

    saveFavorites() { write('doroub8-favorites', this.favorites); },
    saveChecks() { write('doroub8-checks', this.checks); },
    saveNotes() { write('doroub8-notes', this.notes); },
    saveVisited() { write('doroub8-visited', this.visited); },
    saveSettings() { write('doroub8-settings', this.settings); },
    saveTrip() { write('doroub8-trips', this.trips); write('doroub8-active-trip', this.activeTrip); },
    newTrip(name) { const t = blankTrip(name); this.trips.push(t); this.activeTrip = t.id; this.saveTrip(); return t; },
    removeTrip(id) {
      this.trips = this.trips.filter(t => t.id !== id);
      if (!this.trips.length) this.trips = [blankTrip()];
      if (!this.trips.some(t => t.id === this.activeTrip)) this.activeTrip = this.trips[0].id;
      this.saveTrip();
    },
    pushRecent(id) {
      this.recent = [id, ...this.recent.filter(x => x !== id)].slice(0, 12);
      write('doroub8-recent', this.recent);
    },
    pushSearch(q) {
      const text = String(q || '').trim();
      if (text.length < 2) return;
      this.searches = [text, ...this.searches.filter(x => x !== text)].slice(0, 8);
      write('doroub8-searches', this.searches);
    },
    /* تصدير واستيراد كل ما يخصّ الزائر في ملف واحد. */
    exportAll() {
      return {
        app: 'doroub', version: 8, exportedAt: new Date().toISOString(),
        favorites: this.favorites, checks: this.checks, notes: this.notes,
        visited: this.visited, trips: this.trips, settings: this.settings
      };
    },
    importAll(data) {
      if (!data || data.app !== 'doroub') throw new Error('هذا الملف ليس نسخة من بيانات دُروب');
      if (data.favorites) { this.favorites = data.favorites; this.saveFavorites(); }
      if (data.checks) { this.checks = data.checks; this.saveChecks(); }
      if (data.notes) { this.notes = data.notes; this.saveNotes(); }
      if (data.visited) { this.visited = data.visited; this.saveVisited(); }
      if (Array.isArray(data.trips) && data.trips.length) { this.trips = data.trips; this.activeTrip = data.trips[0].id; this.saveTrip(); }
      if (data.settings) { this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings); this.saveSettings(); }
    }
  };

  /* ---------- حالة الواجهة ---------- */
  const state = {
    screen: 'home',
    query: '', theme: 'all', region: 'all', zone: 'all',
    level: 'all', kind: 'all', visit: 'all', era: 'all',
    sort: 'featured', favoritesOnly: false, limit: 12,
    pos: null, accuracy: null, detailId: null, tripTab: 'plan',
    radius: 'all',          /* فلتر نصف القطر بالكيلومترات */
    mapBoundsOnly: false,   /* قصر النتائج على إطار الخريطة الحالي */
    bounds: null,
    tracks: {}, gps: { on: false, watch: null, points: [], start: 0, timer: null }
  };

  /* ---------- التصفية والترتيب ---------- */
  const FEATURED_ORDER = ['redcanyon', 'banias-fall', 'ein-avdat', 't-pillars', 'masada-snake', 'hist-caesarea', 'sataf-combo', 'tel-dan', 'arbel', 'hist-jazzar'];
  const LEVEL_ORDER = { easy: 1, mid: 2, hard: 3, exp: 4, unk: 5 };

  function matchesTheme(p, theme) {
    if (theme === 'all') return true;
    const txt = [p.n, p.d, p.feature || '', p.land || '', p.era || ''].join(' ');
    switch (theme) {
      case 'water': return /مياه|ماء|شلال|ينبوع|ينابيع|نهر|بركة|سباحة|قناة/.test(txt);
      case 'views': return /جبل|جبال|قمة|إطلال|بانورام|جرف|فوهة|مشهد|تل /.test(txt);
      case 'forest': return /غاب|حرش|شجر|ظل|خضر|أحراش|بستان|تراس/.test(txt);
      case 'desert': return p.r === 'S' || /صحراء|نقب|وادي|أخدود/.test(txt);
      case 'family': return p.lv === 'easy' || /عائل|الأطفال|طفل|مستو/.test(txt);
      case 'history': return ['ruins', 'religious', 'mosque', 'maqam'].includes(p.heritageType) || /آثار|أثر|رومان|قلعة|تاريخ|معبد|أثري|نبطي/.test(txt);
      case 'religious': return ['religious', 'maqam', 'mosque'].includes(p.heritageType);
      default: return true;
    }
  }

  function distanceTo(p) {
    const ll = latLng(p);
    return state.pos && ll ? haversine(state.pos, ll) : Infinity;
  }

  function inBounds(p) {
    const ll = latLng(p);
    if (!ll || !state.bounds) return false;
    const b = state.bounds;
    return ll[0] >= b.south && ll[0] <= b.north && ll[1] >= b.west && ll[1] <= b.east;
  }

  function query() {
    const q = normalize(state.query);
    const radius = state.radius === 'all' ? Infinity : Number(state.radius);
    let list = PLACES.filter(p =>
      (!state.mapBoundsOnly || inBounds(p)) &&
      (radius === Infinity || !state.pos || distanceTo(p) <= radius) &&
      (!state.favoritesOnly || store.favorites[p.id]) &&
      (state.region === 'all' || p.r === state.region) &&
      (state.zone === 'all' || p.z === state.zone) &&
      (state.level === 'all' || p.lv === state.level) &&
      (state.kind === 'all' || p.heritageType === state.kind) &&
      (state.visit === 'all' || p.visitStatus === state.visit) &&
      (state.era === 'all' || (p.era || '').includes(state.era)) &&
      matchesTheme(p, state.theme) &&
      (!q || p.searchText.includes(q))
    );
    const rank = id => { const i = FEATURED_ORDER.indexOf(id); return i < 0 ? 99 : i; };
    if (state.sort === 'short') list.sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
    else if (state.sort === 'level') list.sort((a, b) => LEVEL_ORDER[a.lv] - LEVEL_ORDER[b.lv]);
    else if (state.sort === 'name') list.sort((a, b) => a.n.localeCompare(b.n, 'ar'));
    else if (state.sort === 'near' && state.pos) list.sort((a, b) => distanceTo(a) - distanceTo(b));
    else if (state.sort === 'complete') list.sort((a, b) => b.completeness - a.completeness);
    else list.sort((a, b) => rank(a.id) - rank(b.id));
    return list;
  }

  /* ---------- وحدات القياس ---------- */
  const imperial = () => store.settings.units === 'imperial';
  function fmtKm(km) {
    if (km == null || !Number.isFinite(+km)) return null;
    const v = +km;
    return imperial() ? (v * 0.621371).toFixed(v < 10 ? 1 : 0) + ' ميل' : (Number.isInteger(v) ? v : v.toFixed(1)) + ' كم';
  }
  function fmtM(metres) {
    if (metres == null || !Number.isFinite(+metres)) return null;
    const v = +metres;
    return imperial() ? Math.round(v * 3.28084) + ' قدم' : Math.round(v) + ' م';
  }
  /* يعيد صياغة نص مسافة مخزّن مثل «8–15 كم» أو «5.5 كم» حسب وحدة الزائر. */
  function kmText(place) {
    if (place.siteOnly) return 'جولة موقع';
    if (place.kr) {
      if (!imperial()) return place.kr + ' كم';
      const parts = String(place.kr).split(/[–-]/).map(x => parseFloat(x)).filter(Number.isFinite);
      if (parts.length === 2) return parts.map(x => (x * 0.621371).toFixed(1)).join('–') + ' ميل';
      return place.kr + ' كم';
    }
    return place.km != null ? fmtKm(place.km) : 'غير موثقة';
  }

  /* ---------- تقدير زمن المشي (قاعدة نيسميث) ---------- */
  /* الزمن الأساسي من المسافة بسرعة الزائر، مضافًا إليه ساعة لكل 600 متر صعود. */
  function estimateWalk(place) {
    const km = place.km != null ? place.km : (place.kr ? parseFloat(String(place.kr).split(/[–-]/)[0]) : null);
    if (!Number.isFinite(km)) return null;
    const pace = Math.max(1.5, Math.min(8, +store.settings.pace || 4.5));
    const climb = parseFloat(String(place.up || '').replace(/[^\d.]/g, ''));
    let hours = km / pace + (Number.isFinite(climb) ? climb / 600 : 0);
    const h = Math.floor(hours), m = Math.round((hours - h) * 60);
    return { hours, label: (h ? h + ' س ' : '') + (m ? m + ' د' : (h ? '' : 'أقل من دقيقة')) };
  }

  /* ---------- اتجاه البوصلة من موقعك ---------- */
  const COMPASS = ['شمالًا', 'شمالًا شرقًا', 'شرقًا', 'جنوبًا شرقًا', 'جنوبًا', 'جنوبًا غربًا', 'غربًا', 'شمالًا غربًا'];
  function bearingTo(place) {
    const to = latLng(place);
    if (!state.pos || !to) return null;
    const d = Math.PI / 180;
    const [lat1, lon1] = state.pos.map(x => x * d), [lat2, lon2] = to.map(x => x * d);
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return { deg, label: COMPASS[Math.round(deg / 45) % 8] };
  }

  /* ---------- أماكن قريبة ومشابهة ---------- */
  function nearbyTo(place, limit = 4, maxKm = 35) {
    const from = latLng(place);
    if (!from) return [];
    return PLACES
      .filter(p => p.id !== place.id && latLng(p))
      .map(p => ({ p, km: haversine(from, latLng(p)) }))
      .filter(x => x.km <= maxKm)
      .sort((a, b) => a.km - b.km)
      .slice(0, limit);
  }
  function similarTo(place, limit = 4) {
    const score = p => (p.z === place.z ? 3 : 0) + (p.heritageType === place.heritageType ? 2 : 0)
      + (p.lv === place.lv ? 1 : 0) + (p.era && p.era === place.era ? 2 : 0);
    return PLACES.filter(p => p.id !== place.id && score(p) >= 3)
      .sort((a, b) => score(b) - score(a)).slice(0, limit);
  }

  function activeFilterCount() {
    let n = 0;
    ['region', 'zone', 'level', 'kind', 'visit', 'era', 'radius'].forEach(k => { if (state[k] !== 'all') n++; });
    if (state.mapBoundsOnly) n++;
    if (state.theme !== 'all') n++;
    if (state.sort !== 'featured') n++;
    if (state.favoritesOnly) n++;
    return n;
  }

  function resetFilters() {
    Object.assign(state, {
      query: '', theme: 'all', region: 'all', zone: 'all', level: 'all',
      kind: 'all', visit: 'all', era: 'all', sort: 'featured', favoritesOnly: false, limit: 12,
      radius: 'all', mapBoundsOnly: false
    });
  }

  /* ---------- روابط ---------- */
  const sourceLink = p => httpsOnly(p.src) || 'https://www.parks.org.il/';
  const externalMap = p => latLng(p)
    ? `https://www.google.com/maps/search/?api=1&query=${latLng(p)[0]},${latLng(p)[1]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.wz || p.en || p.n)}`;

  /* ---------- تنبيه ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  return {
    $, $$, esc, httpsOnly, icon, paintIcons,
    LEVEL, REGION, FEE, VISIT, KIND, THEMES, REGIONS, ZONES, ZONE_BY_ID,
    PLACES, byId, state, store, query, activeFilterCount, resetFilters,
    latLng, centerOf, areaOf, haversine, distanceTo, matchesTheme,
    sourceLink, externalMap, toast,
    normalize, highlight, fmtKm, fmtM, kmText, estimateWalk, bearingTo,
    nearbyTo, similarTo, inBounds,
    CHECKS: window.DOROUB_CHECKS || [], COLLECTIONS: window.DOROUB_COLLECTIONS || []
  };
})();
