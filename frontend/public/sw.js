const CACHE = 'nexus-v2';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/']))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/') || e.request.url.includes('socket.io')) return;
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).catch(() => caches.match('/'))));
});
