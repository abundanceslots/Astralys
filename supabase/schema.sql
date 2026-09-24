-- Schéma public Astralys, exporté le 2026-09-24

create table if not exists public.adoptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  celestial_object_id uuid not null,
  order_id uuid,
  personal_name text not null,
  dedication text,
  recipient_name text,
  status text default 'pending'::text not null,
  certificate_storage_path text,
  adopted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint adoptions_active_requires_order CHECK (((status <> 'active'::text) OR (order_id IS NOT NULL))),
  constraint adoptions_dedication_length CHECK (((dedication IS NULL) OR (char_length(dedication) <= 500))),
  constraint adoptions_personal_name_length CHECK (((char_length(TRIM(BOTH FROM personal_name)) >= 1) AND (char_length(TRIM(BOTH FROM personal_name)) <= 80))),
  constraint adoptions_recipient_name_length CHECK (((recipient_name IS NULL) OR ((char_length(TRIM(BOTH FROM recipient_name)) >= 1) AND (char_length(TRIM(BOTH FROM recipient_name)) <= 80)))),
  constraint adoptions_status CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'revoked'::text, 'refunded'::text]))),
  constraint adoptions_pkey PRIMARY KEY (id),
  constraint adoptions_order_unique UNIQUE (order_id)
);

create table if not exists public.base_level_rules (
  level integer not null,
  satellite_slots integer not null,
  storage_capacity bigint not null,
  offline_cap_hours integer not null,
  base_energy_per_hour integer default 0 not null,
  base_data_per_hour integer default 0 not null,
  base_materials_per_hour integer default 0 not null,
  upgrade_energy_cost bigint default 0 not null,
  upgrade_data_cost bigint default 0 not null,
  upgrade_materials_cost bigint default 0 not null,
  upgrade_seconds integer default 0 not null,
  constraint base_level_rules_level_check CHECK (((level >= 1) AND (level <= 10))),
  constraint base_level_rules_offline_cap_hours_check CHECK (((offline_cap_hours >= 1) AND (offline_cap_hours <= 168))),
  constraint base_level_rules_satellite_slots_check CHECK ((satellite_slots > 0)),
  constraint base_level_rules_storage_capacity_check CHECK ((storage_capacity > 0)),
  constraint base_level_rules_pkey PRIMARY KEY (level)
);

create table if not exists public.celestial_objects (
  id uuid default gen_random_uuid() not null,
  object_type text not null,
  source_catalog text not null,
  source_id text not null,
  scientific_name text not null,
  common_name text,
  host_object_id uuid,
  host_name text,
  ra_deg double precision,
  dec_deg double precision,
  distance_ly numeric,
  constellation text,
  apparent_magnitude real,
  temperature_k integer,
  radius_solar numeric,
  mass_solar numeric,
  radius_earth numeric,
  mass_earth numeric,
  orbital_period_days numeric,
  equilibrium_temperature_k integer,
  visual_seed bigint default 0 not null,
  visual_category text,
  is_purchasable boolean default true not null,
  raw_data jsonb default '{}'::jsonb not null,
  source_updated_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  discovery_year smallint,
  discovery_date date,
  discovery_method text,
  discovery_reference text,
  catalog_release_date date,
  constraint celestial_objects_dec_range CHECK (((dec_deg IS NULL) OR ((dec_deg >= ('-90'::integer)::double precision) AND (dec_deg <= (90)::double precision)))),
  constraint celestial_objects_distance_positive CHECK (((distance_ly IS NULL) OR (distance_ly > (0)::numeric))),
  constraint celestial_objects_equilibrium_temperature_positive CHECK (((equilibrium_temperature_k IS NULL) OR (equilibrium_temperature_k > 0))),
  constraint celestial_objects_mass_earth_positive CHECK (((mass_earth IS NULL) OR (mass_earth > (0)::numeric))),
  constraint celestial_objects_mass_solar_positive CHECK (((mass_solar IS NULL) OR (mass_solar > (0)::numeric))),
  constraint celestial_objects_name_not_empty CHECK ((char_length(TRIM(BOTH FROM scientific_name)) > 0)),
  constraint celestial_objects_orbital_period_positive CHECK (((orbital_period_days IS NULL) OR (orbital_period_days > (0)::numeric))),
  constraint celestial_objects_ra_range CHECK (((ra_deg IS NULL) OR ((ra_deg >= (0)::double precision) AND (ra_deg < (360)::double precision)))),
  constraint celestial_objects_radius_earth_positive CHECK (((radius_earth IS NULL) OR (radius_earth > (0)::numeric))),
  constraint celestial_objects_radius_solar_positive CHECK (((radius_solar IS NULL) OR (radius_solar > (0)::numeric))),
  constraint celestial_objects_source_catalog_not_empty CHECK ((char_length(TRIM(BOTH FROM source_catalog)) > 0)),
  constraint celestial_objects_source_id_not_empty CHECK ((char_length(TRIM(BOTH FROM source_id)) > 0)),
  constraint celestial_objects_temperature_positive CHECK (((temperature_k IS NULL) OR (temperature_k > 0))),
  constraint celestial_objects_type CHECK ((object_type = ANY (ARRAY['star'::text, 'planet'::text]))),
  constraint celestial_objects_pkey PRIMARY KEY (id),
  constraint celestial_objects_source_unique UNIQUE (source_catalog, source_id)
);

create table if not exists public.favorites (
  user_id uuid not null,
  celestial_object_id uuid not null,
  created_at timestamp with time zone default now() not null,
  constraint favorites_pkey PRIMARY KEY (user_id, celestial_object_id)
);

