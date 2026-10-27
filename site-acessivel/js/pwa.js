/* Navi — instalação e uso sem internet (PWA).
   - O service worker só é registrado em https ou localhost, nunca por file://.
   - "Nova versão disponível" aparece só na Página de Rota; na Página do Mapa a versão nova
     entra no próximo carregamento, para nunca recarregar no meio de uma rota.
   - Indicador de sem internet, em texto (não só por cor, RN38). */
(function (raiz) {
  'use strict';
  const podeRegistrar = () => 'serviceWorker' in navigator &&
    (location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname));
  let registro = null;

  /**
   * @param {object} o
   * @param {boolean} [o.oferecerAtualizacao] mostra o aviso de nova versão (só na Página de Rota)
   * @param {(html: string|null) => void} [o.mostrarAtualizacao]
   */
  async function iniciar(o = {}) {
    if (!podeRegistrar()) return null;
    try {
      registro = await navigator.serviceWorker.register('sw.js');
    } catch (e) { return null; }
    if (o.oferecerAtualizacao) {
      const avisar = () => { if (registro.waiting && navigator.serviceWorker.controller && o.mostrarAtualizacao) o.mostrarAtualizacao(registro.waiting); };
      avisar();
      registro.addEventListener('updatefound', () => {
        const novo = registro.installing;
        if (novo) novo.addEventListener('statechange', () => { if (novo.state === 'installed') avisar(); });
      });
    }
    return registro;
  }
  /** Aplica a versão nova (o service worker em espera assume e a página recarrega). */
  function aplicarAtualizacao(sw) {
    if (!sw) return;
    let recarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recarregou) { recarregou = true; location.reload(); } });
    sw.postMessage({ tipo: 'ativar-agora' });
  }

  /** Mostra e esconde o indicador "Sem internet" dentro de el. */
  function indicadorRede(el, texto) {
    if (!el) return;
    const svg = id => raiz.NaviIcones.svg(id);
    const atualizar = () => {
      const off = navigator.onLine === false;
      el.hidden = !off;
      el.innerHTML = off ? `<p class="status-rede" role="status">${svg('i-offline')}<span>${texto || 'Sem internet. A rota e o passo a passo continuam funcionando.'}</span></p>` : '';
    };
    raiz.addEventListener('online', atualizar);
    raiz.addEventListener('offline', atualizar);
    atualizar();
  }

  raiz.NaviPWA = { iniciar, aplicarAtualizacao, indicadorRede, podeRegistrar };
})(typeof window !== 'undefined' ? window : globalThis);
