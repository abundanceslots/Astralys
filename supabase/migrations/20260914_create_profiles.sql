-- Comptes Astrélys liés à Supabase Auth.
-- Cette migration conserve une éventuelle ancienne table profiles.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists country text;

-- Complète les anciens profils avant de rendre les champs obligatoires.
update public.profiles as profiles
set
  email = coalesce(users.email, ''),
  display_name = coalesce(
    nullif(trim(profiles.display_name), ''),
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Astronome'
  ),
  first_name = coalesce(profiles.first_name, nullif(trim(users.raw_user_meta_data ->> 'first_name'), '')),
  last_name = coalesce(profiles.last_name, nullif(trim(users.raw_user_meta_data ->> 'last_name'), '')),
  country = coalesce(profiles.country, nullif(trim(users.raw_user_meta_data ->> 'country'), ''))
from auth.users as users
where profiles.id = users.id;

update public.profiles set email = '' where email is null;
update public.profiles set display_name = 'Astronome' where display_name is null or trim(display_name) = '';

alter table public.profiles alter column email set not null;
alter table public.profiles alter column display_name set default 'Astronome';
alter table public.profiles alter column display_name set not null;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    country
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Astronome'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'country'), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    display_name = excluded.display_name,
    country = excluded.country,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(new.email, ''), updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute procedure public.handle_user_email_change();

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();

-- Ajoute les comptes Auth qui n'avaient pas encore de fiche publique privée.
insert into public.profiles (id, email, first_name, last_name, display_name, country, created_at)
select
  users.id,
  coalesce(users.email, ''),
  nullif(trim(users.raw_user_meta_data ->> 'first_name'), ''),
  nullif(trim(users.raw_user_meta_data ->> 'last_name'), ''),
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Astronome'
  ),
  nullif(trim(users.raw_user_meta_data ->> 'country'), ''),
  users.created_at
from auth.users as users
on conflict (id) do nothing;
