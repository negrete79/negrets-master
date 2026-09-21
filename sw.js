/* =========================================================
   NEGRET'S MASTER — sw.js (v10 — reescrita completa)
   -----------------------------------------------------------
   Missão dupla:
   1) INSTALABILIDADE — o gerador de WebAPK do Android valida
      o manifest; os ícones PNG da raiz são pré-cacheados aqui
      também, então o app instalado abre offline de primeira.
   2) OFFLINE — App Shell inteiro em cache na instalação.

   Estratégias:
   • Navegação  → REDE primeiro (app se atualiza sozinho),
                  cache como reserva (modo avião).
   • Assets     → CACHE primeiro + revalidação em 2º plano
                  (resposta instantânea, versão fresca depois).
   • Fontes     → cacheadas após a 1ª visita.

   Segurança:
   • Pré-cache com add() individual + Promise.allSettled:
     um arquivo faltando NÃO derruba a instalação do SW —
     o faltante é nomeado no console.
   • Só entra no cache resposta válida (200 ou opaca).
   • GET apenas; Range requests ignorados.
   ========================================================= */

'use strict';

/* Suba este número SEMPRE que publicar alteração em qualquer
   arquivo do app. A ativação apaga caches de versões antigas. */
const VERSION = 'negrets-master-v10';

/* ---------- App Shell — reflete EXATAMENTE o repositório.
   Ícones na RAIZ (sem pasta icons/). ------------------------ */
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
      console.warn('[SW v10] Pré-cache com falhas — arquivos faltando no repositório:', failures);
    } else {
      console.log('[SW v10] App Shell completo em cache:', APP_SHELL.length, 'arquivos.');
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
    console.log('[SW v10] Ativo — caches antigos removidos.');
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

  if (req.method !== 'GET') return;           /* POST/PUT vão à rede   */
  if (req.headers.has('range')) return;       /* mídia parcial: ignora */

  const url = new URL(req.url);
  if (!ALLOWED_ORIGINS.has(url.origin)) return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
    return;
  }
  event.respondWith(handleAsset(req));
});

/* ---------- Navegação: rede primeiro, cache como reserva ---------- */
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

/* ---------- Assets: cache primeiro + revalidação silenciosa ---------- */
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
  }).catch(() => { /* offline: cache continua válido */ });
}

function isCacheable(res){
  if (!res) return false;
  if (res.ok) return true;
  return res.type === 'opaque'; /* fontes cross-origin sem CORS exposto */
}

/* ---------- Contingência (só se até o index sumir do cache) ---------- */
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
