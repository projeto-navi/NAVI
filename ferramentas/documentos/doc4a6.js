const { p, h1, h2, ul, ol, nota, tabela, imagem, capa, gerar } = require('./lib');
const OUT = require('path').resolve(__dirname, '../../documentos') + '/';
// Uso: node doc4a6.js [04] [05] [06]  — sem argumentos, gera os três.
const SO = process.argv.slice(2);

/* ================= 4. REGRAS DE NEGÓCIO ================= */
// I = implementada · P = parcial · A = a implementar
const RN = [
  ['Entrada e perfil', [
    ['RN01', 'Na primeira visita, a Página de Rota pergunta "Deseja ouvir as instruções em voz alta?", com "Sim" e "Não", antes da escolha de perfil. A resposta fica guardada no aparelho; a pergunta não volta nas visitas seguintes e nunca aparece na Página do Mapa.', 'P'],
    ['RN02', 'O perfil é escolhido entre deficiência visual, mobilidade reduzida e deficiência auditiva; também existe a opção de seguir sem adaptações.', 'I'],
    ['RN03', 'No perfil visual, e em qualquer perfil no celular, a Página de Rota abre direto em "Para onde você vai?", com o campo de busca pronto.', 'I'],
    ['RN04', 'No perfil de mobilidade, a rota nunca usa escada ou escada rolante; a troca de piso é pelo elevador.', 'I'],
    ['RN05', 'No perfil auditivo, o tradutor VLibras fica disponível e todas as orientações aparecem por escrito.', 'I'],
    ['RN06', 'O perfil é um atalho: a pessoa pode combinar adaptações (evitar escadas, ouvir instruções, Libras, texto maior, alto contraste) ao mesmo tempo.', 'A'],
    ['RN07', 'O site lembra as escolhas no próprio aparelho (perfil, voz, contraste, texto, vista 2D/3D) e oferece um botão para apagá-las. Nenhum dado é enviado.', 'P']
  ]],
  ['Origem e destino', [
    ['RN08', 'Toda rota tem um ponto de partida e um destino.', 'I'],
    ['RN09', 'Na Página de Rota, a partida é escolhida pelos botões das entradas, pela busca ou pelo link do QR Code. Na Página do Mapa, a partida só muda por "Alterar" ou "Inverter".', 'P'],
    ['RN10', 'Na Página do Mapa, tocar num lugar abre um cartão com o nome, o andar e "Ir para cá"; "Ir para cá" troca o destino e recalcula ali mesmo. Tocar nunca troca de página sozinho.', 'P'],
    ['RN11', 'A busca ignora acentos e maiúsculas, aceita parte do nome e também funciona falando ("Buscar falando").', 'I'],
    ['RN12', 'Ao pedir uma categoria (sanitário, SAC, saída, elevador, caixa, Espaço Família), o site leva ao local mais próximo que não esteja interditado.', 'I'],
    ['RN13', 'Um botão inverte partida e destino e recalcula a rota na hora.', 'I']
  ]],
  ['Cálculo da rota', [
    ['RN14', 'A rota é o caminho mais curto possível dentro das restrições ativas.', 'I'],
    ['RN15', 'Com "evitar escadas" ativo, a rota nunca usa escada rolante nem escada.', 'I'],
    ['RN16', 'Local com aviso de interdição sai de todas as rotas; elevador com defeito bloqueia as portas de todos os pisos.', 'I'],
    ['RN17', 'Sem caminho acessível, o site não inventa rota: informa "Não encontramos caminho acessível confirmado", o motivo e o contato do SAC.', 'P'],
    ['RN18', 'A rota passa pelo meio dos corredores, sem atravessar quiosques nem encostar nas lojas.', 'I'],
    ['RN19', 'Toda rota exibe o selo "Rota demonstrativa, não verificada no local", com a data da planta usada.', 'A']
  ]],
  ['Instruções', [
    ['RN20', 'Toda rota tem uma versão completa só em texto, passo a passo, que pode ser seguida sem o mapa.', 'P'],
    ['RN21', 'Cada passo informa direção, ponto de referência e distância (em metros após a escala da planta ser confirmada).', 'P'],
    ['RN22', 'Passos seguidos na mesma direção são unidos em um só.', 'I'],
    ['RN23', 'Na troca de piso, a instrução diz qual meio usar (elevador ou escada rolante) e o que fazer ao sair.', 'I'],
    ['RN24', 'O último passo diz de que lado fica o destino (esquerda, direita ou frente).', 'I'],
    ['RN25', 'Cada passo tem "Anterior", "Próximo" e "Repetir" no bottom sheet; "Alterar destino" e "Recalcular" ficam no estado expandido.', 'P']
  ]],
  ['Voz e áudio', [
    ['RN26', 'A voz fala em português do Brasil e só é ativada se a pessoa aceitar.', 'I'],
    ['RN27', 'Com a voz ligada, ficam sempre visíveis os controles "Pausar", "Repetir" e "Velocidade".', 'A'],
    ['RN28', 'O site não fala por cima do leitor de tela: para quem usa TalkBack ou NVDA, os avisos vão só pelo leitor.', 'A'],
    ['RN29', 'A pergunta inicial diz que a voz lê instruções ("ouvir as instruções em voz alta"), não que obedece a comandos.', 'A']
  ]],
  ['Interface acessível', [
    ['RN30', 'Todo cartão clicável (local, resultado, passo, perfil, aviso) é um botão de verdade, com nome claro, sem role que apague o papel de botão, para o TalkBack e o teclado interagirem.', 'P'],
    ['RN31', 'Todo botão só com ícone tem nome acessível (ex.: "Aproximar", "Inverter origem e destino"); o ícone fica oculto do leitor de tela.', 'I'],
    ['RN32', 'Todo campo tem rótulo visível ligado a ele; texto de exemplo (placeholder) não conta como rótulo.', 'P'],
    ['RN33', 'Toda janela recebe o foco ao abrir, fecha com Esc e devolve o foco ao botão que a abriu.', 'P'],
    ['RN34', 'O site funciona só com teclado, sem armadilha de foco, com foco sempre visível.', 'P'],
    ['RN35', 'Ao abrir a Página do Mapa, o foco vai para o título "Rota até <destino>" e um único anúncio diz "Rota calculada: N passos. Passo 1: …". Também são anunciados: piso ativo, vista 3D, chegada.', 'I'],
    ['RN36', 'O mapa visual sempre tem alternativa em texto: passo a passo e lista de locais do piso.', 'P'],
    ['RN37', 'Cada página tem título próprio (<title> e h1) e o link "Pular para o conteúdo".', 'I'],
    ['RN38', 'Nenhuma informação depende só de cor (o destino tem cor, ícone e texto).', 'I'],
    ['RN39', 'Contraste mínimo de 4,5:1 no texto e 3:1 em ícones e bordas; modo alto contraste sempre disponível.', 'P']
  ]],
  ['Visual e celular', [
    ['RN40', 'Toda área de toque tem pelo menos 48 × 48 px, com pelo menos 8 px entre áreas, nas duas páginas.', 'A'],
    ['RN41', 'O texto pode ser aumentado (A+) até 200% sem quebrar o layout nem criar rolagem lateral.', 'P'],
    ['RN42', 'No celular, a Página do Mapa mostra o passo atual num painel inferior (bottom sheet) com "Anterior", "Próximo" e "Repetir" perto do polegar; deitado ou a partir de 768 px, o painel fica à esquerda.', 'A'],
    ['RN43', 'O layout funciona de 320 px de largura em diante, deitado ou em pé, com A+ e com zoom de 200% do navegador, sem rolagem lateral.', 'P'],
    ['RN44', 'O site respeita "reduzir movimento" do sistema: sem animações automáticas.', 'I']
  ]],
  ['Mapa, 3D e primeira pessoa', [
    ['RN45', 'O mapa 2D é o padrão; 3D e primeira pessoa são opcionais e só carregam quando pedidos.', 'I'],
    ['RN46', 'O mapa segue a planta real do local e mostra por escrito o piso ativo.', 'I'],
    ['RN47', 'Na primeira pessoa, o destino aparece em destaque, há aviso de troca de piso, mensagem de chegada e botão "Sair".', 'I'],
    ['RN48', 'Rota, piso e destino continuam os mesmos ao alternar entre 2D, 3D e primeira pessoa.', 'I']
  ]],
  ['Avisos de interdição', [
    ['RN49', 'Qualquer pessoa pode avisar que um local está interditado, danificado ou com obstáculo, com descrição opcional.', 'I'],
    ['RN50', 'O aviso feito pela pessoa vale na hora, no aparelho dela; avisos confirmados pela equipe valem para todos.', 'I'],
    ['RN51', 'O aviso é enviado ao local pelos canais oficiais (WhatsApp, telefone, Fale Conosco) com o texto pronto; nada é enviado sem a pessoa confirmar.', 'I'],
    ['RN52', 'Cada aviso mostra a data, para a pessoa saber se a informação é recente.', 'I']
  ]],
  ['Ajuda e segurança', [
    ['RN53', 'Um botão "Pedir ajuda" fica a no máximo 2 toques de qualquer tela, com o contato do SAC e a rota até ele.', 'A'],
    ['RN54', 'O site avisa que não deve ser usado em emergências; vale a sinalização e a equipe do local.', 'A'],
    ['RN55', 'O site não pede cadastro nem dados pessoais.', 'I']
  ]],
  ['Fluxo no celular', [
    ['RN56', 'No celular, a Página de Rota pede o destino primeiro e depois a entrada. Tocar na entrada abre a Página do Mapa. No máximo 3 toques da tela "Para onde você vai?" até o mapa.', 'I'],
    ['RN57', 'No celular, os atalhos "mais próximo" aparecem na tela de destino; sem partida definida, o site pergunta a entrada e calcula sozinho.', 'I'],
    ['RN58', 'Cada página tem layout de celular e de computador, testados separadamente; o celular é desenhado primeiro.', 'P']
  ]],
  ['Duas páginas, links e uso sem internet', [
    ['RN59', 'Links e QR Codes: com origem e destino abrem a Página do Mapa; só com origem abrem a Página de Rota com a partida preenchida; o endereço antigo index.html?origem=&destino= leva ao mapa com os mesmos dados.', 'A'],
    ['RN60', 'A Página do Mapa aberta sem origem ou destino válidos volta para a Página de Rota com "Escolha para onde você vai".', 'A'],
    ['RN61', 'A troca de página acontece só ao ativar um botão cujo nome avisa (ex.: "Acesso Azul — ver a rota"); digitar ou mover o foco nunca troca de página.', 'A'],
    ['RN62', 'Depois da primeira visita, o site abre, busca, calcula a rota e mostra o passo a passo sem internet. Libras e "Buscar falando" avisam por texto que precisam de internet.', 'A']
  ]]
];
const NOME = { I: 'Implementada', P: 'Parcial', A: 'A implementar' };
const todas = RN.flatMap(g => g[1]);
const conta = k => todas.filter(r => r[2] === k).length;

