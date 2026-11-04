# Área ADM e confirmação de avisos — especificação

Versão de 04/11/2026. Branch `adm/avisos`, a partir de `kaizen/predio-teste`.

## Objetivo

Hoje um aviso de local interditado, danificado ou com obstáculo vale só no aparelho de quem avisou. Para valer para todos, alguém da equipe precisa editar `locais/<slug>/avisos.js` e publicar o site.

Com esta mudança:

- os avisos chegam a uma **Área ADM** no próprio site;
- um ADM confirma ou recusa cada aviso;
- o aviso confirmado vale para todos **na hora**, e as rotas desviam;
- quem já é ADM cadastra outros ADMs.

## O que foi pedido e o que foi decidido

| Ponto | Decisão |
|---|---|
| Servidor | Supabase (Auth + banco Postgres). Plano gratuito. |
| Primeiro ADM | Usuário `naviadm`, senha `12345678`, **fixa**. Pedido explícito da equipe, mesmo ciente do risco (ver Riscos). |
| Cadastro de ADM | Só um ADM logado cadastra outro, com usuário e senha. |
| Confirmação | Um aviso confirmado vale para todos na hora. O ADM também pode recusar ou marcar como resolvido. |
| Notificação | No painel ADM aberto: verificação a cada 30 s, título da aba, aviso lido pelo leitor de tela e notificação do navegador, se permitida. Sem e-mail nesta versão. |
| Obstáculo | Continua sem bloquear a rota, mesmo confirmado (regra atual). Mudar isso exige regra nova no Documento 04. |

## Restrições que continuam valendo

- HTML, CSS e JavaScript puros, sem build. O site abre sem internet depois da primeira visita (RN62).
- O motor de rotas (`js/rotas.js`) não muda; só ganha adaptadores.
- Nenhum dado pessoal de quem avisa (RN55): sem nome, sem e-mail, sem posição, sem identificador do aparelho.
- Toda regra nova passa pelo Documento 04 antes do código, com aprovação de Camilly e Leonardo.
- A publicação no Netlify é do Líder Técnico.

## Arquitetura

```
Página de Rota / Página do Mapa            adm.html (Área ADM)
  "Avisar sobre um local"                   login, painel, cadastro de ADM
        │  envia aviso (pendente)                 │  lê todos, decide
        ▼                                         ▼
  js/servidor.js  ──── fetch (REST) ────►  Supabase
        ▲                                    • Auth (ADMs)
        │  lê avisos confirmados             • tabela avisos (RLS)
        │  (cópia guardada para uso offline) • tabela adms
        │                                    • Edge Function criar-adm
  js/interdicoes.js
  oficiais = avisos.js + confirmados do servidor
```

### Arquivos novos

| Arquivo | O que faz |
|---|---|
| `site-acessivel/js/servidor.js` | Única porta para o Supabase, com `fetch` simples (sem biblioteca externa). Envia avisos, lê confirmados, faz login e chama as ações do ADM. Lê a URL e a chave pública de `js/servidor-config.js`. Sem configuração, desliga tudo e o site funciona como hoje. |
| `site-acessivel/js/servidor-config.js` | URL do projeto Supabase e chave pública (*anon key*). A chave pública pode ficar no site; a chave secreta nunca. |
| `site-acessivel/js/fila-avisos.js` | Fila no aparelho (localStorage `navi-avisos-fila`) para os avisos feitos sem internet. Reenvia quando a conexão volta (`online`) e ao abrir o site. |
| `site-acessivel/adm.html`, `js/pagina-adm.js`, `css/adm.css` | A Área ADM: login, painel de avisos e cadastro de ADM. |
| `supabase/migracao.sql` | Tabelas, regras de acesso (RLS) e função auxiliar. |
| `supabase/functions/criar-adm/index.ts` | Edge Function que cria um ADM, conferindo antes se quem pede é ADM. |
| `supabase/LEIA-ME.md` | Passo a passo para a equipe criar o projeto e publicar. |

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `js/interdicoes.js` | `oficiais()` passa a juntar os avisos do `avisos.js` com os confirmados vindos do servidor, marcados `oficial: true` e `origem: 'servidor'`. A regra de bloqueio não muda. |
| `js/avisos-ui.js` | Ao registrar, também envia o aviso ao servidor, ou guarda na fila sem internet. A tela de enviado ganha a frase sobre a confirmação. Em "Seus avisos", cada item mostra "Aguardando confirmação" ou "Confirmado pela equipe". |
| `js/pagina-rota.js`, `js/pagina-mapa.js` | Ao abrir, pedem os avisos confirmados (sem travar a página) e recalculam a rota se algum novo afetar o caminho. |
| `index.html` | Link "Área ADM" no rodapé. |
| `sw.js` | Guarda `adm.html`, `servidor.js` e `fila-avisos.js`. Nunca guarda respostas do Supabase. A cópia dos confirmados fica no localStorage `navi-avisos-servidor`. |

