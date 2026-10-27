/* Navi — Libras pelo VLibras, serviço oficial do Governo Federal. Precisa de internet:
   sem conexão, o botão avisa por texto (RN62). Carregado só quando a preferência Libras está ligada. */
(function (raiz) {
  'use strict';
  let estado = 'nao'; // nao | carregando | ok | erro

  function garantirContainer() {
    let c = document.getElementById('vlibras');
    if (!c) {
      c = document.createElement('div');
      c.id = 'vlibras';
      c.setAttribute('vw', ''); c.className = 'enabled';
      c.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
      document.body.appendChild(c);
    }
    return c;
  }
  function carregar() {
    if (estado === 'carregando' || estado === 'ok') return;
    if (raiz.navigator && raiz.navigator.onLine === false) { estado = 'erro'; return; }
    estado = 'carregando';
    garantirContainer().hidden = false;
    const s = document.createElement('script');
    s.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    s.onload = () => {
      try {
        new raiz.VLibras.Widget('https://vlibras.gov.br/app');
        estado = 'ok';
        // o widget se inicializa no evento load; se a página já carregou, dispara de novo
        if (document.readyState === 'complete') raiz.dispatchEvent(new Event('load'));
      } catch (e) { estado = 'erro'; }
    };
    s.onerror = () => { estado = 'erro'; };
    document.body.appendChild(s);
  }
  /** Abre o tradutor. Devolve a mensagem para mostrar à pessoa. */
  function abrir() {
    if (raiz.navigator && raiz.navigator.onLine === false) return 'O tradutor de Libras precisa de internet. Conecte-se e tente de novo.';
    const b = document.querySelector('[vw-access-button]');
    if (estado === 'ok' && b) { b.click(); return 'Tradutor de Libras aberto. Toque em qualquer texto para ver a tradução.'; }
    if (estado === 'carregando') return 'O tradutor de Libras está carregando. Tente de novo em alguns segundos.';
    estado = 'nao'; carregar();
    return 'Não foi possível carregar o tradutor de Libras. Verifique a conexão com a internet.';
  }
  function esconder() { const c = document.getElementById('vlibras'); if (c) c.hidden = true; }

  raiz.NaviLibras = { carregar, abrir, esconder, estado: () => estado };
})(typeof window !== 'undefined' ? window : globalThis);
