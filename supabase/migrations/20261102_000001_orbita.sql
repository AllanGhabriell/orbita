-- ÓRBITA / MIGRAÇÃO FINAL v1 — EXECUTAR NO SQL EDITOR DO SUPABASE.
-- Não precisa de chaves secretas. Execute UMA VEZ; idempotente quanto aos objetos principais.
-- Modelo de sincronização: documento JSON por pessoa + snapshots irrevogáveis de dias.
-- Acesso público ou anônimo ao conteúdo NÃO é autorizado.

begin;

create table if not exists public.orbita_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 1 check (version >= 1),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.orbita_closed_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  closed_at timestamptz not null default now(),
  primary key(user_id,day)
);
create index if not exists orbita_closed_days_user_date_idx
on public.orbita_closed_days(user_id,day desc);

alter table public.orbita_documents enable row level security;
alter table public.orbita_closed_days enable row level security;

-- Não confiar em permissões padrão da schema public: somente SELECT por usuário.
revoke all on public.orbita_documents from public, anon, authenticated;
revoke all on public.orbita_closed_days from public, anon, authenticated;
grant select on public.orbita_documents,public.orbita_closed_days to authenticated;

drop policy if exists orbita_documents_owner_read on public.orbita_documents;
create policy orbita_documents_owner_read on public.orbita_documents
for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists orbita_closed_owner_read on public.orbita_closed_days;
create policy orbita_closed_owner_read on public.orbita_closed_days
for select to authenticated using ((select auth.uid())=user_id);

-- Impede escrita por acesso comum. A única gravação é RPC com checagem de versão.
-- Não há políticas INSERT/UPDATE/DELETE expostas a authenticated/anon.

create or replace function public.orbita_commit(
  p_expected_version bigint,
  p_document jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
 v_uid uuid;
 v_existing public.orbita_documents%rowtype;
 v_old_closed jsonb;
 v_new_closed jsonb;
 v_key text;
 v_snapshot jsonb;
 v_prior jsonb;
 v_count integer := 0;
begin
 v_uid := (select auth.uid());
 if v_uid is null then
   raise exception 'Autenticação obrigatória' using errcode='42501';
 end if;
 if p_document is null or jsonb_typeof(p_document)<>'object' then
   raise exception 'Documento inválido';
 end if;
 if pg_column_size(p_document)>5242880 then
   raise exception 'Documento superior ao limite de 5 MB';
 end if;
 if p_expected_version is null or p_expected_version<0 then
   raise exception 'Versão esperada inválida';
 end if;

 -- Serializa escritas do mesmo usuário, inclusive quando a linha ainda não existe.
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 90711));
 select * into v_existing
 from public.orbita_documents where user_id=v_uid for update;

 if found then
   if v_existing.version<>p_expected_version then
     return jsonb_build_object('status','conflict','version',v_existing.version);
   end if;
 else
   if p_expected_version<>0 then
     return jsonb_build_object('status','conflict','version',0);
   end if;
 end if;

 v_old_closed := coalesce(v_existing.content #> '{evolution,closed}', '{}'::jsonb);
 v_new_closed := coalesce(p_document #> '{evolution,closed}', '{}'::jsonb);
 if jsonb_typeof(v_old_closed)<>'object' or jsonb_typeof(v_new_closed)<>'object' then
   raise exception 'Formato de fechamento inválido';
 end if;
 -- Verifica snapshots que já existiam no documento, inclusive dias antigos.
 for v_key,v_snapshot in select key,value from jsonb_each(v_old_closed)
 loop
   if not v_new_closed ? v_key
      or v_new_closed->v_key is distinct from v_snapshot then
     raise exception 'Não é permitido alterar ou remover dias finalizados (%).',v_key using errcode='23514';
   end if;
 end loop;

 -- Snapshots canônicos: impedem mutação mesmo quando um documento for substituído.
 for v_key,v_snapshot in select key,value from jsonb_each(v_new_closed)
 loop
   if v_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or to_char(to_date(v_key,'YYYY-MM-DD'),'YYYY-MM-DD')<>v_key
      or jsonb_typeof(v_snapshot)<>'object'
      or v_snapshot->>'date'<>v_key
      or coalesce(v_snapshot->>'confirmed','')='' then
     raise exception 'Snapshot de dia inválido: %',v_key;
   end if;
   select snapshot into v_prior
   from public.orbita_closed_days where user_id=v_uid and day=v_key::date;
   if found then
     if v_prior is distinct from v_snapshot then
       raise exception 'Dia finalizado protegido no banco: %',v_key using errcode='23514';
     end if;
   else
     insert into public.orbita_closed_days(user_id,day,snapshot,closed_at)
     values(v_uid,v_key::date,v_snapshot,now());
     v_count:=v_count+1;
   end if;
 end loop;

 -- Garante que os snapshots já confirmados no banco existam no documento.
 if exists(
   select 1 from public.orbita_closed_days cd
   where cd.user_id=v_uid
   and not (v_new_closed ? to_char(cd.day,'YYYY-MM-DD'))
 ) then
   raise exception 'O documento não pode omitir dias previamente encerrados.' using errcode='23514';
 end if;

 if v_existing.user_id is null then
   insert into public.orbita_documents(user_id,version,content,updated_at)
   values(v_uid,1,p_document,now());
   return jsonb_build_object('status','ok','version',1,'new_closed',v_count);
 else
   update public.orbita_documents
   set version=v_existing.version+1,content=p_document,updated_at=now()
   where user_id=v_uid;
   return jsonb_build_object('status','ok','version',v_existing.version+1,'new_closed',v_count);
 end if;
end;
$fn$;

revoke all on function public.orbita_commit(bigint,jsonb) from public,anon;
grant execute on function public.orbita_commit(bigint,jsonb) to authenticated;

-- A tabela de snapshots NÃO permite alterações ou remoções nem por RPC comum.
-- Somente o administrador de banco tem capacidade de manutenção extraordinária.
commit;

-- Diagnóstico, após execução: confirme as duas tabelas e a função:
-- select routine_name from information_schema.routines
-- where routine_schema='public' and routine_name='orbita_commit';
--
-- IMPORTANTE: jamais cole no frontend sb_secret_*, service_role ou senha de DB.
-- Só utilize Project URL e a publishable key (sb_publishable_...) / anon pública.
