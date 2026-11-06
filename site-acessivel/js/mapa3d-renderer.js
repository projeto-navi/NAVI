/* Navi — Map3DProceduralRenderer: adaptador do contrato MapRenderer (js/mapa-renderer.js) sobre o
   js/mapa3d.js. Só é carregado quando a pessoa pede o 3D (RN45): traz junto o Three.js, o 3D e as lajes
   do local. Rota, andar e destino são os mesmos do 2D e da primeira pessoa (RN48). */
(function (raiz) {
  'use strict';

  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const pronto = src.includes('three') ? raiz.THREE : src.includes('glb') ? raiz.NaviGLB : raiz.NaviMapa3D;
      if (document.querySelector(`script[src="${src}"]`) && pronto) { ok(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = () => ok(); s.onerror = () => erro(new Error('Falhou: ' + src));
      document.head.appendChild(s);
    });
  }
  function carregarCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
    return new Promise(ok => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.onload = ok; l.onerror = ok;
      document.head.appendChild(l);
    });
  }

  /**
   * @param {object} o
   * @param {object} o.local local montado (NaviLocal)
   * @param {object} o.G grafo do motor
   * @param {(piso: number) => string} o.nomeAndar
   * @param {{selecionar?: Function, anunciar?: Function, saiuPrimeiraPessoa?: Function}} [o.ao]
   * @returns {object} MapRenderer com os extras do 3D (primeiraPessoa, vistaDeCima, ambos, pausar, continuar)
   */
  function criar(o) {
    const local = o.local, ao = o.ao || {};
    const cfg = local.config || {};
    const coresEntradas = cfg.coresEntradas || {};
    let m3d = null, caixa = null;
    // estado no formato que o js/mapa3d.js lê
    const E = { piso: local.andares.length ? local.andares[0].ordem : 1, rota: null, passo: 0, origem: null, destino: null, nomes: false, evitarEscadas: false, avisos: [] };
    const pisoDe = andarId => { const a = local.andares.find(x => x.id === andarId || x.ordem === andarId); return a ? a.ordem : null; };
    const corEntrada = l => {
      const h = document.documentElement;
      if (h.classList.contains('contraste') || h.classList.contains('daltonismo')) return null;
      if (coresEntradas[l.id]) return coresEntradas[l.id];
      const a = (l.aliases || []).find(x => coresEntradas[x]);
      return a ? coresEntradas[a] : null;
    };
    const enquadrarRota = () => {
      const t = E.rota && E.rota.trechos.find(x => x.piso === E.piso);
      if (t) m3d.focar(t.pontos, t.piso); else m3d.ajustar();
    };

    return {
      async mount(container) {
        const mod = cfg.modelo3d || null;
        await Promise.all([carregarScript('js/three-navi.min.js'), raiz.NaviLocal.carregarLajes(local), carregarCss('css/mapa3d.css'),
          mod ? carregarScript('js/glb-leitor.js') : null]);
        await carregarScript('js/mapa3d.js');
        // local com modelo .glb: o prédio vem do arquivo (baixado só agora, quando o 3D é pedido)
        const modelo = mod && raiz.NaviGLB ? {
          cena: raiz.NaviGLB.baixar(`locais/${local.slug}/${mod.arquivo}`).then(buf => raiz.NaviGLB.ler(buf, raiz.THREE)),
          unidadesPorMetro: mod.unidadesPorMetro, deslocamento: mod.deslocamento, alturaAndar: mod.alturaAndar,
          piso: andarId => pisoDe(andarId)
        } : null;
        caixa = document.createElement('div');
        caixa.className = 'mapa3d';
        container.appendChild(caixa);
        m3d = raiz.NaviMapa3D.iniciar(caixa, local.legado, o.G, {
          selecionar: ao.selecionar, anunciar: ao.anunciar,
          saiuPrimeiraPessoa: () => { if (ao.saiuPrimeiraPessoa) ao.saiuPrimeiraPessoa(); }
        }, { lajes: local.lajes, nomeAndar: o.nomeAndar, textos: cfg.textos, corEntrada, modelo });
        if (!m3d) { caixa.remove(); throw new Error('Sem WebGL'); }
        m3d.mostrar(true);
      },
      unmount() {
        if (m3d) { m3d.mostrar(false); m3d.renderer.dispose(); }
        if (caixa) caixa.remove();
        m3d = null; caixa = null;
      },
      setFloor(andarId) {
        const p = pisoDe(andarId);
        if (p == null || !m3d) return;
        E.piso = p;
        m3d.atualizar(E);
      },
      showRoute(rota, pontos = {}) {
        E.rota = rota || null;
        E.origem = (rota && rota.origem) || pontos.origem || null;
        E.destino = (rota && rota.destino) || pontos.destino || null;
        E.passo = 0;
        if (m3d) m3d.atualizar(E);
      },
      focusStep(i) {
        if (!E.rota || !m3d) return;
        E.passo = Math.max(0, Math.min(E.rota.passos.length - 1, i));
        m3d.atualizar(E);
        const p = E.rota.passos[E.passo];
        if (m3d.emPrimeiraPessoa || p.piso !== E.piso) return;
        const folga = 160, xs = [p.de.x, p.ate.x], ys = [p.de.y, p.ate.y];
        m3d.focar([{ x: Math.min(...xs) - folga, y: Math.min(...ys) - folga / 2 }, { x: Math.max(...xs) + folga, y: Math.max(...ys) + folga / 2 }], p.piso);
      },
      highlight() { /* o 3D mostra os ícones de serviço sempre; o destaque fica com o 2D */ },
      applyTheme() { if (m3d) { m3d.cores(); m3d.atualizar(E); } },
      applyPreferences(p = {}) {
        if ('nomes' in p) E.nomes = !!p.nomes;
        if ('evitarEscadas' in p) E.evitarEscadas = !!p.evitarEscadas;
        if (m3d) m3d.atualizar(E);
      },
      capabilities: () => ({ tresD: true, primeiraPessoa: true, zoom: true, selecionar: true }),
      centralizar() { if (m3d && !m3d.emPrimeiraPessoa) enquadrarRota(); },
      zoom(f) { if (m3d) m3d.zoom(f); },
      setMargens() { /* o 3D enquadra pela caixa do andar; os controles flutuam por cima */ },
      setAvisos(lista) { E.avisos = lista || []; if (m3d) m3d.atualizar(E); },
      setPosicao(id) { E.posicao = id ? local.lugar(id) || null : null; if (m3d) m3d.atualizar(E); },
      get posicao() { return E.posicao ? E.posicao.id : null; },
      /* extras do 3D */
      primeiraPessoa(passo) { if (!m3d) return false; E.passo = passo || 0; return m3d.primeiraPessoa(E); },
      sairPrimeiraPessoa(silencioso) { if (m3d && m3d.emPrimeiraPessoa) m3d.sairPrimeiraPessoa(silencioso); },
      get emPrimeiraPessoa() { return !!(m3d && m3d.emPrimeiraPessoa); },
      vistaDeCima() { if (m3d) m3d.vistaDeCima(); },
      ambos(on) { if (!m3d) return; m3d.ambos(on); m3d.atualizar(E); m3d.ajustar(); },
      get emAmbos() { return !!(m3d && m3d.emAmbos); },
      pausar() { if (m3d) m3d.mostrar(false); },
      continuar() { if (m3d) { m3d.mostrar(true); m3d.atualizar(E); } }
    };
  }

  raiz.NaviMapa3DRenderer = { criar };
})(typeof window !== 'undefined' ? window : globalThis);
