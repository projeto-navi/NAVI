/* Navi — Map2DRenderer: a planta do andar em SVG (extraída do antigo app.js), com as cores dos tokens.
   - Coordenadas da planta, com y para baixo. As cores vêm de css/mapa.css (variáveis do tema ativo).
   - Arrastar move, pinça e roda do mouse aproximam; teclado: setas, + e −. Todo gesto tem botão
     equivalente na página (WCAG 2.5.7).
   - Tocar num lugar chama ao.selecionar(lugar): a página abre o cartão "Ir para cá" (RN10).
   - O mapa é uma imagem para o leitor de tela: tudo o que ele mostra também está no passo a passo
     e na lista de lugares do andar (RN36). */
(function (raiz) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, pai) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(n);
    return n;
  };
  const areaPoly = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const contorno = pts => 'M' + pts.map(q => q[0] + ' ' + q[1]).join('L') + 'Z';
  const linha = pts => 'M' + pts.map(p => p.x + ' ' + p.y).join('L');
  const reduzMovimento = () => !!(raiz.matchMedia && raiz.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const suave = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2); // movimento na tela: acelera e desacelera
  const K_MIN = 0.18, K_MAX = 4.5; // unidades da planta por pixel (aproximado / afastado)

  /**
   * @param {object} o
   * @param {object} o.local local montado (NaviLocal)
   * @param {object} o.G grafo do motor (NaviRotas.criarGrafo11)
   * @param {(piso: number) => string} [o.rotulo] nome acessível da planta de cada andar
   * @param {{selecionar?: (lugar: object) => void}} [o.ao]
   * @returns {object} MapRenderer (ver js/mapa-renderer.js)
   */
  function criar(o) {
    const local = o.local, G = o.G, D = local.legado, ao = o.ao || {};
    const NC = raiz.NaviCategorias;
    const coresEntradas = (local.config && local.config.coresEntradas) || {};
    const pisoDe = andarId => { const a = local.andares.find(x => x.id === andarId || x.ordem === andarId); return a ? a.ordem : null; };

    let container = null, svg = null, desc = null, cam = {};
    let largura = 0, altura = 0;
    const vb = { x: 0, y: 0, w: 1000, h: 600 };
    const st = {
      piso: local.andares.length ? local.andares[0].ordem : 1,
      rota: null, origem: null, destino: null, passo: -1, avisos: [],
      escalaTexto: 1, nomes: false, evitarEscadas: false, destaques: new Set(),
      margens: { topo: 0, direita: 0, base: 0, esquerda: 0 }
    };
    let enquadramento = null;   // última forma de enquadrar (refeita quando o espaço livre muda)
    let mexeu = false;          // a pessoa moveu ou aproximou o mapa com a mão
    let animacao = null, kSetas = 0;
    let escalaAplicada = null;  // escala dos ícones na última passada; null: há ícones novos sem escala

    /* ---------- câmera ---------- */
    const k = () => (largura ? vb.w / largura : 1);   // unidades da planta por pixel
    function livre() {
      const m = st.margens;
      const w = Math.max(80, largura - m.esquerda - m.direita), h = Math.max(80, altura - m.topo - m.base);
      return { x: m.esquerda, y: m.topo, w, h };
    }
    function aplicarVB() {
      if (!svg) return;
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      const kk = k(), s = 1 + (st.escalaTexto - 1) * 0.5;
      svg.dataset.zoom = kk < 0.95 ? 'perto' : 'longe';
      // ícones e marcas mantêm o tamanho na tela: só refaz quando a escala muda (arrastar não muda)
      if (kk * s !== escalaAplicada) {
        escalaAplicada = kk * s;
        svg.querySelectorAll('[data-escala]').forEach(n => {
          n.setAttribute('transform', `translate(${n.dataset.x} ${n.dataset.y})${n.dataset.rot ? ` rotate(${n.dataset.rot})` : ''} scale(${kk * s * (+n.dataset.escala)})`);
        });
      }
      if (st.rota && kSetas && Math.abs(kk / kSetas - 1) > 0.2) desenharSetas();
      ajustarNomesDasMarcas(kk, s);
    }
    /** O nome de uma marca perto da borda se desloca para dentro, para não ficar embaixo dos controles. */
    function ajustarNomesDasMarcas(kk, s) {
      const L = livre();
      cam.marcas.querySelectorAll('.rotulo-marca').forEach(t => {
        const g = t.parentNode;
        const sx = (+g.dataset.x - vb.x) / kk;
        let larg = +t.dataset.larg;
        if (!larg) { try { larg = t.getComputedTextLength(); } catch (e) { larg = 0; } if (larg) t.dataset.larg = larg; }
        // desloca o nome só o necessário para caber entre as bordas livres (sem trocar de lado)
        const metade = (larg * s) / 2;
        let c = sx;
        if (larg && L.w > 2 * metade) c = Math.min(Math.max(sx, L.x + metade), L.x + L.w - metade);
        t.setAttribute('x', ((c - sx) / s).toFixed(1));
      });
    }
    function moverPara(alvo, animar) {
      if (animacao) { cancelAnimationFrame(animacao.id); animacao = null; }
      if (!animar || reduzMovimento()) { Object.assign(vb, alvo); aplicarVB(); return; }
      const de = { ...vb }, t0 = performance.now(), dur = 300;
      const passo = t => {
        const u = Math.min(1, (t - t0) / dur), e = suave(u);
        for (const c of ['x', 'y', 'w', 'h']) vb[c] = de[c] + (alvo[c] - de[c]) * e;
        aplicarVB();
        animacao = u < 1 ? { id: requestAnimationFrame(passo) } : null;
      };
      animacao = { id: requestAnimationFrame(passo) };
    }
    /** Encaixa uma caixa da planta na área livre (sem controles nem painel por cima). */
    function caixaParaVB(c, minimo = 0) {
      const L = livre();
      let bw = Math.max(c.maxX - c.minX, minimo), bh = Math.max(c.maxY - c.minY, minimo * 0.6);
      let kk = Math.max(bw / L.w, bh / L.h);
      kk = Math.min(K_MAX, Math.max(K_MIN, kk));
      const cx = (c.minX + c.maxX) / 2, cy = (c.minY + c.maxY) / 2;
      return { w: largura * kk, h: altura * kk, x: cx - (L.x + L.w / 2) * kk, y: cy - (L.y + L.h / 2) * kk };
    }
    function enquadrar(fn, animar) {
      enquadramento = fn; mexeu = false;
      if (!largura || !altura) return;
      moverPara(fn(), animar);
    }
    // folga maior para os lados: os nomes das marcas ("Você: …") ficam centrados nelas
    const caixaDePontos = (pts, folga) => {
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      return { minX: Math.min(...xs) - folga * 1.5, maxX: Math.max(...xs) + folga * 1.5, minY: Math.min(...ys) - folga, maxY: Math.max(...ys) + folga };
    };
    function caixaDoAndar() {
      const b = D.pisos[st.piso];
      return b ? { minX: b.minX - 24, maxX: b.maxX + 24, minY: b.minY - 24, maxY: b.maxY + 24 } : { minX: 0, maxX: 1000, minY: 0, maxY: 600 };
    }
    function ajustar(animar) { enquadrar(() => caixaParaVB(caixaDoAndar()), animar); }
    function centralizar(animar = true) {
      const pts = [];
      if (st.rota) st.rota.trechos.forEach(t => { if (t.piso === st.piso) pts.push(...t.pontos); });
      else [st.origem, st.destino].forEach(l => { if (l && l.piso === st.piso) pts.push({ x: l.x, y: l.y }); });
      if (!pts.length) { ajustar(animar); return; }
      enquadrar(() => caixaParaVB(caixaDePontos(pts, 110), 420), animar);
    }
    function zoom(f, cx, cy) {
      const kk = k(), nk = Math.min(K_MAX, Math.max(K_MIN, kk * f)), real = nk / kk;
      if (cx === undefined) { const L = livre(); cx = vb.x + (L.x + L.w / 2) * kk; cy = vb.y + (L.y + L.h / 2) * kk; }
      moverPara({ x: cx - (cx - vb.x) * real, y: cy - (cy - vb.y) * real, w: vb.w * real, h: vb.h * real }, false);
      mexeu = true;
    }
    function pontoSVG(ev) {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ---------- desenho do andar ---------- */
    const lugaresDoPiso = () => G.places.filter(p => p.piso === st.piso);
    function corDaEntrada(l) {
      if (coresEntradas[l.id]) return coresEntradas[l.id];
      const a = (l.aliases || []).find(x => coresEntradas[x]);
      return a ? coresEntradas[a] : null;
    }
    // antes do mount os métodos só guardam o estado: o mount desenha tudo de uma vez
    function desenharAndar() {
      if (!svg) return;
      escalaAplicada = null;
      for (const c of ['piso', 'planta', 'rotulos', 'icones', 'rota', 'setas', 'marcas']) cam[c].textContent = '';
      // piso e corredores (contorno das lajes; sem ele, a caixa do andar)
      const lajes = (local.lajes && local.lajes[st.piso]) || [];
      if (lajes.length) {
        for (const l of lajes) el('path', { d: contorno(l.ext) + (l.buracos || []).map(contorno).join(''), class: 'piso-forma', 'fill-rule': 'evenodd' }, cam.piso);
      } else if (D.pisos[st.piso]) {
        const b = D.pisos[st.piso];
        el('rect', { x: b.minX - 14, y: b.minY - 14, width: b.maxX - b.minX + 28, height: b.maxY - b.minY + 28, rx: 16, class: 'piso-forma' }, cam.piso);
      }
      // piso tátil direcional (quando a planta traz as linhas): faixa amarela por baixo das salas
      for (const linha of (D.tatil && D.tatil[st.piso]) || []) {
        el('path', { d: 'M' + linha.map(q => q[0] + ' ' + q[1]).join('L'), class: 'piso-tatil' }, cam.piso);
      }
      const lugares = lugaresDoPiso();
      const porPoly = {};
      lugares.forEach(p => { if (p.poly >= 0 && !porPoly[p.poly]) porPoly[p.poly] = p; });
      (D.plantas[st.piso] || []).forEach((poly, i) => {
        const p = porPoly[i];
        const forma = el('path', { d: contorno(poly), class: 'loja-forma' + (p ? ' clicavel' : '') }, cam.planta);
        if (p) { forma.dataset.id = p.id; el('title', {}, forma).textContent = p.nome; }
      });
      // quiosques, entradas e lugares sem contorno na planta (retângulos da planta oficial)
      lugares.filter(p => p.poly < 0 && (p.cat === 'quiosque' || p.cat === 'entrada' || !NC.noMapaComoIcone(p.cat))).forEach(p => {
        const g = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.r || 0})` }, cam.planta);
        const ent = p.cat === 'entrada';
        const r = el('rect', { x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h, rx: ent ? 2 : 5, class: ent ? 'entrada-forma' : 'quiosque-forma' }, g);
        const cor = ent ? corDaEntrada(p) : null;
        if (cor) r.style.setProperty('--cor-entrada', cor);
        r.dataset.id = p.id;
        el('title', {}, r).textContent = p.nome + (p.cat === 'quiosque' ? ' (quiosque)' : '');
      });
      desenharRotulos(lugares);
      desenharIcones(lugares);
      desenharAvisos();
      if (svg) svg.setAttribute('aria-label', o.rotulo ? o.rotulo(st.piso) : 'Planta do andar');
      desenharRota();
      desenharPosicao();
    }

    /** RN75: bolinha vermelha "Você está aqui" no lugar do beacon encontrado, só no andar dele. */
    function desenharPosicao() {
      if (!svg || !cam.posicao) return;
      cam.posicao.textContent = '';
      const l = st.posicao;
      if (!l || l.piso !== st.piso) return;
      const g = el('g', { class: 'marca-ponto marca-posicao', 'data-escala': 1, 'data-x': l.x, 'data-y': l.y }, cam.posicao);
      g.dataset.id = l.id;
      el('circle', { r: 18, class: 'marca-posicao-pulso' }, g);
      el('circle', { r: 11, class: 'marca-posicao-borda' }, g);
      el('circle', { r: 8, class: 'marca-posicao-centro' }, g);
      const t = el('text', { x: 0, y: -22, 'text-anchor': 'middle', class: 'rotulo rotulo-marca rotulo-posicao', 'font-size': 15 }, g);
      t.textContent = 'Você está aqui';
      escalaAplicada = null;
      aplicarVB();
    }
    function desenharRotulos(lugares) {
      // nomes das lojas e salas (aparecem ao aproximar); as maiores primeiro, sem sobrepor
      const area = p => (p.poly >= 0 && D.plantas[st.piso] && D.plantas[st.piso][p.poly] ? areaPoly(D.plantas[st.piso][p.poly]) : p.w * p.h);
      const aceitos = [], e = st.escalaTexto;
      lugares.filter(p => ['loja', 'quiosque', 'sala', 'laboratorio'].includes(p.cat))
        .sort((a, b) => (a.cat === 'quiosque') - (b.cat === 'quiosque') || area(b) - area(a))
        .forEach(p => {
          const fs = (p.cat === 'quiosque' ? 9 : 11) * e;
          const txt = p.nome.length > 18 ? p.nome.slice(0, 17) + '…' : p.nome;
          const w = txt.length * fs * 0.56 + 4, h = fs * 1.2;
          const caixa = { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h / 2, y1: p.y + h / 2 };
          if (aceitos.some(c => c.x0 < caixa.x1 && caixa.x0 < c.x1 && c.y0 < caixa.y1 && caixa.y0 < c.y1)) return;
          aceitos.push(caixa);
          const t = el('text', { x: p.x, y: p.y + fs * 0.35, 'text-anchor': 'middle', class: 'rotulo rotulo-loja', 'font-size': fs }, cam.rotulos);
          t.dataset.para = p.id;
          t.textContent = txt;
        });
    }
    function desenharIcones(lugares) {
      lugares.filter(p => NC.noMapaComoIcone(p.cat) && p.cat !== 'entrada').forEach(p => {
        const desativado = st.evitarEscadas && NC.ehEscada(p.cat);
        const grupo = NC.ehAcessibilidade(p.cat) ? 'acessibilidade' : 'servico';
        const destaque = [...st.destaques].some(c => (raiz.NaviMapa.DESTAQUES[c] || []).includes(p.cat));
        const g = el('g', { class: `icone-mapa ${grupo}${desativado ? ' desativado' : ''}${destaque ? ' destaque' : ''}`, 'data-escala': 1, 'data-x': p.x, 'data-y': p.y }, cam.icones);
        g.dataset.id = p.id; g.dataset.cat = p.cat;
        el('circle', { r: 16, class: 'icone-halo' }, g);
        el('circle', { r: 14 }, g);
        el('use', { href: '#' + NC.icone(p.cat), x: -9, y: -9, width: 18, height: 18 }, g);
        el('title', {}, g).textContent = p.nome + (desativado ? ' — fora das suas rotas' : '') + (p.estimado ? ' (posição estimada)' : '');
      });
    }
    function desenharAvisos() {
      if (!svg) return;
      svg.querySelectorAll('.com-aviso').forEach(n => n.classList.remove('com-aviso'));
      for (const a of st.avisos) {
        const p = G.lugarPorId[a.lugar];
        if (!p || p.piso !== st.piso) continue;
        svg.querySelectorAll(`.loja-forma[data-id="${CSS.escape(p.id)}"], .quiosque-forma[data-id="${CSS.escape(p.id)}"]`).forEach(n => n.classList.add('com-aviso'));
        const g = el('g', { class: 'marca-aviso', 'data-escala': 1, 'data-x': p.x, 'data-y': p.y - 4, 'data-id': p.id }, cam.icones);
        el('path', { d: 'M0 -15 L14 10 L-14 10 Z', class: 'marca-aviso-fundo' }, g);
        el('path', { d: 'M0 -5 V2', class: 'marca-aviso-sinal' }, g);
        el('circle', { cx: 0, cy: 6, r: 1.6, class: 'marca-aviso-ponto' }, g);
        el('title', {}, g).textContent = `${p.nome}: aviso de ${(raiz.NaviInterdicoes.TIPOS[a.tipo] || { nome: '' }).nome.toLowerCase()}`;
      }
    }

    /* ---------- rota ---------- */
    const largRota = () => 1 + (st.escalaTexto - 1) * 0.6;
    /** Trecho da rota (no andar visível) entre o começo e o fim de um passo, seguindo a linha. */
    function caminhoDoPasso(p) {
      for (const t of st.rota.trechos) {
        if (t.piso !== p.piso) continue;
        const iguais = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
        const i = t.pontos.findIndex(q => iguais(q, p.de));
        const j = t.pontos.findIndex((q, n) => n >= Math.max(i, 0) && iguais(q, p.ate));
        if (i >= 0 && j > i) return t.pontos.slice(i, j + 1);
      }
      return [p.de, p.ate];
    }
    function desenharRota() {
      if (!svg) return;
      escalaAplicada = null;
      cam.rota.textContent = ''; cam.setas.textContent = ''; cam.marcas.textContent = ''; kSetas = 0;
      if (st.rota) {
        const lg = largRota();
        const doAndar = st.rota.trechos.filter(t => t.piso === st.piso);
        doAndar.forEach(t => el('path', { d: linha(t.pontos), class: 'rota-contorno', 'stroke-width': 15 * lg, 'vector-effect': 'non-scaling-stroke' }, cam.rota));
        const p = st.rota.passos[st.passo];
        if (p && p.piso === st.piso && (p.de.x !== p.ate.x || p.de.y !== p.ate.y)) {
          const d = linha(caminhoDoPasso(p));
          el('path', { d, class: 'trecho-ativo-borda', 'stroke-width': 25 * lg, 'vector-effect': 'non-scaling-stroke' }, cam.rota);
          el('path', { d, class: 'trecho-ativo', 'stroke-width': 21 * lg, 'vector-effect': 'non-scaling-stroke' }, cam.rota);
        }
        doAndar.forEach(t => el('path', { d: linha(t.pontos), class: 'rota-linha', 'stroke-width': 8 * lg, 'vector-effect': 'non-scaling-stroke' }, cam.rota));
        // troca de andar: anel em volta do elevador ou da escada
        st.rota.trechos.forEach((t, i) => {
          const marcas = [];
          if (t.piso === st.piso && t.saida) marcas.push(t.pontos[t.pontos.length - 1]);
          if (t.piso === st.piso && i > 0) marcas.push(t.pontos[0]);
          marcas.forEach(q => {
            const g = el('g', { class: 'marca-troca', 'data-escala': 1, 'data-x': q.x, 'data-y': q.y }, cam.marcas);
            el('circle', { r: 21 }, g);
          });
        });
        desenharSetas();
      }
      desenharMarcas();
    }
    /** Setas brancas sobre a linha azul, como o piso tátil direcional: mostram o sentido sem animação. */
    function desenharSetas() {
      cam.setas.textContent = '';
      if (!st.rota || !largura) return;
      const kk = k(), esp = 70 * kk, lg = largRota();
      kSetas = kk;
      for (const t of st.rota.trechos) {
        if (t.piso !== st.piso) continue;
        let falta = esp * 0.6;
        for (let i = 1; i < t.pontos.length; i++) {
          const a = t.pontos[i - 1], b = t.pontos[i], L = Math.hypot(b.x - a.x, b.y - a.y);
          if (L < 0.01) continue;
          const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
          let pos = falta;
          while (pos <= L) {
            const x = a.x + (b.x - a.x) * pos / L, y = a.y + (b.y - a.y) * pos / L;
            el('path', { d: 'M-2.4 -3.4L1.8 0L-2.4 3.4', class: 'rota-seta', 'data-escala': lg, 'data-x': x, 'data-y': y, 'data-rot': ang.toFixed(1),
              transform: `translate(${x} ${y}) rotate(${ang.toFixed(1)}) scale(${kk * (1 + (st.escalaTexto - 1) * 0.5) * lg})` }, cam.setas);
            pos += esp;
          }
          falta = pos - L;
        }
      }
    }
    function desenharMarcas() {
      if (!svg) return;
      svg.querySelectorAll('.selecionada').forEach(n => n.classList.remove('selecionada'));
      svg.querySelectorAll('.rotulo-oculto').forEach(n => n.classList.remove('rotulo-oculto'));
      [st.origem, st.destino].forEach(l => l && svg.querySelectorAll(`[data-para="${CSS.escape(l.id)}"]`).forEach(n => n.classList.add('rotulo-oculto')));
      const marca = (lugar, tipo) => {
        if (!lugar || lugar.piso !== st.piso) return;
        svg.querySelectorAll(`.loja-forma[data-id="${CSS.escape(lugar.id)}"], .quiosque-forma[data-id="${CSS.escape(lugar.id)}"]`).forEach(n => n.classList.add('selecionada'));
        const q = tipo === 'origem' && st.rota ? st.rota.trechos[0].pontos[0] : { x: lugar.x, y: lugar.y };
        const g = el('g', { class: 'marca-ponto marca-' + tipo, 'data-escala': 1, 'data-x': q.x, 'data-y': q.y }, cam.marcas);
        g.dataset.id = lugar.id;
        if (tipo === 'origem') {
          el('circle', { r: 13, class: 'marca-halo' }, g);
          el('circle', { r: 10.5, class: 'marca-origem', 'stroke-width': 4 }, g);
          el('circle', { r: 3.5, class: 'marca-origem-centro' }, g);
        } else {
          el('path', { d: 'M0 0c-4-8-14-14-14-24a14 14 0 0 1 28 0c0 10-10 16-14 24z', class: 'marca-halo-traco', 'stroke-width': 7 }, g);
          el('path', { d: 'M0 0c-4-8-14-14-14-24a14 14 0 0 1 28 0c0 10-10 16-14 24z', class: 'marca-destino', 'stroke-width': 2.5 }, g);
          el('circle', { cy: -24, r: 5, class: 'marca-destino-centro' }, g);
        }
        const t = el('text', { x: 0, y: tipo === 'origem' ? -20 : -45, 'text-anchor': 'middle', class: 'rotulo rotulo-marca', 'font-size': 15 }, g);
        // com a bolinha "Você está aqui" (RN75) a partida deixa de dizer "Você:", para não haver dois "você"
        t.textContent = (tipo === 'origem' ? (st.posicao ? 'Partida: ' : 'Você: ') : '') + lugar.nome;
      };
      marca(st.origem, 'origem'); marca(st.destino, 'destino');
      aplicarVB();
    }

    /* ---------- interação: arrastar, pinça, roda do mouse, teclado e toque ---------- */
    function ligarInteracao() {
      const toques = new Map();
      let inicio = null, arrastou = false, pinca = null;
      svg.addEventListener('pointerdown', ev => {
        if (animacao) { cancelAnimationFrame(animacao.id); animacao = null; }
        toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (toques.size === 1) { inicio = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }; arrastou = false; }
        if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, w: vb.w }; }
      });
      svg.addEventListener('pointermove', ev => {
        if (!toques.has(ev.pointerId)) return;
        toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (toques.size === 2 && pinca) {
          const [a, b] = [...toques.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          const c = pontoSVG({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
          zoom((pinca.w * pinca.d / d) / vb.w, c.x, c.y); arrastou = true; return;
        }
        if (!inicio || toques.size > 1) return;
        const dx = ev.clientX - inicio.x, dy = ev.clientY - inicio.y;
        if (!arrastou && Math.hypot(dx, dy) < 6) return;
        if (!arrastou) svg.setPointerCapture?.(ev.pointerId);
        arrastou = true; mexeu = true; svg.classList.add('arrastando');
        const kk = k();
        vb.x = inicio.vx - dx * kk; vb.y = inicio.vy - dy * kk; aplicarVB();
      });
      const soltar = ev => {
        toques.delete(ev.pointerId);
        if (toques.size < 2) pinca = null;
        if (toques.size === 1) { const [a] = [...toques.values()]; inicio = { x: a.x, y: a.y, vx: vb.x, vy: vb.y }; }
        if (!toques.size) { inicio = null; svg.classList.remove('arrastando'); }
      };
      svg.addEventListener('pointerup', soltar);
      svg.addEventListener('pointercancel', soltar);
      svg.addEventListener('click', ev => {
        // clique depois de arrastar não seleciona; o clique dos 2 toques dos gestos (RN76, não confiável) sempre seleciona
        if (arrastou && ev.isTrusted) { arrastou = false; return; }
        arrastou = false;
        const alvo = document.elementsFromPoint(ev.clientX, ev.clientY).map(n => n.closest && n.closest('[data-id]')).find(n => n && svg.contains(n));
        if (alvo && ao.selecionar) ao.selecionar(G.lugarPorId[alvo.dataset.id]);
      });
      svg.addEventListener('wheel', ev => {
        ev.preventDefault();
        const p = pontoSVG(ev);
        zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
      }, { passive: false });
      svg.addEventListener('keydown', ev => {
        const passo = vb.w * 0.1;
        const acoes = {
          ArrowLeft: () => { vb.x -= passo; }, ArrowRight: () => { vb.x += passo; }, ArrowUp: () => { vb.y -= passo; }, ArrowDown: () => { vb.y += passo; },
          '+': () => zoom(1 / 1.25), '=': () => zoom(1 / 1.25), '-': () => zoom(1.25), '0': () => centralizar(false)
        };
        if (!acoes[ev.key]) return;
        ev.preventDefault();
        if (animacao) { cancelAnimationFrame(animacao.id); animacao = null; } // a tecla vale mais que o movimento em curso
        acoes[ev.key](); mexeu = true; aplicarVB();
      });
    }

    function medir() {
      const r = container.getBoundingClientRect();
      const mudou = Math.round(r.width) !== largura || Math.round(r.height) !== altura;
      largura = Math.round(r.width); altura = Math.round(r.height);
      return mudou;
    }

    /* ---------- contrato ---------- */
    return {
      async mount(c) {
        container = c;
        svg = el('svg', { class: 'mapa-svg', role: 'img', tabindex: '0', focusable: 'true', preserveAspectRatio: 'xMidYMid meet' });
        desc = document.createElement('p');
        desc.className = 'sr'; desc.id = 'mapa-svg-desc';
        desc.textContent = 'Arraste ou use as setas do teclado para mover a planta, e as teclas mais e menos para aproximar. Tudo o que está no mapa também está no passo a passo e na lista de lugares do andar.';
        svg.setAttribute('aria-describedby', desc.id);
        for (const nome of ['piso', 'planta', 'rotulos', 'icones', 'rota', 'setas', 'marcas', 'posicao']) cam[nome] = el('g', { class: 'camada-' + nome }, svg);
        container.append(svg, desc);
        medir();
        ligarInteracao();
        new ResizeObserver(() => {
          if (!medir() || !largura) return;
          if (enquadramento && !mexeu) moverPara(enquadramento(), false); else aplicarVB();
        }).observe(container);
        svg.dataset.nomes = st.nomes ? 'sim' : 'nao';
        // primeiro enquadra (a rota do andar, ou o andar inteiro), depois desenha uma vez só, sem animação:
        // a pessoa ainda não viu o mapa, não há de onde animar
        centralizar(false);
        desenharAndar();
      },
      unmount() { if (svg) svg.remove(); if (desc) desc.remove(); svg = null; },
      setFloor(andarId) {
        const p = pisoDe(andarId);
        if (p == null || p === st.piso) return;
        st.piso = p;
        desenharAndar();
      },
      showRoute(rota, pontos = {}) {
        st.rota = rota || null;
        st.origem = (rota && rota.origem) || pontos.origem || null;
        st.destino = (rota && rota.destino) || pontos.destino || null;
        st.passo = rota ? 0 : -1;
        desenharRota();
      },
      focusStep(i) {
        if (!st.rota) return;
        st.passo = Math.max(0, Math.min(st.rota.passos.length - 1, i));
        desenharRota();
        const p = st.rota.passos[st.passo];
        if (p.piso !== st.piso) return;
        const pts = caminhoDoPasso(p);
        enquadrar(() => caixaParaVB(caixaDePontos(pts, 70), 360), true);
      },
      highlight(categoria, ligado) {
        if (ligado) st.destaques.add(categoria); else st.destaques.delete(categoria);
        if (svg) desenharAndar();
      },
      applyTheme() { /* as cores do 2D vêm das variáveis do tema (css/mapa.css): nada a refazer */ },
      applyPreferences(p = {}) {
        if (p.texto) st.escalaTexto = Math.max(1, p.texto / 100);
        if ('evitarEscadas' in p) st.evitarEscadas = !!p.evitarEscadas;
        if ('nomes' in p) st.nomes = !!p.nomes;
        if (svg) { svg.dataset.nomes = st.nomes ? 'sim' : 'nao'; desenharAndar(); }
      },
      capabilities: () => ({ tresD: false, primeiraPessoa: false, zoom: true, selecionar: true }),
      centralizar() { centralizar(true); },
      zoom(f) { zoom(f); },
      setMargens(m) {
        const antes = JSON.stringify(st.margens);
        st.margens = { topo: 0, direita: 0, base: 0, esquerda: 0, ...m };
        if (JSON.stringify(st.margens) !== antes && enquadramento && !mexeu && largura) moverPara(enquadramento(), true);
      },
      setAvisos(lista) { st.avisos = lista || []; if (svg) desenharAndar(); },
      setPosicao(id) {
        const tinha = !!st.posicao;
        st.posicao = id ? local.lugar(id) || null : null;
        if (tinha !== !!st.posicao) desenharRota(); // o rótulo da partida muda ("Você:" ↔ "Partida:")
        desenharPosicao();
      },
      get posicao() { return st.posicao ? st.posicao.id : null; },
      get andar() { const a = local.andares.find(x => x.ordem === st.piso); return a ? a.id : null; },
      elemento: () => svg
    };
  }

  raiz.NaviMapa2D = { criar };
})(typeof window !== 'undefined' ? window : globalThis);
