/* Navi — "Avisar sobre um local" (RN49–RN52), usado nas duas páginas.
   O aviso vale na hora neste aparelho (as rotas desviam quando possível) e vai ao local pelos canais
   oficiais com o texto pronto. Nada é enviado sem a pessoa tocar no canal (RN51). Cada aviso mostra a data (RN52). */
(function (raiz) {
  'use strict';

  /**
   * @param {object} o
   * @param {object} o.local local montado (NaviLocal)
   * @param {object} o.G grafo do motor
   * @param {object} o.inter NaviInterdicoes
   * @param {object} o.voz NaviVoz
   * @param {object} o.ui NaviUI.criar(...)
   * @param {() => {origem?: object, destino?: object, usaElevador?: boolean}} [o.contexto]
   * @param {() => void} [o.aoMudar] chamado depois de registrar ou remover um aviso
   * @param {{configurado: boolean, enviar: (a: object) => Promise<'enviado'|'fila'|'desligado'>}} [o.servidor]
   *   NaviServidor.ligar(...): com ele, o aviso também vai à equipe do Navi (RN68)
   */
  function criar(o) {
    const { local, inter, voz, ui } = o;
    const cfg = local.config || {}, contatos = cfg.contatos || {}, txt = cfg.textos || {};
    const NC = raiz.NaviCategorias, R = raiz.NaviRotas, TIPOS = raiz.NaviInterdicoes.TIPOS;
    const svg = id => raiz.NaviIcones.svg(id);
    const esc = ui.esc;
    const st = { lugar: null, tipo: 'interditado', detalhe: '', termo: '', enviado: null, envio: null };
    const comServidor = () => !!(o.servidor && o.servidor.configurado);
    // aviso meu que a equipe já confirmou: mesmo lugar e mesmo tipo entre os confirmados do servidor
    const confirmadoPelaEquipe = a => inter.oficiais().some(x => x.origem === 'servidor' && x.lugar === a.lugar && x.tipo === a.tipo);
    let dlg = null;

    const dataBR = iso => {
      if (!iso) return '';
      const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
      if (isNaN(d)) return '';
      return iso.length === 10 ? d.toLocaleDateString('pt-BR') :
        d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };
    function textoAviso(a) {
      const l = local.lugar(a.lugar);
      return `${txt.avisoTitulo || 'Aviso pelo Navi'}\nLocal: ${l.nome} (${NC.descricao(l, local)})\nSituação: ${TIPOS[a.tipo].nome}\n` +
        (a.detalhe ? `Detalhes: ${a.detalhe}\n` : '') + `Data: ${dataBR(a.criado)}`;
    }

    // situação do envio à equipe do Navi (RN68), num único lugar que o leitor de tela acompanha
    function textoEnvio() {
      if (st.envio === 'enviado') return 'Aviso enviado à equipe do Navi. Ele já vale neste aparelho e passa a valer para todos quando um ADM confirmar.';
      if (st.envio === 'fila') return 'Sem internet: o aviso será enviado quando a conexão voltar.';
      if (st.envio === 'enviando') return 'Enviando à equipe do Navi…';
      return '';
    }

    /* ---------- partes do formulário ---------- */
    function htmlEscolhaLugar() {
      if (st.lugar) {
        return `<div class="ponto-escolhido">${NC.tile(st.lugar, svg)}<span class="lugar-texto"><b>${esc(st.lugar.nome)}</b>` +
          `<span class="lugar-desc">${esc(NC.descricao(st.lugar, local))}</span></span>` +
          `<button type="button" class="btn-texto" data-trocar-lugar>Trocar<span class="sr"> o local do aviso</span></button></div>`;
      }
      const c = o.contexto ? o.contexto() : {};
      const chips = [];
      if (c.destino) chips.push([c.destino, 'Meu destino: ' + c.destino.nome]);
      if (c.origem) chips.push([c.origem, 'Onde estou: ' + c.origem.nome]);
      const elev = local.lugares.find(l => l.cat === 'elevador');
      if (elev) chips.push([elev, 'Elevador']);
      return (chips.length ? `<div class="filtros" role="group" aria-label="Locais sugeridos">` +
          chips.map(([l, t]) => `<button type="button" class="filtro" data-aviso-lugar="${esc(l.id)}">${esc(t)}</button>`).join('') + `</div>` : '') +
        `<div class="busca"><label class="campo-rotulo" for="aviso-busca">Buscar o local</label>
          <div class="busca-caixa">${svg('i-busca')}<input id="aviso-busca" class="entrada-texto" type="search" autocomplete="off" enterkeyhint="search" value="${esc(st.termo)}" placeholder="Nome do local"></div></div>
        <p class="contagem" id="aviso-contagem" aria-live="polite"></p>
        <ul class="lista-lugares" id="aviso-resultados"></ul>`;
    }
    function htmlListas() {
      const oficiais = inter.oficiais(), meus = inter.meus();
      let h = '';
      if (oficiais.length) {
        h += `<section class="pilha-curta" aria-labelledby="av-oficiais"><h3 id="av-oficiais">Avisos confirmados pela equipe</h3><ul class="lista-avisos">` +
          oficiais.map(a => { const l = local.lugar(a.lugar); return `<li><b>${esc(l.nome)}</b>: ${esc(TIPOS[a.tipo].nome.toLowerCase())}${a.detalhe ? ', ' + esc(a.detalhe) : ''}` +
            `${a.desde ? ` <span class="texto-2">desde ${esc(dataBR(a.desde))}</span>` : ''}</li>`; }).join('') + `</ul></section>`;
      }
      if (meus.length) {
        h += `<section class="pilha-curta" aria-labelledby="av-meus"><h3 id="av-meus">Seus avisos neste aparelho</h3><ul class="lista-avisos">` +
          meus.map((a, i) => { const l = local.lugar(a.lugar); return `<li><span><b>${esc(l.nome)}</b>: ${esc(TIPOS[a.tipo].nome.toLowerCase())}` +
            ` <span class="texto-2">em ${esc(dataBR(a.criado))}</span>` +
            (comServidor() ? `<span class="situacao-aviso">${confirmadoPelaEquipe(a) ? 'Confirmado pela equipe' : 'Aguardando confirmação'}</span>` : '') + `</span>` +
            `<button type="button" class="btn-texto" data-remover="${i}">Já foi resolvido<span class="sr">: ${esc(l.nome)}</span></button></li>`; }).join('') + `</ul></section>`;
      }
      return h;
    }
    function htmlFormulario() {
      return `<p class="texto-2">Viu algo interditado, quebrado ou atrapalhando a passagem? O aviso aparece na hora neste aparelho, e as suas rotas desviam dele quando possível.</p>
        <form id="form-aviso" class="pilha" novalidate>
          <fieldset class="grupo"><legend class="campo-rotulo">1. Qual local?</legend><div class="pilha-curta" id="aviso-lugar">${htmlEscolhaLugar()}</div></fieldset>
          <fieldset class="grupo"><legend class="campo-rotulo">2. O que aconteceu?</legend><div class="escolhas escolhas-coluna">` +
            Object.entries(TIPOS).map(([k, t]) => `<label class="escolha"><input class="escolha-input" type="radio" name="tipo-aviso" value="${k}" ${st.tipo === k ? 'checked' : ''}>` +
              `<span class="marca-escolha" aria-hidden="true"></span><span>${esc(t.nome)}<small class="texto-2 escolha-desc">${esc(t.desc)}</small></span></label>`).join('') +
          `</div></fieldset>
          <div class="campo"><label class="campo-rotulo" for="aviso-detalhe">3. Detalhes <span class="texto-2">(opcional)</span></label>
            <textarea id="aviso-detalhe" class="entrada-texto" maxlength="300" rows="3" placeholder="Ex.: porta do sanitário quebrada">${esc(st.detalhe)}</textarea></div>
          <div class="faixa-erro" id="aviso-erro" role="alert" hidden></div>
          <button type="submit" class="btn btn-primario btn-largo">${svg('i-aviso')}Registrar aviso</button>
        </form>` + htmlListas();
    }
    function htmlEnviado() {
      const a = st.enviado, l = local.lugar(a.lugar), texto = textoAviso(a), enc = encodeURIComponent(texto);
      const desvia = a.tipo !== 'obstaculo';
      let canais = '';
      if (contatos.whatsapp) canais += `<a class="btn btn-primario btn-largo" target="_blank" rel="noopener" href="https://wa.me/${esc(contatos.whatsapp)}?text=${enc}">${svg('i-mensagem')}Enviar pelo WhatsApp ${esc(txt.doLocal || '')}</a>`;
      if (contatos.emailEquipe) canais += `<a class="btn btn-largo" href="mailto:${esc(contatos.emailEquipe)}?subject=${encodeURIComponent('Aviso Navi: ' + l.nome)}&body=${enc}">${svg('i-email')}Enviar à equipe do mapa por e-mail</a>`;
      if (contatos.telefone) canais += `<a class="btn btn-largo" href="tel:${esc(contatos.telefoneLink || contatos.telefone)}">${svg('i-telefone')}Ligar: ${esc(contatos.telefone)}</a>`;
      canais += `<button type="button" class="btn btn-largo" data-copiar>${svg('i-copiar')}Copiar o texto do aviso</button>`;
      if (contatos.faleConosco) canais += `<a class="btn-texto" target="_blank" rel="noopener" href="${esc(contatos.faleConosco)}">${svg('i-externo')}Abrir o Fale Conosco ${esc(txt.doLocal || '')}</a>`;
      const envio = comServidor() ? `<p id="aviso-envio" role="status">${esc(textoEnvio())}</p>` : '';
      return `<div class="faixa-info">${svg('i-ok')}<div><p><b>Aviso registrado.</b> ${esc(l.nome)} já aparece com aviso neste aparelho${desvia ? ', e as suas rotas desviam dele quando possível' : ''}.</p>${envio}</div></div>
        <section class="pilha-curta" aria-labelledby="av-enviar"><h3 id="av-enviar">Agora avise quem pode resolver</h3><div class="pilha-curta">${canais}</div></section>
        <pre class="texto-aviso" id="texto-aviso">${esc(texto)}</pre>
        ${comServidor() ? '' : `<p class="texto-2 pequeno">Para o aviso valer para todas as pessoas, a equipe confere e confirma. Até lá, ele vale só neste aparelho.</p>`}
        <button type="button" class="btn btn-largo" data-novo>Avisar sobre outro local</button>` + htmlListas();
    }

    /* ---------- comportamento ---------- */
    function renderResultados() {
      const ul = dlg.querySelector('#aviso-resultados');
      if (!ul) return;
      const termo = st.termo.trim();
      const lista = termo ? R.buscar(local.lugares, termo).slice(0, 12) : [];
      dlg.querySelector('#aviso-contagem').textContent = !termo ? '' : lista.length ? `${lista.length === 12 ? 'Primeiros 12 lugares' : lista.length + (lista.length === 1 ? ' lugar' : ' lugares')} com esse nome` : 'Nenhum lugar com esse nome. Tente outra palavra.';
      ul.innerHTML = lista.map(l => `<li><button type="button" class="lugar" data-aviso-lugar="${esc(l.id)}">${NC.tile(l, svg)}<span class="lugar-texto">` +
        `<span class="lugar-nome">${esc(l.nome)}<span class="sr">,</span></span><span class="lugar-desc">${esc(NC.descricao(l, local))}</span></span></button></li>`).join('');
    }
    function escolherLugar(id) {
      st.lugar = local.lugar(id);
      st.termo = '';
      render();
      voz.anunciar(`Local escolhido: ${st.lugar.nome}. Agora diga o que aconteceu.`, { visual: false });
      const r = dlg.querySelector('input[name="tipo-aviso"]:checked');
      if (r) r.focus();
    }
    function ligar() {
      const corpo = dlg.querySelector('.dialogo-corpo');
      corpo.querySelectorAll('[data-aviso-lugar]').forEach(b => b.onclick = () => escolherLugar(b.dataset.avisoLugar));
      const tl = corpo.querySelector('[data-trocar-lugar]');
      if (tl) tl.onclick = () => { st.lugar = null; render(); const b = dlg.querySelector('#aviso-busca'); if (b) b.focus(); };
      const busca = corpo.querySelector('#aviso-busca');
      if (busca) {
        busca.oninput = () => { st.termo = busca.value; renderResultados(); corpo.querySelectorAll('#aviso-resultados [data-aviso-lugar]').forEach(b => b.onclick = () => escolherLugar(b.dataset.avisoLugar)); };
        renderResultados();
        corpo.querySelectorAll('#aviso-resultados [data-aviso-lugar]').forEach(b => b.onclick = () => escolherLugar(b.dataset.avisoLugar));
      }
      corpo.querySelectorAll('input[name="tipo-aviso"]').forEach(r => r.onchange = () => { st.tipo = r.value; });
      const det = corpo.querySelector('#aviso-detalhe');
      if (det) det.oninput = () => { st.detalhe = det.value; };
      const form = corpo.querySelector('#form-aviso');
      if (form) form.onsubmit = ev => {
        ev.preventDefault();
        const erro = corpo.querySelector('#aviso-erro');
        if (!st.lugar) {
          erro.innerHTML = `${svg('i-aviso')}<p>Escolha o local antes de registrar o aviso.</p>`; erro.hidden = false;
          const alvo = corpo.querySelector('#aviso-busca') || corpo.querySelector('[data-aviso-lugar]');
          if (alvo) alvo.focus();
          return;
        }
        const a = inter.registrar({ lugar: st.lugar.id, tipo: st.tipo, detalhe: st.detalhe });
        st.enviado = a; st.detalhe = '';
        st.envio = comServidor() ? 'enviando' : null;
        render();
        if (comServidor()) {
          o.servidor.enviar({ lugar: a.lugar, tipo: a.tipo, detalhe: a.detalhe }).then(r => {
            if (st.enviado !== a) return; // a pessoa já fechou ou começou outro aviso
            st.envio = r === 'enviado' ? 'enviado' : r === 'fila' ? 'fila' : null;
            const alvo = dlg && dlg.querySelector('#aviso-envio');
            if (alvo) alvo.textContent = textoEnvio();
          });
        }
        voz.anunciar(`Aviso registrado: ${st.lugar.nome}, ${TIPOS[a.tipo].nome.toLowerCase()}. Agora avise quem pode resolver.`);
        dlg.querySelector('h2').focus();
        if (o.aoMudar) o.aoMudar();
      };
      const copiar = corpo.querySelector('[data-copiar]');
      if (copiar) copiar.onclick = async () => {
        const t = corpo.querySelector('#texto-aviso').textContent;
        try { await navigator.clipboard.writeText(t); voz.anunciar('Texto do aviso copiado.'); }
        catch (e) {
          const r = document.createRange(); r.selectNodeContents(corpo.querySelector('#texto-aviso'));
          getSelection().removeAllRanges(); getSelection().addRange(r);
          voz.anunciar('O texto do aviso está selecionado. Use a opção copiar do seu aparelho.');
        }
      };
      const novo = corpo.querySelector('[data-novo]');
      if (novo) novo.onclick = () => { st.enviado = null; st.lugar = null; render(); dlg.querySelector('h2').focus(); };
      corpo.querySelectorAll('[data-remover]').forEach(b => b.onclick = () => {
        const rem = inter.remover(+b.dataset.remover);
        render();
        if (rem) voz.anunciar(`Aviso de ${local.lugar(rem.lugar).nome} removido.`);
        dlg.querySelector('h2').focus();
        if (o.aoMudar) o.aoMudar();
      });
    }
    function render() {
      dlg.querySelector('.dialogo-corpo').innerHTML = st.enviado ? htmlEnviado() : htmlFormulario();
      ligar();
    }
    /** Abre o formulário. @param {Element} [gatilho] @param {object} [lugar] local já escolhido */
    function abrir(gatilho, lugar) {
      dlg = ui.criarDialogo('dlg-aviso', 'Avisar sobre um local', 'Fechar aviso');
      st.enviado = null; st.termo = '';
      st.lugar = lugar || null;
      render();
      ui.abrirDialogo(dlg, gatilho);
      voz.falar('Avisar sobre um local interditado ou danificado. Primeiro escolha o local.');
    }
    return { abrir, textoAviso };
  }

  raiz.NaviAvisosUI = { criar };
})(typeof window !== 'undefined' ? window : globalThis);
