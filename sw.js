/* Mode hors ligne : les fichiers de l'appli sont servis depuis le réseau quand il est là
   (toujours la dernière version), sinon depuis le cache. Les photos Wikipedia déjà vues restent disponibles. */

const CACHE = 'carnet-v1';
const PHOTOS = 'carnet-photos-v1';
const PHOTO_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== PHOTOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: request.mode === 'navigate' })) || cache.match('./index.html');
  }
}

async function photoCacheFirst(request) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (PHOTO_HOSTS.includes(url.hostname)) event.respondWith(photoCacheFirst(request));
});
