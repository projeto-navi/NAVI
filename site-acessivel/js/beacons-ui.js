/* Navi — telas dos beacons no app Android (RN71–RN74, propostas).
   Página de Rota: cartão "Encontrar onde você está" (permissões e busca) e "Você está perto de".
   Página do Mapa: faixa "Você está perto de" com "Recalcular daqui".
   No navegador comum não faz nada: só liga quando NaviBeaconsApp está disponível. */
(function (raiz) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = id => (raiz.NaviIcones ? raiz.NaviIcones.svg(id) : '');
  const TEXTO_PRIVACIDADE = 'O Navi usa o Bluetooth e a localização do celular só para perceber os beacons do prédio. Nada sai do seu celular.';
  const PAUSA = {
    bluetooth: { texto: 'O Bluetooth foi desligado. A busca está pausada.', botao: 'Ligar o Bluetooth', acao: 'bluetooth' },
    localizacao: { texto: 'A localização foi desligada. A busca está pausada.', botao: 'Ligar a localização', acao: 'localizacao' }
  };
  const AJUDA_PERMISSAO = 'A permissão foi negada. Sem ela, o Navi não percebe os beacons. Para permitir: Configurações → Apps → Navi → Permissões → Dispositivos por perto e Localização.';

  function injetar(src) {
    return new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = falha;
      document.head.appendChild(s);
    });
  }
  async function listaDoLocal(slug) {
    const reg = () => (raiz.NAVI_LOCAIS && raiz.NAVI_LOCAIS[slug]) || {};
    if (!reg().beacons) { try { await injetar('locais/' + slug + '/beacons.js'); } catch (e) { return null; } }
    const b = reg().beacons;
    return b && Array.isArray(b.lista) && b.lista.length ? b : null;
  }

  /**
   * @param {{pagina: 'rota'|'mapa', local: object, slug: string, origem?: () => string|null,
   *          destino?: () => string|null, anunciar?: (t: string) => void, app?: object}} o
   */
  async function ligar(o) {
    const nada = { parar() {} };
    if (!raiz.NaviBeaconsApp || !raiz.NaviBeacons) return nada;
    const app = o.app || raiz.NaviBeaconsApp.criar();
    if (!app.disponivel()) return nada;
    const beacons = await listaDoLocal(o.slug);
    if (!beacons) return nada;

    const NB = raiz.NaviBeacons, NC = raiz.NaviCategorias;
    const anunciar = o.anunciar || (() => {});
    const rastreador = NB.criarRastreador({ uuid: beacons.uuid, raioPadrao: beacons.raioPadrao, lista: beacons.lista });
    const st = { aberto: false, situacao: null, negada: false, pausa: null, perto: null, ocupado: false };
    const lugar = id => o.local.lugar(id);
    const andar = l => (NC ? NC.descricao(l, o.local).split(',')[0] : '');
    const textoPerto = l => `Você está perto de: ${l.nome}${andar(l) ? ` (${andar(l)})` : ''}`;

    let area = null, faixa = null;
    if (o.pagina === 'rota') area = document.getElementById('beacons-area');
    else {
      faixa = document.createElement('div');
      faixa.id = 'beacons-faixa'; faixa.className = 'beacons-faixa'; faixa.setAttribute('role', 'status'); faixa.hidden = true;
      document.body.appendChild(faixa);
    }
    if (o.pagina === 'rota' && !area) return nada;

    /* ---------- Página de Rota ---------- */
    function linha(nome, ok, textoOk, botao, acao) {
      return `<li><span class="beacons-linha-nome">${esc(nome)}</span>` +
        (ok ? `<span class="etiqueta etiqueta-ok">${svg('i-ok')}${esc(textoOk)}</span>`
          : `<button type="button" class="btn" data-acao="${acao}">${esc(botao)}</button>`) + `</li>`;
    }
    function htmlPainel() {
      const s = st.situacao || { bluetooth: false, localizacao: false, permissao: 'perguntar' };
      const permitida = s.permissao === 'permitida';
      const pronto = s.bluetooth && s.localizacao && permitida;
      return `<div class="beacons-painel pilha" id="beacons-painel">
          <p>${esc(TEXTO_PRIVACIDADE)}</p>
          <ul class="beacons-linhas" aria-label="O que o Navi precisa">
            ${linha('Bluetooth', s.bluetooth, 'Ligado', 'Ligar o Bluetooth', 'bluetooth')}
            ${linha('Localização', s.localizacao, 'Ligada', 'Ligar a localização', 'localizacao')}
            ${linha('Permissão', permitida, 'Permitida', 'Permitir', 'permitir')}
          </ul>
          ${st.negada || s.permissao === 'negada' ? `<div class="faixa-aviso">${svg('i-aviso')}<p>${esc(AJUDA_PERMISSAO)}</p></div>` : ''}
          <button type="button" class="btn btn-primario" data-acao="comecar" ${pronto ? '' : 'disabled'}>Começar a procurar</button>
        </div>`;
    }
    function htmlAtivo() {
      let corpo;
      if (st.pausa) {
        const p = PAUSA[st.pausa];
        corpo = `<div class="faixa-aviso">${svg('i-aviso')}<p>${esc(p.texto)}</p></div>
          <button type="button" class="btn" data-acao="${p.acao}">${esc(p.botao)}</button>`;
      } else if (st.perto && lugar(st.perto)) {
        corpo = `<p class="beacons-perto">${esc(textoPerto(lugar(st.perto)))}</p>
          <button type="button" class="btn btn-primario" data-acao="sair-daqui">Sair daqui</button>`;
      } else {
        corpo = `<p class="texto-2">Procurando beacons por perto…</p>`;
      }
      return `<div class="beacons-ativo pilha" role="status">${corpo}</div>
        <button type="button" class="btn-texto" data-acao="parar">Parar de procurar</button>`;
    }
    function renderRota() {
      const ativo = app.procurando();
      area.innerHTML = `<section class="beacons-cartao pilha" aria-labelledby="beacons-titulo">
          <h2 id="beacons-titulo" class="beacons-titulo">${svg('i-voce')}${ativo ? 'Perto de você' : 'Localização por beacons'}</h2>
          ${ativo ? htmlAtivo() : `<button type="button" class="btn" data-acao="abrir" aria-expanded="${st.aberto}" aria-controls="beacons-painel">Encontrar onde você está</button>
          ${st.aberto ? htmlPainel() : ''}`}
        </section>`;
      area.querySelectorAll('[data-acao]').forEach(b => { b.onclick = () => agir(b.dataset.acao); });
    }

    /* ---------- Página do Mapa ---------- */
    function renderMapa() {
      // logo abaixo da barra do topo, seja qual for a altura dela (texto grande, nomes longos)
      const topo = document.getElementById('mapa-topo');
      if (topo) faixa.style.top = Math.round(topo.getBoundingClientRect().bottom + 8) + 'px';
      if (st.pausa) {
        const p = PAUSA[st.pausa];
        faixa.innerHTML = `${svg('i-aviso')}<p>${esc(p.texto)}</p><button type="button" class="btn" data-acao="${p.acao}">${esc(p.botao)}</button>`;
        faixa.hidden = false;
      } else if (st.perto && lugar(st.perto) && st.perto !== (o.origem && o.origem())) {
        const l = lugar(st.perto);
        faixa.innerHTML = st.perto === (o.destino && o.destino())
          ? `${svg('i-ok')}<p>Você chegou: ${esc(l.nome)}</p>`
          : `${svg('i-voce')}<p>${esc(textoPerto(l))}</p><button type="button" class="btn" data-acao="recalcular">Recalcular daqui</button>`;
        faixa.hidden = false;
      } else {
        faixa.hidden = true; faixa.innerHTML = '';
      }
      faixa.querySelectorAll('[data-acao]').forEach(b => { b.onclick = () => agir(b.dataset.acao); });
    }
    const render = () => (o.pagina === 'rota' ? renderRota() : renderMapa());

    /* ---------- ações ---------- */
    async function atualizarSituacao() { st.situacao = await app.situacao(); render(); }
    async function agir(acao) {
      if (st.ocupado) return;
      st.ocupado = true;
      try {
        if (acao === 'abrir') { st.aberto = !st.aberto; if (st.aberto) await atualizarSituacao(); else render(); }
        else if (acao === 'bluetooth') { await app.ligarBluetooth().catch(() => { st.negada = true; }); await depoisDeLigar(); }
        else if (acao === 'localizacao') { await app.ligarLocalizacao().catch(() => { st.negada = true; }); await depoisDeLigar(); }
        else if (acao === 'permitir') { st.negada = !(await app.permitir()); await atualizarSituacao(); }
        else if (acao === 'comecar') { await comecar(true); }
        else if (acao === 'parar') { await app.parar(); st.perto = null; st.pausa = null; st.aberto = false; render(); anunciar('A busca por beacons foi desligada.'); }
        else if (acao === 'sair-daqui' && st.perto) { location.href = 'index.html?origem=' + encodeURIComponent(st.perto); }
        else if (acao === 'recalcular' && st.perto && o.destino) {
          location.replace('mapa.html?origem=' + encodeURIComponent(st.perto) + '&destino=' + encodeURIComponent(o.destino()));
        }
      } finally {
        st.ocupado = false;
      }
    }
    async function depoisDeLigar() {
      const s = await app.situacao();
      st.situacao = s;
      if (st.pausa && s.bluetooth && s.localizacao) st.pausa = null;
      render();
    }
    async function comecar(pedido) {
      try {
        await app.comecar(leitura => { rastreador.registrar(leitura); verificarPerto(); });
        render();
        if (pedido) {
          anunciar('Procurando beacons por perto.');
          const t = document.getElementById('beacons-titulo'); if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
        }
      } catch (e) {
        st.negada = e && e.message === 'permissao';
        st.aberto = true;
        await atualizarSituacao();
      }
    }
    function verificarPerto() {
      const a = rastreador.atual();
      const novo = a ? a.lugar : null;
      if (novo === st.perto) return;
      st.perto = novo;
      render();
      if (!novo || !lugar(novo)) return;
      if (o.pagina === 'mapa' && novo === (o.origem && o.origem())) return;
      const l = lugar(novo);
      anunciar(o.pagina === 'mapa' && novo === (o.destino && o.destino()) ? `Você chegou: ${l.nome}.` : textoPerto(l) + '.');
    }

    app.aoMudarSituacao(s => {
      st.situacao = s;
      st.pausa = !s.bluetooth ? 'bluetooth' : !s.localizacao ? 'localizacao' : null;
      render();
      if (st.pausa) anunciar(PAUSA[st.pausa].texto);
    });
    // volta das configurações do Android: confere de novo o que mudou
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && o.pagina === 'rota' && st.aberto && !app.procurando()) atualizarSituacao();
    });
    const relogio = setInterval(verificarPerto, 1000);

    render();
    if (app.lembrado()) comecar(false);
    return { parar() { clearInterval(relogio); app.parar(); } };
  }

  raiz.NaviBeaconsUI = { ligar };
})(window);
