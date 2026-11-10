/* دُروب V8 — طبقة الصور.
   ترتيب المصادر: ملف موثّق داخل الدليل ← ذاكرة محليّة ← ويكيبيديا ← كومنز.
   لا نعرض أبدًا صورة مكان آخر: إن لم نجد صورة موثوقة نُبقي البديل اللوني. */
(function (w) {
  'use strict';
  const D = w.D;
  const FILES = w.DOROUB_PHOTO_FILES || {};
  const BAKED = w.DOROUB_WIKI_CACHE || {};
  const CACHE_KEY = 'doroub8-photos';
  const TTL = 30 * 24 * 3600 * 1000;

  /* ---------- ذاكرة متصفح الزائر ---------- */
  let disk = {};
  try { disk = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { disk = {}; }
  let flushTimer = null;
  function remember(key, value) {
    disk[key] = { v: value, t: Date.now() };
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(disk)); } catch (e) { }
    }, 600);
  }
  function recall(key) {
    const hit = disk[key];
    if (!hit || Date.now() - hit.t > TTL) return undefined;
    return hit.v;
  }

  const filePath = name =>
    'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(name) + '?width=1000';
  const filePage = name =>
    'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(String(name).replace(/ /g, '_'));

  /* ---------- مصدر 1: ملف موثّق مذكور داخل بيانات الدليل ---------- */
  function fromCatalog(place) {
    const pick = FILES[place.id];
    if (pick) return { url: filePath(pick.file), page: filePage(pick.file), credit: pick.credit, exact: true };
    if (place.photoFile) {
      return {
        url: filePath(place.photoFile), page: filePage(place.photoFile),
        credit: place.photoCredit || 'Wikimedia Commons', exact: true
      };
    }
    return null;
  }

  /* ---------- مصدر 2: نتائج مُجهّزة مسبقًا مع الموقع ---------- */
  /* نشتق رابط نسخة مصغّرة بعرض 1000 بكسل من رابط الملف الأصلي حتى لا نحمّل صورة بحجم كامل. */
  const THUMBABLE = /\.(jpe?g|png)$/i;
  function thumbUrl(original, width = 1000) {
    const m = String(original).match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/);
    if (!m || !THUMBABLE.test(m[4])) return original;
    return `${m[1]}/thumb/${m[2]}/${m[3]}/${m[4]}/${width}px-${m[4]}`;
  }
  function fromBaked(place) {
    const row = place.wiki && BAKED[place.wiki];
    if (!row || !row.img) return null;
    return {
      url: thumbUrl(row.img),
      fallback: row.img,
      page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent((row.title || place.wiki).replace(/ /g, '_')),
      credit: row.credit || 'Wikipedia / Wikimedia Commons',
      exact: !!place.photoWiki
    };
  }

  /* ---------- مصدر 3: ملخّص ويكيبيديا (يعطي الصورة والإحداثيات معًا) ---------- */
  const inflight = new Map();
  function wikiSummary(title) {
    if (!title) return Promise.resolve(null);
    if (inflight.has(title)) return inflight.get(title);
    const cached = recall('wiki:' + title);
    if (cached !== undefined) return Promise.resolve(cached);
    const job = (async () => {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 9000);
        const res = await fetch(
          'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')),
          { signal: ctl.signal, headers: { Accept: 'application/json' } }
        );
        clearTimeout(timer);
        if (!res.ok) { remember('wiki:' + title, null); return null; }
        const d = await res.json();
        const out = {
          title: d.title || title,
          img: (d.originalimage && d.originalimage.source || '').split('?')[0] || null,
          thumb: (d.thumbnail && d.thumbnail.source || '').split('?')[0] || null,
          coord: d.coordinates ? { lat: d.coordinates.lat, lng: d.coordinates.lon } : null,
          desc: d.description || null,
          extract: d.extract || null
        };
        remember('wiki:' + title, out);
        return out;
      } catch (e) { return null; }
    })();
    inflight.set(title, job);
    return job;
  }

  /* ---------- مصدر 4: بحث كومنز برخصة حرّة فقط ---------- */
  const commonsJobs = new Map();
  function commonsSearch(place) {
    const name = place.photoSearch || place.en || '';
    if (!name || name.length < 5) return Promise.resolve(null);
    if (commonsJobs.has(name)) return commonsJobs.get(name);
    const cached = recall('commons:' + name);
    if (cached !== undefined) return Promise.resolve(cached);
    const job = (async () => {
      try {
        const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6'
          + '&gsrlimit=12&gsrsearch=' + encodeURIComponent('intitle:' + name)
          + '&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1000&format=json&origin=*';
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 8000);
        const res = await fetch(url, { signal: ctl.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data = await res.json();
        const words = String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
          .filter(x => x.length > 3 && !['national', 'park', 'mosque', 'israel', 'site', 'ancient', 'church', 'river'].includes(x));
        for (const page of Object.values((data.query && data.query.pages) || {})) {
          const info = page.imageinfo && page.imageinfo[0];
          if (!info || !info.thumburl || !/^image\//.test(info.mime || 'image/jpeg')) continue;
          const fname = (page.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
          if (!words.some(x => fname.includes(x))) continue;
          const license = (info.extmetadata && info.extmetadata.LicenseShortName && info.extmetadata.LicenseShortName.value) || '';
          if (!/cc\s*by|public\s*domain|cc0|pd-|copyright free/i.test(license)) continue;
          const artist = ((info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value) || '')
            .replace(/<[^>]*>/g, ' ').replace(/&[^;]{2,9};/g, ' ').replace(/\s+/g, ' ').slice(0, 90).trim();
          const found = {
            url: info.thumburl,
            page: info.descriptionurl || filePage(page.title),
            credit: (artist || 'Wikimedia Commons') + ' · ' + license,
            exact: true
          };
          remember('commons:' + name, found);
          return found;
        }
        remember('commons:' + name, null);
        return null;
      } catch (e) { return null; }
    })();
    commonsJobs.set(name, job);
    return job;
  }

  /* ---------- الواجهة: احصل على صورة مكان ---------- */
  const resolved = new Map();
  function resolve(place) {
    if (!place) return Promise.resolve(null);
    if (resolved.has(place.id)) return resolved.get(place.id);
    const job = (async () => {
      const direct = fromCatalog(place) || fromBaked(place);
      if (direct) return direct;
      const sum = await wikiSummary(place.wiki);
      if (sum) {
        applyCoordinates(place, sum);
        if (sum.thumb || sum.img) {
          return {
            url: sum.thumb || sum.img,
            page: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(sum.title).replace(/ /g, '_')),
            credit: 'Wikipedia / Wikimedia Commons',
            exact: !!place.photoWiki
          };
        }
      }
      return commonsSearch(place);
    })();
    resolved.set(place.id, job);
    return job;
  }

  /* ---------- إحداثيات مرجعية للأماكن التي لا تحمل موقعًا ---------- */
  const coordListeners = [];
  function onCoordinates(fn) { coordListeners.push(fn); }
  let coordDirty = false, coordTimer = null;
  function applyCoordinates(place, sum) {
    if (!sum || !sum.coord || place.place) return;
    if (!Number.isFinite(sum.coord.lat) || !Number.isFinite(sum.coord.lng)) return;
    place.place = {
      lat: sum.coord.lat, lng: sum.coord.lng,
      label: 'إحداثيات مرجعية من ويكيبيديا، وليست بداية مسار مشي'
    };
    place.geoPrecision = 'wiki';
    coordDirty = true;
    clearTimeout(coordTimer);
    coordTimer = setTimeout(() => {
      if (!coordDirty) return;
      coordDirty = false;
      coordListeners.forEach(fn => { try { fn(); } catch (e) { } });
    }, 900);
  }

  /* يجلب الإحداثيات الناقصة دفعة واحدة عند أول فتح للخريطة. */
  let warmed = false;
  async function warmCoordinates(limit = 60) {
    if (warmed) return;
    warmed = true;
    const missing = D.PLACES.filter(p => !D.latLng(p) && p.wiki).slice(0, limit);
    for (let i = 0; i < missing.length; i += 4) {
      await Promise.all(missing.slice(i, i + 4).map(async p => {
        const sum = await wikiSummary(p.wiki);
        applyCoordinates(p, sum);
      }));
    }
  }

  /* ---------- عرض الصور بالكسل ---------- */
  function fill(host) {
    if (!host || host.dataset.filled) return;
    host.dataset.filled = '1';
    const place = D.byId(host.dataset.ph);
    if (!place) return;
    host.classList.add('loading');
    resolve(place).then(found => {
      host.classList.remove('loading');
      if (!found || !host.isConnected) return;
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.alt = (found.exact ? 'صورة موثقة لـ' : 'صورة للموقع أو محيطه: ') + place.n;
      img.onload = () => {
        if (!host.isConnected) return;
        const ghost = host.querySelector('.ph-fallback');
        if (ghost) ghost.remove();
        host.prepend(img);
        requestAnimationFrame(() => img.classList.add('in'));
        host.dataset.credit = found.credit || '';
        host.dataset.page = found.page || '';
        host.dispatchEvent(new CustomEvent('photo', { bubbles: true, detail: found }));
      };
      img.onerror = () => {
        if (found.fallback && img.src !== found.fallback) { img.src = found.fallback; return; }
        host.classList.remove('loading');
        host.dataset.filled = '';
      };
      img.src = found.url;
    }).catch(() => host.classList.remove('loading'));
  }

  const observer = 'IntersectionObserver' in w
    ? new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { observer.unobserve(e.target); fill(e.target); } });
    }, { rootMargin: '450px 0px' })
    : null;

  function watch(root = document) {
    D.$$('[data-ph]:not([data-filled])', root).forEach(el => observer ? observer.observe(el) : fill(el));
  }

  /* قالب صندوق الصورة مع بديل لوني يعكس طبيعة المكان. */
  function box(place, extraClass = '') {
    const tone = place.r === 'S' ? 'sand' : ['ruins', 'mosque', 'maqam', 'religious'].includes(place.heritageType) ? 'stone' : 'green';
    return `<div class="ph ${extraClass}" data-ph="${D.esc(place.id)}" data-tone="${tone}">
      <div class="ph-fallback">${D.icon(place.heritageType === 'trail' || place.heritageType === 'nature' ? 'mountain' : 'book')}
      <small>الصورة الموثّقة قيد الإضافة</small></div></div>`;
  }

  w.DPhotos = { resolve, watch, fill, box, wikiSummary, warmCoordinates, onCoordinates };
})(window);
