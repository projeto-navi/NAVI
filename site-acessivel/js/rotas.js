/* Navi — grafo de circulação, cálculo de rotas e instruções em texto.
   Funciona no navegador (window.NaviRotas) e no Node (testes). */
(function (raiz) {
  'use strict';
  const PASSO = 30; // tamanho da célula da malha de circulação, em unidades da planta

  const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function criarGrafo(D) {
    const nos = [];          // {id, piso, x, y}
    const viz = [];          // lista de adjacência: [{para, custo, tipo}]
    const porPiso = { 1: [], 2: [] };
    const chave = {};
    for (const piso of [1, 2]) {
      for (const [i, j] of D.grafo[piso]) {
        const id = nos.length;
        nos.push({ id, piso, x: i * PASSO + PASSO / 2, y: j * PASSO + PASSO / 2, i, j });
        viz.push([]);
        porPiso[piso].push(id);
        chave[piso + ':' + i + ':' + j] = id;
      }
    }
    // ligações entre vizinhos (8 direções) no mesmo piso
    for (const n of nos) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const m = chave[n.piso + ':' + (n.i + a) + ':' + (n.j + b)];
        if (m !== undefined) viz[n.id].push({ para: m, custo: Math.hypot(a, b) * PASSO, tipo: 'corredor' });
      }
    }
    const maisProximo = (piso, x, y) => {
      let melhor = -1, d = Infinity;
      for (const id of porPiso[piso]) {
        const n = nos[id], dd = (n.x - x) ** 2 + (n.y - y) ** 2;
        if (dd < d) { d = dd; melhor = id; }
      }
      return melhor;
    };

    // Conexões entre pisos: escadas rolantes pareadas por posição; elevador (posição do Piso 2,
    // mesmo poço no Piso 1 — posição estimada).
    const escadas1 = D.places.filter(p => p.cat === 'escada' && p.piso === 1);
    const escadas2 = D.places.filter(p => p.cat === 'escada' && p.piso === 2);
    const conexoes = [];
    for (const e1 of escadas1) {
      const e2 = escadas2.reduce((a, b) => Math.hypot(a.x - e1.x, a.y - e1.y) < Math.hypot(b.x - e1.x, b.y - e1.y) ? a : b);
      conexoes.push({ tipo: 'escada', a: maisProximo(1, e1.x, e1.y), b: maisProximo(2, e2.x, e2.y), lugares: [e1.id, e2.id], custo: 60 });
    }
    const elev2 = D.places.find(p => p.cat === 'elevador' && p.piso === 2);
    let elev1 = null;
    if (elev2) {
      const n1 = maisProximo(1, elev2.x, elev2.y);
      elev1 = { id: 'elevador-piso-1', nome: 'Elevadores', cat: 'elevador', piso: 1, x: nos[n1].x, y: nos[n1].y,
        w: 26, h: 26, r: 0, poly: -1, estimado: true };
      D.places.push(elev1);
      elev2.nome = 'Elevadores';
      conexoes.push({ tipo: 'elevador', a: n1, b: maisProximo(2, elev2.x, elev2.y), lugares: [elev1.id, elev2.id], custo: 90 });
    }
    for (const c of conexoes) {
      viz[c.a].push({ para: c.b, custo: c.custo, tipo: c.tipo, lugares: c.lugares });
      viz[c.b].push({ para: c.a, custo: c.custo, tipo: c.tipo, lugares: c.lugares });
    }
    const lugarPorId = {};
    for (const p of D.places) lugarPorId[p.id] = p;
    const noDoLugar = p => maisProximo(p.piso, p.x, p.y);
    return { nos, viz, porPiso, conexoes, maisProximo, noDoLugar, lugarPorId, places: D.places };
  }

  // Dijkstra com fila simples (grafo pequeno: ~320 nós)
  function caminho(G, origemNo, destinoNo, opcoes = {}) {
    const n = G.nos.length, dist = new Float64Array(n).fill(Infinity), ant = new Int32Array(n).fill(-1), via = new Array(n);
    const feito = new Uint8Array(n);
    dist[origemNo] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!feito[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === destinoNo) break;
      feito[u] = 1;
      for (const e of G.viz[u]) {
        if (opcoes.semEscadas && e.tipo === 'escada') continue;
        if (opcoes.bloqueados && e.lugares && e.lugares.some(id => opcoes.bloqueados.has(id))) continue; // elevador/escada interditados
        const alt = dist[u] + e.custo;
        if (alt < dist[e.para]) { dist[e.para] = alt; ant[e.para] = u; via[e.para] = e.tipo; }
      }
    }
    if (!isFinite(dist[destinoNo])) return null;
    const ids = [destinoNo];
    while (ids[0] !== origemNo) ids.unshift(ant[ids[0]]);
    return { ids, tipos: ids.map(i => via[i] || 'corredor'), custo: dist[destinoNo] };
  }

  function rota(G, origem, destino, opcoes = {}) {
    if (!origem || !destino) return null;
    const c = caminho(G, G.noDoLugar(origem), G.noDoLugar(destino), opcoes);
    if (!c) return null;
    // divide em trechos por piso
    const trechos = [];
    let atual = null;
    c.ids.forEach((id, k) => {
      const no = G.nos[id];
      if (!atual || atual.piso !== no.piso) {
        if (atual) atual.saida = c.tipos[k]; // tipo de conexão usada para sair deste piso
        atual = { piso: no.piso, pontos: [] };
        trechos.push(atual);
      }
      atual.pontos.push({ x: no.x, y: no.y });
    });
    // caminho pelo meio dos corredores, desviando dos quiosques (malha fina)
    if (opcoes.malha !== false) trechos.forEach((t, ti) => { t.pontos = refinarTrecho(t.piso, t.pontos, 120, ti > 0, !!t.saida); });
    // começa e termina na porta dos lugares
    trechos[0].pontos.unshift({ x: origem.x, y: origem.y });
    trechos[trechos.length - 1].pontos.push({ x: destino.x, y: destino.y });
    const usaEscada = trechos.some(t => t.saida === 'escada');
    const usaElevador = trechos.some(t => t.saida === 'elevador');
    const comprimento = trechos.reduce((s, t) => s + compr(t.pontos), 0);
    const r = { origem, destino, trechos, usaEscada, usaElevador, comprimento };
    r.passos = instrucoes(G, r);
    return r;
  }

  const compr = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0, 0);

  // Ramer–Douglas–Peucker para tirar o "serrilhado" da malha
  function simplificar(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let idx = -1, dmax = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / L;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= eps) return [a, b];
    return simplificar(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplificar(pts.slice(idx), eps));
  }

  const angulo = (p, q) => Math.atan2(q.y - p.y, q.x - p.x);
  const normal = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  function trechoEmPalavras(px) {
    if (px < 90) return 'alguns passos';
    if (px < 260) return 'um trecho curto';
    if (px < 600) return 'um trecho médio';
    return 'um trecho longo';
  }

  function referencia(G, piso, ponto, excluir, raio = 85) {
    let melhor = null, d = raio;
    for (const p of G.places) {
      if (p.piso !== piso || excluir.has(p.id) || p.cat === 'emergencia' || p.cat === 'administracao') continue;
      const dd = Math.hypot(p.x - ponto.x, p.y - ponto.y);
      if (dd < d) { d = dd; melhor = p; }
    }
    return melhor;
  }

  const GENERICO = { escada: 'da escada rolante', sanitario: 'dos sanitários', elevador: 'dos elevadores',
    informacao: 'do SAC', estacionamento: 'do pagamento do estacionamento', caixa: 'dos caixas eletrônicos',
    saida: 'da saída', familia: 'do Espaço Família', museu: 'do Museu Ferroviário' };
  const pertoDe = p => GENERICO[p.cat] || (p.cat === 'entrada' ? 'do ' + p.nome : 'de ' + p.nome);

  function instrucoes(G, r) {
    const passos = [];
    const excluir = new Set([r.origem.id, r.destino.id]);
    let ultimaRef = null;
    const nomeConexao = t => t === 'elevador' ? 'o elevador' : 'a escada rolante';
    r.trechos.forEach((t, ti) => {
      const pts = simplificar(t.pontos, 20);
      // junta segmentos quase alinhados
      const seg = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const giro = Math.abs(normal(angulo(pts[i], pts[i + 1]) - angulo(seg[seg.length - 1], pts[i])));
        if (giro > 0.45) seg.push(pts[i]);
      }
      seg.push(pts[pts.length - 1]);
      // remove trechos muito curtos no meio do caminho (ruído da malha)
      for (let i = 1; i < seg.length - 1; i++) {
        if (Math.hypot(seg[i + 1].x - seg[i].x, seg[i + 1].y - seg[i].y) < 45 && i < seg.length - 2) { seg.splice(i + 1, 1); i--; }
      }
      for (let i = 0; i < seg.length - 1; i++) {
        const a = seg[i], b = seg[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y);
        let ref = referencia(G, t.piso, b, excluir);
        if (ref && ref === ultimaRef) ref = null;
        if (ref) ultimaRef = ref;
        const ultimoSeg = ti === r.trechos.length - 1 && i === seg.length - 2;
        const perto = ref && !ultimoSeg ? ` até perto ${pertoDe(ref)}` : '';
        let tipo, texto;
        if (i === 0) {
          if (ti === 0) {
            tipo = 'inicio';
            texto = `Saia de ${r.origem.nome} e siga ${trechoEmPalavras(L)} pelo corredor${perto}.`;
          } else {
            tipo = 'reto';
            texto = `No Piso ${t.piso}, ao sair ${r.trechos[ti - 1].saida === 'elevador' ? 'do elevador' : 'da escada rolante'}, siga ${trechoEmPalavras(L)}${perto}.`;
          }
        } else {
          const giro = normal(angulo(a, b) - angulo(seg[i - 1], a)); // y para baixo: positivo = direita
          const g = Math.abs(giro), lado = giro > 0 ? 'direita' : 'esquerda';
          if (g < 0.5) { tipo = 'reto'; texto = `Continue em frente por ${trechoEmPalavras(L)}${perto}.`; }
          else if (g < 1.05) { tipo = giro > 0 ? 'leve-dir' : 'leve-esq'; texto = `Faça uma curva leve à ${lado} e siga ${trechoEmPalavras(L)}${perto}.`; }
          else if (g < 2.5) { tipo = giro > 0 ? 'dir' : 'esq'; texto = `Vire à ${lado} e siga ${trechoEmPalavras(L)}${perto}.`; }
          else { tipo = 'volta'; texto = `Faça o retorno e siga ${trechoEmPalavras(L)}${perto}.`; }
        }
        // "continue em frente" logo depois de outro trecho reto vira um passo só
        const ant = passos[passos.length - 1];
        if (tipo === 'reto' && i > 0 && ant && ant.piso === t.piso && ant._L != null && ['reto', 'inicio', 'leve-esq', 'leve-dir', 'esq', 'dir', 'volta'].includes(ant.tipo)) {
          ant._L += L; ant.ate = b;
          const refJunta = ultimoSeg ? null : (ref || ant._ref);
          ant.texto = ant.texto.replace(/(siga |por )(alguns passos|um trecho curto|um trecho médio|um trecho longo)( pelo corredor)?( até perto (de|do|da|dos) [^.]*)?\./,
            (m0, v, _q, corr) => `${v}${trechoEmPalavras(ant._L)}${corr || ''}${refJunta ? ' até perto ' + pertoDe(refJunta) : ''}.`);
          ant._ref = refJunta;
          continue;
        }
        passos.push({ tipo, texto, piso: t.piso, de: a, ate: b, _L: L, _ref: ref && !ultimoSeg ? ref : null });
      }
      if (t.saida) {
        const prox = r.trechos[ti + 1];
        const fim = t.pontos[t.pontos.length - 1];
        passos.push({ tipo: t.saida, piso: t.piso, de: fim, ate: fim,
          texto: `Pegue ${nomeConexao(t.saida)} e ${prox.piso > t.piso ? 'suba' : 'desça'} para o Piso ${prox.piso}.` });
      }
    });
    // chegada: de que lado fica o destino
    const ult = r.trechos[r.trechos.length - 1];
    const pts = ult.pontos, n = pts.length;
    let lado = '';
    if (n >= 3) {
      const p = pts[n - 3], q = pts[n - 2], d = r.destino;
      const hx = q.x - p.x, hy = q.y - p.y, vx = d.x - q.x, vy = d.y - q.y;
      const cruz = hx * vy - hy * vx, frente = hx * vx + hy * vy;
      const ang = Math.atan2(cruz, frente);
      if (Math.abs(ang) < 0.6) lado = ', à sua frente';
      else if (Math.abs(ang) < 2.6) lado = ang > 0 ? ', do seu lado direito' : ', do seu lado esquerdo';
    }
    passos.push({ tipo: 'chegada', piso: ult.piso, de: pts[n - 1], ate: pts[n - 1],
      texto: `Você chegou: ${r.destino.nome}${lado}.` });
    return passos;
  }

  function maisProximoDaCategoria(G, origem, cat, opcoes = {}) {
    let melhor = null;
    for (const p of G.places) {
      if (p.cat !== cat || p.id === origem.id) continue;
      if (opcoes.bloqueados && opcoes.bloqueados.has(p.id)) continue;
      const c = caminho(G, G.noDoLugar(origem), G.noDoLugar(p), opcoes);
      if (c && (!melhor || c.custo < melhor.custo)) melhor = { lugar: p, custo: c.custo };
    }
    return melhor && melhor.lugar;
  }

  function buscar(places, termo, cat) {
    const q = semAcento(termo || '');
    return places.filter(p => (!cat || cat === 'todos' || p.cat === cat || (cat === 'servicos' && !['loja', 'quiosque'].includes(p.cat)))
      && (!q || semAcento(p.nome).includes(q)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.piso - b.piso);
  }

  /* ---------- malha fina: rota pelo centro dos corredores ----------
     Cada célula guarda a folga (distância até a parede ou quiosque mais próximo).
     0 = parede/loja; 1 = quiosque (só se não houver outro jeito); >=2 = livre. */
  let MALHA = null;
  function malha() {
    if (MALHA !== null) return MALHA;
    const M = (typeof window !== 'undefined' && window.NAVI_MALHA) || (typeof globalThis !== 'undefined' && globalThis.NAVI_MALHA);
    if (!M) return (MALHA = false);
    const dec = b64 => {
      if (typeof atob === 'function') { const t = atob(b64), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; }
      return new Uint8Array(Buffer.from(b64, 'base64'));
    };
    MALHA = { passo: M.passo, W: M.larg, H: M.alt, folga: { 1: dec(M.folga[1]), 2: dec(M.folga[2]) } };
    return MALHA;
  }
  function distPontoSeg(px, py, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy;
    const u = L ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / L)) : 0;
    return Math.hypot(px - a.x - vx * u, py - a.y - vy * u);
  }
  function refinarTrecho(piso, pontos, banda = 120, fixoIni = true, fixoFim = true) {
    const M = malha();
    if (!M || pontos.length < 2) return pontos;
    const { passo: S, W, H } = M, F = M.folga[piso];
    const cel = p => [Math.round(p.x / S), Math.round(p.y / S)];
    // células permitidas: dentro de uma faixa em volta da rota original (mantém o mesmo corredor das instruções)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pontos) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const cx0 = Math.max(0, Math.floor((x0 - banda) / S)), cy0 = Math.max(0, Math.floor((y0 - banda) / S));
    const cx1 = Math.min(W - 1, Math.ceil((x1 + banda) / S)), cy1 = Math.min(H - 1, Math.ceil((y1 + banda) / S));
    const bw = cx1 - cx0 + 1, bh = cy1 - cy0 + 1;
    const ok = new Uint8Array(bw * bh);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const gx = i + cx0, gy = j + cy0;
      if (!F[gy * W + gx]) continue;
      const px = gx * S, py = gy * S;
      let d = Infinity;
      for (let k = 1; k < pontos.length && d > banda; k++) d = Math.min(d, distPontoSeg(px, py, pontos[k - 1], pontos[k]));
      if (d <= banda) ok[j * bw + i] = 1;
    }
    const livre = (i, j) => i >= 0 && j >= 0 && i < bw && j < bh && ok[j * bw + i];
    const perto = ([gx, gy]) => { // célula livre mais próxima (de preferência fora de quiosque)
      let melhor = null, md = Infinity;
      for (let r = 0; r <= 12 && !melhor; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = gx - cx0 + di, j = gy - cy0 + dj;
        if (!livre(i, j) || F[(j + cy0) * W + i + cx0] < 2) continue;
        const d = di * di + dj * dj; if (d < md) { md = d; melhor = [i, j]; }
      }
      return melhor;
    };
    const ini = perto(cel(pontos[0])), fim = perto(cel(pontos[pontos.length - 1]));
    if (!ini || !fim) return pontos;
    // custo: comprimento × penalidade por ficar perto de paredes (prefere o centro do corredor)
    const fator = f => f === 1 ? 30 : 1 + 4 * Math.pow(Math.max(0, 1 - f / 42), 2) + (f < 9 ? 3 : 0);
    const N = bw * bh, g = new Float64Array(N).fill(Infinity), de = new Int32Array(N).fill(-1), fechado = new Uint8Array(N);
    const heap = []; // [f, idx]
    const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let a = 2 * i + 1, b = a + 1, m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    const s0 = ini[1] * bw + ini[0], alvo = fim[1] * bw + fim[0];
    g[s0] = 0; push(0, s0);
    const hx = n => Math.hypot((n % bw) - fim[0], Math.floor(n / bw) - fim[1]) * S;
    while (heap.length) {
      const [, n] = pop();
      if (fechado[n]) continue; fechado[n] = 1;
      if (n === alvo) break;
      const i = n % bw, j = (n / bw) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!livre(ni, nj)) continue;
        if (di && dj && (!livre(i + di, j) || !livre(i, j + dj))) continue; // não corta quinas
        const m = nj * bw + ni;
        const custo = g[n] + (di && dj ? 1.4142 : 1) * S * fator(F[(nj + cy0) * W + ni + cx0]);
        if (custo < g[m]) { g[m] = custo; de[m] = n; push(custo + hx(m), m); }
      }
    }
    if (!isFinite(g[alvo])) return pontos;
    let cam = [];
    for (let n = alvo; n !== -1; n = de[n]) cam.push({ x: ((n % bw) + cx0) * S, y: (((n / bw) | 0) + cy0) * S });
    cam.reverse();
    cam = simplificar(cam, S * 0.9);
    // suaviza as curvas (Chaikin) mantendo início e fim
    for (let it = 0; it < 2; it++) {
      const nv = [cam[0]];
      for (let k = 0; k < cam.length - 1; k++) {
        const a = cam[k], b = cam[k + 1];
        if (k > 0) nv.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        if (k < cam.length - 2) nv.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      nv.push(cam[cam.length - 1]); cam = nv;
    }
    // liga às pontas exatas (conexões entre pisos ficam no mesmo lugar)
    const p0 = pontos[0], pN = pontos[pontos.length - 1];
    if (fixoIni && Math.hypot(cam[0].x - p0.x, cam[0].y - p0.y) > 1) cam.unshift({ x: p0.x, y: p0.y });
    if (fixoFim && Math.hypot(cam[cam.length - 1].x - pN.x, cam[cam.length - 1].y - pN.y) > 1) cam.push({ x: pN.x, y: pN.y });
    return cam;
  }

  const api = { criarGrafo, caminho, rota, buscar, maisProximoDaCategoria, semAcento, simplificar, refinarTrecho };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviRotas = api;
})(typeof window !== 'undefined' ? window : globalThis);
