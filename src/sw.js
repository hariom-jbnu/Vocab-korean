/* Service worker template. The build fills in the version and the list of
 * files to save (see the offline plugin in vite.config.ts) and writes sw.js. */

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP_CACHE = `vocab-${VERSION}`;
// Kept outside the vocab- prefix so a new release does not throw it away.
const FONT_CACHE = 'fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vocab-') && k !== APP_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request, APP_CACHE));
    return;
  }
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  }
  // Everything else (ads, analytics) goes straight to the network.
});

/** Pages: try the network so updates show up, fall back to the saved app shell. */
async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('./index.html', response.clone());
    return response;
  } catch {
    return (await cache.match('./index.html', { ignoreVary: true })) || Response.error();
  }
}

/** Hashed build files and fonts never change, so the saved copy is always good. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // ignoreVary: some hosts send "Vary: Origin", which would hide the saved copy
  // from requests made with the crossorigin attribute.
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
