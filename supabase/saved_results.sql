create extension if not exists pgcrypto;

create table if not exists public.saved_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_username text not null,
  window_days integer not null check (window_days in (7, 30, 90, 180, 365)),
  analysis_date date,
  analysis_generated_at timestamptz,
  profile_name text,
  headline text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.saved_results
  add column if not exists analysis_date date;

alter table public.saved_results
  add column if not exists analysis_generated_at timestamptz;

update public.saved_results
set
  analysis_generated_at = coalesce(analysis_generated_at, created_at),
  analysis_date = coalesce(analysis_date, created_at::date)
where analysis_generated_at is null or analysis_date is null;

alter table public.saved_results
  alter column analysis_date set not null;

alter table public.saved_results
  alter column analysis_generated_at set not null;

alter table public.saved_results
  drop constraint if exists saved_results_user_username_window_unique;

alter table public.saved_results
  drop constraint if exists saved_results_user_username_window_analysis_date_unique;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_results_user_username_window_analysis_date_unique'
  ) then
    alter table public.saved_results
      add constraint saved_results_user_username_window_analysis_date_unique
      unique (user_id, github_username, window_days, analysis_date);
  end if;
end;
$$;

create index if not exists saved_results_user_created_at_idx
on public.saved_results (user_id, created_at desc);

alter table public.saved_results enable row level security;

drop policy if exists "saved_results_select_own" on public.saved_results;
create policy "saved_results_select_own"
on public.saved_results
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "saved_results_insert_own" on public.saved_results;
create policy "saved_results_insert_own"
on public.saved_results
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "saved_results_delete_own" on public.saved_results;
create policy "saved_results_delete_own"
on public.saved_results
for delete
to authenticated
using (auth.uid() = user_id);

notify pgrst, 'reload schema';
