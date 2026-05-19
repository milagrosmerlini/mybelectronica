const CACHE_NAME = 'myb-electronica-cache-v5';
const APP_SHELL = [
    '/',
    '/index.html',
    '/styles.css?v=20260518-pwa2',
    '/app.js?v=20260518-pwa3',
    '/datastore.js?v=20260516-blob1',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png',
    '/logoMYB.jpg'
];

const APP_SHELL_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.location.origin).href));

async function cleanupOldCaches() {
    const keys = await caches.keys();
    await Promise.all(
        keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
    );
}

async function cleanupUnexpectedEntries() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    await Promise.all(
        keys
            .filter((request) => !APP_SHELL_URLS.has(request.url))
            .map((request) => cache.delete(request))
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await cleanupOldCaches();
        await cleanupUnexpectedEntries();
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin) return;

    const isNavigation = event.request.mode === 'navigate';
    const isAppShellAsset = APP_SHELL_URLS.has(url.href);
    if (!isNavigation && !isAppShellAsset) return;

    event.respondWith((async () => {
        try {
            const networkResponse = await fetch(event.request);
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
        } catch (_err) {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(event.request);
            if (cached) return cached;
            if (isNavigation) {
                const fallback = await cache.match('/index.html');
                if (fallback) return fallback;
            }
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
    })());
});