create table if not exists public.guardian_observatory_progress (
  guardian_system_id uuid not null,
  knowledge integer default 0 not null,
  exploration integer default 0 not null,
  connection integer default 0 not null,
  observation_count integer default 0 not null,
  last_observation_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint guardian_observatory_progress_connection_check CHECK ((connection >= 0)),
  constraint guardian_observatory_progress_exploration_check CHECK ((exploration >= 0)),
  constraint guardian_observatory_progress_knowledge_check CHECK ((knowledge >= 0)),
  constraint guardian_observatory_progress_observation_count_check CHECK ((observation_count >= 0)),
  constraint guardian_observatory_progress_pkey PRIMARY KEY (guardian_system_id)
);

create table if not exists public.guardian_planets (
  id uuid default gen_random_uuid() not null,
  guardian_system_id uuid not null,
  system_planet_id uuid not null,
  status text default 'locked'::text not null,
  exploration_started_at timestamp with time zone,
  exploration_completes_at timestamp with time zone,
  unlocked_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint guardian_planets_status_check CHECK ((status = ANY (ARRAY['locked'::text, 'exploring'::text, 'unlocked'::text]))),
  constraint guardian_planets_pkey PRIMARY KEY (id),
  constraint guardian_planets_guardian_system_id_system_planet_id_key UNIQUE (guardian_system_id, system_planet_id)
);

create table if not exists public.guardian_progress (
  user_id uuid not null,
  state jsonb not null,
  economy_version integer default 2 not null,
  revision bigint default 1 not null,
  updated_at timestamp with time zone default now() not null,
  constraint guardian_progress_revision_check CHECK ((revision > 0)),
  constraint guardian_progress_state_check CHECK ((jsonb_typeof(state) = 'object'::text)),
  constraint guardian_progress_pkey PRIMARY KEY (user_id)
);

create table if not exists public.guardian_resource_ledger (
  id bigint generated ALWAYS as identity not null,
  user_id uuid not null,
  guardian_system_id uuid not null,
  source text not null,
  energy_delta bigint default 0 not null,
  data_delta bigint default 0 not null,
  materials_delta bigint default 0 not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint guardian_resource_ledger_pkey PRIMARY KEY (id)
);

create table if not exists public.guardian_satellites (
  id uuid default gen_random_uuid() not null,
  guardian_system_id uuid not null,
  guardian_planet_id uuid,
  satellite_type text not null,
  level integer default 1 not null,
  status text default 'building'::text not null,
  construction_started_at timestamp with time zone default now() not null,
  completes_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint guardian_satellites_status_check CHECK ((status = ANY (ARRAY['building'::text, 'active'::text, 'upgrading'::text]))),
  constraint guardian_satellites_pkey PRIMARY KEY (id)
);

create table if not exists public.guardian_systems (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  system_id uuid not null,
  acquisition_source text default 'reward'::text not null,
  base_level integer default 1 not null,
  base_status text default 'active'::text not null,
  base_upgrade_completes_at timestamp with time zone,
  energy bigint default 350 not null,
  research_data bigint default 100 not null,
  materials bigint default 0 not null,
  last_collected_at timestamp with time zone default now() not null,
  acquired_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint guardian_systems_acquisition_source_check CHECK ((acquisition_source = ANY (ARRAY['starter'::text, 'pack'::text, 'reward'::text, 'gift'::text, 'purchase'::text]))),
  constraint guardian_systems_base_status_check CHECK ((base_status = ANY (ARRAY['active'::text, 'upgrading'::text]))),
  constraint guardian_systems_energy_check CHECK ((energy >= 0)),
  constraint guardian_systems_materials_check CHECK ((materials >= 0)),
  constraint guardian_systems_research_data_check CHECK ((research_data >= 0)),
  constraint guardian_systems_pkey PRIMARY KEY (id),
  constraint guardian_systems_user_id_system_id_key UNIQUE (user_id, system_id)
);

create table if not exists public.interstellar_connection_rules (
  level integer not null,
  required_base_level integer not null,
  required_network_power integer not null,
  energy_cost bigint not null,
  data_cost bigint not null,
  materials_cost bigint not null,
  build_seconds integer not null,
  constraint interstellar_connection_rules_level_check CHECK (((level >= 1) AND (level <= 3))),
  constraint interstellar_connection_rules_required_base_level_check CHECK (((required_base_level >= 1) AND (required_base_level <= 10))),
  constraint interstellar_connection_rules_required_network_power_check CHECK ((required_network_power > 0)),
  constraint interstellar_connection_rules_pkey PRIMARY KEY (level)
);

create table if not exists public.interstellar_connections (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  from_guardian_system_id uuid not null,
  to_guardian_system_id uuid not null,
  level integer default 1 not null,
  status text default 'building'::text not null,
  construction_started_at timestamp with time zone default now() not null,
  completes_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint interstellar_connections_check CHECK ((from_guardian_system_id <> to_guardian_system_id)),
  constraint interstellar_connections_status_check CHECK ((status = ANY (ARRAY['building'::text, 'active'::text, 'upgrading'::text]))),
  constraint interstellar_connections_pkey PRIMARY KEY (id),
  constraint interstellar_connections_user_id_from_guardian_system_id_to_key UNIQUE (user_id, from_guardian_system_id, to_guardian_system_id)
);

create table if not exists public.observatory_instrument_rules (
  instrument_type text not null,
  display_name text not null,
  description text not null,
  required_knowledge integer default 0 not null,
  required_exploration integer default 0 not null,
  required_connection integer default 0 not null,
  mission_seconds integer default 0 not null,
  reward_knowledge integer default 0 not null,
  reward_exploration integer default 0 not null,
  reward_connection integer default 0 not null,
  sort_order integer not null,
  constraint observatory_instrument_rules_instrument_type_check CHECK ((instrument_type = ANY (ARRAY['observation'::text, 'probe'::text, 'relay'::text, 'station'::text, 'telescope'::text]))),
  constraint observatory_instrument_rules_pkey PRIMARY KEY (instrument_type)
);

