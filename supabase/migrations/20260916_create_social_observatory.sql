-- Astrélys — observatoire personnel, satellites, colonies simulées et alliances de proximité.
-- Cette couche remplace la collecte intensive de ressources par trois progressions légères :
-- connaissance, exploration et connexion.

create table if not exists public.observatory_instrument_rules (
  instrument_type text primary key
    check (instrument_type in ('observation', 'probe', 'relay', 'station', 'telescope')),
  display_name text not null,
  description text not null,
  required_knowledge integer not null default 0,
  required_exploration integer not null default 0,
  required_connection integer not null default 0,
  mission_seconds integer not null default 0,
  reward_knowledge integer not null default 0,
  reward_exploration integer not null default 0,
  reward_connection integer not null default 0,
  sort_order integer not null
);

create table if not exists public.guardian_observatory_progress (
  guardian_system_id uuid primary key references public.guardian_systems (id) on delete cascade,
  knowledge integer not null default 0 check (knowledge >= 0),
  exploration integer not null default 0 check (exploration >= 0),
  connection integer not null default 0 check (connection >= 0),
  observation_count integer not null default 0 check (observation_count >= 0),
  last_observation_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observatory_satellites (
  id uuid primary key default gen_random_uuid(),
  guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  guardian_planet_id uuid references public.guardian_planets (id) on delete cascade,
  instrument_type text not null references public.observatory_instrument_rules (instrument_type),
  level integer not null default 1 check (level between 1 and 5),
  status text not null default 'planned'
    check (status in ('planned', 'deploying', 'active', 'mission')),
  mission_started_at timestamptz,
  mission_completes_at timestamptz,
  telemetry jsonb not null default '{}'::jsonb,
  deployed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planet_colonies (
  id uuid primary key default gen_random_uuid(),
  guardian_planet_id uuid not null unique references public.guardian_planets (id) on delete cascade,
  stage text not null default 'survey'
    check (stage in ('survey', 'orbital_relay', 'science_station', 'simulated_colony')),
  progress integer not null default 0 check (progress between 0 and 100),
  is_simulation boolean not null default true check (is_simulation = true),
  scientific_constraints jsonb not null default '{}'::jsonb,
  visual_configuration jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Graphe dirigé des huit voisins physiques les plus proches de chaque système.
create table if not exists public.stellar_neighbors (
  system_id uuid not null references public.planetary_systems (id) on delete cascade,
  neighbor_system_id uuid not null references public.planetary_systems (id) on delete cascade,
  neighbor_rank integer not null check (neighbor_rank between 1 and 8),
  distance_ly numeric(14, 5) not null check (distance_ly >= 0),
  calculation_method text not null default 'three_dimensional'
    check (calculation_method in ('three_dimensional', 'angular_fallback')),
  calculated_at timestamptz not null default now(),
  primary key (system_id, neighbor_system_id),
  unique (system_id, neighbor_rank),
  check (system_id <> neighbor_system_id)
);

create table if not exists public.stellar_alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 40),
  description text,
  founder_user_id uuid not null references public.profiles (id) on delete cascade,
  anchor_system_id uuid not null references public.planetary_systems (id) on delete cascade,
  visibility text not null default 'invite_only'
    check (visibility in ('invite_only', 'open')),
  max_members integer not null default 8 check (max_members between 2 and 8),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stellar_alliance_members (
  alliance_id uuid not null references public.stellar_alliances (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  role text not null default 'member' check (role in ('founder', 'member')),
  joined_at timestamptz not null default now(),
  primary key (alliance_id, user_id),
  unique (alliance_id, guardian_system_id)
);

create table if not exists public.stellar_alliance_invitations (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.stellar_alliances (id) on delete cascade,
  invited_guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (alliance_id, invited_guardian_system_id)
);

create table if not exists public.stellar_network_links (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.stellar_alliances (id) on delete cascade,
  from_guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  to_guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'active')),
  connection_strength integer not null default 0 check (connection_strength between 0 and 100),
  shared_observation_count integer not null default 0 check (shared_observation_count >= 0),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_guardian_system_id <> to_guardian_system_id),
  unique (alliance_id, from_guardian_system_id, to_guardian_system_id)
);

