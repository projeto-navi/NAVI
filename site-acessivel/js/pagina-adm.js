/* Navi — Área ADM (adm.html): entrar, conferir os avisos e cadastrar ADMs (RN66–RN70).
   Precisa de internet: fala com o servidor (js/servidor.js). A sessão fica só nesta aba (sessionStorage).
   As páginas públicas não carregam nada daqui. */
(async function () {
  'use strict';
  const NE = window.NaviEstado, NL = window.NaviLocal, NC = window.NaviCategorias;
  const svg = id => window.NaviIcones.svg(id);
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const main = $('conteudo'), acoesTopo = $('topo-acoes');
  const anunciar = t => { const r = $('anuncio'); r.textContent = ''; setTimeout(() => { r.textContent = t; }, 50); };

  NE.aplicarNaPagina(NE.preferencias());
  const servidor = window.NaviServidor.criar();

  /* ---------- local (para mostrar nome e andar de cada lugar) ---------- */
  const indice = window.NAVI_LOCAIS_INDICE || [];
  const slug = NL.slugDaUrl(location.search, indice);
  let local = null;
  try { local = await NL.carregar(slug, { malha: false }); } catch (e) { /* mostra os ids */ }

  const MENSAGENS = {
    credenciais: 'Usuário ou senha incorretos.',
    'nao-adm': 'Usuário ou senha incorretos.',
    rede: 'Sem internet. A Área ADM precisa de conexão.',
    sessao: 'Sua sessão terminou. Entre de novo.',
    existe: 'Esse usuário já existe.',
    'nao-configurado': 'O servidor do Navi ainda não foi configurado.'
  };
  const mensagem = e => MENSAGENS[e && e.message] || MENSAGENS.rede;
  const faixaErro = texto => `${svg('i-aviso')}<p>${esc(texto)}</p>`;
  const dataBR = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); };

  /* ---------- sem servidor ---------- */
  function telaSemServidor() {
    acoesTopo.innerHTML = '';
    main.innerHTML = `<section class="adm-cartao pilha">
        <h1 tabindex="-1">Área ADM</h1>
        <div class="faixa-erro">${svg('i-aviso')}<div><p><b>O servidor do Navi ainda não foi configurado.</b></p>
          <p>Enquanto isso, os avisos valem só no aparelho de quem avisou. O passo a passo está em <code>supabase/LEIA-ME.md</code>, no repositório.</p></div></div>
        <a class="btn-texto" href="index.html">${svg('i-voltar')}Voltar ao Navi</a>
      </section>`;
  }

  /* ---------- entrar ---------- */
  function telaEntrar(aviso) {
    acoesTopo.innerHTML = '';
    document.title = 'Entrar | Navi ADM';
    main.innerHTML = `<section class="adm-cartao pilha" aria-labelledby="titulo-entrar">
        <div class="pilha-curta">
          <h1 id="titulo-entrar" tabindex="-1">Entrar na Área ADM</h1>
          <p class="texto-2">Para a equipe do Navi conferir os avisos sobre locais e confirmar quando um local está indisponível.</p>
        </div>
        <form id="form-entrar" class="pilha" novalidate>
          <div class="campo"><label class="campo-rotulo" for="entrar-usuario">Usuário</label>
            <input id="entrar-usuario" class="entrada-texto" name="usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></div>
          <div class="campo"><label class="campo-rotulo" for="entrar-senha">Senha</label>
            <input id="entrar-senha" class="entrada-texto" name="senha" type="password" autocomplete="current-password" required></div>
          <div class="faixa-erro" id="erro-entrar" role="alert" ${aviso ? '' : 'hidden'}>${aviso ? faixaErro(aviso) : ''}</div>
          <button type="submit" class="btn btn-primario btn-largo">Entrar</button>
        </form>
        <a class="btn-texto" href="index.html">${svg('i-voltar')}Voltar ao Navi</a>
      </section>`;
    const form = $('form-entrar'), erro = $('erro-entrar'), botao = form.querySelector('button[type=submit]');
    form.onsubmit = async ev => {
      ev.preventDefault();
      const usuario = form.usuario.value.trim(), senha = form.senha.value;
      if (!usuario || !senha) { erro.innerHTML = faixaErro('Preencha o usuário e a senha.'); erro.hidden = false; (usuario ? form.senha : form.usuario).focus(); return; }
      botao.setAttribute('aria-busy', 'true'); botao.disabled = true;
      try {
        await servidor.entrar(usuario, senha);
        await abrirPainel({ focar: true });
      } catch (e) {
        erro.innerHTML = faixaErro(mensagem(e)); erro.hidden = false;
        botao.removeAttribute('aria-busy'); botao.disabled = false;
        form.senha.value = ''; form.senha.focus();
      }
    };
    $('titulo-entrar').focus({ preventScroll: true });
  }

  function sair(aviso) {
    servidor.sair();
    pararAvisos();
    telaEntrar(aviso); // com aviso, a faixa (role=alert) já é lida
    if (!aviso) anunciar('Você saiu da Área ADM.');
  }
  // erro de sessão em qualquer pedido do painel volta ao login com o aviso
  async function comSessao(fn) {
    try { return await fn(); } catch (e) {
      if (e && e.message === 'sessao') { sair(MENSAGENS.sessao); return undefined; }
      throw e;
    }
  }

  /* ---------- painel ---------- */
  let pararAvisos = () => {};
  async function abrirPainel({ focar = false } = {}) {
    const s = servidor.sessao();
    acoesTopo.innerHTML = `<span class="adm-quem"><span class="sr">Entrou como </span>${esc(s.usuario)}</span>
      <button type="button" class="btn btn-topo" id="btn-sair">Sair</button>`;
    $('btn-sair').onclick = () => sair();
    document.title = 'Navi ADM';
    main.innerHTML = `<section class="pilha" aria-labelledby="titulo-avisos">
        <div class="pilha-curta">
          <h1 id="titulo-avisos" tabindex="-1">Avisos</h1>
          <p class="texto-2">${esc(local ? (local.config && local.config.nome) || slug : slug)}</p>
        </div>
        <div id="area-avisos" class="pilha"></div>
      </section>
      <section class="adm-cartao pilha" aria-labelledby="titulo-adms">
        <h2 id="titulo-adms">ADMs</h2>
        <ul class="adm-lista" id="lista-adms" aria-label="ADMs cadastrados"><li class="texto-2">Carregando…</li></ul>
        <form id="form-adm" class="pilha" aria-labelledby="titulo-novo-adm" novalidate>
          <h3 id="titulo-novo-adm">Novo ADM</h3>
          <div class="campo"><label class="campo-rotulo" for="novo-usuario">Usuário</label>
            <input id="novo-usuario" class="entrada-texto" name="usuario" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="ajuda-usuario" required>
            <span class="campo-ajuda" id="ajuda-usuario">De 3 a 30 letras minúsculas, números, ponto ou hífen.</span></div>
          <div class="campo"><label class="campo-rotulo" for="novo-senha">Senha</label>
            <input id="novo-senha" class="entrada-texto" name="senha" type="password" autocomplete="new-password" aria-describedby="ajuda-senha" required>
            <span class="campo-ajuda" id="ajuda-senha">Pelo menos 8 caracteres.</span></div>
          <div class="campo"><label class="campo-rotulo" for="novo-confirmar">Confirmar senha</label>
            <input id="novo-confirmar" class="entrada-texto" name="confirmar" type="password" autocomplete="new-password" required></div>
          <div class="faixa-erro" id="erro-adm" role="alert" hidden></div>
          <p class="adm-ok" id="ok-adm" role="status"></p>
          <button type="submit" class="btn btn-primario">Cadastrar ADM</button>
        </form>
      </section>`;
    ligarFormAdm();
    if (focar) $('titulo-avisos').focus({ preventScroll: true });
    await comSessao(async () => {
      await Promise.all([carregarAdms(), iniciarAvisos()]);
    }).catch(e => mostrarErroPainel(mensagem(e)));
  }
  function mostrarErroPainel(texto) {
    const a = $('area-avisos');
    if (a) a.innerHTML = `<div class="faixa-erro" role="alert">${faixaErro(texto)}</div>`;
  }

  async function carregarAdms() {
    const lista = await servidor.listarAdms();
    const ul = $('lista-adms');
    if (!ul) return;
    ul.innerHTML = lista.map(a => `<li><b>${esc(a.usuario)}</b><span class="texto-2">desde ${esc(dataBR(a.criado_em))}</span></li>`).join('') ||
      '<li class="texto-2">Nenhum ADM na lista.</li>';
  }

  function ligarFormAdm() {
    const form = $('form-adm'), erro = $('erro-adm'), ok = $('ok-adm'), botao = form.querySelector('button[type=submit]');
    const falhar = (texto, campo) => { ok.textContent = ''; erro.innerHTML = faixaErro(texto); erro.hidden = false; if (campo) campo.focus(); };
    form.onsubmit = async ev => {
      ev.preventDefault();
      erro.hidden = true;
      const usuario = form.usuario.value.trim().toLowerCase(), senha = form.senha.value, confirmar = form.confirmar.value;
      if (!window.NaviServidor.USUARIO.test(usuario)) return falhar('Use de 3 a 30 letras minúsculas, números, ponto ou hífen no usuário.', form.usuario);
      if (senha.length < 8) return falhar('A senha precisa ter pelo menos 8 caracteres.', form.senha);
      if (senha !== confirmar) return falhar('As senhas não são iguais.', form.confirmar);
      botao.setAttribute('aria-busy', 'true'); botao.disabled = true;
      try {
        await comSessao(async () => {
          await servidor.criarAdm(usuario, senha);
          form.reset();
          ok.textContent = `ADM ${usuario} cadastrado. Já pode entrar com a senha escolhida.`;
          await carregarAdms();
        });
      } catch (e) {
        falhar(e && e.message === 'invalido' ? 'Use de 3 a 30 letras minúsculas, números, ponto ou hífen no usuário.' : mensagem(e), e && e.message === 'existe' ? form.usuario : null);
      } finally {
        botao.removeAttribute('aria-busy'); botao.disabled = false;
      }
    };
  }

  /* ---------- avisos (RN69, RN70) ---------- */
  const TIPOS = window.NaviInterdicoes ? window.NaviInterdicoes.TIPOS : {};
  const nomeTipo = t => (TIPOS[t] && TIPOS[t].nome) || t;
  const lugarDe = id => (local && local.lugar(id)) || null;
  const nomeLugar = id => { const l = lugarDe(id); return l ? l.nome : String(id); };
  const descLugar = id => { const l = lugarDe(id); return l && NC ? NC.descricao(l, local) : ''; };
  const ABAS = [
    { id: 'pendentes', nome: 'Pendentes', situacoes: ['pendente'], vazio: 'Nenhum aviso pendente. Quando alguém avisar sobre um local, ele aparece aqui.' },
    { id: 'confirmados', nome: 'Confirmados', situacoes: ['confirmado'], vazio: 'Nenhum local confirmado como indisponível.' },
    { id: 'outros', nome: 'Recusados e resolvidos', situacoes: ['recusado', 'resolvido'], vazio: 'Nada recusado ou resolvido ainda.' }
  ];
  const av = { lista: [], aba: 'pendentes', conhecidos: null, novos: [], timer: null, ocupado: false };

  function haQuanto(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms)) return '';
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'há pouco';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'há 1 dia' : `há ${d} dias`;
  }
  // avisos com o mesmo lugar, tipo e situação viram um cartão; a decisão vale para todos eles
  function grupos(situacoes) {
    const m = new Map();
    for (const a of av.lista.filter(x => situacoes.includes(x.situacao))) {
      const k = a.situacao + '|' + a.lugar + '|' + a.tipo;
      if (!m.has(k)) m.set(k, { chave: k, lugar: a.lugar, tipo: a.tipo, situacao: a.situacao, avisos: [] });
      m.get(k).avisos.push(a);
    }
    const lista = [...m.values()];
    for (const g of lista) {
      g.avisos.sort((x, y) => (x.criado_em < y.criado_em ? -1 : 1));
      g.primeiro = g.avisos[0].criado_em;
      g.decidido = g.avisos.map(a => a.decidido_em).filter(Boolean).sort().pop() || null;
      g.quem = (g.avisos.find(a => a.decidido_por) || {}).decidido_por || '';
    }
    return lista.sort((x, y) => ((x.decidido || x.primeiro) < (y.decidido || y.primeiro) ? 1 : -1));
  }

  function htmlCartao(g, i) {
    const nome = nomeLugar(g.lugar), desc = descLugar(g.lugar), id = `cartao-${i}`;
    const detalhes = [...new Set(g.avisos.map(a => (a.detalhe || '').trim()).filter(Boolean))];
    const n = g.avisos.length;
    const etiqueta = g.situacao === 'pendente' ? 'etiqueta-alerta' : g.situacao === 'confirmado' ? 'etiqueta-alerta' : 'etiqueta-neutra';
    let meta = '';
    if (g.situacao === 'pendente') meta = (n > 1 ? `<b>${n} pessoas avisaram</b><br>` : '') + `Primeiro aviso ${esc(haQuanto(g.primeiro))}`;
    else if (g.situacao === 'confirmado') meta = `Confirmado ${esc(haQuanto(g.decidido))}${g.quem ? ' por ' + esc(g.quem) : ''}`;
    else meta = `${g.situacao === 'recusado' ? 'Recusado' : 'Resolvido'} ${esc(haQuanto(g.decidido))}${g.quem ? ' por ' + esc(g.quem) : ''}`;
    const sr = `<span class="sr">: ${esc(nome)}</span>`;
    const acoes = g.situacao === 'pendente'
      ? `<button type="button" class="btn btn-primario" data-decidir="confirmado" data-grupo="${i}">Confirmar: local indisponível${sr}</button>
         <button type="button" class="btn" data-decidir="recusado" data-grupo="${i}">Recusar${sr}</button>`
      : g.situacao === 'confirmado'
        ? `<button type="button" class="btn" data-decidir="resolvido" data-grupo="${i}">Marcar como resolvido${sr}</button>` : '';
    return `<li><article class="adm-aviso adm-aviso-${g.situacao}" aria-labelledby="${id}">
        <div class="adm-aviso-topo">
          <h3 id="${id}">${esc(nome)}</h3>
          <span class="etiqueta ${etiqueta}">${svg('i-aviso')}${esc(nomeTipo(g.tipo))}</span>
        </div>
        ${desc ? `<p class="texto-2">${esc(desc)}</p>` : ''}
        ${detalhes.length ? `<ul class="adm-detalhes">${detalhes.map(d => `<li>“${esc(d)}”</li>`).join('')}</ul>` : ''}
        <p class="adm-meta">${meta}</p>
        ${acoes ? `<div class="adm-acoes">${acoes}</div>` : ''}
      </article></li>`;
  }

  function renderAvisos({ focarPainel = false } = {}) {
    const area = $('area-avisos');
    if (!area) return;
    const porAba = Object.fromEntries(ABAS.map(a => [a.id, grupos(a.situacoes)]));
    const aba = ABAS.find(a => a.id === av.aba);
    const lista = porAba[aba.id];
    const novo = av.novos.length
      ? `<div class="faixa-aviso adm-novo">${svg('i-aviso')}<p>${esc(textoNovos())}</p>
           <button type="button" class="btn" id="btn-ver-novos">Ver avisos novos</button></div>` : '';
    area.innerHTML = `<div id="faixa-novos">${novo}</div>
      <div class="adm-abas" role="tablist" aria-label="Situação dos avisos">` +
        ABAS.map(a => `<button type="button" role="tab" id="aba-${a.id}" aria-controls="painel-avisos" aria-selected="${a.id === av.aba}" tabindex="${a.id === av.aba ? 0 : -1}">` +
          `${esc(a.nome)} <span class="adm-contador">${porAba[a.id].length}</span></button>`).join('') +
      `</div>
      <div id="painel-avisos" role="tabpanel" aria-labelledby="aba-${aba.id}" tabindex="-1" class="pilha">
        ${lista.length ? `<ul class="adm-avisos">${lista.map(htmlCartao).join('')}</ul>` : `<p class="texto-2">${esc(aba.vazio)}</p>`}
      </div>
      ${notificacoesHtml()}`;
    area.querySelectorAll('[role=tab]').forEach((b, i, todas) => {
      b.onclick = () => trocarAba(ABAS[i].id);
      b.onkeydown = ev => {
        const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        const j = (i + d + todas.length) % todas.length;
        trocarAba(ABAS[j].id);
        $('aba-' + ABAS[j].id).focus();
      };
    });
    area.querySelectorAll('[data-decidir]').forEach(b => { b.onclick = () => decidir(lista[+b.dataset.grupo], b.dataset.decidir); });
    const ver = $('btn-ver-novos');
    if (ver) ver.onclick = () => { av.novos = []; atualizarTitulo(); trocarAba('pendentes'); $('painel-avisos').focus(); };
    const perm = $('btn-notificacoes');
    if (perm) perm.onclick = async () => { try { await Notification.requestPermission(); } catch (e) { /* recusado */ } renderAvisos(); };
    if (focarPainel) $('painel-avisos').focus({ preventScroll: true });
  }
  function trocarAba(id) {
    av.aba = id;
    if (id === 'pendentes' && av.novos.length) { av.novos = []; atualizarTitulo(); }
    renderAvisos();
  }

  function textoNovos() {
    const [a] = av.novos;
    const base = `Novo aviso: ${nomeLugar(a.lugar)} — ${nomeTipo(a.tipo)}`;
    return av.novos.length > 1 ? `${base} e mais ${av.novos.length - 1}` : base;
  }
  const atualizarTitulo = () => { document.title = av.novos.length ? `(${av.novos.length}) Navi ADM` : 'Navi ADM'; };
  function notificacoesHtml() {
    if (!('Notification' in window)) return '';
    if (Notification.permission === 'default') {
      return `<div class="adm-notificacoes"><p class="texto-2">Quer saber de avisos novos mesmo com esta aba em segundo plano?</p>
        <button type="button" class="btn" id="btn-notificacoes">Permitir notificações</button></div>`;
    }
    if (Notification.permission === 'denied') return `<p class="texto-2 pequeno adm-notificacoes">As notificações estão bloqueadas neste navegador. Avisos novos aparecem só nesta tela.</p>`;
    return '';
  }

  async function decidir(g, situacao) {
    if (!g || av.ocupado) return;
    av.ocupado = true;
    const nome = nomeLugar(g.lugar);
    document.querySelectorAll('[data-decidir]').forEach(b => { b.disabled = true; });
    try {
      await comSessao(async () => {
        await servidor.decidir(g.avisos.map(a => a.id), situacao);
        await buscarAvisos({ silencioso: true });
        renderAvisos({ focarPainel: true });
        anunciar(situacao === 'confirmado' ? `${nome} confirmado como indisponível`
          : situacao === 'recusado' ? `Aviso sobre ${nome} recusado` : `${nome} marcado como resolvido`);
      });
    } catch (e) {
      renderAvisos();
      const area = $('painel-avisos');
      if (area) area.insertAdjacentHTML('afterbegin', `<div class="faixa-erro" role="alert">${faixaErro(mensagem(e))}</div>`);
    } finally {
      av.ocupado = false;
    }
  }

  // busca a lista; avisos pendentes que não estavam na última busca são "novos" (RN70)
  async function buscarAvisos({ silencioso = false } = {}) {
    const lista = await servidor.listarAvisos(slug);
    const pend = lista.filter(a => a.situacao === 'pendente');
    if (av.conhecidos && !silencioso) {
      const chegaram = pend.filter(a => !av.conhecidos.has(a.id));
      if (chegaram.length) {
        av.novos = av.novos.concat(chegaram);
        atualizarTitulo();
        anunciar(textoNovos() + '. Está na aba Pendentes.');
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification('Navi ADM', { body: textoNovos(), tag: 'navi-adm', icon: 'img/icone-192.png' }); } catch (e) { /* sem suporte */ }
        }
      }
    }
    av.conhecidos = new Set(lista.map(a => a.id));
    av.lista = lista;
  }

  async function iniciarAvisos() {
    await buscarAvisos();
    renderAvisos();
    const intervalo = Number(window.NAVI_ADM_INTERVALO_MS) || 30000;
    const verificar = async () => {
      if (av.ocupado) return;
      try {
        const antes = JSON.stringify(av.lista);
        await comSessao(() => buscarAvisos());
        if (!servidor.sessao()) return;
        if (JSON.stringify(av.lista) !== antes) renderSemPerderFoco();
        const r = $('rede-adm'); if (r) r.hidden = true;
      } catch (e) {
        const area = $('area-avisos');
        if (area && !$('rede-adm')) area.insertAdjacentHTML('afterbegin', `<p class="texto-2 pequeno" id="rede-adm" role="status">Sem conexão com o servidor. A lista pode estar desatualizada; o Navi tenta de novo sozinho.</p>`);
        else if ($('rede-adm')) $('rede-adm').hidden = false;
      }
    };
    clearInterval(av.timer);
    av.timer = setInterval(verificar, intervalo);
    pararAvisos = () => { clearInterval(av.timer); av.timer = null; av.conhecidos = null; av.novos = []; av.lista = []; atualizarTitulo(); };
  }
  // a lista mudou sozinha: redesenha e devolve o foco ao mesmo controle, se ainda existir
  function renderSemPerderFoco() {
    const f = document.activeElement;
    const chave = f && (f.id || (f.dataset && f.dataset.decidir && f.closest('article') && f.closest('article').getAttribute('aria-labelledby') + f.dataset.decidir));
    const dentro = f && $('area-avisos') && $('area-avisos').contains(f);
    renderAvisos();
    if (!dentro || !chave) return;
    const alvo = $(chave) || [...document.querySelectorAll('[data-decidir]')].find(b => b.closest('article').getAttribute('aria-labelledby') + b.dataset.decidir === chave);
    if (alvo) alvo.focus({ preventScroll: true });
  }

  /* ---------- abertura ---------- */
  if (!servidor.configurado()) { telaSemServidor(); return; }
  if (servidor.sessao()) await abrirPainel({ focar: true });
  else telaEntrar();

  window.NaviAdm = { servidor, slug };
})();
