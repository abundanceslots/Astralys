-- Astrélys — systèmes planétaires, gardiens, satellites et économie v1.
-- Les données astronomiques restent séparées de la progression des joueurs.

create table if not exists public.planetary_systems (
  id uuid primary key default gen_random_uuid(),
  star_id uuid not null unique references public.celestial_objects (id) on delete cascade,
  nasa_hostname text,
  confirmed_planet_count integer not null default 0 check (confirmed_planet_count >= 0),
  data_status text not null default 'unknown'
    check (data_status in ('unknown', 'none_confirmed', 'candidates', 'confirmed')),
  source_name text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planetary_system_planets (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.planetary_systems (id) on delete cascade,
  planet_id uuid not null unique references public.celestial_objects (id) on delete cascade,
  orbit_order integer check (orbit_order is null or orbit_order > 0),
  discovery_status text not null default 'confirmed'
    check (discovery_status in ('candidate', 'confirmed')),
  created_at timestamptz not null default now(),
  unique (system_id, orbit_order)
);

create table if not exists public.base_level_rules (
  level integer primary key check (level between 1 and 10),
  satellite_slots integer not null check (satellite_slots > 0),
  storage_capacity bigint not null check (storage_capacity > 0),
  offline_cap_hours integer not null check (offline_cap_hours between 1 and 168),
  base_energy_per_hour integer not null default 0,
  base_data_per_hour integer not null default 0,
  base_materials_per_hour integer not null default 0,
  upgrade_energy_cost bigint not null default 0,
  upgrade_data_cost bigint not null default 0,
  upgrade_materials_cost bigint not null default 0,
  upgrade_seconds integer not null default 0
);

create table if not exists public.satellite_level_rules (
  satellite_type text not null
    check (satellite_type in ('solar_collector', 'science_probe', 'extractor', 'relay')),
  level integer not null check (level between 1 and 5),
  required_base_level integer not null check (required_base_level between 1 and 10),
  requires_planet boolean not null default false,
  build_energy_cost bigint not null default 0,
  build_data_cost bigint not null default 0,
  build_materials_cost bigint not null default 0,
  build_seconds integer not null default 0,
  energy_per_hour integer not null default 0,
  data_per_hour integer not null default 0,
  materials_per_hour integer not null default 0,
  network_power integer not null default 0,
  primary key (satellite_type, level)
);

create table if not exists public.planet_unlock_rules (
  orbit_order integer primary key check (orbit_order between 1 and 8),
  required_base_level integer not null check (required_base_level between 1 and 10),
  energy_cost bigint not null default 0,
  data_cost bigint not null default 0,
  materials_cost bigint not null default 0,
  exploration_seconds integer not null default 0
);

create table if not exists public.interstellar_connection_rules (
  level integer primary key check (level between 1 and 3),
  required_base_level integer not null check (required_base_level between 1 and 10),
  required_network_power integer not null check (required_network_power > 0),
  energy_cost bigint not null,
  data_cost bigint not null,
  materials_cost bigint not null,
  build_seconds integer not null
);

create table if not exists public.guardian_systems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  system_id uuid not null references public.planetary_systems (id) on delete cascade,
  acquisition_source text not null default 'reward'
    check (acquisition_source in ('starter', 'pack', 'reward', 'gift')),
  base_level integer not null default 1 references public.base_level_rules (level),
  base_status text not null default 'active'
    check (base_status in ('active', 'upgrading')),
  base_upgrade_completes_at timestamptz,
  energy bigint not null default 350 check (energy >= 0),
  research_data bigint not null default 100 check (research_data >= 0),
  materials bigint not null default 0 check (materials >= 0),
  last_collected_at timestamptz not null default now(),
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, system_id)
);

alter table public.guardian_systems alter column energy set default 350;
alter table public.guardian_systems alter column research_data set default 100;

create table if not exists public.guardian_planets (
  id uuid primary key default gen_random_uuid(),
  guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  system_planet_id uuid not null references public.planetary_system_planets (id) on delete cascade,
  status text not null default 'locked'
    check (status in ('locked', 'exploring', 'unlocked')),
  exploration_started_at timestamptz,
  exploration_completes_at timestamptz,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guardian_system_id, system_planet_id)
);

