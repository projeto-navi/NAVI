/* Navi — Página de Rota (index.html): abertura, perfil, busca, destino e partida. Não tem mapa.
   Fluxo (RN01, RN03, RN56): pergunta de voz só na primeira visita → perfil → "Para onde você vai?"
   → "Por qual entrada você chegou?" → tocar na entrada abre a Página do Mapa. A troca de página só
   acontece ao ativar um botão cujo nome avisa ("Acesso Azul — ver a rota"), nunca ao digitar (RN61).
   Links e QR Codes (RN59): com origem e destino vão direto ao mapa; só com origem, a partida já vem
   preenchida e o site pergunta só o destino. */
(async function () {
  'use strict';
  const NE = window.NaviEstado, NL = window.NaviLocal, NC = window.NaviCategorias, R = window.NaviRotas;
  const svg = (id, c) => window.NaviIcones.svg(id, c);
  const esc = window.NaviUI.esc;
  const $ = id => document.getElementById(id);
  const area = $('etapa');
  const indice = window.NAVI_LOCAIS_INDICE || [];
  const params = NE.parametros(location.search);
  const qs = new URLSearchParams(location.search);

  NE.aplicarNaPagina(NE.preferencias());
  const voz = window.NaviVoz.criar({ regiao: $('anuncio'), avisoEl: $('aviso-visual'), prefs: NE.preferencias });

  /* ---------- local ---------- */
  const slug = NL.slugDaUrl(location.search, indice);
  const slugUrl = slug === NL.slugDaUrl('', indice) ? null : slug;
  let local;
  try {
    local = await NL.carregar(slug, { malha: false });
  } catch (e) {
    area.innerHTML = `<div class="faixa-erro">${svg('i-aviso')}<div><h1>Não foi possível abrir o mapa deste local</h1>` +
      `<p>Os dados não carregaram. Verifique a conexão e recarregue a página.</p></div></div>`;
    return;
  }
  const cfg = local.config || {}, txt = cfg.textos || {};
  $('topo-local').textContent = cfg.nome || 'Navegador Acessível de Vias Internas';
  if (slugUrl) $('marca').href = 'index.html?local=' + encodeURIComponent(slugUrl);
  const G = local.pendente ? null : R.criarGrafo11(local.grafo, local.lugares, { referencias: cfg.referencias });
  const inter = G ? window.NaviInterdicoes.criar({ local, G }) : null;

  /* ---------- estado ---------- */
  const lugar = id => (id && local.lugar(id)) || null;
  const st = {
    etapa: null,
    origem: lugar(params.origem),
    destino: lugar(params.destino),
    proximo: qs.get('proximo') || null,   // categoria "mais próximo" esperando a entrada
    termo: '', filtro: null,
    msg: params.msg
  };
  if (st.origem && st.destino && st.origem.id === st.destino.id) st.destino = null;
  if (params.perfil) NE.aplicarNaPagina(NE.aplicarPerfil(params.perfil));

  // link com partida e destino: vai direto à Página do Mapa (RN59), menos quando a pessoa quer alterar a rota
  if (!local.pendente && st.origem && st.destino && !params.alterar) {
    location.replace(NE.urlMapa({ local: slugUrl, origem: st.origem.id, destino: st.destino.id, perfil: params.perfil || NE.preferencias().perfil }));
    return;
  }

  /* ---------- interface compartilhada ---------- */
  const ui = window.NaviUI.criar({
    local, voz,
    aoMudarPreferencias: (p, nome) => {
      if (nome === 'libras') p.libras ? window.NaviLibras.carregar() : window.NaviLibras.esconder();
      if (nome === 'voz' || nome === 'leitor') ui.renderBarraVoz($('barra-voz'));
      if ((nome === 'escadas' || nome === 'pisoTatil') && st.etapa) render({ focar: false });
    },
    aoTrocarPerfil: () => irPara('perfil'),
    temRotaAjuda: () => !!G && local.lugares.some(l => l.cat === cfg.categoriaAjuda),
    irParaAjuda: () => maisProximo(cfg.categoriaAjuda),
    contexto: () => ({ destino: st.destino, origem: st.origem })
  });
  const avisos = G ? window.NaviAvisosUI.criar({ local, G, inter, voz, ui, contexto: () => ({ origem: st.origem, destino: st.destino }), aoMudar: () => render({ focar: false }) }) : null;
  $('btn-preferencias').onclick = ev => ui.abrirPreferencias(ev.currentTarget);
  $('btn-ajuda').onclick = ev => ui.abrirAjuda(ev.currentTarget);
  if (NE.preferencias().libras) window.NaviLibras.carregar();
  ui.renderBarraVoz($('barra-voz'));

  /* ---------- rede e nova versão ---------- */
  const avisosPagina = $('avisos-pagina');
  const rede = document.createElement('div'); avisosPagina.appendChild(rede);
  const versao = document.createElement('div'); versao.hidden = true; avisosPagina.appendChild(versao);
  window.NaviPWA.indicadorRede(rede, 'Sem internet. A busca e as rotas continuam funcionando; Libras e "Buscar falando" precisam de internet.');
  window.NaviPWA.iniciar({
    oferecerAtualizacao: true,
    mostrarAtualizacao: sw => {
      versao.hidden = false;
      versao.innerHTML = `<div class="faixa-info">${svg('i-info')}<p><b>Nova versão do Navi disponível.</b></p>` +
        `<button type="button" class="btn" data-atualizar>${svg('i-recalcular')}Atualizar agora</button></div>`;
      versao.querySelector('[data-atualizar]').onclick = () => window.NaviPWA.aplicarAtualizacao(sw);
    }
  });

  /* ---------- rota ---------- */
  const opcoesRota = () => Object.assign(window.NaviPreferenciasRota.opcoes(NE.preferencias(), inter.bloqueados(), G), { malha: false });
  function verRota(origem, destino) {
    voz.cancelar();
    location.href = NE.urlMapa({ local: slugUrl, origem: origem.id, destino: destino.id, perfil: NE.preferencias().perfil });
  }
  const rotuloAtalho = cat => ((cfg.atalhos || []).find(a => a[0] === cat) || [, NC.rotulo(cat)])[1];
  /** "Mais próximo" (RN12, RN57): sem partida, pergunta a entrada e calcula sozinho. */
  function maisProximo(cat) {
    if (!st.origem) { st.proximo = cat; st.destino = null; irPara('entrada'); return; }
    const l = R.maisProximoDaCategoria(G, st.origem, cat, opcoesRota());
    if (!l) {
      mostrarMensagem(`Não encontramos ${rotuloAtalho(cat).toLowerCase()} com uma rota possível a partir de ${st.origem.nome}${NE.preferencias().evitarEscadas ? ' sem escadas' : ''}. Peça ajuda a ${(cfg.contatos || {}).ajudaNome === 'SAC' ? 'o SAC' : 'um funcionário'}.`);
      return;
    }
    verRota(st.origem, l);
  }
  let mensagem = null;
  function mostrarMensagem(m) { mensagem = m; render({ focar: false }); const f = area.querySelector('.faixa-erro'); if (f) f.scrollIntoView({ block: 'center' }); voz.anunciar(m); }

  /* ---------- navegação entre etapas (com o botão Voltar do celular) ---------- */
  function urlDaEtapa() {
    const q = new URLSearchParams();
    if (slugUrl) q.set('local', slugUrl);
    const e = st.etapa;
    if (e === 'perfil') q.set('etapa', 'perfil');
    if (e === 'destino' && st.origem) q.set('origem', st.origem.id);
    if (e === 'entrada') { if (st.destino) q.set('destino', st.destino.id); if (st.proximo) q.set('proximo', st.proximo); }
    if (e === 'origem') { q.set('etapa', 'origem'); if (st.destino) q.set('destino', st.destino.id); if (st.proximo) q.set('proximo', st.proximo); }
    if (e === 'resumo') { q.set('origem', st.origem.id); q.set('destino', st.destino.id); q.set('alterar', '1'); }
    const s = q.toString();
    return 'index.html' + (s ? '?' + s : '');
  }
  // n = quantas etapas a pessoa já percorreu nesta página: "Voltar" só usa o histórico quando há para onde voltar
  let n = 0;
  const fotografia = () => ({ etapa: st.etapa, origem: st.origem && st.origem.id, destino: st.destino && st.destino.id, proximo: st.proximo, n });
  function irPara(etapa, opcoes = {}) {
    mensagem = null; st.msg = null;
    st.etapa = etapa; st.termo = ''; st.filtro = null;
    if (opcoes.substituir) history.replaceState(fotografia(), '', urlDaEtapa());
    else { n++; history.pushState(fotografia(), '', urlDaEtapa()); }
    render({ focar: true });
  }
  function voltar() {
    if (history.state && history.state.n > 0) { history.back(); return; }
    st.proximo = null;
    if (st.etapa === 'origem' && st.destino) { irPara('entrada', { substituir: true }); return; }
    st.destino = null;
    irPara('destino', { substituir: true });
  }
  window.addEventListener('popstate', ev => {
    const s = ev.state;
    if (!s || !s.etapa) return;
    st.etapa = s.etapa; st.origem = lugar(s.origem); st.destino = lugar(s.destino); st.proximo = s.proximo || null;
    n = s.n || 0;
    st.termo = ''; st.filtro = null; mensagem = null; st.msg = null;
    render({ focar: true });
  });

  /* ---------- etapas ---------- */
  const TITULOS = {
    perfil: () => `Como você prefere se orientar ${txt.noLocal || 'aqui'}?`,
    destino: () => 'Para onde você vai?',
    entrada: () => 'Por qual entrada você chegou?',
    origem: () => 'Onde você está agora?',
    resumo: () => 'Sua rota',
    preparacao: () => txt.preparacaoTitulo || 'O mapa deste local está em preparação'
  };
  const faixaMensagem = () => mensagem ? `<div class="faixa-erro" role="alert">${svg('i-aviso')}<p>${esc(mensagem)}</p></div>` : '';
  const cabeca = (titulo, voltar, apoio) => `<div class="etapa-cabeca">` +
    (voltar ? `<button type="button" class="btn-texto voltar" data-voltar>${svg('i-voltar')}${esc(voltar)}</button>` : '') +
    `<h1 tabindex="-1">${esc(titulo)}</h1>${apoio ? `<p class="etapa-apoio">${apoio}</p>` : ''}</div>`;

  function htmlPerfil() {
    const itens = ['visual', 'mobilidade', 'auditiva', 'geral'].map(k => {
      const p = NE.PERFIS[k];
      return `<li><button type="button" class="perfil" data-perfil="${k}" aria-labelledby="pf-${k}-nome" aria-describedby="pf-${k}-desc">` +
        `<span class="tile ${k === 'geral' ? '' : 'tile-acao'}" aria-hidden="true">${svg(p.icone)}</span>` +
        `<span class="perfil-texto"><b id="pf-${k}-nome">${esc(p.nome)}</b><span id="pf-${k}-desc">${esc(p.desc)}</span></span>${svg('i-proximo')}</button></li>`;
    }).join('');
    return cabeca(TITULOS.perfil(), null, 'Escolha um perfil. Ele liga as adaptações certas, e depois você ajusta cada uma em Preferências.') +
      `<ul class="perfis">${itens}</ul>`;
  }

  function htmlBusca(modo) {
    const temMic = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const exemplo = txt.exemploBusca || 'Nome da loja ou do serviço';
    return `<div class="busca" role="search">
        <label class="campo-rotulo" for="busca">${modo === 'origem' ? 'Buscar onde você está' : 'Buscar um lugar'}</label>
        <div class="busca-linha">
          <div class="busca-caixa">${svg('i-busca')}<input id="busca" class="entrada-texto" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="${esc(exemplo)}" aria-describedby="busca-ajuda" value="${esc(st.termo)}"></div>
          ${temMic ? `<button type="button" class="btn btn-falar" id="falar" aria-pressed="false" aria-label="Buscar falando" title="Buscar falando">${svg('i-microfone')}</button>` : ''}
        </div>
        <p class="campo-ajuda" id="busca-ajuda">Digite parte do nome${local.lugares.some(l => l.codigo) ? ', o número da sala ou o bloco' : ''}. Acentos não importam.</p>
      </div>`;
  }
  function htmlLista() {
    const filtros = cfg.filtros || [['todos', 'Todos', []]];
    return `<section class="secao" aria-labelledby="lista-titulo">
        <div class="secao-cabeca"><h2 id="lista-titulo">Lugares ${esc(txt.doLocal || '')}</h2></div>
        <div class="filtros" role="group" aria-label="Tipo de lugar">${filtros.map(([id, t]) =>
          `<button type="button" class="filtro" data-filtro="${esc(id)}" aria-pressed="${st.filtro === id}">${svg('i-ok')}${esc(t)}</button>`).join('')}</div>
        <p class="contagem" id="contagem"></p>
        <ul class="lista-lugares" id="resultados"></ul>
      </section>`;
  }
  function htmlDestino() {
    let h = cabeca(TITULOS.destino()) + faixaMensagem();
    if (st.msg === 'escolha') h += `<div class="faixa-info">${svg('i-info')}<p>Escolha para onde você vai.</p></div>`;
    if (st.origem) {
      h += `<div class="ponto-escolhido"><span class="marca-ponto partida" aria-hidden="true"></span><span class="lugar-texto"><small>Partida</small><b>${esc(st.origem.nome)}</b>` +
        `<span class="lugar-desc">${esc(NC.descricao(st.origem, local))}</span></span>` +
        `<button type="button" class="btn-texto" data-trocar-origem>Trocar<span class="sr"> a partida</span></button></div>`;
    }
    h += htmlBusca('destino');
    const atalhos = (cfg.atalhos || []).filter(([c]) => local.lugares.some(l => l.cat === c));
    if (atalhos.length) {
      h += `<section class="secao" aria-labelledby="atalhos-titulo"><h2 id="atalhos-titulo">Ir direto ao mais próximo</h2><div class="atalhos">` +
        atalhos.map(([c, t]) => `<button type="button" class="atalho" data-proximo="${esc(c)}"${st.origem ? ` aria-label="${esc(t)} — ver a rota"` : ''}>` +
          `<span class="tile ${NC.ehAcessibilidade(c) ? 'tile-acao' : ''}" aria-hidden="true">${svg(NC.icone(c))}</span><span>${esc(t)}</span></button>`).join('') + `</div></section>`;
    }
    h += htmlLista();
    if (avisos) h += `<div class="rodape-etapa"><button type="button" class="btn-texto" data-avisar>${svg('i-aviso')}Avisar sobre um local interditado ou danificado</button></div>`;
    return h;
  }
  function htmlEntrada() {
    const entradas = local.lugares.filter(l => l.cat === 'entrada');
    let alvo;
    if (st.proximo) {
      alvo = `<div class="ponto-escolhido"><span class="marca-ponto destino" aria-hidden="true">${svg(NC.icone(st.proximo))}</span><span class="lugar-texto"><small>Destino</small>` +
        `<b>${esc(rotuloAtalho(st.proximo))}</b><span class="lugar-desc">O mais próximo da entrada que você escolher</span></span></div>`;
    } else {
      alvo = `<div class="ponto-escolhido"><span class="marca-ponto destino" aria-hidden="true">${svg('d-chegada')}</span><span class="lugar-texto"><small>Destino</small>` +
        `<b>${esc(st.destino.nome)}</b><span class="lugar-desc">${esc(NC.descricao(st.destino, local))}</span></span></div>`;
    }
    const cores = cfg.coresEntradas || {};
    const corDe = e => cores[e.id] || e.aliases.map(a => cores[a]).find(Boolean) || null;
    const botoes = entradas.map(e => {
      const cor = corDe(e);
      return `<li><button type="button" class="entrada-btn" data-origem="${esc(e.id)}" aria-label="${esc(e.nome)} — ver a rota">` +
        `<span class="tile" aria-hidden="true"${cor ? ` style="background:${esc(cor)};color:#FFFFFF"` : ''}>${svg('c-entrada')}</span>` +
        `<span class="entrada-rotulo"><b>${esc(e.nome)}</b><small>Ver a rota</small></span>${svg('i-proximo')}</button></li>`;
    }).join('');
    return cabeca(TITULOS.entrada(), st.proximo ? 'Voltar' : 'Trocar o destino') + faixaMensagem() + alvo +
      (entradas.length ? `<ul class="entradas">${botoes}</ul>` : '') +
      `<button type="button" class="btn btn-largo" data-outro>${svg('i-busca')}Estou em outro lugar</button>`;
  }
  function htmlOrigem() {
    return cabeca(TITULOS.origem(), 'Voltar') + faixaMensagem() + htmlBusca('origem') + htmlLista();
  }
  function htmlResumo() {
    const ponto = (tipo, l) => `<button type="button" class="ponto-btn" data-editar="${tipo}">` +
      `<span class="marca-ponto ${tipo === 'origem' ? 'partida' : 'destino'}" aria-hidden="true">${tipo === 'origem' ? '' : svg('d-chegada')}</span>` +
      `<span class="lugar-texto"><small>${tipo === 'origem' ? 'Partida' : 'Destino'}</small><b>${esc(l.nome)}</b><span class="lugar-desc texto-2">${esc(NC.descricao(l, local))}</span></span>` +
      `${svg('i-alterar')}<span class="sr">. Trocar</span></button>`;
    return cabeca(TITULOS.resumo(), null, 'Troque a partida ou o destino, ou inverta os dois.') + faixaMensagem() +
      `<div class="trajeto"><div class="trajeto-pontos">${ponto('origem', st.origem)}${ponto('destino', st.destino)}</div>` +
      `<button type="button" class="btn btn-icone" data-inverter aria-label="Inverter partida e destino" title="Inverter partida e destino">${svg('i-inverter')}</button></div>` +
      `<button type="button" class="btn btn-primario btn-largo" data-ver-rota>${svg('i-lugar')}Ver a rota</button>`;
  }
  function htmlPreparacao() {
    return `<div class="preparacao"><div class="preparacao-arte" aria-hidden="true"><span class="tile tile-acao">${svg('i-plano')}</span></div>` +
      cabeca(TITULOS.preparacao(), null, esc(txt.emPreparacao || 'A planta deste local ainda vai ser adicionada.')) +
      `<div class="faixa-info">${svg('i-info')}<p>${esc(txt.preparacaoDepois || 'Quando a planta chegar, você vai poder buscar lugares e ver rotas sem escadas quando precisar.')}</p></div>` +
      `<div class="pilha-curta"><button type="button" class="btn btn-largo" data-ajuda>${svg('i-ajuda')}Pedir ajuda</button>` +
      `<button type="button" class="btn btn-largo" data-preferencias>${svg('i-preferencias')}Ajustar preferências</button></div>` +
      `<p class="texto-2 pequeno">Suas preferências ficam guardadas neste aparelho e valem quando o mapa estiver pronto.</p></div>`;
  }

  /* ---------- lista de lugares ---------- */
  function categoriasDoFiltro() {
    const f = (cfg.filtros || []).find(x => x[0] === st.filtro);
    return f && f[2] && f[2].length ? f[2] : null;
  }
  function renderResultados() {
    const ul = $('resultados');
    if (!ul) return [];
    const cats = categoriasDoFiltro();
    const excluir = st.etapa === 'destino' && st.origem ? st.origem.id : st.etapa === 'origem' && st.destino ? st.destino.id : null;
    const termo = st.termo.trim();
    // sem busca e sem tipo escolhido, a lista fica fechada: a página não vira uma rolagem de centenas de itens
    if (!termo && !st.filtro) { $('contagem').textContent = 'Digite o nome acima ou escolha um tipo de lugar.'; ul.innerHTML = ''; return []; }
    const lista = R.buscar(local.lugares, st.termo).filter(l => (!cats || cats.includes(l.cat)) && l.id !== excluir);
    const decide = (st.etapa === 'destino' && st.origem) || st.etapa === 'origem';
    $('contagem').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'lugar' : 'lugares'}${termo ? ` com “${termo}”` : ''}` :
      `Nenhum lugar com esse nome. Tente outra palavra ou escolha “Todos”.`;
    ul.innerHTML = lista.map(l => {
      const a = inter && inter.de(l.id);
      return `<li><button type="button" class="lugar" data-lugar="${esc(l.id)}">${NC.tile(l, svg)}<span class="lugar-texto">` +
        `<span class="lugar-nome">${esc(l.nome)}<span class="sr">,</span></span><span class="lugar-desc">${esc(NC.descricao(l, local))}</span>` +
        (a ? `<span class="etiqueta etiqueta-alerta">${svg('i-aviso')}${esc(window.NaviInterdicoes.TIPOS[a.tipo].nome)}</span>` : '') +
        `${decide ? '<span class="sr">, ver a rota</span>' : ''}</span>${svg('i-proximo')}</button></li>`;
    }).join('');
    return lista;
  }
  let timerContagem = null;
  function anunciarContagem() {
    clearTimeout(timerContagem);
    timerContagem = setTimeout(() => { const c = $('contagem'); if (c) voz.anunciar(c.textContent, { falar: false, visual: false }); }, 900);
  }

  /* ---------- buscar falando (RN11) ---------- */
  function ouvirBusca(botao) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (navigator.onLine === false) { voz.anunciar('"Buscar falando" precisa de internet. Digite o nome do lugar.'); return; }
    voz.cancelar();
    let rec;
    try { rec = new SR(); } catch (e) { voz.anunciar('Este navegador não permite buscar falando. Digite o nome do lugar.'); return; }
    rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;
    botao.setAttribute('aria-pressed', 'true');
    voz.anunciar('Pode falar o nome do lugar.', { falar: false });
    rec.onresult = ev => {
      const t = ev.results[0][0].transcript.replace(/[.?!]$/, '');
      st.termo = t; const campo = $('busca'); if (campo) campo.value = t;
      const lista = renderResultados(); ligarResultados();
      voz.anunciar(lista.length ? `Você disse ${t}. Encontrei ${lista.length}. O primeiro é ${lista[0].nome}.` : `Você disse ${t}. Não encontrei nenhum lugar com esse nome.`);
      const b = $('resultados') && $('resultados').querySelector('button');
      if (b) b.focus();
    };
    rec.onerror = () => voz.anunciar('Não consegui ouvir. Tente de novo ou digite o nome.');
    rec.onend = () => botao.setAttribute('aria-pressed', 'false');
    try { rec.start(); } catch (e) { /* já está ouvindo */ }
  }

  /* ---------- escolhas ---------- */
  function escolherLugar(id) {
    const l = lugar(id);
    if (!l) return;
    if (st.etapa === 'origem') {
      st.origem = l;
      if (st.proximo) { const cat = st.proximo; st.proximo = null; maisProximo(cat); return; }
      if (st.destino) { verRota(st.origem, st.destino); return; }
      irPara('destino');
      return;
    }
    // destino
    st.destino = l;
    if (st.origem) { verRota(st.origem, st.destino); return; }
    prefetchMapa();
    irPara('entrada');
    voz.anunciar(`Destino: ${l.nome}, ${NC.descricao(l, local)}. Agora diga por qual entrada você chegou.`, { visual: false });
  }
  function escolherEntrada(id) {
    st.origem = lugar(id);
    if (st.proximo) { const cat = st.proximo; st.proximo = null; maisProximo(cat); return; }
    verRota(st.origem, st.destino);
  }

  let prefetchFeito = false;
  function prefetchMapa() {
    if (prefetchFeito || !/^https?:$/.test(location.protocol)) return;
    prefetchFeito = true;
    for (const href of ['mapa.html', 'css/mapa.css', 'js/pagina-mapa.js', 'js/folha.js', 'js/mapa-renderer.js', 'js/mapa2d.js', `locais/${slug}/malha.js`, `locais/${slug}/dados3d.js`]) {
      const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href; document.head.appendChild(l);
    }
  }

  /* ---------- render ---------- */
  function ligarResultados() {
    const ul = $('resultados');
    if (ul) ul.querySelectorAll('[data-lugar]').forEach(b => b.onclick = () => escolherLugar(b.dataset.lugar));
  }
  function ligarPerfis() {
    area.querySelectorAll('[data-perfil]').forEach(b => b.onclick = ev => {
      const k = b.dataset.perfil, p = NE.PERFIS[k];
      // com a voz ligada: 1º toque lê a opção, 2º toque escolhe (teclado escolhe direto)
      if (NE.preferencias().voz && ev.detail > 0 && b.dataset.ouvido !== 'sim') {
        area.querySelectorAll('[data-ouvido]').forEach(x => delete x.dataset.ouvido);
        b.dataset.ouvido = 'sim';
        voz.falar(`${p.nome}. ${p.desc} Toque de novo para escolher.`);
        return;
      }
      const prefs = NE.aplicarPerfil(k);
      NE.aplicarNaPagina(prefs);
      if (prefs.libras) window.NaviLibras.carregar();
      ui.renderBarraVoz($('barra-voz'));
      const aviso = { visual: 'Perfil deficiência visual: alto contraste, letras maiores e voz ligados.', mobilidade: 'Perfil mobilidade reduzida: as rotas evitam escadas e usam o elevador.',
        auditiva: 'Perfil deficiência auditiva: tradutor de Libras ligado e orientações por escrito.', geral: 'Sem adaptações.' }[k];
      irPara(local.pendente ? 'preparacao' : st.destino ? 'entrada' : 'destino');
      voz.anunciar(aviso + ' ' + TITULOS[st.etapa](), { visual: false });
    });
  }
  function render({ focar = true } = {}) {
    const e = st.etapa;
    document.title = `${TITULOS[e]()} | Navi · ${cfg.nome || ''}`;
    area.innerHTML = e === 'perfil' ? htmlPerfil() : e === 'entrada' ? htmlEntrada() : e === 'origem' ? htmlOrigem() :
      e === 'resumo' ? htmlResumo() : e === 'preparacao' ? htmlPreparacao() : htmlDestino();
    if (e === 'perfil') ligarPerfis();
    const busca = $('busca');
    if (busca) {
      busca.oninput = () => { st.termo = busca.value; renderResultados(); ligarResultados(); anunciarContagem(); };
      // o teclado virtual nunca cobre o campo: quando ele abre (a área visível encolhe), o campo sobe se ficou escondido
      busca.onfocus = () => {
        const vv = window.visualViewport;
        if (!vv) return;
        vv.addEventListener('resize', () => {
          const r = busca.getBoundingClientRect();
          if (r.bottom > vv.height - 8 || r.top < 0) busca.scrollIntoView({ block: 'start', behavior: 'instant' });
        }, { once: true });
      };
      renderResultados(); ligarResultados();
    }
    area.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
      st.filtro = st.filtro === b.dataset.filtro ? null : b.dataset.filtro;
      area.querySelectorAll('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.filtro === st.filtro)));
      renderResultados(); ligarResultados();
      voz.anunciar($('contagem').textContent, { falar: false, visual: false });
    });
    const mic = $('falar'); if (mic) mic.onclick = () => ouvirBusca(mic);
    area.querySelectorAll('[data-proximo]').forEach(b => b.onclick = () => maisProximo(b.dataset.proximo));
    area.querySelectorAll('[data-origem]').forEach(b => b.onclick = () => escolherEntrada(b.dataset.origem));
    const on = (sel, fn) => { const b = area.querySelector(sel); if (b) b.onclick = fn; };
    on('[data-voltar]', voltar);
    on('[data-trocar-origem]', () => { st.origem = null; irPara('destino'); });
    on('[data-outro]', () => irPara('origem'));
    on('[data-avisar]', ev => avisos.abrir(ev.currentTarget));
    on('[data-ajuda]', ev => ui.abrirAjuda(ev.currentTarget));
    on('[data-preferencias]', ev => ui.abrirPreferencias(ev.currentTarget));
    on('[data-inverter]', () => {
      [st.origem, st.destino] = [st.destino, st.origem];
      history.replaceState(fotografia(), '', urlDaEtapa());
      render({ focar: false });
      area.querySelector('[data-inverter]').focus();
      voz.anunciar(`Invertido. Partida: ${st.origem.nome}. Destino: ${st.destino.nome}.`);
    });
    on('[data-ver-rota]', () => verRota(st.origem, st.destino));
    area.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => {
      if (b.dataset.editar === 'origem') { const d = st.destino; st.origem = null; st.destino = d; irPara('origem'); }
      else { st.destino = null; irPara('destino'); }
    });
    if (focar) {
      const p = NE.preferencias();
      const campo = $('busca');
      if (campo && e === 'destino' && p.perfil === 'visual') campo.focus();
      else { const h1 = area.querySelector('h1'); if (h1) h1.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    }
  }

  /* ---------- pergunta de voz na primeira visita (RN01, RN29) ---------- */
  function perguntarVoz() {
    return new Promise(pronto => {
      const dlg = document.createElement('dialog');
      dlg.className = 'dialogo dialogo-voz'; dlg.id = 'dlg-voz';
      dlg.setAttribute('aria-labelledby', 'voz-titulo'); dlg.setAttribute('aria-describedby', 'voz-desc');
      dlg.innerHTML = `<div class="dialogo-corpo"><span class="tile tile-acao" aria-hidden="true">${svg('i-voz')}</span>` +
        `<h2 id="voz-titulo" tabindex="-1">Deseja ouvir as instruções em voz alta?</h2>` +
        `<p id="voz-desc">Recomendado para quem não usa leitor de tela, como o TalkBack ou o VoiceOver.</p>` +
        `<div class="linha-acoes"><button type="button" class="btn btn-primario" data-resp="sim">Sim</button><button type="button" class="btn" data-resp="nao">Não</button></div>` +
        `<p class="texto-2 pequeno">Você pode mudar isso depois em Preferências.</p></div>`;
      $('dialogos').appendChild(dlg);
      const PERGUNTA = 'Deseja ouvir as instruções em voz alta? Recomendado para quem não usa leitor de tela. Toque em Sim ou em Não.';
      const responder = sim => {
        NE.salvar({ voz: sim });
        NE.concluirBoasVindas();
        dlg.close(); dlg.remove();
        ui.renderBarraVoz($('barra-voz'));
        if (sim) voz.falar('Voz ligada.');
        else voz.cancelar();
        pronto();
      };
      dlg.querySelector('[data-resp="sim"]').onclick = () => responder(true);
      dlg.querySelector('[data-resp="nao"]').onclick = () => responder(false);
      dlg.addEventListener('cancel', ev => { ev.preventDefault(); responder(false); });
      // tocar em qualquer área da pergunta, fora dos botões, lê a pergunta em voz alta
      dlg.addEventListener('click', ev => { if (!ev.target.closest('button')) voz.falar(PERGUNTA, { forcar: true }); });
      dlg.showModal();
      dlg.querySelector('h2').focus();
      // alguns navegadores só liberam a voz depois do primeiro toque; tentamos mesmo assim
      setTimeout(() => voz.falar(PERGUNTA, { forcar: true }), 400);
    });
  }

  /* ---------- início ---------- */
  const etapaPedida = qs.get('etapa');
  let inicial;
  if (local.pendente) inicial = 'preparacao';
  else if (etapaPedida === 'perfil') inicial = 'perfil';
  else if (params.alterar && st.origem && st.destino) inicial = 'resumo';
  else if (!NE.preferencias().perfil && !params.perfil) inicial = 'perfil';
  else if (etapaPedida === 'origem') inicial = 'origem';
  else if (st.destino || st.proximo) inicial = 'entrada';
  else inicial = 'destino';
  st.etapa = inicial;
  history.replaceState(fotografia(), '', urlDaEtapa());
  render({ focar: false });
  if (NE.primeiraVisita()) {
    await perguntarVoz();
    const h1 = area.querySelector('h1'); if (h1) h1.focus({ preventScroll: true });
  }
  if (st.etapa === 'perfil' || st.etapa === 'preparacao') voz.falar(TITULOS[st.etapa]());
  if (st.destino && st.etapa === 'entrada') prefetchMapa();
  if (params.avisar && avisos) avisos.abrir();
  window.NaviRota = { st, local, G, irPara };
})();