create table if not exists public.stellar_alliance_missions (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.stellar_alliances (id) on delete cascade,
  mission_type text not null
    check (mission_type in ('observation_campaign', 'relay_calibration', 'planetary_survey')),
  title text not null,
  target_system_id uuid references public.planetary_systems (id) on delete set null,
  target_system_planet_id uuid references public.planetary_system_planets (id) on delete set null,
  goal_points integer not null check (goal_points > 0),
  current_points integer not null default 0 check (current_points >= 0),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stellar_alliance_contributions (
  id bigint generated always as identity primary key,
  mission_id uuid not null references public.stellar_alliance_missions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  guardian_system_id uuid not null references public.guardian_systems (id) on delete cascade,
  contribution_points integer not null check (contribution_points > 0),
  contribution_type text not null
    check (contribution_type in ('observation', 'satellite_mission', 'shared_data')),
  created_at timestamptz not null default now()
);

create index if not exists observatory_satellites_guardian_idx
  on public.observatory_satellites (guardian_system_id);
create index if not exists stellar_neighbors_neighbor_idx
  on public.stellar_neighbors (neighbor_system_id);
create index if not exists stellar_alliance_members_guardian_idx
  on public.stellar_alliance_members (guardian_system_id);
create index if not exists stellar_alliance_invitations_guardian_idx
  on public.stellar_alliance_invitations (invited_guardian_system_id, status);
create index if not exists stellar_network_links_alliance_idx
  on public.stellar_network_links (alliance_id);
create index if not exists stellar_alliance_missions_alliance_idx
  on public.stellar_alliance_missions (alliance_id, status);
create index if not exists stellar_alliance_contributions_mission_idx
  on public.stellar_alliance_contributions (mission_id, created_at desc);

insert into public.observatory_instrument_rules (
  instrument_type, display_name, description,
  required_knowledge, required_exploration, required_connection,
  mission_seconds, reward_knowledge, reward_exploration, reward_connection, sort_order
)
values
  ('observation', 'Satellite d’observation', 'Suit la position et les variations mesurables de l’astre.', 0, 0, 0, 300, 15, 5, 0, 1),
  ('probe', 'Sonde planétaire', 'Explore progressivement une planète confirmée.', 40, 20, 0, 21600, 20, 35, 0, 2),
  ('relay', 'Relais de communication', 'Relie le système aux gardiens stellaires voisins.', 60, 0, 20, 43200, 10, 5, 25, 3),
  ('station', 'Station scientifique', 'Installe une présence orbitale autour d’une planète explorée.', 120, 100, 40, 86400, 30, 60, 10, 4),
  ('telescope', 'Télescope spatial', 'Approfondit les données et les alertes scientifiques du système.', 200, 80, 60, 86400, 60, 20, 20, 5)
on conflict (instrument_type) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  required_knowledge = excluded.required_knowledge,
  required_exploration = excluded.required_exploration,
  required_connection = excluded.required_connection,
  mission_seconds = excluded.mission_seconds,
  reward_knowledge = excluded.reward_knowledge,
  reward_exploration = excluded.reward_exploration,
  reward_connection = excluded.reward_connection,
  sort_order = excluded.sort_order;

-- Calcule les huit voisins d'un seul système à la demande. L'ancienne requête
-- comparait les 10 000 étoiles entre elles (près de 100 millions de lignes
-- temporaires) et pouvait saturer le disque de la base. Cette version ne garde
-- jamais plus que les huit meilleurs résultats d'un scan de catalogue.
create or replace function public.refresh_stellar_neighbors_for_system(p_system_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  delete from public.stellar_neighbors where system_id = p_system_id;

  with origin as (
    select
      systems.id as system_id,
      objects.distance_ly * cos(radians(objects.dec_deg)) * cos(radians(objects.ra_deg)) as x,
      objects.distance_ly * cos(radians(objects.dec_deg)) * sin(radians(objects.ra_deg)) as y,
      objects.distance_ly * sin(radians(objects.dec_deg)) as z
    from public.planetary_systems as systems
    join public.celestial_objects as objects on objects.id = systems.star_id
    where systems.id = p_system_id
      and objects.distance_ly is not null
      and objects.distance_ly > 0
      and objects.ra_deg is not null
      and objects.dec_deg is not null
  ), nearest as (
    select
      candidates.id as neighbor_system_id,
      sqrt(
        power(origin.x - candidates.x, 2)
        + power(origin.y - candidates.y, 2)
        + power(origin.z - candidates.z, 2)
      ) as distance_ly
    from origin
    cross join lateral (
      select
        systems.id,
        objects.distance_ly * cos(radians(objects.dec_deg)) * cos(radians(objects.ra_deg)) as x,
        objects.distance_ly * cos(radians(objects.dec_deg)) * sin(radians(objects.ra_deg)) as y,
        objects.distance_ly * sin(radians(objects.dec_deg)) as z
      from public.planetary_systems as systems
      join public.celestial_objects as objects on objects.id = systems.star_id
      where systems.id <> p_system_id
        and objects.distance_ly is not null
        and objects.distance_ly > 0
        and objects.ra_deg is not null
        and objects.dec_deg is not null
    ) as candidates
    order by distance_ly, candidates.id
    limit 8
  ), inserted as (
    insert into public.stellar_neighbors (
      system_id, neighbor_system_id, neighbor_rank, distance_ly, calculation_method, calculated_at
    )
    select
      p_system_id,
      nearest.neighbor_system_id,
      row_number() over (order by nearest.distance_ly, nearest.neighbor_system_id)::integer,
      nearest.distance_ly,
      'three_dimensional',
      now()
    from nearest
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

create or replace function public.refresh_stellar_neighbors_after_guardian_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_stellar_neighbors_for_system(new.system_id);
  return new;
end;
$$;

drop trigger if exists refresh_stellar_neighbors_after_guardian_insert on public.guardian_systems;
create trigger refresh_stellar_neighbors_after_guardian_insert
  after insert on public.guardian_systems
  for each row execute function public.refresh_stellar_neighbors_after_guardian_insert();

create or replace function public.set_social_observatory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_guardian_observatory_progress_updated_at on public.guardian_observatory_progress;
create trigger set_guardian_observatory_progress_updated_at before update on public.guardian_observatory_progress
  for each row execute procedure public.set_social_observatory_updated_at();
drop trigger if exists set_observatory_satellites_updated_at on public.observatory_satellites;
create trigger set_observatory_satellites_updated_at before update on public.observatory_satellites
  for each row execute procedure public.set_social_observatory_updated_at();
drop trigger if exists set_planet_colonies_updated_at on public.planet_colonies;
create trigger set_planet_colonies_updated_at before update on public.planet_colonies
  for each row execute procedure public.set_social_observatory_updated_at();
drop trigger if exists set_stellar_alliances_updated_at on public.stellar_alliances;
create trigger set_stellar_alliances_updated_at before update on public.stellar_alliances
  for each row execute procedure public.set_social_observatory_updated_at();
drop trigger if exists set_stellar_network_links_updated_at on public.stellar_network_links;
create trigger set_stellar_network_links_updated_at before update on public.stellar_network_links
  for each row execute procedure public.set_social_observatory_updated_at();
drop trigger if exists set_stellar_alliance_missions_updated_at on public.stellar_alliance_missions;
create trigger set_stellar_alliance_missions_updated_at before update on public.stellar_alliance_missions
  for each row execute procedure public.set_social_observatory_updated_at();

alter table public.observatory_instrument_rules enable row level security;
alter table public.guardian_observatory_progress enable row level security;
alter table public.observatory_satellites enable row level security;
alter table public.planet_colonies enable row level security;
alter table public.stellar_neighbors enable row level security;
alter table public.stellar_alliances enable row level security;
alter table public.stellar_alliance_members enable row level security;
alter table public.stellar_alliance_invitations enable row level security;
alter table public.stellar_network_links enable row level security;
alter table public.stellar_alliance_missions enable row level security;
alter table public.stellar_alliance_contributions enable row level security;

revoke all on table
  public.observatory_instrument_rules,
  public.guardian_observatory_progress,
  public.observatory_satellites,
  public.planet_colonies,
  public.stellar_neighbors,
  public.stellar_alliances,
  public.stellar_alliance_members,
  public.stellar_alliance_invitations,
  public.stellar_network_links,
  public.stellar_alliance_missions,
  public.stellar_alliance_contributions
from anon, authenticated;

grant select on table public.observatory_instrument_rules, public.stellar_neighbors to anon, authenticated;
grant select on table
  public.guardian_observatory_progress,
  public.observatory_satellites,
  public.planet_colonies,
  public.stellar_alliances,
  public.stellar_alliance_members,
  public.stellar_alliance_invitations,
  public.stellar_network_links,
  public.stellar_alliance_missions,
  public.stellar_alliance_contributions
to authenticated;

grant all on table
  public.observatory_instrument_rules,
  public.guardian_observatory_progress,
  public.observatory_satellites,
  public.planet_colonies,
  public.stellar_neighbors,
  public.stellar_alliances,
  public.stellar_alliance_members,
  public.stellar_alliance_invitations,
  public.stellar_network_links,
  public.stellar_alliance_missions,
  public.stellar_alliance_contributions
to service_role;
grant usage, select on sequence public.stellar_alliance_contributions_id_seq to service_role;

revoke all on function public.refresh_stellar_neighbors_for_system(uuid) from public, anon, authenticated;
revoke all on function public.refresh_stellar_neighbors_after_guardian_insert() from public, anon, authenticated;
grant execute on function public.refresh_stellar_neighbors_for_system(uuid) to service_role;

drop policy if exists observatory_instrument_rules_public_read on public.observatory_instrument_rules;
create policy observatory_instrument_rules_public_read on public.observatory_instrument_rules
  for select to anon, authenticated using (true);
drop policy if exists stellar_neighbors_public_read on public.stellar_neighbors;
create policy stellar_neighbors_public_read on public.stellar_neighbors
  for select to anon, authenticated using (true);

drop policy if exists guardian_observatory_progress_read_own on public.guardian_observatory_progress;
create policy guardian_observatory_progress_read_own on public.guardian_observatory_progress
  for select to authenticated using (
    exists (
      select 1 from public.guardian_systems
      where guardian_systems.id = guardian_observatory_progress.guardian_system_id
        and guardian_systems.user_id = (select auth.uid())
    )
  );
drop policy if exists observatory_satellites_read_own on public.observatory_satellites;
create policy observatory_satellites_read_own on public.observatory_satellites
  for select to authenticated using (
    exists (
      select 1 from public.guardian_systems
      where guardian_systems.id = observatory_satellites.guardian_system_id
        and guardian_systems.user_id = (select auth.uid())
    )
  );
drop policy if exists planet_colonies_read_own on public.planet_colonies;
create policy planet_colonies_read_own on public.planet_colonies
  for select to authenticated using (
    exists (
      select 1
      from public.guardian_planets
      join public.guardian_systems on guardian_systems.id = guardian_planets.guardian_system_id
      where guardian_planets.id = planet_colonies.guardian_planet_id
        and guardian_systems.user_id = (select auth.uid())
    )
  );

-- Les alliances sont découvrables, mais les écritures passent par le backend/service_role.
drop policy if exists stellar_alliances_authenticated_read on public.stellar_alliances;
create policy stellar_alliances_authenticated_read on public.stellar_alliances
  for select to authenticated using (true);
drop policy if exists stellar_alliance_members_authenticated_read on public.stellar_alliance_members;
create policy stellar_alliance_members_authenticated_read on public.stellar_alliance_members
  for select to authenticated using (true);
drop policy if exists stellar_alliance_invitations_participant_read on public.stellar_alliance_invitations;
create policy stellar_alliance_invitations_participant_read on public.stellar_alliance_invitations
  for select to authenticated using (
    invited_by = (select auth.uid())
    or exists (
      select 1 from public.guardian_systems
      where guardian_systems.id = stellar_alliance_invitations.invited_guardian_system_id
        and guardian_systems.user_id = (select auth.uid())
    )
  );
drop policy if exists stellar_network_links_authenticated_read on public.stellar_network_links;
create policy stellar_network_links_authenticated_read on public.stellar_network_links
  for select to authenticated using (true);
drop policy if exists stellar_alliance_missions_authenticated_read on public.stellar_alliance_missions;
create policy stellar_alliance_missions_authenticated_read on public.stellar_alliance_missions
  for select to authenticated using (true);
drop policy if exists stellar_alliance_contributions_authenticated_read on public.stellar_alliance_contributions;
create policy stellar_alliance_contributions_authenticated_read on public.stellar_alliance_contributions
  for select to authenticated using (true);