create table if not exists public.guardian_satellites (
  id uuid primary key default gen_random_uuid(),
  guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  guardian_planet_id uuid references public.guardian_planets (id) on delete cascade,
  satellite_type text not null,
  level integer not null default 1,
  status text not null default 'building'
    check (status in ('building', 'active', 'upgrading')),
  construction_started_at timestamptz not null default now(),
  completes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (satellite_type, level)
    references public.satellite_level_rules (satellite_type, level)
);

create table if not exists public.interstellar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  to_guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  level integer not null default 1 references public.interstellar_connection_rules (level),
  status text not null default 'building'
    check (status in ('building', 'active', 'upgrading')),
  construction_started_at timestamptz not null default now(),
  completes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_guardian_system_id <> to_guardian_system_id),
  unique (user_id, from_guardian_system_id, to_guardian_system_id)
);

create table if not exists public.guardian_resource_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  source text not null,
  energy_delta bigint not null default 0,
  data_delta bigint not null default 0,
  materials_delta bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists planetary_systems_nasa_hostname_idx
  on public.planetary_systems (nasa_hostname);
create index if not exists planetary_system_planets_system_idx
  on public.planetary_system_planets (system_id);
create index if not exists guardian_systems_user_idx
  on public.guardian_systems (user_id);
create index if not exists guardian_planets_system_idx
  on public.guardian_planets (guardian_system_id);
create index if not exists guardian_satellites_system_idx
  on public.guardian_satellites (guardian_system_id);
create index if not exists interstellar_connections_user_idx
  on public.interstellar_connections (user_id);
create index if not exists guardian_resource_ledger_user_created_idx
  on public.guardian_resource_ledger (user_id, created_at desc);

insert into public.base_level_rules (
  level, satellite_slots, storage_capacity, offline_cap_hours,
  base_energy_per_hour, base_data_per_hour, base_materials_per_hour,
  upgrade_energy_cost, upgrade_data_cost, upgrade_materials_cost, upgrade_seconds
)
values
  (1,  2,   1000, 12,   8,  2, 0,      0,     0,     0,      0),
  (2,  3,   2500, 12,  12,  3, 1,    300,    40,     0,    600),
  (3,  4,   5000, 16,  18,  5, 2,    800,   120,    40,   1800),
  (4,  5,  10000, 16,  28,  8, 3,   1800,   300,   140,   7200),
  (5,  6,  20000, 24,  42, 12, 5,   4000,   750,   350,  21600),
  (6,  8,  40000, 24,  65, 18, 8,   8500,  1600,   800,  43200),
  (7, 10,  70000, 36,  95, 27,12,  17000,  3500,  1800,  86400),
  (8, 12, 120000, 36, 140, 40,18,  32000,  7000,  4000, 172800),
  (9, 15, 200000, 48, 210, 60,27,  55000, 13000,  8000, 259200),
  (10,18, 350000, 72, 320, 90,40,  90000, 22000, 15000, 345600)
on conflict (level) do update set
  satellite_slots = excluded.satellite_slots,
  storage_capacity = excluded.storage_capacity,
  offline_cap_hours = excluded.offline_cap_hours,
  base_energy_per_hour = excluded.base_energy_per_hour,
  base_data_per_hour = excluded.base_data_per_hour,
  base_materials_per_hour = excluded.base_materials_per_hour,
  upgrade_energy_cost = excluded.upgrade_energy_cost,
  upgrade_data_cost = excluded.upgrade_data_cost,
  upgrade_materials_cost = excluded.upgrade_materials_cost,
  upgrade_seconds = excluded.upgrade_seconds;

