-- Navi — Área ADM e confirmação de avisos (RN66–RN70, propostas no Documento 04 v1.4).
-- Rodar uma vez no SQL Editor do Supabase (ver supabase/LEIA-ME.md).
-- Nenhuma coluna guarda dado de quem avisa (RN55): só o local, o lugar, o tipo e o detalhe.

-- ---------- ADMs ----------
create table if not exists public.adms (
  id uuid primary key references auth.users (id) on delete cascade,
  usuario text not null unique check (usuario ~ '^[a-z0-9.-]{3,30}$'),
  criado_em timestamptz not null default now(),
  criado_por text
);

-- ---------- avisos ----------
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  local text not null check (local ~ '^[a-z0-9-]{1,40}$'),
  lugar text not null check (char_length(lugar) between 1 and 60),
  tipo text not null check (tipo in ('interditado', 'danificado', 'obstaculo')),
  detalhe text not null default '' check (char_length(detalhe) <= 280),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'confirmado', 'recusado', 'resolvido')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por text
);
create index if not exists avisos_local_situacao on public.avisos (local, situacao);

-- Quem está logado é ADM? (security definer: lê adms sem depender das regras de adms)
create or replace function public.eh_adm() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.adms where id = auth.uid()) $$;
revoke all on function public.eh_adm() from public;
revoke execute on function public.eh_adm() from anon; -- o visitante não precisa (as regras dele não usam)
grant execute on function public.eh_adm() to authenticated;

-- ---------- regras de acesso (RLS) ----------
alter table public.avisos enable row level security;
alter table public.adms enable row level security;

drop policy if exists "qualquer pessoa envia aviso pendente" on public.avisos;
create policy "qualquer pessoa envia aviso pendente" on public.avisos
  for insert to anon, authenticated
  with check (situacao = 'pendente' and decidido_em is null and decidido_por is null);

drop policy if exists "qualquer pessoa le os confirmados" on public.avisos;
create policy "qualquer pessoa le os confirmados" on public.avisos
  for select to anon, authenticated
  using (situacao = 'confirmado');

drop policy if exists "adm le todos" on public.avisos;
create policy "adm le todos" on public.avisos
  for select to authenticated
  using (public.eh_adm());

drop policy if exists "adm decide" on public.avisos;
create policy "adm decide" on public.avisos
  for update to authenticated
  using (public.eh_adm()) with check (public.eh_adm());

drop policy if exists "adm ve os adms" on public.adms;
create policy "adm ve os adms" on public.adms
  for select to authenticated
  using (public.eh_adm());

-- Permissões por coluna: o visitante só escolhe local, lugar, tipo e detalhe;
-- o ADM só muda a situação e quem decidiu. ADMs novos só pela Edge Function criar-adm.
revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to anon, authenticated;
grant insert (local, lugar, tipo, detalhe) on public.avisos to anon, authenticated;
grant update (situacao, decidido_em, decidido_por) on public.avisos to authenticated;
revoke all on public.adms from anon, authenticated;
grant select on public.adms to authenticated;
