/**
 * sw.js - Smart School Pro Service Worker
 * 
 * Strategy:
 *  - Static assets (JS/CSS/images): Cache-First
 *  - API calls (GET): Network-First, fallback to cache
 *  - API calls (POST/PUT/DELETE): Network-only (mutations handled by app layer)
 */

const CACHE_VERSION = 'dugsi-pro-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Static assets to pre-cache
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/favicon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate (clean old caches) ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('dugsi-pro-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET or cross-origin requests for caching (mutations handled by app)
  if (request.method !== 'GET') return;

  // Skip chrome-extension or non-http requests
  if (!url.protocol.startsWith('http')) return;

  // ── API requests: Network-First ──
  if (url.pathname.startsWith('/api/') || url.hostname !== location.hostname) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // ── Next.js pages & static: Stale-While-Revalidate ──
  event.respondWith(staleWhileRevalidate(request));
});

/** Network-First for API: try network, cache on success, fallback to cache */
async function networkFirstAPI(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Stale-While-Revalidate for pages/assets */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request.clone())
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await networkFetch) || offlineFallback();
}

function offlineFallback() {
  return caches.match('/offline.html').then(
    (r) =>
      r ||
      new Response('<h1>Offline</h1>', {
        headers: { 'Content-Type': 'text/html' },
      })
  );
}
