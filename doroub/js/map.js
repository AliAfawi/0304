/* دُروب V8 — الخرائط عبر Leaflet وبلاطات OpenStreetMap / OpenTopoMap.
   نميّز دائمًا بين نقطة معلم موثقة ودائرة منطقة تقريبية، ولا نرسم خط مشي مُخمَّنًا. */
(function (w) {
  'use strict';
  const D = w.D;

  const TILES = {
    standard: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors', label: 'خريطة الطرق' },
    terrain: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attr: '© OpenTopoMap (CC BY-SA) · © OpenStreetMap contributors', label: 'التضاريس' },
    humanitarian: { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors · Humanitarian OSM Team', label: 'تفاصيل الميدان' }
  };
  const ORDER = ['standard', 'terrain', 'humanitarian'];
  const nextKind = kind => ORDER[(ORDER.indexOf(kind) + 1) % ORDER.length];
  const tileLabel = kind => TILES[kind].label;
  const tile = kind => L.tileLayer(TILES[kind].url, { maxZoom: TILES[kind].max, attribution: TILES[kind].attr });

  const markerIcon = place => L.divIcon({
    className: '',
    html: `<div class="map-marker ${place.source === 'heritage' ? 'heritage' : 'nature'}"></div>`,
    iconSize: [28, 28], iconAnchor: [14, 26]
  });

  function areaCircle(place, map) {
    const area = D.areaOf(place);
    return L.circle(area.c, {
      radius: area.r, color: '#b8823f', weight: 1.4, dashArray: '5 6',
      fillColor: '#e8c489', fillOpacity: .05
    });
  }

  /* ---------- الخريطة الرئيسية ---------- */
  const main = { map: null, layer: null, kind: 'standard', group: null, me: null, onOpen: null };
  const VIEW_KEY = 'doroub8-map-view';
  const boundsListeners = [];
  const onBoundsChange = fn => boundsListeners.push(fn);

  function readView() {
    try { const v = JSON.parse(localStorage.getItem(VIEW_KEY)); return v && Number.isFinite(v.lat) ? v : null; } catch (e) { return null; }
  }
  function saveView() {
    if (!main.map) return;
    try {
      const c = main.map.getCenter();
      localStorage.setItem(VIEW_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, z: main.map.getZoom(), kind: main.kind }));
    } catch (e) { }
  }
  function publishBounds() {
    if (!main.map) return;
    const b = main.map.getBounds();
    D.state.bounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    boundsListeners.forEach(fn => { try { fn(); } catch (e) { } });
  }

  function buildMain(onOpen) {
    if (main.map || typeof L === 'undefined') return main.map;
    const host = D.$('#mapCanvas');
    if (!host) return null;
    main.onOpen = onOpen;
    try {
      const saved = readView();
      if (saved && TILES[saved.kind]) main.kind = saved.kind;
      main.map = L.map(host, { zoomControl: false, scrollWheelZoom: true, attributionControl: true })
        .setView(saved ? [saved.lat, saved.lng] : [31.6, 35.1], saved ? saved.z : 7);
      L.control.zoom({ position: 'bottomleft' }).addTo(main.map);
      L.control.scale({ position: 'bottomleft', imperial: D.store.settings.units === 'imperial', metric: D.store.settings.units !== 'imperial' }).addTo(main.map);
      main.layer = tile(main.kind).addTo(main.map);
      main.group = L.layerGroup().addTo(main.map);
      drawPlaces(onOpen);
      main.map.on('moveend zoomend', () => { saveView(); drawPlaces(main.onOpen); publishBounds(); });
      publishBounds();
      setTimeout(() => main.map.invalidateSize(), 180);
    } catch (e) {
      host.innerHTML = '<div style="padding:28px;text-align:center;color:#6d8a7c">تعذّر عرض الخريطة. تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.</div>';
    }
    return main.map;
  }

  /* يجمع الدبابيس المتقاربة في دائرة واحدة عند التصغير، حتى لا تتكدّس على الشاشة. */
  function clusterPlaces(places, onOpen) {
    const zoom = main.map.getZoom();
    const cell = zoom >= 11 ? 0 : zoom >= 9 ? 0.15 : zoom >= 8 ? 0.35 : 0.7;
    if (!cell) return null;
    const buckets = new Map();
    places.forEach(place => {
      const ll = D.latLng(place);
      if (!ll) return;
      const key = Math.round(ll[0] / cell) + ':' + Math.round(ll[1] / cell);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ place, ll });
    });
    const out = [];
    for (const items of buckets.values()) {
      if (items.length === 1) { out.push({ single: items[0].place }); continue; }
      const lat = items.reduce((n, x) => n + x.ll[0], 0) / items.length;
      const lng = items.reduce((n, x) => n + x.ll[1], 0) / items.length;
      out.push({ cluster: items.map(x => x.place), at: [lat, lng] });
    }
    return out;
  }

  function clusterIcon(count) {
    const size = count > 20 ? 48 : count > 8 ? 42 : 36;
    return L.divIcon({
      className: '',
      html: `<div class="map-cluster" style="width:${size}px;height:${size}px">${count}</div>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2]
    });
  }

  function drawPlaces(onOpen) {
    if (!main.map || !main.group) return;
    main.group.clearLayers();
    let known = 0;
    const grouped = clusterPlaces(D.PLACES, onOpen);
    if (grouped) {
      const singles = [];
      grouped.forEach(entry => {
        if (entry.single) { singles.push(entry.single); return; }
        known += entry.cluster.length;
        L.marker(entry.at, { icon: clusterIcon(entry.cluster.length) })
          .on('click', () => main.map.setView(entry.at, Math.min(main.map.getZoom() + 3, 14), { animate: true }))
          .bindTooltip(entry.cluster.length + ' أماكن — اضغط للتقريب', { direction: 'top' })
          .addTo(main.group);
      });
      D.PLACES.filter(p => !D.latLng(p)).forEach(p => addPlaceLayer(p, onOpen));
      singles.forEach(p => { known++; addPlaceLayer(p, onOpen); });
      const counter = D.$('#mapCounter');
      if (counter) counter.textContent = `${D.PLACES.length} موقعًا · ${known} بإحداثيات`;
      return;
    }
    D.PLACES.forEach(place => {
      const exact = D.latLng(place);
      if (exact) known++;
      const layer = exact ? L.marker(exact, { icon: markerIcon(place) }) : areaCircle(place, main.map);
      const node = document.createElement('div');
      node.dir = 'rtl';
      const title = document.createElement('b');
      title.textContent = place.n;
      const sub = document.createElement('p');
      sub.textContent = exact
        ? (place.geoPrecision === 'wiki'
          ? 'إحداثيات مرجعية من ويكيبيديا — ليست نقطة انطلاق مؤكدة'
          : 'موقع المعلم — ليس بالضرورة بداية المشي')
        : 'دائرة منطقة تقريبية فقط، لا تصلح للتوجه إلى المسار';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'افتح صفحة المكان';
      btn.addEventListener('click', () => onOpen && onOpen(place.id));
      node.append(title, sub, btn);
      layer.bindPopup(node);
      layer.addTo(main.group);
    });
    const counter = D.$('#mapCounter');
    if (counter) counter.textContent = `${D.PLACES.length} موقعًا · ${known} بإحداثيات`;
  }

  /* طبقة مكان واحد — تُستعمل في الوضع المجمَّع وغير المجمَّع معًا. */
  function addPlaceLayer(place, onOpen) {
    const exact = D.latLng(place);
    const layer = exact ? L.marker(exact, { icon: markerIcon(place) }) : areaCircle(place, main.map);
    const node = document.createElement('div');
    node.dir = 'rtl';
    const title = document.createElement('b');
    title.textContent = place.n;
    const sub = document.createElement('p');
    sub.textContent = exact
      ? (place.geoPrecision === 'wiki'
        ? 'إحداثيات مرجعية من ويكيبيديا — ليست نقطة انطلاق مؤكدة'
        : 'موقع المعلم — ليس بالضرورة بداية المشي')
      : 'دائرة منطقة تقريبية فقط، لا تصلح للتوجه إلى المسار';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'افتح صفحة المكان';
    btn.addEventListener('click', () => onOpen && onOpen(place.id));
    node.append(title, sub, btn);
    layer.bindPopup(node);
    layer.addTo(main.group);
  }

  function refreshMain(onOpen) { if (main.map) drawPlaces(onOpen); }

  function toggleMainLayer() {
    if (!main.map) return main.kind;
    main.kind = nextKind(main.kind);
    main.map.removeLayer(main.layer);
    main.layer = tile(main.kind).addTo(main.map);
    saveView();
    return main.kind;
  }

  function focus(place) {
    if (!main.map) return;
    const exact = D.latLng(place);
    main.map.setView(exact || D.areaOf(place).c, exact ? 13 : D.areaOf(place).z, { animate: true });
  }

  function showMe(map, pos, track) {
    if (!map || !pos) return;
    if (map.__me) { try { map.removeLayer(map.__me); } catch (e) { } }
    const group = L.layerGroup();
    /* دائرة دقّة القياس: تُظهر للزائر مدى الثقة في موقعه بدل نقطة واحدة موهمة بالدقّة. */
    if (Number.isFinite(D.state.accuracy) && D.state.accuracy > 0) {
      L.circle(pos, { radius: D.state.accuracy, color: '#1a73c7', weight: 1, fillColor: '#1a73c7', fillOpacity: .1 })
        .bindTooltip('دقة التحديد ±' + Math.round(D.state.accuracy) + ' م').addTo(group);
    }
    L.circleMarker(pos, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73c7', fillOpacity: 1 })
      .bindPopup('موقعك الحالي').addTo(group);
    if (track && track.length > 1) {
      L.polyline(track.map(p => [p[0], p[1]]), { color: '#1a73c7', weight: 4, opacity: .85 }).addTo(group);
    }
    group.addTo(map);
    map.__me = group;
  }

  /* ---------- خريطة داخل صفحة المكان ---------- */
  const detail = { map: null, layer: null, kind: 'standard' };

  function buildDetail(place, track) {
    destroyDetail();
    const host = D.$('#detailMap');
    if (!host || typeof L === 'undefined') {
      if (host) host.innerHTML = '<div style="padding:22px;text-align:center;font-size:13px;color:#6d8a7c">تعذّر تحميل مكتبة الخرائط.</div>';
      return null;
    }
    try {
      const exact = D.latLng(place);
      const area = D.areaOf(place);
      const start = track && track.points.length ? [track.points[0][0], track.points[0][1]] : (exact || area.c);
      detail.map = L.map(host, { zoomControl: true, scrollWheelZoom: false })
        .setView(start, track && track.points.length ? 13 : exact ? 13 : area.z);
      detail.layer = tile(detail.kind).addTo(detail.map);
      if (exact) {
        L.marker(exact, { icon: markerIcon(place) }).addTo(detail.map)
          .bindPopup(place.geoPrecision === 'wiki'
            ? 'إحداثيات مرجعية من ويكيبيديا — ليست نقطة انطلاق'
            : 'موقع المعلم — ليست نقطة انطلاق مؤكدة');
      } else {
        areaCircle(place, detail.map).addTo(detail.map)
          .bindPopup('منطقة تقريبية فقط — لا توجد إحداثيات موثقة لهذا المكان');
      }
      if (track && track.points.length) {
        const line = L.polyline(track.points.map(p => [p[0], p[1]]), { color: '#12a35b', weight: 5, opacity: .95 }).addTo(detail.map);
        detail.map.fitBounds(line.getBounds(), { padding: [30, 30], maxZoom: 15 });
      }
      setTimeout(() => detail.map && detail.map.invalidateSize(), 170);
    } catch (e) {
      host.innerHTML = '<div style="padding:22px;text-align:center;font-size:13px;color:#6d8a7c">تعذّر عرض الخريطة مؤقتًا.</div>';
    }
    return detail.map;
  }

  function destroyDetail() {
    if (detail.map) { try { detail.map.remove(); } catch (e) { } }
    detail.map = null;
  }

  function toggleDetailLayer() {
    if (!detail.map) return detail.kind;
    detail.kind = nextKind(detail.kind);
    detail.map.removeLayer(detail.layer);
    detail.layer = tile(detail.kind).addTo(detail.map);
    return detail.kind;
  }

  function fitDetail(place, track) {
    if (!detail.map) return;
    if (track && track.points.length) {
      detail.map.fitBounds(L.latLngBounds(track.points.map(p => [p[0], p[1]])), { padding: [26, 26] });
      return;
    }
    const exact = D.latLng(place);
    detail.map.setView(exact || D.areaOf(place).c, exact ? 13 : D.areaOf(place).z);
  }

  w.DMap = {
    buildMain, refreshMain, toggleMainLayer, focus, showMe, onBoundsChange, publishBounds, tileLabel,
    buildDetail, destroyDetail, toggleDetailLayer, fitDetail,
    get main() { return main.map; },
    get detail() { return detail.map; },
    get mainKind() { return main.kind; },
    get detailKind() { return detail.kind; }
  };
})(window);
