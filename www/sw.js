// ===============================
// PSM SAWIT - sw.js
// V36 cache: PsmNative saver final
// ===============================

const CACHE_NAME = 'psm-sawit-v33-final';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/state.js',
  './js/helper.js',
  './js/db.js',
  './js/sound.js',
  './js/security.js',
  './js/ui.js',
  './js/storage.js',
  './js/sync.js',
  './js/table.js',
  './js/form.js',
  './js/settings-format.js',
  './js/report.js',
  './js/thermal.js',
  './js/native.js',
  './js/backup.js',
  './js/app.js',
  './js/sw-register.js',
  './vendor/html2canvas.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        return response;
      }).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