insert into public.satellite_level_rules (
  satellite_type, level, required_base_level, requires_planet,
  build_energy_cost, build_data_cost, build_materials_cost, build_seconds,
  energy_per_hour, data_per_hour, materials_per_hour, network_power
)
values
  ('solar_collector', 1, 1, false,   100,    0,    0,     60,  20,   0,   0,   2),
  ('solar_collector', 2, 2, false,   400,   80,   20,   1800,  50,   0,   0,   5),
  ('solar_collector', 3, 3, false,  1400,  300,  100,   7200, 115,   0,   0,  10),
  ('solar_collector', 4, 5, false,  4500,  900,  350,  21600, 240,   0,   0,  18),
  ('solar_collector', 5, 7, false, 14000, 2800, 1200,  64800, 500,   0,   0,  30),
  ('science_probe',   1, 1, false,    80,   20,    0,    120,   0,   8,   0,   3),
  ('science_probe',   2, 2, false,   320,  100,   10,   1800,   0,  20,   0,   7),
  ('science_probe',   3, 3, false,  1100,  350,   80,   7200,   0,  45,   0,  14),
  ('science_probe',   4, 5, false,  3600, 1100,  300,  21600,   0,  95,   0,  24),
  ('science_probe',   5, 7, false, 11000, 3500, 1000,  64800,   0, 190,   0,  40),
  ('extractor',       1, 2, true,    180,   30,    0,    300,   0,   0,   6,   2),
  ('extractor',       2, 3, true,    650,  150,   30,   2700,   0,   0,  15,   5),
  ('extractor',       3, 4, true,   2100,  500,  150,  10800,   0,   0,  34,  10),
  ('extractor',       4, 6, true,   6800, 1600,  550,  32400,   0,   0,  72,  18),
  ('extractor',       5, 8, true,  21000, 5000, 1900,  86400,   0,   0, 145,  30),
  ('relay',           1, 2, false,   250,   80,   20,    600,   0,   0,   0,  15),
  ('relay',           2, 3, false,   900,  280,   80,   3600,   0,   0,   0,  35),
  ('relay',           3, 4, false,  3000,  900,  300,  14400,   0,   0,   0,  75),
  ('relay',           4, 6, false,  9500, 2800, 1000,  43200,   0,   0,   0, 150),
  ('relay',           5, 8, false, 30000, 8500, 3200, 108000,   0,   0,   0, 300)
on conflict (satellite_type, level) do update set
  required_base_level = excluded.required_base_level,
  requires_planet = excluded.requires_planet,
  build_energy_cost = excluded.build_energy_cost,
  build_data_cost = excluded.build_data_cost,
  build_materials_cost = excluded.build_materials_cost,
  build_seconds = excluded.build_seconds,
  energy_per_hour = excluded.energy_per_hour,
  data_per_hour = excluded.data_per_hour,
  materials_per_hour = excluded.materials_per_hour,
  network_power = excluded.network_power;

insert into public.planet_unlock_rules (
  orbit_order, required_base_level, energy_cost, data_cost, materials_cost, exploration_seconds
)
values
  (1, 1,   100,    30,    0,    300),
  (2, 2,   350,   100,   20,   1800),
  (3, 3,   900,   300,   80,   7200),
  (4, 4,  2200,   700,  200,  21600),
  (5, 5,  5000,  1500,  500,  43200),
  (6, 6, 10000,  3200, 1200,  86400),
  (7, 7, 20000,  6500, 2500, 172800),
  (8, 8, 40000, 12000, 5000, 259200)
on conflict (orbit_order) do update set
  required_base_level = excluded.required_base_level,
  energy_cost = excluded.energy_cost,
  data_cost = excluded.data_cost,
  materials_cost = excluded.materials_cost,
  exploration_seconds = excluded.exploration_seconds;

insert into public.interstellar_connection_rules (
  level, required_base_level, required_network_power,
  energy_cost, data_cost, materials_cost, build_seconds
)
values
  (1, 5, 100,  12000,  3000,  1500,  86400),
  (2, 7, 250,  40000, 10000,  6000, 259200),
  (3, 9, 500, 120000, 30000, 18000, 604800)
on conflict (level) do update set
  required_base_level = excluded.required_base_level,
  required_network_power = excluded.required_network_power,
  energy_cost = excluded.energy_cost,
  data_cost = excluded.data_cost,
  materials_cost = excluded.materials_cost,
  build_seconds = excluded.build_seconds;

-- Toute étoile du catalogue possède un système, même si aucune planète n'est connue.
insert into public.planetary_systems (star_id, data_status)
select celestial_objects.id, 'unknown'
from public.celestial_objects
where celestial_objects.object_type = 'star'
on conflict (star_id) do nothing;

