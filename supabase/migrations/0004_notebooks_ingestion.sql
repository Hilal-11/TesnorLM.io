-- TensorLM — Phase 3: notebooks and ingestion.
-- Spec: docs/specs/ingestion.md · stage names and transitions: contracts/ingestion.json
-- (tests/rls checks this file's stage enum and transition table against the contract).

-- ───────────── Types ─────────────
create type public.notebook_status as enum ('to_read', 'learning', 'reviewing', 'mastered');

create type public.document_stage as enum (
  'uploading', 'queued', 'validating', 'parsing', 'ocr', 'reading_figures', 'indexing', 'ready',
  'failed'
);

-- ───────────── Notebooks ─────────────
alter table public.notebooks
  add column description    text,
  add column status         public.notebook_status not null default 'to_read',
  add column subject        text,
  add column color          text not null default 'cobalt',
  add column exam_date      date,
  -- Fractional index for board order. Keys compare byte by byte, so the collation must be "C".
  add column position       text collate "C" not null default 'a0',
  add column last_opened_at timestamptz,
  add column deleted_at     timestamptz,
  add column updated_at     timestamptz not null default now(),
  add constraint notebooks_title_length check (char_length(title) between 1 and 120),
  add constraint notebooks_description_length check (char_length(description) <= 500),
  add constraint notebooks_subject_length check (char_length(subject) <= 60),
  -- Palette token names from the design skill, never hex.
  add constraint notebooks_color_check check (color in ('cobalt', 'teal', 'amber', 'rose', 'graphite')),
  add constraint notebooks_position_format check (position ~ '^[0-9A-Za-z]+$');

create index notebooks_board_idx on public.notebooks (user_id, deleted_at, status, position);
create index notebooks_recent_idx on public.notebooks (user_id, last_opened_at desc nulls last);

create trigger notebooks_set_updated_at
  before update on public.notebooks
  for each row execute function public.set_updated_at();

-- People create, edit and soft-delete their notebooks; only the cleanup job (service role) deletes.
drop policy if exists "own notebooks" on public.notebooks;
create policy "notebooks: read own" on public.notebooks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notebooks: create own" on public.notebooks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notebooks: update own" on public.notebooks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.notebooks from anon, authenticated;
grant insert (user_id, title, description, status, subject, color, exam_date, position)
  on public.notebooks to authenticated;
grant update (title, description, status, subject, color, exam_date, position, last_opened_at,
              deleted_at)
  on public.notebooks to authenticated;

-- ───────────── Documents ─────────────
alter table public.documents
  add column stage             public.document_stage not null default 'uploading',
  add column progress          smallint not null default 0,
  add column stage_detail      text,
  add column error_code        text,
  add column error_vars        jsonb,
  add column original_filename text,
  add column storage_path      text,
  add column file_size         bigint,
  add column sha256            text,
  add column page_count        int,
  add column ocr_used          boolean not null default false,
  add column figure_count      int not null default 0,
  add column chunk_count       int not null default 0,
  add column ingest_run_id     uuid not null default gen_random_uuid(),  -- the run being processed
  add column ready_run_id      uuid,  -- the run people search and read (set by finalize_ingest)
  add column attempt           int not null default 0,
  add column reprocessed_at    timestamptz[] not null default '{}',
  add column parser_version    text,
  add column embedding_model   text,
  add column stage_timings     jsonb not null default '{}'::jsonb,
  add column started_at        timestamptz,
  add column finished_at       timestamptz,
  add column deleted_at        timestamptz,
  add column updated_at        timestamptz not null default now(),
  add constraint documents_progress_range check (progress between 0 and 100),
  add constraint documents_sha256_format check (sha256 ~ '^[0-9a-f]{64}$'),
  add constraint documents_file_size_positive check (file_size > 0);

-- Carry rows from the Phase 0 pipeline over: status → stage, file_path → storage_path.
update public.documents set
  stage = case status
    when 'ready' then 'ready'::public.document_stage
    when 'failed' then 'failed'::public.document_stage
    when 'processing' then 'failed'::public.document_stage  -- the old worker left these hanging
    else 'queued'::public.document_stage
  end,
  progress = case when status = 'ready' then 100 else 0 end,
  error_code = case when status in ('failed', 'processing') then 'internal' end,
  original_filename = title,
  storage_path = file_path,
  ready_run_id = case when status = 'ready' then ingest_run_id end,
  finished_at = case when status in ('ready', 'failed') then created_at end;

alter table public.documents
  alter column original_filename set not null,
  alter column storage_path set not null,
  drop column status,
  drop column error,
  drop column file_path;

-- Duplicate lookup. Not unique: "Add anyway" may add the same file again (spec section 13).
create index documents_duplicate_idx on public.documents (notebook_id, sha256)
  where deleted_at is null;
create index documents_user_stage_idx on public.documents (user_id, stage);
create index documents_notebook_idx on public.documents (notebook_id, deleted_at);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- New documents always start a fresh run at "uploading", with a storage path the server decides:
-- the worker downloads with the service role, so a client must never choose the path.
create or replace function public.documents_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.stage := 'uploading';
  new.progress := 0;
  new.ingest_run_id := gen_random_uuid();
  new.storage_path := new.user_id::text || '/' || new.id::text || '/source.pdf';
  new.original_filename := coalesce(new.original_filename, new.title);
  new.stage_timings := jsonb_build_object('uploading', jsonb_build_object('started_at', now()));
  return new;
end;
$$;

create trigger documents_before_insert
  before insert on public.documents
  for each row execute function public.documents_before_insert();

-- People insert their own rows (RLS checks the notebook is theirs) and may rename or soft-delete
-- them. Every pipeline column is written by the API and the worker with the service role.
revoke insert, update, delete on public.documents from anon, authenticated;
grant insert (id, notebook_id, user_id, title, original_filename, mime_type, file_size, sha256)
  on public.documents to authenticated;
grant update (title, deleted_at) on public.documents to authenticated;

-- ───────────── Figures ─────────────
alter table public.figures rename column caption to description;
alter table public.figures
  add column ingest_run_id uuid,
  add column ordinal       int,
  add column user_id       uuid references auth.users (id) on delete cascade,
  add column label         text,
  add column paper_caption text,
  add column bbox          jsonb,
  add column width         int,
  add column height        int,
  add column image_sha256  text;

update public.figures f set
  user_id = d.user_id,
  ingest_run_id = d.ingest_run_id,
  ordinal = sub.n
from public.documents d,
  (select id, row_number() over (partition by document_id order by created_at, id) as n
   from public.figures) sub
where d.id = f.document_id and sub.id = f.id;

alter table public.figures
  alter column user_id set not null,
  alter column ingest_run_id set not null,
  alter column ordinal set not null,
  add constraint figures_run_ordinal_key unique (document_id, ingest_run_id, ordinal);

drop policy if exists "figures via document" on public.figures;
create policy "figures: read own" on public.figures
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.figures from anon, authenticated;

-- ───────────── Chunks ─────────────
alter table public.chunks
  add column ingest_run_id uuid,
  add column kind          text not null default 'text',
  add column page_start    int,
  add column page_end      int,
  add column bboxes        jsonb,  -- [{page, l, t, r, b}]: PDF points, top-left origin, page from 1
  add column headings      text[],
  add column token_count   int,
  add column figure_id     uuid references public.figures (id) on delete cascade,
  add constraint chunks_kind_check check (kind in ('text', 'table', 'figure_caption')),
  add constraint chunks_pages_check check (page_start >= 1 and page_end >= page_start);

update public.chunks c set ingest_run_id = d.ingest_run_id
from public.documents d where d.id = c.document_id;

alter table public.chunks
  alter column ingest_run_id set not null,
  add constraint chunks_run_index_key unique (document_id, ingest_run_id, chunk_index);

drop policy if exists "chunks via notebook" on public.chunks;
create policy "chunks: read own" on public.chunks
  for select to authenticated using (
    exists (
      select 1 from public.notebooks n
      where n.id = chunks.notebook_id and n.user_id = (select auth.uid())
    )
  );
revoke insert, update, delete on public.chunks from anon, authenticated;

-- ───────────── Stage machine (mirrors contracts/ingestion.json "transitions") ─────────────
create or replace function public.ingest_transition_allowed(
  p_from public.document_stage,
  p_to public.document_stage
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text, p_to::text) in (
    ('uploading', 'queued'), ('uploading', 'failed'),
    ('queued', 'validating'), ('queued', 'failed'),
    ('validating', 'parsing'), ('validating', 'failed'),
    ('parsing', 'ocr'), ('parsing', 'reading_figures'), ('parsing', 'indexing'),
    ('parsing', 'failed'),
    ('ocr', 'reading_figures'), ('ocr', 'indexing'), ('ocr', 'failed'),
    ('reading_figures', 'indexing'), ('reading_figures', 'failed'),
    ('indexing', 'ready'), ('indexing', 'failed')
  );
$$;

-- Records when a stage started and closes the previous stage with its duration.
create or replace function public.ingest_timings(
  p_timings jsonb,
  p_from public.document_stage,
  p_to public.document_stage,
  p_now timestamptz
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select p_timings
    || case
         when p_timings ? p_from::text then jsonb_build_object(
           p_from::text,
           (p_timings -> p_from::text) || jsonb_build_object(
             'duration_ms',
             round(extract(epoch from (p_now - ((p_timings -> p_from::text ->> 'started_at')::timestamptz))) * 1000)
           )
         )
         else '{}'::jsonb
       end
    || jsonb_build_object(p_to::text, jsonb_build_object('started_at', p_now));
$$;

-- The worker's (and API's) only way to move a document through stages. Ignores stale runs,
-- moves the contract doesn't allow, backwards progress, and "ready" (finalize_ingest() only).
-- Reporting the current stage again is a progress update. Returns whether anything changed.
create or replace function public.set_document_stage(
  p_document_id uuid,
  p_run_id      uuid,
  p_stage       public.document_stage,
  p_progress    int default null,
  p_detail      text default null,
  p_error_code  text default null,
  p_error_vars  jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  v_now timestamptz := clock_timestamp();
  v_progress smallint;
begin
  select stage, ingest_run_id, progress, stage_timings, deleted_at
    into d
    from public.documents
   where id = p_document_id
   for update;

  if not found or d.ingest_run_id is distinct from p_run_id or d.deleted_at is not null then
    return false;
  end if;

  v_progress := least(100, greatest(d.progress, coalesce(p_progress, d.progress)));

  if p_stage = d.stage then
    if d.stage in ('ready', 'failed') then
      return false;
    end if;
    update public.documents
       set progress = v_progress,
           stage_detail = coalesce(p_detail, stage_detail)
     where id = p_document_id;
    return true;
  end if;

  if p_stage = 'ready' or not public.ingest_transition_allowed(d.stage, p_stage) then
    return false;
  end if;

  update public.documents
     set stage = p_stage,
         progress = case when p_stage = 'failed' then d.progress else v_progress end,
         stage_detail = case when p_stage = 'failed' then null else p_detail end,
         error_code = case when p_stage = 'failed' then coalesce(p_error_code, 'internal') end,
         error_vars = case when p_stage = 'failed' then p_error_vars end,
         stage_timings = public.ingest_timings(d.stage_timings, d.stage, p_stage, v_now),
         started_at = case when p_stage = 'validating' then coalesce(started_at, v_now) else started_at end,
         finished_at = case when p_stage = 'failed' then v_now else finished_at end
   where id = p_document_id;
  return true;
end;
$$;

-- Atomic swap: the run's chunks and figures become the searchable ones (ready_run_id), older
-- runs' rows go, the full text is replaced, and the document is Ready, all in one transaction.
-- Until then, a re-processed document keeps answering from its previous run.
-- A stale or deleted run changes nothing (false). Safe to repeat for the current run.
create or replace function public.finalize_ingest(
  p_document_id uuid,
  p_run_id      uuid,
  p_markdown    text default null,
  p_token_count int default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  v_now timestamptz := clock_timestamp();
  v_chunks int;
  v_figures int;
begin
  select stage, ingest_run_id, stage_timings, deleted_at
    into d
    from public.documents
   where id = p_document_id
   for update;

  if not found or d.ingest_run_id is distinct from p_run_id or d.deleted_at is not null then
    return false;
  end if;
  if d.stage <> 'indexing' and d.stage <> 'ready' then
    return false;
  end if;

  delete from public.chunks where document_id = p_document_id and ingest_run_id <> p_run_id;
  delete from public.figures where document_id = p_document_id and ingest_run_id <> p_run_id;
  select count(*) into v_chunks from public.chunks where document_id = p_document_id;
  select count(*) into v_figures from public.figures where document_id = p_document_id;

  if d.stage = 'ready' then
    return true;
  end if;

  update public.documents
     set stage = 'ready',
         ready_run_id = p_run_id,
         markdown = coalesce(p_markdown, markdown),
         token_count = coalesce(p_token_count, token_count),
         progress = 100,
         stage_detail = null,
         error_code = null,
         error_vars = null,
         chunk_count = v_chunks,
         figure_count = v_figures,
         stage_timings = public.ingest_timings(d.stage_timings, d.stage, 'ready', v_now),
         finished_at = v_now
   where id = p_document_id;
  return true;
end;
$$;

-- Starts a new run (re-process, or Undo of an interrupted run): new run id, attempt + 1, queued.
-- Old chunks stay searchable until finalize_ingest() swaps them out.
create or replace function public.start_ingest_run(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
begin
  update public.documents
     set ingest_run_id = v_run,
         attempt = attempt + 1,
         stage = 'queued',
         progress = 0,
         stage_detail = null,
         error_code = null,
         error_vars = null,
         stage_timings = jsonb_build_object('queued', jsonb_build_object('started_at', v_now)),
         started_at = null,
         finished_at = null
   where id = p_document_id and deleted_at is null;
  if not found then
    return null;
  end if;
  return v_run;
end;
$$;

revoke execute on function public.ingest_transition_allowed(public.document_stage, public.document_stage)
  from public, anon, authenticated;
revoke execute on function public.ingest_timings(jsonb, public.document_stage, public.document_stage, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.set_document_stage(uuid, uuid, public.document_stage, int, text, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.finalize_ingest(uuid, uuid, text, int)
  from public, anon, authenticated;
revoke execute on function public.start_ingest_run(uuid) from public, anon, authenticated;
revoke execute on function public.documents_before_insert() from public, anon, authenticated;
grant execute on function public.ingest_transition_allowed(public.document_stage, public.document_stage)
  to service_role;
grant execute on function public.set_document_stage(uuid, uuid, public.document_stage, int, text, text, jsonb)
  to service_role;
grant execute on function public.finalize_ingest(uuid, uuid, text, int) to service_role;
grant execute on function public.start_ingest_run(uuid) to service_role;

-- ───────────── Search: the published run of live documents only ─────────────
drop function if exists public.hybrid_search(text, vector, uuid, int, float, float, int);

create or replace function public.hybrid_search(
  query_text       text,
  query_embedding  vector(1536),
  p_notebook_id    uuid,
  match_count      int default 10,
  full_text_weight float default 1,
  semantic_weight  float default 1,
  rrf_k            int default 50,
  p_document_ids   uuid[] default null
)
returns table (
  id          uuid,
  document_id uuid,
  notebook_id uuid,
  chunk_index int,
  section     text,
  content     text,
  kind        text,
  page_start  int,
  page_end    int,
  bboxes      jsonb,
  headings    text[],
  figure_id   uuid,
  score       float
)
language sql
stable
set search_path = public, extensions
as $$
with live as (
  select c.*
  from public.chunks c
  join public.documents d on d.id = c.document_id
  join public.notebooks n on n.id = c.notebook_id
  where c.notebook_id = p_notebook_id
    and d.deleted_at is null
    and n.deleted_at is null
    and c.ingest_run_id = d.ready_run_id
    and (p_document_ids is null or c.document_id = any (p_document_ids))
),
full_text as (
  select live.id,
         row_number() over (order by ts_rank_cd(live.fts, websearch_to_tsquery('english', query_text)) desc) as rank_ix
  from live
  where live.fts @@ websearch_to_tsquery('english', query_text)
  order by rank_ix
  limit least(match_count, 30) * 2
),
semantic as (
  select live.id,
         row_number() over (order by live.embedding <=> query_embedding) as rank_ix
  from live
  where live.embedding is not null
  order by rank_ix
  limit least(match_count, 30) * 2
)
select live.id, live.document_id, live.notebook_id, live.chunk_index, live.section, live.content,
       live.kind, live.page_start, live.page_end, live.bboxes, live.headings, live.figure_id,
       coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
       coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight as score
from full_text
full outer join semantic on full_text.id = semantic.id
join live on live.id = coalesce(full_text.id, semantic.id)
order by score desc
limit least(match_count, 30);
$$;

-- ───────────── Realtime: owners see their documents' stages change live ─────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents'
     ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end;
$$;

-- ───────────── Storage ─────────────
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['application/pdf', 'image/png', 'image/webp']
 where id = 'documents';

-- Parsed documents, written and read by the worker only (no policies = service role only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ingest-artifacts', 'ingest-artifacts', false, 209715200, array['application/json'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users manage own files" on storage.objects;
create policy "documents bucket: own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ───────────── Audit helper for tests/rls ─────────────
-- Which public tables are in the Realtime publication (service role only).
create or replace function public.realtime_tables()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select tablename::text from pg_catalog.pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public'
  order by 1;
$$;

revoke execute on function public.realtime_tables() from public, anon, authenticated;
grant execute on function public.realtime_tables() to service_role;
