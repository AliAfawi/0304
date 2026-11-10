/* دُروب V8 — الخرائط عبر Leaflet وبلاطات OpenStreetMap / OpenTopoMap.
   نميّز دائمًا بين نقطة معلم موثقة ودائرة منطقة تقريبية، ولا نرسم خط مشي مُخمَّنًا. */
(function (w) {
  'use strict';
  const D = w.D;

  const TILES = {
    standard: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap contributors' },
    terrain: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attr: '© OpenTopoMap (CC BY-SA) · © OpenStreetMap contributors' }
  };
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
  const main = { map: null, layer: null, kind: 'standard', group: null, me: null };

  function buildMain(onOpen) {
    if (main.map || typeof L === 'undefined') return main.map;
    const host = D.$('#mapCanvas');
    if (!host) return null;
    try {
      main.map = L.map(host, { zoomControl: false, scrollWheelZoom: true, attributionControl: true })
        .setView([31.6, 35.1], 7);
      L.control.zoom({ position: 'bottomleft' }).addTo(main.map);
      main.layer = tile(main.kind).addTo(main.map);
      main.group = L.layerGroup().addTo(main.map);
      drawPlaces(onOpen);
      setTimeout(() => main.map.invalidateSize(), 180);
    } catch (e) {
      host.innerHTML = '<div style="padding:28px;text-align:center;color:#6d8a7c">تعذّر عرض الخريطة. تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.</div>';
    }
    return main.map;
  }

  function drawPlaces(onOpen) {
    if (!main.map || !main.group) return;
    main.group.clearLayers();
    let known = 0;
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

  function refreshMain(onOpen) { if (main.map) drawPlaces(onOpen); }

  function toggleMainLayer() {
    if (!main.map) return main.kind;
    main.kind = main.kind === 'standard' ? 'terrain' : 'standard';
    main.map.removeLayer(main.layer);
    main.layer = tile(main.kind).addTo(main.map);
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
    detail.kind = detail.kind === 'standard' ? 'terrain' : 'standard';
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
    buildMain, refreshMain, toggleMainLayer, focus, showMe,
    buildDetail, destroyDetail, toggleDetailLayer, fitDetail,
    get main() { return main.map; },
    get detail() { return detail.map; },
    get mainKind() { return main.kind; },
    get detailKind() { return detail.kind; }
  };
})(window);
