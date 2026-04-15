/* ============================================================
   SignSense Service Worker v2.0
   Cache-first strategy for static assets
   Network-first for MediaPipe CDN resources
   ============================================================ */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  );
  self.clients.claim();
});

// Self-destruct
self.addEventListener('fetch', event => {
  if (event.request.url.includes('self-destruct')) {
    self.registration.unregister();
  }
});
