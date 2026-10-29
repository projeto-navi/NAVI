/* Navi — interface compartilhada pelas duas páginas: Preferências, Pedir ajuda, cartão para o atendente,
   barra de voz e leitura do foco. Diálogos nativos (<dialog>): o foco entra no título ao abrir,
   Esc fecha e o foco volta ao botão que abriu (RN33). */
(function (raiz) {
  'use strict';
  const E = () => raiz.NaviEstado;
  const svg = id => raiz.NaviIcones.svg(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function abrirDialogo(dlg, gatilho) {
    if (!dlg || dlg.open) return;
    dlg._gatilho = gatilho || document.activeElement;
    dlg.showModal();
    const alvo = dlg.querySelector('[data-foco-inicial]') || dlg.querySelector('h2');
    if (alvo) alvo.focus();
  }
  function criarDialogo(id, titulo, rotuloFechar) {
    let dlg = document.getElementById(id);
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = id; dlg.className = 'dialogo';
    dlg.setAttribute('aria-labelledby', id + '-titulo');
    dlg.innerHTML = `<div class="dialogo-topo"><h2 id="${id}-titulo" tabindex="-1">${esc(titulo)}</h2>` +
      `<button type="button" class="btn btn-icone" data-fechar aria-label="${esc(rotuloFechar)}">${svg('i-fechar')}</button></div>` +
      `<div class="dialogo-corpo"></div>`;
    dlg.querySelector('[data-fechar]').onclick = () => dlg.close();
    dlg.addEventListener('close', () => {
      const g = dlg._gatilho;
      if (g && document.contains(g) && typeof g.focus === 'function') g.focus();
    });
    // toque no fundo escuro fecha (como Esc)
    dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
    (document.getElementById('dialogos') || document.body).appendChild(dlg);
    return dlg;
  }

  /**
   * @param {object} o
   * @param {object} o.local local montado
   * @param {object} o.voz NaviVoz
   * @param {(p: object, mudou: string) => void} [o.aoMudarPreferencias]
   * @param {() => void} [o.aoTrocarPerfil]
   * @param {() => boolean} [o.temRotaAjuda] há lugar de atendimento para traçar rota?
   * @param {() => void} [o.irParaAjuda]
   * @param {() => {destino?: object, passo?: string}} [o.contexto]
   */
  function criar(o) {
    const local = o.local, voz = o.voz;
    const cfg = local.config || {};
    const contatos = cfg.contatos || {};

    /* ---------- Preferências ---------- */
    function opcao(id, nome, desc, ligado, extra = '') {
      return `<div class="opcao"><div class="opcao-texto"><b id="op-${id}-nome">${esc(nome)}</b><small id="op-${id}-desc">${esc(desc)}</small>${extra}</div>` +
        `<span class="interruptor-estado" aria-hidden="true" data-estado="${id}">${ligado ? 'Ligado' : 'Desligado'}</span>` +
        `<button type="button" class="interruptor" role="switch" aria-checked="${ligado}" data-op="${id}" aria-labelledby="op-${id}-nome" aria-describedby="op-${id}-desc"></button></div>`;
    }
    function radios(nome, rotulo, itens, atual) {
      return `<fieldset class="pilha-curta" style="border:0;padding:0;margin:0"><legend class="campo-rotulo" style="padding:0;margin-bottom:var(--e2)">${esc(rotulo)}</legend><div class="escolhas">` +
        itens.map(([v, t, d]) => `<label class="escolha"><input class="escolha-input" type="radio" name="${nome}" value="${v}" ${String(v) === String(atual) ? 'checked' : ''}>` +
          `<span class="marca-escolha" aria-hidden="true"></span><span>${esc(t)}${d ? `<small class="texto-2" style="display:block;font-weight:400">${esc(d)}</small>` : ''}</span></label>`).join('') +
        `</div></fieldset>`;
    }
    function htmlPreferencias() {
      const p = E().preferencias();
      const perfil = p.perfil ? E().PERFIS[p.perfil].nome : 'nenhum escolhido';
      return `<p class="texto-2">Combine o que você precisar. As escolhas ficam guardadas só neste aparelho.</p>
        <section class="pilha-curta" aria-labelledby="pref-perfil"><h3 id="pref-perfil">Perfil</h3>
          <p>Atalho atual: <b>${esc(perfil)}</b>. O perfil liga um conjunto de opções; depois você ajusta cada uma.</p>
          ${o.aoTrocarPerfil ? `<div><button type="button" class="btn" data-trocar-perfil>${svg('i-preferencias')}Trocar perfil</button></div>` : ''}
        </section>
        <section aria-labelledby="pref-instrucoes"><h3 id="pref-instrucoes">Como receber as instruções</h3>
          ${opcao('voz', 'Ouvir as instruções em voz alta', voz.temVoz ? 'O site lê cada passo, com pausa, repetição e velocidade.' : 'Este navegador não tem voz. As instruções continuam por escrito.', p.voz)}
          ${opcao('leitor', 'Uso leitor de tela', 'TalkBack, VoiceOver ou NVDA. O site não fala por cima dele.', p.leitorDeTela)}
          ${opcao('libras', 'Tradutor de Libras', 'VLibras, do Governo Federal. Precisa de internet.', p.libras)}
          <div style="padding-top:var(--e3)"><button type="button" class="btn" data-cartao>${svg('i-cartao')}Mostrar cartão para o atendente</button></div>
        </section>
        <section aria-labelledby="pref-rotas"><h3 id="pref-rotas">Rotas</h3>
          ${opcao('escadas', 'Evitar escadas', 'Inclui escadas rolantes. A troca de andar é pelo elevador; sem elevador, pela rampa.', p.evitarEscadas)}
          ${opcao('pisoTatil', 'Preferir piso tátil e braille', 'A rota segue o piso tátil e usa a escada com braille no corrimão, mesmo que seja mais longa.', p.preferirPisoTatil)}
        </section>
        ${radios('texto', 'Tamanho do texto', E().TEXTOS.map(v => [v, v + '%', v === 100 ? 'Padrão' : '']), p.texto)}
        ${radios('tema', 'Cores', [['claro', 'Claro', 'Padrão'], ['contraste', 'Alto contraste', 'Azul-marinho e amarelo'], ['daltonismo', 'Cores distintas', 'Para daltonismo']], p.tema)}
        <section class="pilha-curta" style="border-top:1px solid var(--cor-divisor);padding-top:var(--e4)">
          <button type="button" class="btn-texto" data-apagar>${svg('i-apagar')}Apagar minhas preferências</button>
          <p class="texto-2 pequeno">Volta tudo ao padrão neste aparelho, inclusive a pergunta sobre a voz. Seus avisos de interdição continuam.</p>
        </section>`;
    }
    const NOMES_OP = { voz: 'Voz do site', leitor: 'Uso de leitor de tela', libras: 'Tradutor de Libras', escadas: 'Evitar escadas', pisoTatil: 'Preferir piso tátil e braille' };
    const CAMPO_OP = { voz: 'voz', leitor: 'leitorDeTela', libras: 'libras', escadas: 'evitarEscadas', pisoTatil: 'preferirPisoTatil' };
    function aplicar(mudanca, nome) {
      const p = E().salvar(mudanca);
      E().aplicarNaPagina(p);
      if (o.aoMudarPreferencias) o.aoMudarPreferencias(p, nome);
      return p;
    }
    function ligarPreferencias(dlg) {
      const corpo = dlg.querySelector('.dialogo-corpo');
      corpo.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
        const op = b.dataset.op, liga = b.getAttribute('aria-checked') !== 'true';
        const mudanca = { [CAMPO_OP[op]]: liga };
        if (op === 'leitor' && liga) mudanca.voz = false;   // leitor de tela: a voz do site sai (RN28)
        if (op === 'voz' && liga) mudanca.leitorDeTela = false;
        if (op === 'voz' && !liga) voz.cancelar();
        const p = aplicar(mudanca, op);
        for (const [k, campo] of Object.entries(CAMPO_OP)) {
          const sw = corpo.querySelector(`[data-op="${k}"]`), est = corpo.querySelector(`[data-estado="${k}"]`);
          if (sw) sw.setAttribute('aria-checked', String(!!p[campo]));
          if (est) est.textContent = p[campo] ? 'Ligado' : 'Desligado';
        }
        voz.anunciar(`${NOMES_OP[op]}: ${p[CAMPO_OP[op]] ? 'ligado' : 'desligado'}.`, { visual: false });
        if (op === 'voz' && p.voz) voz.falar('Voz ligada.');
      });
      corpo.querySelectorAll('input[name="texto"]').forEach(r => r.onchange = () => { aplicar({ texto: +r.value }, 'texto'); voz.anunciar(`Tamanho do texto: ${r.value}%.`, { visual: false }); });
      corpo.querySelectorAll('input[name="tema"]').forEach(r => r.onchange = () => {
        aplicar({ tema: r.value }, 'tema');
        voz.anunciar(`Cores: ${r.closest('label').querySelector('span:last-child').firstChild.textContent}.`, { visual: false });
      });
      const tp = corpo.querySelector('[data-trocar-perfil]');
      if (tp) tp.onclick = () => { dlg.close(); o.aoTrocarPerfil(); };
      corpo.querySelector('[data-cartao]').onclick = ev => abrirCartao(ev.currentTarget);
      corpo.querySelector('[data-apagar]').onclick = () => {
        E().apagarTudo();
        voz.cancelar();
        location.replace(E().urlRota({ local: o.local.slug === raiz.NaviLocal.slugDaUrl('') ? null : o.local.slug }));
      };
    }
    function abrirPreferencias(gatilho) {
      const dlg = criarDialogo('dlg-preferencias', 'Preferências', 'Fechar preferências');
      dlg.querySelector('.dialogo-corpo').innerHTML = htmlPreferencias();
      ligarPreferencias(dlg);
      abrirDialogo(dlg, gatilho);
    }

    /* ---------- Pedir ajuda (RN53) e emergência (RN54) ---------- */
    function textoWhatsApp() {
      const c = o.contexto ? o.contexto() : {};
      let t = `Olá! Estou usando o Navi ${cfg.textos && cfg.textos.noLocal ? cfg.textos.noLocal : ''} e preciso de ajuda.`;
      if (c.destino) t += ` Estou indo para ${c.destino.nome}.`;
      if (c.passo) t += ` Último passo: ${c.passo}`;
      return t;
    }
    function abrirAjuda(gatilho) {
      const dlg = criarDialogo('dlg-ajuda', 'Pedir ajuda', 'Fechar ajuda');
      const quem = contatos.ajudaNome || 'atendimento';
      const onde = contatos.ajudaOnde ? ' ' + contatos.ajudaOnde : '';
      let h = `<p>Fale com ${esc(quem === 'SAC' ? 'o SAC' : 'a ' + quem)}${esc(onde)}.</p><div class="pilha-curta">`;
      if (contatos.telefone) h += `<a class="btn btn-primario btn-largo" href="tel:${esc(contatos.telefoneLink || contatos.telefone)}">${svg('i-telefone')}<span>Ligar para ${esc(quem === 'SAC' ? 'o SAC' : quem)}: <span class="sem-quebra">${esc(contatos.telefone)}</span></span></a>`;
      if (contatos.whatsapp) h += `<a class="btn btn-largo" target="_blank" rel="noopener" href="https://wa.me/${esc(contatos.whatsapp)}?text=${encodeURIComponent(textoWhatsApp())}">${svg('i-mensagem')}Mandar mensagem pelo WhatsApp</a>`;
      if (o.temRotaAjuda && o.temRotaAjuda()) h += `<button type="button" class="btn btn-largo" data-rota-ajuda>${svg('i-lugar')}Ver a rota até ${esc(quem === 'SAC' ? 'o SAC' : 'a ' + quem)}</button>`;
      h += `<button type="button" class="btn btn-largo" data-cartao>${svg('i-cartao')}Mostrar cartão para o atendente</button></div>`;
      if (!contatos.telefone && !contatos.whatsapp) h += `<p class="texto-2">Os contatos ${esc((cfg.textos && cfg.textos.doLocal) || 'do local')} ainda não foram cadastrados. Procure um funcionário ou a sinalização.</p>`;
      h += `<div class="faixa-aviso">${svg('i-aviso')}<p><b>Não use o Navi em emergências.</b> Siga a sinalização e as orientações da equipe ${esc((cfg.textos && cfg.textos.doLocal) || 'do local')}.</p></div>`;
      const corpo = dlg.querySelector('.dialogo-corpo');
      corpo.innerHTML = h;
      const r = corpo.querySelector('[data-rota-ajuda]');
      if (r) r.onclick = () => { dlg.close(); o.irParaAjuda(); };
      corpo.querySelector('[data-cartao]').onclick = ev => abrirCartao(ev.currentTarget);
      abrirDialogo(dlg, gatilho);
    }

    /* ---------- cartão para o atendente ---------- */
    function abrirCartao(gatilho) {
      const dlg = criarDialogo('dlg-cartao', 'Cartão para o atendente', 'Fechar cartão');
      dlg.classList.add('dialogo-cartao');
      const c = o.contexto ? o.contexto() : {};
      const d = c.destino;
      dlg.querySelector('.dialogo-corpo').innerHTML =
        `<p class="cartao-grande">Olá! Sou surdo(a) ou tenho deficiência auditiva.</p>` +
        `<p class="cartao-grande">Pode me responder por escrito ou com gestos?</p>` +
        `<p class="cartao-destino">${d ? `Estou procurando: <b>${esc(d.nome)}</b> (${esc(raiz.NaviCategorias.descricao(d, local))}).` : `Estou procurando um lugar ${esc((cfg.textos && cfg.textos.noLocal) || '')}.`}</p>`;
      abrirDialogo(dlg, gatilho);
    }

    /* ---------- barra de voz (RN27) ---------- */
    function renderBarraVoz(el) {
      if (!el) return;
      const p = E().preferencias();
      if (!p.voz || !voz.temVoz) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false;
      const pausada = voz.pausada;
      el.innerHTML = `<div class="barra-voz" role="group" aria-label="Controles da voz">
        <span class="barra-voz-rotulo">${svg('i-voz')}Voz ligada</span>
        <button type="button" class="btn" data-voz="pausa">${svg(pausada ? 'i-tocar' : 'i-pausar')}${pausada ? 'Continuar' : 'Pausar'}</button>
        <button type="button" class="btn" data-voz="repetir">${svg('i-repetir')}Repetir</button>
        <button type="button" class="btn" data-voz="velocidade" aria-label="Velocidade da voz: ${voz.NOME_VEL[p.velocidade]}. Trocar">${svg('i-velocidade')}${voz.NOME_VEL[p.velocidade]}</button></div>`;
      el.querySelector('[data-voz="pausa"]').onclick = () => { voz.pausada ? voz.continuar() : voz.pausar(); renderBarraVoz(el); el.querySelector('[data-voz="pausa"]').focus(); };
      el.querySelector('[data-voz="repetir"]').onclick = () => voz.repetir();
      el.querySelector('[data-voz="velocidade"]').onclick = () => {
        const lista = voz.VELOCIDADES, prox = lista[(lista.indexOf(p.velocidade) + 1) % lista.length];
        E().salvar({ velocidade: prox });
        renderBarraVoz(el);
        el.querySelector('[data-voz="velocidade"]').focus();
        voz.falar(`Velocidade ${voz.NOME_VEL[prox].toLowerCase()}.`);
      };
    }

    /* ---------- leitura do item em foco pelo teclado, com a voz ligada ---------- */
    let usouTeclado = false;
    document.addEventListener('keydown', ev => { if (ev.key === 'Tab') usouTeclado = true; });
    document.addEventListener('pointerdown', () => { usouTeclado = false; });
    document.addEventListener('focusin', ev => {
      if (!usouTeclado || !E().preferencias().voz) return;
      const alvo = ev.target;
      const nome = alvo.getAttribute('aria-label') || (alvo.id && document.querySelector(`label[for="${alvo.id}"]`)?.textContent) || alvo.textContent;
      if (nome && nome.trim()) voz.falar(nome.replace(/\s+/g, ' ').trim(), { baixa: true });
    });

    return { abrirPreferencias, abrirAjuda, abrirCartao, renderBarraVoz, abrirDialogo, criarDialogo, esc };
  }

  raiz.NaviUI = { criar, abrirDialogo, criarDialogo, esc };
})(typeof window !== 'undefined' ? window : globalThis);