const doc4 = [
  capa('04', 'Regras de negócio', 'O que o protótipo base do Navi deve sempre cumprir', 'listar as regras que valem para qualquer local onde o Navi for implantado, com a situação de cada uma no site atual. Toda mudança no produto deve respeitar ou atualizar esta lista.', '1.1 — 27/10/2026'),
  h1('Resumo'),
  p(`São **${todas.length} regras** em ${RN.length} grupos. No site atual (navi-map.netlify.app, versão de 26/10/2026, auditada na Fase 0 em 27/10/2026):`),
  ...tabela([2, 1], ['Situação', 'Quantidade'], [
    ['Implementada', String(conta('I'))], ['Parcial', String(conta('P'))], ['A implementar', String(conta('A'))]
  ]),
  nota('**Como ler:** "Implementada" = funciona hoje em todos os perfis. "Parcial" = funciona em parte (por exemplo, só no celular ou só no perfil visual). "A implementar" = prevista no Plano de Melhorias e no portfólio.'),
  nota('**Duas páginas:** as regras que citam a Página de Rota e a Página do Mapa descrevem a estrutura do Marco 1. A situação mede o comportamento no site atual, que ainda tem uma página só.'),
  ...RN.flatMap(([grupo, regras]) => [h2(grupo), ...tabela([0.6, 4.2, 1.1], ['ID', 'Regra', 'Situação'], regras.map(r => [`**${r[0]}**`, r[1], NOME[r[2]]]))]),
  h1('Histórico de versões'),
  ...tabela([0.8, 1.1, 4], ['Versão', 'Data', 'O que mudou'], [
    ['1.1', '27/10/2026', 'Fase 0 aprovada por Design e Negócios e pelo Líder Técnico. Texto novo em RN01, RN03, RN09, RN10, RN25, RN30, RN35, RN37, RN40, RN42, RN43, RN56 e RN58; regras novas RN59–RN62. Pela auditoria, RN01, RN30 e RN43 passaram de Implementada para Parcial; RN09, RN10 e RN58 também, porque o texto novo ainda não está no site; RN40 e RN42 passaram para A implementar.'],
    ['1.0', '26/10/2026', 'Primeira versão, com 58 regras.']
  ]),
  h1('Como alterar uma regra'),
  ol([
    'Proponha a mudança na revisão da onda, dizendo qual regra muda e por quê.',
    'Design e Negócios e o Líder Técnico aprovam.',
    'Atualize este documento (texto e situação) antes de desenvolver.',
    'Na entrega, confira a regra na definição de pronto (Documento 03).'
  ], 'n2')
];

