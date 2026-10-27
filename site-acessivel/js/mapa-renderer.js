/* Navi — MapRenderer: o contrato dos mapas (2D e 3D intercambiáveis, só na Página do Mapa).
   Não há TypeScript nem build: o contrato fica aqui em JSDoc e cada implementação segue os mesmos nomes.
   Implementações:
   - NaviMapa2D (js/mapa2d.js): a planta em SVG, padrão (RN45).
   - NaviMapa3DRenderer (js/mapa3d-renderer.js): adaptador sobre o js/mapa3d.js, carregado só quando pedido.
   - Map3DGlbRenderer: ainda não existe. Ver o comentário no fim deste arquivo.
   - semPlanta (aqui): para o local que já tem rotas mas ainda não tem a planta desenhada. */
(function (raiz) {
  'use strict';

  /**
   * @typedef {object} PontosDaRota
   * @property {object|null} origem lugar de partida
   * @property {object|null} destino lugar de destino
   */
  /**
   * @typedef {object} MapRenderer
   * @property {(container: HTMLElement) => Promise<void>} mount  desenha dentro do container (#navi-map-slot)
   * @property {() => void} unmount  remove tudo o que criou
   * @property {(andarId: string) => void} setFloor  mostra um andar (id do grafo, ex.: "P01")
   * @property {(rota: object|null, pontos?: PontosDaRota) => void} showRoute  rota com os trechos refinados; sem rota, só os pontos
   * @property {(indice: number) => void} focusStep  destaca e enquadra um passo (o andar já deve estar certo)
   * @property {(categoria: 'PISO_TATIL'|'RAMPA'|'ELEVADOR'|'ACESSO', ligado: boolean) => void} highlight
   * @property {(tokens?: object) => void} applyTheme  relê as cores do tema ativo (css/tokens.css)
   * @property {(prefs: {texto?: number, reduzirMovimento?: boolean, evitarEscadas?: boolean, nomes?: boolean}) => void} applyPreferences
   * @property {() => {tresD: boolean, primeiraPessoa: boolean, zoom: boolean, selecionar: boolean}} capabilities
   *
   * Extras usados pela Página do Mapa (todos os renderizadores têm):
   * @property {() => void} centralizar  enquadra a rota no andar visível (ou o andar inteiro)
   * @property {(fator: number) => void} zoom  < 1 aproxima, > 1 afasta
   * @property {(m: {topo: number, direita: number, base: number, esquerda: number}) => void} setMargens
   *           área coberta por controles e pelo painel, em px: o enquadramento evita essas bordas
   * @property {(avisos: object[]) => void} setAvisos  avisos de interdição (marcas no mapa)
   */

  /** Categorias de destaque do contrato → categorias de lugar dos dados. */
  const DESTAQUES = {
    PISO_TATIL: ['piso_tatil'],
    RAMPA: ['rampa'],
    ELEVADOR: ['elevador', 'plataforma'],
    ACESSO: ['entrada', 'saida', 'vaga_pcd']
  };

  /** O 3D só é oferecido com WebGL e mais de 2 GB de memória (spec do Marco 1). */
  function pode3D() {
    const mem = raiz.navigator && raiz.navigator.deviceMemory;
    if (mem && mem <= 2) return { ok: false, motivo: 'Este aparelho tem pouca memória para o mapa 3D. Continuamos no mapa 2D.' };
    try {
      const c = document.createElement('canvas');
      const ok = !!(raiz.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
      return ok ? { ok: true } : { ok: false, motivo: 'O mapa 3D não funciona neste navegador. Continuamos no mapa 2D.' };
    } catch (e) {
      return { ok: false, motivo: 'O mapa 3D não funciona neste navegador. Continuamos no mapa 2D.' };
    }
  }

  /**
   * Local com grafo mas sem planta desenhada: mostra o aviso no lugar do mapa.
   * A rota continua inteira no passo a passo (RN20).
   * @returns {MapRenderer}
   */
  function semPlanta(o) {
    const txt = (o.local.config && o.local.config.textos) || {};
    let raizEl = null;
    return {
      async mount(container) {
        raizEl = document.createElement('div');
        raizEl.className = 'mapa-sem-planta';
        raizEl.innerHTML = `<div class="mapa-sem-planta-caixa"><span class="tile tile-acao" aria-hidden="true">${raiz.NaviIcones.svg('i-plano')}</span>` +
          `<p><b>${o.esc(txt.preparacaoTitulo || 'A planta deste local está em preparação')}</b></p>` +
          `<p>${o.esc(txt.emPreparacao || 'A planta dos andares ainda vai ser adicionada.')} Siga o passo a passo.</p></div>`;
        container.appendChild(raizEl);
      },
      unmount() { if (raizEl) raizEl.remove(); raizEl = null; },
      setFloor() {}, showRoute() {}, focusStep() {}, highlight() {}, applyTheme() {}, applyPreferences() {},
      capabilities: () => ({ tresD: false, primeiraPessoa: false, zoom: false, selecionar: false }),
      centralizar() {}, zoom() {}, setMargens() {}, setAvisos() {}
    };
  }

  /* Map3DGlbRenderer (Marco 3, Prompt 2): vai ler os modelos .glb de cada andar, com os mesmos métodos acima.
     Exige reempacotar o Three.js com GLTFLoader e MeshoptDecoder (esbuild), carregados só quando pedidos.
     O grafo continua sendo a única fonte de conectividade: o modelo é só a aparência. */

  raiz.NaviMapa = { DESTAQUES, pode3D, semPlanta };
})(typeof window !== 'undefined' ? window : globalThis);
