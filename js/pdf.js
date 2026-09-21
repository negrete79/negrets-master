/* =========================================================
   pdf.js — Mini motor de PDF (JavaScript puro, sem libs).
   Gera um PDF 1.4 válido: Helvetica (WinAnsi → acentos PT-BR),
   retângulos arredondados, círculos, linhas e imagens JPEG
   (Base64 → binário → filtro /DCTDecode). 100% offline.
   Observação: todos os métodos recebem "y" a partir do TOPO.
   ========================================================= */
const MiniPDF = (() => {
  'use strict';

  /* ---- Windows-1252 (acentuação PT-BR) ---- */
  const CP1252 = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};

  function bytesOf(str){
    const out = [];
    for (const ch of String(str)){
      const c = ch.codePointAt(0);
      if (c < 128) out.push(c);
      else if (CP1252[c] !== undefined) out.push(CP1252[c]);
      else if (c < 256) out.push(c);
      else out.push(63); /* “?” p/ fora do cp1252 */
    }
    return Uint8Array.from(out);
  }

  const cat = (...parts) => {
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0; for (const p of parts){ out.set(p, o); o += p.length; }
    return out;
  };

  const n2 = (v) => (Math.round(v * 100) / 100).toString();

  /* Larguras Helvetica /1000 (códigos 32–126) para medição de texto */
  const W_REG=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const W_BOLD=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

  function textWidth(str, size, bold){
    const t = bold ? W_BOLD : W_REG;
    let w = 0;
    for (const ch of String(str)){
      const c = ch.codePointAt(0);
      w += (c >= 32 && c <= 126) ? t[c - 32] : 556;
    }
    return w * size / 1000;
  }

  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  function wrap(str, size, bold, maxW){
    const words = String(str || '').split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    for (const w of words){
      const t = cur ? cur + ' ' + w : w;
      if (textWidth(t, size, bold) <= maxW) cur = t;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* Dimensões do JPEG (varre marcadores SOF0–SOF15) */
  function jpegSize(u8){
    let i = 2;
    while (i + 9 < u8.length){
      if (u8[i] !== 0xFF){ i++; continue; }
      const m = u8[i + 1];
      if ((m >= 0xC0 && m <= 0xCF) && m !== 0xC4 && m !== 0xC8 && m !== 0xCC){
        return { h: (u8[i+5] << 8) | u8[i+6], w: (u8[i+7] << 8) | u8[i+8] };
      }
      const len = (u8[i+2] << 8) | u8[i+3];
      if (len <= 0) return null;
      i += 2 + len;
    }
    return null;
  }

  function rgb(hex){
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255);
  }

  class Doc {
    constructor(){
      this.W = 595.28; this.H = 841.89;      /* A4 em pontos */
      this.pages = []; this.images = []; this._imgN = 0;
      this.newPage();
    }
    newPage(){ this.cur = { ops: [], imgs: [] }; this.pages.push(this.cur); }

    text(str, x, y, o = {}){
      const size = o.size || 11, bold = !!o.bold, c = o.color || [0, 0, 0];
      let px = x;
      if (o.align === 'right' && o.width)  px = x + o.width - textWidth(str, size, bold);
      if (o.align === 'center' && o.width) px = x + (o.width - textWidth(str, size, bold)) / 2;
      this.cur.ops.push(`${c[0]} ${c[1]} ${c[2]} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${n2(px)} ${n2(this.H - y)} Tm (${esc(str)}) Tj ET`);
    }
    rect(x, y, w, h, c){
      this.cur.ops.push(`${c[0]} ${c[1]} ${c[2]} rg ${n2(x)} ${n2(this.H - y - h)} ${n2(w)} ${n2(h)} re f`);
    }
    roundRect(x, y, w, h, r, o = {}){
      const Y = this.H - y - h, k = 0.5523 * r, p = [];
      p.push(`${n2(x+r)} ${n2(Y)} m`);
      p.push(`${n2(x+w-r)} ${n2(Y)} l`);
      p.push(`${n2(x+w-r+k)} ${n2(Y)} ${n2(x+w)} ${n2(Y+r-k)} ${n2(x+w)} ${n2(Y+r)} c`);
      p.push(`${n2(x+w)} ${n2(Y+h-r)} l`);
      p.push(`${n2(x+w)} ${n2(Y+h-r+k)} ${n2(x+w-r)} ${n2(Y+h)} ${n2(x+w-r)} ${n2(Y+h)} c`);
      p.push(`${n2(x+r)} ${n2(Y+h)} l`);
      p.push(`${n2(x+r-k)} ${n2(Y+h)} ${n2(x)} ${n2(Y+h-r+k)} ${n2(x)} ${n2(Y+h-r)} c`);
      p.push(`${n2(x)} ${n2(Y+r)} l`);
      p.push(`${n2(x)} ${n2(Y+r-k)} ${n2(x+r-k)} ${n2(Y)} ${n2(x+r)} ${n2(Y)} c`);
      if (o.fill)   p.push(`${o.fill[0]} ${o.fill[1]} ${o.fill[2]} rg`);
      if (o.stroke) p.push(`${o.stroke[0]} ${o.stroke[1]} ${o.stroke[2]} RG ${o.lineWidth || 1} w`);
      const mode = (o.stroke && o.fill) ? 'B' : o.stroke ? 'S' : 'f';
      this.cur.ops.push(p.join('\n') + ' ' + mode);
    }
    circle(x, y, r, c){ /* y = centro, a partir do topo */
      const Y = this.H - y, k = 0.5523 * r, p = [];
      p.push(`${n2(x+r)} ${n2(Y)} m`);
      p.push(`${n2(x+r)} ${n2(Y+k)} ${n2(x+k)} ${n2(Y+r)} ${n2(x)} ${n2(Y+r)} c`);
      p.push(`${n2(x-k)} ${n2(Y+r)} ${n2(x-r)} ${n2(Y+k)} ${n2(x-r)} ${n2(Y)} c`);
      p.push(`${n2(x-r)} ${n2(Y-k)} ${n2(x-k)} ${n2(Y-r)} ${n2(x)} ${n2(Y-r)} c`);
      p.push(`${n2(x+k)} ${n2(Y-r)} ${n2(x+r)} ${n2(Y-k)} ${n2(x+r)} ${n2(Y)} c`);
      p.push(`${c[0]} ${c[1]} ${c[2]} rg f`);
      this.cur.ops.push(p.join('\n'));
    }
    line(x1, y1, x2, y2, c, w = 1){
      this.cur.ops.push(`${c[0]} ${c[1]} ${c[2]} RG ${w} w ${n2(x1)} ${n2(this.H-y1)} m ${n2(x2)} ${n2(this.H-y2)} l S`);
    }
    /* Foto: dataURL Base64 → bytes JPEG → XObject /DCTDecode */
    image(dataUrl, x, y, w, h){
      const b64 = String(dataUrl).split(',')[1] || '';
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      if (!(u8[0] === 0xFF && u8[1] === 0xD8)) throw new Error('Foto precisa ser JPEG.');
      const dim = jpegSize(u8) || { w: Math.round(w), h: Math.round(h) };
      const name = 'Im' + (++this._imgN);
      this.images.push({ name, data: u8, w: dim.w, h: dim.h });
      this.cur.imgs.push(name);
      this.cur.ops.push(`q ${n2(w)} 0 0 ${n2(h)} ${n2(x)} ${n2(this.H - y - h)} cm /${name} Do Q`);
    }
    /* Desenha a imagem enquadrada (preserva proporção) dentro da caixa */
    imageFit(dataUrl, x, y, bw, bh){
      const b64 = String(dataUrl).split(',')[1] || '';
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const dim = jpegSize(u8) || { w: 4, h: 3 };
      const s = Math.min(bw / dim.w, bh / dim.h);
      const w = dim.w * s, h = dim.h * s;
      this.image(dataUrl, x + (bw - w) / 2, y + (bh - h) / 2, w, h);
    }

    build(){
      const objs = [];
      const addStr = (s) => objs.push(bytesOf(s));
      const addU8  = (u) => objs.push(u);

      const N = this.pages.length, NI = this.images.length;
      const firstImg = 5, firstContent = 5 + NI;

      addStr('<< /Type /Catalog /Pages 2 0 R >>');
      const kids = this.pages.map((_, i) => `${firstContent + i*2 + 1} 0 R`).join(' ');
      addStr(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`);
      addStr('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      addStr('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

      this.images.forEach((im) => {
        addStr(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
        addU8(im.data);
        addStr('\nendstream');
      });

      this.pages.forEach((pg, i) => {
        const cid = firstContent + i * 2;
        const content = bytesOf(pg.ops.join('\n'));
        addStr(`<< /Length ${content.length} >>\nstream\n`);
        addU8(content);
        addStr('\nendstream');
        let xobj = '';
        if (pg.imgs.length){
          const entries = pg.imgs.map((nm) =>
            `/${nm} ${firstImg + this.images.findIndex((m) => m.name === nm)} 0 R`).join(' ');
          xobj = ` /XObject << ${entries} >>`;
        }
        addStr(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobj} >> /Contents ${cid} 0 R >>`);
      });

      /* ---- Montagem binária + tabela xref (offsets exatos em bytes) ---- */
      const chunks = []; let off = 0;
      const push = (u8) => { chunks.push(u8); off += u8.length; };
      const pushStr = (s) => push(bytesOf(s));
      pushStr('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n');
      const offsets = [0];
      objs.forEach((body, i) => {
        offsets.push(off);
        pushStr(`${i + 1} 0 obj\n`); push(body); pushStr('\nendobj\n');
      });
      const xref = off;
      pushStr(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
      for (let i = 1; i <= objs.length; i++)
        pushStr(offsets[i].toString().padStart(10, '0') + ' 00000 n \n');
      pushStr(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
      return new Blob(chunks, { type: 'application/pdf' });
    }
  }

  return { Doc, rgb, textWidth, wrap };
})();
