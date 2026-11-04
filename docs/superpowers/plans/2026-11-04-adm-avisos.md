# Área ADM e confirmação de avisos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisos do "Avisar sobre um local" chegam a uma Área ADM no Supabase. Um ADM confirma, recusa ou resolve cada aviso, e o confirmado vale para todos na hora.

**Architecture:** `js/servidor.js` é a única porta para o Supabase (REST e Auth por `fetch`, sem biblioteca). `js/fila-avisos.js` guarda os avisos feitos sem internet. `js/interdicoes.js` junta os confirmados do servidor aos oficiais. A Área ADM é uma página nova, `adm.html`. O Supabase recebe o SQL com RLS e a Edge Function `criar-adm`.

**Tech Stack:** HTML, CSS e JS puros; Supabase (Postgres, RLS, Auth, Edge Functions em Deno); Playwright para os testes.

**Spec:** `docs/superpowers/specs/2026-11-04-adm-avisos-design.md`

## Global Constraints

- Sem build e sem biblioteca no navegador. O site precisa abrir sem internet.
- Com `js/servidor-config.js` vazio (`url: ''`), o site se comporta exatamente como hoje, e a suíte atual passa sem mudanças.
- Nenhum dado pessoal no aviso: só `local`, `lugar`, `tipo` e `detalhe` (até 280 caracteres).
- Usuário de 3 a 30 caracteres no padrão `^[a-z0-9.-]{3,30}$`, e-mail `<usuario>@adm.navi`, senha com pelo menos 8 caracteres. Primeiro ADM: `naviadm` / `12345678`.
- Pedidos sem login mandam só o cabeçalho `apikey`. Pedidos de ADM mandam `apikey` e `Authorization: Bearer <access_token>`.
- Chaves do aparelho:
  - `navi-avisos-fila`: avisos esperando envio (localStorage);
  - `navi-avisos-servidor`: cópia dos confirmados, por local (localStorage);
  - `navi-adm-sessao`: sessão do ADM (sessionStorage).
- O painel confere avisos a cada `window.NAVI_ADM_INTERVALO_MS || 30000` ms.
- As regras RN66–RN70 entram no Documento 04 como "aguardando aprovação" (X).

## Review Focus

1. **Supabase fora do ar ou lento ao abrir a página:** a rota aparece na hora, com a cópia guardada; nada trava esperando o servidor. *Teste:* Task 4, com `/rest/v1/avisos` respondendo 500.
2. **Token do ADM vencido no meio do uso:** o painel renova a sessão uma vez e repete o pedido; se falhar, volta ao login com "Sua sessão terminou. Entre de novo." *Teste:* Task 2 (`servidor.js`, 401 seguido de refresh).
3. **Aviso confirmado para um lugar que não existe no grafo:** é ignorado, sem erro na página. *Teste:* Task 3.
4. **Aviso feito offline e repetido:** a fila não envia o mesmo aviso duas vezes depois de um envio bem-sucedido. *Teste:* Task 3.
5. **ADM confirma um cartão com vários avisos agrupados:** todos os ids do grupo mudam juntos. *Teste:* Task 6.

---

### Task 1: Supabase — SQL, Edge Function e passo a passo

**Files:**
- Create: `supabase/migracao.sql`
- Create: `supabase/functions/criar-adm/index.ts`
- Create: `supabase/LEIA-ME.md`

**Interfaces:**
- Produces:
  - tabelas `avisos` e `adms`, com as colunas da especificação, e a função `eh_adm()`;
  - endpoint `POST /functions/v1/criar-adm`, corpo `{usuario, senha}`, respostas 201 `{usuario}`, 400 `{erro}`, 401, 403 e 409 `{erro:'existe'}`.

- [ ] **Step 1:** escrever `migracao.sql` com as tabelas, CHECKs, índice `(local, situacao)`, `eh_adm()` com `security definer`, RLS e políticas, além das permissões por coluna:
  - visitante: `insert` em `local, lugar, tipo, detalhe` e `select`;
  - ADM: `update` em `situacao, decidido_em, decidido_por`.
- [ ] **Step 2:** escrever a Edge Function. Ela:
  - responde ao CORS e ao `OPTIONS`;
  - valida o token com `auth.getUser`, confere `adms`, valida usuário e senha;
  - cria o usuário com `email_confirm: true` e insere em `adms`, desfazendo o usuário se a inserção falhar.
