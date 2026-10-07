/* FinFlow service worker — makes the app work offline and keeps it up to date.
   - App files: network-first (you always get the newest version when online), cached copy when offline.
   - Slip-reader libraries / language data from CDNs: cached on first use so scanning also works offline afterwards. */
importScripts('js/version.js');
const V = 'finflow-' + self.FF_VERSION;
const SHELL = ['./', 'index.html', 'css/app.css', 'css/extra.css', 'manifest.webmanifest', 'icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/version.js', 'js/util.js', 'js/i18n.js', 'js/store.js', 'js/calc.js', 'js/imgproc.js', 'js/slip.js', 'js/learn.js', 'js/ocr.js',
  'js/ui.js', 'js/pages-tx.js', 'js/pages-scan.js', 'js/pages-analytics.js', 'js/pages-settings.js', 'js/app.js'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('finflow-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }
  if (CDN.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(V + '-cdn').then(c => c.put(req, copy)); } return res; })));
  }
});