create table if not exists public.observatory_satellites (
  id uuid default gen_random_uuid() not null,
  guardian_system_id uuid not null,
  guardian_planet_id uuid,
  instrument_type text not null,
  level integer default 1 not null,
  status text default 'planned'::text not null,
  mission_started_at timestamp with time zone,
  mission_completes_at timestamp with time zone,
  telemetry jsonb default '{}'::jsonb not null,
  deployed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint observatory_satellites_level_check CHECK (((level >= 1) AND (level <= 5))),
  constraint observatory_satellites_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'deploying'::text, 'active'::text, 'mission'::text]))),
  constraint observatory_satellites_pkey PRIMARY KEY (id)
);

create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  status text default 'pending'::text not null,
  payment_provider text not null,
  provider_transaction_id text,
  amount_cents integer not null,
  currency text default 'EUR'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint orders_amount_non_negative CHECK ((amount_cents >= 0)),
  constraint orders_currency_iso CHECK (((char_length(currency) = 3) AND (currency = upper(currency)))),
  constraint orders_payment_provider CHECK ((payment_provider = ANY (ARRAY['apple_app_store'::text, 'google_play'::text, 'stripe'::text, 'manual'::text]))),
  constraint orders_status CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text]))),
  constraint orders_pkey PRIMARY KEY (id),
  constraint orders_id_user_unique UNIQUE (id, user_id),
  constraint orders_provider_transaction_unique UNIQUE (provider_transaction_id)
);

create table if not exists public.planet_colonies (
  id uuid default gen_random_uuid() not null,
  guardian_planet_id uuid not null,
  stage text default 'survey'::text not null,
  progress integer default 0 not null,
  is_simulation boolean default true not null,
  scientific_constraints jsonb default '{}'::jsonb not null,
  visual_configuration jsonb default '{}'::jsonb not null,
  started_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  constraint planet_colonies_is_simulation_check CHECK ((is_simulation = true)),
  constraint planet_colonies_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
  constraint planet_colonies_stage_check CHECK ((stage = ANY (ARRAY['survey'::text, 'orbital_relay'::text, 'science_station'::text, 'simulated_colony'::text]))),
  constraint planet_colonies_pkey PRIMARY KEY (id),
  constraint planet_colonies_guardian_planet_id_key UNIQUE (guardian_planet_id)
);

create table if not exists public.planet_unlock_rules (
  orbit_order integer not null,
  required_base_level integer not null,
  energy_cost bigint default 0 not null,
  data_cost bigint default 0 not null,
  materials_cost bigint default 0 not null,
  exploration_seconds integer default 0 not null,
  constraint planet_unlock_rules_orbit_order_check CHECK (((orbit_order >= 1) AND (orbit_order <= 8))),
  constraint planet_unlock_rules_required_base_level_check CHECK (((required_base_level >= 1) AND (required_base_level <= 10))),
  constraint planet_unlock_rules_pkey PRIMARY KEY (orbit_order)
);

create table if not exists public.planetary_system_planets (
  id uuid default gen_random_uuid() not null,
  system_id uuid not null,
  planet_id uuid not null,
  orbit_order integer,
  discovery_status text default 'confirmed'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint planetary_system_planets_discovery_status_check CHECK ((discovery_status = ANY (ARRAY['candidate'::text, 'confirmed'::text]))),
  constraint planetary_system_planets_orbit_order_check CHECK (((orbit_order IS NULL) OR (orbit_order > 0))),
  constraint planetary_system_planets_pkey PRIMARY KEY (id),
  constraint planetary_system_planets_planet_id_key UNIQUE (planet_id),
  constraint planetary_system_planets_system_id_orbit_order_key UNIQUE (system_id, orbit_order)
);

create table if not exists public.planetary_systems (
  id uuid default gen_random_uuid() not null,
  star_id uuid not null,
  nasa_hostname text,
  confirmed_planet_count integer default 0 not null,
  data_status text default 'unknown'::text not null,
  source_name text,
  source_updated_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint planetary_systems_confirmed_planet_count_check CHECK ((confirmed_planet_count >= 0)),
  constraint planetary_systems_data_status_check CHECK ((data_status = ANY (ARRAY['unknown'::text, 'none_confirmed'::text, 'candidates'::text, 'confirmed'::text]))),
  constraint planetary_systems_pkey PRIMARY KEY (id),
  constraint planetary_systems_star_id_key UNIQUE (star_id)
);

create table if not exists public.profiles (
  id uuid not null,
  display_name text default 'Astronome'::text not null,
  avatar_url text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  email text not null,
  first_name text,
  last_name text,
  country text,
  constraint profiles_display_name_length CHECK (((display_name IS NULL) OR ((char_length(TRIM(BOTH FROM display_name)) >= 1) AND (char_length(TRIM(BOTH FROM display_name)) <= 80)))),
  constraint profiles_pkey PRIMARY KEY (id)
);

create table if not exists public.purchase_preview_accounts (
  email text not null,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint purchase_preview_accounts_email_check CHECK ((email = lower(TRIM(BOTH FROM email)))),
  constraint purchase_preview_accounts_pkey PRIMARY KEY (email)
);

create table if not exists public.satellite_level_rules (
  satellite_type text not null,
  level integer not null,
  required_base_level integer not null,
  requires_planet boolean default false not null,
  build_energy_cost bigint default 0 not null,
  build_data_cost bigint default 0 not null,
  build_materials_cost bigint default 0 not null,
  build_seconds integer default 0 not null,
  energy_per_hour integer default 0 not null,
  data_per_hour integer default 0 not null,
  materials_per_hour integer default 0 not null,
  network_power integer default 0 not null,
  constraint satellite_level_rules_level_check CHECK (((level >= 1) AND (level <= 5))),
  constraint satellite_level_rules_required_base_level_check CHECK (((required_base_level >= 1) AND (required_base_level <= 10))),
  constraint satellite_level_rules_satellite_type_check CHECK ((satellite_type = ANY (ARRAY['solar_collector'::text, 'science_probe'::text, 'extractor'::text, 'relay'::text]))),
  constraint satellite_level_rules_pkey PRIMARY KEY (satellite_type, level)
);

