create extension if not exists pgcrypto;

create table if not exists public.saved_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_username text not null,
  window_days integer not null check (window_days in (7, 30, 90, 180, 365)),
  profile_name text,
  headline text,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint saved_results_user_username_window_unique unique (user_id, github_username, window_days)
);

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
