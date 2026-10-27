# Fase 1 — Nova identidade visual do Navi

Versão 1.0 · 27/10/2026 · Status: **para aprovação de Camilly (Design e Negócios) e Leonardo (Líder Técnico)**

A Fase 1 troca a aparência do site inteiro por um sistema único, acessível por construção, em que o alto contraste é um tema e não um segundo site. O comportamento e as 62 regras do Documento 04 v1.1 não mudam. Esta fase entrega design e tokens; nenhuma tela é codada antes da aprovação (a codificação é a M1b e a M1c).

## 1. O que já está decidido

| Tema | Decisão | Fonte |
| --- | --- | --- |
| Posicionamento | Startup de impacto social; tom de guia atento, direto, calmo e respeitoso; nada de pena, heroísmo ou visual infantil | Documento 02 |
| Valores que o visual expressa | Autonomia, simplicidade, confiança, feito com quem usa | Documento 02 |
| Plataforma principal | Celular, com uma mão, andando. Tudo nasce em 360 × 640 e depois se adapta a 768 e 1440 | Prompt, Relatório de aprendizagem |
| O que se preserva | Comportamento, regras, textos e tom de voz, classes `html.contraste` e `html.texto-grande`, chaves `navi-*`, função `anunciar()` | Prompt |
| O que não é obrigatório | Paleta antiga (#E0E5EC, #6C63FF, #38B2AC) e as fontes Plus Jakarta Sans e DM Sans | Prompt |
| Por que trocar | Soft UI reprovado em 5 pares de cor (1,72:1 a 4,32:1) e foco de 2 px; alto contraste virou outro layout | Fase 0 |
| Alvos de toque | 48 × 48 px com 8 px entre áreas (RN40 v1.1) | Documento 04 v1.1 |
| Fonte | Uma família de alta legibilidade para o site todo, com os arquivos hospedados no próprio site (sem Google Fonts) | Prompt; a Fase 0 mostrou que a fonte externa é o maior custo de carregamento |

## 2. Decisões tomadas por padrão (as três perguntas ficaram sem preferência)

Escolhi o caminho de menor risco em cada uma. Camilly pode trocar qualquer uma antes da etapa E2.

| Pergunta | Padrão adotado | O que muda se trocar |
| --- | --- | --- |
| Tema escuro | Os tokens são escritos para três temas, mas só **claro** e **alto contraste** ficam completos e testados no Marco 1. **Precisa de confirmação**: hoje o site escurece sozinho no modo escuro do aparelho; com o padrão, quem usa modo escuro passa a ver o tema claro até o escuro ser aprovado. | Tema escuro completo soma cerca de um terço do trabalho de contraste e de telas (16 telas a mais) |
| Logo | Mantém o símbolo atual (caminho com dois pontos, partida e chegada) e o nome NAVI; só as cores e o raio mudam para a nova paleta | Redesenhar soma uma etapa de marca antes de E1 |
| Onde desenhar | Direções e telas num **canvas de design** aqui no Claude (artefato do tipo Design) e os tokens num **Design System** (artefato), espelhando `css/tokens.css`. O Figma fica como espelho opcional quando houver [LINK_FIGMA] | Com Figma desde o início: preciso do link do arquivo ou de permissão para criar um no Figma conectado |

## 3. Entregas e ordem

```
E1 Duas direções ──► Camilly escolhe ──► E2 Tokens + contraste ──► E3 Componentes ──► E4 Telas ──► E5 Documento 02 ──► aprovação ──► M1b
                         (em paralelo, sem mudança visível: M1a — fundação)
```

### E1 — Duas direções visuais (para Camilly escolher uma)

Cada direção cabe numa prancha e mostra: paleta nos dois temas, tipografia (escala e pesos), um componente com estados (item de lista de lugar) e a Página do Mapa no celular 360 × 640 com o bottom sheet recolhido. Sem lorem ipsum: textos e lugares reais do Shopping Estação.

Ponto de partida das duas (as direções podem mudar no desenho):

| | Direção A — "Sinalização" | Direção B — "Guia calmo" |
| --- | --- | --- |
| Ideia | A linguagem da placa de orientação: forte, legível de longe, pictogramas grandes | Um guia ao lado: superfícies claras e quentes, contornos nítidos, menos ruído |
| Cor | Azul-marinho e amarelo como base; o alto contraste é a mesma família, levada ao máximo | Off-white quente, tinta verde-petróleo escura, um único acento para ações |
| Forma | Cantos pequenos, bordas de 2 px, ícones cheios | Cantos médios, bordas de 1,5 px, ícones de traço |
| Risco | Pode parecer "sistema de transporte" e frio | O acento precisa de cuidado para passar 3:1 nas bordas |

Fonte nas duas: Atkinson Hyperlegible Next (Braille Institute, licença OFL), em escalas diferentes; uma família só, como pede o prompt.

### E2 — Tokens e verificação de contraste

- `site-acessivel/css/tokens.css`, fonte única de verdade, com os grupos do prompt: cor de interface (12 tokens), cor do mapa (15 tokens), tipografia (base ≥ 16 px, altura de linha ≥ 1,5), espaçamento em passos de 4 e 8 px, raios, elevação, foco (≥ 3 px, ≥ 3:1 contra fundo e componente), movimento (durações e curvas; zero com `prefers-reduced-motion`).
- Temas: `:root` = claro; `html.contraste` = alto contraste (só tokens mudam, mesmos componentes e layout). Bloco do tema escuro escrito, desligado, até a decisão.
- **Tabela de contraste gerada por script**, não à mão: `testes/identidade/contraste.spec.js` lê `tokens.css`, calcula cada par usado e falha abaixo do limite (texto ≥ 4,5:1, ≥ 7:1 no alto contraste; ícones, bordas e limites de controle ≥ 3:1; rota ≥ 3:1 contra piso e corredor nos dois temas). A tabela vai no Design System e no Documento 02. Regra extra: nenhum limite de componente só por sombra.
- Fonte hospedada em `site-acessivel/fontes/` (woff2, 2 pesos), com `font-display: swap`.

### E3 — Componentes com estados

15 componentes, cada um em normal, foco, pressionado, desabilitado e carregando, nos dois temas: botão primário, botão secundário, botão de ícone, campo de busca, chip de atalho, item de lista de lugar, cartão de lugar ("Ir para cá"), seletor de andar, controles do mapa, bottom sheet com alça, cartão de passo, selo de rota demonstrativa, aviso de interdição, diálogo, aviso de offline.

Ícones: um conjunto só, de traço consistente, incluindo símbolo internacional de acesso, elevador, rampa, piso tátil, sanitário acessível e Libras. Nenhuma informação só por cor (RN38). Os ícones atuais em `index.html` são redesenhados no novo traço, com os mesmos ids de `<symbol>` para não quebrar o código.

### E4 — Telas

| Página | Estados | Tamanhos | Temas | Total |
| --- | --- | --- | --- | --- |
| Página de Rota | busca vazia, resultados, escolha da entrada | 360 × 640, 1440 × 900 | claro, alto contraste | 12 |
| Página do Mapa | sheet recolhido, médio, expandido, sem caminho acessível, offline | 360 × 640, 1440 × 900 | claro, alto contraste | 20 |

As telas seguem as seções "Página de Rota", "Página do Mapa" e "Bottom sheet" do prompt e as regras RN01, RN17, RN19, RN25, RN35, RN42, RN53, RN54 e RN56–RN61.

### E5 — Documento 02

Seção "Identidade visual" reescrita com a direção escolhida: cores e tokens, tipografia, tabela de contraste, ícones, logo e o estilo. Gerado por `ferramentas/documentos/doc1a3.js`, como o Documento 04.

## 4. Como cada entrega é aprovada

| Entrega | Quem aprova | Critério |
| --- | --- | --- |
| E1 | Camilly | Escolhe uma direção (ou pede ajuste) |
| E2 | Camilly e Leonardo | Script de contraste verde; nenhum par abaixo do limite |
| E3 + E4 | Camilly | Telas e componentes conferidos nos dois temas; Leonardo confere viabilidade sem build |
| E5 | Camilly | Documento 02 atualizado |

Skills usadas: frontend-design (direções), emil-design-eng (componentes, microinterações, bottom sheet); figma-generate-library e figma-use só se o Figma entrar.

## 5. Fora desta fase

Codar telas (M1b e M1c), PWA (M1d), modelos .glb, tema escuro completo (até a decisão), mudanças de comportamento ou de regra.

## 6. O que preciso antes de começar a E1

1. **Tema escuro**: confirmar o padrão (claro e alto contraste agora; quem usa modo escuro vê o claro) ou pedir o tema escuro completo.
2. **Figma**: seguir só com o canvas e o Design System aqui, ou enviar [LINK_FIGMA].
3. **Fonte**: posso baixar a Atkinson Hyperlegible Next do repositório oficial no GitHub, ou vocês enviam os arquivos .woff2/.ttf.
4. **Site publicado igual ao repositório?** Esta sessão não abre navi-map.netlify.app. Se o site no ar tiver algo diferente do branch `main`, preciso de capturas do celular.
