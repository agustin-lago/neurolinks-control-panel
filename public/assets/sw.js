// Service Worker - Neurolinks Admin PWA
// Solo para habilitar la instalación. Sin cache de datos sensibles.

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // No interceptar nada — solo registrar el SW para habilitar instalación PWA
});