create table if not exists public.star_acquisitions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  star_id uuid not null,
  status text default 'completed'::text not null,
  provider text default 'preview_allowlist'::text not null,
  amount_cents integer default 0 not null,
  currency text default 'EUR'::text not null,
  acquired_at timestamp with time zone default now() not null,
  constraint star_acquisitions_amount_cents_check CHECK ((amount_cents >= 0)),
  constraint star_acquisitions_currency_check CHECK ((char_length(currency) = 3)),
  constraint star_acquisitions_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'refunded'::text, 'cancelled'::text]))),
  constraint star_acquisitions_pkey PRIMARY KEY (id),
  constraint star_acquisitions_user_id_star_id_key UNIQUE (user_id, star_id)
);

create table if not exists public.stellar_alliance_contributions (
  id bigint generated ALWAYS as identity not null,
  mission_id uuid not null,
  user_id uuid not null,
  guardian_system_id uuid not null,
  contribution_points integer not null,
  contribution_type text not null,
  created_at timestamp with time zone default now() not null,
  constraint stellar_alliance_contributions_contribution_points_check CHECK ((contribution_points > 0)),
  constraint stellar_alliance_contributions_contribution_type_check CHECK ((contribution_type = ANY (ARRAY['observation'::text, 'satellite_mission'::text, 'shared_data'::text]))),
  constraint stellar_alliance_contributions_pkey PRIMARY KEY (id)
);

create table if not exists public.stellar_alliance_invitations (
  id uuid default gen_random_uuid() not null,
  alliance_id uuid not null,
  invited_guardian_system_id uuid not null,
  invited_by uuid not null,
  status text default 'pending'::text not null,
  expires_at timestamp with time zone default (now() + '7 days'::interval) not null,
  created_at timestamp with time zone default now() not null,
  constraint stellar_alliance_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text]))),
  constraint stellar_alliance_invitations_pkey PRIMARY KEY (id),
  constraint stellar_alliance_invitations_alliance_id_invited_guardian_s_key UNIQUE (alliance_id, invited_guardian_system_id)
);

create table if not exists public.stellar_alliance_members (
  alliance_id uuid not null,
  user_id uuid not null,
  guardian_system_id uuid not null,
  role text default 'member'::text not null,
  joined_at timestamp with time zone default now() not null,
  constraint stellar_alliance_members_role_check CHECK ((role = ANY (ARRAY['founder'::text, 'member'::text]))),
  constraint stellar_alliance_members_pkey PRIMARY KEY (alliance_id, user_id),
  constraint stellar_alliance_members_alliance_id_guardian_system_id_key UNIQUE (alliance_id, guardian_system_id)
);

create table if not exists public.stellar_alliance_missions (
  id uuid default gen_random_uuid() not null,
  alliance_id uuid not null,
  mission_type text not null,
  title text not null,
  target_system_id uuid,
  target_system_planet_id uuid,
  goal_points integer not null,
  current_points integer default 0 not null,
  status text default 'planned'::text not null,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint stellar_alliance_missions_current_points_check CHECK ((current_points >= 0)),
  constraint stellar_alliance_missions_goal_points_check CHECK ((goal_points > 0)),
  constraint stellar_alliance_missions_mission_type_check CHECK ((mission_type = ANY (ARRAY['observation_campaign'::text, 'relay_calibration'::text, 'planetary_survey'::text]))),
  constraint stellar_alliance_missions_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'completed'::text, 'expired'::text]))),
  constraint stellar_alliance_missions_pkey PRIMARY KEY (id)
);

create table if not exists public.stellar_alliances (
  id uuid default gen_random_uuid() not null,
  name text not null,
  description text,
  founder_user_id uuid not null,
  anchor_system_id uuid not null,
  visibility text default 'invite_only'::text not null,
  max_members integer default 8 not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint stellar_alliances_max_members_check CHECK (((max_members >= 2) AND (max_members <= 8))),
  constraint stellar_alliances_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 3) AND (char_length(TRIM(BOTH FROM name)) <= 40))),
  constraint stellar_alliances_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text]))),
  constraint stellar_alliances_visibility_check CHECK ((visibility = ANY (ARRAY['invite_only'::text, 'open'::text]))),
  constraint stellar_alliances_pkey PRIMARY KEY (id)
);

create table if not exists public.stellar_neighbors (
  system_id uuid not null,
  neighbor_system_id uuid not null,
  neighbor_rank integer not null,
  distance_ly numeric not null,
  calculation_method text default 'three_dimensional'::text not null,
  calculated_at timestamp with time zone default now() not null,
  constraint stellar_neighbors_calculation_method_check CHECK ((calculation_method = ANY (ARRAY['three_dimensional'::text, 'angular_fallback'::text]))),
  constraint stellar_neighbors_check CHECK ((system_id <> neighbor_system_id)),
  constraint stellar_neighbors_distance_ly_check CHECK ((distance_ly >= (0)::numeric)),
  constraint stellar_neighbors_neighbor_rank_check CHECK (((neighbor_rank >= 1) AND (neighbor_rank <= 8))),
  constraint stellar_neighbors_pkey PRIMARY KEY (system_id, neighbor_system_id),
  constraint stellar_neighbors_system_id_neighbor_rank_key UNIQUE (system_id, neighbor_rank)
);

