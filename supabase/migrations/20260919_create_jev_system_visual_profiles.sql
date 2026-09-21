-- Astralys — file de décision Jev pour les profils visuels des systèmes.
-- Une ligne par système réel. Jev choisit uniquement une direction artistique ;
-- les faits astronomiques restent dans celestial_objects/planetary_systems.

create table if not exists public.system_visual_profiles (
  system_id uuid primary key references public.planetary_systems (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed', 'stale')),
  system_architecture text
    check (system_architecture in ('catalogue_layout', 'compact_rocky', 'balanced_mixed', 'wide_gas_giants', 'cold_sparse')),
  planet_visual_style text
    check (planet_visual_style in ('catalogue_based', 'rocky_mineral', 'ocean_cloud', 'frozen_ice', 'gas_banded', 'volcanic_dark')),
  rendering_focus text
    check (rendering_focus in ('system_overview', 'planet_focus', 'star_focus', 'relay_network')),
  visual_mood text
    check (visual_mood in ('deep_violet', 'cold_cyan', 'solar_gold', 'dust_red', 'neutral_observatory')),
  confidence jsonb not null default '{}'::jsonb,
  probabilities jsonb not null default '{}'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  source_fingerprint text not null,
  visual_seed integer not null check (visual_seed between 0 and 2147483647),
  model_name text,
  model_version text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  claimed_at timestamptz,
  classified_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'complete'
    or (
      system_architecture is not null
      and planet_visual_style is not null
      and rendering_focus is not null
      and visual_mood is not null
      and classified_at is not null
    )
  )
);

create index if not exists system_visual_profiles_queue_idx
  on public.system_visual_profiles (status, next_attempt_at, created_at);

