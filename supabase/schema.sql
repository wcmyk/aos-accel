-- Accel Phase 0: persistence + sharing schema.
-- Run this once in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists public.workbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled workbook',
  data jsonb not null default '{"version":1,"activeSheet":"Sheet1","sheets":[]}'::jsonb,
  is_public boolean not null default false,
  share_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workbooks_owner_id_idx on public.workbooks (owner_id);
create unique index if not exists workbooks_share_token_idx on public.workbooks (share_token);

alter table public.workbooks enable row level security;

-- Owners can do everything with their own workbooks. This is the *only*
-- table-level policy: there is deliberately no "is_public = true" SELECT
-- policy here, because that would make a public workbook readable by its
-- `id` alone, defeating the point of a revocable share_token. Public
-- access instead goes through get_shared_workbook() below.
create policy "workbooks_owner_all" on public.workbooks
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Share-by-token read access. SECURITY DEFINER lets this bypass the
-- owner-only RLS policy above, but only to return the single row matching
-- both the token and is_public=true -- so turning is_public off, or
-- regenerating share_token (revoking old links), immediately cuts access
-- without touching the workbook's `id`.
create or replace function public.get_shared_workbook(token uuid)
returns setof public.workbooks
language sql
security definer
set search_path = public
as $$
  select * from public.workbooks
  where share_token = token and is_public = true;
$$;

-- Keep updated_at current on every write.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workbooks_set_updated_at on public.workbooks;
create trigger workbooks_set_updated_at
  before update on public.workbooks
  for each row
  execute function public.set_updated_at();
