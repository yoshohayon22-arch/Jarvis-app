-- =====================================================================
-- Dashboard — Phase 0 : liste blanche + préférences
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
-- =====================================================================

-- 1. Liste blanche (schéma privé, invisible depuis l'API publique).
create schema if not exists private;

create table if not exists private.allowed_emails (
  email text primary key check (email = lower(email))
);

-- 2. Refuse la création de tout compte dont l'email n'est pas dans la liste blanche.
--    Même si quelqu'un contourne l'app, Supabase n'acceptera pas son inscription.
create or replace function private.enforce_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.allowed_emails where email = lower(new.email)) then
    raise exception 'Compte non autorisé';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_allowlist on auth.users;
create trigger enforce_allowlist
  before insert on auth.users
  for each row execute function private.enforce_allowlist();

-- 3. Préférences (thème, onglets). Une ligne par utilisateur.
create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'nuit' check (theme in ('nuit', 'glass', 'brutal', 'dessine')),
  tab_order text[] not null default '{}',
  hidden_tabs text[] not null default '{}',
  favorites text[] not null default '{}',
  sidebar_collapsed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row Level Security : chacun ne voit et ne modifie que sa propre ligne.
alter table public.preferences enable row level security;

drop policy if exists "preferences_select_own" on public.preferences;
create policy "preferences_select_own" on public.preferences
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "preferences_insert_own" on public.preferences;
create policy "preferences_insert_own" on public.preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_update_own" on public.preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 4. Ajoute TON adresse Gmail (remplace la valeur ci-dessous, en minuscules), puis exécute :
-- insert into private.allowed_emails (email) values ('ton.adresse@gmail.com') on conflict do nothing;
