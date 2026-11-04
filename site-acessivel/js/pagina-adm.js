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
    acoesTopo.innerHTML = `<span class="adm-quem">${svg('i-voce')}<span><span class="sr">Entrou como </span>${esc(s.usuario)}</span></span>
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

  /* ---------- avisos (painel completo na próxima etapa) ---------- */
  async function iniciarAvisos() {
    const a = $('area-avisos');
    const lista = await servidor.listarAvisos(slug);
    if (a) a.innerHTML = `<p class="texto-2">${lista.length} ${lista.length === 1 ? 'aviso' : 'avisos'}.</p>`;
  }

  /* ---------- abertura ---------- */
  if (!servidor.configurado()) { telaSemServidor(); return; }
  if (servidor.sessao()) await abrirPainel({ focar: true });
  else telaEntrar();

  window.NaviAdm = { servidor, slug };
})();
