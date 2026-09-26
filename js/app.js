/* =========================================================
   NEGRET'S MASTER — js/app.js (v14 — arquivo completo)
   -----------------------------------------------------------
   • Abas Manutenção / Hóspedes no topo da vistoria
   • Card de Hóspedes: contratante, WhatsApp, qtd pessoas,
     check-in/out, tags "Entrou na piscina" / "Saiu — choque"
   • Hóspede com SAÍDA marcada exige: nome + parâmetros da
     piscina (4 medidas) + seção Casa Sede ativa
   • Módulo D: Casa Sede — Limpeza da Casa
   • TODAS as tarefas são CARDS clicáveis (azul + ✓)
   • "+ Adicionar nova tarefa" em A/B/C/D (via prompt)
   • Litragem manual (cliente informou) com prioridade
   • Dureza Cálcica com recomendação automática
   • Diagnóstico PWA + versão visível em Ajustes
   Obs.: o Service Worker é registrado no index.html —
   aqui não há registro duplicado.
   ========================================================= */
'use strict';

/* =========================================================
   1. CONFIG
   ========================================================= */
const APP_VERSION = '14.0.0';

const CONFIG = {
  /* URL de nuvem futura (Google Apps Script etc.).
     Vazio = modo 100% local — nada sai do aparelho. */
  SYNC_ENDPOINT: ''
};

const PHOTO_MAX_DIM = 1280; /* lado maior da foto após compressão */
const PHOTO_QUALITY = 0.65; /* qualidade JPEG                     */
const MAX_PHOTOS    = 8;    /* por campo antes/depois de cada seção */

/* =========================================================
   2. UTILITÁRIOS
   ========================================================= */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const uid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

const esc = (s) => String(s ?? '')
  .replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const hojeISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const fmtDateBR = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR');
};

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

/* PDF é persistido como Base64 (texto) — máxima compatibilidade */
const blobToB64 = (blob) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result).split(',')[1]);
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(blob);
});

function b64ToBlob(b64){
  if (!b64) throw new Error('PDF vazio.');
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: 'application/pdf' });
}

/* Leitura segura — nunca lança em null/undefined */
const g = (obj, k, dflt) =>
  (obj && typeof obj === 'object' && obj[k] !== undefined && obj[k] !== null) ? obj[k] : dflt;

/* =========================================================
   3. ÍCONES (SVG inline — sem CDN, funciona offline)
   ========================================================= */
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
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  refresh:'<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'
};
const icon = (name) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const logoSVG = (s = 44) => `
<svg width="${s}" height="${s}" viewBox="0 0 512 512" aria-hidden="true">
  <rect width="512" height="512" rx="116" fill="#FFFFFF" opacity=".14"/>
  <path d="M256 84c-52 66-92 120-92 176a92 92 0 0 0 184 0c0-56-40-110-92-176z" fill="#fff"/>
  <ellipse cx="222" cy="240" rx="18" ry="46" fill="#BFE3F7" transform="rotate(18 222 240)"/>
  <path d="M70 396c26-20 52-20 78 0s52 20 78 0 52-20 78 0 52 20 78 0" fill="none" stroke="#6FC6F2" stroke-width="24" stroke-linecap="round"/>
</svg>`;

const checkSVG = `<svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="40" cy="40" r="34" stroke="#1E88E5" stroke-width="5"/>
  <path d="M26 41.5l10 10 18-21" stroke="#0C2D4D" stroke-width="6"/>
</svg>`;

/* =========================================================
   4. TOAST / MODAL
   ========================================================= */
function toast(msg, kind = 'ok', ms = 2800){
  const icMap = { ok: 'check', warn: 'alert', info: 'sync' };
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = icon(icMap[kind] || 'check') + '<span>' + esc(msg) + '</span>';
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 320); }, ms);
}

