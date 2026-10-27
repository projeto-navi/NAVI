/* Navi — conjunto único de ícones (24 × 24, traço de 2 px, pontas arredondadas).
   Injetado no início da página para funcionar também por file://, onde <use> externo não carrega.
   Uso: <svg class="ico" aria-hidden="true"><use href="#i-busca"/></svg>
   Pictogramas de acessibilidade: visual, mobilidade (Símbolo Internacional de Acesso), auditiva, libras,
   elevador, rampa, piso tátil, sanitário acessível, plataforma, vaga PcD. Setas: d-*. */
(function (raiz) {
  'use strict';
  const T = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const T3 = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
  const C = 'fill="currentColor" stroke="none"';
  const ISA = `<circle cx="10" cy="4.2" r="1.9" ${C}/><path d="M10 7.5v6.5h5.5l2.5 5.5" ${T}/><path d="M10 10.5h5" ${T}/><path d="M7 11.2a5.6 5.6 0 1 0 8.4 6.6" ${T}/>`;
  const I = {
    // interface
    'i-busca': `<g ${T}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></g>`,
    'i-microfone': `<g ${T}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></g>`,
    'i-voltar': `<g ${T}><path d="M19 12H5M11 6l-6 6 6 6"/></g>`,
    'i-fechar': `<g ${T}><path d="M6 6l12 12M18 6 6 18"/></g>`,
    'i-inverter': `<g ${T}><path d="M8 20V5M4 9l4-4 4 4M16 4v15M12 15l4 4 4-4"/></g>`,
    'i-centralizar': `<g ${T}><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></g><circle cx="12" cy="12" r="2.4" ${C}/>`,
    'i-mais': `<g ${T}><path d="M12 5v14M5 12h14"/></g>`,
    'i-menos': `<g ${T}><path d="M5 12h14"/></g>`,
    'i-cubo': `<g ${T}><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12 4 7.5"/></g>`,
    'i-plano': `<g ${T}><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></g>`,
    'i-andares': `<g ${T}><path d="M12 3 21 8l-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></g>`,
    'i-preferencias': `<g ${T}><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></g>`,
    'i-ajuda': `<g ${T}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.8"/><path d="M5.6 5.6l3.7 3.7M14.7 14.7l3.7 3.7M18.4 5.6l-3.7 3.7M9.3 14.7l-3.7 3.7"/></g>`,
    'i-voz': `<g ${T}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></g>`,
    'i-voz-desligada': `<g ${T}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/></g>`,
    'i-pausar': `<g ${T}><path d="M9 5v14M15 5v14"/></g>`,
    'i-tocar': `<path d="M8 5.5v13l10.5-6.5z" ${T}/>`,
    'i-repetir': `<g ${T}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/></g>`,
    'i-velocidade': `<g ${T}><path d="M4.2 17a8.5 8.5 0 1 1 15.6 0"/><path d="M12 15l3.5-4.5"/></g><circle cx="12" cy="15" r="1.5" ${C}/>`,
    'i-anterior': `<g ${T}><path d="M15 5l-7 7 7 7"/></g>`,
    'i-seta-direita': `<path d="M4 12h15M13 6l6 6-6 6" ${T}/>`,
    'i-proximo': `<g ${T}><path d="M9 5l7 7-7 7"/></g>`,
    'i-para-cima': `<g ${T}><path d="M5 15l7-7 7 7"/></g>`,
    'i-para-baixo': `<g ${T}><path d="M5 9l7 7 7-7"/></g>`,
    'i-alterar': `<g ${T}><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></g>`,
    'i-lista': `<g ${T}><path d="M9 6h11M9 12h11M9 18h11"/></g><circle cx="4.5" cy="6" r="1.3" ${C}/><circle cx="4.5" cy="12" r="1.3" ${C}/><circle cx="4.5" cy="18" r="1.3" ${C}/>`,
    'i-recalcular': `<g ${T}><path d="M19.5 11A7.5 7.5 0 0 0 6.6 6.6L4.5 8.7"/><path d="M4.5 4.5v4.2h4.2"/><path d="M4.5 13a7.5 7.5 0 0 0 12.9 4.4l2.1-2.1"/><path d="M19.5 19.5v-4.2h-4.2"/></g>`,
    'i-aviso': `<g ${T}><path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5"/></g><circle cx="12" cy="17.2" r="1.25" ${C}/>`,
    'i-offline': `<g ${T}><path d="M7.5 18h9.8a3.5 3.5 0 0 0 1-6.9 6 6 0 0 0-10.8-2A4.5 4.5 0 0 0 7.5 18z"/><path d="M3 3l18 18"/></g>`,
    'i-telefone': `<path d="M6 3.5h3l1.6 4.6-2.2 1.4a10.5 10.5 0 0 0 6.1 6.1l1.4-2.2 4.6 1.6v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4 5.5a2 2 0 0 1 2-2z" ${T}/>`,
    'i-mensagem': `<path d="M4 5h16v11H10l-6 4.5z" ${T}/>`,
    'i-copiar': `<g ${T}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></g>`,
    'i-email': `<g ${T}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></g>`,
    'i-externo': `<g ${T}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></g>`,
    'i-ok': `<g ${T}><path d="M5 12.5l4.5 4.5L19 7"/></g>`,
    'i-info': `<g ${T}><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/></g><circle cx="12" cy="7.6" r="1.25" ${C}/>`,
    'i-primeira-pessoa': `<circle cx="13.5" cy="4.3" r="1.9" ${C}/><g ${T}><path d="M10 21l2.2-6.5 3 3V21M12.2 14.5 13.3 9l3.7 3.5h3M13.3 9 9.5 10.5 7.5 14"/></g>`,
    'i-cartao': `<g ${T}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/></g>`,
    'i-apagar': `<g ${T}><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/></g>`,
    'i-lugar': `<g ${T}><path d="M12 21s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></g>`,
    'i-voce': `<circle cx="12" cy="12" r="7" ${T}/><circle cx="12" cy="12" r="3" ${C}/>`,
    'i-texto': `<g ${T}><path d="M3 18l3.5-9 3.5 9M4.3 15h4.4"/><path d="M12 18l4.5-12L21 18M13.7 14h5.6"/></g>`,
    'i-contraste': `<circle cx="12" cy="12" r="8.5" ${T}/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" ${C}/>`,
    'i-cores': `<g ${T}><circle cx="8" cy="9" r="3.5"/><circle cx="16" cy="9" r="3.5"/><circle cx="12" cy="15.5" r="3.5"/></g>`,
    'i-claro': `<g ${T}><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/></g>`,
    'i-leitor': `<g ${T}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M7.5 10h2l2.5-2v6l-2.5-2h-2zM15 8.5a2.5 2.5 0 0 1 0 3"/></g>`,
    'i-escadas-off': `<g ${T}><path d="M3 20h4v-4h4v-4h4V8h5"/><path d="M4 4l16 16"/></g>`,
    'i-alca': `<path d="M8 12h8" ${T}/>`,
    // acessibilidade e perfis
    'i-visual': `<g ${T}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/></g><circle cx="12" cy="12" r="3" ${C}/>`,
    'i-mobilidade': ISA,
    'i-auditiva': `<g ${T}><path d="M7.5 9.5a5 5 0 1 1 10 0c0 3.2-3.2 4.2-3.2 7a3 3 0 0 1-5.6 1.4"/><path d="M10.5 9.6a2 2 0 1 1 4 0"/><path d="M4 4l16 16"/></g>`,
    'i-libras': `<path d="M8 13.5V6.2a1.3 1.3 0 0 1 2.6 0v5M10.6 11V4.7a1.3 1.3 0 0 1 2.6 0V11M13.2 11V5.7a1.3 1.3 0 0 1 2.6 0V12M15.8 12V8.4a1.3 1.3 0 0 1 2.6 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.5-2L4.4 15.3a1.4 1.4 0 0 1 2.1-1.9L8 15" ${T}/>`,
    'i-geral': `<g ${T}><path d="M4 12h16M14 6l6 6-6 6"/></g>`,
    // categorias de lugar
    'c-loja': `<g ${T}><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></g>`,
    'c-quiosque': `<g ${T}><path d="M4 9.5 6 4h12l2 5.5M4 9.5h16M5.5 9.5V20h13V9.5M9.5 20v-5.5h5V20"/></g>`,
    'c-entrada': `<g ${T}><path d="M10 4h9v16h-9"/><path d="M3 12h10M9.5 8l4 4-4 4"/></g>`,
    'c-saida': `<g ${T}><path d="M14 4H5v16h9"/><path d="M10 12h11M17 8l4 4-4 4"/></g>`,
    'c-emergencia': `<circle cx="15" cy="4.3" r="1.9" ${C}/><g ${T}><path d="M13.8 8 10 10l-2 4M13.8 8l1 5 3.7 2.2M13.3 12.3 10 20.5M14.3 9.2l4.2 1"/></g>`,
    'c-sanitario': `<circle cx="7.5" cy="4.3" r="1.7" ${C}/><circle cx="16.5" cy="4.3" r="1.7" ${C}/><path d="M5.5 7.5h4v6.5h-1.2v6.5H6.7V14H5.5zM14.8 7.5h3.4l2.1 7h-2v6h-3.6v-6h-2z" ${C}/><path d="M12 3v18" fill="none" stroke="currentColor" stroke-width="1.4"/>`,
    'c-sanitario_acessivel': `<rect x="2.5" y="2.5" width="19" height="19" rx="4" ${T}/><g transform="translate(2.6 2.4) scale(0.8)">${ISA}</g>`,
    'c-elevador': `<g ${T}><rect x="5" y="3" width="14" height="18" rx="1.8"/><path d="M9.5 9.5 12 7l2.5 2.5M9.5 14.5 12 17l2.5-2.5"/></g>`,
    'c-escada_rolante': `<g ${T}><path d="M3 19h4.5l9-11H21"/><path d="M3 15h3l8.2-10H21"/></g><circle cx="14" cy="11.5" r="1.5" ${C}/>`,
    'c-escada': `<g ${T}><path d="M3 20h4v-4h4v-4h4V8h4V4h2"/></g>`,
    'c-rampa': `<g ${T}><path d="M3 19h18V9z"/></g>`,
    'c-plataforma': `<g ${T}><rect x="5" y="12" width="14" height="8" rx="1.5"/><path d="M12 9V3M9 6l3-3 3 3"/></g>`,
    'c-piso_tatil': `<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" ${T}/><g ${C}><circle cx="8" cy="8" r="1.4"/><circle cx="12" cy="8" r="1.4"/><circle cx="16" cy="8" r="1.4"/><circle cx="8" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="16" cy="12" r="1.4"/><circle cx="8" cy="16" r="1.4"/><circle cx="12" cy="16" r="1.4"/><circle cx="16" cy="16" r="1.4"/></g>`,
    'c-informacao': `<g ${T}><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/></g><circle cx="12" cy="7.6" r="1.3" ${C}/>`,
    'c-estacionamento': `<g ${T}><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M9.5 17V7.5h3.2a2.7 2.7 0 0 1 0 5.4H9.5"/></g>`,
    'c-vaga_pcd': `<g ${T}><rect x="2.5" y="3" width="19" height="18" rx="2.5"/><path d="M6.5 16V7.5h2.7a2.4 2.4 0 0 1 0 4.8H6.5"/></g><g transform="translate(11 6.5) scale(0.48)">${ISA}</g>`,
    'c-caixa': `<g ${T}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14.5h4"/></g>`,
    'c-familia': `<circle cx="8" cy="4.3" r="1.8" ${C}/><circle cx="16.5" cy="9.2" r="1.5" ${C}/><path d="M6 7.8h4v6.2H8.9v6.5H7.1V14H6zM15 12h3v3.6h-.7v4.9h-1.6v-4.9H15z" ${C}/>`,
    'c-museu': `<g ${T}><path d="M3 9.5 12 4l9 5.5zM5.5 10.5v7.5M9.8 10.5v7.5M14.2 10.5v7.5M18.5 10.5v7.5M3 20.5h18"/></g>`,
    'c-administracao': `<g ${T}><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M11 21v-4h2v4"/></g>`,
    'c-sala': `<g ${T}><path d="M6 21V3.5h12V21M4 21h16"/></g><circle cx="14.8" cy="12.5" r="1.2" ${C}/>`,
    'c-laboratorio': `<g ${T}><path d="M9 3h6M10 3v6.2L5 18a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-8.8V3M7.4 15h9.2"/></g>`,
    'c-biblioteca': `<g ${T}><path d="M4.5 4h3.5v16H4.5zM10 4h3.5v16H10zM15.4 5.4l3.2-.9 3.2 14.6-3.2.9z"/></g>`,
    'c-secretaria': `<g ${T}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></g>`,
    'c-coordenacao': `<g ${T}><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.3A4.6 4.6 0 0 1 21 18.8"/></g>`,
    'c-auditorio': `<g ${T}><path d="M6 4h12v3.5H6z"/><path d="M3.5 12.5c5.5 3 11.5 3 17 0M5 17.5c4.6 2.6 9.4 2.6 14 0"/></g>`,
    'c-cantina': `<g ${T}><path d="M5 3.5v6a3 3 0 0 0 6 0v-6M8 3.5v17M16 3.5c-1.8 0-3 2.3-3 5.5s1.3 4.5 3 4.5v7"/></g>`,
    'c-outro': `<g ${T}><circle cx="12" cy="12" r="3"/></g>`,
    // setas das instruções (traço mais forte, para a placa do passo)
    'd-inicio': `<circle cx="12" cy="12" r="7.5" ${T3}/><circle cx="12" cy="12" r="3" ${C}/>`,
    'd-reto': `<g ${T3}><path d="M12 20.5V4M6 10l6-6 6 6"/></g>`,
    'd-esq': `<g ${T3}><path d="M17 20.5v-7.5a4 4 0 0 0-4-4H5M9.5 4.5 5 9l4.5 4.5"/></g>`,
    'd-dir': `<g ${T3}><path d="M7 20.5v-7.5a4 4 0 0 1 4-4h8M14.5 4.5 19 9l-4.5 4.5"/></g>`,
    'd-leve-esq': `<g ${T3}><path d="M15.5 20.5v-6L8 7M8 13.5V7h6.5"/></g>`,
    'd-leve-dir': `<g ${T3}><path d="M8.5 20.5v-6L16 7M16 13.5V7H9.5"/></g>`,
    'd-volta': `<g ${T3}><path d="M7 20.5V10a5 5 0 0 1 10 0v4.5M13 11.5l4 4 4-4"/></g>`,
    'd-chegada': `<g ${T3}><path d="M12 21s-6.8-6.1-6.8-11.7a6.8 6.8 0 0 1 13.6 0C18.8 14.9 12 21 12 21z"/></g><circle cx="12" cy="9.3" r="2.5" ${C}/>`
  };
  // marca do Navi: caminho com partida e chegada (cores vindas do tema)
  const MARCA = `<symbol id="navi-marca" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" style="fill:var(--marca-fundo, #0B4FA8)"/>` +
    `<path d="M30 96H58V70H86V54" fill="none" style="stroke:var(--marca-traco, #FFFFFF)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="86" cy="40" r="12" fill="none" style="stroke:var(--marca-destino, #FFC62E)" stroke-width="9"/></symbol>`;

  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    Object.entries(I).map(([id, c]) => `<symbol id="${id}" viewBox="0 0 24 24">${c}</symbol>`).join('') + MARCA + '</defs></svg>';

  function injetar(doc) {
    if (doc.getElementById('navi-icones')) return;
    const d = doc.createElement('div');
    d.id = 'navi-icones';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = sprite;
    doc.body.insertBefore(d, doc.body.firstChild);
  }
  /** Markup de um ícone decorativo. */
  const svg = (id, classe = 'ico') => `<svg class="${classe}" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
  const ids = Object.keys(I);

  raiz.NaviIcones = { injetar, svg, ids, temIcone: id => id in I };
  if (typeof document !== 'undefined' && document.body) injetar(document);
})(typeof window !== 'undefined' ? window : globalThis);
