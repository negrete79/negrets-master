/* =========================================================
   sw.js — Service Worker
   Estratégia: Cache-First com revalidação em segundo plano.
   O app shell inteiro é pré-cacheado na instalação → abre offline.
   ========================================================= */
const VERSION = 'negrets-master-v3';

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/pdf.js',
  './js/report.js',
  './js/app.js'
];

/* Ícones são opcionais: se ainda não foram gerados, não travam a instalação do SW */
const OPTIONAL = ['./icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    await Promise.allSettled(OPTIONAL.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const allowed = url.origin === location.origin ||
                  url.origin === 'https://fonts.googleapis.com' ||
                  url.origin === 'https://fonts.gstatic.com';
  if (!allowed) return;

  /* Navegação (SPA hash router) → sempre serve o index cacheado */
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((c) => c || fetch(req)).catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Demais recursos: cache-first + atualização silenciosa */
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          caches.open(VERSION).then((c) => c.put(req, res));
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const clone = res.clone();
        caches.open(VERSION).then((c) => c.put(req, clone));
      }
      return res;
    } catch (e) {
      return new Response('Offline', { status: 503 });
    }
  })());
});
