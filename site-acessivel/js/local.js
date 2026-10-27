/* Navi — locais. Cada local mora em locais/<slug>/ e se registra com naviLocal('<slug>').
   Arquivos de um local: config.js e avisos.js (editados pela equipe); dados.js, grafo.js,
   malha.js e dados3d.js (gerados por ferramentas/dados/gerar-local.mjs a partir da planta).
   Um local ainda sem planta (config.dadosProntos === false) carrega só config.js e avisos.js.
   Funciona por file:// (scripts clássicos) e no Node (testes). */
(function (raiz) {
  'use strict';
  const registros = raiz.NAVI_LOCAIS = raiz.NAVI_LOCAIS || {};
  raiz.naviLocal = function (slug) { return registros[slug] || (registros[slug] = {}); };

  const SLUG = /^[a-z0-9-]{1,40}$/;
  const PADRAO = 'shopping-estacao';

  /** Slug pedido em ?local=, se for válido e estiver no índice; senão, o local padrão do índice. */
  function slugDaUrl(search, indice) {
    const lista = indice || raiz.NAVI_LOCAIS_INDICE || [];
    const padrao = (lista.find(l => l.padrao) || lista[0] || {}).slug || PADRAO;
    const pedido = (new URLSearchParams(search || '').get('local') || '').trim().toLowerCase();
    return pedido && SLUG.test(pedido) && lista.some(l => l.slug === pedido) ? pedido : padrao;
  }

  /** Junta config, grafo e geometria num objeto só, com lugares canônicos. Não altera o registro. */
  function montar(slug, reg) {
    const config = reg.config || {};
    const grafo = reg.grafo || null;
    const dados = reg.dados || null;
    const fonteAndares = grafo ? grafo.andares : (config.andares || []);
    const andares = fonteAndares.slice().sort((a, b) => a.ordem - b.ordem).map(a => ({ ...a, piso: a.ordem }));
    const andarPorId = {};
    for (const a of andares) andarPorId[a.id] = a;
    const noPorId = {};
    if (grafo) for (const n of grafo.nos) noPorId[n.id] = n;
    const e = (grafo && grafo.escala_m_por_unidade) || 1;

    const lugares = [];
    const porChave = new Map();
    if (grafo) for (const l of grafo.lugares) {
      const f = (dados && dados.formas && dados.formas[l.id]) || {};
      const andar = andarPorId[l.andar];
      const no = noPorId[l.no_porta];
      const x = f.x != null ? f.x : (no ? no.pos[0] / e : 0);
      const y = f.y != null ? f.y : (no ? no.pos[2] / e : 0);
      const lugar = {
        id: l.id, nome: l.nome, categoria: l.categoria, cat: l.categoria, andar: l.andar, piso: andar ? andar.ordem : null,
        x, y, w: f.w != null ? f.w : 24, h: f.h != null ? f.h : 24, r: f.r || 0, poly: f.poly != null ? f.poly : -1,
        aliases: (l.aliases || []).slice(), no_porta: l.no_porta, codigo: l.codigo != null ? l.codigo : null,
        acessivel: l.acessivel != null ? l.acessivel : null, busca: l.busca || ''
      };
      if (f.estimado) lugar.estimado = true;
      lugares.push(lugar);
      porChave.set(lugar.id, lugar);
    }
    for (const l of lugares) for (const a of l.aliases) if (!porChave.has(a)) porChave.set(a, l);

    const porOrdem = obj => {
      const out = {};
      if (obj) for (const a of andares) if (obj[a.id] !== undefined) out[a.ordem] = obj[a.id];
      return out;
    };
    return {
      slug, config, avisos: reg.avisos || [], grafo, dados, malha: reg.malha || null, lajes: reg.lajes || null,
      andares, lugares,
      pendente: !grafo,
      lugar: chave => (chave != null && porChave.get(String(chave))) || null,
      andarPorPiso: piso => andares.find(a => a.ordem === piso) || null,
      legado: { places: lugares, plantas: porOrdem(dados && dados.plantas), pisos: porOrdem(dados && dados.pisos) }
    };
  }

  function injetar(src) {
    return new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = () => ok();
      s.onerror = () => erro(new Error('Falhou: ' + src));
      document.head.appendChild(s);
    });
  }

  /** Carrega os arquivos do local no navegador e devolve o local montado. */
  async function carregar(slug, opcoes = {}) {
    const base = (opcoes.base || 'locais/') + slug + '/';
    const reg = raiz.naviLocal(slug);
    try {
      if (!reg.config) await Promise.all([injetar(base + 'config.js'), injetar(base + 'avisos.js')]);
      if (reg.config && reg.config.dadosProntos !== false) {
        const lista = [];
        if (!reg.dados) lista.push(injetar(base + 'dados.js'));
        if (!reg.grafo) lista.push(injetar(base + 'grafo.js'));
        // a malha só deixa o traçado mais suave: sem ela (sem internet e ainda fora do cache), a rota continua certa
        if (opcoes.malha !== false && !reg.malha) lista.push(injetar(base + 'malha.js').catch(() => null));
        await Promise.all(lista);
      }
    } catch (e) {
      throw new Error('Não foi possível carregar os dados do local ' + slug + '.');
    }
    return montar(slug, reg);
  }

  /** Carrega as lajes do 3D (só quando o 3D é pedido). */
  async function carregarLajes(local, opcoes = {}) {
    const reg = raiz.naviLocal(local.slug);
    if (!reg.lajes) await injetar((opcoes.base || 'locais/') + local.slug + '/dados3d.js');
    local.lajes = reg.lajes || {};
    return local.lajes;
  }

  const api = { slugDaUrl, montar, carregar, carregarLajes, PADRAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviLocal = api;
})(typeof window !== 'undefined' ? window : globalThis);
