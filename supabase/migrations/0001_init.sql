-- TensorLM — initial schema
-- Run with: npx supabase db push   (or paste into Supabase SQL editor)

create extension if not exists vector;

-- ───────────── Notebooks (a collection of documents) ─────────────
create table notebooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled notebook',
  created_at  timestamptz not null default now()
);

-- ───────────── Documents ─────────────
create table documents (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  file_path   text not null,               -- path inside the 'documents' storage bucket
  mime_type   text,
  status      text not null default 'pending'
              check (status in ('pending','processing','ready','failed')),
  error       text,
  markdown    text,                        -- full parsed text (used for small docs = full-context mode)
  token_count int,
  created_at  timestamptz not null default now()
);

-- ───────────── Chunks (searchable pieces) ─────────────
create table chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  notebook_id uuid not null references notebooks(id) on delete cascade,
  chunk_index int  not null,
  section     text,                        -- heading path, e.g. "3 Model Architecture > 3.2 Attention"
  content     text not null,
  embedding   vector(1536),
  fts         tsvector generated always as (to_tsvector('english', coalesce(section,'') || ' ' || content)) stored,
  created_at  timestamptz not null default now()
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_fts_idx       on chunks using gin (fts);
create index chunks_notebook_idx  on chunks (notebook_id);

-- ───────────── Figures (images extracted from documents) ─────────────
create table figures (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page        int,
  image_path  text not null,
  caption     text,                        -- vision-model description (phase 2)
  created_at  timestamptz not null default now()
);

-- ───────────── Chats & messages ─────────────
create table chats (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now()
);

create table messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references chats(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  citations   jsonb default '[]'::jsonb,   -- [{chunk_id, document_id, section}]
  created_at  timestamptz not null default now()
);

-- ───────────── Lessons (generated explanations) ─────────────
create table lessons (
  id          uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references notebooks(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  topic       text not null,
  level       text not null default 'student' check (level in ('beginner','student','expert')),
  content     jsonb not null,              -- [{type:'text'|'diagram'|'chart'|'math'|'quiz', ...}]
  created_at  timestamptz not null default now()
);

-- ───────────── Row Level Security ─────────────
alter table notebooks enable row level security;
alter table documents enable row level security;
alter table chunks    enable row level security;
alter table figures   enable row level security;
alter table chats     enable row level security;
alter table messages  enable row level security;
alter table lessons   enable row level security;

create policy "own notebooks" on notebooks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own documents" on documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chats"     on chats     for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "chunks via notebook" on chunks for select using (
  exists (select 1 from notebooks n where n.id = chunks.notebook_id and n.user_id = auth.uid()));
create policy "figures via document" on figures for select using (
  exists (select 1 from documents d where d.id = figures.document_id and d.user_id = auth.uid()));
create policy "messages via chat" on messages for all using (
  exists (select 1 from chats c where c.id = messages.chat_id and c.user_id = auth.uid()));
create policy "lessons via notebook" on lessons for all using (
  exists (select 1 from notebooks n where n.id = lessons.notebook_id and n.user_id = auth.uid()));
-- chunks/figures are WRITTEN by the worker with the service role key (bypasses RLS).

-- ───────────── Hybrid search (vector + keyword, Reciprocal Rank Fusion) ─────────────
create or replace function hybrid_search(
  query_text        text,
  query_embedding   vector(1536),
  p_notebook_id     uuid,
  match_count       int   default 10,
  full_text_weight  float default 1,
  semantic_weight   float default 1,
  rrf_k             int   default 50
)
returns setof chunks
language sql stable
as $$
with full_text as (
  select id,
         row_number() over (order by ts_rank_cd(fts, websearch_to_tsquery('english', query_text)) desc) as rank_ix
  from chunks
  where notebook_id = p_notebook_id
    and fts @@ websearch_to_tsquery('english', query_text)
  order by rank_ix
  limit least(match_count, 30) * 2
),
semantic as (
  select id,
         row_number() over (order by embedding <=> query_embedding) as rank_ix
  from chunks
  where notebook_id = p_notebook_id
  order by rank_ix
  limit least(match_count, 30) * 2
)
select chunks.*
from full_text
full outer join semantic on full_text.id = semantic.id
join chunks on coalesce(full_text.id, semantic.id) = chunks.id
order by
  coalesce(1.0 / (rrf_k + full_text.rank_ix), 0.0) * full_text_weight +
  coalesce(1.0 / (rrf_k + semantic.rank_ix), 0.0) * semantic_weight desc
limit least(match_count, 30);
$$;

-- ───────────── Storage bucket for uploads ─────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Files are stored as  <user_id>/<document_id>/<filename>
create policy "users manage own files" on storage.objects for all
  using      (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