create table if not exists public.stellar_network_links (
  id uuid default gen_random_uuid() not null,
  alliance_id uuid not null,
  from_guardian_system_id uuid not null,
  to_guardian_system_id uuid not null,
  status text default 'proposed'::text not null,
  connection_strength integer default 0 not null,
  shared_observation_count integer default 0 not null,
  activated_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint stellar_network_links_check CHECK ((from_guardian_system_id <> to_guardian_system_id)),
  constraint stellar_network_links_connection_strength_check CHECK (((connection_strength >= 0) AND (connection_strength <= 100))),
  constraint stellar_network_links_shared_observation_count_check CHECK ((shared_observation_count >= 0)),
  constraint stellar_network_links_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'active'::text]))),
  constraint stellar_network_links_pkey PRIMARY KEY (id),
  constraint stellar_network_links_alliance_id_from_guardian_system_id_t_key UNIQUE (alliance_id, from_guardian_system_id, to_guardian_system_id)
);

create table if not exists public.system_visual_profiles (
  system_id uuid not null,
  status text default 'pending'::text not null,
  system_architecture text,
  planet_visual_style text,
  rendering_focus text,
  visual_mood text,
  confidence jsonb default '{}'::jsonb not null,
  probabilities jsonb default '{}'::jsonb not null,
  source_snapshot jsonb default '{}'::jsonb not null,
  source_fingerprint text not null,
  visual_seed integer not null,
  model_name text,
  model_version text,
  attempt_count integer default 0 not null,
  last_error text,
  claimed_at timestamp with time zone,
  classified_at timestamp with time zone,
  next_attempt_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint system_visual_profiles_attempt_count_check CHECK ((attempt_count >= 0)),
  constraint system_visual_profiles_check CHECK (((status <> 'complete'::text) OR ((system_architecture IS NOT NULL) AND (planet_visual_style IS NOT NULL) AND (rendering_focus IS NOT NULL) AND (visual_mood IS NOT NULL) AND (classified_at IS NOT NULL)))),
  constraint system_visual_profiles_planet_visual_style_check CHECK ((planet_visual_style = ANY (ARRAY['catalogue_based'::text, 'rocky_mineral'::text, 'ocean_cloud'::text, 'frozen_ice'::text, 'gas_banded'::text, 'volcanic_dark'::text]))),
  constraint system_visual_profiles_rendering_focus_check CHECK ((rendering_focus = ANY (ARRAY['system_overview'::text, 'planet_focus'::text, 'star_focus'::text, 'relay_network'::text]))),
  constraint system_visual_profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'complete'::text, 'failed'::text, 'stale'::text]))),
  constraint system_visual_profiles_system_architecture_check CHECK ((system_architecture = ANY (ARRAY['catalogue_layout'::text, 'compact_rocky'::text, 'balanced_mixed'::text, 'wide_gas_giants'::text, 'cold_sparse'::text]))),
  constraint system_visual_profiles_visual_mood_check CHECK ((visual_mood = ANY (ARRAY['deep_violet'::text, 'cold_cyan'::text, 'solar_gold'::text, 'dust_red'::text, 'neutral_observatory'::text]))),
  constraint system_visual_profiles_visual_seed_check CHECK (((visual_seed >= 0) AND (visual_seed <= 2147483647))),
  constraint system_visual_profiles_pkey PRIMARY KEY (system_id)
);

alter table public.adoptions enable row level security;

alter table public.adoptions add constraint adoptions_celestial_object_id_fkey FOREIGN KEY (celestial_object_id) REFERENCES celestial_objects(id) ON DELETE RESTRICT;

alter table public.adoptions add constraint adoptions_order_user_fk FOREIGN KEY (order_id, user_id) REFERENCES orders(id, user_id) ON DELETE RESTRICT;

alter table public.adoptions add constraint adoptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

alter table public.base_level_rules enable row level security;

alter table public.celestial_objects enable row level security;

alter table public.celestial_objects add constraint celestial_objects_host_object_id_fkey FOREIGN KEY (host_object_id) REFERENCES celestial_objects(id) ON DELETE SET NULL;

alter table public.favorites enable row level security;

alter table public.favorites add constraint favorites_celestial_object_id_fkey FOREIGN KEY (celestial_object_id) REFERENCES celestial_objects(id) ON DELETE CASCADE;

alter table public.favorites add constraint favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.guardian_observatory_progress enable row level security;

alter table public.guardian_observatory_progress add constraint guardian_observatory_progress_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.guardian_planets enable row level security;

alter table public.guardian_planets add constraint guardian_planets_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.guardian_planets add constraint guardian_planets_system_planet_id_fkey FOREIGN KEY (system_planet_id) REFERENCES planetary_system_planets(id) ON DELETE CASCADE;

alter table public.guardian_progress enable row level security;

alter table public.guardian_progress add constraint guardian_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.guardian_resource_ledger enable row level security;

alter table public.guardian_resource_ledger add constraint guardian_resource_ledger_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.guardian_resource_ledger add constraint guardian_resource_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.guardian_satellites enable row level security;

alter table public.guardian_satellites add constraint guardian_satellites_guardian_planet_id_fkey FOREIGN KEY (guardian_planet_id) REFERENCES guardian_planets(id) ON DELETE CASCADE;

alter table public.guardian_satellites add constraint guardian_satellites_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.guardian_satellites add constraint guardian_satellites_satellite_type_level_fkey FOREIGN KEY (satellite_type, level) REFERENCES satellite_level_rules(satellite_type, level);

alter table public.guardian_systems enable row level security;

alter table public.guardian_systems add constraint guardian_systems_base_level_fkey FOREIGN KEY (base_level) REFERENCES base_level_rules(level);

alter table public.guardian_systems add constraint guardian_systems_system_id_fkey FOREIGN KEY (system_id) REFERENCES planetary_systems(id) ON DELETE CASCADE;

alter table public.guardian_systems add constraint guardian_systems_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.interstellar_connection_rules enable row level security;

alter table public.interstellar_connections enable row level security;

