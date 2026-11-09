const scope = self.registration.scope;
const prefix = 'disco-juice:' + scope + ':';
const cacheName = prefix + 'v1';
const files = ['./', './index.html', './hub.css', './hub.js', './catalogue.js', './legacy.js',
  './discovery.js', './verified.js', './icon.svg', './manifest.webmanifest'];
const urls = new Set(files.map(file => new URL(file, scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  url.search = '';
  if (event.request.method !== 'GET' || !urls.has(url.href)) return;
  event.respondWith(caches.open(cacheName).then(async cache => {
    return await cache.match(url.href) || fetch(event.request);
  }));
});
