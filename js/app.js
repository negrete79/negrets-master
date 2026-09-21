/* =========================================================
   app.js — SPA (hash router), telas, cálculos e sincronia.
   ========================================================= */
'use strict';

/* ================= CONFIG ================= */
const CONFIG = {
  /* PONTO DE INTEGRAÇÃO FUTURA: cole aqui a URL de um backend/
     Google Apps Script para enviar os relatórios à nuvem.
     Vazio = modo 100% local (nada sai do aparelho). */
  SYNC_ENDPOINT: ''
};

/* ================= UTILITÁRIOS ================= */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const uid  = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const esc  = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const hojeISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const dataBR  = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };

/* ================= ÍCONES (SVG inline, estilo traço) ================= */
const ICONS = {
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  clipboard:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  back:'<polyline points="15 18 9 12 15 6"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  droplet:'<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
  alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  wifi:'<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  wifioff:'<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  sync:'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
};
const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const logoSVG = (s = 44) => `
<svg width="${s}" height="${s}" viewBox="0 0 512 512" aria-hidden="true">
  <rect width="512" height="512" rx="116" fill="#FFFFFF" opacity=".14"/>
  <path d="M256 84c-52 66-92 120-92 176a92 92 0 0 0 184 0c0-56-40-110-92-176z" fill="#fff"/>
  <ellipse cx="222" cy="240" rx="18" ry="46" fill="#BFE3F7" transform="rotate(18 222 240)"/>
  <path d="M70 396c26-20 52-20 78 0s52 20 78 0 52-20 78 0 52 20 78 0" fill="none" stroke="#6FC6F2" stroke-width="24" stroke-linecap="round"/>
</svg>`;

const checkSVG = `<svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="40" cy="40" r="34" stroke="#1B87D6" stroke-width="5"/>
  <path d="M26 41.5l10 10 18-21" stroke="#0B2A4A" stroke-width="6"/>
</svg>`;