alter table public.interstellar_connections add constraint interstellar_connections_from_guardian_system_id_fkey FOREIGN KEY (from_guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.interstellar_connections add constraint interstellar_connections_level_fkey FOREIGN KEY (level) REFERENCES interstellar_connection_rules(level);

alter table public.interstellar_connections add constraint interstellar_connections_to_guardian_system_id_fkey FOREIGN KEY (to_guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.interstellar_connections add constraint interstellar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.observatory_instrument_rules enable row level security;

alter table public.observatory_satellites enable row level security;

alter table public.observatory_satellites add constraint observatory_satellites_guardian_planet_id_fkey FOREIGN KEY (guardian_planet_id) REFERENCES guardian_planets(id) ON DELETE CASCADE;

alter table public.observatory_satellites add constraint observatory_satellites_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.observatory_satellites add constraint observatory_satellites_instrument_type_fkey FOREIGN KEY (instrument_type) REFERENCES observatory_instrument_rules(instrument_type);

alter table public.orders enable row level security;

alter table public.orders add constraint orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

alter table public.planet_colonies enable row level security;

alter table public.planet_colonies add constraint planet_colonies_guardian_planet_id_fkey FOREIGN KEY (guardian_planet_id) REFERENCES guardian_planets(id) ON DELETE CASCADE;

alter table public.planet_unlock_rules enable row level security;

alter table public.planetary_system_planets enable row level security;

alter table public.planetary_system_planets add constraint planetary_system_planets_planet_id_fkey FOREIGN KEY (planet_id) REFERENCES celestial_objects(id) ON DELETE CASCADE;

alter table public.planetary_system_planets add constraint planetary_system_planets_system_id_fkey FOREIGN KEY (system_id) REFERENCES planetary_systems(id) ON DELETE CASCADE;

alter table public.planetary_systems enable row level security;

alter table public.planetary_systems add constraint planetary_systems_star_id_fkey FOREIGN KEY (star_id) REFERENCES celestial_objects(id) ON DELETE CASCADE;

alter table public.profiles enable row level security;

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.purchase_preview_accounts enable row level security;

alter table public.satellite_level_rules enable row level security;

alter table public.star_acquisitions enable row level security;

alter table public.star_acquisitions add constraint star_acquisitions_star_id_fkey FOREIGN KEY (star_id) REFERENCES celestial_objects(id) ON DELETE RESTRICT;

alter table public.star_acquisitions add constraint star_acquisitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.stellar_alliance_contributions enable row level security;

alter table public.stellar_alliance_contributions add constraint stellar_alliance_contributions_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.stellar_alliance_contributions add constraint stellar_alliance_contributions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES stellar_alliance_missions(id) ON DELETE CASCADE;

alter table public.stellar_alliance_contributions add constraint stellar_alliance_contributions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.stellar_alliance_invitations enable row level security;

alter table public.stellar_alliance_invitations add constraint stellar_alliance_invitations_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES stellar_alliances(id) ON DELETE CASCADE;

alter table public.stellar_alliance_invitations add constraint stellar_alliance_invitations_invited_guardian_system_id_fkey FOREIGN KEY (invited_guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.stellar_alliance_invitations add constraint stellar_alliance_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.stellar_alliance_members enable row level security;

alter table public.stellar_alliance_members add constraint stellar_alliance_members_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES stellar_alliances(id) ON DELETE CASCADE;

alter table public.stellar_alliance_members add constraint stellar_alliance_members_guardian_system_id_fkey FOREIGN KEY (guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.stellar_alliance_members add constraint stellar_alliance_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.stellar_alliance_missions enable row level security;

alter table public.stellar_alliance_missions add constraint stellar_alliance_missions_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES stellar_alliances(id) ON DELETE CASCADE;

alter table public.stellar_alliance_missions add constraint stellar_alliance_missions_target_system_id_fkey FOREIGN KEY (target_system_id) REFERENCES planetary_systems(id) ON DELETE SET NULL;

alter table public.stellar_alliance_missions add constraint stellar_alliance_missions_target_system_planet_id_fkey FOREIGN KEY (target_system_planet_id) REFERENCES planetary_system_planets(id) ON DELETE SET NULL;

alter table public.stellar_alliances enable row level security;

alter table public.stellar_alliances add constraint stellar_alliances_anchor_system_id_fkey FOREIGN KEY (anchor_system_id) REFERENCES planetary_systems(id) ON DELETE CASCADE;

alter table public.stellar_alliances add constraint stellar_alliances_founder_user_id_fkey FOREIGN KEY (founder_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

alter table public.stellar_neighbors enable row level security;

alter table public.stellar_neighbors add constraint stellar_neighbors_neighbor_system_id_fkey FOREIGN KEY (neighbor_system_id) REFERENCES planetary_systems(id) ON DELETE CASCADE;

alter table public.stellar_neighbors add constraint stellar_neighbors_system_id_fkey FOREIGN KEY (system_id) REFERENCES planetary_systems(id) ON DELETE CASCADE;

alter table public.stellar_network_links enable row level security;

alter table public.stellar_network_links add constraint stellar_network_links_alliance_id_fkey FOREIGN KEY (alliance_id) REFERENCES stellar_alliances(id) ON DELETE CASCADE;

alter table public.stellar_network_links add constraint stellar_network_links_from_guardian_system_id_fkey FOREIGN KEY (from_guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.stellar_network_links add constraint stellar_network_links_to_guardian_system_id_fkey FOREIGN KEY (to_guardian_system_id) REFERENCES guardian_systems(id) ON DELETE CASCADE;

alter table public.system_visual_profiles enable row level security;

alter table public.system_visual_profiles add constraint system_visual_profiles_system_id_fkey FOREIGN KEY (system_id) REFERENCES planetary_systems(id) ON DELETE CASCADE;

CREATE INDEX adoptions_object_idx ON public.adoptions USING btree (celestial_object_id);

CREATE UNIQUE INDEX adoptions_one_active_per_object_idx ON public.adoptions USING btree (celestial_object_id) WHERE (status = 'active'::text);

CREATE INDEX adoptions_user_idx ON public.adoptions USING btree (user_id);

CREATE INDEX celestial_objects_common_name_lower_idx ON public.celestial_objects USING btree (lower(common_name));

CREATE INDEX celestial_objects_constellation_idx ON public.celestial_objects USING btree (constellation);

CREATE INDEX celestial_objects_coordinates_idx ON public.celestial_objects USING btree (ra_deg, dec_deg);

CREATE INDEX celestial_objects_discovery_year_idx ON public.celestial_objects USING btree (discovery_year) WHERE (discovery_year IS NOT NULL);

CREATE INDEX celestial_objects_host_idx ON public.celestial_objects USING btree (host_object_id);

CREATE INDEX celestial_objects_scientific_name_lower_idx ON public.celestial_objects USING btree (lower(scientific_name));

CREATE INDEX celestial_objects_type_idx ON public.celestial_objects USING btree (object_type);

CREATE INDEX guardian_planets_system_idx ON public.guardian_planets USING btree (guardian_system_id);

CREATE INDEX guardian_resource_ledger_user_created_idx ON public.guardian_resource_ledger USING btree (user_id, created_at DESC);

CREATE INDEX guardian_satellites_system_idx ON public.guardian_satellites USING btree (guardian_system_id);

CREATE INDEX guardian_systems_user_idx ON public.guardian_systems USING btree (user_id);

CREATE INDEX interstellar_connections_user_idx ON public.interstellar_connections USING btree (user_id);

CREATE INDEX observatory_satellites_guardian_idx ON public.observatory_satellites USING btree (guardian_system_id);

CREATE INDEX orders_user_idx ON public.orders USING btree (user_id);

CREATE INDEX planetary_system_planets_system_idx ON public.planetary_system_planets USING btree (system_id);

CREATE INDEX planetary_systems_nasa_hostname_idx ON public.planetary_systems USING btree (nasa_hostname);

CREATE INDEX star_acquisitions_user_created_idx ON public.star_acquisitions USING btree (user_id, acquired_at DESC);

CREATE INDEX stellar_alliance_contributions_mission_idx ON public.stellar_alliance_contributions USING btree (mission_id, created_at DESC);

CREATE INDEX stellar_alliance_invitations_guardian_idx ON public.stellar_alliance_invitations USING btree (invited_guardian_system_id, status);

CREATE INDEX stellar_alliance_members_guardian_idx ON public.stellar_alliance_members USING btree (guardian_system_id);

CREATE INDEX stellar_alliance_missions_alliance_idx ON public.stellar_alliance_missions USING btree (alliance_id, status);

CREATE INDEX stellar_neighbors_neighbor_idx ON public.stellar_neighbors USING btree (neighbor_system_id);

CREATE INDEX stellar_network_links_alliance_idx ON public.stellar_network_links USING btree (alliance_id);

CREATE INDEX system_visual_profiles_queue_idx ON public.system_visual_profiles USING btree (status, next_attempt_at, created_at);

CREATE OR REPLACE FUNCTION public.claim_guardian_resources(p_guardian_system_id uuid)
 RETURNS TABLE(energy_balance bigint, data_balance bigint, materials_balance bigint, gained_energy bigint, gained_data bigint, gained_materials bigint, collected_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.claim_system_visual_profile_batch(p_limit integer DEFAULT 20)
 RETURNS TABLE(system_id uuid, visual_seed integer, source_fingerprint text, source_snapshot jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.complete_preview_star_acquisition(p_star_id uuid)
 RETURNS TABLE(acquisition_id uuid, acquired_star_id uuid, completed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  delete from auth.users where id = current_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_planetary_system_for_star()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.object_type = 'star' then
    insert into public.planetary_systems (star_id, data_status)
    values (new.id, 'unknown')
    on conflict (star_id) do nothing;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_user_email_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.profiles
  set email = coalesce(new.email, ''), updated_at = now()
  where id = new.id;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.queue_system_visual_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_confirmed_planet_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_stellar_neighbors_after_guardian_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.refresh_stellar_neighbors_for_system(new.system_id);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_stellar_neighbors_for_system(p_system_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.save_guardian_progress(p_state jsonb, p_base_revision bigint)
 RETURNS TABLE(saved_revision bigint, saved_state jsonb, is_conflict boolean, saved_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_user_id uuid := (select auth.uid());
  current_row public.guardian_progress%rowtype;
  max_base_level integer;
  entry record;
  system_state jsonb;
  system_energy bigint;
  system_relay integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Invalid progress';
  end if;
  if pg_column_size(p_state) > 262144 then
    raise exception 'Progress is too large';
  end if;

  -- Chaque système (nouveau format) ou la progression unique (ancien format) doit être valide.
  for entry in
    select key, value from jsonb_each(case when jsonb_typeof(p_state -> 'systems') = 'object' then p_state -> 'systems' else jsonb_build_object('single', p_state) end)
  loop
    system_state := entry.value;
    if jsonb_typeof(system_state) <> 'object'
       or coalesce(jsonb_typeof(system_state -> 'energy'), '') <> 'number'
       or coalesce(jsonb_typeof(system_state -> 'relayLevel'), '') <> 'number'
       or coalesce(jsonb_typeof(system_state -> 'connected'), '') <> 'array' then
      raise exception 'Invalid progress';
    end if;
    system_energy := floor((system_state ->> 'energy')::numeric)::bigint;
    system_relay := floor((system_state ->> 'relayLevel')::numeric)::integer;
    if system_energy < 0 or system_relay < 1 or system_relay > 8 or jsonb_array_length(system_state -> 'connected') > 7 then
      raise exception 'Invalid progress';
    end if;
    if entry.key <> 'single' and entry.key !~ '^[0-9a-f-]{36}$' then
      raise exception 'Invalid progress';
    end if;
  end loop;

  select * into current_row
  from public.guardian_progress
  where user_id = current_user_id
  for update;

  if found and current_row.revision <> coalesce(p_base_revision, 0) then
    return query select current_row.revision, current_row.state, true, current_row.updated_at;
    return;
  end if;

  insert into public.guardian_progress as progress (user_id, state, economy_version, revision, updated_at)
  values (current_user_id, p_state, coalesce(nullif(p_state ->> 'economyVersion', '')::integer, 2), 1, now())
  on conflict (user_id) do update set
    state = excluded.state,
    economy_version = excluded.economy_version,
    revision = progress.revision + 1,
    updated_at = now()
  returning * into current_row;

  -- Miroir : chaque système possédé reçoit SES propres valeurs.
  select max(level) into max_base_level from public.base_level_rules;
  if jsonb_typeof(p_state -> 'systems') = 'object' then
    for entry in select key, value from jsonb_each(p_state -> 'systems') loop
      system_energy := floor((entry.value ->> 'energy')::numeric)::bigint;
      system_relay := least(floor((entry.value ->> 'relayLevel')::numeric)::integer, coalesce(max_base_level, 1));
      update public.guardian_systems as systems
      set energy = system_energy, base_level = system_relay, last_collected_at = now()
      from public.planetary_systems as planetary
      where systems.user_id = current_user_id
        and systems.system_id = planetary.id
        and planetary.star_id = entry.key::uuid
        and (systems.energy is distinct from system_energy or systems.base_level is distinct from system_relay);
    end loop;
  end if;

  return query select current_row.revision, current_row.state, false, current_row.updated_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_game_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_social_observatory_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.system_visual_source_fingerprint(p_system_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$
;

create policy adoptions_select_own on public.adoptions as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy base_level_rules_public_read on public.base_level_rules as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy celestial_objects_public_read on public.celestial_objects as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy favorites_delete_own on public.favorites as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy favorites_insert_own on public.favorites as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy favorites_select_own on public.favorites as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy guardian_observatory_progress_read_own on public.guardian_observatory_progress as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM guardian_systems
  WHERE ((guardian_systems.id = guardian_observatory_progress.guardian_system_id) AND (guardian_systems.user_id = ( SELECT auth.uid() AS uid))))));

create policy guardian_planets_read_own on public.guardian_planets as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM guardian_systems
  WHERE ((guardian_systems.id = guardian_planets.guardian_system_id) AND (guardian_systems.user_id = ( SELECT auth.uid() AS uid))))));

create policy guardian_progress_read_own on public.guardian_progress as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy guardian_resource_ledger_read_own on public.guardian_resource_ledger as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy guardian_satellites_read_own on public.guardian_satellites as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM guardian_systems
  WHERE ((guardian_systems.id = guardian_satellites.guardian_system_id) AND (guardian_systems.user_id = ( SELECT auth.uid() AS uid))))));

create policy guardian_systems_read_own on public.guardian_systems as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy interstellar_connection_rules_public_read on public.interstellar_connection_rules as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy interstellar_connections_read_own on public.interstellar_connections as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy observatory_instrument_rules_public_read on public.observatory_instrument_rules as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy observatory_satellites_read_own on public.observatory_satellites as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM guardian_systems
  WHERE ((guardian_systems.id = observatory_satellites.guardian_system_id) AND (guardian_systems.user_id = ( SELECT auth.uid() AS uid))))));