function confirmDlg({ title, text, okLabel = 'Confirmar', danger = false }){
  return new Promise((res) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-a="0">Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-a="1">${esc(okLabel)}</button>
      </div></div>`;
    back.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b){ back.remove(); res(b.dataset.a === '1'); }
      else if (e.target === back){ back.remove(); res(false); }
    });
    document.body.appendChild(back);
  });
}

/* =========================================================
   5. AJUSTES DA EMPRESA (store: settings)
   ========================================================= */
const DEFAULT_SETTINGS = {
  companyName: "NEGRET'S MASTER",
  tagline: 'Piscinas & Limpeza de Sítio',
  phone: '', email: '', technician: ''
};

async function getSettings(){
  const rec = await DB.get('settings', 'company');
  return { ...DEFAULT_SETTINGS, ...(g(rec, 'value', {})) };
}
const saveSettings = (v) => DB.put('settings', { key: 'company', value: v });

let deferredPrompt = null;

/* =========================================================
   6. SINCRONIZAÇÃO (indicador online/offline + envio futuro)
   ========================================================= */
const netPillHTML = () => '<i class="dot"></i>' + (navigator.onLine ? 'Online' : 'Offline');

function updateNetUI(){
  const p = $('#netPill');
  if (p){ p.classList.toggle('off', !navigator.onLine); p.innerHTML = netPillHTML(); }
}

const Sync = {
  async syncNow(){
    if (!navigator.onLine){
      return toast('Sem internet agora — seus dados continuam salvos no aparelho.', 'warn');
    }
    const pend = (await DB.all('reports')).filter((r) => !r.synced);
    if (!pend.length) return toast('Tudo sincronizado.');
    if (!CONFIG.SYNC_ENDPOINT){
      return toast(pend.length + ' relatório(s) salvos localmente. Configure SYNC_ENDPOINT para enviar à nuvem.', 'info', 3800);
    }
    let ok = 0;
    for (const r of pend){
      try {
        const { pdfBase64, ...json } = r; /* o PDF em si não vai no JSON */
        const res = await fetch(CONFIG.SYNC_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        if (res.ok){ r.synced = true; await DB.put('reports', r); ok++; }
      } catch (_) {}
    }
    toast(ok === pend.length ? ok + ' relatório(s) enviados.' : ok + '/' + pend.length + ' enviados — tente novamente.', ok ? 'ok' : 'warn');
    updateNetUI();
  }
};

window.addEventListener('online',  () => { updateNetUI(); toast('Conexão restabelecida.'); });
window.addEventListener('offline', () => { updateNetUI(); toast('Você está offline — o app continua funcionando.', 'warn'); });

/* =========================================================
   7. HELPERS DE UI
   ========================================================= */
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

const labelSec = (k) => ({ pool: 'Piscina', site: 'Sítio', garden: 'Roçada', house: 'Casa Sede' }[k] || k);

function animateNumber(el, to, dur = 550){
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt0.format(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
    else el.dataset.v = to;
  };
  requestAnimationFrame(step);
}

/* =========================================================
   8. FOTOS — pipeline leve
   • Sem atributo "capture": Android/iOS oferecem CÂMERA e GALERIA.
   • createImageBitmap + .close() → baixo pico de memória.
   • UMA foto por vez; fallback <img>+canvas p/ navegadores antigos.
   ========================================================= */
function legacyCompress(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, PHOTO_MAX_DIM / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const out = c.toDataURL('image/jpeg', PHOTO_QUALITY);
        c.width = c.height = 0;
        resolve(out);
      } catch (e){ URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

async function compressImage(file){
  let bmp = null;
  if (window.createImageBitmap){
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { try { bmp = await createImageBitmap(file); } catch (_) {} }
  }
  if (bmp){
    try {
      const scale = Math.min(1, PHOTO_MAX_DIM / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width  = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close(); /* libera a imagem original da RAM */
      const out = c.toDataURL('image/jpeg', PHOTO_QUALITY);
      c.width = c.height = 0;
      return out;
    } catch (e){ if (bmp.close) try { bmp.close(); } catch (_) {} }
  }
  return legacyCompress(file);
}

/* =========================================================
   9. CÁLCULOS
   LITRAGEM:  Retangular C×L×P×1000 | Redonda D×D×P×0,785×1000
   MANUAL:    valor informado pelo cliente TEM prioridade.
   DOSAGEM:   Cloro <1,0 ppm → Vol×0,004 g | pH >7,6 → Vol×0,007 ml
              Dureza cálcica <200 / >400 ppm → orientação
   ========================================================= */
function calcVolume(shape, { length = 0, width = 0, diameter = 0, depth = 0 } = {}){
  const C = parseFloat(length)   || 0;
  const L = parseFloat(width)    || 0;
  const D = parseFloat(diameter) || 0;
  const P = parseFloat(depth)    || 0;
  if (P <= 0) return 0;
  if (shape === 'retangular') return C * L * P * 1000;
  if (shape === 'redonda')    return D * D * P * 0.785 * 1000;
  return 0;
}

function effectiveVolume(manualStr, shape, dims){
  const m = parseFloat(manualStr) || 0;
  if (m > 0) return { volume: Math.round(m), source: 'manual' };
  return { volume: Math.round(calcVolume(shape, dims)), source: 'calc' };
}

function computeRecs(vol, cloro, ph, dureza){
  const recs = [];
  const cl = parseFloat(cloro);
  const p  = parseFloat(ph);
  const dz = parseFloat(dureza);
  if (vol > 0 && !isNaN(cl) && cl < 1.0)
    recs.push({ kind: 'cloro', text: `Adicionar ${fmt1.format(vol * 0.004)} g de Cloro` });
  if (vol > 0 && !isNaN(p) && p > 7.6)
    recs.push({ kind: 'ph', text: `Adicionar ${fmt1.format(vol * 0.007)} ml de Redutor de pH` });
  if (!isNaN(dz) && dz < 200)
    recs.push({ kind: 'dureza', text: `Dureza cálcica baixa (${fmt0.format(dz)} ppm) — aplicar cloreto de cálcio conforme tabela do fabricante` });
  if (!isNaN(dz) && dz > 400)
    recs.push({ kind: 'dureza', text: `Dureza cálcica alta (${fmt0.format(dz)} ppm) — diluir com água nova ou usar removedor de dureza` });
  return recs;
}

/* =========================================================
   10. MODAL "NOVO CLIENTE" (cadastro rápido, com litragem manual)
   ========================================================= */
function openClientModal(onSaved){
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
  <div class="modal" style="max-width:400px;max-height:88vh;overflow:auto">
    <h3>Novo Cliente</h3>
    <p style="margin-bottom:12px">Cadastro rápido. A piscina pode ser detalhada depois em <b>Sítios</b>.</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <label class="field"><span>Nome do Sítio *</span><input id="qcSite" placeholder="Ex.: Sítio Boa Vista"></label>
      <label class="field"><span>Proprietário *</span><input id="qcOwner" placeholder="Ex.: Roberto Negret"></label>
      <label class="field"><span>Telefone / WhatsApp</span><input id="qcPhone" inputmode="tel" placeholder="(31) 99999-0000"></label>
      <label class="field"><span>Litragem conhecida (L) — opcional</span>
        <input type="number" step="1" min="0" inputmode="numeric" id="qc_manual" placeholder="Se o cliente já souber, digite aqui"></label>
      <span class="field-lbl">Formato da Piscina (para cálculo automático)</span>
      <div class="segmented">
        <label><input type="radio" name="qcShape" value="retangular" checked><span>Retangular</span></label>
        <label><input type="radio" name="qcShape" value="redonda"><span>Redonda</span></label>
      </div>
      <div id="qcDims"></div>
      <div class="vol-line">${icon('droplet')}<span>Litragem: <strong id="qcVol">—</strong></span></div>
      <p class="hint" id="qcSrc">Preencha as dimensões ou a litragem conhecida.</p>
      <div class="modal-actions" style="margin-top:6px">
        <button class="btn ghost" data-a="c">Cancelar</button>
        <button class="btn primary" data-a="s">Salvar Cliente</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(back);

  const dims = $('#qcDims', back);
  const shapeVal = () => back.querySelector('input[name="qcShape"]:checked').value;
  const num = (k) => { const el = back.querySelector('#qc_' + k); return el ? parseFloat(el.value) || 0 : 0; };

  function renderDims(){
    dims.innerHTML = shapeVal() === 'retangular' ? `
      <div class="grid3">
        <label class="field"><span>Compr. (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" id="qc_length" placeholder="0,0"></label>
        <label class="field"><span>Larg. (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" id="qc_width" placeholder="0,0"></label>
        <label class="field"><span>Prof. (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" id="qc_depth" placeholder="0,0"></label>
      </div>` : `
      <div class="grid2">
        <label class="field"><span>Diâmetro (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" id="qc_diameter" placeholder="0,0"></label>
        <label class="field"><span>Prof. (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" id="qc_depth" placeholder="0,0"></label>
      </div>`;
    $$('input', dims).forEach((i) => i.addEventListener('input', updVol));
  }

  function updVol(){
    const eff = effectiveVolume(
      String(num('manual') || ''),
      shapeVal(),
      { length: num('length'), width: num('width'), diameter: num('diameter'), depth: num('depth') }
    );
    $('#qcVol', back).textContent = eff.volume > 0 ? fmt0.format(eff.volume) + ' L' : '—';
    $('#qcSrc', back).textContent =
      eff.source === 'manual' ? 'Litragem informada pelo cliente (prioritária).'
      : eff.volume > 0        ? 'Cálculo automático pelas dimensões.'
      : 'Preencha as dimensões ou a litragem conhecida.';
    return eff;
  }

  back.querySelectorAll('input[name="qcShape"]').forEach((r) => r.addEventListener('change', renderDims));
  $('#qc_manual', back).addEventListener('input', updVol);
  renderDims();

  back.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b){
      if (e.target === back) back.remove();
      return;
    }
    if (b.dataset.a === 'c') return back.remove();

    const siteName  = $('#qcSite', back).value.trim();
    const ownerName = $('#qcOwner', back).value.trim();
    if (!siteName || !ownerName) return toast('Preencha sítio e proprietário.', 'warn');

    const eff = updVol();
    const rec = {
      id: uid(),
      ownerName, siteName,
      phone: $('#qcPhone', back).value.trim(),
      address: '',
      poolType: 'fibra',
      poolShape: shapeVal(),
      length: String(num('length') || ''), width: String(num('width') || ''),
      diameter: String(num('diameter') || ''), depth: String(num('depth') || ''),
      manualVolume: num('manual') > 0 ? String(num('manual')) : '',
      volume: eff.volume,
      volumeSource: eff.source,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await DB.put('sites', rec); /* PERSISTÊNCIA: IndexedDB */
    back.remove();
    onSaved(rec);
  });
}

/* =========================================================
   11. ROUTER (SPA por hash)
   ========================================================= */
const App = {
  el: null,
  routes: [
    { re: /^#\/?$/,                   view: 'dashboard',  m: () => ({}) },
    { re: /^#\/sites$/,               view: 'sites',      m: () => ({}) },
    { re: /^#\/site\/novo$/,          view: 'siteForm',   m: () => ({}) },
    { re: /^#\/site\/([\w-]+)$/,      view: 'siteForm',   m: (m) => ({ id: m[1] }) },
    { re: /^#\/vistoria$/,            view: 'inspection', m: () => ({}) },
    { re: /^#\/vistoria\/([\w-]+)$/,  view: 'inspection', m: (m) => ({ siteId: m[1] }) },
    { re: /^#\/editar\/([\w-]+)$/,    view: 'inspection', m: (m) => ({ reportId: m[1] }) },
    { re: /^#\/historico$/,           view: 'history',    m: () => ({}) },
    { re: /^#\/relatorio\/([\w-]+)$/, view: 'reportView', m: (m) => ({ id: m[1] }) },
    { re: /^#\/ajustes$/,             view: 'settings',   m: () => ({}) }
  ],
  async render(){
    if (!this.el) return;
    const h = location.hash || '#/';
    let view = 'dashboard', params = {};
    for (const r of this.routes){
      const m = h.match(r.re);
      if (m){ view = r.view; params = r.m(m); break; }
    }
    try {
      await Views[view](params);
    } catch (err){
      console.error('[NEGRET\'S]', err);
      this.el.innerHTML = topbar('Erro', '#/') +
        `<main class="view container">${emptyState('alert','Algo deu errado', String((err && err.message) || err))}</main>`;
    }
    updateNav(view);
    window.scrollTo({ top: 0 });
  }
};

function updateNav(view){
  const map = {
    dashboard: 'dashboard', history: 'history', sites: 'sites',
    siteForm: 'sites', settings: 'settings',
    inspection: 'inspection', reportView: 'history'
  };
  const key = map[view] || 'dashboard';
  $$('.bnav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
}
window.addEventListener('hashchange', () => App.render());

/* =========================================================
   12. VIEWS
   ========================================================= */
const Views = {};

/* ---------- 12.1 DASHBOARD ---------- */
Views.dashboard = async () => {
  const [settings, sites, reports] = await Promise.all([getSettings(), DB.all('sites'), DB.all('reports')]);
  const pending = reports.filter((r) => !r.synced).length;

  App.el.innerHTML = `
  <header class="hero">
    <span class="drop d1"></span><span class="drop d2"></span><span class="drop d3"></span>
    <div class="hero-in">
      <div class="brand">
        ${logoSVG(46)}
        <div><h1>NEGRET&rsquo;S MASTER</h1><p>${esc(settings.tagline)}</p></div>
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
        <em>Manutenção ou Hóspedes • química, limpeza, roçada e casa</em>
      </span>
      <span class="pill">COMEÇAR</span>
    </button>
    <button class="card act" id="goHistorico">
      <span class="act-ic">${icon('folder')}</span>
      <span class="act-tx">
        <small>RELATÓRIOS CONCLUÍDOS</small>
        <strong>HISTÓRICO PISCINA &amp; SÍTIO</strong>
        <em>Visualize, edite e envie relatórios</em>
      </span>
      <span class="pill">ACESSAR</span>
      ${pending ? `<span class="bubble">${pending}</span>` : ''}
    </button>
    <button class="card act" id="goSites">
      <span class="act-ic">${icon('pin')}</span>
      <span class="act-tx">
        <small>CADASTRO</small>
        <strong>SÍTIOS &amp; CLIENTES</strong>
        <em>${sites.length} cadastrado${sites.length === 1 ? '' : 's'} • litragem manual ou automática</em>
      </span>
      <span class="pill">GERENCIAR</span>
    </button>
    <button class="card act" id="goAjustes">
      <span class="act-ic">${icon('gear')}</span>
      <span class="act-tx">
        <small>CONFIGURAÇÕES</small>
        <strong>AJUSTES GERAIS</strong>
        <em>Dados da empresa, técnico, instalação e atualização</em>
      </span>
      <span class="pill">EDITAR</span>
    </button>
    <section class="sync-strip">
      <div>
        ${icon(navigator.onLine ? 'wifi' : 'wifioff')}
        <div>
          <strong>${navigator.onLine ? 'Online' : 'Offline'}</strong>
          <small>${pending ? pending + ' relatório' + (pending > 1 ? 's' : '') + ' aguardando sincronização' : 'Tudo salvo neste aparelho'}</small>
        </div>
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

/* ---------- 12.2 SÍTIOS (lista) ---------- */
Views.sites = async () => {
  const sites = (await DB.all('sites')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  App.el.innerHTML = topbar('Sítios & Clientes', '#/') + `
  <main class="view container">
    <button class="btn primary block" id="newSite">${icon('plus')} Novo Cadastro Completo</button>
    <button class="btn ghost block" id="quickSite">${icon('user')} Cadastro Rápido de Cliente</button>
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

  $('#newSite').onclick   = () => location.hash = '#/site/novo';
  $('#quickSite').onclick = () => openClientModal(() => { toast('Cliente cadastrado.'); Views.sites(); });

  $$('#siteList .item').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('.del')) return;
      location.hash = '#/site/' + el.dataset.id;
    };
  });
  $$('#siteList .del').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    const id = b.closest('.item').dataset.id;
    if (await confirmDlg({ title: 'Excluir cadastro?', text: 'Esta ação não pode ser desfeita.', okLabel: 'Excluir', danger: true })){
      await DB.del('sites', id);
      toast('Cadastro excluído.');
      Views.sites();
    }
  });
};

/* ---------- 12.3 CADASTRO COMPLETO DE SÍTIO ---------- */
Views.siteForm = async ({ id } = {}) => {
  const site = id ? await DB.get('sites', id) : null;
  const f = site ? { ...site }
                 : { poolType: 'fibra', poolShape: 'retangular', length: '', width: '', diameter: '', depth: '', manualVolume: '' };

  App.el.innerHTML = topbar(site ? 'Editar Sítio' : 'Novo Sítio', '#/sites') + `
  <main class="view container">
    <form id="siteForm" class="card form" novalidate>
      <div class="form-sec">
        <h2>Dados do Cliente</h2>
        <label class="field"><span>Nome do Proprietário *</span><input name="ownerName" required value="${esc(f.ownerName || '')}" placeholder="Ex.: Roberto Negret"></label>
        <label class="field"><span>Nome do Sítio *</span><input name="siteName" required value="${esc(f.siteName || '')}" placeholder="Ex.: Sítio Boa Vista"></label>
        <label class="field"><span>Telefone / WhatsApp</span><input name="phone" inputmode="tel" value="${esc(f.phone || '')}" placeholder="(44) 99999-0000"></label>
        <label class="field"><span>Endereço</span><input name="address" value="${esc(f.address || '')}" placeholder="Rua, distrito, cidade"></label>
      </div>

      <div class="form-sec">
        <h2>Dados da Piscina</h2>
        <label class="field"><span>Litragem conhecida (L) — opcional</span>
          <input type="number" step="1" min="0" inputmode="numeric" name="manualVolume" value="${esc(f.manualVolume || '')}" placeholder="Se o cliente já souber, digite aqui"></label>
        <p class="hint">Se preenchida, esta litragem <b>substitui o cálculo</b> pelas dimensões.</p>

        <span class="field-lbl">Tipo de Piscina</span>
        <div class="segmented">
          ${['Fibra','Vinil','Alvenaria'].map((t) => `
            <label><input type="radio" name="poolType" value="${t.toLowerCase()}" ${f.poolType === t.toLowerCase() ? 'checked' : ''}><span>${t}</span></label>`).join('')}
        </div>
        <span class="field-lbl">Formato</span>
        <div class="segmented">
          <label><input type="radio" name="poolShape" value="retangular" ${f.poolShape !== 'redonda' ? 'checked' : ''}><span>Retangular</span></label>
          <label><input type="radio" name="poolShape" value="redonda" ${f.poolShape === 'redonda' ? 'checked' : ''}><span>Redonda</span></label>
        </div>

        <div id="poolFields"></div>

        <div class="gauge">
          <div class="tank" aria-hidden="true">
            <div class="tank-water" id="tankWater"><span class="bub b1"></span><span class="bub b2"></span></div>
            <div class="tank-marks"><i></i><i></i><i></i><i></i></div>
          </div>
          <div class="gauge-tx">
            <span class="gauge-lbl">LITRAGEM</span>
            <strong><b id="volNum" data-v="0">0</b><i>Litros</i></strong>
            <span class="gauge-hint" id="volSrc"></span>
          </div>
        </div>
      </div>

      <button class="btn primary block" type="submit">${site ? icon('check') + ' Salvar Alterações' : icon('plus') + ' Salvar Sítio'}</button>
    </form>
  </main>`;

  const poolFields = $('#poolFields');
  const shape = () => $('#siteForm input[name="poolShape"]:checked').value;
  const manualVal = () => {
    const el = $('#siteForm [name="manualVolume"]');
    return el ? el.value : '';
  };

  function renderFields(){
    poolFields.innerHTML = shape() === 'retangular' ? `
      <div class="grid3">
        <label class="field"><span>Comprimento (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" name="length" value="${esc(f.length || '')}" placeholder="0,0"></label>
        <label class="field"><span>Largura (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" name="width" value="${esc(f.width || '')}" placeholder="0,0"></label>
        <label class="field"><span>Prof. Média (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" name="depth" value="${esc(f.depth || '')}" placeholder="0,0"></label>
      </div>` : `
      <div class="grid2">
        <label class="field"><span>Diâmetro (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" name="diameter" value="${esc(f.diameter || '')}" placeholder="0,0"></label>
        <label class="field"><span>Prof. Média (m)</span><input type="number" step="0.1" min="0" inputmode="decimal" name="depth" value="${esc(f.depth || '')}" placeholder="0,0"></label>
      </div>`;
    $$('#poolFields input').forEach((i) => i.addEventListener('input', updateVolume));
    updateVolume();
  }

  function calcDims(){
    const v = (k) => { const el = $('#siteForm [name="' + k + '"]'); return el ? parseFloat(el.value) || 0 : 0; };
    return { length: v('length'), width: v('width'), diameter: v('diameter'), depth: v('depth') };
  }

  function updateVolume(){
    const eff = effectiveVolume(manualVal(), shape(), calcDims());
    animateNumber($('#volNum'), eff.volume);
    $('#tankWater').style.height = eff.volume > 0 ? (18 + Math.min(82, Math.log10(Math.max(eff.volume, 10)) / 5 * 82)) + '%' : '0%';
    $('#volSrc').textContent =
      eff.source === 'manual' ? 'Valor informado pelo cliente (prioritário).'
      : eff.volume > 0        ? 'Cálculo automático conforme as dimensões.'
      : 'Informe as dimensões ou a litragem conhecida.';
  }

  $$('#siteForm input[name="poolShape"]').forEach((r) => r.addEventListener('change', renderFields));
  $('#siteForm [name="manualVolume"]').addEventListener('input', updateVolume);
  renderFields();

  $('#siteForm').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (!String(data.ownerName || '').trim() || !String(data.siteName || '').trim())
      return toast('Preencha proprietário e nome do sítio.', 'warn');

    /* PERSISTÊNCIA: perfil completo (com litragem e origem) no IndexedDB */
    const eff = effectiveVolume(data.manualVolume || '', data.poolShape, {
      length: data.length, width: data.width, diameter: data.diameter, depth: data.depth
    });
    const rec = {
      id: f.id || uid(),
      ownerName: data.ownerName.trim(),
      siteName: data.siteName.trim(),
      phone: data.phone || '',
      address: data.address || '',
      poolType: data.poolType,
      poolShape: data.poolShape,
      length: data.length || '', width: data.width || '',
      diameter: data.diameter || '', depth: data.depth || '',
      manualVolume: (parseFloat(data.manualVolume) > 0) ? String(data.manualVolume) : '',
      volume: eff.volume,
      volumeSource: eff.source,
      createdAt: f.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await DB.put('sites', rec);
    toast('Sítio salvo no aparelho.');
    location.hash = '#/sites';
  };
};

/* ---------- 12.4 VISTORIA (nova + edição) — v14 ---------- */
Views.inspection = async ({ siteId, reportId } = {}) => {
  const TASKS = ReportPDF.TASKS;
  const SECS = ['pool', 'site', 'garden', 'house'];
  const [sites, settings] = await Promise.all([DB.all('sites'), getSettings()]);
  const editSource = reportId ? await DB.get('reports', reportId) : null;

  if (!sites.length && !editSource){
    App.el.innerHTML = topbar('Nova Vistoria', '#/') + `
      <main class="view container">
        ${emptyState('clipboard','Cadastre um cliente','A vistoria precisa de um cliente selecionado.','#/site/novo','Cadastro completo')}
        <button class="btn ghost block" id="quickClientEmpty">${icon('plus')} Cadastro rápido de cliente</button>
      </main>`;
    $('#quickClientEmpty').onclick = () =>
      openClientModal(() => { toast('Cliente cadastrado. Abrindo vistoria…'); App.render(); });
    return;
  }

  /* ---- Fábricas defensivas: nunca retornam null/undefined ---- */
  const taskSet = (src, keys) => {
    const t = {};
    keys.forEach(([k]) => { t[k] = !!(src && src.tasks && src.tasks[k]); });
    return t;
  };
  const photoSet = (src) => {
    const ph = (src && src.photos && typeof src.photos === 'object') ? src.photos : {};
    return {
      before: Array.isArray(ph.before) ? ph.before.slice() : [],
      after:  Array.isArray(ph.after)  ? ph.after.slice()  : []
    };
  };
  const customSet = (src) => {
    const ct = g(src, 'customTasks', {});
    const out = {};
    SECS.forEach((sec) => {
      const arr = Array.isArray(ct[sec]) ? ct[sec] : [];
      out[sec] = arr.filter((c) => c && c.id && c.label)
                    .map((c) => ({ id: String(c.id), label: String(c.label) }));
    });
    return out;
  };
  const secDraft = (src, keys, extra) => Object.assign({
    active: !!g(src, 'active', false),
    tasks: taskSet(src, keys),
    photos: photoSet(src)
  }, extra || {});

  /* ---- Rascunho da vistoria (persistido ao finalizar) ---- */
  const draft = {
    /* v14: modo de atendimento + registro do hóspede */
    mode: g(editSource, 'mode', 'manutencao'),
    guest: (function (gh){
      gh = gh || {};
      return {
        name: String(g(gh, 'name', '')),
        whatsapp: String(g(gh, 'whatsapp', '')),
        people: String(g(gh, 'people', '')),
        checkin: String(g(gh, 'checkin', '')),
        checkout: String(g(gh, 'checkout', '')),
        entered: !!g(gh, 'entered', false),
        left: !!g(gh, 'left', false)
      };
    })(editSource && editSource.guest),
    siteId: g(editSource, 'siteId',
      (siteId && sites.some((s) => s.id === siteId)) ? siteId : (sites[0] ? sites[0].id : '')),
    dateISO: (editSource ? String(editSource.dateISO).slice(0, 10) : hojeISO()),
    customTasks: customSet(editSource),
    pool: secDraft(editSource && editSource.pool, TASKS.pool, {
      active: editSource ? !!g(editSource.pool, 'active', false) : true,
      ph:     String(g(editSource && editSource.pool, 'ph', '')),
      cloro:  String(g(editSource && editSource.pool, 'cloro', '')),
      alcal:  String(g(editSource && editSource.pool, 'alcal', '')),
      dureza: String(g(editSource && editSource.pool, 'dureza', ''))
    }),
    site:   secDraft(editSource && editSource.site,   TASKS.site),
    garden: secDraft(editSource && editSource.garden, TASKS.garden, {
      notes: String(g(editSource && editSource.garden, 'notes', ''))
    }),
    house: secDraft(editSource && editSource.house, TASKS.house),
    generalNotes: String(g(editSource, 'generalNotes', ''))
  };

  const curSite = () => sites.find((s) => s.id === draft.siteId);
  const refVolume = () =>
    (curSite() && curSite().volume) ||
    (editSource && editSource.pool && editSource.pool.volume) || 0;

  const volLabel = () => {
    const v = refVolume();
    if (!v) return 'não calculada';
    const s = curSite();
    return fmt0.format(v) + ' L' + (s && s.volumeSource === 'manual' ? ' • informada' : '');
  };

  const quickChips = (s) => !s ? '' : [
    `<span>${icon('user')}${esc(s.ownerName)}</span>`,
    s.phone  ? `<span>${icon('phone')}${esc(s.phone)}</span>` : '',
    s.volume ? `<span>${icon('droplet')}${fmt0.format(s.volume)} L${s.volumeSource === 'manual' ? ' •' : ''}</span>` : ''
  ].filter(Boolean).join('');

  /* ---- Cards clicáveis de tarefa (fixas + personalizadas) ---- */
  const taskCards = (sec) => {
    const all = TASKS[sec].map(([k, lbl]) => ({ id: k, label: lbl }))
      .concat(draft.customTasks[sec]);
    return `
      <div class="task-grid">
        ${all.map((t) => `
          <button type="button" class="task-card ${draft[sec].tasks[t.id] ? 'on' : ''}" data-task="${sec}" data-key="${esc(t.id)}">
            <span class="tc-check">${icon('check')}</span><span>${esc(t.label)}</span>
          </button>`).join('')}
      </div>
      <button type="button" class="add-task" data-addtask="${sec}">${icon('plus')} Adicionar nova tarefa</button>`;
  };
  const tasksBlock = (sec) => `<div data-tasks="${sec}">${taskCards(sec)}</div>`;

  function bindTaskCards(){
    $$('.task-card').forEach((b) => b.onclick = () => {
      const sec = b.dataset.task, key = b.dataset.key;
      draft[sec].tasks[key] = !draft[sec].tasks[key];
      b.classList.toggle('on', draft[sec].tasks[key]);
    });
    $$('[data-addtask]').forEach((b) => b.onclick = () => {
      const sec = b.dataset.addtask;
      const label = (window.prompt('Nova tarefa para "' + labelSec(sec) + '":') || '').trim();
      if (!label) return;
      const id = 'ct-' + uid().slice(0, 8);
      draft.customTasks[sec].push({ id, label });
      draft[sec].tasks[id] = false;
      renderTasks(sec);
      toast('Tarefa "' + label + '" adicionada a ' + labelSec(sec) + '.');
    });
  }
  function renderTasks(sec){
    const host = $(`[data-tasks="${sec}"]`);
    if (host) host.innerHTML = taskCards(sec);
    bindTaskCards();
  }

  const photoSlot = (sec, kind, label) => `
    <div class="photo-slot" data-sec="${sec}" data-kind="${kind}">
      <div class="photo-head">
        <span>${label}</span>
        <button type="button" class="btn small ghost cam">${icon('camera')} ${kind === 'before' ? 'Foto Antes' : 'Foto Depois'}</button>
      </div>
      <div class="thumbs" data-thumbs></div>
      <input type="file" accept="image/*" multiple hidden data-file>
      <span class="hint">Câmera ou galeria • comprimida automaticamente</span>
    </div>`;

  const poolBody = () => `
    <div class="vol-line">${icon('droplet')}<span>Litragem do sítio: <strong id="volChip">${volLabel()}</strong></span></div>
    <div class="grid2">
      <label class="field"><span>pH</span><input type="number" step="0.1" min="0" max="14" inputmode="decimal" data-meas="ph" value="${esc(draft.pool.ph)}" placeholder="7,4"></label>
      <label class="field"><span>Cloro (ppm)</span><input type="number" step="0.1" min="0" inputmode="decimal" data-meas="cloro" value="${esc(draft.pool.cloro)}" placeholder="1,5"></label>
      <label class="field"><span>Alcalinidade (ppm)</span><input type="number" step="1" min="0" inputmode="numeric" data-meas="alcal" value="${esc(draft.pool.alcal)}" placeholder="100"></label>
      <label class="field"><span>Dureza Cálcica (ppm)</span><input type="number" step="10" min="0" inputmode="numeric" data-meas="dureza" value="${esc(draft.pool.dureza)}" placeholder="250"></label>
    </div>
    <div class="ref-chips"><span>pH 7,2–7,6</span><span>Cloro 1,0–3,0</span><span>Alc. 80–120</span><span>Dureza 200–400</span></div>
    <div id="recBox"></div>
    <span class="field-lbl">Tarefas Executadas</span>
    ${tasksBlock('pool')}
    <div class="photo-row">${photoSlot('pool', 'before', 'ANTES')}${photoSlot('pool', 'after', 'DEPOIS')}</div>`;

  const siteBody = () => `
    <span class="field-lbl">Tarefas Executadas</span>
    ${tasksBlock('site')}
    <div class="photo-row">${photoSlot('site', 'before', 'ANTES')}${photoSlot('site', 'after', 'DEPOIS')}</div>`;

  const gardenBody = () => `
    <span class="field-lbl">Áreas Roçadas</span>
    ${tasksBlock('garden')}
    <label class="field"><span>Observações da Roçada</span>
      <textarea id="gardenNotes" rows="2" placeholder="Ex.: mato alto próximo ao pomar…">${esc(draft.garden.notes)}</textarea></label>
    <div class="photo-row">${photoSlot('garden', 'before', 'ANTES')}${photoSlot('garden', 'after', 'DEPOIS')}</div>`;

  const houseBody = () => `
    <span class="field-lbl">Ambientes / Tarefas da Casa</span>
    ${tasksBlock('house')}
    <div class="photo-row">${photoSlot('house', 'before', 'ANTES')}${photoSlot('house', 'after', 'DEPOIS')}</div>`;

  const secCard = (key, letter, accent, title, sub, body) => `
    <section class="card sec ${draft[key].active ? 'on' : 'off'}" data-sec-card="${key}">
      <header class="sec-head">
        <span class="sec-ic ${accent}">${letter}</span>
        <div><strong>${title}</strong><em>${sub}</em></div>
        <label class="switch"><input type="checkbox" data-toggle="${key}" ${draft[key].active ? 'checked' : ''}><span></span></label>
      </header>
      <div class="sec-body">${body}</div>
    </section>`;

  const guestBoxHTML = () => `
    <div class="card form" id="guestCard">
      <div class="grid2">
        <label class="field" style="grid-column:1/-1"><span>Nome do hóspede contratante *</span>
          <input id="gName" value="${esc(draft.guest.name)}" placeholder="Ex.: João Pereira"></label>
        <label class="field"><span>WhatsApp</span>
          <input id="gWpp" inputmode="tel" value="${esc(draft.guest.whatsapp)}" placeholder="(31) 99999-0000"></label>
        <label class="field"><span>Qtd pessoas</span>
          <input id="gPeople" type="number" min="1" inputmode="numeric" value="${esc(draft.guest.people)}" placeholder="4"></label>
        <label class="field"><span>Check-in</span>
          <input id="gIn" type="date" value="${esc(draft.guest.checkin)}"></label>
        <label class="field"><span>Check-out</span>
          <input id="gOut" type="date" value="${esc(draft.guest.checkout)}"></label>
      </div>
      <span class="field-lbl">Situação da Piscina</span>
      <div class="tag-row">
        <button type="button" class="tag-toggle ${draft.guest.entered ? 'on' : ''}" data-gtag="entered">${icon('droplet')} Entrou na piscina</button>
        <button type="button" class="tag-toggle warn ${draft.guest.left ? 'on' : ''}" data-gtag="left">${icon('alert')} Saiu — precisa choque</button>
      </div>
    </div>`;

  App.el.innerHTML = topbar(
    editSource ? 'Editar Relatório' : 'Nova Vistoria',
    editSource ? '#/relatorio/' + editSource.id : '#/'
  ) + `
  <main class="view container">
    <div class="mode-tabs">
      <button type="button" class="mode-tab ${draft.mode !== 'hospedes' ? 'on' : ''}" data-mode="manutencao">${icon('clipboard')} Manutenção</button>
      <button type="button" class="mode-tab ${draft.mode === 'hospedes' ? 'on' : ''}" data-mode="hospedes">${icon('user')} Hóspedes</button>
    </div>
    <div id="guestWrap" style="display:${draft.mode === 'hospedes' ? 'block' : 'none'}">${guestBoxHTML()}</div>

    <div class="card form">
      <label class="field"><span>Sítio / Cliente</span>
        <select id="selSite"></select>
      </label>
      <button type="button" class="btn ghost block" id="addClient" style="margin-top:10px">${icon('plus')} Cadastrar Novo Cliente</button>
      <div class="meta-row" style="margin-top:12px">
        <label class="field" style="max-width:180px"><span>Data da Vistoria</span><input type="date" id="inspDate" value="${draft.dateISO}" max="${hojeISO()}"></label>
        <div class="site-quick" id="siteQuick">${quickChips(curSite())}</div>
      </div>
    </div>

    ${secCard('pool', 'A', 'a', 'Parâmetros da Piscina', 'pH, cloro, alcalinidade, dureza e fotos', poolBody())}
    ${secCard('site', 'B', 'b', 'Limpeza do Sítio', 'Churrasqueira, varandas, banheiros e lixo', siteBody())}
    ${secCard('garden', 'C', 'c', 'Roçada e Jardinagem', 'Áreas roçadas e observações', gardenBody())}
    ${secCard('house', 'D', 'd', 'Casa Sede', 'Limpeza da casa: ambientes e fotos', houseBody())}

    <div class="card form">
      <label class="field"><span>Observações Gerais da Visita</span>
        <textarea id="genNotes" rows="2" placeholder="Algo mais para registrar?">${esc(draft.generalNotes)}</textarea></label>
    </div>

    <button class="btn primary block big" id="finish">${icon('check')} ${editSource ? 'Salvar Alterações e Regenerar PDF' : 'Finalizar e Gerar Relatório'}</button>
  </main>`;

  function rebuildSelect(){
    const sel = $('#selSite');
    sel.innerHTML =
      sites.map((s) => `<option value="${s.id}" ${s.id === draft.siteId ? 'selected' : ''}>${esc(s.siteName)} — ${esc(s.ownerName)}</option>`).join('') +
      (!sites.some((s) => s.id === draft.siteId)
        ? `<option value="${esc(draft.siteId)}" selected>Sítio do relatório original</option>` : '');
  }
  rebuildSelect();

  function renderRecs(){
    const box = $('#recBox');
    if (!box) return;
    const recs = computeRecs(refVolume(), draft.pool.cloro, draft.pool.ph, draft.pool.dureza);
    const touched = ['cloro','ph','alcal','dureza'].some((k) => draft.pool[k] !== '');
    if (!refVolume() && touched){
      box.innerHTML = `<div class="alert warn">${icon('alert')}<span>Cadastre a litragem do sítio (dimensões ou valor informado) para calcular a dosagem.</span></div>`;
    } else if (recs.length){
      box.innerHTML = `<div class="alert warn"><ul>${recs.map((r) => `<li>${icon('droplet')}<span>${esc(r.text)}</span></li>`).join('')}</ul></div>`;
    } else if (touched){
      box.innerHTML = `<div class="alert ok">${icon('check')}<span>Parâmetros dentro da faixa ideal. Nenhuma dosagem necessária.</span></div>`;
    } else {
      box.innerHTML = '';
    }
  }

  function refreshSiteInfo(){
    const vc = $('#volChip'); if (vc) vc.textContent = volLabel();
    const sq = $('#siteQuick'); if (sq) sq.innerHTML = quickChips(curSite());
  }

  function renderThumbs(slot, sec, kind){
    const wrapEl = slot.querySelector('[data-thumbs]');
    wrapEl.innerHTML = draft[sec].photos[kind].map((d, i) => `
      <figure class="thumb">
        <img src="${d}" alt="">
        <button type="button" class="rm" data-i="${i}">${icon('x')}</button>
      </figure>`).join('');
    $$('.rm', wrapEl).forEach((b) => b.onclick = () => {
      draft[sec].photos[kind].splice(+b.dataset.i, 1);
      renderThumbs(slot, sec, kind);
    });
  }

  /* ---- Bindings ---- */
  $('#selSite').onchange = (e) => { draft.siteId = e.target.value; refreshSiteInfo(); renderRecs(); };

  $('#addClient').onclick = () => openClientModal((rec) => {
    sites.push(rec);
    draft.siteId = rec.id;
    rebuildSelect();
    refreshSiteInfo();
    renderRecs();
    toast('Cliente cadastrado e selecionado.');
  });

  $('#inspDate').onchange = (e) => { draft.dateISO = e.target.value; };

  /* v14: alternância Manutenção/Hóspedes */
  $$('[data-mode]').forEach((b) => b.onclick = () => {
    draft.mode = b.dataset.mode;
    $$('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
    $('#guestWrap').style.display = draft.mode === 'hospedes' ? 'block' : 'none';
    bindGuest();
  });

  /* v14: campos e tags do hóspede */
  function bindGuest(){
    const name = $('#gName');   if (name) name.oninput = (e) => draft.guest.name = e.target.value;
    const wpp  = $('#gWpp');    if (wpp)  wpp.oninput  = (e) => draft.guest.whatsapp = e.target.value;
    const ppl  = $('#gPeople'); if (ppl)  ppl.oninput  = (e) => draft.guest.people = e.target.value;
    const gi   = $('#gIn');     if (gi)   gi.onchange  = (e) => draft.guest.checkin = e.target.value;
    const go   = $('#gOut');    if (go)   go.onchange  = (e) => draft.guest.checkout = e.target.value;
    $$('[data-gtag]').forEach((tg) => tg.onclick = () => {
      const k = tg.dataset.gtag;
      draft.guest[k] = !draft.guest[k];
      tg.classList.toggle('on', draft.guest[k]);
      if (k === 'left' && draft.guest.left){
        toast('Saída marcada: parâmetros da piscina e Casa Sede serão exigidos.', 'warn', 4200);
      }
    });
  }
  bindGuest();

  $$('[data-toggle]').forEach((sw) => sw.onchange = (e) => {
    const key = e.target.dataset.toggle;
    draft[key].active = e.target.checked;
    const card = $(`[data-sec-card="${key}"]`);
    card.classList.toggle('off', !e.target.checked);
    card.classList.toggle('on', e.target.checked);
  });

  $$('[data-meas]').forEach((i) => i.oninput = (e) => {
    draft.pool[e.target.dataset.meas] = e.target.value;
    renderRecs();
  });

  $('#gardenNotes').addEventListener('input', (e) => { draft.garden.notes = e.target.value; });
  $('#genNotes').addEventListener('input', (e) => { draft.generalNotes = e.target.value; });

  $$('.cam').forEach((b) => b.onclick = () =>
    b.closest('.photo-slot').querySelector('[data-file]').click());

  $$('[data-file]').forEach((inp) => inp.onchange = async (e) => {
    const slot = inp.closest('.photo-slot');
    const sec = slot.dataset.sec, kind = slot.dataset.kind;
    const files = [...inp.files];
    inp.value = '';
    for (const file of files){
      if (draft[sec].photos[kind].length >= MAX_PHOTOS){
        toast(`Máximo de ${MAX_PHOTOS} fotos por campo.`, 'warn');
        break;
      }
      try {
        draft[sec].photos[kind].push(await compressImage(file)); /* 1 por vez */
        renderThumbs(slot, sec, kind);
      } catch (_){
        toast('Não foi possível processar esta imagem. Tente pela galeria.', 'warn', 3600);
      }
    }
  });

  $('#finish').onclick = finalizar;
  refreshSiteInfo();
  renderRecs();
  bindTaskCards();
  $$('.photo-slot').forEach((slot) =>
    renderThumbs(slot, slot.dataset.sec, slot.dataset.kind));

  const finishHTML = $('#finish').innerHTML;

  async function finalizar(){
    if (!draft.siteId) return toast('Selecione o sítio.', 'warn');

    /* v14: hóspede marcou SAÍDA → exigências obrigatórias */
    if (draft.mode === 'hospedes' && draft.guest.left){
      const faltando = [];
      if (!draft.guest.name.trim()) faltando.push('nome do hóspede contratante');
      if (!draft.pool.active) faltando.push('seção Parâmetros da Piscina ativa');
      [['ph','pH'],['cloro','Cloro'],['alcal','Alcalinidade'],['dureza','Dureza Cálcica']]
        .forEach(([k, lbl]) => { if (String(draft.pool[k]).trim() === '') faltando.push(lbl); });
      if (!draft.house.active) faltando.push('seção Casa Sede ativa');
      if (faltando.length){
        return toast('Hóspede marcou SAÍDA — complete antes de concluir: ' + faltando.join(', ') + '.', 'warn', 6500);
      }
    } else if (draft.mode === 'hospedes' && !draft.guest.name.trim()){
      const temDado = draft.guest.whatsapp || draft.guest.people || draft.guest.checkin || draft.guest.checkout || draft.guest.entered;
      if (temDado) return toast('Informe o nome do hóspede contratante.', 'warn');
    }

    const active = SECS.filter((k) => draft[k].active);
    if (!active.length) return toast('Ative pelo menos uma seção da vistoria.', 'warn');

    const s0 = curSite();
    const site = s0 || {
      id: draft.siteId,
      siteName: g(editSource, 'siteName', 'Sítio'),
      ownerName: g(editSource, 'ownerName', ''),
      phone: '', address: '',
      volume: g(editSource && editSource.pool, 'volume', 0)
    };
    const vol = site.volume || 0;

    const btn = $('#finish');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Salvando…';

    try {
      const report = editSource
        ? { ...editSource }
        : { id: uid(), code: String(Date.now()).slice(-6), createdAt: Date.now() };

      Object.assign(report, {
        siteId: site.id,
        siteName: site.siteName,
        ownerName: site.ownerName,
        dateISO: draft.dateISO + 'T' + new Date().toTimeString().slice(0, 5),
        sections: active,
        mode: draft.mode,
        guest: draft.mode === 'hospedes' ? draft.guest : null,
        customTasks: draft.customTasks,
        pool: Object.assign({}, draft.pool, {
          volume: vol,
          recs: computeRecs(vol, draft.pool.cloro, draft.pool.ph, draft.pool.dureza)
        }),
        site: draft.site,
        garden: draft.garden,
        house: draft.house,
        generalNotes: draft.generalNotes,
        synced: false
      });
      if (editSource) report.editedAt = Date.now();
      delete report.pdfBase64;

      await DB.put('reports', report); /* 1/2: relatório salvo antes do PDF */

      let pdfOk = true;
      try {
        btn.innerHTML = '<span class="spin"></span> Gerando PDF…';
        const blob = await ReportPDF.build(report, site, settings);
        report.pdfBase64 = await blobToB64(blob);
        await DB.put('reports', report); /* 2/2: PDF persistido */
      } catch (err){
        pdfOk = false;
        console.error('Falha na geração do PDF:', err);
      }

      toast(pdfOk ? 'Relatório salvo com PDF.' : 'Relatório salvo. Gere o PDF na tela dele.', pdfOk ? 'ok' : 'warn', 3600);
      location.hash = '#/relatorio/' + report.id;
    } catch (err){
      console.error(err);
      toast('Erro ao salvar: ' + ((err && err.message) || 'desconhecido'), 'warn', 4200);
      btn.disabled = false;
      btn.innerHTML = finishHTML;
    }
  }
};

/* ---------- 12.5 HISTÓRICO ---------- */
Views.history = async () => {
  const reports = (await DB.all('reports')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  App.el.innerHTML = topbar('Histórico de Relatórios', '#/') + `
  <main class="view container">
    <div class="list">
      ${reports.length ? reports.map((r) => `
        <div class="item rep" data-id="${r.id}">
          <span class="item-ic">${icon('file')}</span>
          <div class="item-tx">
            <strong>${esc(r.siteName || 'Relatório')}</strong>
            <span>${fmtDateBR(r.dateISO)} • ${(r.sections || []).map(labelSec).join(' + ')}${r.editedAt ? ' • editado' : ''}${r.mode === 'hospedes' ? ' • hóspedes' : ''}</span>
          </div>
          <span class="sync-dot ${r.synced ? 'ok' : 'pend'}" title="${r.synced ? 'Sincronizado' : 'Pendente'}"></span>
          <button class="del" aria-label="Excluir">${icon('trash')}</button>
        </div>`).join('')
      : emptyState('file', 'Nenhuma vistoria registrada', 'Os relatórios gerados aparecem aqui — mesmo sem internet.')}
    </div>
  </main>`;

  $$('.item.rep').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('.del')) return;
      location.hash = '#/relatorio/' + el.dataset.id;
    };
  });
  $$('.item.rep .del').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    const id = b.closest('.item').dataset.id;
    if (await confirmDlg({ title: 'Excluir relatório?', text: 'O PDF e os registros desta visita serão apagados.', okLabel: 'Excluir', danger: true })){
      await DB.del('reports', id);
      toast('Relatório excluído.');
      Views.history();
    }
  });
};

/* ---------- 12.6 RELATÓRIO GERADO ---------- */
async function ensurePdf(r){
  if (r.pdfBase64) return b64ToBlob(r.pdfBase64);
  const site = (await DB.get('sites', r.siteId)) || {
    siteName: r.siteName, ownerName: r.ownerName,
    volume: g(r.pool, 'volume', 0)
  };
  const st = await getSettings();
  const blob = await ReportPDF.build(r, site, st);
  r.pdfBase64 = await blobToB64(blob);
  await DB.put('reports', r);
  return blob;
}

const pdfFileName = (r) => {
  const safe = String(r.siteName || 'relatorio').replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `NEGRETS-MASTER_${safe}_${String(r.dateISO).slice(0, 10)}.pdf`;
};

/* WEB SHARE API — envia o PDF direto ao WhatsApp do cliente */
async function shareReport(r){
  try {
    const blob = await ensurePdf(r);
    const file = new File([blob], pdfFileName(r), { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({
        files: [file],
        title: 'Relatório ' + (r.siteName || ''),
        text: 'Segue o relatório de serviços.'
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = pdfFileName(r); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('Compartilhamento nativo indisponível — PDF baixado.', 'info');
    }
  } catch (e){
    if (e && e.name !== 'AbortError') toast('Não foi possível compartilhar.', 'warn');
  }
}

Views.reportView = async ({ id }) => {
  const r = await DB.get('reports', id);
  if (!r){ location.hash = '#/historico'; return; }

  const photoCount = ['pool', 'site', 'garden', 'house']
    .filter((k) => r[k] && r[k].active)
    .reduce((acc, k) =>
      acc + g(r[k].photos, 'before', []).length + g(r[k].photos, 'after', []).length, 0);

  /* Lista combinada (fixas + personalizadas) marcadas como feitas */
  const doneList = (sec) =>
    ReportPDF.combinedList(sec, r[sec] || {}, r.customTasks || {})
      .filter(([, on]) => on).map(([lbl]) => lbl);

  const rows = [];
  if (r.guest && r.guest.name){
    rows.push(['Hóspede contratante', r.guest.name +
      (r.guest.people ? ' • ' + r.guest.people + ' pessoa(s)' : '')]);
    const per = [r.guest.checkin, r.guest.checkout].filter(Boolean).map(fmtDateBR).join(' → ');
    if (per) rows.push(['Período', per]);
    const sit = [r.guest.entered && 'Entrou na piscina', r.guest.left && 'Saiu — precisa choque']
      .filter(Boolean).join(' • ');
    if (sit) rows.push(['Situação da piscina', sit]);
  }
  if (r.pool && r.pool.active){
    rows.push(['pH / Cloro / Alc. / Dureza',
      [r.pool.ph || '—', r.pool.cloro || '—', r.pool.alcal || '—', r.pool.dureza || '—'].join('  /  ')]);
    const done = doneList('pool');
    rows.push(['Tarefas da piscina', done.length ? done.join(', ') : '—']);
  }
  if (r.site && r.site.active){
    const done = doneList('site');
    rows.push(['Limpeza do sítio', done.length ? done.join(', ') : '—']);
  }
  if (r.garden && r.garden.active){
    const done = doneList('garden');
    rows.push(['Roçada', done.length ? done.join(', ') : '—']);
  }
  if (r.house && r.house.active){
    const done = doneList('house');
    rows.push(['Casa Sede', done.length ? done.join(', ') : '—']);
  }

  App.el.innerHTML = topbar('Relatório Nº ' + (r.code || '—'), '#/historico') + `
  <main class="view container">
    ${!r.pdfBase64 ? `
    <div class="alert warn">${icon('alert')}<span>PDF ainda não gerado para este relatório.</span>
      <button class="btn small primary" id="genPdfBtn">Gerar agora</button></div>` : ''}

    <section class="card done-card">
      <span class="done-check">${checkSVG}</span>
      <h2>Relatório pronto!</h2>
      <p>${esc(r.siteName || '')} • ${fmtDateBR(r.dateISO)}${r.editedAt ? ' • <b>editado</b>' : ''}${r.mode === 'hospedes' ? ' • <b>hóspedes</b>' : ''}</p>
      <div class="chips">${(r.sections || []).map((k) => `<span>${labelSec(k)}</span>`).join('')}</div>
    </section>

    <button class="btn primary block big" id="shareBtn">${icon('share')} Compartilhar PDF (WhatsApp)</button>
    <div class="row2">
      <button class="btn ghost block" id="openBtn">${icon('file')} Visualizar</button>
      <button class="btn ghost block" id="downBtn">${icon('download')} Baixar</button>
    </div>
    <button class="btn ghost block" id="editBtn">${icon('edit')} Editar Relatório</button>
    <button class="btn ghost block" id="againBtn">${icon('plus')} Nova Vistoria</button>

    <section class="card sum">
      <h3>RESUMO DA VISITA</h3>
      ${rows.map(([k, v]) => `<div class="sum-row"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}
      <div class="sum-row"><span>Fotos anexadas</span><b>${photoCount}</b></div>
      ${r.generalNotes ? `<p class="hint">${esc(r.generalNotes)}</p>` : ''}
    </section>
  </main>`;

  const busy = async (btn, fn) => {
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Aguarde…';
    try { await fn(); }
    catch (e){
      console.error(e);
      toast('Falha no PDF: ' + ((e && e.message) || 'erro'), 'warn', 4000);
    }
    btn.disabled = false;
    btn.innerHTML = old;
  };

  $('#shareBtn').onclick = (e) => busy(e.currentTarget, () => shareReport(r));

  $('#openBtn').onclick = (e) => busy(e.currentTarget, async () => {
    const url = URL.createObjectURL(await ensurePdf(r));
    const w = window.open(url, '_blank');
    if (!w){
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.click();
    }
  });

  $('#downBtn').onclick = (e) => busy(e.currentTarget, async () => {
    const blob = await ensurePdf(r);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = pdfFileName(r); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  $('#editBtn').onclick  = () => location.hash = '#/editar/' + r.id;
  $('#againBtn').onclick = () => location.hash = '#/vistoria';

  const gp = $('#genPdfBtn');
  if (gp) gp.onclick = (e) => busy(e.currentTarget, async () => {
    await ensurePdf(r);
    toast('PDF gerado e salvo.');
    Views.reportView({ id: r.id });
  });
};

/* ---------- 12.7 AJUSTES + DIAGNÓSTICO PWA ---------- */

/* Força atualização dos ARQUIVOS preservando os DADOS:
   apaga Cache Storage, desregistra SWs e recarrega.
   IndexedDB (clientes/relatórios) fica intacto. */
async function forceFileRefresh(){
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch (_) {}
  location.href = location.pathname + '?v=' + Date.now() + '#/';
}

async function runPwaDiagnostics(){
  const rows = [];
  const push = (st, txt) => rows.push({ st, txt });

  if (!('serviceWorker' in navigator)){
    push('fail', 'Este navegador não suporta Service Worker.');
    return rows;
  }

  /* SW registrado? Se não, registra AGORA e mostra o erro real */
  let reg = null;
  try { reg = await navigator.serviceWorker.getRegistration(); } catch (_) {}
  if (!reg){
    try {
      reg = await navigator.serviceWorker.register('./sw.js');
      push('ok', 'Service Worker registrado com sucesso agora.');
    } catch (e){
      push('fail', 'Registro do sw.js FALHOU: ' + ((e && e.message) || e));
      push('fail', '→ Abra https://negrete79.github.io/sw.js no navegador. Se der 404, o arquivo não está na RAIZ.');
    }
  } else {
    push(reg.active ? 'ok' : 'warn',
      reg.active ? 'Service Worker ativo (base do offline).'
                 : 'Service Worker instalando… toque em Verificar novamente em alguns segundos.');
  }

  push(navigator.serviceWorker.controller ? 'ok' : 'warn',
    navigator.serviceWorker.controller
      ? 'Página sob controle do SW — offline garantido.'
      : 'Página ainda não controlada: use "Forçar atualização" ou feche/abra o app (só na 1ª vez).');

  /* sw.js é servido e parece válido? */
  try {
    const r3 = await fetch('sw.js', { cache: 'no-store' });
    if (!r3.ok){
      push('fail', 'sw.js não encontrado no servidor (HTTP ' + r3.status + ').');
    } else {
      const t = await r3.text();
      push(t.includes('addEventListener') ? 'ok' : 'warn',
        'sw.js servido (' + t.length + ' bytes)' + (t.includes('addEventListener') ? '.' : ' — conteúdo suspeito.'));
    }
  } catch (_){ push('fail', 'sw.js inacessível.'); }

  /* manifest + ícones */
  try {
    const res = await fetch('manifest.json', { cache: 'no-store' });
    if (!res.ok){
      push('fail', 'manifest.json não encontrado (HTTP ' + res.status + ').');
    } else {
      const man = await res.json();
      push('ok', 'Manifest OK — “' + (man.name || man.short_name || '?') + '”.');
      const icons = Array.isArray(man.icons) ? man.icons : [];
      if (!icons.length) push('fail', 'O manifest não declara ícones.');
      for (const ic of icons){
        if (String(ic.src).startsWith('data:')){
          push('ok', 'Ícone embutido no manifest (impossível dar 404).');
          continue;
        }
        try {
          const r2 = await fetch(ic.src, { cache: 'no-store' });
          push(r2.ok ? 'ok' : 'fail',
            (r2.ok ? 'Ícone OK: ' : 'Ícone FALTANDO (HTTP ' + r2.status + '): ') + ic.src);
        } catch (_){ push('fail', 'Ícone inacessível: ' + ic.src); }
      }
    }
  } catch (e){ push('fail', 'Falha ao ler o manifest: ' + e.message); }

  push(deferredPrompt ? 'ok' : 'warn',
    deferredPrompt
      ? 'INSTALAÇÃO LIBERADA — toque no botão “Instalar na tela inicial”.'
      : 'Chrome ainda não liberou o prompt. Corrija os itens vermelhos, feche o app e abra de novo.');
  return rows;
}

Views.settings = async () => {
  const st = await getSettings();

  App.el.innerHTML = topbar('Ajustes da Empresa', '#/') + `
  <main class="view container">
    <form id="setForm" class="card form">
      <div class="form-sec">
        <h2>Identidade da Empresa</h2>
        <label class="field"><span>Nome da Empresa</span><input name="companyName" value="${esc(st.companyName)}"></label>
        <label class="field"><span>Assinatura / Ramo</span><input name="tagline" value="${esc(st.tagline)}"></label>
        <label class="field"><span>Telefone</span><input name="phone" inputmode="tel" value="${esc(st.phone)}"></label>
        <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(st.email)}"></label>
        <label class="field"><span>Nome do Técnico</span><input name="technician" value="${esc(st.technician)}" placeholder="Aparece na saudação e no PDF"></label>
      </div>
      <button class="btn primary block" type="submit">${icon('check')} Salvar Ajustes</button>
    </form>

    <section class="card form">
      <h2 style="font-size:.74rem;letter-spacing:.12em;color:var(--pool);text-transform:uppercase;font-weight:800">Instalação do Aplicativo</h2>
      <p class="hint">Versão do app: <b>${APP_VERSION}</b> — se este número não mudar após publicar uma versão nova, use “Forçar atualização” abaixo.</p>
      <button class="btn primary block" id="installBtn" hidden>${icon('download')} Instalar na tela inicial</button>
      <p class="hint" id="iosHint" hidden>No iPhone: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>
      <div id="diagList"><p class="hint">Verificando instalação…</p></div>
      <button class="btn ghost block" id="diagAgain">${icon('shield')} Verificar novamente</button>
      <button class="btn ghost block" id="refreshBtn">${icon('refresh')} Forçar atualização dos arquivos (mantém seus dados)</button>
    </section>

    <section class="card form">
      <h2 style="font-size:.74rem;letter-spacing:.12em;color:var(--pool);text-transform:uppercase;font-weight:800">Dados</h2>
      <button class="btn ghost block" id="wipeBtn" style="color:var(--bad)">${icon('trash')} Apagar todos os dados locais</button>
      <p class="hint">Os dados ficam salvos apenas neste aparelho (IndexedDB), com acesso total offline. Fotos são comprimidas para 1280px/JPEG antes de salvar.</p>
    </section>
  </main>`;

  $('#setForm').onsubmit = async (e) => {
    e.preventDefault();
    await saveSettings(Object.fromEntries(new FormData(e.target).entries()));
    toast('Ajustes salvos.');
  };

  /* Botão instalar — com feedback real */
  const ib = $('#installBtn');
  if (deferredPrompt) ib.hidden = false;

  ib.onclick = async () => {
    if (!deferredPrompt){
      toast('Chrome ainda não liberou. Veja o diagnóstico abaixo.', 'warn');
      return;
    }
    try {
      deferredPrompt.prompt();
      const c = await deferredPrompt.userChoice;
      if (c.outcome === 'accepted'){
        toast('Instalando — confirme na tela do Android.', 'ok', 4000);
      } else {
        toast('Instalação cancelada.', 'info');
      }
      deferredPrompt = null;
      ib.hidden = true;
    } catch (e){
      toast('O Chrome recusou o prompt: ' + ((e && e.message) || e), 'warn', 4500);
    }
  };

  if (!deferredPrompt && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream){
    $('#iosHint').hidden = false;
  }

  const diagList = $('#diagList');
  async function renderDiag(){
    diagList.innerHTML = '<p class="hint">Verificando instalação…</p>';
    const rows = await runPwaDiagnostics();
    diagList.innerHTML = rows.map((r) => `
      <div class="sum-row">
        <span style="display:flex;align-items:flex-start;gap:8px;color:${r.st === 'fail' ? '#C0362C' : r.st === 'warn' ? '#8A4B08' : 'inherit'}">
          <i class="sync-dot ${r.st === 'ok' ? 'ok' : 'pend'}" style="${r.st === 'fail' ? 'background:#C0362C' : ''};margin-top:4px"></i>${esc(r.txt)}
        </span>
      </div>`).join('');
    if (deferredPrompt) ib.hidden = false;
  }
  renderDiag();
  $('#diagAgain').onclick  = renderDiag;
  $('#refreshBtn').onclick = async () => {
    if (await confirmDlg({
      title: 'Atualizar arquivos do app?',
      text: 'Limpa o cache de arquivos e recarrega o app. Seus clientes, relatórios e ajustes NÃO são apagados.',
      okLabel: 'Atualizar'
    })){
      await forceFileRefresh();
    }
  };

  $('#wipeBtn').onclick = async () => {
    if (!await confirmDlg({ title: 'Apagar todos os dados?', text: 'Sítios, relatórios e ajustes deste aparelho serão removidos definitivamente.', okLabel: 'Apagar tudo', danger: true })) return;
    await Promise.all([DB.clear('sites'), DB.clear('reports'), DB.clear('settings')]);
    toast('Dados apagados.');
    location.hash = '#/';
  };
};

/* =========================================================
   13. MIGRAÇÃO — normaliza relatórios/sítios antigos
   Garante que todo relatório tenha: house, customTasks,
   mode, guest, photos, tasks, sections e dureza no formato
   atual. Assim nenhuma tela quebra, independente da idade
   do dado gravado.
   ========================================================= */
async function normalizeReports(){
  const reports = await DB.all('reports');
  for (const r of reports){
    let changed = false;

    const fixSec = (name) => {
      if (!r[name] || typeof r[name] !== 'object'){
        r[name] = { active: false, tasks: {}, photos: { before: [], after: [] } };
        changed = true;
        return;
      }
      if (!r[name].tasks || typeof r[name].tasks !== 'object'){ r[name].tasks = {}; changed = true; }
      if (!r[name].photos || typeof r[name].photos !== 'object'){
        r[name].photos = { before: [], after: [] }; changed = true;
      } else {
        if (!Array.isArray(r[name].photos.before)){ r[name].photos.before = []; changed = true; }
        if (!Array.isArray(r[name].photos.after)){  r[name].photos.after  = []; changed = true; }
      }
    };
    fixSec('pool'); fixSec('site'); fixSec('garden');
    fixSec('house'); /* v14 */

    if (r.pool && typeof r.pool.dureza === 'undefined'){ r.pool.dureza = ''; changed = true; }
    if (!Array.isArray(r.sections)){
      r.sections = ['pool', 'site', 'garden', 'house'].filter((k) => r[k] && r[k].active);
      changed = true;
    }
    if (!r.customTasks || typeof r.customTasks !== 'object'){
      r.customTasks = { pool: [], site: [], garden: [], house: [] }; changed = true;
    }
    if (typeof r.mode === 'undefined'){ r.mode = 'manutencao'; changed = true; }
    if (typeof r.guest === 'undefined'){ r.guest = null; changed = true; }

    if (r.pdfBlob){ delete r.pdfBlob; } /* formato muito antigo */
    if (changed) await DB.put('reports', r);
  }

  /* Sítios antigos ganham os campos de litragem manual */
  const sites = await DB.all('sites');
  for (const s of sites){
    let ch = false;
    if (typeof s.manualVolume === 'undefined'){ s.manualVolume = ''; ch = true; }
    if (typeof s.volumeSource === 'undefined'){ s.volumeSource = 'calc'; ch = true; }
    if (ch) await DB.put('sites', s);
  }
}

/* =========================================================
   14. BOOT
   (O Service Worker é registrado no index.html — sem duplicar.)
   ========================================================= */
async function init(){
  console.log('[NEGRET\'S] App v' + APP_VERSION);
  App.el = $('#app');

  /* Ícones da barra de navegação (index.html usa data-ic) */
  $$('[data-ic]').forEach((el) => { el.outerHTML = icon(el.dataset.ic); });

  await DB.open();
  await normalizeReports();
  App.render();
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
window.addEventListener('appinstalled', () => toast('NEGRET&rsquo;S MASTER instalado!'));
document.addEventListener('DOMContentLoaded', init);
