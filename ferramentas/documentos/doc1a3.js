const { p, h1, h2, ul, ol, nota, tabela, capa, gerar, EQUIPE } = require('./lib');
const OUT = require('path').resolve(__dirname, '../../documentos') + '/';
require('fs').mkdirSync(OUT, { recursive: true });

/* ================= 1. IDEIA DO PROJETO ================= */
const doc1 = [
  capa('01', 'Ideia do projeto', 'O que queremos desenvolver', 'explicar em poucas páginas qual problema o Navi resolve, para quem, como funciona e até onde queremos chegar.'),
  h1('Resumo'),
  p('O **Navi** é um mapa interno acessível: mostra o caminho entre dois pontos dentro de um local (shopping, universidade, hospital) e adapta a rota e a forma de mostrá-la para pessoas com deficiência visual, auditiva ou de mobilidade. Funciona no navegador do celular, sem instalar aplicativo e sem cadastro.'),
  p('O primeiro local mapeado é o **Shopping Estação, em Curitiba**, com os dois pisos. O próximo é a **UniOpet**, também em Curitiba (ver Documento 05).'),

  h1('O problema'),
  ul([
    'Mapas de shoppings e prédios são feitos para quem enxerga: uma imagem fixa, sem texto alternativo, que o leitor de tela não consegue ler.',
    'Os mapas não dizem onde há escada, rampa ou elevador. Para quem usa cadeira de rodas, descobrir isso no caminho custa tempo e autonomia.',
    'Pessoas surdas dependem de perguntar a funcionários que, em geral, não sabem Libras.',
    'Quando algo está fechado ou quebrado (um elevador parado, um corredor em obra), ninguém avisa quem mais precisa saber.'
  ]),

  h1('Para quem'),
  ...tabela([1.2, 2, 2.4], ['Público', 'Principal necessidade', 'Como o Navi atende'], [
    ['Pessoas com deficiência visual (cegas ou com baixa visão)', 'Chegar ao destino sem depender do mapa visual', 'Busca falando, instruções em voz alta, um passo de cada vez, letras grandes e alto contraste, compatível com TalkBack e NVDA'],
    ['Pessoas com mobilidade reduzida (cadeira de rodas, muletas, idosos, gestantes)', 'Evitar escadas e saber onde está o elevador', 'Rotas que nunca passam por escada; troca de piso pelo elevador; aviso quando o elevador está interditado'],
    ['Pessoas surdas ou com deficiência auditiva', 'Receber tudo por escrito e em Libras', 'Tradutor VLibras no site, avisos visuais com vibração e um cartão para mostrar ao atendente'],
    ['Gestores do local (shopping, universidade)', 'Cumprir a lei de acessibilidade e saber dos problemas', 'Mapa acessível sem custo de aplicativo e avisos de interdição enviados pelos próprios usuários']
  ]),

  h1('A solução'),
  h2('Como a pessoa usa'),
  ol([
    'Abre o site (ou lê um QR Code na entrada). O site pergunta se ela quer ouvir as instruções em voz alta.',
    'Escolhe como prefere se orientar: deficiência visual, mobilidade reduzida, deficiência auditiva ou sem adaptações.',
    'Diz para onde vai, digitando ou falando, ou toca em um atalho como "Sanitário mais próximo".',
    'Diz por qual entrada chegou. A rota aparece no mapa e em texto, um passo de cada vez.'
  ]),
  h2('Funcionalidades que já existem'),
  ...tabela([1.3, 3], ['Funcionalidade', 'O que faz'], [
    ['Mapa 2D fiel à planta', 'Os dois pisos do Shopping Estação, com lojas, quiosques, entradas e serviços'],
    ['Rotas acessíveis', 'Caminho mais curto pelo meio dos corredores; sem escadas no perfil de mobilidade'],
    ['Instruções passo a passo', 'Direção, ponto de referência próximo e de que lado fica o destino'],
    ['Voz e busca falando', 'O site lê as instruções e entende o nome do lugar falado'],
    ['Libras', 'Tradutor VLibras, do Governo Federal, dentro do site'],
    ['Alto contraste e texto maior', 'Botões no topo, disponíveis em qualquer tela'],
    ['Modelo 3D e primeira pessoa', 'O mesmo mapa em 3D e uma caminhada virtual, estilo Street View, com a rota traçada'],
    ['Avisos de interdição', 'Qualquer pessoa avisa que um local está fechado ou quebrado; o local sai das rotas e o aviso vai ao local por WhatsApp ou telefone'],
    ['Link direto e QR Code', 'Um QR na entrada abre o mapa já com o ponto de partida'],
    ['Versão de celular simplificada', 'Destino primeiro, três toques até a rota, botões perto do polegar']
  ]),

  h1('O que queremos desenvolver'),
  h2('No produto'),
  ul([
    '**Navegação completa só por texto**, para todos os perfis, também no computador.',
    '**Preferências combináveis**: evitar escadas, ouvir instruções e Libras ao mesmo tempo, em vez de um único perfil.',
    '**Áudio com controles**: pausar, repetir e mudar a velocidade; não falar por cima do leitor de tela.',
    '**Rotas confiáveis**: selo de rota demonstrativa, distâncias em metros após medição no local e botão "Pedir ajuda".',
    '**Testes com pessoas com deficiência** antes de cada novo local entrar no ar.'
  ]),
  h2('No alcance'),
  ul([
    'Transformar o Navi em uma base que sirva para **vários locais**, começando pela UniOpet no 1º semestre de 2027.',
    'Avisos de interdição compartilhados entre todas as pessoas, e não só no aparelho de quem avisou.'
  ]),

  h1('O que o Navi não é'),
  ul([
    'Não é GPS interno: não sabe sozinho onde a pessoa está. Ela informa o ponto de partida ou lê um QR Code.',
    'Não é ferramenta de emergência: em caso de evacuação, vale a sinalização e a equipe do local.',
    'Não é aplicativo de loja nem pede cadastro ou dados pessoais.'
  ]),

  h1('Como saberemos que deu certo'),
  ...tabela([2.2, 1.4], ['Indicador', 'Meta'], [
    ['Pessoas com deficiência que chegam ao destino sem ajuda, em teste', 'Pelo menos 5 de 6'],
    ['Rotas do perfil de mobilidade que passam por escada', 'Zero'],
    ['Toques no celular até a rota aparecer', 'No máximo 3'],
    ['Custo de hospedagem', 'R$ 0 (plano gratuito do Netlify)'],
    ['Novos locais mapeados', 'UniOpet até o fim do 1º semestre de 2027']
  ])
];