/* ================= TOAST / MODAL ================= */
function toast(msg, kind = 'ok', ms = 2800){
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = icon(kind === 'ok' ? 'check' : kind === 'warn' ? 'alert' : 'wifi') + '<span>' + esc(msg) + '</span>';
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 320); }, ms);
}
function confirmDlg({ title, text, okLabel = 'Confirmar', danger = false }){
  return new Promise((res) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-back';
    wrap.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-a="0">Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-a="1">${esc(okLabel)}</button>
      </div></div>`;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b){ wrap.remove(); res(b.dataset.a === '1'); }
      else if (e.target === wrap){ wrap.remove(); res(false); }
    });
    document.body.appendChild(wrap);
  });
}

/* ================= AJUSTES / ESTADO ================= */
const DEFAULT_SETTINGS = { companyName: "NEGRET'S MASTER", tagline: 'Piscinas & Limpeza de Sítio', phone: '', email: '', technician: '' };
async function getSettings(){
  const rec = await DB.get('settings', 'company');
  return { ...DEFAULT_SETTINGS, ...((rec && rec.value) || {}) };
}
const saveSettings = (v) => DB.put('settings', { key: 'company', value: v });

let deferredPrompt = null;

/* ================= SINCRONIZAÇÃO (indicador online/offline) ================= */
const Sync = {
  async pending(){ return (await DB.all('reports')).filter((r) => !r.synced).length; },
  async syncNow(){
    if (!navigator.onLine) return toast('Sem internet agora — seus dados continuam salvos no aparelho.', 'warn');
    const pend = (await DB.all('reports')).filter((r) => !r.synced);
    if (!pend.length) return toast('Tudo sincronizado.');
    if (!CONFIG.SYNC_ENDPOINT){
      return toast(pend.length + ' relatório(s) salvos localmente. Configure SYNC_ENDPOINT para enviar à nuvem.', 'info', 3800);
    }
    let ok = 0;
    for (const r of pend){
      try {
        const { pdfBlob, ...json } = r; /* Blob não vai no JSON */
        const res = await fetch(CONFIG.SYNC_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
        if (res.ok){ r.synced = true; await DB.put('reports', r); ok++; }
      } catch (_) {}
    }
    toast(ok === pend.length ? ok + ' relatório(s) enviados.' : ok + '/' + pend.length + ' enviados — tente novamente.', ok ? 'ok' : 'warn');
    updateNetUI();
  }
};
const netPillHTML = () => '<i class="dot"></i>' + (navigator.onLine ? 'Online' : 'Offline');
function updateNetUI(){
  const p = $('#netPill');
  if (p){ p.classList.toggle('off', !navigator.onLine); p.innerHTML = netPillHTML(); }
}
window.addEventListener('online',  () => { updateNetUI(); toast('Conexão restabelecida.'); });
window.addEventListener('offline', () => { updateNetUI(); toast('Você está offline — o app continua funcionando.', 'warn'); });

/* ================= HELPERS DE UI ================= */
const topbar = (title, back = '#/', right = '') => `
  <header class="topbar">
    <button class="iconbtn" onclick="location.hash='${back}'" aria-label="Voltar">${icon('back')}</button>
    <h1>${esc(title)}</h1>
    ${right || '<span class="tb-sp"></span>'}
  </header>`;

const emptyState = (ic, title, text, href, btn) => `
  <div class="card empty">
    ${icon(ic)}<strong>${esc(title)}</strong><p>${esc(text)}</p>
    ${href ? `<button class="btn primary" onclick="location.hash='${href}'">${esc(btn)}</button>` : ''}
  </div>`;

const labelSec = (k) => ({ pool: 'Piscina', site: 'Sítio', garden: 'Roçada' }[k] || k);

/* Comprime a foto antes de salvar (Base64 JPEG) — economiza IndexedDB */
function compressImage(file, maxDim = 1280, quality = 0.72){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

/* Contador animado (litragem) */
function animateNumber(el, to, dur = 550){
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt0.format(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step); else el.dataset.v = to;
  };
  requestAnimationFrame(step);
}

/* =========================================================
   CÁLCULO AUTOMÁTICO DE LITRAGEM (requisito do sítio/piscina)
   Retangular: Comprimento × Largura × Prof. Média × 1000
   Redonda:    Diâmetro × Diâmetro × Prof. Média × 0,785 × 1000
   ========================================================= */
function calcVolume(shape, { length = 0, width = 0, diameter = 0, depth = 0 } = {}){
  const C = parseFloat(length) || 0, L = parseFloat(width) || 0,
        D = parseFloat(diameter) || 0, P = parseFloat(depth) || 0;
  if (P <= 0) return 0;
  if (shape === 'retangular') return C * L * P * 1000;
  if (shape === 'redonda')    return D * D * P * 0.785 * 1000;
  return 0;
}

/* =========================================================
   LÓGICA DE RECOMENDAÇÃO AUTOMÁTICA (requisito da Aba A)
   Cloro < 1,0 ppm → gramas de cloro = Volume × 0,004
   pH    > 7,6     → ml de redutor  = Volume × 0,007
   ========================================================= */
function computeRecs(vol, cloro, ph){
  const recs = [];
  const cl = parseFloat(cloro), p = parseFloat(ph);
  if (vol > 0 && !isNaN(cl) && cl < 1.0) recs.push({ kind: 'cloro', text: `Adicionar ${fmt1.format(vol * 0.004)} g de Cloro` });
  if (vol > 0 && !isNaN(p)  && p  > 7.6) recs.push({ kind: 'ph',    text: `Adicionar ${fmt1.format(vol * 0.007)} ml de Redutor de pH` });
  return recs;
}

/* ================= ROTAS ================= */
const App = {
  el: null,
  routes: [
    { re: /^#\/?$/,                          view: 'dashboard', m: () => ({}) },
    { re: /^#\/sites$/,                      view: 'sites',     m: () => ({}) },
    { re: /^#\/site\/novo$/,                 view: 'siteForm',  m: () => ({}) },
    { re: /^#\/site\/([\w-]+)$/,             view: 'siteForm',  m: (m) => ({ id: m[1] }) },
    { re: /^#\/vistoria$/,                   view: 'inspection',m: () => ({}) },
    { re: /^#\/vistoria\/([\w-]+)$/,         view: 'inspection',m: (m) => ({ siteId: m[1] }) },
    { re: /^#\/historico$/,                  view: 'history',   m: () => ({}) },
    { re: /^#\/relatorio\/([\w-]+)$/,        view: 'reportView',m: (m) => ({ id: m[1] }) },
    { re: /^#\/ajustes$/,                    view: 'settings',  m: () => ({}) }
  ],
  async render(){
    if (!this.el) return;
    const h = location.hash || '#/';
    let view = 'dashboard', params = {};
    for (const r of this.routes){
      const m = h.match(r.re);
      if (m){ view = r.view; params = r.m(m); break; }
    }
    try { await Views[view](params); }
    catch (err){ console.error(err); this.el.innerHTML = topbar('Erro', '#/') + `<main class="view container">${emptyState('alert','Algo deu errado','Tente novamente.')}</main>`; }
    updateNav(view);
    window.scrollTo({ top: 0 });
  }
};
function updateNav(view){
  const map = { dashboard:'dashboard', history:'history', sites:'sites', siteForm:'sites', settings:'settings', inspection:'inspection', reportView:'history' };
  const key = map[view] || 'dashboard';
  $$('.bnav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
}
window.addEventListener('hashchange', () => App.render());

/* ================= VIEWS ================= */
const Views = {};

/* ---------- 1. DASHBOARD ---------- */
Views.dashboard = async () => {
  const [settings, sites, reports] = await Promise.all([getSettings(), DB.all('sites'), DB.all('reports')]);
  const pending = reports.filter((r) => !r.synced).length;

  App.el.innerHTML = `
  <header class="hero">
    <span class="drop d1"></span><span class="drop d2"></span><span class="drop d3"></span>
    <div class="hero-in">
      <div class="brand">
        ${logoSVG(46)}
        <div><h1>NEGRET&rsquo;S MASTER</h1><p>${esc(settings.tagline || 'Aplicativo para Piscineiro e Limpeza de Sítio')}</p></div>
      </div>
      <div class="hello-row">
        <p class="hello">${saudacao()}${settings.technician ? ', ' + esc(settings.technician) : ''}!</p>
        <span id="netPill" class="net-pill ${navigator.onLine ? '' : 'off'}">${netPillHTML()}</span>
      </div>
    </div>
    <svg class="wave" viewBox="0 0 1440 110" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,55 C220,95 430,8 720,40 C1010,72 1230,95 1440,50 L1440,110 L0,110 Z" fill="#EEF3F8"/>
    </svg>
  </header>

  <main class="view container">
    <button class="card cta" id="goVistoria">
      <span class="cta-ic">${icon('clipboard')}</span>
      <span class="cta-tx">
        <small>NOVO RELATÓRIO</small>
        <strong>INICIAR NOVA VISTORIA</strong>
        <em>Parâmetros químicos, checklist, fotos e PDF do sítio</em>
      </span>
      <span class="pill">COMEÇAR</span>
    </button>

    <button class="card act" id="goHistorico">
      <span class="act-ic">${icon('folder')}</span>
      <span class="act-tx">
        <small>RELATÓRIOS CONCLUÍDOS</small>
        <strong>HISTÓRICO PISCINA &amp; SÍTIO</strong>
        <em>Visualize e envie relatórios finalizados</em>
      </span>
      <span class="pill">ACESSAR</span>
      ${pending ? `<span class="bubble">${pending}</span>` : ''}
    </button>

    <button class="card act" id="goSites">
      <span class="act-ic">${icon('pin')}</span>
      <span class="act-tx">
        <small>CADASTRO</small>
        <strong>SÍTIOS &amp; CLIENTES</strong>
        <em>${sites.length} cadastrado${sites.length === 1 ? '' : 's'} • litragem automática</em>
      </span>
      <span class="pill">GERENCIAR</span>
    </button>

    <button class="card act" id="goAjustes">
      <span class="act-ic">${icon('gear')}</span>
      <span class="act-tx">
        <small>CONFIGURAÇÕES</small>
        <strong>AJUSTES GERAIS</strong>
        <em>Dados da empresa, técnico e preferências de serviço</em>
      </span>
      <span class="pill">EDITAR</span>
    </button>

    <section class="sync-strip">
      <div>
        ${icon(navigator.onLine ? 'wifi' : 'wifioff')}
        <div><strong>${navigator.onLine ? 'Online' : 'Offline'}</strong>
        <small>${pending ? pending + ' relatório' + (pending > 1 ? 's' : '') + ' aguardando sincronização' : 'Tudo salvo neste aparelho'}</small></div>
      </div>
      <button class="btn small ${pending && navigator.onLine ? 'primary' : 'ghost'}" id="syncNow">${icon('sync')} Sincronizar</button>
    </section>
  </main>`;

  $('#goVistoria').onclick  = () => location.hash = '#/vistoria';
  $('#goHistorico').onclick = () => location.hash = '#/historico';
  $('#goSites').onclick     = () => location.hash = '#/sites';
  $('#goAjustes').onclick   = () => location.hash = '#/ajustes';
  $('#syncNow').onclick     = () => Sync.syncNow();
};

/* ---------- 2. LISTA DE SÍTIOS ---------- */
Views.sites = async () => {
  const sites = (await DB.all('sites')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  App.el.innerHTML = topbar('Sítios & Clientes', '#/') + `
  <main class="view container">
    <button class="btn primary block" id="newSite">${icon('plus')} Novo Cadastro</button>
    <div id="siteList" class="list">
      ${sites.length ? sites.map((s) => `
        <div class="item" data-id="${s.id}">
          <span class="item-ic">${icon('pin')}</span>
          <div class="item-tx">
            <strong>${esc(s.siteName)}</strong>
            <span>${esc(s.ownerName)}${s.phone ? ' • ' + esc(s.phone) : ''}</span>
          </div>
          ${s.volume ? `<span class="vol-chip">${fmt0.format(s.volume)} L</span>` : ''}
          <button class="del" aria-label="Excluir">${icon('trash')}</button>
        </div>`).join('')
      : emptyState('pin', 'Nenhum sítio cadastrado', 'Cadastre seus clientes para agilizar as vistorias em campo.', '#/site/novo', 'Cadastrar agora')}
    </div>
  </main>`;

  $('#newSite').onclick = () => location.hash = '#/site/novo';
  $$('#siteList .item').forEach((el) => {
    el.onclick = (e) => { if (e.target.closest('.del')) return; location.hash = '#/site/' + el.dataset.id; };
  });
  $$('#siteList .del').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    const id = b.closest('.item').dataset.id;
    if (await confirmDlg({ title: 'Excluir cadastro?', text: 'Esta ação não pode ser desfeita.', okLabel: 'Excluir', danger: true })){
      await DB.del('sites', id); /* PERSISTÊNCIA: remoção no IndexedDB */
      toast('Cadastro excluído.');
      Views.sites();
    }
  });
};

/* ---------- 3. CADASTRO DE SÍTIO / PISCINA ---------- */
Views.siteForm = async ({ id } = {}) => {
  const site = id ? await DB.get('sites', id) : null;
  const f = site ? { ...site } : { poolType: 'fibra', poolShape: 'retangular', length: '', width: '', diameter: '', depth: '' };

  App.el.innerHTML = topbar(site ? 'Editar Sítio' : 'Novo Sítio', '#/sites') + `
  <main class="view container">
    <form id="si
