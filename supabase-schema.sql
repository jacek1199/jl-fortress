-- JL Fortress — schemat bazy Supabase
-- Uruchom ten skrypt raz: supabase.com → Twój projekt → SQL Editor → New query → wklej → Run

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Dostęp przez klucz anon (taki sam model jak w AC Electrics):
-- kto ma klucz anon Twojego projektu, ten ma dostęp do danych.
-- Nie udostępniaj nikomu adresu projektu ani klucza.
create policy "anon select" on public.app_state for select using (true);
create policy "anon insert" on public.app_state for insert with check (true);
create policy "anon update" on public.app_state for update using (true);
