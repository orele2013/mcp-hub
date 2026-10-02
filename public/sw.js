// Service worker mínimo: hace la app instalable. Todo se pide siempre al ordenador (nada de caché de datos).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