## Dados no Supabase

### Tabela `avisos`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid | gerado pelo banco |
| `local` | text | slug do local, ex.: `predio-teste` |
| `lugar` | text | id do lugar no grafo, ex.: `PCT_P01_L0007` |
| `tipo` | text | `interditado`, `danificado` ou `obstaculo` |
| `detalhe` | text | opcional, até 280 caracteres |
| `situacao` | text | `pendente` (padrão), `confirmado`, `recusado` ou `resolvido` |
| `criado_em` | timestamptz | gerado pelo banco |
| `decidido_em` | timestamptz | preenchido quando um ADM decide |
| `decidido_por` | text | usuário do ADM que decidiu |

Não há coluna de IP, aparelho, nome ou posição.

### Tabela `adms`

| Coluna | Tipo |
|---|---|
| `id` | uuid, igual ao usuário do Supabase Auth |
| `usuario` | text único, ex.: `naviadm` |
| `criado_em` | timestamptz |
| `criado_por` | text |

### Regras de acesso (RLS)

| Quem | `avisos` | `adms` |
|---|---|---|
| Visitante (chave pública, sem login) | `insert` só com `situacao = 'pendente'` e campos válidos; `select` só de `situacao = 'confirmado'` | nada |
| ADM logado (está em `adms`) | `select` de tudo; `update` de `situacao`, `decidido_em` e `decidido_por` | `select` |
| Edge Function `criar-adm` (chave secreta) | — | `insert` |

O cadastro público de contas fica **desligado** no painel do Supabase. ADMs só são criados pela Edge Function, que confere o token de quem pede contra a tabela `adms`.

### Usuário e e-mail

O Supabase Auth exige e-mail. O site pede só o **usuário**, e por trás usa `<usuario>@adm.navi` (ex.: `naviadm@adm.navi`). O usuário aceita letras minúsculas, números, ponto e hífen, com 3 a 30 caracteres. A senha tem no mínimo 8 caracteres.

O primeiro ADM (`naviadm` / `12345678`) é criado no passo a passo do `supabase/LEIA-ME.md`.

## Telas

### Link "Área ADM"
No rodapé da Página de Rota. As páginas públicas não carregam nada da Área ADM.

### Login (`adm.html`)
- Campos **Usuário** e **Senha** e o botão **Entrar**.
- Erro: "Usuário ou senha incorretos."
- Sem internet: "Sem internet. A Área ADM precisa de conexão."
- A sessão fica em `sessionStorage`: termina ao fechar a aba. Botão **Sair** no topo do painel.

### Painel de avisos
- Abas **Pendentes** (padrão), **Confirmados** e **Recusados e resolvidos**, cada uma com contador.
- **Cada cartão mostra:**
  - lugar e andar;
  - tipo;
  - detalhe;
  - tempo desde o primeiro aviso ("há 12 min");
  - quantas pessoas avisaram, quando há pendentes iguais (mesmo lugar e tipo), que viram um só cartão: "3 pessoas avisaram".
- **Ações:**
  - Pendentes: **Confirmar: local indisponível** e **Recusar**. A decisão vale para todos os avisos agrupados no cartão.
  - Confirmados: **Marcar como resolvido**.
  - Cada ação anuncia o resultado por `aria-live`, por exemplo "Elevador 1 confirmado como indisponível".
- **Notificação** (só com o painel aberto):
  - verificação a cada 30 s;
  - avisos novos mudam o título para "(n) Navi ADM";
  - aparece uma faixa "Novo aviso: Elevador 1 — Danificado", lida pelo leitor de tela;
  - notificação do navegador, se o ADM tocar em **Permitir notificações**.

