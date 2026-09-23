// WAVE Emergency Response - Service Worker for Offline Resilience
const CACHE_NAME = 'wave-offline-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/safety',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-caching assets in sw failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((response) => {
          // Cache successful responses for offline recovery
          if (
            response &&
            response.status === 200 &&
            (event.request.url.startsWith(self.location.origin) ||
             event.request.url.includes('googleapis.com') ||
             event.request.url.includes('gstatic.com'))
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached root/safety page if available
          return caches.match('/safety').then((fallback) => {
            return fallback || caches.match('/');
          });
        });
    })
  );
});
