-- TensorLM — Phase 4: chat with sources.
-- Spec: docs/specs/answers.md · contract: contracts/answer-format.json

-- ───────────── Chats ─────────────
alter table public.chats
  add column title_generated boolean not null default true,  -- false once a person renames it
  add column level           public.learning_level not null default 'intermediate',
  add column summary         text,           -- older turns, summarised by the fast model
  add column summary_turns   int not null default 0,
  add column updated_at      timestamptz not null default now(),
  add column last_message_at timestamptz not null default now(),
  add column deleted_at      timestamptz,
  add constraint chats_title_length check (char_length(title) <= 120);

create index chats_notebook_recent_idx on public.chats (notebook_id, deleted_at, last_message_at desc);

create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function public.set_updated_at();

-- People create, rename, change the level of and soft-delete their chats (RLS from 0003 checks the
-- notebook is theirs). Hard deletes only through notebook cleanup.
revoke insert, update, delete on public.chats from anon, authenticated;
grant insert (id, notebook_id, user_id, title, level) on public.chats to authenticated;
grant update (title, title_generated, level, deleted_at) on public.chats to authenticated;

-- ───────────── Messages ─────────────
alter table public.messages
  add column user_id               uuid references auth.users (id) on delete cascade,
  add column parts                 jsonb not null default '[]'::jsonb,  -- AI SDK UI message parts
  add column status                text not null default 'complete',
  add column error_code            text,
  add column level                 public.learning_level,
  add column mode                  text,
  add column command               text,
  add column selected_document_ids uuid[] not null default '{}',
  add column followups             text[] not null default '{}',
  add column parent_id             uuid references public.messages (id) on delete cascade,
  add column version               int not null default 1,
  add column model                 text,
  add column prompt_version        text,
  add column usage                 jsonb,      -- {input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd}
  add column latency_ms            int,
  add column flags                 jsonb not null default '{}'::jsonb,  -- {ungrounded, invalid_citations}
  add constraint messages_status_check check (status in ('streaming', 'complete', 'stopped', 'error')),
  add constraint messages_mode_check check (mode is null or mode in ('full_context', 'retrieval', 'no_sources'));

-- `content` stays the plain-text copy (search, export, history); `parts` is what the UI renders.
alter table public.messages alter column content set default '';

update public.messages m set user_id = c.user_id from public.chats c where c.id = m.chat_id;
alter table public.messages alter column user_id set not null;

create index messages_chat_idx on public.messages (chat_id, created_at);
create index messages_parent_idx on public.messages (parent_id) where parent_id is not null;
create index messages_user_recent_idx on public.messages (user_id, role, created_at desc);

-- People read their messages; every write goes through the chat route (service role) after an
-- ownership check, so stored citations, usage and status can't be forged.
drop policy if exists "messages via chat" on public.messages;
create policy "messages: read own" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.messages from anon, authenticated;

-- ───────────── Feedback ─────────────
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  rating     text not null check (rating in ('up', 'down')),
  reason     text check (reason in ('wrong', 'unclear', 'missing_source')),
  comment    text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_id)  -- changing a vote updates the row
);
alter table public.feedback enable row level security;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

create policy "feedback: own on own messages" on public.feedback
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.user_id = (select auth.uid()) and m.role = 'assistant'
    )
  );

-- ───────────── Notes (minimal; the full notes UI is Phase 9) ─────────────
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  chat_id     uuid references public.chats (id) on delete set null,
  message_id  uuid references public.messages (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  page        int check (page >= 1),
  quote       text check (char_length(quote) <= 4000),
  body        text check (char_length(body) <= 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
alter table public.notes enable row level security;
create index notes_notebook_idx on public.notes (notebook_id, deleted_at, created_at desc);
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create policy "notes: own in own notebooks" on public.notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notebooks n
      where n.id = notebook_id and n.user_id = (select auth.uid())
    )
  );

-- ───────────── Source selection ─────────────
-- A column on documents instead of a separate table: one row per source already exists, RLS and
-- Realtime already cover it, and a person only ever has one selection per notebook.
alter table public.documents add column included boolean not null default true;
grant update (included) on public.documents to authenticated;

