-- TensorLM — profiles: one row per auth user, created by a signup trigger, private by RLS.
-- Also renames the lesson level "student" to "intermediate" to match the design skill
-- (Beginner · Intermediate · Expert). Roles keep "student".

-- ───────────── Types ─────────────
create type public.user_role as enum ('student', 'instructor', 'developer', 'researcher');
create type public.learning_level as enum ('beginner', 'intermediate', 'expert');

-- ───────────── Table ─────────────
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  full_name           text,
  avatar_url          text,
  role                public.user_role,
  level               public.learning_level not null default 'intermediate',
  subjects            text[] not null default '{}',
  onboarding_step     smallint not null default 0,
  onboarding_done     boolean not null default false,
  first_source        text check (first_source in ('sample', 'upload')),   -- onboarding step 4 choice
  last_sign_in_method text check (last_sign_in_method in ('email', 'google', 'github')),  -- "Last used"
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint profiles_subjects_max check (cardinality(subjects) <= 8),
  constraint profiles_onboarding_step_range check (onboarding_step between 0 and 4)
);

-- ───────────── Row Level Security ─────────────
alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: the trigger inserts; account deletion happens server-side.
-- Column privileges: clients can never change id, created_at or updated_at.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, role, level, subjects, onboarding_step, onboarding_done,
              first_source, last_sign_in_method)
  on public.profiles to authenticated;

-- ───────────── Create a profile for every new user ─────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'user_name'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── updated_at ─────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ───────────── Backfill users created before this migration ─────────────
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name',
           u.raw_user_meta_data ->> 'user_name'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ───────────── Lesson levels: student → intermediate ─────────────
alter table public.lessons drop constraint if exists lessons_level_check;
update public.lessons set level = 'intermediate' where level = 'student';
alter table public.lessons alter column level set default 'intermediate';
alter table public.lessons
  add constraint lessons_level_check check (level in ('beginner', 'intermediate', 'expert'));