create or replace function public.system_visual_source_fingerprint(p_system_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select md5(concat_ws('|',
    systems.id::text,
    systems.data_status,
    systems.confirmed_planet_count::text,
    coalesce(stars.source_catalog, ''),
    coalesce(stars.source_id, ''),
    coalesce(stars.scientific_name, ''),
    coalesce(stars.common_name, ''),
    coalesce(stars.distance_ly::text, ''),
    coalesce(stars.apparent_magnitude::text, ''),
    coalesce(stars.temperature_k::text, ''),
    coalesce(string_agg(concat_ws(':',
      links.orbit_order::text,
      links.discovery_status,
      planets.id::text,
      coalesce(planets.radius_earth::text, ''),
      coalesce(planets.mass_earth::text, ''),
      coalesce(planets.equilibrium_temperature_k::text, '')
    ), ',' order by links.orbit_order nulls last, planets.id), '')
  ))
  from public.planetary_systems as systems
  join public.celestial_objects as stars on stars.id = systems.star_id
  left join public.planetary_system_planets as links on links.system_id = systems.id
  left join public.celestial_objects as planets on planets.id = links.planet_id
  where systems.id = p_system_id
  group by systems.id, systems.data_status, systems.confirmed_planet_count,
    stars.source_catalog, stars.source_id, stars.scientific_name, stars.common_name,
    stars.distance_ly, stars.apparent_magnitude, stars.temperature_k;
$$;

create or replace function public.queue_system_visual_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fingerprint text;
begin
  fingerprint := public.system_visual_source_fingerprint(new.id);

  insert into public.system_visual_profiles (system_id, source_fingerprint, visual_seed)
  values (
    new.id,
    fingerprint,
    abs(hashtextextended(new.id::text, 7429) % 2147483647)::integer
  )
  on conflict (system_id) do update
    set status = case
        when system_visual_profiles.source_fingerprint is distinct from excluded.source_fingerprint then 'stale'
        else system_visual_profiles.status
      end,
      source_fingerprint = excluded.source_fingerprint,
      next_attempt_at = case
        when system_visual_profiles.source_fingerprint is distinct from excluded.source_fingerprint then now()
        else system_visual_profiles.next_attempt_at
      end,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists queue_visual_profile_after_system_change on public.planetary_systems;
create trigger queue_visual_profile_after_system_change
  after insert or update of data_status, confirmed_planet_count, source_updated_at
  on public.planetary_systems
  for each row execute function public.queue_system_visual_profile();

-- Remplit la file pour les systèmes déjà importés (environ 10 000).
insert into public.system_visual_profiles (system_id, source_fingerprint, visual_seed)
select
  systems.id,
  public.system_visual_source_fingerprint(systems.id),
  abs(hashtextextended(systems.id::text, 7429) % 2147483647)::integer
from public.planetary_systems as systems
on conflict (system_id) do nothing;

-- Réserve atomiquement un petit lot. FOR UPDATE SKIP LOCKED permet plusieurs workers.
create or replace function public.claim_system_visual_profile_batch(p_limit integer default 20)
returns table (
  system_id uuid,
  visual_seed integer,
  source_fingerprint text,
  source_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select profiles.system_id
    from public.system_visual_profiles as profiles
    where (
        profiles.status in ('pending', 'stale', 'failed')
        or (profiles.status = 'processing' and profiles.claimed_at < now() - interval '10 minutes')
      )
      and profiles.next_attempt_at <= now()
      and profiles.attempt_count < 5
    order by profiles.next_attempt_at, profiles.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 25))
  ), claimed as (
    update public.system_visual_profiles as profiles
    set status = 'processing',
        claimed_at = now(),
        attempt_count = profiles.attempt_count + 1,
        last_error = null,
        updated_at = now()
    from candidates
    where profiles.system_id = candidates.system_id
    returning profiles.system_id, profiles.visual_seed, profiles.source_fingerprint
  )
  select
    claimed.system_id,
    claimed.visual_seed,
    claimed.source_fingerprint,
    jsonb_build_object(
      'systemId', systems.id,
      'dataStatus', systems.data_status,
      'confirmedPlanetCount', systems.confirmed_planet_count,
      'star', jsonb_build_object(
        'sourceCatalog', stars.source_catalog,
        'sourceId', stars.source_id,
        'scientificName', stars.scientific_name,
        'commonName', stars.common_name,
        'distanceLy', stars.distance_ly,
        'apparentMagnitude', stars.apparent_magnitude,
        'temperatureK', stars.temperature_k,
        'radiusSolar', stars.radius_solar,
        'massSolar', stars.mass_solar
      ),
      'confirmedPlanets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', planets.id,
          'orbitOrder', links.orbit_order,
          'discoveryStatus', links.discovery_status,
          'scientificName', planets.scientific_name,
          'radiusEarth', planets.radius_earth,
          'massEarth', planets.mass_earth,
          'equilibriumTemperatureK', planets.equilibrium_temperature_k
        ) order by links.orbit_order nulls last, planets.id)
        from public.planetary_system_planets as links
        join public.celestial_objects as planets on planets.id = links.planet_id
        where links.system_id = systems.id
      ), '[]'::jsonb),
      'rule', 'Choose only a visual preset. Never add or modify astronomical facts.'
    )
  from claimed
  join public.planetary_systems as systems on systems.id = claimed.system_id
  join public.celestial_objects as stars on stars.id = systems.star_id;
end;
$$;

alter table public.system_visual_profiles enable row level security;

revoke all on table public.system_visual_profiles from anon, authenticated;
grant select on table public.system_visual_profiles to anon, authenticated;
grant all on table public.system_visual_profiles to service_role;

drop policy if exists system_visual_profiles_completed_read on public.system_visual_profiles;
create policy system_visual_profiles_completed_read on public.system_visual_profiles
  for select to anon, authenticated using (status = 'complete');

revoke all on function public.system_visual_source_fingerprint(uuid) from public, anon, authenticated;
revoke all on function public.queue_system_visual_profile() from public, anon, authenticated;
revoke all on function public.claim_system_visual_profile_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_system_visual_profile_batch(integer) to service_role;
