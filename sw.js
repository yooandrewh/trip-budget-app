// Service worker: receives pushes and shows them. No caching — always network,
// so app updates land immediately.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Trip Budget', {
    body: d.body || 'New transaction',
    tag: 'trip-budget',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((tabs) =>
    tabs.length ? tabs[0].focus() : self.clients.openWindow('/')));
});
