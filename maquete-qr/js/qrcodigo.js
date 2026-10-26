/* Navi — gerador de QR Code (modo byte, versões 1 a 10, correção L/M/Q/H).
   Segue a norma ISO/IEC 18004. Retorna uma matriz de booleanos (true = módulo escuro).
   Uso: NaviQR.gerar('https://...', 'Q') -> { tamanho, versao, nivel, modulos: [[bool]] } */
(function (raiz) {
  'use strict';
  const NIVEIS = { L: 0, M: 1, Q: 2, H: 3 };
  const BITS_FORMATO = { L: 1, M: 0, Q: 3, H: 2 };
  // por versão (1..10) e nível [L, M, Q, H]
  const EC_POR_BLOCO = [
    [7, 10, 13, 17], [10, 16, 22, 28], [15, 26, 18, 22], [20, 18, 26, 16], [26, 24, 18, 22],
    [18, 16, 24, 28], [20, 18, 18, 26], [24, 22, 22, 26], [30, 22, 20, 24], [18, 26, 24, 28]];
  const NUM_BLOCOS = [
    [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 2, 2], [1, 2, 2, 4], [1, 2, 4, 4],
    [2, 4, 4, 4], [2, 4, 6, 5], [2, 4, 6, 6], [2, 5, 8, 8], [4, 5, 8, 8]];

  // ---- campo finito GF(256), polinômio 0x11D ----
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
  function geradorRS(grau) {
    let g = [1];
    for (let i = 0; i < grau; i++) {
      const n = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= mul(g[j], EXP[i]); }
      g = n;
    }
    return g; // coeficientes do maior para o menor grau, g[0] = 1
  }
  function restoRS(dados, grau) {
    const g = geradorRS(grau), msg = dados.concat(new Array(grau).fill(0));
    for (let i = 0; i < dados.length; i++) {
      const c = msg[i];
      if (c) for (let j = 1; j < g.length; j++) msg[i + j] ^= mul(g[j], c);
    }
    return msg.slice(dados.length);
  }

  const tamanhoDe = v => v * 4 + 17;
  function modulosDados(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const codewordsTotais = v => Math.floor(modulosDados(v) / 8);
  const codewordsDados = (v, n) => codewordsTotais(v) - EC_POR_BLOCO[v - 1][n] * NUM_BLOCOS[v - 1][n];
  function posAlinhamento(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, tam = tamanhoDe(v);
    const passo = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const r = [6];
    for (let p = tam - 7; r.length < n; p -= passo) r.splice(1, 0, p);
    return r;
  }

  function utf8(txt) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(txt));
    return Array.from(Buffer.from(txt, 'utf8'));
  }

  function gerar(texto, nivel = 'Q', mascaraFixa = -1) {
    const n = NIVEIS[nivel];
    const bytes = utf8(texto);
    let v = 1;
    const bitsContagem = ver => ver < 10 ? 8 : 16; // tamanho do campo de contagem no modo byte
    for (; v <= 10; v++) if (4 + bitsContagem(v) + bytes.length * 8 <= codewordsDados(v, n) * 8) break;
    if (v > 10) throw new Error('Texto longo demais para este gerador (máx. versão 10).');
    // ---- fluxo de bits ----
    const bits = [];
    const add = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    add(4, 4); add(bytes.length, bitsContagem(v)); bytes.forEach(b => add(b, 8));
    const cap = codewordsDados(v, n) * 8;
    add(0, Math.min(4, cap - bits.length));
    add(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) add(pad, 8);
    const dados = [];
    for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    // ---- blocos + correção de erros + intercalação ----
    const nb = NUM_BLOCOS[v - 1][n], ec = EC_POR_BLOCO[v - 1][n], total = codewordsTotais(v);
    const curtos = nb - total % nb, lenCurto = Math.floor(total / nb) - ec;
    const blocos = [], ecs = [];
    for (let b = 0, k = 0; b < nb; b++) {
      const len = lenCurto + (b < curtos ? 0 : 1);
      const bl = dados.slice(k, k + len); k += len;
      blocos.push(bl); ecs.push(restoRS(bl, ec));
    }
    const final = [];
    for (let i = 0; i <= lenCurto; i++) for (let b = 0; b < nb; b++) if (i < blocos[b].length) final.push(blocos[b][i]);
    for (let i = 0; i < ec; i++) for (let b = 0; b < nb; b++) final.push(ecs[b][i]);

    // ---- matriz ----
    const tam = tamanhoDe(v);
    const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const fn = Array.from({ length: tam }, () => new Array(tam).fill(false));
    const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < tam; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && y >= 0 && x < tam && y < tam) set(x, y, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(tam - 4, 3); finder(3, tam - 4);
    const al = posAlinhamento(v);
    for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const formato = mascara => {
      const d = BITS_FORMATO[nivel] << 3 | mascara;
      let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(tam - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, tam - 15 + i, bit(i));
      set(8, tam - 8, true);
    };
    formato(0);
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = v << 12 | r;
      for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) === 1, a = tam - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
    }
    // dados em zigue-zague
    let i = 0;
    for (let dir = tam - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
        const x = dir - j, sobe = ((dir + 1) & 2) === 0, y = sobe ? tam - 1 - vert : vert;
        if (!fn[y][x] && i < final.length * 8) { m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
    // ---- máscara: escolhe a de menor penalidade ----
    const condicoes = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const aplicar = k => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fn[y][x] && condicoes[k](x, y)) m[y][x] = !m[y][x]; };
    const penalidade = () => {
      let p = 0;
      const linha = get => {
        for (let a = 0; a < tam; a++) {
          let run = 1;
          for (let b = 1; b <= tam; b++) {
            if (b < tam && get(a, b) === get(a, b - 1)) run++;
            else { if (run >= 5) p += 3 + run - 5; run = 1; }
          }
          const pad1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pad2 = pad1.slice().reverse();
          for (let b = 0; b + 11 <= tam; b++) {
            let ok1 = true, ok2 = true;
            for (let k = 0; k < 11; k++) { const val = get(a, b + k) ? 1 : 0; if (val !== pad1[k]) ok1 = false; if (val !== pad2[k]) ok2 = false; }
            if (ok1) p += 40; if (ok2) p += 40;
          }
        }
      };
      linha((a, b) => m[a][b]); linha((a, b) => m[b][a]);
      let escuros = 0;
      for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
        if (m[y][x]) escuros++;
        if (x < tam - 1 && y < tam - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      }
      p += Math.floor(Math.abs(escuros * 100 / (tam * tam) - 50) / 5) * 10;
      return p;
    };
    let melhor = mascaraFixa, menor = Infinity;
    if (melhor < 0) for (let k = 0; k < 8; k++) {
      aplicar(k); formato(k);
      const pen = penalidade();
      if (pen < menor) { menor = pen; melhor = k; }
      aplicar(k);
    }
    aplicar(melhor); formato(melhor);
    return { tamanho: tam, versao: v, nivel, mascara: melhor, modulos: m };
  }

  // SVG pronto para imprimir (margem de 4 módulos, exigida pela norma)
  function svg(qr, opcoes = {}) {
    const margem = opcoes.margem ?? 4, t = qr.tamanho + margem * 2, cor = opcoes.cor || '#12233F', fundo = opcoes.fundo || '#FFFFFF';
    let d = '';
    qr.modulos.forEach((linha, y) => linha.forEach((on, x) => { if (on) d += `M${x + margem} ${y + margem}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"${opcoes.rotulo ? ` role="img" aria-label="${opcoes.rotulo}"` : ''}><rect width="${t}" height="${t}" fill="${fundo}"/><path d="${d}" fill="${cor}"/></svg>`;
  }

  const api = { gerar, svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviQR = api;
})(typeof window !== 'undefined' ? window : globalThis);