/* ================= 2. POSICIONAMENTO ================= */
const doc2 = [
  capa('02', 'Como queremos ser vistos', 'Posicionamento, identidade e tom de voz', 'alinhar como a equipe apresenta o Navi a usuários, locais parceiros, investidores e banca, para todos falarem a mesma língua.', '1.1 — 27/10/2026'),
  h1('Posicionamento'),
  p('Queremos que o Navi seja visto como uma **startup de impacto social**: tecnologia simples que devolve autonomia a pessoas com deficiência dentro de espaços internos, com potencial de crescer como negócio.'),
  nota('**Declaração de posicionamento.** Para pessoas com deficiência visual, auditiva ou de mobilidade que precisam se locomover em shoppings, universidades e outros espaços internos, o Navi é um mapa acessível no navegador que mostra o caminho certo para cada necessidade. Diferente dos mapas fixos e das placas, o Navi fala, escreve, traduz em Libras e evita escadas — sem aplicativo e sem cadastro.'),
  h2('Frase de uma linha (para o pitch)'),
  p('**"Navi: o caminho certo para cada pessoa, dentro de qualquer lugar."**'),

  h1('Missão, visão e valores'),
  nota('Proposta inicial da equipe — revisar juntos antes de publicar.'),
  ...tabela([1, 3.2], null, [
    ['**Missão**', 'Dar autonomia a pessoas com deficiência para chegar onde querem, dentro de qualquer espaço, sem precisar pedir ajuda.'],
    ['**Visão**', 'Ser a referência brasileira em navegação interna acessível, presente em shoppings, universidades e hospitais.'],
    ['**Valores**', '**Autonomia** — a pessoa decide e chega sozinha.\n**Feito com quem usa** — nada sobre nós sem nós; testes com pessoas com deficiência.\n**Simplicidade** — menos toques, menos telas, menos jargão.\n**Confiança** — dizer "não há caminho acessível" é melhor que inventar uma rota.\n**Acesso aberto** — gratuito para quem usa, sem cadastro.']
  ], { zebra: false }),

  h1('Proposta de valor'),
  ...tabela([1.2, 3], ['Para quem', 'O que ganha'], [
    ['Pessoa com deficiência', 'Chega ao destino sozinha, do jeito que funciona para ela: voz, texto, Libras ou rota sem escada.'],
    ['Local parceiro (shopping, universidade)', 'Mapa acessível pronto, sem desenvolver aplicativo; avisos de problemas vindos dos próprios usuários; reforço do compromisso com a Lei Brasileira de Inclusão.'],
    ['Sociedade', 'Espaços mais inclusivos, alinhados aos Objetivos de Desenvolvimento Sustentável da ONU: ODS 10 (redução das desigualdades) e ODS 11 (cidades inclusivas).']
  ]),

  h1('Modelo de negócio em estudo'),
  nota('Hipóteses para validar com os locais parceiros — não são compromissos.'),
  ul([
    '**Gratuito para o usuário final**, sempre.',
    '**Implantação paga pelo local**: levantamento da planta, mapa e testes com usuários.',
    '**Assinatura de manutenção**: atualização de lojas e salas, avisos confirmados e relatórios de uso.',
    '**Projetos-piloto gratuitos** com instituições de ensino (como a UniOpet) para gerar casos de uso.'
  ]),

  h1('Personalidade e tom de voz'),
  p('O Navi fala como um guia atento: direto, calmo e respeitoso. Fala com a pessoa, não sobre a deficiência dela.'),
  ...tabela([1, 1], ['Fazemos', 'Evitamos'], [
    ['"Pessoa com deficiência"', '"Portador de deficiência", "deficiente", "especial"'],
    ['Frases curtas e diretas: "Vire à direita."', 'Textos longos e termos técnicos'],
    ['Autonomia: "Você chega sozinho(a)."', 'Pena ou heroísmo: "superação", "apesar da deficiência"'],
    ['Honestidade: "Não encontramos caminho sem escadas."', 'Prometer o que o mapa não garante'],
    ['Mostrar o produto funcionando', 'Discurso de caridade']
  ]),

  h1('Identidade visual'),
  p('Desde o Marco 1 (outubro de 2026) o Navi tem uma identidade única, acessível por construção: o alto contraste e as cores para daltonismo são **temas do mesmo sistema**, não outro site. O comportamento e as regras do Documento 04 não mudaram com ela.'),
  nota('**A ideia:** o azul do Símbolo Internacional de Acesso é o caminho e as ações que levam adiante; o amarelo do piso tátil é o destino e o foco. Nada mais é colorido sem motivo.'),
  ...tabela([1, 3], null, [
    ['**Nome**', 'NAVI — Navegador Acessível de Vias Internas'],
    ['**Logo**', 'O mesmo símbolo de antes — caminho com partida e chegada — em quadrado azul #0B4FA8 de cantos arredondados: traço branco e chegada em amarelo #FFC62E. Arquivos em site-acessivel/img (gerados por ferramentas/identidade/gerar-icones.js).'],
    ['**Tipografia**', 'Atkinson Hyperlegible Next (Braille Institute, licença OFL), uma família só, servida pelo próprio site (sem Google Fonts). Base de 16 px, escala 1,25 (14, 16, 20, 25 e 31 px), altura de linha 1,5. O texto pode ir a 200%.'],
    ['**Forma**', 'O raio cresce com a hierarquia: 8 px nos ladrilhos, 12 px nos controles, 20 px nos painéis. Todo limite de controle é uma borda (1,5 px; 2 px nos temas de acessibilidade), nunca só sombra. Alvos de toque de 48 × 48 px com 8 px entre eles.'],
    ['**Foco**', 'Anel duplo: 3 px escuro por fora e 2 px claro por dentro, visível sobre fundo claro e sobre botão escuro.'],
    ['**Movimento**', 'Só responde a uma ação (abrir o painel, apertar um botão), entre 120 e 280 ms. Com "reduzir movimento" no aparelho, nada se mexe.'],
    ['**Elemento marcante**', 'A placa do passo: a seta numa placa azul, como as placas de direção, com a trilha de progresso desenhada como o piso tátil direcional. No mapa, setas brancas paradas sobre a linha azul mostram o sentido da rota.'],
    ['**Ícones**', 'Um conjunto só, de traço de 2 px, com símbolo de acesso, elevador, rampa, piso tátil, sanitário acessível e Libras. Nenhuma informação depende só da cor.']
  ], { zebra: false }),
  h2('Três temas'),
  ...tabela([1, 1.4, 1.4, 1.4], ['Uso', 'Claro (padrão)', 'Alto contraste', 'Cores distintas (daltonismo)'], [
    ['Fundo da página', '#F2F4F7', '#061A33', '#F4F4F4'],
    ['Superfície', '#FFFFFF', '#0B2547', '#FFFFFF'],
    ['Texto', '#0D1B2A', '#FFFFFF', '#000000'],
    ['Ação e caminho', '#0B4FA8', '#FFD21F', '#005A8C (rota #0072B2)'],
    ['Destino e destaque', '#FFC62E', '#FFD21F', '#E69F00'],
    ['Borda de controle', '#74818F', '#FFFFFF', '#5C5C5C'],
    ['Alerta', '#7F4300 sobre #FFF1D2', '#FFC66B', 'preto sobre amarelo #F0E442']
  ]),
  p('O tema "Cores distintas" usa só cinzas, azul e laranja (paleta de Okabe e Ito), com contornos de 2 px: nunca vermelho contra verde, e o sucesso é azul. Ele foi pedido pela equipe no Marco 1 e entrou no Documento 04 como RN63, que aguarda a aprovação de Design e Negócios e do Líder Técnico.'),
  h2('Contraste conferido por teste'),
  p('Os valores acima ficam em site-acessivel/css/tokens.css, a fonte única de verdade. O teste testes/identidade/contraste.spec.js lê esse arquivo e falha se algum par usado ficar abaixo do mínimo: texto 4,5:1 (7:1 no alto contraste); ícones, bordas e rota 3:1.'),
  ...tabela([2.2, 1, 1, 1], ['Par', 'Claro', 'Alto contraste', 'Cores distintas'], [
    ['Texto sobre o fundo', '15,79', '17,45', '19,09'],
    ['Texto secundário sobre o fundo', '7,14', '14,41', '10,34'],
    ['Texto do botão sobre a cor de ação', '7,78', '12,04', '7,39'],
    ['Borda de controle sobre a superfície', '3,98', '15,33', '6,69'],
    ['Rota sobre o piso do mapa', '7,78', '12,04', '5,19'],
    ['Foco sobre a superfície', '17,39', '10,58', '21,00']
  ]),

  h1('Mensagens-chave'),
  ol([
    'O Navi mostra o caminho certo para cada necessidade: voz, texto, Libras ou rota sem escada.',
    'Funciona no celular, sem instalar nada e sem cadastro.',
    'Já está no ar no Shopping Estação, em Curitiba, e vai para a UniOpet em 2027.',
    'Quem usa ajuda a manter o mapa: avisos de interdição chegam direto ao local.'
  ], 'n2'),

  h1('Como não queremos ser vistos'),
  ul([
    'Como "só um trabalho de faculdade" — mostramos um produto no ar, com usuários e parceiros.',
    'Como projeto de caridade — o Navi gera valor para os locais e pode se sustentar.',
    'Como algo feito sem as pessoas com deficiência — os testes com elas fazem parte de cada entrega.'
  ])
];