create or replace function public.set_game_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_planetary_system_for_star()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.object_type = 'star' then
    insert into public.planetary_systems (star_id, data_status)
    values (new.id, 'unknown')
    on conflict (star_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_planetary_system_after_star_insert on public.celestial_objects;
create trigger ensure_planetary_system_after_star_insert
  after insert on public.celestial_objects
  for each row execute procedure public.ensure_planetary_system_for_star();

create or replace function public.refresh_confirmed_planet_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  affected_system_id uuid;
  confirmed_count integer;
  candidate_count integer;
begin
  if tg_op = 'DELETE' then
    affected_system_id := old.system_id;
  else
    affected_system_id := new.system_id;
  end if;

  select
    count(*) filter (where discovery_status = 'confirmed'),
    count(*) filter (where discovery_status = 'candidate')
  into confirmed_count, candidate_count
  from public.planetary_system_planets
  where system_id = affected_system_id;

  update public.planetary_systems
  set
    confirmed_planet_count = confirmed_count,
    data_status = case
      when confirmed_count > 0 then 'confirmed'
      when candidate_count > 0 then 'candidates'
      else 'none_confirmed'
    end,
    updated_at = now()
  where id = affected_system_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_planet_count_after_mapping on public.planetary_system_planets;
create trigger refresh_planet_count_after_mapping
  after insert or update or delete on public.planetary_system_planets
  for each row execute procedure public.refresh_confirmed_planet_count();

drop trigger if exists set_planetary_systems_updated_at on public.planetary_systems;
create trigger set_planetary_systems_updated_at
  before update on public.planetary_systems
  for each row execute procedure public.set_game_updated_at();
drop trigger if exists set_guardian_systems_updated_at on public.guardian_systems;
create trigger set_guardian_systems_updated_at
  before update on public.guardian_systems
  for each row execute procedure public.set_game_updated_at();
drop trigger if exists set_guardian_planets_updated_at on public.guardian_planets;
create trigger set_guardian_planets_updated_at
  before update on public.guardian_planets
  for each row execute procedure public.set_game_updated_at();
drop trigger if exists set_guardian_satellites_updated_at on public.guardian_satellites;
create trigger set_guardian_satellites_updated_at
  before update on public.guardian_satellites
  for each row execute procedure public.set_game_updated_at();
drop trigger if exists set_interstellar_connections_updated_at on public.interstellar_connections;
create trigger set_interstellar_connections_updated_at
  before update on public.interstellar_connections
  for each row execute procedure public.set_game_updated_at();

-- Collecte transactionnelle : temps hors ligne plafonné par le niveau de la base.
create or replace function public.claim_guardian_resources(p_guardian_system_id uuid)
returns table (
  energy_balance bigint,
  data_balance bigint,
  materials_balance bigint,
  gained_energy bigint,
  gained_data bigint,
  gained_materials bigint,
  collected_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  guardian_row public.guardian_systems%rowtype;
  rule_row public.base_level_rules%rowtype;
  elapsed_hours numeric;
  satellite_energy bigint;
  satellite_data bigint;
  satellite_materials bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into guardian_row
  from public.guardian_systems
  where id = p_guardian_system_id
  for update;

  if not found or guardian_row.user_id <> (select auth.uid()) then
    raise exception 'Guardian system not found';
  end if;

  update public.guardian_satellites
  set status = 'active', updated_at = now()
  where guardian_system_id = p_guardian_system_id
    and status in ('building', 'upgrading')
    and completes_at is not null
    and completes_at <= now();

  select * into rule_row
  from public.base_level_rules
  where level = guardian_row.base_level;

  select
    coalesce(sum(rules.energy_per_hour), 0),
    coalesce(sum(rules.data_per_hour), 0),
    coalesce(sum(rules.materials_per_hour), 0)
  into satellite_energy, satellite_data, satellite_materials
  from public.guardian_satellites as satellites
  join public.satellite_level_rules as rules
    on rules.satellite_type = satellites.satellite_type
   and rules.level = satellites.level
  where satellites.guardian_system_id = p_guardian_system_id
    and satellites.status = 'active';

  elapsed_hours := greatest(
    0,
    least(
      extract(epoch from (now() - guardian_row.last_collected_at)) / 3600,
      rule_row.offline_cap_hours
    )
  );

  gained_energy := floor((rule_row.base_energy_per_hour + satellite_energy) * elapsed_hours);
  gained_data := floor((rule_row.base_data_per_hour + satellite_data) * elapsed_hours);
  gained_materials := floor((rule_row.base_materials_per_hour + satellite_materials) * elapsed_hours);

  update public.guardian_systems as systems
  set
    energy = least(rule_row.storage_capacity, systems.energy + gained_energy),
    research_data = least(rule_row.storage_capacity, systems.research_data + gained_data),
    materials = least(rule_row.storage_capacity, systems.materials + gained_materials),
    last_collected_at = now()
  where systems.id = p_guardian_system_id
  returning systems.energy, systems.research_data, systems.materials, systems.last_collected_at
  into energy_balance, data_balance, materials_balance, collected_at;

  insert into public.guardian_resource_ledger (
    user_id, guardian_system_id, source,
    energy_delta, data_delta, materials_delta,
    metadata
  )
  values (
    guardian_row.user_id, p_guardian_system_id, 'offline_production',
    gained_energy, gained_data, gained_materials,
    jsonb_build_object('elapsed_hours', elapsed_hours, 'economy_version', 1)
  );

  return next;
end;
$$;

alter table public.planetary_systems enable row level security;
alter table public.planetary_system_planets enable row level security;
alter table public.base_level_rules enable row level security;
alter table public.satellite_level_rules enable row level security;
alter table public.planet_unlock_rules enable row level security;
alter table public.interstellar_connection_rules enable row level security;
alter table public.guardian_systems enable row level security;
alter table public.guardian_planets enable row level security;
alter table public.guardian_satellites enable row level security;
alter table public.interstellar_connections enable row level security;
alter table public.guardian_resource_ledger enable row level security;

revoke all on table
  public.planetary_systems,
  public.planetary_system_planets,
  public.base_level_rules,
  public.satellite_level_rules,
  public.planet_unlock_rules,
  public.interstellar_connection_rules,
  public.guardian_systems,
  public.guardian_planets,
  public.guardian_satellites,
  public.interstellar_connections,
  public.guardian_resource_ledger
from anon, authenticated;

grant select on table
  public.planetary_systems,
  public.planetary_system_planets,
  public.base_level_rules,
  public.satellite_level_rules,
  public.planet_unlock_rules,
  public.interstellar_connection_rules
to anon, authenticated;

grant select on table
  public.guardian_systems,
  public.guardian_planets,
  public.guardian_satellites,
  public.interstellar_connections,
  public.guardian_resource_ledger
to authenticated;

grant all on table
  public.planetary_systems,
  public.planetary_system_planets,
  public.base_level_rules,
  public.satellite_level_rules,
  public.planet_unlock_rules,
  public.interstellar_connection_rules,
  public.guardian_systems,
  public.guardian_planets,
  public.guardian_satellites,
  public.interstellar_connections,
  public.guardian_resource_ledger
to service_role;

grant usage, select on sequence public.guardian_resource_ledger_id_seq to service_role;

drop policy if exists planetary_systems_public_read on public.planetary_systems;
create policy planetary_systems_public_read on public.planetary_systems
  for select to anon, authenticated using (true);
drop policy if exists planetary_system_planets_public_read on public.planetary_system_planets;
create policy planetary_system_planets_public_read on public.planetary_system_planets
  for select to anon, authenticated using (true);
drop policy if exists base_level_rules_public_read on public.base_level_rules;
create policy base_level_rules_public_read on public.base_level_rules
  for select to anon, authenticated using (true);
drop policy if exists satellite_level_rules_public_read on public.satellite_level_rules;
create policy satellite_level_rules_public_read on public.satellite_level_rules
  for select to anon, authenticated using (true);
drop policy if exists planet_unlock_rules_public_read on public.planet_unlock_rules;
create policy planet_unlock_rules_public_read on public.planet_unlock_rules
  for select to anon, authenticated using (true);
drop policy if exists interstellar_connection_rules_public_read on public.interstellar_connection_rules;
create policy interstellar_connection_rules_public_read on public.interstellar_connection_rules
  for select to anon, authenticated using (true);

drop policy if exists guardian_systems_read_own on public.guardian_systems;
create policy guardian_systems_read_own on public.guardian_systems
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists guardian_planets_read_own on public.guardian_planets;
create policy guardian_planets_read_own on public.guardian_planets
  for select to authenticated using (
    exists (
      select 1 from public.guardian_systems
      where guardian_systems.id = guardian_planets.guardian_system_id
        and guardian_systems.user_id = (select auth.uid())
    )
  );
drop policy if exists guardian_satellites_read_own on public.guardian_satellites;
create policy guardian_satellites_read_own on public.guardian_satellites
  for select to authenticated using (
    exists (
      select 1 from public.guardian_systems
      where guardian_systems.id = guardian_satellites.guardian_system_id
        and guardian_systems.user_id = (select auth.uid())
    )
  );
drop policy if exists interstellar_connections_read_own on public.interstellar_connections;
create policy interstellar_connections_read_own on public.interstellar_connections
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists guardian_resource_ledger_read_own on public.guardian_resource_ledger;
create policy guardian_resource_ledger_read_own on public.guardian_resource_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on function public.claim_guardian_resources(uuid) from public;
grant execute on function public.claim_guardian_resources(uuid) to authenticated;
