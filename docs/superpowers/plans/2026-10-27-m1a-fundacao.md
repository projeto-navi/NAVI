# M1a — Fundação (sem mudança visível) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o site pronto para virar duas páginas e receber outros locais, sem mudar o que a pessoa vê: dados por local, grafo no esquema 1.1, motor sobre o grafo, MapRenderer sobre o 2D e o 3D atuais, módulos compartilhados e as correções F1, F2, F5 e F8.

**Architecture:** Scripts clássicos com um global por módulo (o padrão de `js/rotas.js`: `window.NaviX` no navegador, `module.exports` no Node), sem ES modules, porque o site precisa abrir por `file://`. Os dados de cada local ficam em `site-acessivel/locais/<slug>/` e se registram com `naviLocal(slug)`; `js/local.js` carrega a pasta do local escolhido por `?local=` e monta "lugares canônicos" (grafo 1.1 + geometria). O motor ganha o adaptador `criarGrafo11`, que devolve a mesma estrutura `G` de hoje, então `caminho`, `rota`, `instrucoes` e `refinarTrecho` continuam os mesmos. `app.js` continua sendo o controlador da página única, agora sobre módulos que a M1b e a M1c vão compor em duas páginas.

**Tech Stack:** HTML, CSS e JavaScript puro; Node 22 para geradores e testes; Playwright 1.63 (`@playwright/test`), `@axe-core/playwright`; Python + OpenCV só nos scripts de planta já existentes.