/* ================= 5. PLANO DE IMPLANTAÇÃO — UNIOPET ================= */
const doc5 = [
  capa('05', 'Plano de implantação — UniOpet', 'Levar o Navi a um campus universitário em Curitiba', 'planejar a chegada do Navi à UniOpet: etapas, prazos, responsáveis, o que precisa mudar no produto e os riscos, com o objetivo de colocar o mapa em uso no 1º semestre de 2027.'),
  h1('Contexto'),
  ...tabela([1.2, 3], null, [
    ['**Local**', 'UniOpet — instituição de ensino superior em Curitiba'],
    ['**Prédio**', 'Dois ou mais andares (quantidade exata e blocos a confirmar na visita)'],
    ['**Contato na UniOpet**', 'Já existe — nome e cargo: ____________________'],
    ['**Planta baixa**', 'Ainda não temos; será obtida com a instituição ou levantada na visita'],
    ['**Prazo**', 'Navi em uso no 1º semestre de 2027'],
    ['**Responsável pela relação**', 'Camilly (Design e Negócios); apoio técnico de Leonardo']
  ], { zebra: false }),

  h1('Objetivo e escopo'),
  p('**Objetivo:** que estudantes, professores, funcionários e visitantes com deficiência encontrem sozinhos salas, laboratórios e serviços da UniOpet, com rotas sem escadas quando precisarem.'),
  h2('Dentro do escopo'),
  ul([
    'Mapa de todos os andares do(s) prédio(s) acordado(s) com a UniOpet, com salas, laboratórios, biblioteca, secretaria, coordenações, auditório, cantina, sanitários (incluindo os acessíveis), elevadores, rampas e escadas.',
    'Rotas acessíveis entre andares, pelo elevador ou rampas.',
    'Todos os recursos atuais: voz, Libras, alto contraste, passo a passo, avisos de interdição e versão de celular.',
    'QR Codes nas entradas e nos pontos principais, abrindo o mapa já com a partida.',
    'Testes com pessoas com deficiência da comunidade acadêmica.'
  ]),
  h2('Fora do escopo (nesta fase)'),
  ul([
    'Localização automática da pessoa (GPS interno, beacons).',
    'Integração com horários de aula ou sistemas internos da UniOpet.',
    'Aplicativo nativo para celular.'
  ]),

  h1('O que muda no Navi para a UniOpet'),
  ...tabela([1.4, 3], ['Mudança', 'Por quê / como'], [
    ['Vários locais na mesma base', 'Hoje os dados são só do Shopping Estação. Separar os dados por local (ex.: uma pasta por local ou endereço navi-uniopet.netlify.app) sem duplicar o código.'],
    ['Seletor de andares dinâmico', 'Hoje os botões são fixos em Piso 1 e Piso 2. Passar a gerar os botões a partir dos andares do local.'],
    ['Novas categorias', 'Sala de aula, laboratório, biblioteca, secretaria, coordenação, auditório, rampa, plataforma elevatória, vaga PcD.'],
    ['Busca por código de sala', 'Estudantes procuram "Sala 204" ou "Bloco B". A busca deve aceitar números e blocos.'],
    ['Textos e atalhos', 'Atalhos "Sanitário acessível mais próximo", "Secretaria", "Biblioteca"; cartão para atendente adaptado ao campus.'],
    ['Contatos de avisos', 'WhatsApp, telefone ou e-mail da manutenção/infraestrutura da UniOpet em config.js.']
  ]),

  h1('Etapas e prazos'),
  ...tabela([0.5, 1.6, 1.2, 3], ['#', 'Etapa', 'Período', 'Entregas'], [
    ['0', 'Preparação', 'nov–dez/2026', 'Reunião com o contato; apresentação do Navi; autorização formal para mapear e divulgar; definição dos prédios e andares; pedido da planta baixa'],
    ['1', 'Levantamento', 'jan/2027', 'Planta obtida ou desenhada; visita técnica; medição de corredores para a escala; posição de elevadores, rampas e escadas; fotos para o 3D; lista de salas e serviços'],
    ['2', 'Adaptação do produto', 'fev/2027', 'Suporte a vários locais; seletor de andares dinâmico; novas categorias; busca por sala e bloco'],
    ['3', 'Mapa da UniOpet', 'fev–mar/2027', 'Dados, malha de corredores e 3D da UniOpet; rotas conferidas andar por andar'],
    ['4', 'Testes com usuários', 'mar–abr/2027', 'Pelo menos 6 participantes (visual, auditiva, mobilidade), de preferência indicados pelo setor de acessibilidade da UniOpet; correções'],
    ['5', 'Piloto', 'abr–mai/2027', 'QR Codes impressos nas entradas; divulgação interna; avisos de interdição em uso; acompanhamento semanal'],
    ['6', 'Implantação oficial', 'jun/2027', 'Ajustes finais; treinamento de quem confirma avisos na UniOpet; relatório do piloto; passagem para operação']
  ]),
  h2('Marcos'),
  ...tabela([2.6, 1.2, 1.6], ['Marco', 'Data-alvo', 'Quem aprova'], [
    ['Autorização da UniOpet assinada', '18/12/2026', 'Contato da UniOpet'],
    ['Planta e levantamento concluídos', '29/01/2027', 'Leonardo'],
    ['Mapa da UniOpet completo (versão de testes)', '26/03/2027', 'Leonardo'],
    ['Testes com usuários aprovados', '23/04/2027', 'Camilly'],
    ['Início do piloto com QR Codes', '03/05/2027', 'Equipe + UniOpet'],
    ['Navi oficial na UniOpet', '30/06/2027', 'Equipe + UniOpet']
  ]),

  h1('Responsáveis'),
  ...tabela([2, 1, 1, 1, 1], ['Etapa', 'Leonardo', 'Camilly', 'Erik', 'Lucas'], [
    ['0. Preparação', 'C', 'A/R', 'I', 'I'],
    ['1. Levantamento', 'A', 'R', 'R', 'R'],
    ['2. Adaptação do produto', 'A/R', 'C', 'R', 'R'],
    ['3. Mapa da UniOpet', 'A', 'C', 'R', 'R'],
    ['4. Testes com usuários', 'C', 'A/R', 'R', 'R'],
    ['5. Piloto', 'R', 'A/R', 'R', 'R'],
    ['6. Implantação oficial', 'A/R', 'R', 'C', 'C']
  ]),
  p('R = executa · A = aprova · C = consultado · I = informado.', { after: 160 }),

  h1('Recursos e custos'),
  ...tabela([1.6, 3], ['Recurso', 'Observação'], [
    ['Hospedagem', 'Netlify, plano gratuito — R$ 0'],
    ['Visitas ao campus', 'Pelo menos 2 (levantamento e testes); deslocamento da equipe'],
    ['Impressão de QR Codes', 'Placas nas entradas e pontos principais; definir com a UniOpet quem custeia'],
    ['Tempo da equipe', 'Etapas 2 e 3 concentram o desenvolvimento']
  ]),

  h1('Riscos'),
  ...tabela([2, 1, 2.6], ['Risco', 'Impacto', 'Resposta'], [
    ['Planta não disponibilizada', 'Alto', 'Levantar a planta na visita, com medição de corredores'],
    ['Atraso na autorização', 'Alto', 'Iniciar o pedido em novembro; seguir com a adaptação do produto em paralelo'],
    ['Elevador ou rampa fora de funcionamento', 'Médio', 'Avisos de interdição e canal direto com a manutenção da UniOpet'],
    ['Poucos participantes para testes', 'Médio', 'Pedir indicação ao setor de acessibilidade da instituição desde a etapa 0'],
    ['Período de férias (jan/2027) reduz acesso ao campus', 'Médio', 'Agendar a visita técnica com antecedência'],
    ['Salas mudam de uso entre semestres', 'Baixo', 'Atualização dos dados a cada semestre, como operação contínua']
  ]),

  h1('Critérios de sucesso do piloto'),
  ul([
    'Pelo menos 5 de 6 participantes chegam ao destino sem ajuda.',
    'Nenhuma rota do perfil de mobilidade passa por escada.',
    'Todos os andares e salas acordados estão no mapa.',
    'A UniOpet indica quem confirma os avisos de interdição.'
  ]),

  h1('Pendências a confirmar com a UniOpet'),
  ...tabela([0.3, 3, 1], ['', 'Pendência', 'Responsável'], [
    ['☐', 'Nome e cargo do contato', 'Camilly'],
    ['☐', 'Quais prédios, blocos e andares entram', 'Camilly'],
    ['☐', 'Existência de setor ou núcleo de acessibilidade', 'Camilly'],
    ['☐', 'Autorização para usar a planta e divulgar o mapa', 'Camilly'],
    ['☐', 'Canal da manutenção para receber avisos', 'Camilly'],
    ['☐', 'Datas possíveis para a visita técnica', 'Leonardo']
  ], { zebra: false })
];

