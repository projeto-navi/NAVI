/* Navi — painel do passo a passo (bottom sheet) da Página do Mapa.
   Celular em pé: três estados — recolhido (passo atual e Anterior/Próximo/Repetir), médio (selo e os
   próximos passos) e expandido (passo a passo inteiro e as ações).
   - A alça é um botão de verdade (aria-expanded, aria-controls): um toque troca o estado. Arrastar é
     só um atalho (WCAG 2.5.7). Esc recolhe. Não prende o foco.
   - O que fica abaixo da borda da tela no estado atual recebe "inert": o foco nunca vai parar num
     elemento escondido (WCAG 2.4.11).
   - Celular deitado, telas a partir de 768 px e "Esconder mapa": o mesmo conteúdo vira um painel
     fixo, sem estados (RN42).
   Movimento: só transform, com a curva de gaveta; sem animação com "reduzir movimento" (RN44). */
(function (raiz) {
  'use strict';
  const ESTADOS = ['recolhido', 'medio', 'expandido'];
  const ROTULO = {
    recolhido: 'Mostrar mais do passo a passo',
    medio: 'Mostrar o passo a passo inteiro',
    expandido: 'Recolher o passo a passo'
  };
  const VELOCIDADE_MIN = 0.11; // px/ms: um peteleco basta, sem precisar arrastar até o fim

  /**
   * @param {object} o
   * @param {HTMLElement} o.folha o painel inteiro
   * @param {HTMLElement} o.cabeca área de arrasto (título e resumo)
   * @param {HTMLButtonElement} o.alca botão da alça
   * @param {HTMLElement} o.corpo parte rolável
   * @param {HTMLElement} o.mais tudo o que não aparece no estado recolhido
   * @param {HTMLElement} o.medio bloco do estado médio (dentro de o.mais)
   * @param {HTMLElement} o.expandido bloco do estado expandido (dentro de o.mais)
   * @param {string} [o.consultaPainel] media query do modo painel
   * @param {(estado: string, visivelPx: number, emPainel: boolean) => void} [o.aoMudar]
   * @param {() => void} [o.aoSemEspaco] o passo atual não cabe no painel recolhido (texto muito grande)
   */
  function criar(o) {
    const { folha, cabeca, alca, corpo, mais, medio, expandido } = o;
    const mq = raiz.matchMedia(o.consultaPainel || '(min-width: 768px), (orientation: landscape)');
    let estado = 'recolhido', visivel = 0, arrasto = null, ignorarClique = false, cheia = false;

    const emPainel = () => mq.matches || document.body.classList.contains('sem-mapa');
    const seguranca = () => parseFloat(getComputedStyle(folha).getPropertyValue('--folha-seguranca')) || 0;
    const topoRel = el => el.getBoundingClientRect().top - folha.getBoundingClientRect().top + corpo.scrollTop;

    function alturas() {
      const H = folha.offsetHeight;
      const rec = Math.min(H, Math.round(topoRel(mais) + seguranca()));
      const fimMedio = Math.round(topoRel(expandido) + seguranca());
      const med = Math.min(H, Math.max(rec + 1, Math.min(fimMedio, raiz.innerHeight * 0.62)));
      return { H, recolhido: rec, medio: med, expandido: H };
    }
    // só escreve o que mudou: cada escrita à toa obriga o navegador a medir a página de novo
    const definirInert = (el, v) => { if (el.inert !== v) el.inert = v; };
    function posicionar(v, imediato, a = alturas()) {
      visivel = v;
      folha.classList.toggle('arrastando', !!imediato);
      const t = `translateY(${Math.max(0, a.H - v)}px)`;
      if (folha.style.transform !== t) folha.style.transform = t;
    }
    function aplicar(opcoes = {}) {
      if (emPainel()) {
        if (folha.style.transform) folha.style.transform = '';
        if (folha.dataset.estado !== 'painel') folha.dataset.estado = 'painel';
        definirInert(mais, false); definirInert(medio, false); definirInert(expandido, false);
        visivel = 0;
        if (o.aoMudar) o.aoMudar('painel', 0, true);
        return;
      }
      if (!folha.offsetHeight) return; // painel escondido (primeira pessoa no celular): nada a medir
      let a = alturas(), remedir = false;
      // o passo atual não cabe no recolhido: o painel rola em qualquer estado e a página é avisada
      const agoraCheia = a.recolhido >= a.H * 0.8;
      if (agoraCheia !== cheia) { cheia = agoraCheia; folha.dataset.cheia = cheia ? 'sim' : 'nao'; remedir = true; if (cheia && o.aoSemEspaco) o.aoSemEspaco(); }
      if (folha.dataset.estado !== estado) { folha.dataset.estado = estado; remedir = true; }
      if (estado !== 'expandido' && corpo.scrollTop) corpo.scrollTop = 0;
      if (remedir) a = alturas();
      posicionar(a[estado], opcoes.imediato, a);
      definirInert(mais, estado === 'recolhido');
      definirInert(expandido, estado !== 'expandido');
      definirInert(medio, estado === 'recolhido');
      const aberto = String(estado !== 'recolhido');
      if (alca.getAttribute('aria-expanded') !== aberto) alca.setAttribute('aria-expanded', aberto);
      const rot = alca.querySelector('[data-rotulo]');
      if (rot && rot.textContent !== ROTULO[estado]) rot.textContent = ROTULO[estado];
      if (o.aoMudar) o.aoMudar(estado, a[estado], false);
    }
    function definir(novo, opcoes = {}) {
      if (!ESTADOS.includes(novo)) return;
      const mudou = novo !== estado;
      estado = novo;
      aplicar();
      if (opcoes.focar) opcoes.focar.focus({ preventScroll: true });
      return mudou;
    }

    /* um toque na alça: recolhido → médio → expandido → recolhido */
    alca.addEventListener('click', () => {
      if (ignorarClique) { ignorarClique = false; return; }
      definir(estado === 'recolhido' ? 'medio' : estado === 'medio' ? 'expandido' : 'recolhido');
    });
    alca.addEventListener('keydown', ev => {
      const i = ESTADOS.indexOf(estado);
      if (ev.key === 'ArrowUp' && i < 2) { ev.preventDefault(); definir(ESTADOS[i + 1]); }
      if (ev.key === 'ArrowDown' && i > 0) { ev.preventDefault(); definir(ESTADOS[i - 1]); }
    });
    folha.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && !emPainel() && estado !== 'recolhido') { ev.preventDefault(); definir('recolhido', { focar: alca }); }
    });
    /* o foco nunca fica escondido abaixo da borda da tela */
    folha.addEventListener('focusin', ev => {
      if (emPainel() || estado === 'expandido') return;
      const r = ev.target.getBoundingClientRect();
      if (r.bottom > raiz.innerHeight - 1) definir('expandido');
    });

    /* arrastar a cabeça do painel (atalho; a alça faz o mesmo com um toque) */
    cabeca.addEventListener('pointerdown', ev => {
      if (emPainel() || arrasto || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      arrasto = { id: ev.pointerId, y0: ev.clientY, t0: performance.now(), base: visivel, moveu: false };
    });
    cabeca.addEventListener('pointermove', ev => {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      const dy = ev.clientY - arrasto.y0;
      if (!arrasto.moveu && Math.abs(dy) < 6) return;
      if (!arrasto.moveu) { arrasto.moveu = true; cabeca.setPointerCapture?.(ev.pointerId); }
      const a = alturas();
      let v = arrasto.base - dy;
      // além dos limites o painel segue com atrito, em vez de parar de repente
      if (v > a.expandido) v = a.expandido + (v - a.expandido) * 0.2;
      if (v < a.recolhido) v = a.recolhido - (a.recolhido - v) * 0.2;
      posicionar(v, true);
    });
    const soltar = ev => {
      if (!arrasto || ev.pointerId !== arrasto.id) return;
      const { moveu, y0, t0 } = arrasto;
      arrasto = null;
      if (!moveu) return; // foi um toque: o clique da alça decide
      ignorarClique = true; setTimeout(() => { ignorarClique = false; }, 0);
      const dy = ev.clientY - y0, vel = dy / Math.max(1, performance.now() - t0);
      const a = alturas(), i = ESTADOS.indexOf(estado);
      let novo;
      if (Math.abs(vel) > VELOCIDADE_MIN) novo = ESTADOS[Math.max(0, Math.min(2, i + (vel < 0 ? 1 : -1)))];
      else novo = ESTADOS.reduce((m, e) => (Math.abs(a[e] - visivel) < Math.abs(a[m] - visivel) ? e : m), 'recolhido');
      estado = novo;
      aplicar();
    };
    cabeca.addEventListener('pointerup', soltar);
    cabeca.addEventListener('pointercancel', soltar);

    const recalcular = () => { if (!arrasto) aplicar({ imediato: true }); };
    mq.addEventListener ? mq.addEventListener('change', recalcular) : mq.addListener(recalcular);
    raiz.addEventListener('resize', recalcular);
    new ResizeObserver(recalcular).observe(cabeca);

    aplicar({ imediato: true });
    return {
      definir,
      /** Recalcula as alturas (o texto do passo mudou de tamanho, por exemplo). */
      atualizar: () => aplicar({ imediato: true }),
      get estado() { return emPainel() ? 'painel' : estado; },
      emPainel
    };
  }

  raiz.NaviFolha = { criar, ESTADOS };
})(typeof window !== 'undefined' ? window : globalThis);