**Spec:** `docs/superpowers/specs/2026-10-27-marco-1-especificacao.md` (prompt da equipe, seções "DADOS POR LOCAL", "GRAFO DE ROTAS", "MAPRENDERER", "ARQUITETURA DAS DUAS PÁGINAS" e "M1a"), o relatório da Fase 0 (https://claude.ai/artifact/5KYpjrNvELenT6k2qccj5v) e `documentos/04-Regras-de-Negocio.docx` v1.1.

## Global Constraints

- "HTML, CSS e JavaScript puro, SEM build e sem framework." O site "também abre com dois cliques no index.html (file://)".
- Motor de rotas: "só ganha adaptadores; não é reescrito".
- Preservar o COMPORTAMENTO de: "pergunta de voz, perfis, voz, busca falando, VLibras, alto contraste, A+, avisos de interdição, cartão para o atendente, textos e tom de voz"; "2D, 3D e primeira pessoa com rota, piso e destino iguais (RN45–RN48)"; "links e QR Codes já existentes (?perfil=&origem=&destino=)".
- M1a é "sem mudança visível". A única mudança visível permitida é a de F2 (a rota termina na porta, não no centro do lugar).
- "Toda mudança de regra passa pelo Documento 04 ANTES do código." "Em dúvida sobre mudar um COMPORTAMENTO ou uma regra: NÃO mude, pergunte."
- Testes de comportamento localizam por papel e nome acessível (`getByRole`), nunca por classe CSS. Testes de contrato do renderer podem usar `window.Navi` (são testes de API, não de comportamento).
- "Uma pasta por local: locais/<slug>/ com dados, malha, grafo.json, avisos.js e config.js." "Seleção por ?local=<slug>; sem parâmetro, shopping-estacao."
- "Nenhum texto fixo de local no código ("Shopping Estação", "SAC no Piso 1", "Piso 1 e Piso 2"): tudo vem do config do local." Exceção nesta entrega: `index.html`, que a M1b reescreve.
- Esquema do grafo `"versao": "1.1"`, como está na especificação. "pos = [x_planta × escala, altura_m do andar, y_planta × escala]. Sem escala medida, escala = 1." "IDs são estáveis entre versões. IDs antigos (ex.: 1-1401928) entram em aliases e continuam funcionando no link e nos QR Codes já impressos." "Interditar um equipamento bloqueia todas as arestas dele em todos os andares (RN16)." "O 3D não define conectividade: o grafo é a única fonte de verdade."
- Chaves `navi-*` no `localStorage`; nenhum dado pessoal (RN55).
- `js/malha.js` (155 KB) e `js/three-navi.min.js` (745 KB): nunca ler inteiros; usar headroom:peek ou ler por script.
- Um branch por entrega (`m1a/fundacao`), TDD em cada etapa, superpowers:systematic-debugging em qualquer falha, superpowers:verification-before-completion antes de dizer "pronto".
- Fora desta entrega: nova identidade, duas páginas, PWA, `.glb`, backend de avisos, tema escuro, F3, F4, F6, F7, F9, publicação no Netlify, e a opção `preferirPisoTatil` (o Shopping não tem piso tátil mapeado; entra com o painel de Preferências da M1b).

## Review Focus

1. **Abrir com dois cliques (`file://`).** O carregador injeta `<script>` clássicos; em `file://` o site tem de abrir, buscar e calcular a rota. Teste na Task 6.
2. **Avisos já guardados no aparelho com ids antigos** (`navi-avisos` com `2-22327`, `elevador-piso-1`). Depois da troca de ids, o aviso continua aparecendo e bloqueando o elevador. Teste na Task 7.
3. **QR Codes e links com ids antigos, novos ou inexistentes.** `?origem=1-1401928` e `?origem=SHE_P01_L…` levam ao mesmo lugar; `?origem=nao-existe` abre a tela de perfis, sem erro no console. Teste na Task 6.
4. **`?local=` inválido ou de um local que ainda não existe** (`?local=../x`, `?local=uniopet`). Cai no local padrão e não pede nenhum arquivo fora de `locais/shopping-estacao/`. Teste na Task 6.
5. **Aparelho sem WebGL ou com `navigator.deviceMemory ≤ 2`.** O botão 3D não troca a vista, o site avisa por texto e o console fica sem erro. Teste na Task 11.

## Perguntas abertas (só a Task 13 depende delas)

- **F1:** onde fica a La Maçã (`1-2484249`, hoje em 0, 0, sem contorno na planta)? Ela ainda existe?
- **F1:** a Saída de Emergência `1-35749` (183, 773) fica fora do contorno do Piso 1 (y máximo 736). É a posição certa?
- **F1:** o Pagamento do Estacionamento do Piso 2 (`2-2119510`, em 1498, 86) fica a 229 unidades do corredor mais próximo. Onde ele fica de fato?
- A altura entre os pisos não foi medida: `P02.altura_m` fica `null` e `pos[1] = 0` até a visita (o 3D continua com a altura ilustrativa de 120 unidades).

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
| --- | --- | --- |
| `site-acessivel/locais/indice.js` | Lista dos locais (`self.NAVI_LOCAIS_INDICE`) | 3 |
| `site-acessivel/locais/shopping-estacao/{config,avisos}.js` | Editados à mão pela equipe | 3, 8 |
| `site-acessivel/locais/shopping-estacao/{dados,grafo,malha,dados3d}.js` + `grafo.json` | Gerados por `ferramentas/dados/gerar-local.mjs` | 3, 12, 13 |
| `site-acessivel/js/local.js` | `naviLocal()` e `NaviLocal` (escolher, carregar e montar o local) | 3, 6 |
| `site-acessivel/js/rotas.js` | + `criarGrafo11`, `usarMalha`, `G.pontoDoLugar`, `G.referencias` | 1, 5 |
| `site-acessivel/js/interdicoes.js` | `NaviInterdicoes`: avisos, ids antigos, bloqueio por equipamento | 7 |
| `site-acessivel/js/estado.js`, `voz.js`, `libras.js` | Preferências e parâmetros; voz e anúncios; VLibras | 9 |
| `site-acessivel/js/mapa-renderer.js` | Contrato `MapRenderer` (JSDoc) e `NaviMapa.vistaPossivel` | 10, 11 |
| `site-acessivel/js/mapa2d.js` | `NaviMapa2D` — o SVG que hoje está em `app.js` | 10 |
| `site-acessivel/js/mapa3d-renderer.js`, `mapa-glb.js` | Adaptador sobre `mapa3d.js`; stub do `.glb` | 11 |
| `site-acessivel/js/app.js` | Controlador da página única, cada vez mais fino | 6–11 |
| `ferramentas/dados/gerar-local.mjs` | Dados legados → pasta do local (ids estáveis, portas) | 3, 12, 13 |
| `ferramentas/dados/validar-grafo.js` | Regras do grafo 1.1 e relatório | 4 |
| `ferramentas/dados/entrada/shopping-estacao/` | `local.json`, `correcoes.json` e os arquivos legados | 3, 6, 13 |
| `testes/apoio/local-node.js` | Carrega um local no Node (vm), para os testes de dados | 3 |
| `testes/m1a/aparencia.spec.js` | Guarda temporária de "sem mudança visível" (apagar na M1b) | 0 |

---

### Task 0: Branch, guarda de aparência e linha de base verde

**Files:**
- Create: `testes/m1a/aparencia.spec.js`
- Modify: `playwright.config.js` (projeto `aparencia`)

**Interfaces:**
- Produces: imagens de referência em `testes/m1a/aparencia.spec.js-snapshots/`, geradas no ponto de partida do branch, antes de qualquer mudança no site.
- Produces: `planejarRota(page, { perfil, destino, entrada })` movida de `testes/comportamento/rota.spec.js` para `testes/apoio/navi.js` (mesma assinatura e retorno: número de toques), para os testes novos reutilizarem.

- [ ] **Step 1:** Com superpowers:using-git-worktrees, criar o branch `m1a/fundacao` a partir de `fase-0/auditoria` (se a Fase 0 já estiver em `main`, partir de `main`). Rodar `npm test` e confirmar: 32 passam, 14 falhas esperadas, 8 pulados.
- [ ] **Step 2: Escrever a guarda de aparência.** Projeto `aparencia` no config (`testMatch: /m1a\/.*\.spec\.js$/`, viewports 360 × 640 com `isMobile` e 1440 × 900, `reducedMotion: 'reduce'`). Usar o ajudante `testes/apoio/navi.js` (rede externa vazia) e travar a animação da rota:

```js
const telas = [
  ['perfis', async p => { await N.abrir(p); await N.responderVoz(p, false); }],
  ['busca', async p => { await N.abrir(p); await N.responderVoz(p, false); await N.escolherPerfil(p, 'Mobilidade reduzida');
    if (!(await N.campoBusca(p).isVisible())) await p.getByRole('button', { name: /^Para onde vai/ }).click();
    await N.campoBusca(p).fill('atelier'); }],
  ['rota', async p => { await N.planejarRota(p); }],                       // Acesso Azul → Atelier de Costura
  ['rota-alto-contraste', async p => { await p.addInitScript(() => localStorage.setItem('navi-contraste', '1')); await N.planejarRota(p); }]
];
for (const [nome, preparar] of telas) test(`aparência: ${nome}`, async ({ page }) => {
  await preparar(page);
  await page.addStyleTag({ content: '.rota-fluxo{animation:none!important}' });
  await expect(page).toHaveScreenshot(`${nome}.png`, { maxDiffPixelRatio: 0.001 });
});
```

- [ ] **Step 3:** Gerar as referências: `npx playwright test --project=aparencia --update-snapshots`. Rodar de novo sem a flag: PASS.
- [ ] **Step 4: Commit** — `git add playwright.config.js testes/ && git commit -m "M1a: guarda de aparência (temporária) e planejarRota compartilhada"`.

Nota: as imagens dependem do sistema; quem rodar no Windows gera as suas com `--update-snapshots` antes de mexer no código. A M1b apaga esta pasta.

---

### Task 1: F5 — `criarGrafo` sem efeito colateral

**Files:**
- Modify: `site-acessivel/js/rotas.js:9-67`
- Test: `testes/dados/grafo.spec.js` (teste "F5")

**Interfaces:**
- Produces: `criarGrafo(D)` devolve `G.places` = cópia rasa de `D.places` + o elevador estimado do Piso 1 (`id: 'elevador-piso-1'`); `D` fica intacto. `G.pontoDoLugar(p) = { x: p.x, y: p.y }`.

- [ ] **Step 1: Ajustar o teste.** Tirar `test.fail` do teste F5 e acrescentar:

```js
const G = R.criarGrafo(D);
expect(JSON.stringify(D.places)).toBe(antes);
expect(D.places.length).toBe(214);
expect(G.places.length).toBe(215);
expect(G.lugarPorId['elevador-piso-1'].estimado).toBe(true);
expect(G.pontoDoLugar(G.lugarPorId['1-1401928'])).toEqual({ x: G.lugarPorId['1-1401928'].x, y: G.lugarPorId['1-1401928'].y });
```

- [ ] **Step 2:** `npx playwright test --project=dados -g F5` → FAIL (`D.places.length` 215).
- [ ] **Step 3:** Em `criarGrafo`, trabalhar sobre `const places = D.places.slice()`; o elevador do Piso 1 entra em `places`; a renomeação do elevador do Piso 2 troca o item do array por `{ ...elev2, nome: 'Elevadores' }`. Acrescentar `pontoDoLugar` ao objeto devolvido.
- [ ] **Step 4:** `npm run test:dados` → PASS (F5 verde; os outros como antes).
- [ ] **Step 5: Commit** — `fix(rotas): criarGrafo não altera os dados de entrada (F5)`.

---

### Task 2: F8 — cartões de perfil como botões de verdade

**Files:**
- Modify: `site-acessivel/index.html:78-94`
- Test: `testes/comportamento/abertura.spec.js` (teste "RN30")

- [ ] **Step 1: Ajustar o teste.** Tirar `test.fail` do teste RN30 e acrescentar, para cada perfil:

```js
await expect(page.getByRole('button', { name: 'Deficiência visual', exact: true }))
  .toHaveAccessibleDescription(/Botões e letras grandes/);
```

- [ ] **Step 2:** `npx playwright test -g RN30` → FAIL nos dois projetos.
- [ ] **Step 3:** Tirar `role="list"` do `.perfis` e `role="listitem"` dos botões. Em cada botão, `aria-labelledby="perfil-<p>-nome"` e `aria-describedby="perfil-<p>-desc"`, com os ids no `<strong>` e no `<span>`. Nenhuma classe muda.
- [ ] **Step 4:** `npx playwright test -g "RN30|Abertura" && npx playwright test --project=aparencia` → PASS (aparência idêntica).
- [ ] **Step 5:** Rodar `npm test` inteiro → PASS; o teste F5 e os dois RN30 (celular e computador) deixaram de ser falha esperada.
- [ ] **Step 6: Commit** — `fix(acessibilidade): perfis anunciados como botão (F8, RN30)`.

---

### Task 3: Pasta do local gerada (grafo 1.1, ainda sem portas)

**Files:**
- Create: `ferramentas/dados/gerar-local.mjs`, `ferramentas/dados/entrada/shopping-estacao/local.json`, `correcoes.json` (`{}`), cópias de `js/dados.js`, `js/malha.js` e `js/dados3d.js` como `dados-legado.js`, `malha-legado.js`, `dados3d-legado.js`
- Create: `site-acessivel/js/local.js` (registrador e `NaviLocal.montar`), `site-acessivel/locais/indice.js`, `site-acessivel/locais/shopping-estacao/config.js` e `avisos.js` (conteúdo atual de `js/config.js` e `js/avisos.js`, com o registrador)
- Create (gerados): `site-acessivel/locais/shopping-estacao/{dados.js, grafo.json, grafo.js, malha.js, dados3d.js}`
- Create: `testes/apoio/local-node.js`, `testes/dados/local-gerado.spec.js`, `testes/dados/local.spec.js`

O site ainda não usa esta pasta (Task 6).

**Interfaces:**
- Produces: registrador global `naviLocal(slug) -> objeto` (cria `self.NAVI_LOCAIS[slug] = {}` na primeira chamada). Cada arquivo do local faz `naviLocal('shopping-estacao').<chave> = …` com as chaves `config`, `avisos`, `dados`, `grafo`, `malha`, `lajes`.
- Produces: `dados = { gerado: '2026-10-19', fonte, pisos: { P01: {minX,minY,maxX,maxY}, P02 }, plantas: { P01: [...], P02: [...] }, formas: { [lugarId]: { x, y, w, h, r, poly, estimado? } } }`.
- Produces: `grafo` no esquema 1.1. `malha` = objeto atual sem mudança (chaves `folga` = ordem do andar, `'1'` e `'2'`). `lajes` = `NAVI_3D.lajes` atual.
- Produces: `NaviLocal.montar(slug, registro) -> Local` (pura, roda no Node):
  `Local = { slug, config, avisos, grafo, dados, malha, lajes, andares, lugares, lugar(idOuAlias) -> Lugar|null, andarPorPiso(piso) -> Andar, legado: { places: lugares, plantas: { [ordem]: … }, pisos: { [ordem]: … } } }`, com `andares` ordenados por `ordem`, cada um com `piso = ordem`.
  Lugar canônico: `{ id, nome, cat, categoria, andar, piso, x, y, w, h, r, poly, estimado?, aliases, no_porta, codigo, acessivel }` (`piso` = ordem do andar; `cat` = `categoria`; geometria de `dados.formas[id]`), na ordem de `grafo.lugares`.
- Produces: `testes/apoio/local-node.js` → `carregarLocalNode(slug, { malha = false, pasta? }) -> Local` (roda `js/local.js` e os arquivos do local num `vm` e devolve `NaviLocal.montar`) e `carregarLegado() -> { D, R }` (lê os `*-legado.js` de `ferramentas/dados/entrada/shopping-estacao/` e `js/rotas.js`).
- CLI: `node ferramentas/dados/gerar-local.mjs <slug> --data=AAAA-MM-DD [--saida=<pasta>] [--portas]`.

Valores fixos (de `local.json`): `prefixo: "SHE"`; `andares: [{ "id": "P01", "nome": "Piso 1", "ordem": 1, "altura_m": 0 }, { "id": "P02", "nome": "Piso 2", "ordem": 2, "altura_m": null }]`; `escala_m_por_unidade: null`; `escala_medida_em: null`; `origem: "canto superior esquerdo da planta do Mapa Mall; x para a direita, y para baixo"`; `fonte: "<D.fonte> — planta de <D.gerado>. Sentido das escadas rolantes não confirmado: cada uma aparece nos dois sentidos (F3)."`.

Regras de geração (decisões que o código não deduz):
1. Construir com `criarGrafo(D)` legado (Task 1). Lugares na ordem de `G.places` (214 da planta + elevador do Piso 1 no fim): a ordem decide empates na busca e no "mais próximo".
2. Id de lugar `SHE_<andar>_L<4 dígitos>`, sequência por andar na ordem acima; `aliases: [<id legado>]`. Id de nó `SHE_<andar>_N<4 dígitos>`, na ordem de `D.grafo[piso]`. Se `--saida` já tem `grafo.json`, reaproveitar ids: lugar pelo alias, nó por `andar + round(x) + round(y)`; novos recebem o próximo número livre.
3. Nós: `tipo: "corredor"`, `pos: [x·e, altura_m ?? 0, y·e]` com `e = escala ?? 1`, `ref_modelo: null`.
4. Arestas de corredor: uma por par, `tipo: "caminhada"`, `sentido: "ambos"`, `comprimento_unid = custo` = valor exato do legado (30 ou 30·√2, sem arredondar: arredondar muda empates do Dijkstra), `piso_tatil: "nenhum"`, `inclinacao_pct: null`, `largura_min_m: null`, `equipamento: null`.
5. Equipamentos `ESC_01`…`ESC_03` (na ordem das escadas do Piso 1 em `D.places`) e `ELEV_01` (`posicao_estimada: true`; as escadas, `false`). Cada escada rolante vira **duas** arestas `escada_rolante`, `sentido: "ida"` (P01→P02 e P02→P01), `custo: 60`; o elevador, uma aresta `elevador`, `sentido: "ambos"`, `custo: 90`. `comprimento_unid` = distância horizontal entre as pontas.
6. `lugares[].no_porta` = nó mais próximo do centro (o `noDoLugar` de hoje). `codigo: null`, `acessivel: null` (não há dado; nada inventado), `categoria` = `cat` legado, sem renomear.

- [ ] **Step 1: Escrever os testes** em `testes/dados/local-gerado.spec.js`:

```js
test('grafo.js e grafo.json têm o mesmo conteúdo', …)             // JSON.parse(grafo.json) deep-equal registro.grafo
test('contagens do Shopping', () => {
  expect(g.versao).toBe('1.1');
  expect(g.lugares).toHaveLength(215);
  expect(g.nos).toHaveLength(316);
  expect(g.nos.filter(n => n.andar === 'P01')).toHaveLength(218);
  expect(g.arestas.filter(a => a.tipo === 'caminhada')).toHaveLength(386);
  expect(g.arestas.filter(a => a.tipo === 'escada_rolante' && a.sentido === 'ida')).toHaveLength(6);
  expect(g.equipamentos.map(e => e.id)).toEqual(['ESC_01', 'ESC_02', 'ESC_03', 'ELEV_01']);
});
test('todo id legado é alias de exatamente um lugar', …)          // os 214 ids + 'elevador-piso-1'
test('ids seguem o padrão', …)                                     // /^SHE_P0[12]_L\d{4}$/ e /^SHE_P0[12]_N\d{4}$/
test('a geometria de cada lugar é a do legado', …)                 // formas[id] tem x,y,w,h,r,poly iguais ao D.places pelo alias
test('gerar duas vezes não muda nada além de "gerado"', …)        // gerar em pasta temporária 2× com --data diferentes; comparar sem o campo gerado
```

E em `testes/dados/local.spec.js`:

```js
test('lugar() aceita id novo e alias, e devolve o mesmo objeto', …)  // lugar('1-1401928') === lugar(<id novo>); lugar('nao-existe') === null
test('legado aponta para os mesmos objetos', …)                        // legado.places === lugares; legado.plantas[1] === dados.plantas.P01
test('andares em ordem, com piso = ordem', …)                          // andares.map(a => [a.id, a.piso]) = [['P01', 1], ['P02', 2]]
```

- [ ] **Step 2:** `npm run test:dados -- -g "local-gerado"` → FAIL (arquivos não existem).
- [ ] **Step 3:** Copiar os legados para `ferramentas/dados/entrada/shopping-estacao/`, escrever `local.json`, `js/local.js` (registrador e `montar`), `locais/indice.js` (`[{ slug: 'shopping-estacao', nome: 'Shopping Estação', padrao: true }]`), `config.js` e `avisos.js` do local, e `gerar-local.mjs` com as regras acima. `malha.js` e `dados3d.js` são o conteúdo legado reembrulhado no registrador (ler por script, nunca no contexto). `grafo.js` = `naviLocal('<slug>').grafo = <mesmo JSON>;`.
- [ ] **Step 4:** `node ferramentas/dados/gerar-local.mjs shopping-estacao --data=2026-10-28` e `npm run test:dados` → PASS.
- [ ] **Step 5: Commit** — `feat(dados): pasta do local com grafo 1.1 gerado (ids estáveis, aliases)`.

---

### Task 4: Validador do grafo 1.1 e relatório

**Files:**
- Create: `ferramentas/dados/validar-grafo.js` (CommonJS + CLI), `ferramentas/dados/relatorios/shopping-estacao.md` (gerado)
- Test: `testes/dados/validar-grafo.spec.js`

**Interfaces:**
- Consumes: `carregarLocalNode` (Task 3). O relatório de rotas usa uma busca em largura própria sobre as arestas permitidas, respeitando `sentido`, para não depender do motor.
- Produces: `validarGrafo(grafo, { dados, inclinacaoMaxPct = 8.33 }) -> { erros: string[], avisos: string[], semRotaSemEscada: Array<{ entrada: string, destino: string }> }`. CLI: `node ferramentas/dados/validar-grafo.js <slug>` escreve `ferramentas/dados/relatorios/<slug>.md` e sai com código 1 se houver erro.

Regras (cada erro é uma frase que cita o id e o nome):
1. Ids únicos entre nós, lugares e equipamentos; nenhum alias repete id ou outro alias.
2. Toda aresta aponta para nós existentes; todo `equipamento` de aresta existe em `equipamentos`.
3. Nenhum nó órfão.
4. Todo lugar tem `no_porta` existente, do mesmo andar; o centro (`dados.formas`) e o nó da porta ficam dentro de `dados.pisos[andar]`.
5. `ref_modelo`, quando não é `null`, casa com `/^[A-Z]{2,6}P\d{2}[A-Z]{2,12}_[A-Z0-9]{1,12}$/` (`{PREDIO}{ANDAR}{CATEGORIA}_{ID}`).
6. `escada_rolante` sempre com `sentido: "ida"`.
7. `rampa` com `inclinacao_pct > 8.33` (limite da NBR 9050) vira **aviso** com o id e entra no relatório como excluída das rotas sem escada.
8. `semRotaSemEscada`: de cada lugar de categoria `entrada` a cada outro lugar, sem `escada`, `escada_rolante` e rampas acima do limite.

- [ ] **Step 1: Escrever os testes.** Um teste por regra com um grafo sintético mínimo (2 andares, 4 nós, 2 lugares, 1 equipamento), cada um quebrando só a regra testada e conferindo a frase do erro. E o teste do Shopping:

```js
const r = validarGrafo(local.grafo, { dados: local.dados });
const fora = r.erros.filter(e => /fora dos limites/.test(e));
expect(fora.map(e => e.match(/\(([^)]+)\)/)[1])).toEqual(['La Maçã', 'Saida de Emergencia']); // F1 — vira [] na Task 13
expect(r.erros.filter(e => !/fora dos limites/.test(e))).toEqual([]);
expect(r.semRotaSemEscada).toEqual([]);
```

- [ ] **Step 2:** `npm run test:dados -- -g validar` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `validarGrafo` e a CLI. O relatório `.md` tem três seções: erros, avisos e "Destinos sem rota sem escada, por entrada" (lista vazia escrita como "nenhum").
- [ ] **Step 4:** `node ferramentas/dados/validar-grafo.js shopping-estacao` (sai 1, com os 2 erros de F1) e `npm run test:dados` → PASS.
- [ ] **Step 5:** Acrescentar ao `package.json`: `"validar": "node ferramentas/dados/validar-grafo.js shopping-estacao"`.
- [ ] **Step 6: Commit** — `feat(dados): validador do grafo 1.1 e relatório do Shopping`.

---

### Task 5: Motor sobre o grafo 1.1 (`criarGrafo11`)

**Files:**
- Modify: `site-acessivel/js/rotas.js`
- Test: `testes/dados/motor11.spec.js`, `testes/dados/equivalencia.spec.js` (temporário; a Task 12 apaga)

**Interfaces:**
- Consumes: `carregarLocalNode` e o Lugar canônico da Task 3.
- Produces: `NaviRotas.criarGrafo11(grafo, lugares, { referencias } = {}) -> G` com os mesmos campos de `criarGrafo` — `nos` (`{ id: índice, idGrafo, piso, x, y, tipo }`), `viz`, `porPiso` (chave = ordem do andar), `conexoes` (`{ tipo: 'escada'|'elevador', a, b, lugares, custo, equipamento }`, `a` no andar de menor ordem), `maisProximo`, `noDoLugar`, `lugarPorId` (só ids canônicos), `places` (= o mesmo array `lugares`), `pontoDoLugar` — mais `equipamentoDoLugar(lugarId) -> string|null`, `lugaresDoEquipamento(equipId) -> string[]` e `referencias`.
- Produces: `NaviRotas.usarMalha(M)` (troca a malha usada pelo refino; `null` desliga).

Mapeamentos (decididos aqui):
- `caminhada` e `rampa` → tipo interno `corredor`; `escada` e `escada_rolante` → `escada`; `elevador` e `plataforma` → `elevador`. Rampa com `inclinacao_pct > 8.33` → `escada` (a opção `semEscadas` já a exclui).
- `sentido: "ambos"` → `viz` nos dois sentidos; `"ida"` → só `de → para`.
- `x = pos[0] / e`, `y = pos[2] / e`, `e = escala ?? 1`.
- `lugares` de uma conexão = lugares cujo `no_porta` é ponta de uma aresta daquele equipamento.
- `pontoDoLugar(l)` = posição do nó de `no_porta` se o `tipo` dele for `porta` ou `acesso`; senão o centro do lugar.
- `rota()` usa `G.pontoDoLugar` nas duas pontas e só acrescenta o ponto se ele estiver a mais de 1 unidade do primeiro/último ponto do trecho. `pertoDe(p)` usa `G.referencias?.[p.cat]` antes do texto genérico; o texto genérico de `museu` vira `'do museu'` (o Shopping volta a ter "do Museu Ferroviário" pelo config na Task 8; até lá, o teste de equivalência passa `referencias: { museu: 'do Museu Ferroviário' }`).

- [ ] **Step 1: Escrever os testes** em `motor11.spec.js`:

```js
test('aresta "ida" só vale num sentido', …)            // grafo sintético: rota(a→b) existe, rota(b→a) null
test('rampa acima de 8,33% sai das rotas sem escada', …) // semEscadas: null; sem a opção: rota existe
test('criarGrafo11 não altera as entradas', …)           // JSON.stringify(grafo) e (lugares) iguais antes e depois
test('o poço do elevador fica no Piso 2', …)             // G.nos[G.conexoes.find(c => c.tipo === 'elevador').b].piso === 2
test('lugares de cada equipamento', …)                    // G.lugaresDoEquipamento('ELEV_01') tem 2 ids; ESC_02 tem 2
```

E em `equivalencia.spec.js`, comparando `criarGrafo(Dlegado)` com `criarGrafo11(grafo, lugares, { referencias: { museu: 'do Museu Ferroviário' } })`, lugar a lugar pelo alias:

```js
for (const opcoes of [{ malha: false }, { malha: false, semEscadas: true }])
  for (const e of entradas) for (const p of lugares) {           // 3 × 215 × 2
    const a = R.rota(Gv, ev, pv, opcoes), b = R.rota(Gn, en, pn, opcoes);
    expect(!!b).toBe(!!a);
    if (a) { expect(b.passos.map(s => s.texto)).toEqual(a.passos.map(s => s.texto));
             expect(b.trechos.map(t => t.piso)).toEqual(a.trechos.map(t => t.piso));
             expect([b.usaEscada, b.usaElevador]).toEqual([a.usaEscada, a.usaElevador]); }
  }
// e uma amostra com malha: as 3 entradas × 1 a cada 14 lugares, com usarMalha(malha)
```

- [ ] **Step 2:** `npm run test:dados -- -g "motor11|equivalencia"` → FAIL (`criarGrafo11` não existe).
- [ ] **Step 3:** Implementar os acréscimos em `rotas.js`. `caminho`, `instrucoes`, `refinarTrecho` e `simplificar` não mudam.
- [ ] **Step 4:** `npm run test:dados` → PASS (inclusive os testes da Fase 0).
- [ ] **Step 5: Commit** — `feat(rotas): adaptador criarGrafo11 para o grafo 1.1 (equivalente ao motor atual)`.

---

### Task 6: `NaviLocal` — o site passa a ler `locais/<slug>/`

**Files:**
- Modify: `site-acessivel/js/local.js`, `site-acessivel/index.html` (scripts), `site-acessivel/js/app.js` (início e fim do arquivo; linhas 4-6, 32, 49, 1010-1019)
- Delete: `site-acessivel/js/{dados,malha,config,avisos,dados3d}.js` (os legados já estão em `ferramentas/dados/entrada/`)
- Modify: `testes/dados/grafo.spec.js` (passa a usar `carregarLocalNode`), `site-acessivel/LEIA-ME.txt`, caminhos de saída em `ferramentas/dados/{gen-data.js,malha.py,lajes.py}`
- Test: `testes/dados/local.spec.js`, `testes/comportamento/carregamento.spec.js`

**Interfaces:**
- Produces: `NaviLocal.slugDaUrl(search, indice) -> string`: devolve o slug se casar com `/^[a-z0-9-]{1,40}$/` e estiver no índice; senão, o `padrao` do índice.
- Produces: `NaviLocal.carregar(slug, { malha = true, base = 'locais/' } = {}) -> Promise<Local>`: injeta `config.js`, `dados.js`, `grafo.js`, `avisos.js` e, se pedido, `malha.js`, todos com `async = false`; rejeita com `Error('Não foi possível carregar os dados do local <slug>.')` se algum falhar. Também `NaviLocal.carregarLajes(local) -> Promise<lajes>` para o 3D.
- `app.js` vira `(async function () { const local = await NaviLocal.carregar(NaviLocal.slugDaUrl(location.search, self.NAVI_LOCAIS_INDICE)); … })()`: `D = local.legado`, `R.usarMalha(local.malha)`, `G = R.criarGrafo11(local.grafo, local.lugares, { referencias: { museu: 'do Museu Ferroviário' } })` (a Task 8 troca pelo config), `CONFIG = local.config`, avisos oficiais de `local.avisos`, link direto com `local.lugar(id)`. Todo aviso (oficial ou do aparelho) passa por `local.lugar(aviso.lugar)` e fica com o id canônico; aviso de lugar desconhecido é descartado. Sem isso, os avisos guardados com ids antigos sumiriam nesta Task (a Task 7 leva essa regra para `NaviInterdicoes`). O 3D carrega as lajes com `NaviLocal.carregarLajes` e põe `window.NAVI_3D = { lajes }` antes de iniciar `mapa3d.js`. Falha no carregamento → `#conteudo` recebe `<p role="alert">Não foi possível carregar os dados deste local. Verifique a conexão e recarregue a página.</p>`.

- [ ] **Step 1: Escrever os testes.** Em `testes/dados/local.spec.js`:

```js
const casos = [['', 'shopping-estacao'], ['?local=shopping-estacao', 'shopping-estacao'], ['?local=uniopet', 'shopping-estacao'],
               ['?local=../x', 'shopping-estacao'], ['?local=SHOPPING-ESTACAO', 'shopping-estacao']];
for (const [entrada, esperado] of casos)
  test(`slugDaUrl("${entrada}")`, () => expect(NaviLocal.slugDaUrl(entrada, indice)).toBe(esperado));
```

O ajudante `abrir` de `testes/apoio/navi.js` passa a deixar passar o protocolo `file:` (hoje ele trataria os scripts locais como rede externa e responderia vazio).

`testes/comportamento/carregamento.spec.js` (os dois projetos):

```js
test('abre por file:// e calcula a rota', …)          // page.goto(pathToFileURL('site-acessivel/index.html').href); fluxo até "Seu caminho"
test('?local inválido usa o Shopping e não pede arquivo fora dele', …) // ?local=../x: todo request a /locais/ começa com /locais/shopping-estacao/ ou é /locais/indice.js
test('?origem com id antigo e com id novo levam ao Acesso Azul', …)    // os dois mostram o botão "…: Acesso Azul"
test('?origem e ?destino inexistentes abrem os perfis sem erro', …)    // perfis visíveis; N.errosReais(erros) vazio
```

- [ ] **Step 2:** `npm run test:dados -- -g slugDaUrl` e `npx playwright test -g carregamento` → FAIL.
- [ ] **Step 3:** Implementar `NaviLocal`, trocar os `<script>` do `index.html` por `locais/indice.js`, `js/local.js`, `js/rotas.js`, `js/app.js`, envolver `app.js` como acima, apagar os 5 arquivos legados do site, atualizar `grafo.spec.js` (o teste "214 lugares" vira "215 lugares: 214 da planta + o elevador estimado do Piso 1"), o `LEIA-ME.txt` (ARQUIVOS, LINK DIRETO e o e-mail da equipe agora em `locais/shopping-estacao/config.js`) e os caminhos de saída dos geradores.
- [ ] **Step 4:** `npm test` inteiro e `npx playwright test --project=aparencia` → PASS.
- [ ] **Step 5: Commit** — `feat(local): site lê os dados de locais/<slug>/ (?local=, ids antigos, file://)`.

---

### Task 7: Interdições por equipamento e ids antigos (`NaviInterdicoes`)

**Files:**
- Create: `site-acessivel/js/interdicoes.js`
- Modify: `site-acessivel/js/app.js:38-67` (avisos) e os usos de `todosAvisos`, `avisoDe`, `bloqueados`, `avisosLocais`, `salvarAvisosLocais`; `index.html` (script)
- Test: `testes/dados/interdicoes.spec.js`, `testes/comportamento/rota.spec.js` (+1 teste)

**Interfaces:**
- Consumes: `Local.lugar`, `G.equipamentoDoLugar`, `G.lugaresDoEquipamento`.
- Produces: `NaviInterdicoes.criar({ local, G, armazenamento = localStorage }) -> { todos(), de(lugarId), bloqueados(), oficiais(), meus(), registrar(aviso), remover(indice) }`. `Aviso = { lugar: <id canônico>, tipo: 'interditado'|'danificado'|'obstaculo', detalhe, criado?|desde?, oficial? }`. Ids antigos ou desconhecidos: os antigos viram o id canônico ao ler; os desconhecidos são ignorados sem erro. `registrar` grava sempre o id canônico em `navi-avisos`. Se o armazenamento falhar, os avisos ficam em memória (como hoje).
- Regra de bloqueio (igual à de hoje, generalizada): `interditado` bloqueia o lugar; `danificado` bloqueia o lugar se ele for `escada` ou `elevador`; quando o lugar pertence a um equipamento, bloqueia todos os lugares desse equipamento. `obstaculo` não bloqueia.

- [ ] **Step 1: Escrever os testes** (armazenamento falso `{ getItem, setItem }`):

```js
test('aviso antigo do elevador (2-22327) bloqueia as portas dos dois pisos', …)   // bloqueados() = os 2 lugares de ELEV_01; todos()[0].lugar é o id novo
test('alias "elevador-piso-1" também funciona', …)
test('escada rolante danificada bloqueia só aquele equipamento', …)              // rota sem semEscadas não usa ESC_02; semEscadas continua igual
test('obstáculo não bloqueia; loja interditada bloqueia só a loja', …)
test('aviso com lugar desconhecido é ignorado', …)
test('registrar grava o id novo e remover apaga', …)
```

Em `rota.spec.js`: `test('aviso antigo "elevador-piso-1" no aparelho: sem rota sem escada e SAC', …)` — o mesmo fluxo do teste RN16/RN17 com esse id.
- [ ] **Step 2:** `npm run test:dados -- -g interdicoes` → FAIL.
- [ ] **Step 3:** Implementar e trocar as funções de avisos do `app.js` pela instância (`Object.defineProperty(E, 'avisos', { get: () => interdicoes.todos() })` continua, para o 3D).
- [ ] **Step 4:** `npm run test:dados && npx playwright test -g "interdi|aviso|RN16"` → PASS.
- [ ] **Step 5: Commit** — `feat(avisos): interdição por equipamento e leitura de ids antigos`.

---

### Task 8: Textos do local no config

**Files:**
- Modify: `site-acessivel/locais/shopping-estacao/config.js`, `site-acessivel/js/app.js` (linhas 24, 36-37, 254, 279, 309, 405, 417-421, 488, 503, 608, 732, 963), `site-acessivel/js/rotas.js:157-160`, `site-acessivel/js/mapa3d.js:438,518`
- Test: `testes/dados/textos-de-local.spec.js`, `testes/comportamento/rota.spec.js` (+1)

**Interfaces:**
- Produces: config do local com chaves genéricas — `nome`, `urlSite`, `whatsapp`, `telefone`, `telefoneLink`, `faleConosco`, `emailEquipe` — e:

```js
textos: {
  oLocal: 'o shopping', aoLocal: 'ao shopping', noLocal: 'no shopping', doLocal: 'do shopping',
  doLocalNome: 'do Shopping Estação', sac: 'o SAC, no Piso 1', entradasFalado: 'Vermelho, Azul ou Verde',
  elevadorEstimado: 'A posição do elevador no Piso 1 foi estimada a partir da planta do Piso 2. Confirme com o SAC se o elevador está funcionando.',
  historico3d: 'Museu Ferroviário (antiga estação)', historico3dLongo: 'Museu Ferroviário — antigo prédio da estação'
},
referencias: { museu: 'do Museu Ferroviário' },
atalhos: [['sanitario', 'Sanitário mais próximo'], ['informacao', 'SAC / informações'], ['saida', 'Saída mais próxima'],
          ['elevador', 'Elevador'], ['caixa', 'Caixa eletrônico'], ['familia', 'Espaço Família']],
coresEntradas: { '<id novo do Acesso Vermelho>': '#E5484D', '<id do Azul>': '#3B82C4', '<id do Verde>': '#2FA866' }
```

Todo texto que a pessoa vê fica **idêntico** ao de hoje; só a origem muda. `mapa3d.js` recebe `textos` pelo objeto `ao` de `iniciar`. A cor padrão de entrada sem cor no config continua `#12233F`.

- [ ] **Step 1: Escrever os testes.** `textos-de-local.spec.js` lê `site-acessivel/js/*.js` (menos `three-navi.min.js`), tira comentários `/* … */` e `//` até o fim da linha (menos quando o `//` vem logo depois de `:`, como em URLs), e espera zero ocorrências de `/Shopping|Estação|Mapa Mall|\bPiso [0-9]|Acesso (Azul|Verde|Vermelho)|Museu Ferrovi|shopping/`. Em `rota.spec.js`: registrar um aviso e conferir que o texto pronto começa com "Aviso pelo Navi, mapa acessível do Shopping Estação" e que existe o link "Enviar ao shopping pelo WhatsApp".
- [ ] **Step 2:** `npm run test:dados -- -g textos` → FAIL (lista as ocorrências).
- [ ] **Step 3:** Mover os textos e as chaves para o config; o `app.js` lê `local.config`.
- [ ] **Step 4:** `npm test && npx playwright test --project=aparencia` → PASS.
- [ ] **Step 5: Commit** — `refactor(local): textos, atalhos e cores do local vêm do config`.

---

### Task 9: Módulos compartilhados — estado, voz, Libras

**Files:**
- Create: `site-acessivel/js/estado.js`, `site-acessivel/js/voz.js`, `site-acessivel/js/libras.js`
- Modify: `site-acessivel/js/app.js:9-10, 81-135, 1010-1016`, `index.html` (scripts)
- Test: `testes/dados/estado-voz.spec.js`, `testes/comportamento/abertura.spec.js` (+1)

**Interfaces:**
- Produces: `NaviEstado = { CHAVES: { perfil: 'navi-perfil', voz: 'navi-voz', contraste: 'navi-contraste', texto: 'navi-texto', vista: 'navi-vista', avisos: 'navi-avisos' }, ler(chave), guardar(chave, valor), parametros(search) -> { local, perfil, origem, destino } }` (`ler`/`guardar` recebem o nome curto, aceitam um `armazenamento` opcional como último argumento e nunca lançam erro).
- Produces: `NaviVoz.criar({ regiao, avisoEl, perfil: () => string, vozLigada: () => boolean, sintese = window.speechSynthesis }) -> { falar(texto, forcar?, opcoes?), anunciar(msg, opcoes?), avisoVisual(msg), cancelar(), temVoz }` — mesmas regras das funções de hoje (fala de foco não interrompe orientação; perfil visual fala a 0,95; perfil auditivo também mostra o aviso visual e vibra; a região é limpa e preenchida 30 ms depois).
- Produces: `NaviLibras = { carregar(), abrir(avisoVisual), estado() }`, com os mesmos textos de hoje.

- [ ] **Step 1: Escrever os testes** (Node, com `sintese` e DOM falsos):

```js
test('falar não fala com a voz desligada, a não ser forçado', …)
test('fala de foco (baixa) não interrompe orientação em andamento', …)
test('anunciar preenche a região depois de 30 ms', …)
test('parametros lê local, perfil, origem e destino', …)   // '?perfil=mobilidade&origem=1-1401928' → { local: null, perfil: 'mobilidade', origem: '1-1401928', destino: null }
```

Em `abertura.spec.js`: `test('perfil auditivo: Libras sem internet avisa por texto', …)` — o botão "Abrir tradutor de Libras" mostra o alerta "Não foi possível carregar o tradutor de Libras. Verifique a conexão com a internet." (a rede externa dos testes responde vazio).
- [ ] **Step 2:** `npm run test:dados -- -g estado-voz` → FAIL.
- [ ] **Step 3:** Extrair os módulos; `app.js` passa a usá-los e perde as funções movidas.
- [ ] **Step 4:** `npm test && npx playwright test --project=aparencia` → PASS.
- [ ] **Step 5: Commit** — `refactor: módulos compartilhados de estado, voz e Libras`.

---

### Task 10: `MapRenderer` e `Map2DRenderer`

**Files:**
- Create: `site-acessivel/js/mapa-renderer.js`, `site-acessivel/js/mapa2d.js`
- Modify: `site-acessivel/js/app.js:612-842, 908-930`, `index.html` (envolver `svg#mapa` e `#mapa3d` em `<div id="navi-map-slot">`, sem mudar classes)
- Test: `testes/comportamento/mapa-renderer.spec.js`

**Interfaces:**
- Produces (contrato, JSDoc em `mapa-renderer.js`; o da especificação mais as extensões que o app atual precisa):

```js
/** @typedef {Object} MapRenderer
 * mount(container: HTMLElement): Promise<void>   unmount(): void   // unmount esconde e solta eventos; o estado fica
 * setFloor(andarId: string): void                 showRoute(rota: Rota|null): void        focusStep(indice: number): void
 * highlight(categoria: 'PISO_TATIL'|'RAMPA'|'ELEVADOR'|'ACESSO', ligado: boolean): void
 * applyTheme(tokens: Object<string,string>): void applyPreferences(prefs: { perfil, textoGrande, reduzirMovimento }): void
 * capabilities(): { tresD: boolean, primeiraPessoa: boolean, zoom: boolean }
 * // extensões
 * setMarkers({ origem, destino }): void   setNotices(avisos: Aviso[]): void   setLabels(todos: boolean): void
 * zoomIn(): void   zoomOut(): void   fit(): void   focusRoute(): void   centerOn(ponto: {x,y}, largura?: number): void
 * on(evento: 'selecionar', fn: (lugar) => void): void
 */
```

- Produces: `NaviMapa2D.criar({ local, perfil: () => string }) -> MapRenderer`. Move de `app.js`: `escala`, `aplicarVB`, `ajustar`, `centrarEm`, `enquadrarRota`, `zoom`, `pontoSVG`, `areaPoly`, o desenho de `desenharPiso`, `desenharRota`, `desenharMarcas`, os gestos, a roda, o teclado e o `resize`. Ficam no `app.js` (são da página): botões de piso, `#mapa-desc`, legenda e `#aviso-piso`. Fatores de zoom de hoje: botões 1/1,35 e 1,35; roda 1,15; teclado 1,25; largura entre 180 e 2400.
- `applyTheme` no 2D: põe as propriedades no `svg` — `rota → --rota`, `contornoRota → --rota-casca`, `piso → --planta`, `loja → --loja`, `parede → --loja-contorno`, `quiosque → --quiosque`, `destaque → --destaque-loja`; chaves desconhecidas são ignoradas. `highlight` liga a classe `destaque` nos ícones e formas da categoria (`ELEVADOR` → `elevador`, `ACESSO` → `entrada`); `PISO_TATIL` e `RAMPA` não têm dado no Shopping e não fazem nada.
- `app.js` guarda `const mapas = { r2d, r3d: null }` e `mapa` (o ativo): setters (`setFloor`, `showRoute`, `focusStep`, `setMarkers`, `setNotices`, `setLabels`, `applyPreferences`) vão para os dois renderers criados; câmera (`fit`, `centerOn`, `focusRoute`, `zoom*`) só para o ativo — o mesmo que o código faz hoje com o SVG e `sync3d()`. Debug: `window.Navi.mapas = mapas`.

- [ ] **Step 1: Escrever os testes de contrato** (via `window.Navi.mapas.r2d`, depois de planejar Acesso Azul → Atelier de Costura):

```js
test('2D: capacidades', …)                         // { tresD: false, primeiraPessoa: false, zoom: true }
test('2D: setFloor("P02") desenha o Piso 2', …)    // #mapa-desc contém "Piso 2"; existe path.rota-linha
test('2D: focusStep muda o trecho ativo', …)       // atributo d de path.trecho-ativo muda entre focusStep(0) e focusStep(2)
test('2D: highlight("ELEVADOR") liga e desliga', …) // .icone-mapa.elevador.destaque aparece e some
test('2D: applyTheme troca a cor da rota', …)      // getComputedStyle(path.rota-linha).stroke === 'rgb(18, 52, 86)' com { rota: '#123456' }
test('#navi-map-slot tem tamanho e o SVG o preenche', …) // largura e altura > 0; caixa do svg = caixa do slot (±1 px)
```

- [ ] **Step 2:** `npx playwright test -g "2D:|navi-map-slot"` → FAIL.
- [ ] **Step 3:** Extrair `mapa2d.js`, escrever o contrato e ligar o `app.js`.
- [ ] **Step 4:** `npm test && npx playwright test --project=aparencia` → PASS (aparência idêntica).
- [ ] **Step 5: Commit** — `refactor(mapa): MapRenderer e Map2DRenderer extraídos do app.js`.

---

### Task 11: `Map3DProceduralRenderer`, escolha 2D/3D e stub do `.glb`

**Files:**
- Create: `site-acessivel/js/mapa3d-renderer.js`, `site-acessivel/js/mapa-glb.js`
- Modify: `site-acessivel/js/mapa3d.js` (linhas 38-39: pixel ratio e buffer; `for (const piso of [1, 2])` → andares de `D.pisos`; rótulos do museu vêm de `ao.textos`), `site-acessivel/js/mapa-renderer.js`, `site-acessivel/js/app.js:844-907`
- Test: `testes/comportamento/mapa-renderer.spec.js` (+5)

**Interfaces:**
- Produces: `NaviMapa3DRenderer.criar({ local, G, textos }) -> MapRenderer` + `enterFirstPerson(): Promise<void>`, `exitFirstPerson()`, `inFirstPerson` (getter), `setBothFloors(on)`, `topView()`, `on('saiuPrimeiraPessoa', fn)` e `renderer` (getter do `WebGLRenderer`, para os testes). `mount` carrega na primeira vez `js/three-navi.min.js`, as lajes (`NaviLocal.carregarLajes`) e `js/mapa3d.js`, e chama `NaviMapa3D.iniciar(container, local.legado, G, …)`; as próximas vezes só mostram a cena guardada. Rejeita se não houver WebGL.
- Produces: `NaviMapa.detectarWebGL() -> boolean` (cria um `canvas` e tenta `webgl2`, `webgl` e `experimental-webgl`; `mapa3d.js` ainda não foi carregado nessa hora) e `NaviMapa.vistaPossivel(pedido: '2d'|'3d', ambiente = { webgl: NaviMapa.detectarWebGL(), memoria: navigator.deviceMemory }) -> { vista, motivo }`: 3D só com WebGL e `memoria` ausente ou > 2. Sem 3D, o app anuncia o texto de hoje: "A vista 3D não funciona neste navegador ou aparelho. Continuamos no mapa 2D."
- Produces: `NaviMapaGlb.criar() -> MapRenderer` cujo `mount` rejeita com `Error('Map3DGlbRenderer ainda não implementado (Marco 3)')` e `capabilities()` = `{ tresD: true, primeiraPessoa: false, zoom: true, disponivel: false }`. O JSDoc registra que o Marco 3 precisa reempacotar o Three.js com `GLTFLoader` e `MeshoptDecoder` (esbuild), carregados só quando pedidos.
- Desempenho em `mapa3d.js`: `setPixelRatio(Math.min(devicePixelRatio || 1, 1.5))` e `preserveDrawingBuffer: false`; o laço continua desenhando só quando `precisa` é verdadeiro. A troca de material fica para a M1c, junto com as cores novas (mudaria a aparência).

- [ ] **Step 1: Escrever os testes:**

```js
test('3D: mount, capacidades e primeira pessoa com a mesma rota', …) // capabilities().primeiraPessoa; enter/exit; o resumo de passos não muda
test('3D: pixel ratio ≤ 1,5 e sem preserveDrawingBuffer', …)          // r3d.renderer.getPixelRatio() <= 1.5; getContextAttributes().preserveDrawingBuffer === false
test('pouca memória: fica no 2D e avisa', …)   // addInitScript: deviceMemory = 2; clicar "Mapa 3D": aria-pressed continua "false"; região de status com o texto; console sem erro
test('sem WebGL: fica no 2D e avisa', …)       // addInitScript: getContext('webgl'|'webgl2'|'experimental-webgl') devolve null
test('#navi-map-slot: o canvas 3D preenche o slot', …)
test('GLB: o stub recusa o mount com a mensagem do Marco 3', …)
```

- [ ] **Step 2:** `npx playwright test -g "3D:|memória|WebGL|GLB"` → FAIL.
- [ ] **Step 3:** Implementar; `definirVista` do `app.js` passa a usar `vistaPossivel` e os renderers.
- [ ] **Step 4:** `npm test` (RN45–RN48 verdes) e `npx playwright test --project=aparencia` → PASS.
- [ ] **Step 5: Commit** — `refactor(mapa): renderer 3D sobre mapa3d.js, escolha 2D/3D e stub do .glb`.

---

### Task 12: F2 — a rota termina na porta do lugar

**Files:**
- Modify: `ferramentas/dados/gerar-local.mjs` (`--portas` passa a ser o padrão), `site-acessivel/locais/shopping-estacao/grafo.{json,js}` (regenerados)
- Modify: `testes/dados/grafo.spec.js` (teste F2), `testes/m1a/aparencia.spec.js-snapshots/rota-*.png` (atualizadas e revisadas)
- Delete: `testes/dados/equivalencia.spec.js` (cumpriu o papel: a Task 12 muda as rotas de propósito)

**Interfaces:**
- Produces: para cada lugar que não é `escada` nem `elevador`, um nó `tipo: "porta"` (`"acesso"` para `entrada`) no ponto da porta, ligado por uma aresta `caminhada`/`ambos` ao nó de corredor escolhido; `no_porta` aponta para ele. Escadas e elevadores mantêm o `no_porta` atual (a ponta das arestas do equipamento).

Algoritmo da porta (calibrado no Shopping: resolve 211 dos 214 lugares, mediana de 11 e máximo de 58 unidades até o corredor):
1. Contorno = polígono da planta (`poly ≥ 0`) ou o retângulo `w × h` girado por `r` em volta de `(x, y)`.
2. Candidatos = os 24 nós de corredor do andar mais próximos do contorno (distância nó → contorno).
3. Para cada candidato, em ordem: ponto da porta = ponto do contorno mais perto do nó; aceitar se todas as amostras do segmento nó → porta, a cada 3 unidades, tiverem folga da malha ≥ 1, exceto nas últimas 18 unidades antes da porta.
4. Sem candidato aceito ou porta a mais de 60 unidades do nó: não criar porta, manter o `no_porta` antigo e registrar o lugar no relatório do validador como "sem caminho até a porta". Hoje são La Maçã, Saida de Emergencia (`1-35749`) e Pagamento do Estacionamento (`2-2119510`) — os mesmos dados de F1.

- [ ] **Step 1: Escrever o teste F2** (substitui o da Fase 0):

```js
const PENDENTES_F1 = ['1-2484249', '1-35749', '2-2119510'];   // esvazia na Task 13
for (const l of lugares.filter(l => !['escada', 'elevador'].includes(l.cat) && !l.aliases.some(a => PENDENTES_F1.includes(a)))) {
  const porta = noPorId[l.no_porta];
  expect(['porta', 'acesso']).toContain(porta.tipo);
  expect(distanciaAoCorredor(porta)).toBeLessThanOrEqual(60);
}
// e: a rota Acesso Azul → Renner termina no ponto da porta da Renner, não no centro
```

- [ ] **Step 2:** `npm run test:dados -- -g F2` → FAIL.
- [ ] **Step 3:** Implementar no gerador, regenerar com `--data` do dia, rodar `npm run validar` (só os erros de F1). O motor não muda: `pontoDoLugar` (Task 5) já usa a porta.
- [ ] **Step 4:** `npm test` → PASS. Rodar `npx playwright test --project=aparencia`: as telas `rota-*` mudam; conferir as diferenças (a linha agora para na porta) e só então `--update-snapshots`.
- [ ] **Step 5: Commit** — `fix(rotas): a rota termina na porta do lugar (F2)`.

---

### Task 13: F1 — posições corrigidas (depende das respostas da equipe)

**Files:**
- Modify: `ferramentas/dados/entrada/shopping-estacao/correcoes.json`, `ferramentas/dados/gerar-local.mjs` (aplicar correções), dados regenerados
- Modify: `testes/dados/grafo.spec.js` (F1 sem `test.fail`), `testes/dados/validar-grafo.spec.js` (lista de F1 vazia), teste F2 (`PENDENTES_F1 = []`)

**Interfaces:**
- Produces: `correcoes.json` = `{ "<id legado>": { "x"?, "y"?, "w"?, "h"?, "r"?, "andar"? } | { "remover": true } }`, aplicado pelo gerador sobre o legado antes de tudo. Um lugar removido sai de `lugares` e `formas`; o alias dele deixa de resolver (link antigo cai no caso "id inexistente" da Task 6).

- [ ] **Step 1:** Registrar as respostas da equipe em `correcoes.json` (as três perguntas de F1, no topo deste plano).
- [ ] **Step 2:** Tirar `test.fail` do teste F1, esvaziar a lista de F1 no teste do validador e `PENDENTES_F1`. `npm run test:dados` → FAIL.
- [ ] **Step 3:** Aplicar as correções no gerador e regenerar.
- [ ] **Step 4:** `npm run validar` sai 0; `npm test` → PASS.
- [ ] **Step 5: Commit** — `fix(dados): posições confirmadas de La Maçã, saída de emergência e pagamento do estacionamento (F1)`.

---

### Task 14: Fechamento da M1a

- [ ] **Step 1:** `npm test` inteiro e `npx playwright test --project=aparencia` → tudo verde; contar e registrar passados, falhas esperadas (F3, F4, F6, F7, F9, RN17) e pulados.
- [ ] **Step 2:** `npm run validar` → 0 erros; anexar `ferramentas/dados/relatorios/shopping-estacao.md` ao PR.
- [ ] **Step 3: Conferência manual** (Definição de pronto, Documento 03), registrada no PR: abrir por dois cliques no `index.html`; 320, 375 e 390 px e 1440 px; fluxo principal com TalkBack (Android) e NVDA (Windows); 3D e primeira pessoa num celular real.
- [ ] **Step 4:** superpowers:requesting-code-review sobre o branch inteiro; tratar a revisão com superpowers:receiving-code-review.
- [ ] **Step 5:** superpowers:finishing-a-development-branch: abrir o PR `m1a/fundacao` para o Leonardo, com o que mudou, regras afetadas (nenhuma), testes rodados e pendências (F3, F4, altura do Piso 2).
