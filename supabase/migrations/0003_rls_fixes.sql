-- TensorLM — RLS fixes and an RLS audit helper for the isolation test (tests/rls).

-- documents and chats only checked user_id: a person could attach a row to someone else's
-- notebook (and the worker would then write chunks into it). The notebook must be theirs too.
drop policy if exists "own documents" on public.documents;
create policy "documents: own rows in own notebooks" on public.documents
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notebooks n
      where n.id = notebook_id and n.user_id = (select auth.uid())
    )
  );

drop policy if exists "own chats" on public.chats;
create policy "chats: own rows in own notebooks" on public.chats
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notebooks n
      where n.id = notebook_id and n.user_id = (select auth.uid())
    )
  );

-- Lists every table in the public schema with its RLS flag, so the isolation test can fail when
-- a new table ships without RLS or without a test case. Service role only.
create or replace function public.rls_status()
returns table (table_name text, rls_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text, c.relrowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by 1;
$$;

revoke execute on function public.rls_status() from public, anon, authenticated;
grant execute on function public.rls_status() to service_role;