- [ ] **Step 3:** escrever o `LEIA-ME.md`:
  - criar o projeto;
  - rodar o SQL;
  - desligar o cadastro público;
  - criar o `naviadm@adm.navi` e inseri-lo em `adms`;
  - publicar a função com `supabase functions deploy criar-adm`;
  - preencher o `servidor-config.js`.
- [ ] **Step 4:** commit.

### Task 2: `js/servidor.js` e `js/servidor-config.js`

**Files:**
- Create: `site-acessivel/js/servidor-config.js` (`self.NAVI_SERVIDOR = { url: '', chavePublica: '' }`)
- Create: `site-acessivel/js/servidor.js`
- Test: `testes/dados/servidor.spec.js`, com um `fetch` falso que grava os pedidos.

**Interfaces:**
- Produces: `NaviServidor.criar({ config?, fetch?, armazenamento?, sessaoArm? })`, que devolve:
  - `configurado(): boolean`
  - `enviarAviso({local, lugar, tipo, detalhe}): Promise<boolean>`
  - `confirmados(local): Promise<Array<{lugar, tipo, detalhe, desde}>|null>` (null em erro). Também guarda a lista em `navi-avisos-servidor`.
  - `confirmadosGuardados(local): Array`
  - `entrar(usuario, senha): Promise<{usuario}>`. Rejeita com `Error('credenciais')`, `Error('nao-adm')` ou `Error('rede')`.
  - `sessao(): {usuario}|null`, `sair(): void`
  - `listarAvisos(local): Promise<Array<aviso completo>>`
  - `decidir(ids: string[], situacao): Promise<void>`
  - `listarAdms(): Promise<Array<{usuario, criado_em}>>`
  - `criarAdm(usuario, senha): Promise<void>`. Rejeita com `Error('existe'|'invalido'|'rede'|'sessao')`.
  - `NaviServidor.emailDe(usuario)` e `NaviServidor.USUARIO` (a expressão regular).

- [ ] **Step 1:** testes:
  - `configurado()` é falso sem `url`;
  - `enviarAviso` faz `POST {url}/rest/v1/avisos` com só `apikey` e corpo com 4 campos, sem `situacao`;
  - `confirmados` usa `?select=lugar,tipo,detalhe,decidido_em&local=eq.predio-teste&situacao=eq.confirmado` e guarda a cópia;
  - `entrar('naviadm','12345678')` manda o e-mail `naviadm@adm.navi`;
  - um 401 seguido de refresh repete o pedido uma vez;
  - `decidir` faz `PATCH ?id=in.(a,b)` com `decidido_por`.
- [ ] **Step 2:** rodar `npx playwright test --project=dados testes/dados/servidor.spec.js`. Espera-se FALHA.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar de novo. Espera-se PASSA.
- [ ] **Step 5:** commit.

### Task 3: fila de avisos e confirmados nas interdições

**Files:**
- Create: `site-acessivel/js/fila-avisos.js`
- Modify: `site-acessivel/js/interdicoes.js`, `site-acessivel/js/servidor.js` (função `ligar`)
- Test: `testes/dados/fila-e-interdicoes.spec.js`

**Interfaces:**
- Produces:
  - `NaviFilaAvisos.criar({ servidor, armazenamento })` → `{ adicionar(aviso): Promise<'enviado'|'fila'>, enviar(): Promise<number>, pendentes(): Array }`
  - `inter.definirDoServidor(lista)`: os confirmados entram em `oficiais()` com `origem: 'servidor'` e `desde`.
  - `NaviServidor.ligar({ local, inter, aoMudar })` → `{ enviar(aviso): Promise<'enviado'|'fila'|'desligado'>, configurado: boolean }`. Usa a cópia guardada na hora, busca no servidor sem bloquear e chama `aoMudar()` só se a lista mudar.

- [ ] **Step 1:** testes:
  - aviso sem rede vai para a fila;
  - `enviar()` com rede esvazia a fila e não reenvia;
  - `definirDoServidor([{lugar:'PCT_P01_L0007', tipo:'danificado'}])` bloqueia o Elevador 1 nos dois andares;
  - um lugar inexistente é ignorado.
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar e ver passar.
- [ ] **Step 5:** commit.

### Task 4: páginas públicas

**Files:**
- Modify:
  - `site-acessivel/js/avisos-ui.js` (opção `enviar`, textos, situação em "Seus avisos");
  - `site-acessivel/js/pagina-rota.js` e `js/pagina-mapa.js` (chamam `NaviServidor.ligar`);
  - `site-acessivel/index.html` (scripts e rodapé "Área ADM");
  - `site-acessivel/mapa.html` (scripts);
  - `site-acessivel/css/rota.css` (rodapé).
