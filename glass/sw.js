// goodtings. glasses: offline app shell + photo cache (Meta "Storage and offline support").
const VERSION = '20261028181541';
const SHELL = `gt-shell-${VERSION}`;
const PHOTOS = 'gt-photos-v1';
const SHELL_FILES = [
  './', './index.html', './app.js', './style.css',
  './assets/wordmark.svg', './assets/favicon.png',
  './assets/fonts/figtree-latin-500-normal.woff2', './assets/fonts/figtree-latin-600-normal.woff2',
  './assets/fonts/figtree-latin-700-normal.woff2', './assets/fonts/figtree-latin-800-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('gt-shell-') && k !== SHELL).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // the phone pairing page is never cached
  if (url.origin === location.origin && url.pathname.startsWith('/glass/pair')) return;

  if (url.origin === location.origin && url.pathname.startsWith('/glass/')) {
    const isStatic = /\/assets\//.test(url.pathname);
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
      // fonts/icons: cache first. app code: newest version, unless the network is slow or gone
      if (isStatic && hit) { fresh.catch(() => {}); return hit; }
      if (!hit) return fresh;
      const slow = new Promise(r => setTimeout(() => r(hit), 1500));
      return Promise.race([fresh.catch(() => hit), slow]);
    }));
    return;
  }

  // tings photos (Cloudinary): cache-first, keep the most recent 120
  if (url.hostname === 'res.cloudinary.com') {
    e.respondWith(caches.open(PHOTOS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trim(PHOTOS, 120); }
      return res;
    }));
  }
});
