/* Navi — voz do site e anúncios.
   - anunciar(): UMA região aria-live por página (RN35); com a voz ligada, também fala (RN26).
   - Quem marcou "uso leitor de tela" nunca ouve a voz do site: os avisos vão só pelo leitor (RN28).
   - Pausar, repetir e velocidade (RN27). Perfil auditivo ou Libras: também mostra o aviso na tela e vibra. */
(function (raiz) {
  'use strict';
  const VEL = { devagar: 0.8, normal: 1, rapido: 1.25 };
  const NOME_VEL = { devagar: 'Devagar', normal: 'Normal', rapido: 'Rápida' };

  function criar({ regiao, avisoEl, prefs }) {
    const sintese = raiz.speechSynthesis || null;
    const temVoz = !!(sintese && raiz.SpeechSynthesisUtterance);
    let ultima = '', importante = false, pausada = false, timerAviso = null;
    const ouvintes = new Set();
    const avisar = () => ouvintes.forEach(fn => { try { fn(); } catch (e) { /* */ } });

    function podeFalar(forcar) {
      const p = prefs();
      return temVoz && !p.leitorDeTela && (p.voz || forcar);
    }
    function falar(texto, opcoes = {}) {
      if (!texto || !podeFalar(opcoes.forcar)) return false;
      // leitura do foco não interrompe uma orientação que ainda está sendo falada
      if (opcoes.baixa && importante && sintese.speaking) return false;
      ultima = texto; importante = !opcoes.baixa; pausada = false;
      try {
        sintese.cancel();
        const u = new raiz.SpeechSynthesisUtterance(texto);
        u.lang = 'pt-BR';
        const vozes = sintese.getVoices();
        const v = vozes.find(x => /pt[-_]BR/i.test(x.lang)) || vozes.find(x => /^pt/i.test(x.lang));
        if (v) u.voice = v;
        u.rate = VEL[prefs().velocidade] || 1;
        u.onend = () => { importante = false; avisar(); };
        sintese.speak(u);
      } catch (e) { return false; }
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
    function pausar() { if (temVoz && sintese.speaking && !pausada) { sintese.pause(); pausada = true; avisar(); } }
    function continuar() { if (temVoz && pausada) { sintese.resume(); pausada = false; avisar(); } }
    function repetir() { if (ultima) falar(ultima, { forcar: true }); }
    function cancelar() { if (temVoz) { sintese.cancel(); pausada = false; importante = false; avisar(); } }

    return {
      temVoz, falar, anunciar, avisoVisual, pausar, continuar, repetir, cancelar,
      get pausada() { return pausada; },
      get ultima() { return ultima; },
      aoMudar: fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); },
      VELOCIDADES: Object.keys(VEL), NOME_VEL
    };
  }

  raiz.NaviVoz = { criar, VEL, NOME_VEL };
})(typeof window !== 'undefined' ? window : globalThis);
