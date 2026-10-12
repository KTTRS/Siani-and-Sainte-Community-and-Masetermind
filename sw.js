const CACHE_NAME = 'sainte-v5';
const STATIC_CACHE = 'sainte-static-v5';
const DYNAMIC_CACHE = 'sainte-dynamic-v5';

const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/favicon.png'
];

const CACHE_LIMITS = {
  static: 100,
  dynamic: 50
};

async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxItems);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) =>
            name !== CACHE_NAME &&
            name !== STATIC_CACHE &&
            name !== DYNAMIC_CACHE
          )
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API: network-only, JSON error fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Network unavailable', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Vite hashed bundles + HTML navigations: ALWAYS network, never SW-cached.
  // Hash-busting + browser HTTP cache already do the right thing; caching
  // them here causes stale-deploy "Unable to preload CSS for /assets/..." failures.
  const isViteHashedAsset = url.pathname.startsWith('/assets/');
  const isNavigation =
    event.request.mode === 'navigate' ||
    (event.request.destination === '' && event.request.headers.get('accept')?.includes('text/html'));

  if (isViteHashedAsset || isNavigation) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (isNavigation) {
          return caches.match('/offline.html').then(
            (fallback) => fallback || new Response('Offline', { status: 503 })
          );
        }
        return new Response('Asset not available offline', { status: 503 });
      })
    );
    return;
  }

  // Fonts + other static-shaped assets (favicon, public images, etc.):
  // stale-while-revalidate.
  const isFont =
    url.pathname.includes('/fonts/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');
  const isStaticShaped = url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|otf)$/);

  if (isFont || isStaticShaped) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(event.request, clone);
                limitCacheSize(STATIC_CACHE, CACHE_LIMITS.static);
              });
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || networkFetch || new Response('Asset not available offline', { status: 503 });
      })
    );
    return;
  }

  // Default same-origin: network-only (no SW caching of HTML or dynamic routes).
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(
          (cached) => cached || new Response('Offline', { status: 503 })
        )
      )
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SAINTE', {
      body: data.body || 'New update from SAINTE',
      icon: '/favicon.png',
      badge: '/favicon.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
      actions: data.actions || []
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