### Cadastro de ADM (seção "ADMs" do painel)
- Lista de ADMs, com usuário e data.
- Formulário **Novo ADM**: usuário, senha e confirmar senha; botão **Cadastrar ADM**.
- Erros: "Esse usuário já existe.", "As senhas não são iguais.", "A senha precisa ter pelo menos 8 caracteres."

### "Avisar sobre um local" (público)
- Ao registrar: "Aviso enviado à equipe do Navi. Ele já vale neste aparelho e passa a valer para todos quando um ADM confirmar."
- Sem internet: "Sem internet: o aviso será enviado quando a conexão voltar."
- Os canais de hoje (WhatsApp, telefone, copiar o texto, Fale Conosco) continuam iguais.

## Regras propostas para o Documento 04

| Regra | Texto proposto |
|---|---|
| **RN66** | A Área ADM é aberta só com usuário e senha de ADM. A sessão termina ao fechar a aba ou ao tocar em Sair. |
| **RN67** | Só um ADM logado cadastra outro ADM, com usuário e senha de pelo menos 8 caracteres. |
| **RN68** | Todo aviso feito pelo "Avisar sobre um local" também é enviado à equipe do Navi como pendente, sem nenhum dado de quem avisou. Sem internet, ele espera no aparelho e é enviado quando a conexão voltar. |
| **RN69** | Um ADM confirma, recusa ou marca como resolvido cada aviso. Um aviso confirmado vale para todos na hora, e as rotas desviam como hoje (RN16). Um aviso resolvido deixa de valer. |
| **RN70** | Com a Área ADM aberta, avisos novos aparecem em até 30 segundos, com destaque na tela, anúncio para leitor de tela e notificação do navegador, se permitida. |

Ajustes de texto:

- **RN50:** "avisos confirmados pela equipe valem para todos" passa a dizer "avisos confirmados por um ADM (RN69) ou publicados no `avisos.js` valem para todos".
- **RN55:** acrescentar "O aviso enviado à equipe (RN68) não leva nenhum dado pessoal."

## Erros e casos de borda

| Situação | Comportamento |
|---|---|
| Sem `servidor-config.js` preenchido | O site funciona como hoje. A Área ADM mostra "O servidor do Navi ainda não foi configurado." |
| Supabase fora do ar | O aviso vai para a fila, e as rotas usam a última cópia dos confirmados. |
| Aviso confirmado para um lugar que não existe mais no grafo | É ignorado na rota, como os ids desconhecidos de hoje. |
| Dois ADMs decidem o mesmo aviso | Vale a última decisão. O painel recarrega depois de cada ação. |
| Muitos avisos repetidos | Agrupados no cartão. O tamanho do detalhe é limitado a 280 caracteres. |

## Testes

Todos sem internet: o Supabase é simulado com `page.route` no Playwright e com um `fetch` falso nos testes de dados.

- **Dados:**
  - `servidor.js` monta as chamadas certas (URL, cabeçalhos, corpo);
  - `fila-avisos.js` guarda e reenvia;
  - `interdicoes.js` junta os confirmados do servidor e bloqueia como hoje.
- **Comportamento (celular e computador):**
  - login certo e errado;
  - painel lista pendentes agrupados;
  - confirmar faz a rota de outra visita desviar;
  - recusar e resolver;
  - cadastrar um ADM, inclusive os erros;
  - aviso sem internet fica na fila e é enviado depois;
  - sem configuração, o site segue funcionando;
  - Área ADM sem rolagem lateral, alvos de 48 px, nomes acessíveis e axe.

## Riscos

| Risco | Efeito | Decisão |
|---|---|---|
| Senha fixa `12345678` no repositório e nesta especificação | Quem ler o código pode entrar como ADM, confirmar avisos falsos e cadastrar outros ADMs. Com o repositório público, qualquer pessoa. | Mantida por pedido da equipe. Recomendação registrada: trocar a senha no painel do Supabase antes de qualquer uso real e não publicá-la. |
| Avisos falsos em massa | O painel enche de pendentes. | Pendentes não afetam as rotas; só os confirmados. O detalhe tem limite de tamanho. Limite por aparelho fica para depois, se precisar. |
| Dependência de um serviço externo | Sem o Supabase, avisos não chegam ao ADM. | O site continua funcionando, com fila e cópia local. |

## Fora desta versão

- Notificação por e-mail ou celular quando o painel está fechado.
- Recuperação de senha por e-mail.
- Histórico detalhado ou relatório de avisos.
- Obstáculo confirmado bloqueando a rota.
