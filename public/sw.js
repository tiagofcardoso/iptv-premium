// Service Worker super leve apenas para ativar a permissão de instalação no Chrome (PWA)

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Apenas deixa os pedidos normais passarem, já que tudo corre localmente
self.addEventListener('fetch', (e) => {
  // Pass-through
});
