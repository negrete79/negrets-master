/* =========================================================
   NEGRET'S MASTER — sw.js (v12 — reescrita completa)
   -----------------------------------------------------------
   Consistência total com o repositório REAL: o único ícone
   PNG existente na raiz é icon-maskable-512.png (confirmado
   pelo diagnóstico do app). Ele é o pré-cacheado e o único
   referenciado em todo o sistema — 404 de ícone impossível.

   Estratégias:
   • Navegação → rede primeiro, cache como reserva (offline).
   • Assets    → cache primeiro + revalidação em 2º plano.
   • Pré-cache com add() individual: arquivo faltando não
     derruba a instalação do SW; o faltante é nomeado no log.
   ========================================================= */

'use strict';

/* Suba este número a cada publicação de alteração. */
const VERSION = 'negrets-master-v12';

/* ---------- App Shell — espelha EXATAMENTE o repositório ---------- */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/pdf.js',
  './js/report.js',
  './js/app.js',
  './icon-maskable-512.png'
];

const ALLOWED_ORIGINS = new Set([
  self.location.origin,
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

/* =========================================================
   1. INSTALL — pré-cache do App Shell
   ========================================================= */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);

    const results = await Promise.allSettled(
      APP_SHELL.map((path) => cache.add(path))
    );

    const failures = results
      .map((r, i) => (r.status === 'rejected' ? APP_SHELL[i] : null))
      .filter(Boolean);

    if (failures.length) {
      console.warn('[SW v11] Pré-cache com falhas — arquivos faltando:', failures);
    } else {
      console.log('[SW v11] App Shell completo em cache:', APP_SHELL.length, 'arquivos.');
    }

    await self.skipWaiting();
  })());
});

/* =========================================================
   2. ACTIVATE — limpeza de versões antigas + controle imediato
   ========================================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    console.log('[SW v11] Ativo — caches antigos removidos.');
    await self.clients.claim();
  })());
});

/* =========================================================
   3. MESSAGE — canal com a página
   ========================================================= */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* =========================================================
   4. FETCH — roteamento
   ========================================================= */
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
    return offlineFallback();
  }
}

async function handleAsset(req){
  const cached = await caches.match(req);
  if (cached) {
    revalidate(req);
    return cached;
  }
  try {
    const res = await fetch(req);
    if (isCacheable(res)) {
      const cache = await caches.open(VERSION);
      cache.put(req, res.clone());
    }
    return res;
  } catch (_) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function revalidate(req){
  fetch(req).then((res) => {
    if (isCacheable(res)) {
      caches.open(VERSION).then((c) => c.put(req, res.clone()));
    }
  }).catch(() => { /* offline: cache segue válido */ });
}

function isCacheable(res){
  if (!res) return false;
  if (res.ok) return true;
  return res.type === 'opaque';
}

function offlineFallback(){
  return new Response(
    '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>NEGRET&#8217;S MASTER</title>' +
    '<body style="font-family:sans-serif;background:#0B2A4A;color:#fff;' +
    'display:grid;place-items:center;height:100vh;text-align:center">' +
    '<div><h1>NEGRET&#8217;S MASTER</h1><p>Conecte-se à internet uma vez e recarregue.</p></div></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
