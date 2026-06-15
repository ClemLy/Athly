// Service Worker Athly — stratégie stale-while-revalidate
const CACHE_NAME = 'athly-shell-v1';
const SHELL_ASSETS = ['/', '/index.html'];

// Installation : mise en cache du shell applicatif
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : stale-while-revalidate pour les assets statiques
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // On ne cache pas : non-GET, cross-origin, ou appels API backend
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetched = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached || new Response('Hors ligne', { status: 503 }));
        // Retourne le cache immédiatement si disponible, recharge en arrière-plan
        return cached || fetched;
      })
    )
  );
});