create policy orders_select_own on public.orders as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy planet_colonies_read_own on public.planet_colonies as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM (guardian_planets
     JOIN guardian_systems ON ((guardian_systems.id = guardian_planets.guardian_system_id)))
  WHERE ((guardian_planets.id = planet_colonies.guardian_planet_id) AND (guardian_systems.user_id = ( SELECT auth.uid() AS uid))))));

create policy planet_unlock_rules_public_read on public.planet_unlock_rules as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy planetary_system_planets_public_read on public.planetary_system_planets as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy planetary_systems_public_read on public.planetary_systems as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy profiles_select_own on public.profiles as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = id));

create policy profiles_update_own on public.profiles as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));

create policy satellite_level_rules_public_read on public.satellite_level_rules as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy star_acquisitions_read_own on public.star_acquisitions as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy stellar_alliance_contributions_authenticated_read on public.stellar_alliance_contributions as PERMISSIVE for SELECT to authenticated using (true);

create policy stellar_alliance_invitations_participant_read on public.stellar_alliance_invitations as PERMISSIVE for SELECT to authenticated using (((invited_by = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM guardian_systems
  WHERE ((guardian_systems.id = stellar_alliance_invitations.invited_guardian_system_id) AND (guardian_systems.user_id = ( SELECT auth.uid() AS uid)))))));

create policy stellar_alliance_members_authenticated_read on public.stellar_alliance_members as PERMISSIVE for SELECT to authenticated using (true);

create policy stellar_alliance_missions_authenticated_read on public.stellar_alliance_missions as PERMISSIVE for SELECT to authenticated using (true);

create policy stellar_alliances_authenticated_read on public.stellar_alliances as PERMISSIVE for SELECT to authenticated using (true);

create policy stellar_neighbors_public_read on public.stellar_neighbors as PERMISSIVE for SELECT to anon, authenticated using (true);

create policy stellar_network_links_authenticated_read on public.stellar_network_links as PERMISSIVE for SELECT to authenticated using (true);

create policy system_visual_profiles_completed_read on public.system_visual_profiles as PERMISSIVE for SELECT to anon, authenticated using ((status = 'complete'::text));
