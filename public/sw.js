// Service Worker — v2 (cache bust)
// Bump this version number to force all clients to refresh

const CACHE_VERSION = 'v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Clear all old caches on activation
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always fetch fresh, never cache
self.addEventListener('fetch', (e) => {
  // Pass-through — no caching
});