/* ================= 6. ARQUITETURA E REFERÊNCIAS ================= */
const doc6 = () => [
  capa('06', 'Arquitetura e referências', 'Meios que o Navi usa hoje: componentes, tecnologias e fontes', 'descrever a arquitetura atual do site, o papel de cada componente, como os dados são preparados e em quais normas, tecnologias e materiais o projeto se baseia.'),
  h1('Visão geral'),
  p('O Navi é um **site estático**: não tem servidor nem banco de dados. Todo o processamento — cálculo de rotas, voz, mapa 2D e 3D — acontece no navegador da pessoa. Os dados de cada local são preparados antes, a partir da planta, e publicados junto com o site.'),
  ...imagem('/home/claude/build/docs/arquitetura.png', 640, 400, 'Figura 1 — Componentes do Navi e como se relacionam'),

  h1('Componentes'),
  h2('Interface'),
  ...tabela([1.4, 3.2], ['Arquivo', 'Responsabilidade'], [
    ['index.html', 'Estrutura da página, pergunta de voz, telas de perfil e mapa, ícones SVG, cartão para atendente, área do VLibras'],
    ['css/estilo.css', 'Estilo base e modo alto contraste (azul-marinho e amarelo, Atkinson Hyperlegible)'],
    ['css/soft-ui.css', 'Design Soft UI; gerado por escopo.py para valer só fora do alto contraste'],
    ['css/mobile.css', 'Layout de celular até 860 px; não altera o computador'],
    ['js/app.js', 'Perfis, painel, busca, mapa 2D em SVG (arrastar, pinça, zoom), voz, Libras, avisos, integração com o 3D']
  ]),
  h2('Motor de rotas e dados'),
  ...tabela([1.4, 3.2], ['Arquivo', 'Responsabilidade'], [
    ['js/rotas.js', 'Monta o grafo, calcula o caminho, refina o traçado e gera as instruções em texto'],
    ['js/dados.js', 'Lugares (lojas, serviços, entradas), contornos das plantas e grafo dos corredores'],
    ['js/malha.js', 'Grade fina com a distância de cada ponto às paredes e quiosques'],
    ['js/avisos.js', 'Interdições confirmadas pela equipe, válidas para todos'],
    ['js/config.js', 'Endereço do site e contatos do local (WhatsApp, telefone, Fale Conosco)']
  ]),
  h2('Vista 3D (carregada só quando pedida)'),
  ...tabela([1.4, 3.2], ['Arquivo', 'Responsabilidade'], [
    ['js/mapa3d.js', 'Modelo 3D dos pisos, rota em 3D, vista dos dois pisos e modo primeira pessoa'],
    ['js/dados3d.js', 'Lajes (contornos dos pisos) para o modelo 3D'],
    ['js/three-navi.min.js', 'Biblioteca Three.js r186 empacotada com esbuild']
  ]),
  h2('Site da maquete (navi-qrcode.netlify.app)'),
  ...tabela([1.4, 3.2], ['Arquivo', 'Responsabilidade'], [
    ['js/maquete.js', 'Maquete 3D do shopping que, girada para a vista de cima, se transforma no QR Code'],
    ['js/qrcodigo.js', 'Codificador de QR Code próprio (ISO/IEC 18004), validado com leitor real']
  ]),

  h1('Como a rota é calculada'),
  ol([
    '**Grafo dos corredores:** pontos a cada 30 unidades da planta, ligados aos 8 vizinhos; escadas rolantes e elevador ligam os pisos.',
    '**Restrições:** o perfil de mobilidade remove as escadas; locais com aviso de interdição saem do grafo.',
    '**Caminho mais curto:** algoritmo de Dijkstra.',
    '**Refino do traçado:** algoritmo A* numa grade fina (6 unidades), que "cobra" mais caro perto de paredes e 30 vezes mais sobre quiosques — por isso a rota segue o meio do corredor.',
    '**Suavização:** simplificação de Ramer–Douglas–Peucker e curvas de Chaikin.',
    '**Instruções:** os ângulos viram "vire à direita", com a loja mais próxima como referência, passos retos unidos e o lado do destino no fim.',
    '**Exibição:** mapa 2D, 3D, primeira pessoa, texto, voz e aviso visual, conforme o perfil.'
  ], 'n3'),

  h1('Preparação dos dados de um local'),
  ...tabela([1.3, 1.3, 2.4], ['Etapa', 'Ferramenta', 'Resultado'], [
    ['Planta oficial', 'Mapa do local (no shopping: Mapa Mall)', 'Contornos das lojas e corredores'],
    ['Dados do mapa', 'gen-data.js (Node.js)', 'js/dados.js'],
    ['Malha de distâncias', 'malha.py (Python + OpenCV, transformada de distância)', 'js/malha.js'],
    ['Lajes do 3D', 'lajes.py (Python + OpenCV, contornos)', 'js/dados3d.js'],
    ['Estilo Soft UI', 'escopo.py', 'css/soft-ui.css'],
    ['Biblioteca 3D', 'esbuild', 'js/three-navi.min.js'],
    ['Testes', 'Playwright (Chromium)', 'Capturas de celular e computador, fluxo completo, primeira pessoa']
  ]),

  h1('Armazenamento e privacidade'),
  p('Não há cadastro nem servidor. O site guarda apenas preferências no próprio aparelho (localStorage):'),
  ...tabela([1.4, 3.2], ['Chave', 'Conteúdo'], [
    ['navi-perfil', 'Último perfil escolhido'],
    ['navi-voz', 'Voz ligada ou desligada'],
    ['navi-contraste / navi-texto', 'Alto contraste e texto maior'],
    ['navi-vista', 'Última vista (2D ou 3D)'],
    ['navi-avisos', 'Avisos de interdição feitos naquele aparelho']
  ]),

  h1('Integrações externas'),
  ...tabela([1.4, 3.2], ['Serviço', 'Uso'], [
    ['VLibras (vlibras.gov.br)', 'Tradução do conteúdo para Libras, carregada no perfil auditivo'],
    ['Web Speech API (navegador)', 'Leitura das instruções e busca falando'],
    ['WhatsApp, telefone, Fale Conosco', 'Envio dos avisos de interdição ao local, sempre confirmado pela pessoa'],
    ['Google Fonts', 'Fontes Plus Jakarta Sans, DM Sans e Atkinson Hyperlegible'],
    ['Netlify', 'Hospedagem gratuita; publicação manual por ZIP']
  ]),

  h1('Limitações atuais e próximos passos técnicos'),
  ...tabela([2, 2.6], ['Limitação', 'Próximo passo'], [
    ['Sem controle de versão', 'Repositório Git (GitHub) com publicação automática no Netlify'],
    ['Avisos não são compartilhados automaticamente', 'Serviço leve de avisos (ex.: funções do Netlify) com confirmação pela equipe'],
    ['Dados de um único local; andares fixos em 1 e 2', 'Estrutura para vários locais e seletor de andares dinâmico (necessário para a UniOpet)'],
    ['Escala da planta e elevador do Piso 1 estimados', 'Medição no local'],
    ['app.js concentra muita coisa (~1.000 linhas)', 'Dividir em módulos: voz, mapa 2D, painel, avisos'],
    ['Testes rodam manualmente', 'Rodar Playwright e axe-core a cada publicação']
  ]),

  h1('Referências'),
  h2('Normas e legislação'),
  ul([
    '**WCAG 2.2** — Web Content Accessibility Guidelines, W3C.',
    '**WAI-ARIA Authoring Practices Guide (APG)** — padrões de componentes acessíveis, W3C.',
    '**ABNT NBR 17225:2025** — acessibilidade em conteúdo e aplicações web.',
    '**ABNT NBR 9050** — acessibilidade a edificações, mobiliário, espaços e equipamentos urbanos (referência para a UniOpet).',
    '**Lei Brasileira de Inclusão** — Lei nº 13.146/2015.',
    '**ISO/IEC 18004** — especificação do QR Code.'
  ]),
  h2('Algoritmos'),
  ul([
    'Dijkstra — caminho mais curto em grafos.',
    'A* — busca de caminho com heurística, usada no refino.',
    'Ramer–Douglas–Peucker — simplificação de linhas.',
    'Chaikin — suavização de curvas.',
    'Transformada de distância (OpenCV) — distância de cada ponto às paredes.'
  ]),
  h2('Tecnologias e bibliotecas'),
  ul([
    'HTML, CSS e JavaScript puro, sem framework.',
    'Three.js r186 (licença MIT) — 3D e primeira pessoa.',
    'VLibras — Governo Federal.',
    'Web Speech API — síntese e reconhecimento de voz do navegador.',
    'Python + OpenCV, Node.js, esbuild e Playwright — preparação de dados e testes.',
    'Netlify — hospedagem.'
  ]),
  h2('Design e inspirações'),
  ul([
    'Design System Soft UI (neumorfismo) fornecido pela equipe.',
    'Google Street View — referência para o modo primeira pessoa.',
    'Planta oficial do Shopping Estação (Mapa Mall).',
    'Conceitos de projeto, programa e portfólio: Artia, manual do TRT2, artigo do TRF5 (Documento 03).'
  ]),
  h2('Documentos internos'),
  ul([
    'Relatório de Auditoria UX e Acessibilidade (20/10/2026).',
    'Navi — Plano de Melhorias (21/10/2026).',
    'Portfólio Navi e Relatório de aprendizagem (Claude Docs).'
  ])
];

(async () => {
  const quer = n => !SO.length || SO.includes(n);
  if (quer('04')) await gerar(OUT + '04-Regras-de-Negocio.docx', 'Regras de negócio', doc4);
  if (quer('05')) await gerar(OUT + '05-Plano-de-Implantacao-UniOpet.docx', 'Plano de implantação — UniOpet', doc5);
  if (quer('06')) await gerar(OUT + '06-Arquitetura-e-Referencias.docx', 'Arquitetura e referências', doc6());
  console.log('ok 4-6', todas.length, conta('I'), conta('P'), conta('A'));
})();
