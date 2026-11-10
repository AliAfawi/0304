/* دُروب V8 — تخزين هيكل الموقع للعمل السريع ودون اتصال.
   بلاطات الخرائط وصور ويكيميديا لا تُخزَّن: تراخيصها تمنع التحميل المسبق الجماعي. */
const CACHE = 'doroub-v9-2026-11-10';
const SHELL = [
  './', './index.html', './css/doroub.css',
  './data/trails.js', './data/heritage.js', './data/open-places.js', './data/places.js',
  './data/wiki-cache.js', './data/ar-cache.js',
  './js/core.js', './js/photos.js', './js/map.js', './js/contribute.js', './js/detail.js', './js/app.js',
  './manifest.webmanifest', './assets/icon.svg',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/fonts.css',
  './vendor/fonts/plex-arabic-400-arabic.woff2', './vendor/fonts/plex-arabic-500-arabic.woff2',
  './vendor/fonts/plex-arabic-600-arabic.woff2', './vendor/fonts/plex-arabic-700-arabic.woff2',
  './vendor/fonts/plex-arabic-400-latin.woff2', './vendor/fonts/plex-arabic-500-latin.woff2',
  './vendor/fonts/plex-arabic-600-latin.woff2', './vendor/fonts/plex-arabic-700-latin.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('doroub-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }))
  );
});
