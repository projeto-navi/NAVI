/* Navi — categorias de lugar: nome, ícone e papel no mapa. Valem para todos os locais
   (shopping, campus…); cada local escolhe os atalhos e filtros no próprio config. */
(function (raiz) {
  'use strict';
  // grupo: 'lugar' (loja, sala…), 'servico', 'acessibilidade', 'equipamento' (troca de andar), 'entrada'
  const C = {
    loja: { rotulo: 'Loja', icone: 'c-loja', grupo: 'lugar' },
    quiosque: { rotulo: 'Quiosque', icone: 'c-quiosque', grupo: 'lugar' },
    entrada: { rotulo: 'Entrada', icone: 'c-entrada', grupo: 'entrada' },
    saida: { rotulo: 'Saída', icone: 'c-saida', grupo: 'servico' },
    emergencia: { rotulo: 'Saída de emergência', icone: 'c-emergencia', grupo: 'servico' },
    sanitario: { rotulo: 'Sanitários', icone: 'c-sanitario', grupo: 'servico' },
    sanitario_acessivel: { rotulo: 'Sanitário acessível', icone: 'c-sanitario_acessivel', grupo: 'acessibilidade' },
    elevador: { rotulo: 'Elevador', icone: 'c-elevador', grupo: 'equipamento', acessibilidade: true },
    plataforma: { rotulo: 'Plataforma elevatória', icone: 'c-plataforma', grupo: 'equipamento', acessibilidade: true },
    escada_rolante: { rotulo: 'Escada rolante', icone: 'c-escada_rolante', grupo: 'equipamento', escada: true },
    escada: { rotulo: 'Escada', icone: 'c-escada', grupo: 'equipamento', escada: true },
    rampa: { rotulo: 'Rampa', icone: 'c-rampa', grupo: 'acessibilidade' },
    piso_tatil: { rotulo: 'Piso tátil', icone: 'c-piso_tatil', grupo: 'acessibilidade' },
    vaga_pcd: { rotulo: 'Vaga para pessoa com deficiência', icone: 'c-vaga_pcd', grupo: 'acessibilidade' },
    informacao: { rotulo: 'Informações', icone: 'c-informacao', grupo: 'servico' },
    estacionamento: { rotulo: 'Pagamento do estacionamento', icone: 'c-estacionamento', grupo: 'servico' },
    caixa: { rotulo: 'Caixa eletrônico', icone: 'c-caixa', grupo: 'servico' },
    familia: { rotulo: 'Espaço Família', icone: 'c-familia', grupo: 'servico' },
    museu: { rotulo: 'Museu', icone: 'c-museu', grupo: 'servico' },
    administracao: { rotulo: 'Administração', icone: 'c-administracao', grupo: 'servico' },
    sala: { rotulo: 'Sala', icone: 'c-sala', grupo: 'lugar' },
    laboratorio: { rotulo: 'Laboratório', icone: 'c-laboratorio', grupo: 'lugar' },
    biblioteca: { rotulo: 'Biblioteca', icone: 'c-biblioteca', grupo: 'servico' },
    secretaria: { rotulo: 'Secretaria', icone: 'c-secretaria', grupo: 'servico' },
    coordenacao: { rotulo: 'Coordenação', icone: 'c-coordenacao', grupo: 'servico' },
    auditorio: { rotulo: 'Auditório', icone: 'c-auditorio', grupo: 'servico' },
    cantina: { rotulo: 'Cantina', icone: 'c-cantina', grupo: 'servico' }
  };
  const OUTRO = { rotulo: 'Lugar', icone: 'c-outro', grupo: 'lugar' };
  const de = cat => C[cat] || OUTRO;

  /** "Piso 1, sanitários, perto do Acesso Vermelho" — onde o lugar fica, em palavras. */
  function descricao(lugar, local) {
    const partes = [];
    const andar = local && local.andarPorPiso ? local.andarPorPiso(lugar.piso) : null;
    partes.push(andar ? andar.nome : 'Andar ' + lugar.piso);
    const cat = de(lugar.cat);
    if (!['loja', 'sala'].includes(lugar.cat) && cat !== OUTRO) partes.push(cat.rotulo.toLowerCase());
    if (lugar.cat !== 'entrada' && local) {
      const entradas = local.lugares.filter(l => l.cat === 'entrada' && l.piso === lugar.piso);
      if (entradas.length > 1) {
        const e = entradas.reduce((a, b) => Math.hypot(a.x - lugar.x, a.y - lugar.y) <= Math.hypot(b.x - lugar.x, b.y - lugar.y) ? a : b);
        partes.push('perto do ' + e.nome);
      }
    }
    if (lugar.estimado) partes.push('posição estimada');
    return partes.join(', ');
  }

  /** Ícone (ou letra inicial, para lojas e salas sem ícone próprio) no ladrilho da lista. */
  function tile(lugar, svg) {
    if (lugar.cat === 'loja' || lugar.cat === 'quiosque') {
      const letra = (lugar.nome || '?').trim().charAt(0).toUpperCase();
      return `<span class="tile tile-suave" aria-hidden="true"><span class="letra">${letra.replace(/[<>&"]/g, '')}</span></span>`;
    }
    const classe = de(lugar.cat).grupo === 'acessibilidade' || de(lugar.cat).acessibilidade ? 'tile tile-acao' : 'tile';
    return `<span class="${classe}" aria-hidden="true">${svg(de(lugar.cat).icone)}</span>`;
  }

  const api = {
    de, descricao, tile,
    rotulo: cat => de(cat).rotulo,
    icone: cat => de(cat).icone,
    ehEscada: cat => !!de(cat).escada,
    ehEquipamento: cat => de(cat).grupo === 'equipamento',
    noMapaComoIcone: cat => !['loja', 'quiosque', 'entrada', 'administracao', 'sala', 'laboratorio'].includes(cat),
    ehAcessibilidade: cat => de(cat).grupo === 'acessibilidade' || !!de(cat).acessibilidade
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.NaviCategorias = api;
})(typeof window !== 'undefined' ? window : globalThis);
