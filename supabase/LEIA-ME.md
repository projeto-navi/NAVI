# Servidor do Navi (Supabase) — Área ADM e avisos

O site continua estático (abre por `file://` e funciona offline). O Supabase só guarda os avisos das pessoas e as contas de ADM. Sem esta configuração, o site funciona como antes: os avisos valem só no aparelho e a Área ADM mostra "O servidor do Navi ainda não foi configurado."

Quem faz: o Líder Técnico (é a mesma pessoa que publica no Netlify). Leva uns 15 minutos.

## 1. Criar o projeto

1. Entre em <https://supabase.com> e crie um projeto (o plano gratuito basta). Região: São Paulo (`sa-east-1`).
2. Em **Project Settings → API**, anote:
   - a **Project URL** (`https://xxxx.supabase.co`);
   - a chave pública: **anon public** ou **publishable key**. Nunca use a `service_role`/`secret` no site.

## 2. Criar as tabelas e as regras

Em **SQL Editor → New query**, cole todo o conteúdo de `supabase/migracao.sql` e clique em **Run**. Pode rodar de novo sem problema.

## 3. Desligar o cadastro público

Em **Authentication → Sign In / Providers → Email**:

- deixe **Email** ligado;
- desligue **Allow new users to sign up**. Assim, contas novas só nascem pela Área ADM;
- desligue **Confirm email** (as contas de ADM usam endereços internos `@adm.navi`, que não recebem e-mail).

## 4. Criar o primeiro ADM (`naviadm`)

1. Em **Authentication → Users → Add user → Create new user**:
   - Email: `naviadm@adm.navi`
   - Password: `12345678`
   - marque **Auto Confirm User**.
2. No **SQL Editor**, rode:

```sql
insert into public.adms (id, usuario, criado_por)
select id, 'naviadm', 'instalação' from auth.users where email = 'naviadm@adm.navi';
```

> **Atenção:** a senha `12345678` foi pedida pela equipe e fica fixa. Ela é fácil de adivinhar, e qualquer pessoa que a conheça pode confirmar avisos e cadastrar ADMs. Antes de usar o Navi com o público, troque-a em **Authentication → Users → naviadm → Reset password** (ou crie outro ADM e apague este).

## 5. Publicar a função que cadastra ADMs

Com a [Supabase CLI](https://supabase.com/docs/guides/cli) instalada, na pasta do repositório:

```bash
supabase login
supabase link --project-ref <id-do-projeto>
supabase functions deploy criar-adm
```

A função já recebe `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do próprio Supabase; não precisa configurar nada.

Sem a CLI: em **Edge Functions → Deploy a new function → Via Editor**, dê o nome `criar-adm` e cole o conteúdo de `supabase/functions/criar-adm/index.ts`.

## 6. Ligar o site ao servidor

Edite `site-acessivel/js/servidor-config.js`:

```js
self.NAVI_SERVIDOR = {
  url: 'https://xxxx.supabase.co',
  chavePublica: 'a chave anon public ou publishable',
};
```

A chave pública pode ficar no site: quem protege os dados são as regras do passo 2.

## 7. Conferir

1. Abra o site, escolha uma rota e use **Avisar sobre um local**. Deve aparecer "Aviso enviado à equipe do Navi…".
2. Abra **Área ADM** (no rodapé), entre com `naviadm` / `12345678`. O aviso aparece em **Pendentes**.
3. Clique em **Confirmar: local indisponível**. Em outro aparelho, a rota passa a desviar desse lugar.

## O que fica guardado

Só o local, o lugar, o tipo do problema, o detalhe escrito e as datas. Nada sobre quem avisou (RN55). Nas contas de ADM, só o nome de usuário e quem cadastrou.
