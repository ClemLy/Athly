// Service Worker Athly
// Stratégies :
//  - Navigations (HTML)  → network-first : contenu frais en ligne,
//    fallback sur le shell en cache hors-ligne (l'app charge toujours).
//  - Assets statiques    → stale-while-revalidate : chargement instantané
//    depuis le cache, rafraîchi en arrière-plan.
//  - /api/               → jamais caché ici (cache dégradé géré côté app).
const CACHE_NAME = 'athly-shell-v2';
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // On ne gère pas : non-GET, cross-origin, ou appels API backend
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // ── Navigations : network-first, fallback shell en cache ───────────────────
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/').then(
            (cached) => cached || new Response('Hors ligne', { status: 503 })
          )
        )
    );
    return;
  }

  // ── Assets statiques : stale-while-revalidate ───────────────────────────────
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
