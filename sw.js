/* =========================================================
   NEGRET'S MASTER — sw.js (v8— reescrita completa)
   -----------------------------------------------------------
   Papel: tornar o app 100% offline e INSTALÁVEL.

   Estratégias por tipo de requisição:
   • Navegação (abrir o app)   → REDE primeiro, cache como
     reserva. Assim, com internet, o app atualiza sozinho;
     sem internet, abre do cache.
   • Arquivos do app (css/js/
     manifest)                 → CACHE primeiro + revalidação
     em segundo plano (stale-while-revalidate).
   • Fontes do Google          → CACHE depois da 1ª visita
     (o app funciona offline depois de aberto uma vez).

   Regras de segurança do cache:
   • Só cachear respostas válidas (ok / opacas de origem
     permitida). Nunca cachear erros 4xx/5xx.
   • Ignorar requisições que não sejam GET e downloads com
     "Range" (mídia), que não podem ser servidas do cache.

   A instalação do PWA depende de: sw.js na RAIZ + manifest +
   HTTPS (GitHub Pages já entrega). Este arquivo usa
   Promise.allSettled no pré-cache de propósito: se um único
   arquivo opcional faltar, a instalação NÃO quebra — o
   faltante é logado no console e o app segue funcionando.
   ========================================================= */

'use strict';

/* ---------- Identidade do cache ----------
   Suba este número SEMPRE que alterar qualquer arquivo do app.
   Ao ativar, todos os caches de versões antigas são apagados. */
const VERSION = 'negrets-master-v8';

/* ---------- App Shell ----------
   O mínimo para o app abrir e operar offline.
   IMPORTANTE: reflete exatamente os arquivos existentes no
   repositório (na raiz e nas pastas css/ e js/). */
const APP_SHELL = [
  './',                 /* atalho para index.html            */
  './index.html',       /* SPA completa (todas as telas)     */
  './manifest.json',    /* identidade do PWA (ícone embutido)*/
  './css/styles.css',   /* design system                     */
  './js/db.js',         /* persistência IndexedDB            */
  './js/pdf.js',        /* motor de PDF                      */
  './js/report.js',     /* layout do relatório               */
  './js/app.js'         /* telas, cálculos, router           */
];

/* ---------- Origens permitidas de cache ----------
   A própria origem + CDNs de fonte usados no index.html.
   Qualquer outra origem é ignorada pelo Service Worker. */
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

    /* Um add() por arquivo com allSettled: a ausência de UM
       item (ex.: renomear uma pasta) não derruba a instalação
       inteira — que é justamente o que trava a instalação do
       PWA quando algum path está errado. */
    const results = await Promise.allSettled(
      APP_SHELL.map((path) => cache.add(path))
    );

    const failures = results
      .map((r, i) => r.status === 'rejected' ? APP_SHELL[i] : null)
      .filter(Boolean);

    if (failures.length){
      console.warn('[SW] Pré-cache com falhas (arquivo faltando?):', failures);
    } else {
      console.log('[SW] App Shell pré-cacheado com sucesso:', APP_SHELL.length, 'arquivos.');
    }

    /* Não espera o usuário fechar as abas: assume o controle
       assim que possível (fluxo padrão de apps de campo). */
    await self.skipWaiting();
  })());
});

/* =========================================================
   2. ACTIVATE — limpeza de versões antigas + claim
   ========================================================= */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    /* Apaga QUALQUER cache que não seja da versão atual */
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))
    );
    console.log('[SW] Ativo na versão', VERSION, '— caches antigos removidos.');

    /* Toma o controle das abas abertas sem recarregar */
    await self.clients.claim();
  })());
});

/* =========================================================
   3. MESSAGE — canal com a página (skipWaiting sob demanda)
   ========================================================= */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* =========================================================
   4. FETCH — roteamento das estratégias
   ========================================================= */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Só interceptamos GET — POST/PUT (sincronização futura)
     vão direto à rede. */
  if (req.method !== 'GET') return;

  /* Range requests (mídia parcial) não podem vir do cache */
  if (req.headers.has('range')) return;

  const url = new URL(req.url);

  /* Origem estranha (outros CDNs, analytics) → SW não interfere */
  if (!ALLOWED_ORIGINS.has(url.origin)) return;

  /* 4.1 — NAVEGAÇÃO: o usuário está abrindo/links do app.
     Rede primeiro (pega atualizações), cache como reserva. */
  if (req.mode === 'navigate'){
    event.respondWith(handleNavigation(req));
    return;
  }

  /* 4.2 — ASSETS: css/js/manifest/fontes.
     Cache primeiro (instantâneo), revalida em segundo plano. */
  event.respondWith(handleAsset(req));
});

/* ---------- Handler de navegação ---------- */
async function handleNavigation(req){
  try {
    /* Online: busca a versão fresca e renova o cache */
    const fresh = await fetch(req);
    const cache = await caches.open(VERSION);
    cache.put('./index.html', fresh.clone());
    return fresh;
  } catch (_){
    /* Offline: serve a SPA do cache (qualquer rota cai nela) */
    const cached = await caches.match('./index.html');
    if (cached) return cached;
    return offlineFallback(); /* nem cache tem: nunca deveria ocorrer */
  }
}

/* ---------- Handler de assets ---------- */
async function handleAsset(req){
  /* 1) Cache em mãos? Responde imediatamente (offline incluído). */
  const cached = await caches.match(req);
  if (cached) {
    revalidate(req); /* renova em background, sem bloquear a resposta */
    return cached;
  }

  /* 2) Não estava em cache: vai à rede e guarda (1ª visita). */
  try {
    const res = await fetch(req);
    if (isCacheable(res)){
      const cache = await caches.open(VERSION);
      cache.put(req, res.clone());
    }
    return res;
  } catch (_){
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

/* Revalidação em segundo plano: atualiza o cache sem esperar */
function revalidate(req){
  fetch(req).then((res) => {
    if (isCacheable(res)){
      caches.open(VERSION).then((c) => c.put(req, res.clone()));
    }
  }).catch(() => { /* offline: silencioso, o cache segue válido */ });
}

/* Só guardamos respostas úteis no cache */
function isCacheable(res){
  if (!res) return false;
  if (res.ok) return true;                       /* 200           */
  return res.type === 'opaque';                  /* CORS de fontes */
}

/* Página mínima de contingência (apenas se até o index sumir) */
function offlineFallback(){
  return new Response(
    '<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>NEGRET\'S MASTER</title>' +
    '<body style="font-family:sans-serif;background:#0B2A4A;color:#fff;' +
    'display:grid;place-items:center;height:100vh;text-align:center">' +
    '<div><h1>NEGRET&#8217;S MASTER</h1><p>App não carregado ainda.<br>' +
    'Conecte-se uma vez à internet e recarregue.</p></div></body>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
