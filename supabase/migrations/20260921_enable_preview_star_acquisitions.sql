-- Astralys preview acquisitions.
-- A purchase represents symbolic guardianship inside Astralys, never legal ownership.

alter table public.celestial_objects
  alter column is_purchasable set default true;

update public.celestial_objects
set is_purchasable = true
where object_type = 'star'
  and is_purchasable is distinct from true;

create table if not exists public.purchase_preview_accounts (
  email text primary key,
  note text,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

insert into public.purchase_preview_accounts (email, note)
values ('contact@abundanceslots.com', 'Astralys purchase preview account')
on conflict (email) do update set note = excluded.note;

create table if not exists public.star_acquisitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  star_id uuid not null references public.celestial_objects (id) on delete restrict,
  status text not null default 'completed' check (status in ('completed', 'refunded', 'cancelled')),
  provider text not null default 'preview_allowlist',
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  acquired_at timestamptz not null default now(),
  unique (user_id, star_id)
);

create index if not exists star_acquisitions_user_created_idx
  on public.star_acquisitions (user_id, acquired_at desc);

alter table public.guardian_systems
  drop constraint if exists guardian_systems_acquisition_source_check;

alter table public.guardian_systems
  add constraint guardian_systems_acquisition_source_check
  check (acquisition_source in ('starter', 'pack', 'reward', 'gift', 'purchase'));

alter table public.purchase_preview_accounts enable row level security;
alter table public.star_acquisitions enable row level security;

revoke all on table public.purchase_preview_accounts, public.star_acquisitions from anon, authenticated;
grant select on table public.star_acquisitions to authenticated;
grant all on table public.purchase_preview_accounts, public.star_acquisitions to service_role;

drop policy if exists star_acquisitions_read_own on public.star_acquisitions;
create policy star_acquisitions_read_own
on public.star_acquisitions
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.complete_preview_star_acquisition(p_star_id uuid)
returns table (
  acquisition_id uuid,
  acquired_star_id uuid,
  completed_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text;
  selected_system_id uuid;
  acquisition_row public.star_acquisitions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(trim(users.email))
  into current_email
  from auth.users as users
  where users.id = current_user_id;

  if not exists (
    select 1
    from public.purchase_preview_accounts as accounts
    where accounts.email = current_email
  ) then
    raise exception 'This account is not enabled for the purchase preview';
  end if;

  if not exists (
    select 1
    from public.celestial_objects as objects
    where objects.id = p_star_id
      and objects.object_type = 'star'
      and objects.is_purchasable = true
  ) then
    raise exception 'This star is not available for acquisition';
  end if;

  insert into public.star_acquisitions (
    user_id, star_id, status, provider, amount_cents, currency
  )
  values (
    current_user_id, p_star_id, 'completed', 'preview_allowlist', 0, 'EUR'
  )
  on conflict (user_id, star_id) do update set
    status = 'completed'
  returning * into acquisition_row;

  insert into public.planetary_systems (star_id, data_status)
  values (p_star_id, 'unknown')
  on conflict (star_id) do nothing;

  select systems.id
  into selected_system_id
  from public.planetary_systems as systems
  where systems.star_id = p_star_id;

  insert into public.guardian_systems (user_id, system_id, acquisition_source)
  values (current_user_id, selected_system_id, 'purchase')
  on conflict (user_id, system_id) do nothing;

  return query select acquisition_row.id, acquisition_row.star_id, acquisition_row.acquired_at;
end;
$$;

revoke all on function public.complete_preview_star_acquisition(uuid) from public;
grant execute on function public.complete_preview_star_acquisition(uuid) to authenticated;
