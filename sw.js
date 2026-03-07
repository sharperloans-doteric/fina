const CACHE_NAME = 'mpesa-messages-v1';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',  // assuming your main file is index.html
  '/offline.html',
  '/logo.png',     // add your logo if used
  // Add manifest.json, other static files if needed
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for fresh content
          const preload = await event.preloadResponse;
          if (preload) return preload;

          return await fetch(event.request);
        } catch (err) {
          // Network failed (offline / timeout) → serve offline page
          const cache = await caches.open(CACHE_NAME);
          const offlineResponse = await cache.match(OFFLINE_URL);
          return offlineResponse || new Response('Offline fallback failed', { status: 503 });
        }
      })()
    );
    return;
  }

  // For other requests (API, images, etc.) – network first, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
