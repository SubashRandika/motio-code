-- MotioCode - Phase 1 core schema
-- profiles, projects, project_scenes, assets, render_jobs + RLS.
-- Timing is stored in frames; the project's fps lives in projects.canvas_config.

-- ---------------------------------------------------------------- enums
create type public.project_content_type as enum ('code', 'diagram', 'infographic', 'mixed');
create type public.asset_type as enum ('image', 'video', 'audio', 'font', 'other');
create type public.render_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');

-- ------------------------------------------------------------- utilities
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- -------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Seed a profile row whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (char_length(description) <= 1000),
  content_type public.project_content_type not null default 'mixed',
  canvas_config jsonb not null default '{}'::jsonb,
  theme_config jsonb not null default '{}'::jsonb,
  export_config jsonb not null default '{}'::jsonb,
  template_id text check (char_length(template_id) <= 80),
  thumbnail_path text check (char_length(thumbnail_path) <= 2048),
  data_version integer not null default 1,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);
create index projects_owner_last_opened_idx on public.projects (owner_id, last_opened_at desc nulls last);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------- project_scenes
-- owner_id is denormalised from projects so RLS never needs a join.
create table public.project_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  scene_order integer not null check (scene_order >= 0),
  duration_in_frames integer not null default 90 check (duration_in_frames between 1 and 108000),
  scene_data jsonb not null default '{"elements": [], "transition": null}'::jsonb,
  data_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_scenes_order_unique unique (project_id, scene_order) deferrable initially deferred
);

create index project_scenes_project_order_idx on public.project_scenes (project_id, scene_order);
create index project_scenes_owner_idx on public.project_scenes (owner_id);

create trigger project_scenes_set_updated_at
  before update on public.project_scenes
  for each row execute function public.set_updated_at();

-- Derive owner_id from the parent project. Runs as the caller, so a user who
-- cannot see the project under RLS gets "project not found" instead of a scene.
create or replace function public.sync_scene_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  project_owner uuid;
begin
  select p.owner_id into project_owner
  from public.projects p
  where p.id = new.project_id;

  if project_owner is null then
    raise exception 'project % not found or not accessible', new.project_id
      using errcode = 'foreign_key_violation';
  end if;

  new.owner_id = project_owner;
  return new;
end;
$fn$;

revoke execute on function public.sync_scene_owner() from public, anon, authenticated;

create trigger project_scenes_sync_owner
  before insert or update of project_id on public.project_scenes
  for each row execute function public.sync_scene_owner();

-- ---------------------------------------------------------------- assets
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  asset_type public.asset_type not null default 'image',
  storage_path text not null unique check (char_length(storage_path) <= 2048),
  mime_type text check (char_length(mime_type) <= 160),
  file_size_bytes bigint check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assets_owner_created_idx on public.assets (owner_id, created_at desc);
create index assets_project_idx on public.assets (project_id);

-- ----------------------------------------------------------- render_jobs
create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  status public.render_status not null default 'queued',
  render_settings jsonb not null default '{}'::jsonb,
  output_path text check (char_length(output_path) <= 2048),
  error_message text check (char_length(error_message) <= 4000),
  progress real not null default 0 check (progress >= 0 and progress <= 1),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index render_jobs_owner_created_idx on public.render_jobs (owner_id, created_at desc);
create index render_jobs_project_created_idx on public.render_jobs (project_id, created_at desc);
create index render_jobs_active_idx on public.render_jobs (status) where status in ('queued', 'processing');

create trigger render_jobs_set_updated_at
  before update on public.render_jobs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_scenes enable row level security;
alter table public.assets enable row level security;
alter table public.render_jobs enable row level security;

-- profiles: a user reads and edits only their own row; inserts come from the trigger.
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- projects
create policy projects_select_own on public.projects
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projects_update_own on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy projects_delete_own on public.projects
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- project_scenes
create policy project_scenes_select_own on public.project_scenes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy project_scenes_insert_own on public.project_scenes
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy project_scenes_update_own on public.project_scenes
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy project_scenes_delete_own on public.project_scenes
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- assets
create policy assets_select_own on public.assets
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy assets_insert_own on public.assets
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy assets_update_own on public.assets
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy assets_delete_own on public.assets
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- render_jobs: clients create and read jobs; only the render service (service_role,
-- which bypasses RLS) advances status, so there is no client UPDATE policy.
create policy render_jobs_select_own on public.render_jobs
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy render_jobs_insert_own on public.render_jobs
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy render_jobs_delete_own on public.render_jobs
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------- grants
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_scenes to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, delete on public.render_jobs to authenticated;
