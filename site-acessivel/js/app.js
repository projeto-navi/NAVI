/* Navi — interface: perfis, painel, mapa SVG, voz e Libras. */
(function () {
  'use strict';
  const D = window.NAVI_DADOS, R = window.NaviRotas;
  const G = R.criarGrafo(D);
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const ler = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  const PERFIS = {
    visual: { nome: 'Deficiência visual', icone: 'i-visual' },
    mobilidade: { nome: 'Mobilidade reduzida', icone: 'i-mobilidade' },
    auditiva: { nome: 'Deficiência auditiva', icone: 'i-auditiva' },
    geral: { nome: 'Sem adaptações', icone: 'i-visual' }
  };
  const CAT = {
    loja: 'Loja', quiosque: 'Quiosque', entrada: 'Entrada', sanitario: 'Sanitários', elevador: 'Elevador',
    escada: 'Escada rolante', informacao: 'Informações', estacionamento: 'Pagamento do estacionamento',
    caixa: 'Caixas eletrônicos', saida: 'Saída', emergencia: 'Saída de emergência', familia: 'Espaço Família',
    museu: 'Museu', administracao: 'Administração'
  };
  const COR_ENTRADA = { vermelho: '#E5484D', azul: '#3B82C4', verde: '#2FA866' };
  const entradas = D.places.filter(p => p.cat === 'entrada');

  const E = {
    perfil: null, origem: null, destino: null, rota: null, piso: 1,
    tela: 'plano', slot: 'destino', filtro: 'todos', termo: '', passo: 0, avisoLugar: null, avisoTipo: 'interditado', avisoTexto: '', avisoEnviado: null,
    voz: false, nomes: false, pendente: null
  };
  const CONFIG = window.NAVI_CONFIG || {};
  // Celular (até 860 px): fluxo mais curto e rota em destaque. No desktop nada muda.
  const MOBILE = window.matchMedia('(max-width: 860px)');
  const ehMobile = () => MOBILE.matches;
  const ATALHOS = [['sanitario', 'Sanitário mais próximo'], ['informacao', 'SAC / informações'], ['saida', 'Saída mais próxima'],
    ['elevador', 'Elevador'], ['caixa', 'Caixa eletrônico'], ['familia', 'Espaço Família']];
  /* ---------- avisos de interdição / dano ----------
     Oficiais: js/avisos.js (confirmados, valem para todos). Locais: feitos neste aparelho (localStorage). */
  const TIPOS_AVISO = {
    interditado: { nome: 'Interditado', desc: 'Fechado ou com a passagem bloqueada' },
    danificado: { nome: 'Danificado', desc: 'Quebrado ou com defeito, como elevador parado ou piso solto' },
    obstaculo: { nome: 'Obstáculo no caminho', desc: 'Obra, materiais, mesas ou algo atrapalhando a passagem' }
  };
  function avisosLocais() { try { return JSON.parse(ler('navi-avisos') || '[]'); } catch (e) { return []; } }
  let avisosMemoria = null; // se o navegador não deixar salvar, os avisos ficam só nesta visita
  function salvarAvisosLocais(lista) { avisosMemoria = lista; try { localStorage.setItem('navi-avisos', JSON.stringify(lista)); } catch (e) {} }
  function todosAvisos() {
    const oficiais = (window.NAVI_AVISOS || []).filter(a => G.lugarPorId[a.lugar]).map(a => ({ ...a, oficial: true }));
    const locais = (avisosMemoria || avisosLocais()).filter(a => G.lugarPorId[a.lugar]);
    return oficiais.concat(locais);
  }
  const avisoDe = id => todosAvisos().find(a => a.lugar === id);
  function bloqueados() {
    const s = new Set();
    for (const a of todosAvisos()) {
      const l = G.lugarPorId[a.lugar];
      if (a.tipo === 'interditado' || (a.tipo === 'danificado' && ['elevador', 'escada'].includes(l.cat))) {
        s.add(a.lugar);
        // elevador: as duas portas (Piso 1 e Piso 2) são o mesmo equipamento
        if (l.cat === 'elevador') G.places.filter(p => p.cat === 'elevador').forEach(p => s.add(p.id));
      }
    }
    return s;
  }
  const opcoesRota = () => ({ semEscadas: E.perfil === 'mobilidade', bloqueados: bloqueados() });
  Object.defineProperty(E, 'avisos', { get: todosAvisos }); // a vista 3D lê os avisos daqui

  function ladoDe(p) {
    const e = entradas.reduce((a, b) => Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b);
    return 'lado do ' + e.nome;
  }
  function descricao(p) {
    const partes = ['Piso ' + p.piso];
    if (p.cat !== 'loja') partes.push(CAT[p.cat].toLowerCase());
    if (p.cat !== 'entrada') partes.push(ladoDe(p));
    if (p.estimado) partes.push('posição estimada');
    return partes.join(', ');
  }

  /* ---------------- voz ---------------- */
  const temVoz = 'speechSynthesis' in window;
  let ultimaFala = '', falaImportante = false;
  // Escolha feita no pop-up de abertura: 'sim' liga a voz em todo o site; 'nao' mantém desligada.
  let vozEscolha = null;
  function falar(texto, forcar, opcoes = {}) {
    if (!temVoz || (!E.voz && !forcar)) return;
    // leituras de foco não interrompem uma orientação que ainda está sendo falada
    if (opcoes.baixa && falaImportante && speechSynthesis.speaking) return;
    ultimaFala = texto;
    falaImportante = !opcoes.baixa;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    const v = speechSynthesis.getVoices().find(v => /pt[-_]BR/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^pt/i.test(v.lang));
    if (v) u.voice = v;
    u.rate = E.perfil === 'visual' ? 0.95 : 1;
    speechSynthesis.speak(u);
  }
  function anunciar(msg, opcoes = {}) {
    const a = $('anuncio'); a.textContent = ''; setTimeout(() => { a.textContent = msg; }, 30);
    if (opcoes.falar !== false) falar(msg);
    if (E.perfil === 'auditiva' && opcoes.visual !== false) avisoVisual(msg);
  }
  let timerAviso;
  function avisoVisual(msg) {
    const el = $('aviso-visual'); el.textContent = msg; el.hidden = false;
    if (navigator.vibrate) { try { navigator.vibrate([120, 60, 120]); } catch (e) {} }
    clearTimeout(timerAviso); timerAviso = setTimeout(() => { el.hidden = true; }, 4200);
  }

  /* ---------------- Libras (VLibras, serviço oficial do Governo Federal) ---------------- */
  let vlibrasEstado = 'nao';
  function carregarVLibras() {
    if (vlibrasEstado !== 'nao') return;
    vlibrasEstado = 'carregando';
    $('vlibras').hidden = false;
    const s = document.createElement('script');
    s.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    s.onload = () => {
      try { new window.VLibras.Widget('https://vlibras.gov.br/app'); vlibrasEstado = 'ok';
        // o widget se inicializa no evento load; se a página já carregou, dispara de novo
        if (document.readyState === 'complete') window.dispatchEvent(new Event('load'));
      } catch (e) { vlibrasEstado = 'erro'; }
    };
    s.onerror = () => { vlibrasEstado = 'erro'; };
    document.body.appendChild(s);
  }
  function abrirLibras() {
    const b = document.querySelector('[vw-access-button]');
    if (vlibrasEstado === 'ok' && b) { b.click(); avisoVisual('Tradutor de Libras aberto. Toque em qualquer texto para ver a tradução.'); return; }
    if (vlibrasEstado === 'carregando') { avisoVisual('O tradutor de Libras está carregando. Tente de novo em alguns segundos.'); return; }
    avisoVisual('Não foi possível carregar o tradutor de Libras. Verifique a conexão com a internet.');
    vlibrasEstado = 'nao'; carregarVLibras();
  }

  /* ---------------- perfil ---------------- */
  function definirPerfil(p, opcoes = {}) {
    E.perfil = p;
    guardar('navi-perfil', p);
    document.body.dataset.perfil = p;
    const contraste = p === 'visual' ? true : ler('navi-contraste') === '1';
    aplicarContraste(contraste);
    E.voz = vozEscolha === 'sim' || (vozEscolha !== 'nao' && p === 'visual' && ler('navi-voz') !== '0');
    $('btn-libras').hidden = p !== 'auditiva';
    if (p === 'auditiva') carregarVLibras();
    const bp = $('btn-perfil'); bp.hidden = false;
    bp.querySelector('use').setAttribute('href', '#' + PERFIS[p].icone);
    bp.querySelector('span').textContent = 'Trocar perfil';
    bp.setAttribute('aria-label', 'Perfil atual: ' + PERFIS[p].nome + '. Trocar perfil');
    $('tela-inicio').hidden = true; $('tela-mapa').hidden = false;
    E.tela = 'plano';
    if (E.origem && E.destino) calcular(false);
    desenharPiso(); ajustar(); renderPainel();
    if (ler('navi-vista') === '3d' && vista !== '3d') definirVista('3d', { silencioso: true });
    const aviso = { visual: 'Modo para deficiência visual ativado. Botões grandes, alto contraste e voz ligada.',
      mobilidade: 'Modo mobilidade reduzida ativado. As rotas evitam escadas e usam o elevador.',
      auditiva: 'Modo deficiência auditiva ativado. Use o botão Libras no topo para abrir o tradutor.',
      geral: 'Mapa sem adaptações.' }[p];
    // Perfil visual (e qualquer perfil no celular): já abre a busca do destino
    if ((p === 'visual' || ehMobile()) && !opcoes.silencioso && !E.destino) {
      anunciar(aviso, { falar: false });
      abrirEscolha('destino', p === 'visual' ? 'Modo para deficiência visual ativado. ' : aviso + ' ');
      return;
    }
    if (!opcoes.silencioso) anunciar(aviso);
    $('painel').querySelector('h2')?.focus();
  }
  function voltarInicio() {
    $('tela-mapa').hidden = true; $('tela-inicio').hidden = false;
    $('btn-perfil').hidden = true; $('btn-libras').hidden = true;
    if (temVoz) speechSynthesis.cancel();
    document.querySelector('.perfil')?.focus();
  }
  function aplicarContraste(on) {
    document.documentElement.classList.toggle('contraste', on);
    $('btn-contraste').setAttribute('aria-pressed', on);
    medirTopo();
  }

  /* ---------------- painel ---------------- */
  const icoLugar = p => {
    if (p.cat === 'loja' || p.cat === 'quiosque') return `<span class="ico loja" aria-hidden="true">${esc(p.nome.charAt(0))}</span>`;
    if (p.cat === 'entrada') {
      const cor = COR_ENTRADA[R.semAcento(p.nome).split(' ')[1]] || '#12233F';
      return `<span class="ico" style="background:${cor}" aria-hidden="true"><svg><use href="#p-entrada"/></svg></span>`;
    }
    return `<span class="ico" aria-hidden="true"><svg><use href="#p-${p.cat}"/></svg></span>`;
  };
  const SETAS = { inicio: 'd-inicio', reto: 'd-reto', esq: 'd-esq', dir: 'd-dir', 'leve-esq': 'd-leve-esq', 'leve-dir': 'd-leve-dir',
    volta: 'd-volta', chegada: 'd-chegada', elevador: 'p-elevador', escada: 'p-escada' };

  function seloPerfil() {
    const p = PERFIS[E.perfil];
    return `<span class="selo-perfil"><svg aria-hidden="true"><use href="#${p.icone}"/></svg>${esc(p.nome)}</span>`;
  }

  function renderPainel() {
    const el = $('painel');
    document.body.dataset.tela = E.tela;
    el.classList.remove('buscando');
    el.innerHTML = E.tela === 'escolher' ? htmlEscolher() : E.tela === 'avisar' ? htmlAvisar() : htmlPlano();
    ligarPainel();
  }

  function htmlPlano() {
    const apoio = {
      visual: 'Escolha onde você está e para onde vai. As instruções são lidas em voz alta, uma de cada vez.',
      mobilidade: 'Suas rotas não passam por escadas. Para trocar de piso, usamos o elevador.',
      auditiva: 'Todas as orientações aparecem por escrito. Toque em Libras, no topo, para ver a tradução.',
      geral: 'Escolha onde você está e para onde vai.'
    }[E.perfil];
    const campo = (slot, rot, lugar) => `
      <button type="button" class="campo" data-abrir="${slot}" aria-label="${rot}: ${lugar ? esc(lugar.nome) + ', ' + esc(descricao(lugar)) : 'não escolhido'}. Alterar">
        <small><span class="campo-ponto ponto-${slot}" aria-hidden="true"></span>${rot}</small>
        ${lugar ? `<b>${esc(lugar.nome)}</b><small>${esc(descricao(lugar))}</small>` : `<b class="vazio">Escolher</b>`}
      </button>`;
    let h = `${seloPerfil()}
      <h2 tabindex="-1">Para onde você quer ir?</h2>
      <p class="apoio">${apoio}</p>
      <div class="campo-linha"><div>
        ${campo('origem', 'Onde você está', E.origem)}
        ${campo('destino', 'Para onde vai', E.destino)}
      </div>
      <button type="button" class="btn-trocar" id="trocar" aria-label="Inverter origem e destino" title="Inverter origem e destino"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`;

    if (ehMobile() && E.rota) return htmlPlanoMobile();
    if (E.perfil === 'visual' && E.rota) {
      h += htmlRota();
      if (temVoz) h += `<div class="linha-btns"><button type="button" class="btn" id="alternar-voz" aria-pressed="${E.voz}">${E.voz ? 'Voz do site: ligada' : 'Voz do site: desligada'}</button></div>`;
      return h;
    }
    if (!E.origem) {
      h += `<p class="atalhos-titulo">Entrou por qual acesso?</p><div class="atalhos">` +
        entradas.map(e => `<button type="button" class="chip" data-origem="${e.id}"><svg aria-hidden="true" style="color:${COR_ENTRADA[R.semAcento(e.nome).split(' ')[1]]}"><use href="#p-entrada"/></svg>${esc(e.nome)}</button>`).join('') +
        `<button type="button" class="chip" data-abrir="origem">Outro lugar</button></div>`;
    } else {
      h += `<p class="atalhos-titulo">Ir direto para</p><div class="atalhos">` +
        ATALHOS.map(([c, t]) => `<button type="button" class="chip" data-proximo="${c}"><svg aria-hidden="true"><use href="#p-${c}"/></svg>${t}</button>`).join('') + `</div>`;
    }
    if (E.perfil === 'auditiva') {
      h += `<div class="linha-btns"><button type="button" class="btn btn-sinal" id="abrir-libras"><svg aria-hidden="true"><use href="#i-maos"/></svg>Abrir tradutor de Libras</button>
        <button type="button" class="btn" id="abrir-cartao">Mostrar cartão para atendente</button></div>`;
    }
    if ((E.perfil === 'visual' || E.voz) && E.perfil !== 'auditiva' && temVoz) {
      h += `<div class="linha-btns"><button type="button" class="btn" id="alternar-voz" aria-pressed="${E.voz}">${E.voz ? 'Voz do site: ligada' : 'Voz do site: desligada'}</button></div>`;
    }
    h += htmlRota();
    if (!E.rota) {
      h += `<p class="nota">Dica: você também pode tocar em uma loja no mapa. ${E.origem ? 'Ela vira o seu destino.' : 'Ela vira o ponto de partida.'}</p>`;
    }
    h += `<div class="linha-btns"><button type="button" class="btn-texto" id="mostrar-nomes" aria-pressed="${E.nomes}">${E.nomes ? 'Ocultar nomes no mapa' : 'Mostrar todos os nomes no mapa'}</button></div>`;
    const nAv = todosAvisos().length;
    h += `<div class="caixa-aviso"><p><b>Algo interditado ou danificado?</b> Avise o shopping e a equipe do mapa.${nAv ? ` Há ${nAv} ${nAv === 1 ? 'aviso ativo' : 'avisos ativos'} no mapa.` : ''}</p>
      <button type="button" class="btn" id="abrir-aviso"><svg aria-hidden="true" style="color:var(--alerta)"><use href="#p-aviso"/></svg>Avisar sobre um local</button></div>`;
    return h;
  }

  const SVG_TROCAR = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // Celular com rota: trajeto em uma linha, depois o passo atual; o resto fica abaixo
  function htmlPlanoMobile() {
    const ponto = (slot, rot, l) => `<button type="button" class="m-ponto" data-abrir="${slot}" aria-label="${rot === 'De' ? 'Partida' : 'Destino'}: ${esc(l.nome)}, ${esc(descricao(l))}. Alterar">
        <span class="campo-ponto ponto-${slot}" aria-hidden="true"></span><small aria-hidden="true">${rot}</small><b>${esc(l.nome)}</b></button>`;
    let h = `<div class="m-trajeto"><div class="m-pontos">${ponto('origem', 'De', E.origem)}${ponto('destino', 'Para', E.destino)}</div>
      <button type="button" class="btn-trocar" id="trocar" aria-label="Inverter origem e destino" title="Inverter origem e destino">${SVG_TROCAR}</button></div>`;
    h += htmlRota();
    let x = '';
    if (E.perfil === 'auditiva') x += `<button type="button" class="btn btn-sinal btn-largo" id="abrir-libras"><svg aria-hidden="true"><use href="#i-maos"/></svg>Abrir tradutor de Libras</button>
      <button type="button" class="btn btn-largo" id="abrir-cartao">Mostrar cartão para atendente</button>`;
    if ((E.perfil === 'visual' || E.voz) && E.perfil !== 'auditiva' && temVoz) x += `<button type="button" class="btn btn-largo" id="alternar-voz" aria-pressed="${E.voz}">${E.voz ? 'Voz do site: ligada' : 'Voz do site: desligada'}</button>`;
    x += `<button type="button" class="btn btn-largo" id="abrir-aviso"><svg aria-hidden="true" style="color:var(--alerta)"><use href="#p-aviso"/></svg>Avisar sobre um local</button>`;
    return h + `<div class="m-extras">${x}</div>`;
  }

  function htmlRota() {
    if (E.origem && E.destino && !E.rota) {
      const elevBloq = G.places.some(p => p.cat === 'elevador' && bloqueados().has(p.id));
      const motivo = E.perfil === 'mobilidade' && elevBloq && E.origem.piso !== E.destino.piso ? ' O elevador está com aviso de interdição ou defeito, e a rota sem escadas depende dele.' : '';
      return `<div class="rota"><p class="nota nota-alerta">Não encontramos um caminho entre esses dois pontos${E.perfil === 'mobilidade' ? ' sem escadas' : ''}.${motivo} Procure o SAC, no Piso 1, ou ligue ${esc(CONFIG.telefoneShopping || '')}.</p></div>`;
    }
    if (!E.rota) return '';
    const r = E.rota, pisos = [...new Set(r.trechos.map(t => t.piso))];
    const cartaoAntes = ehMobile();
    let h = `<section class="rota" aria-labelledby="titulo-rota"><h2 id="titulo-rota" tabindex="-1">Seu caminho</h2>`;
    if (cartaoAntes) h += htmlPassoAtual(r);
    h += `<div class="rota-resumo">`;
    h += `<span class="etiqueta">${r.passos.length} passos</span>`;
    h += `<span class="etiqueta">${pisos.length > 1 ? 'Piso ' + pisos.join(' para Piso ') : 'Tudo no Piso ' + pisos[0]}</span>`;
    if (E.perfil === 'mobilidade' || !r.usaEscada) h += `<span class="etiqueta ok"><svg aria-hidden="true"><use href="#i-mobilidade"/></svg>Sem escadas</span>`;
    if (r.usaElevador) h += `<span class="etiqueta"><svg aria-hidden="true"><use href="#p-elevador"/></svg>Usa elevador</span>`;
    if (r.usaEscada) h += `<span class="etiqueta"><svg aria-hidden="true"><use href="#p-escada"/></svg>Usa escada rolante</span>`;
    h += `</div>`;
    for (const [lugar, papel] of [[r.destino, 'O destino'], [r.origem, 'O ponto de partida']]) {
      const a = avisoDe(lugar.id);
      if (a) h += `<p class="nota nota-aviso"><svg aria-hidden="true"><use href="#p-aviso"/></svg><span>${papel}, ${esc(lugar.nome)}, tem aviso: <b>${TIPOS_AVISO[a.tipo].nome.toLowerCase()}</b>${a.detalhe ? ` (${esc(a.detalhe)})` : ''}. ${a.oficial ? 'Confirmado pela equipe.' : 'Aviso feito neste aparelho, ainda não confirmado.'}</span></p>`;
    }
    const desvios = [...bloqueados()].map(id => G.lugarPorId[id]).filter(l => l && ['elevador', 'escada'].includes(l.cat));
    if (desvios.length) h += `<p class="nota">Esta rota evita ${[...new Set(desvios.map(l => l.cat === 'elevador' ? 'o elevador' : 'uma escada rolante'))].join(' e ')} com aviso de interdição ou defeito.</p>`;

    if (E.perfil === 'visual' || ehMobile()) {
      if (!cartaoAntes) h += htmlPassoAtual(r);
      h += `${temVoz && E.perfil !== 'auditiva' ? `<div class="linha-btns"><button type="button" class="btn btn-largo" id="repetir">Ouvir de novo</button>
        <button type="button" class="btn btn-largo" id="ouvir-tudo">Ouvir o caminho inteiro</button></div>` : ''}
        <details><summary class="btn-texto">Ver todos os passos</summary>${listaPassos(r)}</details>`;
    } else {
      h += listaPassos(r);
      if (E.perfil !== 'auditiva' && temVoz) h += `<div class="linha-btns"><button type="button" class="btn" id="ouvir-tudo">Ouvir instruções</button></div>`;
    }
    if (r.usaElevador) h += `<p class="nota">A posição do elevador no Piso 1 foi estimada a partir da planta do Piso 2. Confirme com o SAC se o elevador está funcionando.</p>`;
    h += `<p class="nota">As distâncias são aproximadas e usam lojas próximas como referência.</p>`;
    if (E.perfil !== 'visual') h += `<div class="linha-btns"><button type="button" class="btn btn-principal" id="ver-primeira-pessoa"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.6" fill="currentColor"/><path d="M12 9v6M8 21l4-6 4 6M7 12h10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>Ver em primeira pessoa</button></div>`;
    h += `<div class="linha-btns"><button type="button" class="btn" id="nova-rota">Nova rota</button></div></section>`;
    return h;
  }

  function htmlPassoAtual(r) {
    const p = r.passos[E.passo];
    return `<div class="passo-atual" aria-live="polite">
          <svg class="seta-grande" aria-hidden="true"><use href="#${SETAS[p.tipo]}"/></svg>
          <div class="n">Passo ${E.passo + 1} de ${r.passos.length}, Piso ${p.piso}</div>
          <p class="t">${esc(p.texto)}</p></div>
        <div class="nav-passos">
          <button type="button" class="btn" id="passo-ant" ${E.passo === 0 ? 'disabled' : ''}>Passo anterior</button>
          <button type="button" class="btn btn-principal" id="passo-prox" ${E.passo === r.passos.length - 1 ? 'disabled' : ''}>Próximo passo</button>
        </div>`;
  }

  function listaPassos(r) {
    return `<ol class="passos">` + r.passos.map((p, i) => `
      <li class="passo ${p.tipo === 'elevador' || p.tipo === 'escada' ? 'conexao' : ''} ${p.tipo === 'chegada' ? 'chegada' : ''}" ${i === E.passo ? 'aria-current="step"' : ''}>
        <button type="button" data-passo="${i}">
          <span class="seta" aria-hidden="true"><svg><use href="#${SETAS[p.tipo]}"/></svg></span>
          <span><span class="n">Passo ${i + 1}, Piso ${p.piso}</span><span class="t">${esc(p.texto)}</span></span>
        </button></li>`).join('') + `</ol>`;
  }

  function htmlEscolher() {
    const titulo = E.slot === 'origem' ? 'Onde você está agora?' : E.slot === 'aviso' ? 'Qual local você quer avisar?' : 'Para onde você vai?';
    const filtros = [['todos', 'Todos'], ['loja', 'Lojas'], ['quiosque', 'Quiosques'], ['servicos', 'Serviços'], ['sanitario', 'Sanitários']];
    const temMic = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    return `<button type="button" class="btn-texto voltar" id="voltar">Voltar</button>
      <h2 tabindex="-1">${titulo}</h2>
      <div class="busca">
        <label class="sr" for="termo">Buscar lugar pelo nome</label>
        <input id="termo" type="search" autocomplete="off" placeholder="Digite o nome da loja ou serviço" value="${esc(E.termo)}">
        ${temMic && E.perfil !== 'auditiva' ? `<button type="button" class="microfone" id="falar-busca" aria-label="Buscar falando"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>` : ''}
      </div>
      ${E.slot === 'destino' && ehMobile() ? `<div class="m-proximos"><p class="atalhos-titulo">Ou vá direto ao mais próximo</p><div class="atalhos">` + ATALHOS.map(([c, t]) => `<button type="button" class="chip" data-proximo="${c}"><svg aria-hidden="true"><use href="#p-${c}"/></svg>${t}</button>`).join('') + `</div><p class="atalhos-titulo">Ou escolha na lista</p></div>` : ''}
      ${E.slot === 'origem' ? `<p class="atalhos-titulo">Entrou por qual acesso?</p><div class="atalhos entradas">` + entradas.map(e => `<button type="button" class="chip" data-origem="${e.id}"><svg aria-hidden="true" style="color:${COR_ENTRADA[R.semAcento(e.nome).split(' ')[1]]}"><use href="#p-entrada"/></svg>${esc(e.nome)}</button>`).join('') + `</div><p class="atalhos-titulo">Ou procure na lista</p>` : ''}
      <div class="atalhos" role="group" aria-label="Filtrar por tipo">${filtros.map(([f, t]) => `<button type="button" class="chip" data-filtro="${f}" aria-pressed="${E.filtro === f}">${t}</button>`).join('')}</div>
      <p class="contagem" id="contagem" aria-live="polite"></p>
      <ul class="resultados" id="resultados"></ul>`;
  }
  function renderResultados() {
    const lista = R.buscar(G.places, E.termo, E.filtro);
    $('contagem').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'lugar encontrado' : 'lugares encontrados'}` : 'Nenhum lugar com esse nome. Tente outra palavra ou escolha “Todos”.';
    $('resultados').innerHTML = lista.map(p => `<li><button type="button" class="resultado" data-lugar="${esc(p.id)}">
      ${icoLugar(p)}<span><b>${esc(p.nome)}</b><small>${esc(descricao(p))}</small>${avisoDe(p.id) ? `<span class="tag-aviso">${TIPOS_AVISO[avisoDe(p.id).tipo].nome}</span>` : ''}</span></button></li>`).join('');
    return lista;
  }

  function ligarPainel() {
    const el = $('painel');
    el.querySelectorAll('[data-abrir]').forEach(b => b.onclick = () => abrirEscolha(b.dataset.abrir));
    el.querySelectorAll('[data-origem]').forEach(b => b.onclick = () => escolher('origem', G.lugarPorId[b.dataset.origem]));
    el.querySelectorAll('[data-proximo]').forEach(b => b.onclick = () => irParaMaisProximo(b.dataset.proximo));
    el.querySelectorAll('[data-passo]').forEach(b => b.onclick = () => irParaPasso(+b.dataset.passo, true));
    const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
    on('trocar', () => { [E.origem, E.destino] = [E.destino, E.origem]; calcular(true); });
    on('ver-primeira-pessoa', abrirPrimeiraPessoa);
    on('nova-rota', () => { E.destino = null; E.rota = null; E.passo = 0; desenharPiso(); renderPainel(); abrirEscolha('destino'); });
    on('abrir-libras', abrirLibras);
    on('abrir-cartao', abrirCartao);
    on('alternar-voz', () => { E.voz = !E.voz; guardar('navi-voz', E.voz ? '1' : '0'); if (!E.voz && temVoz) speechSynthesis.cancel(); renderPainel(); $('alternar-voz').focus(); falar('Voz ligada'); });
    on('mostrar-nomes', () => { E.nomes = !E.nomes; $('mapa').dataset.nomes = E.nomes ? 'sim' : 'nao'; renderPainel(); $('mostrar-nomes').focus(); sync3d(); });
    on('passo-ant', () => irParaPasso(E.passo - 1, true));
    on('passo-prox', () => irParaPasso(E.passo + 1, true));
    on('repetir', () => falar(E.rota.passos[E.passo].texto, true));
    on('ouvir-tudo', () => falar(E.rota.passos.map((p, i) => `Passo ${i + 1}. ${p.texto}`).join(' '), true));
    on('voltar', () => { E.pendente = null; E.tela = E.slot === 'aviso' ? 'avisar' : 'plano'; renderPainel(); $('painel').querySelector(`[data-abrir="${E.slot}"]`)?.focus(); });
    on('abrir-aviso', () => abrirAviso());
    if (E.tela === 'avisar') ligarAviso();
    if (E.tela === 'escolher') {
      const t = $('termo');
      t.oninput = () => { E.termo = t.value; el.classList.toggle('buscando', !!E.termo.trim()); renderResultados(); };
      el.classList.toggle('buscando', !!E.termo.trim());
      el.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => { E.filtro = b.dataset.filtro; el.querySelectorAll('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderResultados(); });
      $('resultados').onclick = ev => { const b = ev.target.closest('[data-lugar]'); if (b) escolher(E.slot, G.lugarPorId[b.dataset.lugar]); };
      on('falar-busca', ouvirBusca);
      renderResultados();
    }
  }

  /* ---------- tela "Avisar sobre um local" ---------- */
  function abrirAviso(lugar) {
    E.tela = 'avisar'; E.avisoEnviado = null;
    if (lugar) E.avisoLugar = lugar;
    renderPainel();
    $('painel').querySelector('h2').focus();
    falar('Avisar sobre um local interditado ou danificado. Primeiro escolha o local.');
  }
  const dataBR = iso => { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  function textoAviso(a) {
    const l = G.lugarPorId[a.lugar];
    return `Aviso pelo Navi, mapa acessível do Shopping Estação\nLocal: ${l.nome} (${descricao(l)})\nSituação: ${TIPOS_AVISO[a.tipo].nome}\n` +
      (a.detalhe ? `Detalhes: ${a.detalhe}\n` : '') + `Data: ${dataBR(a.criado)}`;
  }
  function htmlAvisar() {
    const l = E.avisoLugar;
    if (E.avisoEnviado) {
      const a = E.avisoEnviado, txt = encodeURIComponent(textoAviso(a));
      let h = `<button type="button" class="btn-texto voltar" id="aviso-voltar">Voltar ao mapa</button>
        <h2 tabindex="-1">Aviso registrado</h2>
        <p class="apoio">${esc(G.lugarPorId[a.lugar].nome)} já aparece com aviso no seu mapa${a.tipo !== 'obstaculo' ? ', e as suas rotas desviam dele quando possível' : ''}.</p>
        <p class="atalhos-titulo">Agora avise quem pode resolver</p>
        <div class="envios">`;
      if (CONFIG.whatsappShopping) h += `<a class="btn btn-principal btn-largo" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.whatsappShopping}?text=${txt}">Enviar ao shopping pelo WhatsApp</a>`;
      if (CONFIG.emailEquipe) h += `<a class="btn btn-largo" href="mailto:${encodeURIComponent(CONFIG.emailEquipe)}?subject=${encodeURIComponent('Aviso Navi: ' + G.lugarPorId[a.lugar].nome + ' ' + TIPOS_AVISO[a.tipo].nome.toLowerCase())}&body=${txt}">Enviar à equipe do mapa por e-mail</a>`;
      if (CONFIG.telefoneShopping) h += `<a class="btn btn-largo" href="tel:${CONFIG.telefoneShoppingLink || CONFIG.telefoneShopping}">Ligar para o shopping: ${esc(CONFIG.telefoneShopping)}</a>`;
      h += `<button type="button" class="btn btn-largo" id="copiar-aviso">Copiar o texto do aviso</button>`;
      if (CONFIG.faleConosco) h += `<a class="btn-texto" target="_blank" rel="noopener" href="${esc(CONFIG.faleConosco)}">Abrir o Fale Conosco do shopping</a>`;
      h += `</div><pre class="texto-aviso" id="texto-aviso">${esc(textoAviso(a))}</pre>
        <p class="nota">Para o aviso aparecer no mapa de todas as pessoas, a equipe confere e confirma. Até lá, ele vale só neste aparelho.</p>`;
      return h + htmlMeusAvisos();
    }
    const chips = [];
    if (E.destino) chips.push(`<button type="button" class="chip" data-aviso-lugar="${esc(E.destino.id)}">Meu destino: ${esc(E.destino.nome)}</button>`);
    if (E.origem) chips.push(`<button type="button" class="chip" data-aviso-lugar="${esc(E.origem.id)}">Onde estou: ${esc(E.origem.nome)}</button>`);
    if (E.rota && E.rota.usaElevador) { const el1 = G.places.find(p => p.cat === 'elevador'); chips.push(`<button type="button" class="chip" data-aviso-lugar="${esc(el1.id)}">Elevador</button>`); }
    return `<button type="button" class="btn-texto voltar" id="aviso-voltar">Voltar</button>
      <h2 tabindex="-1">Avisar sobre um local</h2>
      <p class="apoio">Viu algo interditado, quebrado ou bloqueando a passagem? Seu aviso ajuda outras pessoas com deficiência a evitar o problema.</p>
      <form id="form-aviso" novalidate>
        <fieldset class="grupo-aviso"><legend>1. Qual local?</legend>
          <button type="button" class="campo" data-abrir="aviso" aria-label="Local: ${l ? esc(l.nome) + ', ' + esc(descricao(l)) : 'não escolhido'}. Escolher">
            ${l ? `<b>${esc(l.nome)}</b><small>${esc(descricao(l))}</small>` : `<b class="vazio">Escolher o local</b><small>Busque pelo nome ou toque no mapa</small>`}
          </button>
          ${chips.length ? `<div class="atalhos">${chips.join('')}</div>` : ''}
        </fieldset>
        <fieldset class="grupo-aviso"><legend>2. O que aconteceu?</legend>
          ${Object.entries(TIPOS_AVISO).map(([k, t]) => `<label class="opcao-aviso"><input type="radio" name="tipo-aviso" value="${k}" ${E.avisoTipo === k ? 'checked' : ''}><span><b>${t.nome}</b><small>${t.desc}</small></span></label>`).join('')}
        </fieldset>
        <fieldset class="grupo-aviso"><legend>3. Detalhes <span class="opcional">(opcional)</span></legend>
          <label class="sr" for="detalhe-aviso">Detalhes do aviso</label>
          <textarea id="detalhe-aviso" maxlength="300" rows="3" placeholder="Ex.: porta do sanitário quebrada, elevador parado desde a manhã">${esc(E.avisoTexto)}</textarea>
        </fieldset>
        <p class="erro-aviso" id="erro-aviso" role="alert" hidden></p>
        <button type="submit" class="btn btn-principal btn-largo">Registrar aviso</button>
      </form>` + htmlMeusAvisos();
  }
  function htmlMeusAvisos() {
    const meus = (avisosMemoria || avisosLocais()).filter(a => G.lugarPorId[a.lugar]);
    const oficiais = (window.NAVI_AVISOS || []).filter(a => G.lugarPorId[a.lugar]);
    let h = '';
    if (oficiais.length) h += `<h3 class="sub-aviso">Avisos confirmados</h3><ul class="lista-avisos">` + oficiais.map(a => `<li><b>${esc(G.lugarPorId[a.lugar].nome)}</b>: ${TIPOS_AVISO[a.tipo].nome.toLowerCase()}${a.detalhe ? ', ' + esc(a.detalhe) : ''}${a.desde ? ` <small>desde ${esc(a.desde.split('-').reverse().join('/'))}</small>` : ''}</li>`).join('') + `</ul>`;
    if (meus.length) h += `<h3 class="sub-aviso">Seus avisos neste aparelho</h3><ul class="lista-avisos">` + meus.map((a, i) => `<li><span><b>${esc(G.lugarPorId[a.lugar].nome)}</b>: ${TIPOS_AVISO[a.tipo].nome.toLowerCase()} <small>${dataBR(a.criado)}</small></span><button type="button" class="btn-texto" data-remover-aviso="${i}">Já foi resolvido</button></li>`).join('') + `</ul>`;
    return h;
  }
  function ligarAviso() {
    const p = $('painel');
    const voltarMapa = () => { E.tela = 'plano'; E.avisoEnviado = null; if (E.origem && E.destino) calcular(false); else { desenharPiso(); renderPainel(); } $('abrir-aviso')?.focus(); };
    $('aviso-voltar').onclick = voltarMapa;
    p.querySelectorAll('[data-aviso-lugar]').forEach(b => b.onclick = () => escolher('aviso', G.lugarPorId[b.dataset.avisoLugar]));
    p.querySelectorAll('[data-abrir="aviso"]').forEach(b => b.onclick = () => abrirEscolha('aviso'));
    p.querySelectorAll('input[name="tipo-aviso"]').forEach(r => r.onchange = () => { E.avisoTipo = r.value; });
    const t = $('detalhe-aviso'); if (t) t.oninput = () => { E.avisoTexto = t.value; };
    p.querySelectorAll('[data-remover-aviso]').forEach(b => b.onclick = () => {
      const lista = (avisosMemoria || avisosLocais()).slice(); const [rem] = lista.splice(+b.dataset.removerAviso, 1);
      salvarAvisosLocais(lista); refazerRota(); renderPainel(); desenharPiso();
      anunciar(`Aviso de ${G.lugarPorId[rem.lugar].nome} removido.`); $('painel').querySelector('h2').focus();
    });
    const copiar = $('copiar-aviso');
    if (copiar) copiar.onclick = async () => {
      const txt = $('texto-aviso').textContent;
      try { await navigator.clipboard.writeText(txt); anunciar('Texto do aviso copiado.'); }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('texto-aviso')); getSelection().removeAllRanges(); getSelection().addRange(r); anunciar('Selecionei o texto do aviso. Use copiar do seu aparelho.'); }
    };
    const f = $('form-aviso');
    if (f) f.onsubmit = ev => {
      ev.preventDefault();
      const erro = $('erro-aviso');
      if (!E.avisoLugar) { erro.textContent = 'Escolha o local antes de registrar o aviso.'; erro.hidden = false; anunciar(erro.textContent); p.querySelector('[data-abrir="aviso"]').focus(); return; }
      const a = { lugar: E.avisoLugar.id, tipo: E.avisoTipo, detalhe: (E.avisoTexto || '').trim().slice(0, 300), criado: new Date().toISOString() };
      const lista = (avisosMemoria || avisosLocais()).filter(x => x.lugar !== a.lugar); lista.push(a);
      salvarAvisosLocais(lista);
      E.avisoEnviado = a; E.avisoTexto = '';
      refazerRota(); desenharPiso(); renderPainel();
      anunciar(`Aviso registrado: ${E.avisoLugar.nome}, ${TIPOS_AVISO[a.tipo].nome.toLowerCase()}. Agora envie ao shopping pelo WhatsApp ou por telefone.`);
      $('painel').querySelector('h2').focus();
    };
  }
  function refazerRota() {
    if (E.origem && E.destino) { E.rota = R.rota(G, E.origem, E.destino, opcoesRota()); E.passo = 0; }
  }

  function abrirEscolha(slot, prefixo = '') {
    E.slot = slot; E.tela = 'escolher'; E.termo = ''; E.filtro = 'todos';
    renderPainel();
    if (ehMobile()) $('painel').scrollTop = 0;
    const temMic = !!(window.SpeechRecognition || window.webkitSpeechRecognition) && E.perfil !== 'auditiva';
    const comoDigitar = 'Digite o nome do lugar' + (temMic ? ' ou toque no botão amarelo, à direita do campo, para falar.' : '.');
    let pergunta = slot === 'origem' ? 'Onde você está agora? ' + comoDigitar : slot === 'aviso' ? 'Qual local você quer avisar? ' + comoDigitar : 'Para onde você quer ir? ' + comoDigitar;
    if (slot === 'origem') pergunta += ' Se acabou de entrar no shopping, escolha o acesso: Vermelho, Azul ou Verde, logo abaixo do campo.';
    if (E.perfil === 'visual') { $('termo').focus(); anunciar(prefixo + pergunta, { visual: false }); }
    else { $('painel').querySelector('h2').focus(); falar(prefixo + pergunta); }
  }

  function escolher(slot, lugar) {
    if (!lugar) return;
    if (slot === 'aviso') {
      E.avisoLugar = lugar; E.tela = 'avisar'; E.avisoEnviado = null; renderPainel();
      anunciar(`Local escolhido: ${lugar.nome}, ${descricao(lugar)}. Agora diga o que aconteceu.`, { visual: false });
      $('painel').querySelector('input[name="tipo-aviso"]:checked')?.focus();
      return;
    }
    E[slot] = lugar; E.tela = 'plano';
    if (slot === 'origem' && E.pendente) { const c = E.pendente; E.pendente = null; irParaMaisProximo(c); return; }
    if (E.origem && E.destino && E.origem.id === E.destino.id) E[slot === 'origem' ? 'destino' : 'origem'] = null;
    if (E.origem && E.destino) { calcular(true); return; }
    E.rota = null;
    if (lugar.piso !== E.piso) { E.piso = lugar.piso; desenharPiso(); } else desenharMarcas();
    centrarEm(lugar, 1000);
    // perfil visual: depois do destino, pergunta logo onde a pessoa está
    if ((E.perfil === 'visual' || ehMobile()) && slot === 'destino' && !E.origem) {
      abrirEscolha('origem', `Destino escolhido: ${lugar.nome}, ${descricao(lugar)}. `);
      return;
    }
    // celular: tocou primeiro na partida (ex.: no mapa) → já pergunta o destino
    if (ehMobile() && slot === 'origem' && !E.destino) {
      abrirEscolha('destino', `Partida: ${lugar.nome}. `);
      return;
    }
    renderPainel();
    const proximo = slot === 'origem' ? 'Agora escolha para onde você vai.' : 'Agora escolha onde você está.';
    anunciar(`${slot === 'origem' ? 'Partida' : 'Destino'}: ${lugar.nome}, ${descricao(lugar)}. ${proximo}`);
    $('painel').querySelector(slot === 'origem' ? '[data-abrir="destino"]' : '[data-abrir="origem"]')?.focus();
  }

  function irParaMaisProximo(cat) {
    if (!E.origem) {
      E.pendente = cat;
      const nome = (ATALHOS.find(a => a[0] === cat) || [, CAT[cat]])[1];
      abrirEscolha('origem', `${nome}. Para achar o mais próximo, diga onde você está. `);
      return;
    }
    const l = R.maisProximoDaCategoria(G, E.origem, cat, opcoesRota());
    if (!l) { E.tela = 'plano'; desenharPiso(); renderPainel(); anunciar('Não encontramos esse serviço com uma rota possível a partir de onde você está.'); return; }
    E.destino = l; calcular(true);
  }

  function calcular(anunciarRota) {
    E.rota = R.rota(G, E.origem, E.destino, opcoesRota());
    E.passo = 0; E.tela = 'plano';
    if (E.rota) { E.piso = E.rota.trechos[0].piso; }
    desenharPiso();
    if (E.rota) enquadrarRota(E.rota.trechos[0]);
    renderPainel();
    if (ehMobile()) $('painel').scrollTop = 0;
    if (!anunciarRota) return;
    if (!E.rota) { anunciar('Não encontramos um caminho entre esses pontos. Procure o SAC para ajuda.'); return; }
    const r = E.rota;
    const resumo = `Caminho de ${r.origem.nome} até ${r.destino.nome}, com ${r.passos.length} passos${r.usaElevador ? ', usando o elevador' : ''}${r.usaEscada ? ', usando escada rolante' : ''}.`;
    if (E.perfil === 'visual') {
      anunciar(resumo, { falar: false });
      falar(resumo + ' Passo 1. ' + r.passos[0].texto);
      $('passo-prox')?.focus();
    } else {
      anunciar(resumo);
      $('titulo-rota')?.focus();
    }
  }

  function irParaPasso(i, falarPasso) {
    if (!E.rota) return;
    E.passo = Math.max(0, Math.min(E.rota.passos.length - 1, i));
    const p = E.rota.passos[E.passo];
    if (p.piso !== E.piso) { E.piso = p.piso; desenharPiso(); } else desenharRota();
    centrarEm({ x: (p.de.x + p.ate.x) / 2, y: (p.de.y + p.ate.y) / 2 }, Math.max(520, Math.hypot(p.ate.x - p.de.x, p.ate.y - p.de.y) + 260));
    renderPainel();
    if (E.perfil === 'visual' || ehMobile()) { $(E.passo === E.rota.passos.length - 1 ? 'passo-ant' : 'passo-prox')?.focus(); }
    else $('painel').querySelector(`[data-passo="${E.passo}"]`)?.focus();
    if (falarPasso) {
      const msg = `Passo ${E.passo + 1}. ${p.texto}`;
      if (E.perfil === 'auditiva') avisoVisual(msg); else falar(msg, E.perfil === 'visual' ? false : false);
    }
  }

  function ouvirBusca() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (temVoz) speechSynthesis.cancel();
    const rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;
    const b = $('falar-busca'); b.setAttribute('aria-pressed', 'true');
    anunciar('Pode falar o nome do lugar.', { falar: false });
    rec.onresult = ev => {
      const t = ev.results[0][0].transcript.replace(/[.?!]$/, '');
      E.termo = t; $('termo').value = t; $('painel').classList.toggle('buscando', !!t.trim());
      const lista = renderResultados();
      anunciar(lista.length ? `Você disse ${t}. Encontrei ${lista.length}. O primeiro é ${lista[0].nome}.` : `Você disse ${t}. Não encontrei nenhum lugar com esse nome.`);
      $('resultados').querySelector('button')?.focus();
    };
    rec.onerror = () => anunciar('Não consegui ouvir. Tente de novo ou digite o nome.');
    rec.onend = () => b.setAttribute('aria-pressed', 'false');
    try { rec.start(); } catch (e) { /* já ouvindo */ }
  }

  function abrirCartao() {
    $('cartao-destino').textContent = E.destino ? `Estou procurando: ${E.destino.nome} (${descricao(E.destino)}).` : 'Estou procurando um lugar no shopping.';
    $('cartao').showModal();
  }

  /* ---------------- mapa ---------------- */
  const svg = $('mapa');
  const vb = { x: 0, y: 0, w: 1920, h: 800 };
  const el = (tag, attrs, pai) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (pai) pai.appendChild(n); return n; };

  function escala() {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return 1;
    return Math.max(vb.w / r.width, vb.h / r.height); // unidades da planta por pixel
  }
  function aplicarVB() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const k = escala();
    svg.dataset.zoom = k < 0.9 ? 'perto' : 'longe';
    const s = E.perfil === 'visual' ? 1.35 : 1;
    svg.querySelectorAll('[data-escala]').forEach(n => {
      n.setAttribute('transform', `translate(${n.dataset.x} ${n.dataset.y}) scale(${k * s * (+n.dataset.escala)})`);
    });
  }
  function ajustar() {
    if (em3d()) { m3d.ajustar(); return; }
    const b = D.pisos[E.piso], pad = 30;
    vb.x = b.minX - pad; vb.y = b.minY - pad; vb.w = b.maxX - b.minX + pad * 2; vb.h = b.maxY - b.minY + pad * 2;
    aplicarVB();
  }
  function centrarEm(p, largura) {
    if (em3d()) { const l = largura || 700; m3d.focar([{ x: p.x - l / 2, y: p.y - l / 4 }, { x: p.x + l / 2, y: p.y + l / 4 }], p.piso || E.piso); return; }
    const r = svg.getBoundingClientRect(), asp = r.height && r.width ? r.height / r.width : 0.5;
    if (largura) { vb.w = largura; vb.h = largura * asp; }
    vb.x = p.x - vb.w / 2; vb.y = p.y - vb.h / 2;
    aplicarVB();
  }
  function enquadrarRota(t) {
    if (em3d()) { m3d.focar(t.pontos, t.piso); return; }
    const xs = t.pontos.map(p => p.x), ys = t.pontos.map(p => p.y);
    const r = svg.getBoundingClientRect(), asp = r.height && r.width ? r.height / r.width : 0.5;
    const pad = 120, minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    let w = Math.max(maxX - minX, 500), h = Math.max(maxY - minY, w * asp);
    w = Math.max(w, h / asp);
    vb.w = w; vb.h = w * asp; vb.x = (minX + maxX) / 2 - vb.w / 2; vb.y = (minY + maxY) / 2 - vb.h / 2;
    aplicarVB();
  }
  function zoom(f, cx, cy) {
    if (em3d()) { m3d.zoom(f); return; }
    const nw = Math.min(2400, Math.max(180, vb.w * f));
    const real = nw / vb.w;
    if (cx === undefined) { cx = vb.x + vb.w / 2; cy = vb.y + vb.h / 2; }
    vb.x = cx - (cx - vb.x) * real; vb.y = cy - (cy - vb.y) * real; vb.w *= real; vb.h *= real;
    aplicarVB();
  }
  function pontoSVG(ev) {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  const areaPoly = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

  function desenharPiso() {
    const planta = $('camada-planta'); planta.innerHTML = '';
    const lugaresPiso = G.places.filter(p => p.piso === E.piso);
    const porPoly = {};
    lugaresPiso.forEach(p => { if (p.poly >= 0 && !porPoly[p.poly]) porPoly[p.poly] = p; });
    (D.plantas[E.piso] || []).forEach((poly, i) => {
      const p = porPoly[i];
      const path = el('path', { d: 'M' + poly.map(q => q.join(' ')).join('L') + 'Z', class: 'loja-forma' + (p ? ' clicavel' : '') }, planta);
      if (p) { path.dataset.id = p.id; el('title', {}, path).textContent = p.nome; }
    });
    // quiosques e entradas (retângulos posicionados pela planta oficial)
    lugaresPiso.filter(p => p.cat === 'quiosque' || p.cat === 'entrada' || (p.cat === 'loja' && p.poly < 0)).forEach(p => {
      const g = el('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.r || 0})` }, planta);
      const cor = p.cat === 'entrada' ? COR_ENTRADA[R.semAcento(p.nome).split(' ')[1]] : null;
      const r = el('rect', { x: -p.w / 2, y: -p.h / 2, width: p.w, height: p.h, rx: p.cat === 'entrada' ? 2 : 5,
        class: p.cat === 'entrada' ? 'entrada-forma' : 'quiosque-forma' }, g);
      if (cor) r.setAttribute('fill', cor);
      r.dataset.id = p.id; el('title', {}, r).textContent = p.nome + (p.cat === 'quiosque' ? ' (quiosque)' : '');
    });
    // rótulos das lojas (aparecem ao aproximar)
    const rot = $('camada-rotulos'); rot.innerHTML = '';
    // evita sobreposição: lojas maiores primeiro, depois quiosques
    const area = p => p.poly >= 0 ? areaPoly(D.plantas[E.piso][p.poly]) : p.w * p.h;
    const aceitos = [];
    lugaresPiso.filter(p => p.cat === 'loja' || p.cat === 'quiosque')
      .sort((a, b) => (a.cat === 'quiosque') - (b.cat === 'quiosque') || area(b) - area(a))
      .forEach(p => {
        const fs = p.cat === 'quiosque' ? 9 : 11, txt = p.nome.length > 18 ? p.nome.slice(0, 17) + '…' : p.nome;
        const w = txt.length * fs * 0.56 + 4, h = fs * 1.2;
        const caixa = { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h / 2, y1: p.y + h / 2 };
        if (aceitos.some(c => c.x0 < caixa.x1 && caixa.x0 < c.x1 && c.y0 < caixa.y1 && caixa.y0 < c.y1)) return;
        aceitos.push(caixa);
        const t = el('text', { x: p.x, y: p.y + fs * 0.35, 'text-anchor': 'middle', class: 'rotulo rotulo-loja', 'font-size': fs }, rot);
        t.dataset.para = p.id;
        t.textContent = txt;
      });
    // ícones de serviços
    const ic = $('camada-icones'); ic.innerHTML = '';
    lugaresPiso.filter(p => !['loja', 'quiosque', 'entrada', 'administracao'].includes(p.cat)).forEach(p => {
      const desativado = E.perfil === 'mobilidade' && p.cat === 'escada';
      const g = el('g', { class: `icone-mapa ${p.cat}${desativado ? ' desativado' : ''}`, 'data-escala': 1, 'data-x': p.x, 'data-y': p.y }, ic);
      g.dataset.id = p.id;
      el('circle', { r: 15 }, g);
      el('use', { href: '#p-' + p.cat, x: -10, y: -10, width: 20, height: 20 }, g);
      el('title', {}, g).textContent = p.nome + (desativado ? ' — evitada nas suas rotas' : '') + (p.estimado ? ' (posição estimada)' : '');
    });
    // avisos de interdição / dano
    todosAvisos().forEach(a => {
      const p = G.lugarPorId[a.lugar];
      if (!p || p.piso !== E.piso) return;
      svg.querySelectorAll(`.loja-forma[data-id="${CSS.escape(p.id)}"], .quiosque-forma[data-id="${CSS.escape(p.id)}"]`).forEach(n => n.classList.add('com-aviso'));
      const g = el('g', { class: 'marca-aviso', 'data-escala': 1, 'data-x': p.x, 'data-y': p.y - 4, 'data-id': p.id }, ic);
      el('circle', { r: 13 }, g);
      el('use', { href: '#p-aviso', x: -9, y: -10, width: 18, height: 18 }, g);
      el('title', {}, g).textContent = `${p.nome}: ${TIPOS_AVISO[a.tipo].nome.toLowerCase()}${a.detalhe ? ' (' + a.detalhe + ')' : ''}`;
    });
    // botões de piso
    document.querySelectorAll('.pisos button').forEach(b => {
      const piso = +b.dataset.piso;
      b.setAttribute('aria-pressed', piso === E.piso);
      const temRota = E.rota && E.rota.trechos.some(t => t.piso === piso);
      b.innerHTML = `Piso ${piso}${temRota ? '<span class="tem-rota" aria-hidden="true"></span><span class="sr"> (parte da rota)</span>' : ''}`;
    });
    $('mapa-desc').textContent = `Planta do Piso ${E.piso} do Shopping Estação. Todas as informações do mapa também estão no painel em texto.`;
    desenharRota();
    legenda();
  }

  function desenharRota() {
    const c = $('camada-rota'); c.innerHTML = '';
    const aviso = $('aviso-piso'); aviso.hidden = true;
    if (E.rota) {
      const trechos = E.rota.trechos;
      trechos.forEach((t, i) => {
        if (t.piso !== E.piso) return;
        const d = 'M' + t.pontos.map(p => p.x + ' ' + p.y).join('L');
        const largura = E.perfil === 'visual' ? 1.5 : 1;
        el('path', { d, class: 'rota-casca', 'stroke-width': 13 * largura, 'vector-effect': 'non-scaling-stroke' }, c);
        const p = E.rota.passos[E.passo];
        if (p && p.piso === E.piso && (p.de.x !== p.ate.x || p.de.y !== p.ate.y)) {
          el('path', { d: `M${p.de.x} ${p.de.y}L${p.ate.x} ${p.ate.y}`, class: 'trecho-ativo', 'stroke-width': 18 * largura, 'vector-effect': 'non-scaling-stroke' }, c);
        }
        el('path', { d, class: 'rota-linha', 'stroke-width': 7 * largura, 'vector-effect': 'non-scaling-stroke' }, c);
        el('path', { d, class: 'rota-fluxo', 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' }, c);
        if (t.saida) {
          const prox = trechos[i + 1];
          aviso.textContent = `Neste ponto, ${t.saida === 'elevador' ? 'pegue o elevador' : 'pegue a escada rolante'} para o Piso ${prox.piso}.`;
          aviso.hidden = false;
        }
        if (i > 0) { aviso.textContent = `Você chegou ao Piso ${t.piso} pelo ${trechos[i - 1].saida === 'elevador' ? 'elevador' : 'escada rolante'}.`; aviso.hidden = false; }
      });
      if (!trechos.some(t => t.piso === E.piso)) {
        aviso.textContent = `Sua rota não passa pelo Piso ${E.piso}.`; aviso.hidden = false;
      }
    }
    desenharMarcas();
  }

  function desenharMarcas() {
    const m = $('camada-marcas'); m.innerHTML = '';
    svg.querySelectorAll('.selecionada').forEach(n => n.classList.remove('selecionada'));
    svg.querySelectorAll('.rotulo-oculto').forEach(n => n.classList.remove('rotulo-oculto'));
    [E.origem, E.destino].forEach(l => l && svg.querySelectorAll(`[data-para="${CSS.escape(l.id)}"]`).forEach(n => n.classList.add('rotulo-oculto')));
    const marca = (lugar, tipo) => {
      if (!lugar || lugar.piso !== E.piso) return;
      svg.querySelectorAll(`[data-id="${CSS.escape(lugar.id)}"]`).forEach(n => n.classList.add('selecionada'));
      const g = el('g', { 'data-escala': 1, 'data-x': lugar.x, 'data-y': lugar.y }, m);
      if (tipo === 'origem') el('circle', { r: 10, class: 'marca-origem', 'stroke-width': 5 }, g);
      else el('path', { d: 'M0 0c-4-8-14-14-14-24a14 14 0 0 1 28 0c0 10-10 16-14 24z', class: 'marca-destino', 'stroke-width': 2.5 }, g);
      const t = el('text', { x: 0, y: tipo === 'origem' ? -18 : -44, 'text-anchor': 'middle', class: 'rotulo', 'font-size': 15 }, g);
      t.textContent = (tipo === 'origem' ? 'Você: ' : '') + lugar.nome;
    };
    marca(E.origem, 'origem'); marca(E.destino, 'destino');
    aplicarVB();
    sync3d();
  }

  function legenda() {
    const l = $('legenda');
    let h = `<span><i class="orig"></i>Partida</span><span><i class="dest"></i>Destino</span><span><i></i>Rota</span>`;
    if (E.perfil === 'mobilidade') h += `<span>Escadas rolantes ficam esmaecidas: não entram na rota</span>`;
    if (todosAvisos().some(a => G.lugarPorId[a.lugar].piso === E.piso)) h += `<span><svg aria-hidden="true" width="16" height="16" style="color:var(--alerta)"><use href="#p-aviso"/></svg>Local com aviso</span>`;
    if (vista === '3d') h += `<span>Arraste para girar, role ou use + e − para aproximar</span>`;
    const bfp = $('primeira-pessoa'); if (bfp) bfp.hidden = !E.rota;
    l.innerHTML = h;
  }

  // interação com o mapa: arrastar, pinça, roda do mouse, clique
  const toques = new Map();
  let inicio = null, arrastou = false, pinca = null;
  svg.addEventListener('pointerdown', ev => {
    svg.setPointerCapture?.(ev.pointerId);
    toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (toques.size === 1) { inicio = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y }; arrastou = false; }
    if (toques.size === 2) {
      const [a, b] = [...toques.values()];
      pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), w: vb.w };
    }
  });
  svg.addEventListener('pointermove', ev => {
    if (!toques.has(ev.pointerId)) return;
    toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (toques.size === 2 && pinca) {
      const [a, b] = [...toques.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = pontoSVG({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      zoom((pinca.w * pinca.d / d) / vb.w, c.x, c.y); arrastou = true; return;
    }
    if (!inicio) return;
    const dx = ev.clientX - inicio.x, dy = ev.clientY - inicio.y;
    if (!arrastou && Math.hypot(dx, dy) < 6) return;
    arrastou = true; svg.classList.add('arrastando');
    const k = escala();
    vb.x = inicio.vx - dx * k; vb.y = inicio.vy - dy * k; aplicarVB();
  });
  const soltar = ev => {
    toques.delete(ev.pointerId);
    if (toques.size < 2) pinca = null;
    if (!toques.size) { inicio = null; svg.classList.remove('arrastando'); }
  };
  svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
  svg.addEventListener('click', ev => {
    if (arrastou) { arrastou = false; return; }
    const alvo = document.elementsFromPoint(ev.clientX, ev.clientY).map(n => n.closest && n.closest('[data-id]')).find(Boolean);
    if (!alvo) return;
    selecionarDoMapa(G.lugarPorId[alvo.dataset.id]);
  });
  function selecionarDoMapa(lugar) {
    if (!lugar) return;
    if (E.tela === 'escolher') escolher(E.slot, lugar);
    else if (E.tela === 'avisar') escolher('aviso', lugar);
    else if (!E.origem) escolher('origem', lugar);
    else escolher('destino', lugar);
  }

  /* ---------------- vista 3D (opcional) ---------------- */
  let vista = '2d', m3d = null, carregando3d = null;
  const area3d = $('mapa3d');
  function em3d() { return vista === '3d' && m3d; }
  function sync3d() { if (em3d()) m3d.atualizar(E); }
  function carregarScript(src) {
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.body.appendChild(s); });
  }
  async function definirVista(v, opcoes = {}) {
    if (v === '3d' && !m3d) {
      const botao = document.querySelector('[data-vista="3d"]');
      botao.setAttribute('aria-busy', 'true');
      try {
        carregando3d = carregando3d || (async () => {
          if (!window.THREE) await carregarScript('js/three-navi.min.js');
          if (!window.NAVI_3D) await carregarScript('js/dados3d.js');
          if (!window.NaviMapa3D) await carregarScript('js/mapa3d.js');
        })();
        await carregando3d;
        m3d = window.NaviMapa3D.iniciar(area3d, D, G, {
          selecionar: selecionarDoMapa,
          anunciar: msg => anunciar(msg),
          saiuPrimeiraPessoa: () => { renderPainel(); sync3d(); $('mapa-area').querySelector('[data-vista="3d"]')?.focus(); }
        });
      } catch (e) { m3d = null; }
      botao.removeAttribute('aria-busy');
      if (!m3d) { carregando3d = null; anunciar('A vista 3D não funciona neste navegador ou aparelho. Continuamos no mapa 2D.'); return; }
    }
    if (v === '2d' && m3d && m3d.emPrimeiraPessoa) m3d.sairPrimeiraPessoa();
    vista = v;
    guardar('navi-vista', v);
    document.querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-pressed', b.dataset.vista === v));
    $('mapa-area').classList.toggle('em-3d', v === '3d');
    svg.hidden = v === '3d';
    if (m3d) m3d.mostrar(v === '3d');
    legenda();
    if (v === '3d') {
      m3d.atualizar(E);
      const t = E.rota && E.rota.trechos.find(t => t.piso === E.piso);
      if (t) m3d.focar(t.pontos, t.piso); else m3d.ajustar();
    } else {
      const t = E.rota && E.rota.trechos.find(t => t.piso === E.piso);
      if (t) enquadrarRota(t); else ajustar();
    }
    if (!opcoes.silencioso) anunciar(v === '3d' ? 'Mapa em 3D. As mesmas informações continuam no painel em texto.' : 'Mapa em 2D.', { visual: false });
  }
  document.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => definirVista(b.dataset.vista));
  $('ver-dois-pisos').onclick = () => {
    if (!m3d) return;
    const on = !m3d.emAmbos; m3d.ambos(on);
    $('ver-dois-pisos').setAttribute('aria-pressed', on);
    m3d.atualizar(E); m3d.ajustar();
    anunciar(on ? 'Mostrando os dois pisos, um sobre o outro.' : `Mostrando só o Piso ${E.piso}.`, { visual: false });
  };
  $('vista-cima').onclick = () => m3d && m3d.vistaDeCima();
  async function abrirPrimeiraPessoa() {
    if (!E.rota) { anunciar('Escolha a partida e o destino para ver o caminho em primeira pessoa.'); return; }
    if (vista !== '3d') await definirVista('3d', { silencioso: true });
    if (!m3d) return;
    m3d.primeiraPessoa(E);
    if (window.matchMedia('(max-width: 860px)').matches) $('mapa-area').scrollIntoView({ block: 'start' });
    anunciar('Primeira pessoa. Arraste para olhar em volta e toque em Avançar para andar pela rota.', { falar: false });
  }
  $('primeira-pessoa').onclick = abrirPrimeiraPessoa;
  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    const p = pontoSVG(ev);
    zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
  svg.addEventListener('keydown', ev => {
    const passo = vb.w * 0.1;
    const acoes = { ArrowLeft: () => { vb.x -= passo; }, ArrowRight: () => { vb.x += passo; }, ArrowUp: () => { vb.y -= passo; }, ArrowDown: () => { vb.y += passo; },
      '+': () => zoom(1 / 1.25), '=': () => zoom(1 / 1.25), '-': () => zoom(1.25), '0': ajustar };
    if (acoes[ev.key]) { ev.preventDefault(); acoes[ev.key](); aplicarVB(); }
  });
  $('zoom-mais').onclick = () => zoom(1 / 1.35);
  $('zoom-menos').onclick = () => zoom(1.35);
  $('zoom-ajustar').onclick = ajustar;
  document.querySelectorAll('.pisos button').forEach(b => b.onclick = () => {
    E.piso = +b.dataset.piso; desenharPiso();
    const t = E.rota && E.rota.trechos.find(t => t.piso === E.piso);
    if (t) enquadrarRota(t); else ajustar();
    anunciar(`Mostrando o Piso ${E.piso}.`, { visual: false });
  });
  window.addEventListener('resize', () => aplicarVB());
  function medirTopo() { document.documentElement.style.setProperty('--topo-h', document.querySelector('.topo').offsetHeight + 'px'); }
  window.addEventListener('resize', medirTopo); medirTopo();
  // ao girar o aparelho ou mudar de largura, o painel se ajusta ao formato certo
  MOBILE.addEventListener?.('change', () => { if (!$('tela-mapa').hidden) renderPainel(); });

  /* ---------------- topo e início ---------------- */
  document.querySelectorAll('[data-perfil]').forEach(b => { if (b.tagName === 'BUTTON') b.onclick = () => definirPerfil(b.dataset.perfil); });
  $('btn-perfil').onclick = voltarInicio;
  $('marca').onclick = ev => { ev.preventDefault(); voltarInicio(); };
  $('btn-libras').onclick = abrirLibras;
  $('btn-contraste').onclick = () => {
    const on = !document.documentElement.classList.contains('contraste');
    aplicarContraste(on); guardar('navi-contraste', on ? '1' : '0');
    if (m3d) { m3d.cores(); sync3d(); }
  };
  $('btn-texto').onclick = () => {
    const on = !document.documentElement.classList.contains('texto-grande');
    document.documentElement.classList.toggle('texto-grande', on);
    $('btn-texto').setAttribute('aria-pressed', on); guardar('navi-texto', on ? '1' : '0');
    medirTopo(); aplicarVB();
  };
  if (ler('navi-texto') === '1') { document.documentElement.classList.add('texto-grande'); $('btn-texto').setAttribute('aria-pressed', 'true'); }
  if (ler('navi-contraste') === '1') aplicarContraste(true);
  if (temVoz) speechSynthesis.onvoiceschanged = () => {};

  /* ---------------- pergunta de voz na abertura ---------------- */
  const PERGUNTA = 'Você deseja ativar o comando de voz do site? Recomendado para pessoas com deficiência visual que não têm o TalkBack ativado. Toque em Sim, na parte de cima da tela, ou em Não, logo abaixo.';
  const dlgVoz = $('pergunta-voz');
  function responderVoz(sim) {
    vozEscolha = sim ? 'sim' : 'nao';
    E.voz = sim;
    if (dlgVoz.open) dlgVoz.close();
    if (sim) {
      if (!$('tela-mapa').hidden && E.perfil) { renderPainel(); anunciar('Voz do site ativada.'); return; }
      falar('Voz do site ativada. Como você prefere se orientar no shopping? Toque uma vez em uma opção para ouvir, e toque de novo na mesma opção para escolher. ' +
        'Opções, de cima para baixo: Deficiência visual. Mobilidade reduzida. Deficiência auditiva.');
      document.querySelector('.perfil')?.focus();
    } else {
      if (temVoz) speechSynthesis.cancel();
      if (!$('tela-mapa').hidden && E.perfil) renderPainel();
    }
  }
  $('voz-sim').onclick = () => responderVoz(true);
  $('voz-nao').onclick = () => responderVoz(false);
  dlgVoz.addEventListener('cancel', ev => { ev.preventDefault(); responderVoz(false); });
  // tocar em qualquer área do pop-up fora dos botões lê a pergunta em voz alta
  dlgVoz.addEventListener('click', ev => { if (!ev.target.closest('button')) falar(PERGUNTA, true); });
  if (typeof dlgVoz.showModal === 'function') {
    dlgVoz.showModal();
    $('voz-sim').focus();
    // alguns navegadores só liberam a voz após o primeiro toque; tentamos mesmo assim
    setTimeout(() => falar(PERGUNTA, true), 400);
  } else { vozEscolha = 'nao'; }

  // Com a voz ligada, na tela inicial: 1º toque lê a opção, 2º toque escolhe (teclado escolhe direto)
  document.querySelectorAll('.perfil, .link-sem-perfil').forEach(b => {
    b.onclick = ev => {
      if (vozEscolha === 'sim' && ev.detail > 0 && b.dataset.ouvido !== 'sim') {
        document.querySelectorAll('[data-ouvido]').forEach(x => delete x.dataset.ouvido);
        b.dataset.ouvido = 'sim';
        const nome = b.querySelector('strong')?.textContent || b.textContent.trim();
        const desc = b.querySelector('.perfil-texto > span')?.textContent || '';
        falar(`${nome}. ${desc} Toque de novo para escolher.`);
        return;
      }
      document.querySelectorAll('[data-ouvido]').forEach(x => delete x.dataset.ouvido);
      definirPerfil(b.dataset.perfil);
    };
  });

  // Leitura do item em foco ao navegar pelo teclado (Tab), quando a voz do site está ligada
  let usouTeclado = false;
  document.addEventListener('keydown', ev => { if (ev.key === 'Tab') usouTeclado = true; });
  document.addEventListener('pointerdown', () => { usouTeclado = false; });
  document.addEventListener('focusin', ev => {
    if (!E.voz || !usouTeclado) return;
    const el = ev.target;
    const nome = el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.textContent;
    if (nome && nome.trim()) falar(nome.replace(/\s+/g, ' ').trim(), false, { baixa: true });
  });

  // Link direto (ex.: QR Code em uma entrada): ?perfil=mobilidade&origem=<id>&destino=<id>
  const qs = new URLSearchParams(location.search);
  const origemQS = qs.get('origem') && G.lugarPorId[qs.get('origem')];
  const destinoQS = qs.get('destino') && G.lugarPorId[qs.get('destino')];
  if (origemQS) E.origem = origemQS;
  if (destinoQS) E.destino = destinoQS;
  const perfilInicial = qs.get('perfil') || ler('navi-perfil');
  if (perfilInicial && PERFIS[perfilInicial] && (qs.get('perfil') || qs.get('origem'))) definirPerfil(perfilInicial, { silencioso: true });
  if (ler('navi-vista') === '3d' && !$('tela-mapa').hidden) definirVista('3d', { silencioso: true });
  window.Navi = { E, G, definirPerfil, escolher, calcular, irParaPasso, definirVista };
})();
