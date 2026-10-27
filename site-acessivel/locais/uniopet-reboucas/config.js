/* Navi — configurações da UniOpet, Campus Rebouças (Documento 05).
   O mapa deste local ainda não existe: falta a planta baixa de cada andar e a lista de salas e serviços.
   Enquanto dadosProntos for false, o site mostra o local "em preparação" e não oferece rotas.
   Quando a planta chegar: gerar a pasta com ferramentas/dados/gerar-local.mjs, validar e mudar dadosProntos para true.

   Pendências (Documento 05):
   - [ ] Planta baixa de cada andar e quais blocos entram
   - [ ] Lista de salas, laboratórios e serviços; posição de elevadores, rampas, escadas e sanitários acessíveis
   - [ ] Contato da secretaria/atendimento e canal da manutenção para receber avisos
   - [ ] Confirmar o endereço abaixo e a autorização para divulgar o mapa */
naviLocal('uniopet-reboucas').config = {
  nome: 'UniOpet — Campus Rebouças',
  tipo: 'campus',
  cidade: 'Curitiba',
  endereco: 'Av. Presidente Getúlio Vargas, 892, Rebouças, Curitiba (a confirmar com a instituição)',
  urlSite: 'https://navi-map.netlify.app/?local=uniopet-reboucas',
  dadosProntos: false,
  fontePlanta: 'planta baixa da UniOpet',
  dataPlanta: null,
  andares: [],
  contatos: {
    ajudaNome: 'secretaria', ajudaOnde: '',
    telefone: '', telefoneLink: '', whatsapp: '', faleConosco: '', emailEquipe: ''
  },
  categoriaAjuda: 'secretaria',
  textos: {
    oLocal: 'o campus', doLocal: 'do campus', noLocal: 'no campus', aoLocal: 'ao campus',
    avisoTitulo: 'Aviso pelo Navi, mapa acessível da UniOpet — Campus Rebouças',
    elevadorEstimado: '',
    emPreparacao: 'A planta dos andares ainda vai ser adicionada.',
    preparacaoTitulo: 'O mapa do Campus Rebouças está em preparação',
    preparacaoDepois: 'Quando a planta chegar, você vai poder buscar salas, laboratórios, a biblioteca e a secretaria, com rotas sem escadas quando precisar.',
    exemploBusca: 'Sala, bloco ou serviço'
  },
  referencias: {},
  // Atalhos pedidos no Documento 05.
  atalhos: [
    ['sanitario_acessivel', 'Sanitário acessível mais próximo'], ['secretaria', 'Secretaria'], ['biblioteca', 'Biblioteca'],
    ['elevador', 'Elevador'], ['coordenacao', 'Coordenação'], ['saida', 'Saída mais próxima']
  ],
  filtros: [
    ['todos', 'Todos', []], ['salas', 'Salas', ['sala']], ['laboratorios', 'Laboratórios', ['laboratorio']],
    ['servicos', 'Serviços', ['biblioteca', 'secretaria', 'coordenacao', 'auditorio', 'cantina', 'informacao', 'elevador', 'plataforma', 'rampa', 'saida', 'entrada', 'vaga_pcd']],
    ['sanitarios', 'Sanitários', ['sanitario', 'sanitario_acessivel']]
  ],
  coresEntradas: {}
};
