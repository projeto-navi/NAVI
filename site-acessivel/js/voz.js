/* Navi — voz do site e anúncios.
   - anunciar(): UMA região aria-live por página (RN35); com a voz ligada, também fala (RN26).
   - Quem marcou "uso leitor de tela" nunca ouve a voz do site: os avisos vão só pelo leitor (RN28).
   - Pausar, repetir e velocidade (RN27). Perfil auditivo ou Libras: também mostra o aviso na tela e vibra.
   - Motor de voz: no app, a voz do Android (plugin TextToSpeech, RN78); no navegador, speechSynthesis.
   - TalkBack do celular ligado (RN77): o Navi não fala; a região aria-live continua recebendo os avisos. */
(function (raiz) {
  'use strict';
  const VEL = { devagar: 0.8, normal: 1, rapido: 1.25 };
  const NOME_VEL = { devagar: 'Devagar', normal: 'Normal', rapido: 'Rápida' };
  const NENHUM = { tipo: 'nenhum', falar() {}, parar() {} };

  function motorNativo(tts) {
    return {
      tipo: 'nativo',
      falar(texto, { rate, aoTerminar }) {
        let p;
        try { p = tts.speak({ text: texto, lang: 'pt-BR', rate, queueStrategy: 0 }); } catch (e) { p = null; }
        if (p && typeof p.then === 'function') p.then(aoTerminar, aoTerminar); else if (aoTerminar) setTimeout(aoTerminar, 0);
      },
      parar() { try { const p = tts.stop(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* */ } }
      // sem pausar/continuar: a voz do Android não pausa no meio da frase
    };
  }

  function motorNavegador(r) {
    const s = r.speechSynthesis;
    return {
      tipo: 'navegador',
      falar(texto, { rate, aoTerminar }) {
        s.cancel();
        const u = new r.SpeechSynthesisUtterance(texto);
        u.lang = 'pt-BR';
        const vozes = (s.getVoices && s.getVoices()) || [];
        const v = vozes.find(x => /pt[-_]BR/i.test(x.lang)) || vozes.find(x => /^pt/i.test(x.lang));
        if (v) u.voice = v;
        u.rate = rate;
        u.onend = aoTerminar;
        s.speak(u);
      },
      parar() { s.cancel(); },
      pausar() { if (s.speaking) { s.pause(); return true; } return false; },
      continuar() { s.resume(); }
    };
  }

  function motorPadrao(r) {
    r = r || raiz;
    const cap = r.Capacitor;
    const nativo = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    if (nativo && cap.Plugins && cap.Plugins.TextToSpeech) return motorNativo(cap.Plugins.TextToSpeech);
    if (r.speechSynthesis && r.SpeechSynthesisUtterance) return motorNavegador(r);
    return NENHUM;
  }

  function criar({ regiao, avisoEl, prefs, motor }) {
    const m = motor || motorPadrao(raiz);
    const temVoz = m.tipo !== 'nenhum';
    let ultima = '', importante = false, pausada = false, timerAviso = null;
    let falando = false, vez = 0, leitorCelular = false;
    const ouvintes = new Set();
    const avisar = () => ouvintes.forEach(fn => { try { fn(); } catch (e) { /* */ } });

    function podeFalar(forcar) {
      const p = prefs();
      return temVoz && !leitorCelular && !p.leitorDeTela && (p.voz || forcar);
    }

    function falar(texto, opcoes = {}) {
      if (!texto || !podeFalar(opcoes.forcar)) return false;
      // Fala de baixa prioridade (ex.: foco) não interrompe uma instrução importante em andamento.
      if (opcoes.baixa && importante && falando) return false;
      ultima = texto; importante = !opcoes.baixa; pausada = false;
      const minha = ++vez;
      falando = true;
      try {
        m.falar(texto, {
          rate: VEL[prefs().velocidade] || 1,
          aoTerminar: () => { if (minha !== vez) return; falando = false; importante = false; avisar(); }
        });
      } catch (e) { falando = false; return false; }
      avisar();
      return true;
    }

    function anunciar(msg, opcoes = {}) {
      if (!msg) return;
      if (regiao) { regiao.textContent = ''; setTimeout(() => { regiao.textContent = msg; }, 40); }
      if (opcoes.falar !== false) falar(msg);
      const p = prefs();
      if (opcoes.visual !== false && (p.perfil === 'auditiva' || p.libras)) avisoVisual(msg);
    }
    function avisoVisual(msg) {
      if (!avisoEl) return;
      avisoEl.textContent = msg; avisoEl.hidden = false;
      if (raiz.navigator && raiz.navigator.vibrate) { try { raiz.navigator.vibrate([120, 60, 120]); } catch (e) { /* */ } }
      clearTimeout(timerAviso);
      timerAviso = setTimeout(() => { avisoEl.hidden = true; }, 4500);
    }

    function parado() { vez++; falando = false; importante = false; }
    function pausar() {
      if (!temVoz || pausada) return;
      if (m.pausar) { if (m.pausar()) { pausada = true; avisar(); } return; }
      if (falando) { m.parar(); parado(); pausada = true; avisar(); }
    }
    function continuar() {
      if (!temVoz || !pausada) return;
      if (m.continuar) { m.continuar(); pausada = false; avisar(); return; }
      pausada = false;
      if (!falar(ultima, { forcar: true })) avisar();
    }
    function repetir() { if (ultima) falar(ultima, { forcar: true }); }
    function cancelar() { if (temVoz) { m.parar(); parado(); pausada = false; avisar(); } }

    function definirLeitorCelular(ligado) {
      leitorCelular = !!ligado;
      if (leitorCelular && temVoz) { m.parar(); parado(); pausada = false; }
      avisar();
    }

    return {
      temVoz, falar, anunciar, avisoVisual, pausar, continuar, repetir, cancelar, definirLeitorCelular,
      get motor() { return m.tipo; },
      get pausada() { return pausada; },
      get pausadaPeloLeitor() { return leitorCelular; },
      get ultima() { return ultima; },
      aoMudar: fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); },
      VELOCIDADES: Object.keys(VEL), NOME_VEL
    };
  }

  raiz.NaviVoz = { criar, motorPadrao, VEL, NOME_VEL };
})(typeof window !== 'undefined' ? window : globalThis);
