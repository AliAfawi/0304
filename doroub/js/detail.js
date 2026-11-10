/* دُروب V8 — صفحة المكان: كل ما في البيانات داخل صفحة واحدة قابلة للتمرير.
   لا تبويبات ولا أزرار موزّعة: الأقسام الثانوية مطوية، والأساسي ظاهر دائمًا. */
(function (w) {
  'use strict';
  const D = w.D, P = w.DPhotos, M = w.DMap;
  const { esc, icon } = D;

  const ROUTE_TYPE = { out: 'ذهاب وعودة من نفس الطريق', loop: 'مسار دائري (حلقة)', line: 'باتجاه واحد — يلزم ترتيب العودة' };

  /* ---------- أدوات المسار المستورد ---------- */
  function parseTrack(text, name) {
    let raw = [];
    const isJson = /\.(geojson|json)$/i.test(name) || text.trim().startsWith('{');
    if (isJson) {
      const g = JSON.parse(text);
      const features = g.type === 'FeatureCollection' ? g.features : (g.type === 'Feature' ? [g] : [{ geometry: g }]);
      for (const f of features) {
        const geo = f && f.geometry; if (!geo) continue;
        const lines = geo.type === 'LineString' ? [geo.coordinates] : geo.type === 'MultiLineString' ? geo.coordinates : [];
        for (const line of lines) for (const pt of line) raw.push([+pt[1], +pt[0], pt.length > 2 ? +pt[2] : null]);
      }
    } else {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('ملف GPX غير صالح');
      let nodes = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'trkpt');
      if (!nodes.length) nodes = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'rtept');
      raw = nodes.map(n => {
        const ele = Array.from(n.children).find(c => c.localName === 'ele');
        return [+n.getAttribute('lat'), +n.getAttribute('lon'), ele && ele.textContent.trim() ? +ele.textContent : null];
      });
    }
    let pts = raw.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && p[0] !== 0);
    if (pts.length > 35000) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 35000) === 0);
    if (pts.length < 2) throw new Error('لا توجد نقاط مسار كافية في الملف');
    let km = 0, gain = 0;
    for (let i = 1; i < pts.length; i++) {
      km += D.haversine(pts[i - 1], pts[i]);
      if (Number.isFinite(pts[i][2]) && Number.isFinite(pts[i - 1][2])) gain += Math.max(0, pts[i][2] - pts[i - 1][2]);
    }
    if (km > 1000) throw new Error('طول الملف غير منطقي لمسار واحد');
    return { points: pts, km, gain, hasElevation: pts.filter(p => Number.isFinite(p[2])).length > 2, name };
  }

  function elevationBlock(track) {
    if (!track || !track.hasElevation) {
      return `<div class="callout muted">${icon('mountain')}<div><b>مخطط الارتفاع</b>
        يظهر عند استيراد ملف مسار يحتوي ارتفاعات حقيقية. لا نرسم مخططًا تقديريًا.</div></div>`;
    }
    let pts = track.points.filter(p => Number.isFinite(p[2]));
    if (pts.length > 220) pts = pts.filter((_, i) => i % Math.ceil(pts.length / 220) === 0);
    const vals = pts.map(p => p[2]);
    const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1, max - min);
    const coords = pts.map((p, i) => [13 + i / Math.max(1, pts.length - 1) * 614, 133 - ((p[2] - min) / span) * 108]);
    const poly = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return `<div class="elev">
      <div class="elev-head"><h4>ملف الارتفاع من ملفك</h4><small>${Math.round(min)}–${Math.round(max)} م</small></div>
      <svg viewBox="0 0 640 160" role="img" aria-label="مخطط ارتفاع مبني على بيانات الملف المستورد">
        <defs><linearGradient id="elevGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#c3ef60" stop-opacity=".45"/><stop offset="1" stop-color="#c3ef60" stop-opacity=".03"/>
        </linearGradient></defs>
        <path d="M13 25H627M13 79H627M13 133H627" stroke="#ffffff" stroke-opacity=".12" stroke-dasharray="4 5"/>
        <polygon points="13,140 ${poly} 627,140" fill="url(#elevGrad)"/>
        <polyline points="${poly}" stroke="#c3ef60" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <div class="stats"><span>طول الملف ${track.km.toFixed(2)} كم</span><span>صعود تراكمي ${Math.round(track.gain)} م</span><span>${track.points.length} نقطة</span></div>
    </div><p class="note">الارتفاع مأخوذ من ملفك ولم يُتحقق منه ميدانيًا.</p>`;
  }

  /* ---------- أقسام الصفحة ---------- */
  function statRow(p) {
    const siteOnly = !!p.siteOnly;
    return `<div class="stat-row">
      <div class="stat">${icon('route')}<small>${siteOnly ? 'نوع الزيارة' : 'المسافة'}</small><b>${esc(D.kmText(p))}</b></div>
      <div class="stat">${icon('clock')}<small>المدة</small><b>${esc(siteOnly ? 'حسب الزيارة' : (p.h || 'غير موثّقة'))}</b></div>
      <div class="stat">${icon('mountain')}<small>${siteOnly ? 'الحضارة' : 'الصعود'}</small><b>${esc(siteOnly ? (p.era || 'تاريخي') : (p.up || 'غير موثّق'))}</b></div>
      <div class="stat">${icon('steps')}<small>الصعوبة</small><b>${esc(p.levelLabel)}</b></div>
    </div>`;
  }

  function visitBlock(p) {
    if (!p.opening) {
      return `<div class="visit-card unknown">
        <div class="visit-head"><b>${icon('clock')} ${esc(p.kindLabel)}</b><span class="meta-pill v-unknown">${esc(D.VISIT.unknown)}</span></div>
        <p>لا تتوفر ساعات زيارة موثّقة لهذا المكان في مصادرنا. تحقّق من المصدر الرسمي قبل الانطلاق.</p>
      </div>`;
    }
    return `<div class="visit-card ${esc(p.visitStatus)}">
      <div class="visit-head"><b>${icon('clock')} ${esc(p.kindLabel)}</b><span class="meta-pill v-${esc(p.visitStatus)}">${esc(D.VISIT[p.visitStatus] || D.VISIT.unknown)}</span></div>
      <p>${esc(p.opening)}</p>
      <div class="visit-foot">
        <span>آخر مراجعة للمصادر: ${esc(p.verifiedOn || 'غير موثّق')}</span>
        ${p.phone ? `<a href="tel:${esc(p.phone)}">${icon('phone')} ${esc(p.phone)}</a>` : ''}
      </div>
      <p class="note" style="margin-top:9px">هذه ساعات منشورة وليست تأكيدًا بأن المكان مفتوح الآن. تحقّق من الحجوزات والأعياد والتغييرات قبل الزيارة.</p>
    </div>`;
  }

  function factsBlock(p) {
    const rows = [
      ['المنطقة', `${p.regionLabel} · ${p.zoneName}`],
      ['نوع المكان', p.kindLabel],
      ['الصعوبة', p.levelLabel],
      ['المسافة', D.kmText(p)],
      p.km2 ? ['طول بديل مذكور', D.fmtKm(p.km2)] : null,
      ['المدة المقدّرة', p.h || 'غير موثّقة'],
      ['الصعود التراكمي', p.up || 'غير موثّق'],
      p.rt && p.rt.type ? ['شكل المسار', ROUTE_TYPE[p.rt.type] || p.rt.type] : null,
      p.rt && p.rt.pts && p.rt.pts.length ? ['محطات مذكورة', p.rt.pts.join(' ← ')] : null,
      ['الرسوم', D.FEE[p.fee] || 'غير موثّقة'],
      ['اكتمال البيانات', p.completeness + '%'],
      p.era ? ['الحضارة / العصر', p.era] : null,
      p.visitKind ? ['طبيعة الزيارة', p.visitKind] : null,
      p.land ? ['طبيعة المكان', p.land] : null,
      ['الاسم بالإنجليزية', p.en || '—'],
      p.wz ? ['اسم البحث في تطبيقات الملاحة', p.wz] : null,
      ['الموقع على الخريطة', D.latLng(p)
        ? (p.place.label || 'نقطة معلم موثقة') + ` (${D.latLng(p)[0].toFixed(4)}, ${D.latLng(p)[1].toFixed(4)})`
        : 'لم تُوثّق إحداثيات لهذا المكان بعد']
    ].filter(Boolean);
    return `<table style="width:100%;border-collapse:collapse;font-size:13.5px">
      ${rows.map(([k, v]) => `<tr>
        <th style="text-align:start;vertical-align:top;padding:9px 0;width:40%;color:#6d8a7c;font-weight:600">${esc(k)}</th>
        <td style="padding:9px 0;border-bottom:1px solid #eef1ee">${esc(v)}</td></tr>`).join('')}
    </table>`;
  }

  function sourcesBlock(p) {
    const links = [];
    links.push({ href: D.sourceLink(p), label: 'مصدر معلومات هذا المكان', icon: 'link' });
    if (D.httpsOnly(p.officialUpdate)) links.push({ href: p.officialUpdate, label: 'آخر تحديث رسمي منشور', icon: 'warn' });
    if (D.httpsOnly(p.officialGpx)) links.push({ href: p.officialGpx, label: p.officialGpxLabel || 'ملف المسار الرسمي', icon: 'download' });
    links.push({ href: 'https://www.parks.org.il/', label: 'سلطة الطبيعة والحدائق — إغلاقات وتحذيرات', icon: 'warn' });
    links.push({ href: D.externalMap(p), label: 'فتح الموقع في خرائط خارجية', icon: 'map' });
    return `<div class="src-list">${links.map(l =>
      `<a href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${icon(l.icon)} <span>${esc(l.label)}</span>${icon('link')}</a>`
    ).join('')}</div>
    <p class="note" style="margin-top:10px">الصور من ويكيميديا كومنز وويكيبيديا مع ذكر المصدر والرخصة عند توفرها. المسافات والرسوم وساعات الزيارة منقولة عن المصادر المذكورة وقد تتغيّر.</p>`;
  }

  function checklistBlock(p) {
    const saved = D.store.checks[p.id] || {};
    return `<div class="checklist">${D.CHECKS.map((item, i) =>
      `<label><input type="checkbox" data-check="${i}" ${saved[i] ? 'checked' : ''}>${esc(item)}</label>`
    ).join('')}</div>
    <p class="note" style="margin-top:9px">القائمة تُحفظ على جهازك فقط، ولا تضمن فتح المسار أو سلامته.</p>`;
  }

  /* ---------- نبذة ويكيبيديا ---------- */
  function wikiSection() {
    return `<section class="sec" id="wikiSection" hidden>
      <h3>${icon('book')} نبذة عن المكان</h3>
      <div id="wikiExtract" class="prose"></div>
      <p class="note" id="wikiCredit" style="margin-top:8px"></p>
    </section>`;
  }

  /* ---------- اتجاه المكان من موقع الزائر ---------- */
  function bearingBlock(p) {
    const b = D.bearingTo(p);
    if (!b) return '';
    const km = D.distanceTo(p);
    return `<div class="callout info" style="margin-top:10px">${icon('locate')}<div>
      <b>من موقعك الآن</b>يبعُد ${esc(D.fmtKm(km))} ${esc(b.label)} بخطّ مستقيم — وليست مسافة الطريق.
    </div></div>`;
  }

  /* ---------- تقدير زمن المشي بسرعة الزائر ---------- */
  function paceBlock(p) {
    const est = D.estimateWalk(p);
    if (!est) return '';
    const pace = D.store.settings.pace;
    return `<div class="callout muted" style="margin-top:10px">${icon('steps')}<div>
      <b>تقديرك أنت: ${esc(est.label)}</b>
      محسوب بسرعة ${esc(pace)} كم/س${p.up ? ' مع إضافة ساعة لكل ٦٠٠ م صعود' : ''} (قاعدة نيسميث).
      تقدير حسابي لا يراعي الراحة ولا وعورة الأرض — عدّل سرعتك من الإعدادات.
    </div></div>`;
  }

  /* ---------- الشمس وحاسبة العودة الآمنة ---------- */
  function sunSection() {
    return `<details class="fold" id="sunFold">
      <summary>${icon('sun')} الشمس ووقت العودة الآمن</summary>
      <div class="fold-body"><div id="sunBox" class="note">افتح القسم لحساب ضوء النهار…</div></div>
    </details>`;
  }

  /* ---------- معرض الصور ---------- */
  function gallerySection() {
    return `<details class="fold" id="galleryFold">
      <summary>${icon('mountain')} صور المكان</summary>
      <div class="fold-body">
        <div id="galleryGrid" class="gallery">جارٍ البحث عن صور موثّقة…</div>
        <p class="note" style="margin-top:9px">الصور من ويكيميديا كومنز وويكيبيديا. اضغط أي صورة لفتح صفحة مصدرها ورخصتها. لا نعرض صورة لمكان آخر.</p>
      </div>
    </details>`;
  }

  /* ---------- ملاحظاتي وسجل زيارتي ---------- */
  function personalSection(p) {
    const note = D.store.notes[p.id] || '';
    const visited = D.store.visited[p.id];
    return `<details class="fold" ${note || visited ? 'open' : ''}>
      <summary>${icon('bookmark')} ملاحظاتي وزياراتي</summary>
      <div class="fold-body">
        <label class="field"><span>ملاحظة خاصة بك عن هذا المكان</span>
          <textarea id="placeNote" rows="3" maxlength="600"
            placeholder="مثلًا: الموقف الشمالي أسهل، وخذ ماءً إضافيًا">${esc(note)}</textarea></label>
        <div class="map-tools">
          <button type="button" data-act="visited">${icon(visited ? 'checkCircle' : 'check')} ${visited ? 'زرته في ' + esc(visited) : 'سجّل أنني زرته'}</button>
          ${visited ? `<button type="button" data-act="unvisited">${icon('trash')} احذف التسجيل</button>` : ''}
        </div>
        <p class="note" style="margin-top:9px">الملاحظات والسجل محفوظان على جهازك وحده، ولا يراهما أحد غيرك.</p>
      </div>
    </details>`;
  }

  /* ---------- أماكن قريبة ومشابهة ---------- */
  function relatedSection(p) {
    const near = D.nearbyTo(p);
    const similar = D.similarTo(p).filter(x => !near.some(n => n.p.id === x.id));
    if (!near.length && !similar.length) return '';
    const chip = (place, extra) => `<button type="button" class="related" data-open="${esc(place.id)}">
      <b>${esc(place.n)}</b><small>${esc(extra)}</small></button>`;
    return `<section class="sec">
      <h3>${icon('compass')} أماكن أخرى</h3>
      ${near.length ? `<p class="note" style="margin-bottom:7px">الأقرب إلى هذا المكان</p>
        <div class="related-row">${near.map(x => chip(x.p, D.fmtKm(x.km) + ' · ' + x.p.kindLabel)).join('')}</div>` : ''}
      ${similar.length ? `<p class="note" style="margin:11px 0 7px">تجارب مشابهة</p>
        <div class="related-row">${similar.map(x => chip(x, x.zoneName + ' · ' + x.levelLabel)).join('')}</div>` : ''}
      ${near.length ? '<p class="note" style="margin-top:9px">المسافات جوية بين النقاط، وليست مسافة طريق.</p>' : ''}
    </section>`;
  }

  /* ---------- فتح في تطبيقات الملاحة ---------- */
  function navSection(p) {
    const ll = D.latLng(p);
    const term = encodeURIComponent(p.wz || p.en || p.n);
    const apps = ll
      ? [
        ['خرائط جوجل', `https://www.google.com/maps/search/?api=1&query=${ll[0]},${ll[1]}`],
        ['ويز', `https://waze.com/ul?ll=${ll[0]},${ll[1]}&navigate=yes`],
        ['خرائط آبل', `https://maps.apple.com/?ll=${ll[0]},${ll[1]}&q=${term}`],
        ['OpenStreetMap', `https://www.openstreetmap.org/?mlat=${ll[0]}&mlon=${ll[1]}#map=15/${ll[0]}/${ll[1]}`]
      ]
      : [['خرائط جوجل', `https://www.google.com/maps/search/?api=1&query=${term}`],
         ['ويز', `https://waze.com/ul?q=${term}&navigate=yes`]];
    return `<div class="map-tools" style="margin-top:9px">
      ${apps.map(([label, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${icon('link')} ${esc(label)}</a>`).join('')}
      ${ll ? `<button type="button" data-act="copy-coords">${icon('pin')} نسخ الإحداثيات</button>` : ''}
    </div>
    ${ll ? `<p class="note" style="margin-top:7px">الإحداثيات: ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}${p.geoPrecision === 'wiki' ? ' — مرجعية من ويكيبيديا' : ''}</p>` : ''}`;
  }

  /* ---------- مؤشر اكتمال البيانات ---------- */
  function completenessBar(p) {
    const tone = p.completeness >= 75 ? 'ok' : p.completeness >= 45 ? 'warn' : 'low';
    return `<div class="completeness ${tone}" title="نسبة الحقول الموثّقة لهذا المكان">
      <div class="bar"><i style="width:${p.completeness}%"></i></div>
      <span>${p.completeness}% من بيانات هذا المكان موثّقة</span>
    </div>`;
  }

  /* ---------- البناء الكامل ---------- */
  function render(p) {
    const track = D.state.tracks[p.id] || null;
    const fav = !!D.store.favorites[p.id];
    const inTrip = D.store.trip.ids.includes(p.id);
    return `
    <div class="detail-hero">
      ${P.box(p)}
      <div class="detail-nav">
        <button type="button" data-act="close" aria-label="إغلاق">${icon('back')}</button>
        <span class="spacer"></span>
        <button type="button" data-act="fav" class="${fav ? 'on' : ''}" aria-label="حفظ في المفضلة">${icon('heart')}</button>
        <button type="button" data-act="share" aria-label="مشاركة">${icon('share')}</button>
      </div>
      <div class="detail-title">
        <span class="kicker">${icon('pin')} ${esc(p.regionLabel)} · ${esc(p.zoneName)}</span>
        <h2>${esc(p.n)}</h2>
        <div class="en">${esc(p.en || '')}</div>
      </div>
    </div>

    <div class="detail-body">
      ${statRow(p)}
      ${completenessBar(p)}

      <section class="sec">
        <p class="prose">${esc(p.d)}</p>
        <div class="callout ok" style="margin-top:12px">${icon('check')}<div><b>ما يميّز المكان</b>${esc(p.highlight)}</div></div>
        ${bearingBlock(p)}
        ${paceBlock(p)}
      </section>

      ${wikiSection()}

      <section class="sec">
        <h3>${icon('clock')} الزيارة والمواعيد</h3>
        ${visitBlock(p)}
      </section>

      <section class="sec">
        <div class="callout warn">${icon('warn')}<div><b>قبل الانطلاق</b>
          ${esc(p.note || 'تحقّق من فتح المسار والطقس والرسوم ونقطة الانطلاق في المصدر الرسمي.')}
          ${D.httpsOnly(p.officialUpdate) ? ` <a href="${esc(p.officialUpdate)}" target="_blank" rel="noopener noreferrer"><u>التحديث الرسمي</u></a>` : ''}
        </div></div>
      </section>

      <section class="sec">
        <h3>${icon('map')} الخريطة</h3>
        <div class="callout ${D.latLng(p) ? 'info' : 'muted'}" style="margin-bottom:10px">${icon('info')}<div>
          ${track ? '<b>معروض الآن: خط من ملفك المستورد</b>الخط من ملفك ولم يُراجع ميدانيًا؛ انتبه لعلامات المسارات الرسمية.'
            : D.latLng(p) ? '<b>نقطة معلم</b>هذه إشارة إلى موقع المعلم وليست نقطة انطلاق مؤكدة لمسار مشي.'
              : '<b>منطقة تقريبية</b>لا توجد إحداثيات موثقة لهذا المكان، والدائرة تعرض المنطقة العامة فقط.'}
        </div></div>
        <div class="detail-map" id="detailMap"></div>
        <div class="map-tools">
          <button type="button" data-act="layer">${icon('layers')} <span id="layerLabel">طبقة التضاريس</span></button>
          <button type="button" data-act="locate">${icon('locate')} موقعي الآن</button>
          <button type="button" data-act="fit">${icon('expand')} عرض المنطقة</button>
        </div>
        ${navSection(p)}
      </section>

      <details class="fold">
        <summary>${icon('route')} خط المسار وملف الارتفاع</summary>
        <div class="fold-body">
          <div class="file-drop">
            <label for="trackFile">${icon('filePlus')} استورد ملف GPX أو GeoJSON موثوق</label>
            <input id="trackFile" type="file" accept=".gpx,.geojson,.json,application/gpx+xml,application/json">
            <p class="note" style="margin-top:8px">الملف يُقرأ داخل جهازك فقط وحتى 8 ميغابايت، ولا يُرسل إلى أي خادم.</p>
          </div>
          ${p.officialGpx ? `<button type="button" class="btn btn-soft btn-block" data-act="official" style="margin-top:10px">${icon('download')} اجلب الملف الرسمي إلى الخريطة</button>` : ''}
          <p class="note" id="trackMsg" style="margin:10px 0">${track ? 'الملف المعروض: ' + esc(track.name) : 'لا يوجد خط مشي مؤكد محفوظ لهذا المكان في الدليل.'}</p>
          ${elevationBlock(track)}
        </div>
      </details>

      <details class="fold">
        <summary>${icon('locate')} تتبّع موقعي أثناء المشي</summary>
        <div class="fold-body">
          <p class="note">يعمل التتبّع أثناء بقاء الصفحة مفتوحة وبموافقتك على الوصول إلى الموقع. لا نقدّم إرشادات اتجاه بدون خط مسار موثوق، ولا تعتمد على الهاتف وحده في مناطق بلا تغطية.</p>
          <div class="trip-sum" id="gpsStats" style="margin:11px 0"></div>
          <div class="map-tools">
            <button type="button" data-act="gps-start">${icon('play')} ابدأ</button>
            <button type="button" data-act="gps-stop">${icon('stop')} إيقاف</button>
            <button type="button" data-act="gps-export">${icon('download')} حفظ GPX</button>
          </div>
          <p class="note" id="gpsNote" style="margin-top:9px"></p>
        </div>
      </details>

      <details class="fold">
        <summary>${icon('sun')} الطقس وتوقّعات الأسبوع</summary>
        <div class="fold-body"><div id="weatherBox" class="note">افتح القسم لجلب حالة الطقس…</div>
        <p class="note" style="margin-top:9px">توقّعات من Open-Meteo، وليست تحذير سيول أو إغلاق رسمي.</p></div>
      </details>

      ${sunSection()}
      ${gallerySection()}
      ${personalSection(p)}

      <details class="fold">
        <summary>${icon('checkCircle')} قائمة التجهيزات</summary>
        <div class="fold-body">${checklistBlock(p)}</div>
      </details>

      <details class="fold">
        <summary>${icon('info')} كل التفاصيل المسجّلة</summary>
        <div class="fold-body">${factsBlock(p)}</div>
      </details>

      <details class="fold">
        <summary>${icon('link')} المصادر والصور</summary>
        <div class="fold-body">${sourcesBlock(p)}<p class="note" id="photoCredit" style="margin-top:10px"></p></div>
      </details>

      ${relatedSection(p)}

      <div class="detail-foot">
        <button type="button" class="btn btn-primary" data-act="trip">${icon(inTrip ? 'check' : 'plus')} <span>${inTrip ? 'في رحلتي' : 'أضف إلى رحلتي'}</span></button>
        <button type="button" class="btn btn-soft square" data-act="share-whatsapp" aria-label="مشاركة عبر واتساب">${icon('share')}</button>
        <button type="button" class="btn btn-soft square" data-act="print" aria-label="طباعة الصفحة">${icon('print')}</button>
      </div>
    </div>`;
  }

  w.DDetail = { render, parseTrack, elevationBlock, completenessBar };
})(window);
