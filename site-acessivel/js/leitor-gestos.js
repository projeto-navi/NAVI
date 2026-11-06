/* Navi — gestos do TalkBack dentro do site (RN76).
   Com a Voz ligada, em tela de toque:
   - 1 toque: seleciona o item sob o dedo e lê (não ativa);
   - 2 toques rápidos, em qualquer lugar: ativa o item selecionado;
   - arrastar 1 dedo devagar: explora, lendo cada item novo sob o dedo;
   - deslizar 1 dedo para a direita / esquerda: próximo / item anterior;
   - 2 dedos ou mais: passam direto (rolar a página; no mapa, arrastar e pinça).
   Cada item é lido como "nome, tipo, estado". Retângulo verde em volta do item e sons curtos. */
(function (raiz) {
  'use strict';

  const INTERATIVOS = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
    '[role=button]', '[role=link]', '[role=tab]', '[role=checkbox]', '[role=radio]', '[role=switch]',
    '[role=menuitem]', '[role=menuitemcheckbox]', '[role=menuitemradio]', '[role=option]', '[role=slider]',
    '[role=combobox]', '[role=searchbox]', '[role=textbox]', '[contenteditable=""]', '[contenteditable=true]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const BLOCOS_DE_TEXTO = /^(H[1-6]|P|LI|DT|DD|TD|TH|FIGCAPTION|LEGEND|CAPTION|BLOCKQUOTE|LABEL)$/;
  const IGNORADOS = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|svg:title|TITLE)$/;
  const TAP_MAX_MS = 300;      // entre os 2 toques
  const DESLIZE_MIN_PX = 60;
  const DESLIZE_MAX_MS = 500;
  const TOQUE_MAX_PX = 20;
  const EXPLORAR_APOS_MS = 250;      // depois disso, se o dedo anda devagar, é exploração, não deslize
  const EXPLORAR_VELOCIDADE = 0.25;  // px/ms: abaixo disso é arrastar para explorar

  const limpar = s => String(s || '').replace(/\s+/g, ' ').trim();
  const estilo = el => { try { return el.ownerDocument.defaultView.getComputedStyle(el); } catch (e) { return null; } };

  function escondido(el) {
    if (el.nodeType !== 1) return true;
    if (IGNORADOS.test(el.tagName)) return true;
    if (el.hidden || el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('inert')) return true;
    if (el.classList && el.classList.contains('foco-gestos')) return true;
    if (el.tagName === 'DIALOG' && !el.open) return true;
    const s = estilo(el);
    return !!(s && (s.display === 'none' || s.visibility === 'hidden'));
  }
  const visivel = el => el.getClientRects().length > 0;
  const regiaoViva = el => el.hasAttribute('aria-live') || /^(status|alert|log|timer|marquee)$/.test(el.getAttribute('role') || '');
  const interativo = el => el.matches(INTERATIVOS);
  const imagem = el => (el.tagName === 'IMG' && limpar(el.getAttribute('alt'))) || (el.getAttribute('role') === 'img' && limpar(el.getAttribute('aria-label')));
  const temTextoDireto = el => [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());

  /* Texto que um leitor de tela ouviria dentro de el (sem o que está escondido). */
  function texto(el, { semInterativos = false } = {}) {
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { s += n.nodeValue; continue; }
      if (n.nodeType !== 1 || escondido(n)) continue;
      if (semInterativos && interativo(n)) continue;
      if (n.tagName === 'IMG') { s += ' ' + (n.getAttribute('alt') || '') + ' '; continue; }
      if (n.getAttribute('aria-label') && !/^(DIV|SPAN)$/.test(n.tagName)) { s += ' ' + n.getAttribute('aria-label') + ' '; continue; }
      const bloco = n.ownerDocument.defaultView.getComputedStyle(n).display;
      const sep = bloco && bloco !== 'inline' && bloco !== 'contents' ? ' ' : '';
      s += sep + texto(n, { semInterativos }) + sep;
    }
    return s;
  }

  /* Janela modal aberta por cima? A leitura fica presa dentro dela. */
  function raizModal(doc) {
    const abertas = [...doc.querySelectorAll('dialog[open], [role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true]')]
      .filter(d => !escondido(d) && visivel(d))
      .filter(d => d.tagName !== 'DIALOG' || (() => { try { return d.matches(':modal'); } catch (e) { return true; } })());
    return abertas.length ? abertas[abertas.length - 1] : null;
  }

  function itensDeLeitura(raizBusca) {
    const doc = (raizBusca && raizBusca.ownerDocument) || raiz.document;
    const base = raizBusca || raizModal(doc) || doc.body;
    const saida = [];
    (function andar(el, dentroDeBloco) {
      for (const c of el.children) {
        if (escondido(c) || regiaoViva(c)) continue;
        if (interativo(c)) { if (visivel(c)) saida.push(c); continue; }
        if (imagem(c)) { if (visivel(c)) saida.push(c); continue; }
        if (dentroDeBloco) { andar(c, true); continue; }
        if (BLOCOS_DE_TEXTO.test(c.tagName) && !c.querySelector(INTERATIVOS) && visivel(c) && limpar(texto(c))) {
          if (c.tagName === 'LABEL' && (c.htmlFor || c.querySelector('input,select,textarea'))) continue; // lido junto com o campo
          saida.push(c); continue;
        }
        if (temTextoDireto(c) && visivel(c)) { saida.push(c); andar(c, true); continue; }
        andar(c, false);
      }
    })(base, false);
    return saida;
  }

  /* ---------- o que é lido: nome, tipo, estado ---------- */
  function nome(el) {
    const doc = el.ownerDocument;
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      const t = limpar(ids.split(/\s+/).map(id => { const r = doc.getElementById(id); return r ? texto(r) : ''; }).join(' '));
      if (t) return t;
    }
    const al = limpar(el.getAttribute('aria-label'));
    if (al) return al;
    if (el.labels && el.labels.length) {
      const t = limpar([...el.labels].map(l => texto(l, { semInterativos: true })).join(' '));
      if (t) return t;
    }
    if (el.tagName === 'IMG') return limpar(el.getAttribute('alt'));
    const campo = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    if (!campo) {
      const t = limpar(texto(el, { semInterativos: !interativo(el) }));
      if (t) return t;
    }
    return limpar(el.getAttribute('title')) || limpar(el.getAttribute('placeholder'));
  }

  const TEXTUAIS = /^(text|search|email|number|tel|url|password|date|time|datetime-local|month|week)$/;
  function tipo(el) {
    const papel = el.getAttribute('role');
    const tag = el.tagName;
    const t = (el.getAttribute('type') || '').toLowerCase();
    if (papel === 'switch') return 'botão de alternância';
    if (papel === 'tab') return 'aba';
    if (papel === 'checkbox' || (tag === 'INPUT' && t === 'checkbox')) return 'caixa de seleção';
    if (papel === 'radio' || (tag === 'INPUT' && t === 'radio')) return 'botão de opção';
    if (papel === 'slider' || (tag === 'INPUT' && t === 'range')) return 'controle deslizante';
    if (papel === 'combobox' || tag === 'SELECT') return 'lista suspensa';
    if (papel === 'heading' || /^H[1-6]$/.test(tag)) return 'título nível ' + (el.getAttribute('aria-level') || tag.slice(1) || 2);
    if (papel === 'img' || tag === 'IMG') return 'imagem';
    if (papel === 'link' || (tag === 'A' && el.hasAttribute('href'))) return 'link';
    if (papel === 'searchbox' || papel === 'textbox' || tag === 'TEXTAREA' || (tag === 'INPUT' && (TEXTUAIS.test(t) || !t))) return 'campo de edição';
    if (papel === 'option') return 'opção';
    if (papel === 'button' || tag === 'BUTTON' || tag === 'SUMMARY' || (tag === 'INPUT' && /^(button|submit|reset)$/.test(t))) {
      return el.hasAttribute('aria-pressed') ? 'botão de alternância' : 'botão';
    }
    return '';
  }

  function valor(el) {
    if (el.tagName === 'SELECT') { const o = el.options[el.selectedIndex]; return o ? limpar(o.text) : ''; }
    if (el.tagName === 'TEXTAREA') return limpar(el.value);
    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'password') return el.value ? 'senha preenchida' : '';
      if (TEXTUAIS.test(t) || t === 'range') return limpar(el.value);
    }
    return '';
  }

  function estados(el) {
    const e = [];
    const pressed = el.getAttribute('aria-pressed');
    if (pressed === 'true' || pressed === 'mixed') e.push('ativado'); else if (pressed === 'false') e.push('desativado');
    const marcado = el.getAttribute('aria-checked');
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/i.test(el.type)) e.push(el.checked ? (el.type === 'radio' ? 'selecionado' : 'ativado') : (el.type === 'radio' ? 'não selecionado' : 'desativado'));
    else if (marcado === 'true') e.push('ativado'); else if (marcado === 'false') e.push('desativado');
    if (el.getAttribute('aria-selected') === 'true') e.push('selecionado');
    if (el.getAttribute('aria-current') && el.getAttribute('aria-current') !== 'false') e.push('atual');
    const exp = el.getAttribute('aria-expanded');
    if (exp === 'true') e.push('expandido'); else if (exp === 'false') e.push('recolhido');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') e.push('indisponível');
    return e;
  }

  // aria-describedby vem por último, como a dica do TalkBack
  function descricao(el) {
    const ids = el.getAttribute('aria-describedby');
    if (!ids) return '';
    const doc = el.ownerDocument;
    return limpar(ids.split(/\s+/).map(id => { const r = doc.getElementById(id); return r ? texto(r) : ''; }).join(' '));
  }

  function descrever(el, descreverExtra) {
    if (!el) return '';
    if (descreverExtra) { const r = descreverExtra(el); if (r) return r; }
    return [nome(el), tipo(el), valor(el), ...estados(el), descricao(el)].filter(Boolean).join(', ');
  }

  /* ---------- sons curtos (Web Audio) ---------- */
  function criarSons(janela, ligado) {
    let ctx = null;
    const NOTAS = { mover: [880, 'sine', 0.05], ativar: [620, 'triangle', 0.07], fim: [200, 'square', 0.09] };
    return function tocar(tipoSom) {
      if (!ligado) return;
      try {
        const AC = janela.AudioContext || janela.webkitAudioContext;
        if (!AC) return;
        ctx = ctx || new AC();
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        const [f, forma, dur] = NOTAS[tipoSom] || NOTAS.mover;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = forma; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + dur + 0.02);
      } catch (e) { /* sem som */ }
    };
  }

  /* ---------- os gestos ---------- */
  function criar({ voz, documento, descreverExtra, sons = true } = {}) {
    const doc = documento || raiz.document;
    const win = doc.defaultView || raiz;
    const tocar = criarSons(win, sons);
    const sinteticos = new WeakSet();
    let ligadoFlag = false, atual = null, ponto = null, anel = null, quadro = 0;
    let modo = null;                 // null | 'um' | 'passar'
    const dedos = new Map();         // pointerId → { x0, y0, x, y, t0, duplo }
    let explorando = false, timerToque = null, posPendente = null, fimUltimoToque = 0;
    let ultimoConsumido = 0, ativando = false;
    let rolagem = null;              // { alvo, meio } com 2 dedos fora do mapa

    const agora = () => Date.now();
    const ehItem = el => itensDeLeitura().includes(el);

    // item sob o dedo: o que está por cima; dentro dele (ex.: a planta), um lugar com leitura própria tem preferência
    function itemEm(x, y) {
      const conj = new Set(itensDeLeitura());
      const modal = raizModal(doc);
      const extra = el => !!(descreverExtra && el.nodeType === 1 && descreverExtra(el) && (!modal || modal.contains(el)));
      let achado = null;
      for (const topo of doc.elementsFromPoint(x, y)) {
        if (achado && !achado.contains(topo)) continue;
        for (let a = topo; a && a !== doc.documentElement && a !== achado; a = a.parentElement) {
          if (extra(a)) return a;
          if (!achado && conj.has(a)) { achado = a; break; }
        }
        if (achado && !descreverExtra) return achado;
      }
      return achado;
    }

    /* retângulo verde */
    function desenhar() {
      quadro = 0;
      if (!anel) return;
      if (!ligadoFlag || !atual || !atual.isConnected) { anel.style.display = 'none'; return; }
      const casa = atual.closest('dialog[open]') || doc.body;
      if (anel.parentNode !== casa) casa.appendChild(anel);
      const r = atual.getBoundingClientRect();
      if (!r.width && !r.height) { anel.style.display = 'none'; return; }
      Object.assign(anel.style, { display: 'block', left: (r.left - 4) + 'px', top: (r.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' });
    }
    const redesenhar = () => { if (!quadro) quadro = (win.requestAnimationFrame || setTimeout)(desenhar); };

    function selecionar(el, { falar = true, pontoToque = null, rolar = false } = {}) {
      if (!el) return;
      atual = el; ponto = pontoToque;
      if (rolar && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* */ } }
      desenhar();
      if (falar) { tocar('mover'); if (voz && voz.falar) voz.falar(descrever(el, descreverExtra)); }
    }

    function mover(passo) {
      const lista = itensDeLeitura();
      if (!lista.length) { tocar('fim'); return; }
      const i = atual ? lista.indexOf(atual) : -1;
      if (i < 0) { selecionar(lista[0], { rolar: true }); return; }
      const j = i + passo;
      if (j < 0 || j >= lista.length) { tocar('fim'); return; }
      selecionar(lista[j], { rolar: true });
    }
    const proximo = () => mover(1);
    const anterior = () => mover(-1);

    function ativar() {
      const el = atual;
      if (!el || !el.isConnected) { tocar('fim'); return; }
      tocar('ativar');
      ativando = true;
      try {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
          el.focus();
          el.click();
          if (el.tagName === 'SELECT' && el.showPicker) { try { el.showPicker(); } catch (e) { /* */ } }
        } else if (ponto && el.closest && el.closest('svg')) {
          el.dispatchEvent(new win.MouseEvent('click', { clientX: ponto.x, clientY: ponto.y, bubbles: true, cancelable: true, view: win }));
        } else {
          el.click();
        }
      } finally { ativando = false; }
    }

    /* ---------- eventos ---------- */
    const consumir = ev => { ev.preventDefault(); ev.stopPropagation(); ultimoConsumido = agora(); };
    const deToque = ev => ev.pointerType === 'touch' && !sinteticos.has(ev);

    function semRolagemPropria(el) {
      for (let a = el; a && a.nodeType === 1; a = a.parentElement) { const s = estilo(a); if (s && s.touchAction === 'none') return true; }
      return false;
    }
    function rolavel(el) {
      for (let a = el; a && a.nodeType === 1 && a !== doc.body; a = a.parentElement) {
        const s = estilo(a);
        if (s && /(auto|scroll)/.test(s.overflowY + s.overflowX) && (a.scrollHeight > a.clientHeight || a.scrollWidth > a.clientWidth)) return a;
      }
      return doc.scrollingElement || doc.documentElement;
    }

    function passarParaAPagina() {
      modo = 'passar'; explorando = false;
      clearTimeout(timerToque); timerToque = null;
      const [id, d] = [...dedos.entries()][0];
      const alvo = doc.elementFromPoint(d.x, d.y);
      rolagem = alvo && !semRolagemPropria(alvo) ? { alvo: rolavel(alvo), meio: null } : null;
      if (!alvo) return;
      // a página não viu o 1º dedo descer: entrega a ela agora, para o mapa arrastar e dar zoom
      try {
        const ev = new win.PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: d.x, clientY: d.y, button: 0, buttons: 1, bubbles: true, cancelable: true, composed: true });
        sinteticos.add(ev);
        alvo.dispatchEvent(ev);
      } catch (e) { /* */ }
    }

    function aoBaixar(ev) {
      if (!deToque(ev)) return;
      const t = agora();
      if (dedos.size === 0) {
        const duplo = !!timerToque && t - fimUltimoToque <= TAP_MAX_MS;
        if (duplo) { clearTimeout(timerToque); timerToque = null; }
        dedos.set(ev.pointerId, { x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, t0: t, duplo, pendente: duplo ? posPendente : null });
        modo = 'um'; explorando = false;
        consumir(ev);
        return;
      }
      dedos.set(ev.pointerId, { x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, t0: t });
      if (modo === 'um') passarParaAPagina();
    }

    function aoMover(ev) {
      if (!deToque(ev)) return;
      const d = dedos.get(ev.pointerId);
      if (!d) return;
      d.x = ev.clientX; d.y = ev.clientY;
      if (modo !== 'um') return;
      consumir(ev);
      const dist = Math.hypot(d.x - d.x0, d.y - d.y0), dt = agora() - d.t0;
      if (!explorando && dist > TOQUE_MAX_PX && dt > EXPLORAR_APOS_MS && (dt > DESLIZE_MAX_MS || dist / dt < EXPLORAR_VELOCIDADE)) explorando = true;
      if (explorando) {
        const el = itemEm(d.x, d.y);
        if (el && el !== atual) selecionar(el, { pontoToque: { x: d.x, y: d.y } });
      }
    }

    function aoSoltar(ev) {
      if (!deToque(ev)) return;
      const d = dedos.get(ev.pointerId);
      dedos.delete(ev.pointerId);
      if (modo === 'passar' || !d) { if (!dedos.size) { modo = null; rolagem = null; } return; }
      consumir(ev);
      modo = null;
      if (ev.type === 'pointercancel' || explorando) { explorando = false; return; }
      const dt = agora() - d.t0, dx = d.x - d.x0, dy = d.y - d.y0;
      if (dt <= DESLIZE_MAX_MS && Math.abs(dx) >= DESLIZE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) proximo(); else anterior();
        return;
      }
      if (Math.hypot(dx, dy) > TOQUE_MAX_PX) return; // deslize vertical ou movimento sem efeito
      if (d.duplo) {
        if (!atual && d.pendente) { const el = itemEm(d.pendente.x, d.pendente.y); if (el) selecionar(el, { falar: false, pontoToque: d.pendente }); }
        ativar();
        return;
      }
      fimUltimoToque = agora();
      posPendente = { x: d.x, y: d.y };
      const pos = posPendente;
      timerToque = setTimeout(() => {
        timerToque = null;
        const el = itemEm(pos.x, pos.y);
        if (el) selecionar(el, { pontoToque: pos }); else tocar('fim');
      }, TAP_MAX_MS);
    }

    function aoTocar(ev) {
      if (modo === 'passar' || ev.touches.length >= 2) {
        if (ev.type === 'touchmove' && rolagem && ev.touches.length >= 2) {
          const [a, b] = [ev.touches[0], ev.touches[1]];
          const meio = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
          if (rolagem.meio) rolagem.alvo.scrollBy(rolagem.meio.x - meio.x, rolagem.meio.y - meio.y);
          rolagem.meio = meio;
          ev.preventDefault();
        }
        return;
      }
      if (ev.cancelable) ev.preventDefault();
      ev.stopPropagation();
      ultimoConsumido = agora();
    }

    // o clique que o navegador gera depois de um toque consumido não chega à página (o mouse e o teclado chegam)
    const cliqueDeToque = ev => ev.pointerType === 'touch' || (!ev.pointerType && agora() - ultimoConsumido < 800);
    function aoClicar(ev) {
      if (ativando || !cliqueDeToque(ev)) return;
      if (agora() - ultimoConsumido < 800) { ev.preventDefault(); ev.stopPropagation(); }
    }
    function aoMenu(ev) { if (agora() - ultimoConsumido < 800) ev.preventDefault(); }
    function aoFocar(ev) {
      if (ativando) return;
      for (let a = ev.target; a && a.nodeType === 1; a = a.parentElement) {
        if (ehItem(a)) { atual = a; ponto = null; redesenhar(); return; }
      }
    }

    const OUVINTES = [
      ['pointerdown', aoBaixar], ['pointermove', aoMover], ['pointerup', aoSoltar], ['pointercancel', aoSoltar],
      ['touchstart', aoTocar], ['touchmove', aoTocar], ['touchend', aoTocar], ['touchcancel', aoTocar],
      ['click', aoClicar], ['contextmenu', aoMenu], ['focusin', aoFocar],
      ['scroll', redesenhar], ['resize', redesenhar]
    ];

    function ligar() {
      if (ligadoFlag) return;
      ligadoFlag = true;
      for (const [tipoEv, fn] of OUVINTES) win.addEventListener(tipoEv, fn, { capture: true, passive: false });
      anel = doc.createElement('div');
      anel.className = 'foco-gestos';
      anel.setAttribute('aria-hidden', 'true');
      anel.style.display = 'none';
      doc.body.appendChild(anel);
    }
    // desligados no meio de um toque (ex.: 2 toques em "Voz"), o resto daquele toque não pode virar clique
    function engolirResto() {
      const fim = agora() + 800;
      const engolir = ev => {
        if (agora() > fim) { tirar(); return; }
        if (ev.type === 'click' && ev.pointerType !== 'touch') return;
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        if (ev.type === 'click' || !ev.touches || !ev.touches.length) tirar(); // só o resto do toque atual
      };
      const tirar = () => ['touchend', 'click'].forEach(t => win.removeEventListener(t, engolir, { capture: true }));
      ['touchend', 'click'].forEach(t => win.addEventListener(t, engolir, { capture: true, passive: false }));
      setTimeout(tirar, 800);
    }
    function desligar() {
      if (!ligadoFlag) return;
      ligadoFlag = false;
      if (dedos.size || agora() - ultimoConsumido < 800) engolirResto();
      for (const [tipoEv, fn] of OUVINTES) win.removeEventListener(tipoEv, fn, { capture: true });
      clearTimeout(timerToque); timerToque = null;
      dedos.clear(); modo = null; explorando = false; rolagem = null;
      if (anel) anel.remove();
      anel = null; atual = null; ponto = null;
    }

    return {
      ligar, desligar, ligado: () => ligadoFlag,
      selecionar: el => selecionar(el), proximo, anterior, ativar, atual: () => atual
    };
  }

  raiz.NaviGestos = { criar, descrever, itensDeLeitura };
})(typeof window !== 'undefined' ? window : globalThis);
