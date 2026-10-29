/* Navi — configurações do prédio comercial de testes (testes kaizen das rotas acessíveis).
   Prédio fictício, criado pela equipe para testar piso tátil, braille, elevadores, rampa e interdições.
   Não tem telefone nem WhatsApp: a ajuda é a Recepção do 1º andar. */
naviLocal('predio-teste').config = {
  nome: 'Prédio comercial de testes',
  tipo: 'predio',
  cidade: 'Curitiba',
  urlSite: 'https://navi-map.netlify.app/',
  dadosProntos: true,
  // Selo das rotas (RN19): de onde vem a planta e de quando ela é.
  fontePlanta: 'planta de testes da equipe Navi (prédio fictício)',
  dataPlanta: '2026-10-29',
  contatos: {
    ajudaNome: 'Recepção', ajudaOnde: 'no 1º andar, ao lado da entrada',
    telefone: '', telefoneLink: '', whatsapp: '', faleConosco: '',
    // E-mail da equipe do mapa Navi. Preencha para os avisos também chegarem até vocês.
    emailEquipe: ''
  },
  // Lugar de referência para "Ver rota até a Recepção".
  categoriaAjuda: 'informacao',
  textos: {
    oLocal: 'o prédio', doLocal: 'do prédio', noLocal: 'no prédio', aoLocal: 'ao prédio',
    avisoTitulo: 'Aviso pelo Navi, mapa acessível do prédio comercial de testes',
    exemploBusca: 'Nome da sala ou do serviço'
  },
  // Como os lugares aparecem nas instruções ("siga até perto da Recepção").
  referencias: { informacao: 'da Recepção', escada: 'da escada', sanitario_acessivel: 'do sanitário acessível', cantina: 'do refeitório' },
  // Atalhos "mais próximo" (RN12, RN57): [categoria, texto do botão].
  atalhos: [
    ['sanitario_acessivel', 'Sanitário acessível'], ['informacao', 'Recepção'], ['elevador', 'Elevador'],
    ['rampa', 'Rampa'], ['escada', 'Escada'], ['cantina', 'Refeitório']
  ],
  // Filtros da lista de lugares: [id, texto, categorias] (lista vazia = todas).
  filtros: [
    ['todos', 'Todos', []], ['salas', 'Salas e lojas', ['sala', 'loja', 'auditorio', 'administracao', 'cantina']],
    ['acessibilidade', 'Acessibilidade', ['elevador', 'rampa', 'escada', 'sanitario_acessivel']],
    ['servicos', 'Serviços', ['informacao', 'entrada']]
  ],
  // Modelo 3D (.glb) do local: a planta usa 20 unidades por metro e fica deslocada (8 m, 1 m) do modelo.
  modelo3d: { arquivo: 'modelo.glb', unidadesPorMetro: 20, deslocamento: [8, 1], alturaAndar: 3 }
};
