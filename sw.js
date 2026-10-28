// Hors-ligne : réseau d'abord (pour recevoir les mises à jour), cache en secours.
const CACHE = 'everlune-v4';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'lib/three.module.min.js',
  'src/main.js', 'src/noise.js', 'src/names.js', 'src/world.js', 'src/textures.js', 'src/materials.js',
  'src/builder.js', 'src/props.js', 'src/chunks.js', 'src/sky.js', 'src/water.js', 'src/particles.js',
  'src/player.js', 'src/input.js', 'src/ui.js', 'src/build.js', 'src/save.js', 'src/gamepad.js', 'src/audio.js', 'src/audio.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
