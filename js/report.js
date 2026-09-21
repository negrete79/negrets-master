/* =========================================================
   report.js — Compila a vistoria em um PDF A4 timbrado:
   cabeçalho da empresa, parâmetros + status, recomendações,
   checklists, fotos Antes/Depois, observações e assinaturas.
   ========================================================= */
const ReportPDF = (() => {
  'use strict';
  const { Doc, rgb, wrap, textWidth } = MiniPDF;

  const NAVY=rgb('#0B2A4A'), POOL=rgb('#1B87D6'), INK=rgb('#12263A'), MUT=rgb('#5B7083'),
        LINE=rgb('#DCE6EF'), BG=rgb('#F2F7FB'), OK=rgb('#188A52'), OKBG=rgb('#E7F5EC'),
        WARN=rgb('#B45309'), WARNBG=rgb('#FDF3E3'), WHITE=rgb('#FFFFFF'),
        SKY=rgb('#BFD9EE'), GRAYBG=rgb('#EEF3F8'), STEEL=rgb('#9FB3C8'),
        DEPC=rgb('#E3F2FC'), DEPT=rgb('#0E5E9C');

  const M = 46, W = 595.28, H = 841.89, CW = W - 2 * M;
  const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const fmtL = (v) => fmt0.format(Math.round(v)) + ' L';
  const PT = { fibra:'Fibra', vinil:'Vinil', alvenaria:'Alvenaria' };
  const PS = { retangular:'Retangular', redonda:'Redonda' };

  const TASKS = {
    pool:   [['aspiracao','Aspiração'],['peneira','Peneira'],['escovacao','Escovação de Bordas'],['filtro','Limpeza do Filtro']],
    site:   [['churrasqueira','Área da Churrasqueira Limpa'],['varandas','Varandas Varridas'],['banheiros','Banheiros Externos Higienizados'],['lixo','Recolhimento de Lixo']],
    garden: [['entrada','Entrada Principal'],['piscina','Entorno da Piscina'],['pomar','Pomar / Pombal'],['campo','Campo de Futebol']]
  };

  function ellip(str, size, bold, maxW){
    str = String(str ?? '');
    if (textWidth(str, size, bold) <= maxW) return str;
    let s = str;
    while (s.length > 1 && textWidth(s + '…', size, bold) > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  async function build(report, site, settings){
    site = site || {}; const s = settings || {};
    const d = new Doc();
    let y = 0;

    const dt = new Date(report.dateISO || Date.now());
    const dtLabel = dt.toLocaleDateString('pt-BR') + ' às ' +
                    dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    /* ---------- helpers de fluxo ---------- */
    function ensure(h){ if (y + h > H - 92){ d.newPage(); miniHeader(); y = 78; } }
    function miniHeader(){
      d.rect(0, 0, W, 40, NAVY); d.rect(0, 40, W, 2, POOL);
      d.text(s.companyName || "NEGRET'S MASTER", M, 26, { size: 10, bold: true, color: WHITE });
    }
    function sectionBar(letter, title){
      ensure(58);
      d.roundRect(M, y, CW, 28, 9, { fill: NAVY });
      d.circle(M + 14, y + 14, 8.5, POOL);
      d.text(letter, M + 5, y + 18, { size: 10, bold: true, color: WHITE, align: 'center', width: 18 });
      d.text(title, M + 30, y + 18, { size: 10, bold: true, color: WHITE });
      y += 40;
    }
    function checkbox(x, yy, done){
      d.roundRect(x, yy, 11, 11, 3, done ? { fill: NAVY } : { stroke: STEEL, lineWidth: 1 });
      if (done){
        d.line(x + 2.4, yy + 5.6, x + 4.6, yy + 8,   WHITE, 1.5);
        d.line(x + 4.6, yy + 8,   x + 8.8, yy + 3,   WHITE, 1.5);
      }
    }
    function checklist(items){
      ensure(26 + Math.ceil(items.length / 2) * 20);
      d.text('CHECKLIST EXECUTADO', M, y + 8, { size: 8, bold: true, color: NAVY });
      y += 16;
      const colW = CW / 2;
      items.forEach((it, i) => {
        const cx = M + (i % 2) * colW, cy = y + Math.floor(i / 2) * 20;
        checkbox(cx, cy, it[1]);
        d.text(it[0], cx + 17, cy + 9, { size: 9.5, color: INK });
      });
      y += Math.ceil(items.length / 2) * 20 + 10;
    }
    function statusOf(k, v){
      if (v === '' || v == null || isNaN(parseFloat(v))) return 'none';
      const n = parseFloat(v);
      if (k === 'ph')    return n < 7.2 ? 'low' : (n > 7.6 ? 'high' : 'ok');
      if (k === 'cloro') return n < 1   ? 'low' : (n > 3   ? 'high' : 'ok');
      if (k === 'alcal') return n < 80  ? 'low' : (n > 120 ? 'high' : 'ok');
      return 'none';
    }
    function statusPill(st, x, yy){
      const map = { ok:['IDEAL',OK,OKBG], low:['BAIXO',WARN,WARNBG], high:['ALTO',WARN,WARNBG], none:['—',MUT,GRAYBG] };
      const [lab, c, bg] = map[st] || map.none;
      d.roundRect(x, yy, 58, 15, 7.5, { fill: bg });
      d.text(lab, x, yy + 10.5, { size: 7.5, bold: true, color: c, align: 'center', width: 58 });
    }
    function notesBox(title, txt){
      if (!txt || !String(txt).trim()) return;
      const lines = wrap(txt, 9.5, false, CW - 28);
      ensure(30 + lines.length * 13);
      d.text(title, M, y + 8, { size: 8, bold: true, color: NAVY });
      y += 16;
      d.roundRect(M, y, CW, 10 + lines.length * 13, 9, { fill: BG });
      let ly = y + 18;
      lines.forEach((l) => { d.text(l, M + 14, ly, { size: 9.5, color: INK }); ly += 13; });
      y += 18 + lines.length * 13;
    }
    function frameSlot(x, yy, bw, bh){
      d.cur.ops.push('[3 3] 0 d');
      d.roundRect(x, yy, bw, bh, 8, { stroke: LINE, lineWidth: 1 });
      d.cur.ops.push('[] 0 d');
      d.text('sem registro', x + bw / 2, yy + bh / 2, { size: 8, color: MUT, align: 'center', width: bw });
    }
    function drawPhoto(url, x, yy, bw, bh, cap, capBG, capFG){
      d.roundRect(x - 1, yy - 1, bw + 2, bh + 2, 8, { fill: WHITE, stroke: LINE, lineWidth: 0.8 });
      d.imageFit(url, x, yy, bw, bh);
      const cw2 = textWidth(cap, 7, true) + 14;
      d.roundRect(x + bw / 2 - cw2 / 2, yy + bh + 4, cw2, 13, 6.5, { fill: capBG });
      d.text(cap, x + bw / 2, yy + bh + 13, { size: 7, bold: true, color: capFG, align: 'center', width: cw2 });
    }
    function photosBlock(title, ph){
      const before = (ph && ph.before) || [], after = (ph && ph.after) || [];
      if (!before.length && !after.length) return;
      ensure(30);
      d.text(title, M, y + 8, { size: 8, bold: true, color: NAVY });
      y += 16;
      const gap = 12, bw = (CW - gap) / 2, bh = 138;
      const rows = Math.max(before.length, after.length);
      for (let i = 0; i < rows; i++){
        ensure(bh + 28);
        if (before[i]) drawPhoto(before[i], M, y, bw, bh, 'ANTES', WARNBG, WARN);
        else frameSlot(M, y, bw, bh);
        if (after[i]) drawPhoto(after[i], M + bw + gap, y, bw, bh, 'DEPOIS', DEPC, DEPT);
        else frameSlot(M + bw + gap, y, bw, bh);
        y += bh + 28;
      }
      y += 4;
    }
    function chip(label, x, yy){
      const w = textWidth(label, 8, true) + 16;
      d.roundRect(x, yy - 12, w, 18, 9, { fill: BG });
      d.text(label, x, yy + 1, { size: 8, bold: true, color: NAVY, align: 'center', width: w });
      return x + w;
    }

    /* ============ Página 1 — cabeçalho timbrado ============ */
    d.rect(0, 0, W, 112, NAVY);
    d.rect(0, 112, W, 3, POOL);
    d.text(s.companyName || "NEGRET'S MASTER", M, 46, { size: 19, bold: true, color: WHITE });
    d.text(s.tagline || 'Piscinas & Limpeza de Sítio', M, 64, { size: 9, color: SKY });
    const contact = [s.phone, s.email].filter(Boolean).join('   •   ');
    if (contact) d.text(contact, W - M, 46, { size: 8.5, color: SKY, align: 'right', width: 0 });
    d.text('RELATÓRIO DE SERVIÇO Nº ' + report.code, W - M, 62, { size: 8.5, bold: true, color: WHITE, align: 'right', width: 0 });

    y = 140;
    d.text('VISTORIA & EXECUÇÃO DE SERVIÇOS', M, y, { size: 13.5, bold: true, color: NAVY });
    y += 16;
    d.text(dtLabel, M, y, { size: 9, color: MUT });
    y += 22;
    let cx = M;
    const chips = [];
    if (site.poolType)  chips.push('Piscina: ' + (PT[site.poolType] || site.poolType));
    if (site.poolShape) chips.push('Formato: ' + (PS[site.poolShape] || site.poolShape));
    if (site.volume)    chips.push('Litragem: ' + fmtL(site.volume));
    chips.forEach((t) => { cx = chip(t, cx, y) + 8; });
    y += 30;

    /* ============ Card do cliente ============ */
    d.roundRect(M, y, CW, 84, 12, { fill: BG });
    const col2 = M + CW / 2 + 12, colW = CW / 2 - 28;
    d.text('PROPRIETÁRIO', M + 14, y + 17, { size: 7, bold: true, color: MUT });
    d.text(ellip(report.ownerName, 10, true, colW), M + 14, y + 32, { size: 10, bold: true, color: INK });
    d.text('SÍTIO / EMPREENDIMENTO', col2, y + 17, { size: 7, bold: true, color: MUT });
    d.text(ellip(report.siteName, 10, true, colW), col2, y + 32, { size: 10, bold: true, color: INK });
    d.text('TELEFONE', M + 14, y + 54, { size: 7, bold: true, color: MUT });
    d.text(ellip(site.phone || '—', 9.5, false, colW), M + 14, y + 69, { size: 9.5, color: INK });
    d.text('ENDEREÇO', col2, y + 54, { size: 7, bold: true, color: MUT });
    d.text(ellip(site.address || '—', 9.5, false, colW), col2, y + 69, { size: 9.5, color: INK });
    y += 104;

    /* ============ Seção A — Parâmetros da Piscina ============ */
    if (report.pool && report.pool.active){
      sectionBar('A', 'PARÂMETROS DA PISCINA');
      if (site.volume){ d.text('Volume de referência: ' + fmtL(site.volume), M, y + 6, { size: 8.5, color: MUT }); y += 18; }

      const xP = M + 12, xM = M + 186, xR = M + 292, xS = M + CW - 70;
      ensure(24);
      d.roundRect(M, y, CW, 20, 6, { fill: GRAYBG });
      d.text('PARÂMETRO',  xP, y + 13.5, { size: 7.5, bold: true, color: MUT });
      d.text('MEDIÇÃO',    xM, y + 13.5, { size: 7.5, bold: true, color: MUT });
      d.text('REFERÊNCIA', xR, y + 13.5, { size: 7.5, bold: true, color: MUT });
      d.text('STATUS',     xS, y + 13.5, { size: 7.5, bold: true, color: MUT });
      y += 20;

      [
        ['pH da Água',          report.pool.ph,    '7,2 – 7,6', 'ph'],
        ['Cloro Livre (ppm)',   report.pool.cloro, '1,0 – 3,0', 'cloro'],
        ['Alcalinidade (ppm)',  report.pool.alcal, '80 – 120',  'alcal']
      ].forEach(([nm, val, ref, k]) => {
        ensure(22);
        d.text(nm, xP, y + 14, { size: 9.5, color: INK });
        d.text(val === '' || val == null ? '—' : String(val).replace('.', ','), xM, y + 14, { size: 9.5, bold: true, color: INK });
        d.text(ref, xR, y + 14, { size: 9, color: MUT });
        statusPill(statusOf(k, val), xS, y + 3.5);
        d.line(M, y + 21, W - M, y + 21, LINE, 0.6);
        y += 21;
      });
      y += 6;

      /* Recomendações automáticas de dosagem */
      const recs = report.pool.recs || [];
      const measured = [report.pool.ph, report.pool.cloro, report.pool.alcal]
        .some((v) => v !== '' && v != null && !isNaN(parseFloat(v)));
      if (recs.length){
        const bh2 = 34 + recs.length * 14;
        ensure(bh2 + 8);
        d.roundRect(M, y, CW, bh2, 10, { fill: WARNBG });
        d.text('RECOMENDAÇÃO AUTOMÁTICA DE DOSAGEM', M + 14, y + 17, { size: 8, bold: true, color: WARN });
        let ry = y + 33;
        recs.forEach((r) => {
          d.circle(M + 18, ry - 3, 2.2, WARN);
          d.text(r.text, M + 27, ry, { size: 9.5, color: INK });
          ry += 14;
        });
        y += bh2 + 12;
      } else if (measured){
        ensure(40);
        d.roundRect(M, y, CW, 32, 10, { fill: OKBG });
        d.text('Parâmetros dentro das faixas ideais — nenhuma dosagem necessária.', M + 14, y + 20, { size: 9.5, bold: true, color: OK });
        y += 44;
      }

      checklist(TASKS.pool.map(([k, l]) => [l, !!(report.pool.tasks && report.pool.tasks[k])]));
      photosBlock('REGISTRO FOTOGRÁFICO — PISCINA', report.pool.photos);
      y += 6;
    }

    /* ============ Seção B — Limpeza do Sítio ============ */
    if (report.site && report.site.active){
      sectionBar('B', 'LIMPEZA DO SÍTIO');
      checklist(TASKS.site.map(([k, l]) => [l, !!(report.site.tasks && report.site.tasks[k])]));
      photosBlock('REGISTRO FOTOGRÁFICO — SÍTIO', report.site.photos);
      y += 6;
    }

    /* ============ Seção C — Roçada e Jardinagem ============ */
    if (report.garden && report.garden.active){
      sectionBar('C', 'ROÇADA E JARDINAGEM');
      checklist(TASKS.garden.map(([k, l]) => [l, !!(report.garden.tasks && report.garden.tasks[k])]));
      notesBox('OBSERVAÇÕES DA ROÇADA', report.garden.notes);
      photosBlock('REGISTRO FOTOGRÁFICO — ROÇADA', report.garden.photos);
      y += 6;
    }

    /* ============ Observações gerais + assinaturas ============ */
    notesBox('OBSERVAÇÕES GERAIS', report.generalNotes);
    ensure(96);
    y += 16;
    const sw = 205, sx1 = M + 16, sx2 = W - M - 16 - sw;
    d.line(sx1, y, sx1 + sw, y, MUT, 0.9);
    d.line(sx2, y, sx2 + sw, y, MUT, 0.9);
    d.text('Assinatura do Técnico' + (s.technician ? ' — ' + s.technician : ''), sx1, y + 14, { size: 8, color: MUT, align: 'center', width: sw });
    d.text('Assinatura do Cliente — ' + (report.ownerName || ''), sx2, y + 14, { size: 8, color: MUT, align: 'center', width: sw });
    y += 34;

    /* ============ Rodapé em todas as páginas ============ */
    const saveCur = d.cur;
    d.pages.forEach((pg, i) => {
      d.cur = pg;
      d.line(M, H - 36, W - M, H - 36, LINE, 0.7);
      d.text((s.companyName || "NEGRET'S MASTER") + '  •  ' + dtLabel, M, H - 22, { size: 7.5, color: MUT });
      d.text('Página ' + (i + 1) + ' de ' + d.pages.length, W - M, H - 22, { size: 7.5, color: MUT, align: 'right', width: 0 });
      d.rect(0, H - 5, W, 5, NAVY);
    });
    d.cur = saveCur;

    return d.build();
  }

  return { build, TASKS };
})();
