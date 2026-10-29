/* Navi — Página do Mapa (mapa.html): o mapa em tela cheia e o passo a passo. Sem barra de pesquisa.
   - Aberta sem partida ou destino válidos, volta para a Página de Rota com "Escolha para onde você vai" (RN60).
   - Ao abrir: foco no título "Rota até <destino>" e um anúncio só: "Rota calculada: N passos. Passo 1: …" (RN35).
     Com a voz ligada, o site fala o passo 1 (RN26), nunca por cima do leitor de tela (RN28).
   - O passo atual, Anterior, Próximo e Repetir ficam no painel inferior; Alterar destino e Recalcular, no
     estado expandido (RN25, RN42). Sem caminho acessível, o painel abre no estado médio com o motivo (RN17).
   - A partida só muda por "Alterar" ou "Inverter" (RN09). Tocar num lugar do mapa abre um cartão com
     "Ir para cá", que troca o destino aqui mesmo; tocar nunca troca de página (RN10).
   - 2D é o padrão; o 3D e a primeira pessoa só carregam quando pedidos (RN45–RN48).
   - A versão nova do site nunca recarrega esta página no meio da rota: entra no próximo carregamento. */
(async function () {
  'use strict';
  const NE = window.NaviEstado, NL = window.NaviLocal, NC = window.NaviCategorias, R = window.NaviRotas;
  const svg = (id, c) => window.NaviIcones.svg(id, c);
  const esc = window.NaviUI.esc;
  const $ = id => document.getElementById(id);
  const indice = window.NAVI_LOCAIS_INDICE || [];
  const params = NE.parametros(location.search);

  NE.aplicarNaPagina(NE.preferencias());
  const voz = window.NaviVoz.criar({ regiao: $('anuncio'), avisoEl: $('aviso-visual'), prefs: NE.preferencias });

  function erroFatal(titulo, texto) {
    $('titulo-rota').textContent = titulo;
    $('folha-atual').innerHTML = `<div class="faixa-erro">${svg('i-aviso')}<div><p>${esc(texto)}</p>` +
      `<p><a href="${esc(NE.urlRota({ local: slugUrl }))}">Voltar para a escolha da rota</a></p></div></div>`;
    document.body.classList.add('sem-mapa');
  }

  /* ---------- local, partida e destino ---------- */
  const slug = NL.slugDaUrl(location.search, indice);
  const slugUrl = slug === NL.slugDaUrl('', indice) ? null : slug;
  let local;
  try {
    local = await NL.carregar(slug);
  } catch (e) {
    erroFatal('Não foi possível abrir o mapa deste local', 'Os dados não carregaram. Verifique a conexão e recarregue a página.');
    return;
  }
  const cfg = local.config || {}, txt = cfg.textos || {}, contatos = cfg.contatos || {};
  const origem0 = local.pendente ? null : local.lugar(params.origem);
  const destino0 = local.pendente ? null : local.lugar(params.destino);
  if (!origem0 || !destino0 || origem0.id === destino0.id) {
    // RN60: sem partida ou destino válidos, a escolha volta para a Página de Rota
    location.replace(NE.urlRota({ local: slugUrl, origem: origem0 && !destino0 ? origem0.id : null, perfil: params.perfil, msg: 'escolha' }));
    return;
  }
  if (params.perfil) NE.aplicarNaPagina(NE.aplicarPerfil(params.perfil));

  const G = R.criarGrafo11(local.grafo, local.lugares, { referencias: cfg.referencias });
  R.usarMalha(local.malha);
  const inter = window.NaviInterdicoes.criar({ local, G });
  const nomeAndar = piso => G.nomeDoAndar(piso);
  const andarIdDe = piso => { const a = local.andares.find(x => x.ordem === piso); return a ? a.id : null; };
  const palavraAndar = /^piso/i.test((local.andares[0] || {}).nome || '') ? 'pisos' : 'andares';
  const quemAjuda = contatos.ajudaNome === 'SAC' ? 'o SAC' : contatos.ajudaNome ? 'a ' + contatos.ajudaNome : 'a equipe';
  const dataBR = iso => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');

  const st = { origem: origem0, destino: destino0, rota: null, passo: 0, andar: origem0.piso, vista: '2d', nomes: false, semMapa: false, mudouAqui: false };

  /* ---------- rota ---------- */
  // preferências que mudam o caminho (RN15, RN64, RN65): js/preferencias-rota.js
  const PR = window.NaviPreferenciasRota;
  const opcoesRota = () => PR.opcoes(NE.preferencias(), inter.bloqueados(), G);
  function calcular() {
    st.rota = PR.rota(R, G, st.origem, st.destino, NE.preferencias(), inter.bloqueados());
    st.passo = 0;
    st.andar = st.rota ? st.rota.trechos[0].piso : st.origem.piso;
  }
  /** Por que não há caminho (RN17): bloqueio, escadas ou falta de ligação na planta. */
  function motivoSemCaminho() {
    const p = NE.preferencias(), bloq = inter.bloqueados();
    if (bloq.has(st.destino.id)) return `${st.destino.nome} está com aviso de interdição.`;
    if (bloq.has(st.origem.id)) return `${st.origem.nome} está com aviso de interdição.`;
    const ignorandoAvisos = R.rota(G, st.origem, st.destino, { semEscadas: p.evitarEscadas, malha: false });
    if (ignorandoAvisos) {
      // elevador, plataforma ou rampa com aviso: diz qual (a rampa é o caminho sem escada quando não há elevador, RN65)
      const NOME_MEIO = { elevador: 'o elevador', plataforma: 'a plataforma elevatória', rampa: 'a rampa' };
      const meiosBloq = [...new Set(local.lugares.filter(l => (NC.ehEquipamento(l.cat) || l.cat === 'rampa') && !NC.ehEscada(l.cat) && bloq.has(l.id)).map(l => l.cat))];
      if (meiosBloq.length && st.origem.piso !== st.destino.piso) {
        const nomes = meiosBloq.map(c => NOME_MEIO[c] || 'o equipamento'), varios = nomes.length > 1;
        const sujeito = nomes.join(' e ');
        return `${sujeito[0].toUpperCase() + sujeito.slice(1)} ${varios ? 'estão' : 'está'} com aviso de interdição ou defeito, e a rota sem escadas depende ${varios ? 'deles' : nomes[0].startsWith('a ') ? 'dela' : 'dele'}.`;
      }
      return 'O caminho passa por um local com aviso de interdição.';
    }
    if (p.evitarEscadas && R.rota(G, st.origem, st.destino, { bloqueados: bloq, malha: false })) return 'O único caminho encontrado usa escada ou escada rolante.';
    return 'A planta não mostra uma ligação entre esses dois pontos.';
  }
  const SETAS = { inicio: 'd-inicio', reto: 'd-reto', esq: 'd-esq', dir: 'd-dir', 'leve-esq': 'd-leve-esq', 'leve-dir': 'd-leve-dir', volta: 'd-volta', chegada: 'd-chegada' };
  const iconePasso = p => SETAS[p.tipo] || NC.icone(p.rotulo || (p.tipo === 'elevador' ? 'elevador' : 'escada_rolante'));
  const MEIO = { elevador: 'o elevador', escada_rolante: 'a escada rolante', escada: 'a escada', plataforma: 'a plataforma elevatória', rampa: 'a rampa' };
  const meioDe = t => MEIO[t.saidaRotulo] || (t.saida === 'elevador' ? 'o elevador' : 'a escada rolante');
  const POR = { elevador: 'pelo elevador', escada_rolante: 'pela escada rolante', escada: 'pela escada', plataforma: 'pela plataforma', rampa: 'pela rampa' };
  const por = t => POR[t.saidaRotulo] || (t.saida === 'elevador' ? 'pelo elevador' : 'pela escada rolante');
  const multiAndar = () => !!st.rota && new Set(st.rota.trechos.map(t => t.piso)).size > 1;

  function resumoRota() {
    const r = st.rota;
    if (!r) return NE.preferencias().evitarEscadas ? 'Sem caminho acessível confirmado.' : 'Sem caminho confirmado.';
    const n = r.passos.length, pisos = [...new Set(r.trechos.map(t => t.piso))];
    const semEscadas = NE.preferencias().evitarEscadas || !r.usaEscada;
    if (pisos.length === 1) return `${n} passos no ${nomeAndar(pisos[0])}${semEscadas ? ', sem escadas' : ''}.`;
    // como a rota troca de andar, na ordem (ex.: "pelo elevador e pela rampa")
    const meios = [...new Set(r.trechos.slice(0, -1).filter(t => t.saida).map(por))];
    const meio = meios.join(' e ');
    return `${n} passos, do ${nomeAndar(pisos[0])} ao ${nomeAndar(pisos[pisos.length - 1])}${meio ? ' ' + meio : ''}.`;
  }
  const textoPasso = i => `Passo ${i + 1} de ${st.rota.passos.length}: ${st.rota.passos[i].texto}`;

  /* ---------- interface compartilhada ---------- */
  const ui = window.NaviUI.criar({
    local, voz,
    aoMudarPreferencias: (p, nome) => {
      if (nome === 'libras') p.libras ? window.NaviLibras.carregar() : window.NaviLibras.esconder();
      if (nome === 'voz' || nome === 'leitor') { renderVoz(); renderExpandido(); }
      if (nome === 'escadas' || nome === 'pisoTatil') { recalcular({ anunciar: true, focar: false }); return; }
      if (nome === 'tema') mapa.applyTheme();
      if (nome === 'texto') { aplicarPreferenciasNoMapa(); requestAnimationFrame(medirLayout); }
    },
    temRotaAjuda: () => local.lugares.some(l => l.cat === cfg.categoriaAjuda),
    irParaAjuda: () => {
      const l = R.maisProximoDaCategoria(G, st.origem, cfg.categoriaAjuda, opcoesRota());
      if (l) irPara(l); else voz.anunciar(`Não encontramos uma rota até ${quemAjuda} a partir de ${st.origem.nome}.`);
    },
    contexto: () => ({ destino: st.destino, origem: st.origem, passo: st.rota ? st.rota.passos[st.passo].texto : '' })
  });
  const avisos = window.NaviAvisosUI.criar({
    local, G, inter, voz, ui,
    contexto: () => ({ origem: st.origem, destino: st.destino }),
    aoMudar: () => recalcular({ anunciar: false, focar: false })
  });
  if (NE.preferencias().libras) window.NaviLibras.carregar();

  /* ---------- topo: Voltar, resumo e Alterar ---------- */
  const veioDaRota = (() => {
    try { const u = new URL(document.referrer); return u.origin === location.origin && /(^|\/)(index\.html)?$/.test(u.pathname) && history.length > 1; }
    catch (e) { return false; }
  })();
  function renderTopo() {
    $('mapa-resumo').innerHTML = `<span class="sr">Rota de </span><span class="ponto">${esc(st.origem.nome)}</span>` +
      `<span class="ponto">${svg('i-seta-direita')}<span class="sr"> até </span>${esc(st.destino.nome)}</span>`;
    const campos = { local: slugUrl, origem: st.origem.id, destino: st.destino.id, alterar: '1' };
    $('alterar').href = NE.urlRota(campos);
    $('voltar').href = NE.urlRota(campos);
  }
  $('voltar').addEventListener('click', ev => {
    // volta ao passo anterior da Página de Rota, como o botão Voltar do celular
    if (veioDaRota && !st.mudouAqui) { ev.preventDefault(); voz.cancelar(); history.back(); }
  });
  $('alterar').addEventListener('click', () => voz.cancelar());

  /* ---------- painel: cabeça, passo atual, médio e expandido ---------- */
  function renderCabeca() {
    $('titulo-rota').textContent = `Rota até ${st.destino.nome}`;
    $('folha-resumo').textContent = resumoRota();
    document.title = `Rota até ${st.destino.nome} | Navi · ${cfg.nome || ''}`;
  }
  function renderVoz() {
    const el = $('barra-voz');
    if (el) ui.renderBarraVoz(el);
  }
  function htmlSemCaminho() {
    const p = NE.preferencias();
    const titulo = p.evitarEscadas ? 'Não encontramos caminho acessível confirmado' : 'Não encontramos um caminho entre esses dois pontos';
    let contato = esc(`Procure ${quemAjuda}${contatos.ajudaOnde ? ', ' + contatos.ajudaOnde : ''}`);
    contato += contatos.telefone ? `, ou ligue <span class="sem-quebra">${esc(contatos.telefone)}</span>.` : '.';
    if (!contatos.ajudaNome && !contatos.telefone) contato = 'Procure um funcionário ou siga a sinalização.';
    return `<div class="sem-caminho"><div class="faixa-erro" role="status">${svg('i-aviso')}<div><h2>${esc(titulo)}</h2>` +
      `<p>${esc(motivoSemCaminho())} ${contato}</p></div></div>` +
      `<div class="linha-acoes">` +
      (contatos.telefone ? `<a class="btn btn-primario" href="tel:${esc(contatos.telefoneLink || contatos.telefone)}">${svg('i-telefone')}Ligar para ${esc(quemAjuda)}</a>` : '') +
      `<button type="button" class="btn" data-acao="ajuda">${svg('i-ajuda')}Pedir ajuda</button>` +
      `<a class="btn" data-acao="alterar-destino" href="${esc(NE.urlRota({ local: slugUrl, origem: st.origem.id }))}">${svg('i-alterar')}Alterar destino</a></div></div>`;
  }
  function htmlAtual() {
    if (!st.rota) return htmlSemCaminho();
    return `<div id="barra-voz" hidden></div>
      <div class="passo-progresso"><span class="placa-meta" id="passo-meta"></span><span class="trilha" id="trilha" aria-hidden="true"></span></div>
      <div class="placa" id="placa"><span class="placa-seta" id="placa-seta" aria-hidden="true">${svg('d-reto')}</span><p class="placa-texto" id="passo-texto"></p></div>
      <div class="folha-nav">
        <button type="button" class="btn" id="passo-ant">${svg('i-anterior')}Anterior</button>
        <button type="button" class="btn" id="repetir">${svg('i-repetir')}Repetir</button>
        <button type="button" class="btn btn-primario" id="passo-prox">Próximo${svg('i-proximo')}</button>
      </div>`;
  }
  function renderAtual() {
    $('folha-atual').innerHTML = htmlAtual();
    if (st.rota) {
      $('passo-ant').onclick = () => irParaPasso(st.passo - 1);
      $('passo-prox').onclick = () => irParaPasso(st.passo + 1);
      $('repetir').onclick = repetir;
      renderVoz();
      atualizarPasso();
    }
  }
  /** Atualiza o passo atual sem refazer os botões (o foco continua onde está). */
  function atualizarPasso() {
    const r = st.rota, p = r.passos[st.passo], n = r.passos.length;
    $('passo-meta').textContent = `Passo ${st.passo + 1} de ${n}${multiAndar() ? ', ' + nomeAndar(p.piso) : ''}`;
    $('trilha').innerHTML = r.passos.map((_, i) => `<i class="${i < st.passo ? 'feito' : i === st.passo ? 'atual' : ''}"></i>`).join('');
    const seta = $('placa-seta');
    seta.dataset.tipo = p.tipo;
    seta.innerHTML = svg(iconePasso(p));
    $('passo-texto').textContent = p.texto;
    $('passo-ant').setAttribute('aria-disabled', String(st.passo === 0));
    $('passo-prox').setAttribute('aria-disabled', String(st.passo === n - 1));
    document.querySelectorAll('#lista-passos [data-passo]').forEach(b => {
      if (+b.dataset.passo === st.passo) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    renderProximos();
  }
  function htmlSelo() {
    const data = dataBR(cfg.dataPlanta);
    return `<div class="selo-rota">${svg('i-info')}<p><b>Rota demonstrativa, não verificada no local.</b> ` +
      `Feita a partir da ${esc(cfg.fontePlanta || 'planta do local')}${data ? ` de ${data}` : ''}.</p></div>`;
  }
  function htmlNotasDaRota() {
    const r = st.rota;
    let h = '';
    for (const [lugar, papel] of [[r.destino, 'O destino'], [r.origem, 'O ponto de partida']]) {
      const a = inter.de(lugar.id);
      if (a) h += `<div class="faixa-aviso">${svg('i-aviso')}<p>${papel}, ${esc(lugar.nome)}, tem aviso: <b>${esc(window.NaviInterdicoes.TIPOS[a.tipo].nome.toLowerCase())}</b>` +
        `${a.detalhe ? ` (${esc(a.detalhe)})` : ''}. ${a.oficial ? 'Confirmado pela equipe.' : 'Aviso feito neste aparelho, ainda não confirmado.'}</p></div>`;
    }
    const desvios = [...inter.bloqueados()].map(id => G.lugarPorId[id]).filter(l => l && NC.ehEquipamento(l.cat));
    if (desvios.length) h += `<p class="nota">Esta rota evita ${[...new Set(desvios.map(l => NC.ehEscada(l.cat) ? 'uma escada rolante' : 'o elevador'))].join(' e ')} com aviso de interdição ou defeito.</p>`;
    return h;
  }
  function renderMedio() {
    const el = $('folha-medio');
    if (!st.rota) { el.innerHTML = htmlSelo(); return; }
    el.innerHTML = htmlNotasDaRota() + htmlSelo() + `<div class="secao-folha" id="sec-proximos"><h2>Próximos passos</h2><ol class="proximos" id="proximos"></ol></div>`;
    renderProximos();
  }
  function renderProximos() {
    const ol = $('proximos');
    if (!ol || !st.rota) return;
    const r = st.rota, prox = r.passos.slice(st.passo + 1, st.passo + 4);
    $('sec-proximos').hidden = !prox.length;
    ol.innerHTML = prox.map((p, k) => `<li>${svg(iconePasso(p))}<span><small>Passo ${st.passo + k + 2}</small>${esc(p.texto)}</span></li>`).join('');
  }
  function acao(id, icone, texto, extra = {}) {
    const desc = extra.desc ? `<small>${esc(extra.desc)}</small>` : '';
    const pressed = extra.pressionado != null ? ` aria-pressed="${extra.pressionado}"` : '';
    const corpo = `${svg(icone)}<span class="acao-texto">${esc(texto)}${desc}</span>`;
    return extra.href ? `<a class="acao" data-acao="${id}" href="${esc(extra.href)}">${corpo}</a>` :
      `<button type="button" class="acao" data-acao="${id}"${pressed}>${corpo}</button>`;
  }
  const lugaresDoAndar = () => local.lugares.filter(l => l.piso === st.andar);
  const ordemAlfabetica = new Intl.Collator('pt-BR').compare; // um comparador só: localeCompare com idioma cria um a cada par
  const itensLugares = lista => lista.slice().sort((a, b) => ordemAlfabetica(a.nome, b.nome)).map(l => `<li><button type="button" class="lugar" data-lugar="${esc(l.id)}">${NC.tile(l, svg)}<span class="lugar-texto">` +
    `<span class="lugar-nome">${esc(l.nome)}<span class="sr">,</span></span><span class="lugar-desc">${esc(NC.descricao(l, local))}</span></span></button></li>`).join('');
  // são muitos lugares por andar: a lista só é montada quando a pessoa abre (a abertura da página fica mais leve)
  function htmlLugaresAndar(aberto) {
    const lista = lugaresDoAndar();
    return `<details class="lugares-andar" id="lugares-andar"${aberto ? ' open' : ''}><summary>Lugares do ${esc(nomeAndar(st.andar))} (${lista.length})</summary>` +
      `<p class="nota">Toque num lugar para ver onde fica e ir até ele.</p><ul class="lista-lugares">${aberto ? itensLugares(lista) : ''}</ul></details>`;
  }
  function preencherLugares() {
    const ul = document.querySelector('#lugares-andar .lista-lugares');
    if (ul && !ul.childElementCount) ul.innerHTML = itensLugares(lugaresDoAndar());
  }
  function renderExpandido() {
    const el = $('folha-expandido');
    const p = NE.preferencias();
    const aberto = !!($('lugares-andar') && $('lugares-andar').open);
    let h = '';
    if (st.rota) {
      h += `<div class="secao-folha"><h2>Passo a passo</h2><ol class="passos" id="lista-passos">` +
        st.rota.passos.map((q, i) => `<li><button type="button" class="passo" data-passo="${i}"${i === st.passo ? ' aria-current="step"' : ''}>` +
          `<span class="tile" aria-hidden="true">${svg(iconePasso(q))}</span><span class="passo-texto"><small>Passo ${i + 1}${multiAndar() ? ', ' + esc(nomeAndar(q.piso)) : ''}</small>${esc(q.texto)}</span></button></li>`).join('') +
        `</ol></div>`;
      if (st.rota.usaElevador && txt.elevadorEstimado) h += `<p class="nota">${esc(txt.elevadorEstimado)}</p>`;
      h += `<p class="nota">As distâncias são aproximadas e usam ${local.config.tipo === 'shopping' ? 'lojas' : 'lugares'} próximos como referência.</p>`;
    }
    h += `<div class="secao-folha"><h2>Rota</h2><div class="acoes">` +
      acao('alterar-destino', 'i-alterar', 'Alterar destino', { href: NE.urlRota({ local: slugUrl, origem: st.origem.id }) }) +
      acao('inverter', 'i-inverter', 'Inverter partida e destino') +
      acao('recalcular', 'i-recalcular', 'Recalcular', { desc: 'Usa os avisos e as preferências de agora.' }) +
      `</div></div>`;
    const cap = mapa ? mapa.capabilities() : {};
    h += `<div class="secao-folha"><h2>Mapa</h2><div class="acoes">` +
      acao('esconder-mapa', st.semMapa ? 'i-plano' : 'i-lista', st.semMapa ? 'Mostrar mapa' : 'Esconder mapa', { desc: st.semMapa ? 'Volta a mostrar a planta.' : 'Mostra só o passo a passo, em tela cheia.' }) +
      (temPlanta ? acao('nomes', 'i-texto', 'Mostrar todos os nomes no mapa', { pressionado: st.nomes }) : '') +
      (tem3D && st.rota && !p.leitorDeTela ? acao('primeira-pessoa', 'i-primeira-pessoa', 'Ver em primeira pessoa', { desc: 'Percorra a rota como se estivesse andando.' }) : '') +
      (st.vista === '3d' && mapa3d ? acao('vista-cima', 'i-plano', 'Vista de cima') +
        (local.andares.length > 1 ? acao('ambos', 'i-andares', `Ver ${local.andares.length === 2 ? 'os dois' : 'todos os'} ${palavraAndar}`, { pressionado: !!mapa3d.emAmbos }) : '') : '') +
      `</div></div>`;
    h += `<div class="secao-folha"><h2>Ajuda</h2><div class="acoes">` +
      (st.rota && voz.temVoz && !p.leitorDeTela ? acao('ouvir-tudo', 'i-voz', 'Ouvir o caminho inteiro') : '') +
      (p.libras ? acao('libras', 'i-libras', 'Abrir tradutor de Libras') : '') +
      acao('cartao', 'i-cartao', 'Mostrar cartão para o atendente') +
      acao('avisar', 'i-aviso', 'Avisar sobre um local', { desc: 'Interditado, danificado ou com obstáculo.' }) +
      acao('ajuda', 'i-ajuda', 'Pedir ajuda') +
      acao('preferencias', 'i-preferencias', 'Preferências', { desc: 'Voz, tamanho do texto, cores e rotas.' }) +
      `</div></div>`;
    h += htmlLugaresAndar(aberto);
    h += `<div class="faixa-aviso">${svg('i-aviso')}<p><b>Não use o Navi em emergências.</b> Siga a sinalização e as orientações da equipe ${esc(txt.doLocal || 'do local')}.</p></div>`;
    el.innerHTML = h;
  }
  function renderFolha() {
    renderCabeca(); renderAtual(); renderMedio(); renderExpandido();
    if (folha) folha.atualizar();
  }

  /* cliques do painel (delegados: o conteúdo é refeito a cada rota) */
  // a lista de lugares é preenchida antes de abrir (no clique no resumo) ou, se abrir de outro jeito, logo depois
  $('conteudo').addEventListener('toggle', ev => { if (ev.target.id === 'lugares-andar' && ev.target.open) preencherLugares(); }, true);
  $('conteudo').addEventListener('click', ev => {
    if (ev.target.closest('#lugares-andar > summary')) { preencherLugares(); return; }
    const passo = ev.target.closest('[data-passo]');
    if (passo) { irParaPasso(+passo.dataset.passo, { daLista: true }); return; }
    const lug = ev.target.closest('[data-lugar]');
    if (lug) { abrirCartaoLugar(local.lugar(lug.dataset.lugar), lug); return; }
    const b = ev.target.closest('[data-acao]');
    if (!b) return;
    const a = b.dataset.acao;
    if (a === 'alterar-destino') { voz.cancelar(); return; } // é um link
    if (a === 'inverter') inverter();
    else if (a === 'recalcular') recalcular({ anunciar: true, focar: true });
    else if (a === 'esconder-mapa') alternarMapa();
    else if (a === 'nomes') { st.nomes = !st.nomes; b.setAttribute('aria-pressed', String(st.nomes)); aplicarPreferenciasNoMapa(); voz.anunciar(st.nomes ? 'Mostrando todos os nomes no mapa.' : 'Nomes só ao aproximar.', { visual: false }); }
    else if (a === 'primeira-pessoa') abrirPrimeiraPessoa();
    else if (a === 'vista-cima' && mapa3d) { if (!folha.emPainel()) folha.definir('recolhido'); mapa3d.vistaDeCima(); }
    else if (a === 'ambos' && mapa3d) { alternarAmbos(); b.setAttribute('aria-pressed', String(!!mapa3d.emAmbos)); }
    else if (a === 'ouvir-tudo') voz.falar(st.rota.passos.map((q, i) => `Passo ${i + 1}. ${q.texto}`).join(' '), { forcar: true });
    else if (a === 'libras') voz.anunciar(window.NaviLibras.abrir());
    else if (a === 'cartao') ui.abrirCartao(b);
    else if (a === 'avisar') avisos.abrir(b);
    else if (a === 'ajuda') ui.abrirAjuda(b);
    else if (a === 'preferencias') ui.abrirPreferencias(b);
  });

  /* ---------- passos ---------- */
  function irParaPasso(i, opcoes = {}) {
    const r = st.rota;
    if (!r) return;
    const novo = Math.max(0, Math.min(r.passos.length - 1, i));
    if (novo === st.passo && !opcoes.daLista) return;
    st.passo = novo;
    const p = r.passos[novo];
    if (p.piso !== st.andar) mostrarAndar(p.piso, { anunciar: false, centralizar: false });
    mapa.focusStep(novo);
    atualizarPasso();
    if (opcoes.daLista && !folha.emPainel()) folha.definir('recolhido', { focar: $(novo === r.passos.length - 1 ? 'passo-ant' : 'passo-prox') });
    else folha.atualizar();
    voz.anunciar(textoPasso(novo));
  }
  function repetir() {
    if (!st.rota) return;
    voz.anunciar(textoPasso(st.passo));
    const placa = $('placa');
    placa.classList.remove('repetido'); void placa.offsetWidth; placa.classList.add('repetido');
  }

  /* ---------- trocar a rota aqui mesmo: "Ir para cá", Inverter, Recalcular ---------- */
  function anunciarRota(prefixo = 'Rota calculada') {
    if (!st.rota) { voz.anunciar(`${NE.preferencias().evitarEscadas ? 'Não encontramos caminho acessível confirmado' : 'Não encontramos um caminho entre esses dois pontos'}. ${motivoSemCaminho()}`); return; }
    voz.anunciar(`${prefixo}: ${st.rota.passos.length} passos. Passo 1: ${st.rota.passos[0].texto}`);
  }
  function aposMudarRota({ anunciar = true, focar = true, manterPainel = false, prefixo } = {}) {
    calcular();
    renderTopo(); renderFolha(); renderControles(); renderStatus();
    reapontarGatilhos();
    sincronizarMapa();
    if (!manterPainel) folha.definir(st.rota ? 'recolhido' : 'medio');
    else if (!st.rota && folha.estado === 'recolhido') folha.definir('medio');
    if (focar) $('titulo-rota').focus({ preventScroll: true });
    if (anunciar) anunciarRota(prefixo);
    requestAnimationFrame(atualizarMargens);
  }
  function guardarNaUrl() {
    st.mudouAqui = true;
    history.replaceState(null, '', NE.urlMapa({ local: slugUrl, origem: st.origem.id, destino: st.destino.id, perfil: params.perfil }));
  }
  function irPara(lugar) {
    if (!lugar || lugar.id === st.destino.id) return;
    if (lugar.id === st.origem.id) { inverter(); return; }
    voz.cancelar();
    st.destino = lugar;
    guardarNaUrl();
    aposMudarRota();
  }
  function inverter() {
    voz.cancelar();
    [st.origem, st.destino] = [st.destino, st.origem];
    guardarNaUrl();
    aposMudarRota({ prefixo: 'Partida e destino invertidos. Rota calculada' });
  }
  function recalcular(o = {}) {
    aposMudarRota({ anunciar: o.anunciar, focar: o.focar, manterPainel: !o.focar, prefixo: 'Rota recalculada' });
  }
  /** Diálogo aberto cujo botão de origem foi refeito: o foco volta para o botão equivalente. */
  function reapontarGatilhos() {
    document.querySelectorAll('dialog[open]').forEach(d => {
      const g = d._gatilho;
      if (g && document.contains(g)) return;
      const acao = g && g.dataset && g.dataset.acao;
      d._gatilho = (acao && document.querySelector(`[data-acao="${acao}"]`)) || $('titulo-rota');
    });
  }

  /* ---------- cartão do lugar tocado no mapa (RN10) ---------- */
  function abrirCartaoLugar(lugar, gatilho) {
    if (!lugar) return;
    const dlg = ui.criarDialogo('dlg-lugar', lugar.nome, 'Fechar');
    dlg.querySelector('h2').textContent = lugar.nome;
    const a = inter.de(lugar.id);
    let h = `<div class="cartao-lugar">${NC.tile(lugar, svg)}<p class="lugar-texto"><span class="lugar-desc">${esc(NC.descricao(lugar, local))}</span></p></div>`;
    if (a) h += `<div class="faixa-aviso">${svg('i-aviso')}<p><b>${esc(window.NaviInterdicoes.TIPOS[a.tipo].nome)}</b>${a.detalhe ? `: ${esc(a.detalhe)}` : ''}. ${a.oficial ? 'Confirmado pela equipe.' : 'Aviso feito neste aparelho.'}</p></div>`;
    if (lugar.id === st.destino.id) h += `<p class="nota-icone">${svg('i-ok')}<span>Este é o seu destino.</span></p>`;
    else if (lugar.id === st.origem.id) h += `<p class="nota-icone">${svg('i-voce')}<span>Este é o seu ponto de partida.</span></p>`;
    h += `<div class="pilha-curta">`;
    if (lugar.id !== st.destino.id && lugar.id !== st.origem.id) h += `<button type="button" class="btn btn-primario btn-largo" data-ir>${svg('i-lugar')}Ir para cá</button>`;
    h += `<button type="button" class="btn btn-largo" data-avisar-lugar>${svg('i-aviso')}Avisar sobre este local</button></div>`;
    const corpo = dlg.querySelector('.dialogo-corpo');
    corpo.innerHTML = h;
    const ir = corpo.querySelector('[data-ir]');
    if (ir) ir.onclick = () => { dlg._gatilho = $('titulo-rota'); dlg.close(); irPara(lugar); };
    corpo.querySelector('[data-avisar-lugar]').onclick = () => { dlg.close(); avisos.abrir(gatilho, lugar); };
    ui.abrirDialogo(dlg, gatilho && document.contains(gatilho) && gatilho.focus ? gatilho : $('titulo-rota'));
  }

  /* ---------- mapa ---------- */
  const slot = $('navi-map-slot');
  const temPlanta = !!(local.dados && local.dados.plantas && Object.keys(local.dados.plantas).length);
  const camada2d = document.createElement('div');
  camada2d.className = 'mapa-camada';
  slot.appendChild(camada2d);
  let camada3d = null, mapa3d = null, tem3D = false;
  const rotuloPlanta = piso => `Planta do ${nomeAndar(piso)} ${txt.doLocal || ''}`.trim();
  const mapa2d = temPlanta
    ? window.NaviMapa2D.criar({ local, G, rotulo: rotuloPlanta, ao: { selecionar: l => abrirCartaoLugar(l, mapa2d.elemento()) } })
    : window.NaviMapa.semPlanta({ local, esc });
  let mapa = mapa2d;

  function aplicarPreferenciasNoMapa() {
    const p = NE.preferencias();
    const reduzir = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    mapa.applyPreferences({ texto: p.texto, evitarEscadas: p.evitarEscadas, nomes: st.nomes, reduzirMovimento: reduzir });
  }
  function sincronizarMapa() {
    aplicarPreferenciasNoMapa();
    mapa.setAvisos(inter.todos());
    mapa.setFloor(andarIdDe(st.andar));
    mapa.showRoute(st.rota, { origem: st.origem, destino: st.destino });
    if (st.rota && st.passo > 0) mapa.focusStep(st.passo); else mapa.centralizar();
  }
  function mostrarAndar(piso, { anunciar = true, centralizar = true } = {}) {
    st.andar = piso;
    mapa.setFloor(andarIdDe(piso));
    if (centralizar) mapa.centralizar();
    renderControles(); renderStatus();
    const det = $('lugares-andar');
    if (det) det.outerHTML = htmlLugaresAndar(det.open);
    if (anunciar) voz.anunciar(`Mostrando o ${nomeAndar(piso)}.`, { visual: false });
    requestAnimationFrame(atualizarMargens);
  }
  const curto = a => { const m = (a.nome || '').match(/-?\d+/); return m ? m[0] : (a.nome || '?').trim().charAt(0).toUpperCase(); };
  function renderControles() {
    const c = $('mapa-controles');
    const cap = mapa.capabilities();
    const focoId = document.activeElement && c.contains(document.activeElement) ? (document.activeElement.id || 'andar-' + document.activeElement.dataset.andar) : null;
    let h = '';
    if (local.andares.length > 1 && temPlanta) {
      const naRota = new Set(st.rota ? st.rota.trechos.map(t => t.piso) : []);
      h += `<div class="ctl-grupo" role="group" aria-label="Escolher ${palavraAndar === 'pisos' ? 'piso' : 'andar'}">` + local.andares.slice().reverse().map(a =>
        `<button type="button" class="ctl ctl-andar" id="andar-${a.ordem}" data-andar="${a.ordem}" aria-pressed="${a.ordem === st.andar}" title="${esc(a.nome)}">` +
        `<span class="andar-curto" aria-hidden="true">${esc(curto(a))}</span><span class="sr">${esc(a.nome)}${naRota.has(a.ordem) ? ',' : ''}</span>` +
        (naRota.has(a.ordem) ? `<span class="andar-rota"><span class="sr">parte da </span>rota</span>` : '') + `</button>`).join('') + `</div>`;
    }
    if (cap.zoom) {
      h += `<button type="button" class="ctl" id="ctl-centralizar" title="Centralizar na rota">${svg('i-centralizar')}<span class="sr">Centralizar na rota</span></button>`;
      h += `<div class="ctl-grupo" role="group" aria-label="Aproximar e afastar">` +
        `<button type="button" class="ctl" id="ctl-mais" title="Aproximar">${svg('i-mais')}<span class="sr">Aproximar</span></button>` +
        `<button type="button" class="ctl" id="ctl-menos" title="Afastar">${svg('i-menos')}<span class="sr">Afastar</span></button></div>`;
    }
    if (tem3D) h += `<button type="button" class="ctl" id="ctl-3d" aria-pressed="${st.vista === '3d'}" title="Mapa 3D"><span aria-hidden="true">3D</span><span class="sr">Mapa 3D</span></button>`;
    c.innerHTML = h;
    if (focoId && $(focoId)) $(focoId).focus();
  }
  $('mapa-controles').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.andar) { const piso = +b.dataset.andar; if (piso !== st.andar) mostrarAndar(piso); else mapa.centralizar(); return; }
    if (b.id === 'ctl-centralizar') { mapa.centralizar(); voz.anunciar('Mapa centralizado na rota.', { visual: false, falar: false }); }
    if (b.id === 'ctl-mais') mapa.zoom(1 / 1.35);
    if (b.id === 'ctl-menos') mapa.zoom(1.35);
    if (b.id === 'ctl-3d') definirVista(st.vista === '3d' ? '2d' : '3d');
  });
  function renderStatus() {
    const el = $('mapa-status');
    if (!temPlanta) { el.hidden = true; return; }
    let det = '';
    if (st.rota && st.rota.trechos.length > 1) {
      const ts = st.rota.trechos, i = ts.findIndex(t => t.piso === st.andar);
      if (i < 0) det = 'Sua rota não passa por aqui.';
      else if (ts[i].saida) det = `Depois: ${nomeAndar(ts[i + 1].piso)}, ${por(ts[i])}.`;
      else det = `Você chega ${por(ts[i - 1])}.`;
    } else if (st.rota && !st.rota.trechos.some(t => t.piso === st.andar)) det = 'Sua rota não passa por aqui.';
    // o selo da rota demonstrativa (RN19) vai junto, em uma linha curta; o texto inteiro fica no painel
    const data = dataBR(cfg.dataPlanta);
    el.innerHTML = `<p class="mapa-status-andar"><b>${esc(nomeAndar(st.andar))}</b>${det ? `<span>${esc(det)}</span>` : ''}</p>` +
      `<p class="mapa-status-selo">${svg('i-info')}<span><b>Rota demonstrativa</b>${data ? `, planta de ${data}` : ''}<span class="sr">, não verificada no local</span></span></p>`;
    el.hidden = false;
  }

  /* ---------- 3D e primeira pessoa (carregados só quando pedidos, RN45) ---------- */
  function carregarScript(src) {
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error(src)); document.head.appendChild(s); });
  }
  function renderExtras3d() {
    const el = $('mapa-extras3d');
    if (st.vista !== '3d' || !mapa3d) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = (st.rota ? `<button type="button" class="btn" data-3d="fp">${svg('i-primeira-pessoa')}Ver em primeira pessoa</button>` : '') +
      `<button type="button" class="btn" data-3d="cima">${svg('i-plano')}Vista de cima</button>` +
      (local.andares.length > 1 ? `<button type="button" class="btn" data-3d="ambos" aria-pressed="${!!mapa3d.emAmbos}">${svg('i-andares')}Ver ${local.andares.length === 2 ? 'os dois' : 'todos os'} ${palavraAndar}</button>` : '');
  }
  $('mapa-extras3d').addEventListener('click', ev => {
    const b = ev.target.closest('[data-3d]');
    if (!b || !mapa3d) return;
    if (b.dataset['3d'] === 'fp') abrirPrimeiraPessoa();
    if (b.dataset['3d'] === 'cima') mapa3d.vistaDeCima();
    if (b.dataset['3d'] === 'ambos') { alternarAmbos(); b.setAttribute('aria-pressed', String(!!mapa3d.emAmbos)); }
  });
  function alternarAmbos() {
    const on = !mapa3d.emAmbos;
    mapa3d.ambos(on);
    voz.anunciar(on ? `Mostrando ${local.andares.length === 2 ? 'os dois' : 'todos os'} ${palavraAndar}, um sobre o outro.` : `Mostrando só o ${nomeAndar(st.andar)}.`, { visual: false });
  }
  async function definirVista(v, opcoes = {}) {
    if (v === st.vista) return true;
    if (v === '3d') {
      const pode = window.NaviMapa.pode3D();
      if (!pode.ok) { voz.anunciar(pode.motivo); return false; }
      if (!mapa3d) {
        const b = $('ctl-3d');
        if (b) b.setAttribute('aria-busy', 'true');
        try {
          if (!window.NaviMapa3DRenderer) await carregarScript('js/mapa3d-renderer.js');
          camada3d = document.createElement('div');
          camada3d.className = 'mapa-camada';
          slot.appendChild(camada3d);
          const r = window.NaviMapa3DRenderer.criar({
            local, G, nomeAndar,
            ao: {
              selecionar: l => abrirCartaoLugar(l, $('ctl-3d')),
              anunciar: msg => voz.anunciar(msg),
              saiuPrimeiraPessoa: saiuPrimeiraPessoa
            }
          });
          await r.mount(camada3d);
          mapa3d = r;
        } catch (e) {
          if (camada3d) camada3d.remove();
          camada3d = null; mapa3d = null;
          const b2 = $('ctl-3d'); if (b2) b2.removeAttribute('aria-busy');
          voz.anunciar('O mapa 3D não funciona neste navegador ou aparelho. Continuamos no mapa 2D.');
          return false;
        }
      }
      camada2d.hidden = true; camada3d.hidden = false;
      mapa = mapa3d;
    } else {
      if (mapa3d && mapa3d.emPrimeiraPessoa) mapa3d.sairPrimeiraPessoa();
      if (camada3d) camada3d.hidden = true;
      if (mapa3d) mapa3d.pausar();
      camada2d.hidden = false;
      mapa = mapa2d;
    }
    st.vista = v;
    NE.guardar('vista', v);
    sincronizarMapa();
    if (mapa3d && v === '3d') mapa3d.continuar();
    renderControles(); renderExtras3d(); renderExpandido();
    requestAnimationFrame(atualizarMargens);
    if (!opcoes.silencioso) voz.anunciar(v === '3d' ? 'Mapa em 3D. As mesmas informações continuam no passo a passo.' : 'Mapa em 2D.', { visual: false });
    return true;
  }
  async function abrirPrimeiraPessoa() {
    if (!st.rota) { voz.anunciar('Escolha a partida e o destino para ver o caminho em primeira pessoa.'); return; }
    if (st.semMapa) alternarMapa();
    if (st.vista !== '3d' && !(await definirVista('3d', { silencioso: true }))) return;
    if (!folha.emPainel()) folha.definir('recolhido');
    document.body.classList.add('em-primeira-pessoa');
    for (const id of ['mapa-topo', 'mapa-controles', 'mapa-info']) $(id).inert = true;
    if (!folha.emPainel()) $('conteudo').inert = true;
    mapa3d.primeiraPessoa(st.passo);
    voz.anunciar('Primeira pessoa. Arraste para olhar em volta e toque em Avançar para andar pela rota.', { falar: false });
  }
  function saiuPrimeiraPessoa() {
    document.body.classList.remove('em-primeira-pessoa');
    for (const id of ['mapa-topo', 'mapa-controles', 'mapa-info', 'conteudo']) $(id).inert = false;
    const b = document.querySelector('#mapa-extras3d [data-3d="fp"]') || $('ctl-3d');
    if (b) b.focus();
    requestAnimationFrame(() => { folha.atualizar(); atualizarMargens(); });
  }

  /* ---------- "Esconder mapa": passo a passo em tela cheia ---------- */
  let mapaPedido = false, mapaEscondidoSozinho = false;
  function semEspaco() {
    if (st.semMapa || mapaPedido || document.body.classList.contains('em-primeira-pessoa')) return;
    mapaEscondidoSozinho = true;
    alternarMapa({ silencioso: true });
  }
  function alternarMapa(o = {}) {
    if (st.semMapa && !o.silencioso) mapaPedido = true;
    st.semMapa = !st.semMapa;
    if (!st.semMapa) mapaEscondidoSozinho = false;
    document.body.classList.toggle('sem-mapa', st.semMapa);
    $('mapa-area').inert = st.semMapa;
    folha.atualizar();
    const ativo = document.activeElement;
    const tinhaFoco = !!(ativo && ativo.dataset && ativo.dataset.acao === 'esconder-mapa');
    const noAviso = !!(ativo && ativo.closest && ativo.closest('#aviso-sem-mapa'));
    renderExpandido();
    renderAvisoSemMapa();
    if (noAviso) $('titulo-rota').focus({ preventScroll: true });
    else if (tinhaFoco) { const novo = $('folha-expandido').querySelector('[data-acao="esconder-mapa"]'); if (novo) novo.focus(); }
    if (!o.silencioso) voz.anunciar(st.semMapa ? 'Mapa escondido. O passo a passo ocupa a tela inteira.' : 'Mapa visível de novo.', { visual: false });
    requestAnimationFrame(() => { medirLayout(); });
  }
  function renderAvisoSemMapa() {
    let el = $('aviso-sem-mapa');
    if (!mapaEscondidoSozinho || !st.semMapa) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'aviso-sem-mapa'; el.className = 'faixa-info aviso-sem-mapa';
      $('folha-atual').before(el);
    }
    el.innerHTML = `${svg('i-info')}<p>Com o texto deste tamanho, o mapa não cabe na tela. O passo a passo continua aqui.</p>` +
      `<button type="button" class="btn" data-acao="esconder-mapa">${svg('i-plano')}Mostrar mapa</button>`;
  }

  /* ---------- painel inferior (bottom sheet) e medidas do layout ---------- */
  const app = $('app');
  let folha = null;
  function atualizarMargens() {
    if (!mapa || st.semMapa) return;
    const area = $('mapa-area').getBoundingClientRect();
    if (!area.width) return;
    const emPainel = folha.emPainel();
    const sobreposicoes = emPainel || folha.estado === 'recolhido'; // no médio e no expandido os controles somem
    const ret = el => (sobreposicoes && el && !el.hidden && el.offsetParent !== null ? el.getBoundingClientRect() : null);
    let topo = emPainel ? 0 : Math.max(0, $('mapa-topo').getBoundingClientRect().bottom - area.top);
    const status = ret($('mapa-status'));
    if (status) topo = Math.max(topo, status.bottom - area.top);
    const ctl = ret($('mapa-controles'));
    const direita = ctl && ctl.width ? Math.max(0, area.right - ctl.left) : 0;
    let base = emPainel ? 0 : Math.max(0, area.bottom - $('conteudo').getBoundingClientRect().top);
    mapa.setMargens({ topo: topo + 12, direita: direita + 8, base: base + 12, esquerda: 12 });
  }
  /** Onde o topo flutuante termina (o painel e os controles começam abaixo dele). */
  function medirTopo() {
    if (folha && folha.emPainel()) return;
    const v = Math.ceil($('mapa-topo').getBoundingClientRect().bottom) + 'px';
    if (app.style.getPropertyValue('--topo-medido') !== v) app.style.setProperty('--topo-medido', v);
  }
  function medirLayout() {
    medirTopo();
    if (folha) folha.atualizar();
    atualizarMargens();
  }
  // só escreve o que mudou (cada escrita à toa faz o navegador refazer o estilo da página inteira)
  const definirInert = (el, v) => { if (el.inert !== v) el.inert = v; };

  /* ---------- montagem ---------- */
  // o contorno do piso (dados3d.js, já pedido no <head>) vem antes do primeiro desenho: a planta sai
  // pronta de uma vez e o botão 3D e "Ver em primeira pessoa" aparecem desde o início
  if (temPlanta) {
    const lajes = await NL.carregarLajes(local).catch(() => null); // sem ele, o 2D usa a caixa do andar
    tem3D = !!(lajes && Object.keys(lajes).length);
  }
  calcular();
  // pausa curta entre calcular e desenhar: o celular continua respondendo ao toque enquanto a página abre
  await (window.scheduler && scheduler.yield ? scheduler.yield() : new Promise(r => setTimeout(r, 0)));
  renderTopo();
  // no celular em pé, a parte expandida do painel começa fora da tela: entra logo depois da primeira
  // pintura, para o passo atual aparecer antes (no painel fixo, tudo aparece de uma vez)
  const expandidoDepois = !(matchMedia('(min-width: 768px), (orientation: landscape)').matches || document.body.classList.contains('sem-mapa'));
  renderCabeca(); renderAtual(); renderMedio();
  if (!expandidoDepois) renderExpandido();
  // os controles e o andar visível entram antes de medir; o painel se mede já sabendo onde o topo termina
  renderControles(); renderStatus();
  medirTopo();
  folha = window.NaviFolha.criar({
    folha: $('conteudo'), cabeca: $('folha-cabeca'), alca: $('folha-alca'), corpo: $('folha-corpo'),
    mais: $('folha-mais'), medio: $('folha-medio'), expandido: $('folha-expandido'),
    aoSemEspaco: () => requestAnimationFrame(semEspaco),
    aoMudar: (estado, visivel) => {
      if (app.dataset.folha !== estado) app.dataset.folha = estado;
      const medida = Math.round(visivel) + 'px';
      if (app.style.getPropertyValue('--folha-medida') !== medida) app.style.setProperty('--folha-medida', medida);
      // com o painel expandido, os controles do mapa ficam atrás dele: fora do alcance do foco (WCAG 2.4.11)
      const fora = estado === 'expandido' || estado === 'medio' || document.body.classList.contains('em-primeira-pessoa');
      definirInert($('mapa-controles'), fora);
      definirInert($('mapa-info'), fora);
      requestAnimationFrame(atualizarMargens);
    }
  });
  if (!st.rota) folha.definir('medio');

  // foco no título e um anúncio só (RN35); com a voz ligada, o passo 1 é falado (RN26, RN28)
  $('titulo-rota').focus({ preventScroll: true });
  anunciarRota();

  // o mapa vem depois do texto: o navegador mostra o passo a passo antes de montar a planta, que é a
  // parte mais pesada da abertura em celular simples
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  if (expandidoDepois) renderExpandido();
  atualizarMargens(); // o espaço livre do mapa (sem o topo, os controles e o painel)
  // antes do mount, o mapa só guarda o estado; o mount desenha tudo uma vez, já enquadrado na rota
  aplicarPreferenciasNoMapa();
  mapa.setAvisos(inter.todos());
  mapa.setFloor(andarIdDe(st.andar));
  mapa.showRoute(st.rota, { origem: st.origem, destino: st.destino });
  try {
    await mapa2d.mount(camada2d);
  } catch (e) { /* o passo a passo continua funcionando sem o mapa */ }
  if (st.rota && st.passo > 0) mapa.focusStep(st.passo); // a pessoa pode ter avançado enquanto o mapa montava
  requestAnimationFrame(() => { medirLayout(); });
  if (tem3D && NE.ler('vista') === '3d') definirVista('3d', { silencioso: true });

  new ResizeObserver(() => requestAnimationFrame(medirLayout)).observe($('mapa-topo'));
  window.addEventListener('resize', () => requestAnimationFrame(medirLayout));

  /* ---------- tela acesa durante a rota, rede e versão nova ---------- */
  let trava = null;
  async function manterTelaAcesa() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && !trava) { trava = await navigator.wakeLock.request('screen'); trava.addEventListener('release', () => { trava = null; }); } }
    catch (e) { /* o navegador não deixou: a tela segue o tempo normal */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.rota) manterTelaAcesa(); });
  if (st.rota) manterTelaAcesa();

  const rede = document.createElement('div');
  rede.className = 'folha-rede';
  $('folha-cabeca').appendChild(rede);
  window.NaviPWA.indicadorRede(rede, 'Sem internet. A rota e o passo a passo continuam funcionando.');
  window.NaviPWA.iniciar({ oferecerAtualizacao: false });

  window.NaviMapaPagina = { st, local, G, irParaPasso, definirVista, folha: () => folha, mapa: () => mapa };
})();
