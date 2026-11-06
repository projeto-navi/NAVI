/* Navi — o TalkBack (ou outro leitor de tela) do celular está ligado? (RN77)
   No app, pergunta ao plugin ScreenReader (@capacitor/screen-reader) e avisa quando muda.
   No navegador não há como saber: responde sempre "desligado" (vale a opção "Uso leitor de tela"). */
(function (raiz) {
  'use strict';

  function pluginPadrao() {
    const cap = raiz.Capacitor;
    const nativo = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    return (nativo && cap.Plugins && cap.Plugins.ScreenReader) || null;
  }

  function criar({ plugin } = {}) {
    const p = plugin || pluginPadrao();
    return {
      async ligado() {
        if (!p || typeof p.isEnabled !== 'function') return false;
        try { const r = await p.isEnabled(); return !!(r && r.value); } catch (e) { return false; }
      },
      aoMudar(cb) {
        if (!p || typeof p.addListener !== 'function') return;
        try {
          const r = p.addListener('stateChange', s => { try { cb(!!(s && s.value)); } catch (e) { /* */ } });
          if (r && r.catch) r.catch(() => {});
        } catch (e) { /* */ }
      }
    };
  }

  raiz.NaviLeitorCelular = { criar };
})(typeof window !== 'undefined' ? window : globalThis);
