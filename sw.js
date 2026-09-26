/* =========================================================
   NEGRET'S MASTER — sw.js (v16)
   Navegação → rede primeiro, cache como reserva.
   Assets    → cache primeiro + revalidação em 2º plano.
   Pré-cache tolerante: arquivo faltando não quebra a instalação.
   ========================================================= */
'use strict';

const VERSION = 'negrets-master-v16';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/pdf.js',
  './js/report.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-180.png'
];

const ALLOWED_ORIGINS = new Set([
  self.location.origin,
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const results = await Promise.allSettled(APP_SHELL.map((p) => cache.add(p)));
    const failures = results
      .map((r, i) => (r.status === 'rejected' ? APP_SHELL[i] : null))
      .filter(Boolean);
    if (failures.length) console.warn('[SW v14] Pré-cache com falhas:', failures);
    else console.log('[SW v14] App Shell completo:', APP_SHELL.length, 'arquivos.');
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;

  const url = new URL(req.url);
  if (!ALLOWED_ORIGINS.has(url.origin)) return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
    return;
  }
  event.respondWith(handleAsset(req));
});

async function handleNavigation(req){
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(VERSION);
    cache.put('./index.html', fresh.clone());
    return fresh;
  } catch (_) {
    const cached = await caches.match('./index.html');
    if (cached) return cached;
    return new Response('<h1>NEGRET\'S MASTER</h1><p>Conecte-se à internet uma vez.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function handleAsset(req){
  const cached = await caches.match(req);
  if (cached) {
    fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        caches.open(VERSION).then((c) => c.put(req, res.clone()));
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
  } catch (_) {
    return new Response('', { status: 504 });
  }
}
