const CACHE_NAME = 'atlas-local-v1';
const APP_FILES = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
});

self.addEventListener('fetch', (event) => {
    if (new URL(event.request.url).origin === self.location.origin) {
        event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    }
});