- Create: `testes/apoio/supabase-falso.js`, com `simularSupabase(context)` que guarda o estado em memória e tem `naviadm` cadastrado.
- Modify: `testes/apoio/navi.js` (a rota que bloqueia a rede externa deixa passar `*.supabase.co` para o simulador).
- Test: `testes/comportamento/adm-avisos.spec.js` (parte pública).

Textos exatos:
- depois de registrar, com servidor: "Aviso enviado à equipe do Navi. Ele já vale neste aparelho e passa a valer para todos quando um ADM confirmar."
- sem internet: "Sem internet: o aviso será enviado quando a conexão voltar."
- em "Seus avisos": "Aguardando confirmação" ou "Confirmado pela equipe".

- [ ] **Step 1:** testes:
  - registrar um aviso chega ao simulador como pendente;
  - um confirmado no simulador faz a rota de mobilidade até a Sala de reunião ir pela rampa (os dois elevadores confirmados como danificados);
  - com o simulador respondendo 500, a rota aparece mesmo assim;
  - sem configuração, o texto antigo continua.
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar e ver passar.
- [ ] **Step 5:** commit.

### Task 5: Área ADM — login e cadastro de ADM

**Files:**
- Create: `site-acessivel/adm.html`, `site-acessivel/js/pagina-adm.js`, `site-acessivel/css/adm.css`
- Modify: `site-acessivel/sw.js` (PRECACHE e versão), `testes/dados/pwa-arquivos.spec.js` se precisar.
- Test: `testes/comportamento/adm-avisos.spec.js` (login e ADMs).

Textos exatos:
- "Usuário ou senha incorretos."
- "Sem internet. A Área ADM precisa de conexão."
- "O servidor do Navi ainda não foi configurado."
- "Sua sessão terminou. Entre de novo."
- "Esse usuário já existe."
- "As senhas não são iguais."
- "A senha precisa ter pelo menos 8 caracteres."
- Botões: **Entrar**, **Sair**, **Cadastrar ADM**.

- [ ] **Step 1:** testes:
  - login com a senha errada mostra o erro;
  - `naviadm/12345678` abre o painel (h1 "Avisos");
  - cadastrar `maria`/`senha-forte` faz ela aparecer na lista, e repetir mostra "Esse usuário já existe.";
  - Sair volta ao login;
  - sem configuração, aparece o aviso.
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar e ver passar.
- [ ] **Step 5:** commit.

### Task 6: painel de avisos e notificação

**Files:**
- Modify: `site-acessivel/js/pagina-adm.js`, `site-acessivel/css/adm.css`
- Test: `testes/comportamento/adm-avisos.spec.js` (painel)

Textos exatos:
- Abas: **Pendentes**, **Confirmados**, **Recusados e resolvidos**.
- Ações: **Confirmar: local indisponível**, **Recusar**, **Marcar como resolvido**.
- Agrupamento: "N pessoas avisaram".
- Faixa: "Novo aviso: <lugar> — <Tipo>".
- Título da aba: "(n) Navi ADM".
- Anúncio: "<lugar> confirmado como indisponível".

- [ ] **Step 1:** testes:
  - 3 avisos pendentes iguais viram um cartão "3 pessoas avisaram";
  - Confirmar muda os 3 no simulador e o cartão vai para Confirmados;
  - Recusar e Marcar como resolvido funcionam;
  - um aviso novo no simulador aparece sem recarregar (intervalo de 300 ms no teste) e muda o título;
  - sem rolagem lateral a 360 px, alvos de 48 px e axe sem violações.
- [ ] **Step 2:** rodar e ver falhar.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar e ver passar.
- [ ] **Step 5:** commit.

### Task 7: Documento 04, LEIA-ME e verificação final

**Files:**
- Modify: `ferramentas/documentos/doc4a6.js` (grupo novo "Área ADM e avisos" com RN66–RN70 em X; versão 1.4 — 04/11/2026; nota com os ajustes propostos de RN50 e RN55; histórico)
- Regenerate: `documentos/04-Regras-de-Negocio.docx`, `.publicar/04.md`, e escrever no Project.
- Modify: `site-acessivel/LEIA-ME.txt` (seção Área ADM)

- [ ] **Step 1:** atualizar e regenerar.
- [ ] **Step 2:** rodar `npx playwright test`. Espera-se tudo passando.
- [ ] **Step 3:** capturas da Área ADM (celular e computador).
- [ ] **Step 4:** commit e push.
