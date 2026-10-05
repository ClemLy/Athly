// ─── Service worker Athly ─────────────────────────────────────────────────────
// Objectif : l'app se lance même hors ligne (salle de sport sans réseau) et
// démarre vite, sans jamais servir une version périmée en ligne.
//
// Stratégies :
//  - Navigations (HTML)          → réseau d'abord (4 s max), sinon coquille en cache.
//  - Fichiers versionnés (_expo/static, assets) → cache d'abord : leur nom
//    contient un hash, ils ne changent jamais.
//  - Autres fichiers du site     → cache puis mise à jour en arrière-plan.
//  - API et autres domaines      → jamais interceptés (le cache API est géré par l'app).
const VERSION = 'v3';
const SHELL_CACHE = `athly-shell-${VERSION}`;
const STATIC_CACHE = `athly-static-${VERSION}`;
const MAX_STATIC_ENTRIES = 80;
const NAVIGATION_TIMEOUT_MS = 4000;

const SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
];

const OFFLINE_HTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0D1018"><title>Hors ligne | Athly</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0D1018;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
text-align:center;padding:32px;box-sizing:border-box}h1{font-size:22px;margin:0 0 12px}
p{color:#9AA0AE;line-height:1.5;margin:0 0 24px;max-width:320px}
button{background:#FE7439;color:#fff;border:0;border-radius:14px;height:50px;padding:0 28px;
font-size:16px;font-weight:700}</style></head><body><main><h1>Pas de connexion</h1>
<p>Athly n'a pas encore pu se charger sur cet appareil. Vérifie ta connexion internet puis réessaie.</p>
<button onclick="location.reload()">Réessayer</button></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await Promise.race([fetch(request), timeout(NAVIGATION_TIMEOUT_MS)]);
    if (response && response.ok) {
      // Une seule coquille : toutes les routes de l'app renvoient le même index.html
      cache.put('/', response.clone());
    }
    return response;
  } catch (_) {
    const cached = await cache.match('/');
    return cached || new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

async function handleImmutable(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
    trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES);
  }
  return response;
}

async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(handleImmutable(request));
    return;
  }

  if (url.pathname === '/sw.js') return;

  event.respondWith(handleStaleWhileRevalidate(request));
});
