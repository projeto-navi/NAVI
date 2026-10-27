/* Navi — configurações do Shopping Estação. A equipe pode editar este arquivo sem mexer no resto do código.
   Lugares podem ser citados pelo id novo (ex.: SHE_P01_L0002) ou pelo id antigo (ex.: 1-1401928). */
naviLocal('shopping-estacao').config = {
  nome: 'Shopping Estação',
  tipo: 'shopping',
  cidade: 'Curitiba',
  // Endereço público do site (usado no QR Code da maquete e na prévia do WhatsApp).
  urlSite: 'https://navi-map.netlify.app/',
  dadosProntos: true,
  // Selo das rotas (RN19): de onde vem a planta e de quando ela é.
  fontePlanta: 'planta oficial do shopping (Mapa Mall)',
  dataPlanta: '2026-10-19',
  // Canais oficiais do shopping (site shoppingestacao.com.br, página Fale Conosco).
  contatos: {
    ajudaNome: 'SAC', ajudaOnde: 'no Piso 1',
    telefone: '(41) 3094-5300', telefoneLink: '+554130945300',
    whatsapp: '554187391485',
    faleConosco: 'https://shoppingestacao.com.br/fale-conosco/',
    // E-mail da equipe do mapa Navi. Preencha para os avisos também chegarem até vocês.
    emailEquipe: ''
  },
  // Lugar de referência para "Ver rota até o SAC" (categoria dos lugares de atendimento).
  categoriaAjuda: 'informacao',
  textos: {
    oLocal: 'o shopping', doLocal: 'do shopping', noLocal: 'no shopping', aoLocal: 'ao shopping',
    avisoTitulo: 'Aviso pelo Navi, mapa acessível do Shopping Estação',
    elevadorEstimado: 'A posição do elevador no Piso 1 foi estimada a partir da planta do Piso 2. Confirme com o SAC se o elevador está funcionando.',
    historico3d: 'Museu Ferroviário (antiga estação)',
    historico3dLongo: 'Museu Ferroviário — antigo prédio da estação',
    exemploBusca: 'Nome da loja ou do serviço'
  },
  // Como os lugares aparecem nas instruções ("siga até perto do Museu Ferroviário").
  referencias: { museu: 'do Museu Ferroviário' },
  // Atalhos "mais próximo" da tela "Para onde você vai?" (RN12, RN57): [categoria, texto do botão].
  atalhos: [
    ['sanitario', 'Sanitário mais próximo'], ['informacao', 'SAC'], ['saida', 'Saída mais próxima'],
    ['elevador', 'Elevador'], ['caixa', 'Caixa eletrônico'], ['familia', 'Espaço Família']
  ],
  // Filtros da lista de lugares: [id, texto, categorias] (lista vazia = todas).
  filtros: [
    ['todos', 'Todos', []], ['lojas', 'Lojas', ['loja']], ['quiosques', 'Quiosques', ['quiosque']],
    ['servicos', 'Serviços', ['informacao', 'saida', 'elevador', 'escada_rolante', 'estacionamento', 'caixa', 'familia', 'museu', 'emergencia', 'entrada', 'administracao']],
    ['sanitarios', 'Sanitários', ['sanitario']]
  ],
  // Cor das placas de cada entrada (as entradas do shopping têm nome de cor).
  coresEntradas: { '1-1401928': '#1F5FBF', '1-1401930': '#1E8A4C', '1-1401929': '#C62828' }
};