/* ================= 3. GOVERNANÇA ================= */
const doc3 = [
  capa('03', 'Governança do projeto', 'Como decidimos, organizamos e acompanhamos o trabalho', 'registrar o modelo de governança que a equipe usa: portfólio, programas e projetos, papéis, ritos, critérios de decisão e de qualidade.'),
  h1('Modelo adotado'),
  p('O Navi é governado como um **portfólio**, seguindo os conceitos de gestão de projetos do PMI:'),
  ul([
    '**Projeto** — esforço temporário, com início e fim, que entrega um resultado exclusivo (ex.: "modo passo a passo por texto").',
    '**Programa** — projetos correlacionados, gerenciados juntos para gerar benefícios que não viriam isolados (ex.: "Navegação acessível").',
    '**Portfólio** — todos os programas, projetos e operações do Navi, organizados para os objetivos estratégicos e para a melhor alocação do recurso mais escasso: o tempo da equipe.'
  ]),
  p('O trabalho anda em **ondas de duas semanas**. Cada onda termina com uma revisão do portfólio.'),

  h1('Objetivos estratégicos'),
  p('Todo projeto precisa servir a pelo menos um destes objetivos para entrar no portfólio.'),
  ...tabela([0.4, 2.2, 2.2], ['#', 'Objetivo', 'Como medimos'], [
    ['O1', 'Qualquer pessoa chega ao destino sem depender do mapa visual', 'Tarefa concluída só com leitor de tela'],
    ['O2', 'Adaptações que se combinam conforme a necessidade de cada um', 'Rota funcionando com várias adaptações ao mesmo tempo'],
    ['O3', 'Rotas em que a pessoa pode confiar', 'Nenhuma rota de mobilidade por escada; interdições fora da rota'],
    ['O4', 'Projeto visível e replicável em outros locais, com custo zero de hospedagem', 'Sites no ar no plano gratuito; novos locais implantados']
  ]),

  h1('Estrutura do portfólio'),
  ...tabela([1.3, 3], ['Programa', 'Projetos'], [
    ['**1. Navegação acessível**', 'P1.1 Mapa 2D e rotas · P1.2 Modelo 3D · P1.3 Primeira pessoa · P1.4 Passo a passo por texto · P1.5 Distâncias em metros'],
    ['**2. Inclusão e interação**', 'P2.1 Perfis, voz e Libras · P2.2 Preferências combináveis · P2.3 Áudio com controles · P2.4 Teclado, leitor de tela e celular'],
    ['**3. Confiabilidade**', 'P3.1 Avisos de interdição · P3.2 Selos de confiabilidade e "Pedir ajuda" · P3.3 Testes com o público real'],
    ['**4. Marca e apresentação**', 'P4.1 Identidade visual e hospedagem · P4.2 Maquete com QR Code e pitch'],
    ['**Novo: Expansão**', 'P5.1 Implantação na UniOpet (Documento 05)'],
    ['**Operações contínuas**', 'Manter os sites no ar; atualizar lojas, salas e avisos confirmados']
  ]),

  h1('Papéis e responsabilidades'),
  ...tabela([1, 1.3, 3], ['Pessoa', 'Papel', 'Responsabilidades'], [
    ['Leonardo', 'Líder Técnico', 'Decide a arquitetura e as tecnologias; divide as tarefas técnicas; revisa o código antes de publicar; publica os sites no Netlify; responde pela qualidade técnica.'],
    ['Camilly', 'Design e Negócios', 'Experiência do usuário e identidade visual; relacionamento com locais parceiros (Shopping Estação, UniOpet) e associações; organiza testes com usuários; pitch e documentos de negócio.'],
    ['Erik', 'Desenvolvedor', 'Desenvolve funcionalidades e correções; escreve e roda os testes automáticos; mantém os dados do mapa.'],
    ['Lucas', 'Desenvolvedor', 'Desenvolve funcionalidades e correções; escreve e roda os testes automáticos; mantém os dados do mapa.'],
    ['Equipe toda', 'Comitê do portfólio', 'Aprova prioridades e mudanças de escopo na revisão de cada onda.']
  ]),
  h2('Matriz RACI'),
  p('R = executa · A = aprova e responde pelo resultado · C = é consultado · I = é informado.', { after: 80, keep: true }),
  ...tabela([2.4, 1, 1, 1, 1], ['Atividade', 'Leonardo', 'Camilly', 'Erik', 'Lucas'], [
    ['Priorizar a próxima onda', 'A', 'R', 'C', 'C'],
    ['Definir arquitetura e tecnologias', 'A/R', 'I', 'C', 'C'],
    ['Desenhar telas e textos', 'C', 'A/R', 'C', 'C'],
    ['Desenvolver funcionalidades', 'A', 'C', 'R', 'R'],
    ['Escrever regras de negócio', 'A', 'R', 'C', 'C'],
    ['Testes automáticos', 'A', 'I', 'R', 'R'],
    ['Testes com pessoas com deficiência', 'C', 'A/R', 'R', 'R'],
    ['Publicar no Netlify', 'A/R', 'I', 'I', 'I'],
    ['Contato com locais parceiros', 'C', 'A/R', 'I', 'I'],
    ['Confirmar avisos de interdição', 'A', 'R', 'R', 'R']
  ], { zebra: true }),

  h1('Ritos'),
  ...tabela([1.3, 1, 3], ['Rito', 'Quando', 'O que acontece'], [
    ['Planejamento da onda', 'Início de cada onda (segunda-feira)', 'Escolher os projetos da onda, dividir tarefas e responsáveis'],
    ['Alinhamento rápido', 'Duas vezes por semana, 15 min', 'O que foi feito, o que vem agora, o que está travando'],
    ['Revisão do portfólio', 'Fim de cada onda (sexta-feira)', 'Demonstrar o que foi entregue, rever prioridades, decidir o que entra ou sai'],
    ['Retrospectiva', 'Logo após a revisão', 'O que funcionou, o que mudar no jeito de trabalhar'],
    ['Conversa com o local parceiro', 'Quinzenal, durante implantações', 'Status, pendências e próximos passos com o contato do local']
  ]),
  nota('Ondas atuais: 26/10–06/11, 09/11–20/11 e 23/11–04/12/2026. A implantação na UniOpet segue o calendário do Documento 05.'),

  h1('Como decidimos'),
  h2('Priorização'),
  ol([
    'Impacto na autonomia da pessoa com deficiência.',
    'Alinhamento aos objetivos O1–O4.',
    'Esforço estimado (matriz impacto × esforço).',
    'Dependência de terceiros (visita ao local, participantes de teste).'
  ], 'n3'),
  h2('Entrada de uma ideia nova'),
  ol([
    'Quem teve a ideia registra: problema, para quem e qual objetivo atende.',
    'O Líder Técnico estima o esforço; Design e Negócios estima o impacto.',
    'O comitê decide na próxima revisão: entra numa onda, vai para a fila ou é descartada.',
    'Mudança que afeta uma regra de negócio atualiza o Documento 04 antes de ser desenvolvida.'
  ], 'n4'),

  h1('Definição de pronto'),
  p('Uma entrega só é publicada quando:'),
  ul([
    'Cumpre as regras de negócio afetadas (Documento 04).',
    'Os testes automáticos passam, sem erros no console do navegador.',
    'Funciona no celular (320, 375 e 390 px de largura) e no computador.',
    'Uma mudança só de celular não altera o desktop: comparação de capturas pixel a pixel.',
    'Todo botão tem nome acessível e área de toque de pelo menos 44 × 44 px.',
    'Foi testada com leitor de tela (TalkBack ou NVDA) no fluxo principal.',
    'O Líder Técnico revisou e aprovou.'
  ]),

  h1('Publicação e versões'),
  ul([
    'Os sites ficam no **Netlify**, plano gratuito: navi-map.netlify.app (mapa) e navi-qrcode.netlify.app (maquete).',
    'A publicação é feita pelo Líder Técnico, enviando o ZIP completo na aba Deploys — nunca só o index.html.',
    'Para economizar créditos (cada publicação gasta 15 de 300 por mês), agrupamos mudanças e publicamos uma vez por onda, salvo correções urgentes.',
    '**Próximo passo de governança:** levar o código para um repositório Git (GitHub) com publicação automática, para ter histórico de versões e revisão de código.'
  ]),

  h1('Riscos acompanhados'),
  ...tabela([2, 2.5], ['Risco', 'Resposta'], [
    ['Planta desatualizada ou escala errada', 'Selo de rota demonstrativa; medição no local'],
    ['Posição estimada do elevador', 'Confirmar em visita'],
    ['Falta de participantes para testes', 'Contatar associações e o núcleo de acessibilidade dos locais com antecedência'],
    ['Créditos do Netlify acabarem', 'Publicar uma vez por onda'],
    ['Conhecimento concentrado em uma pessoa', 'Documentação, revisão de código e rodízio de tarefas entre Erik e Lucas']
  ])
];

// Uso: node doc1a3.js [01] [02] [03]  — sem argumentos, gera os três.
const SO = process.argv.slice(2);
(async () => {
  const quer = n => !SO.length || SO.includes(n);
  if (quer('01')) await gerar(OUT + '01-Ideia-do-Projeto.docx', 'Ideia do projeto', doc1);
  if (quer('02')) await gerar(OUT + '02-Como-Queremos-Ser-Vistos.docx', 'Como queremos ser vistos', doc2);
  if (quer('03')) await gerar(OUT + '03-Governanca-do-Projeto.docx', 'Governança do projeto', doc3);
  console.log('ok', SO.join(' ') || '01 02 03');
})();
