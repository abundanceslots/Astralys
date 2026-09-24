-- Astralys : sauvegarde cloud de la progression du système (économie v2).
--
-- La progression est calculée sur le téléphone ; ce fichier la conserve dans le compte
-- pour qu'elle survive à une réinstallation ou à un changement d'appareil.
-- Les joueurs n'écrivent jamais directement dans les tables : tout passe par
-- save_guardian_progress(), qui valide l'état et gère les conflits entre appareils.
-- L'énergie et le niveau du relais sont aussi recopiés dans guardian_systems
-- (énergie, base_level) pour chaque étoile acquise par le joueur.

create table if not exists public.guardian_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  economy_version integer not null default 2,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.guardian_progress enable row level security;

revoke all on table public.guardian_progress from anon, authenticated;
grant select on table public.guardian_progress to authenticated;
grant all on table public.guardian_progress to service_role;

drop policy if exists guardian_progress_read_own on public.guardian_progress;
create policy guardian_progress_read_own on public.guardian_progress
  for select to authenticated using ((select auth.uid()) = user_id);

-- Enregistre la progression avec un contrôle de révision (verrou optimiste) :
-- si un autre appareil a sauvegardé entre-temps, rien n'est écrit et la version
-- du serveur est renvoyée (is_conflict = true) pour que l'app fusionne les deux.
create or replace function public.save_guardian_progress(p_state jsonb, p_base_revision bigint)
returns table (
  saved_revision bigint,
  saved_state jsonb,
  is_conflict boolean,
  saved_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_row public.guardian_progress%rowtype;
  relay_level integer;
  energy_value bigint;
  max_base_level integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Invalid progress';
  end if;
  if pg_column_size(p_state) > 32768 then
    raise exception 'Progress is too large';
  end if;
  if coalesce(jsonb_typeof(p_state -> 'energy'), '') <> 'number'
     or coalesce(jsonb_typeof(p_state -> 'relayLevel'), '') <> 'number'
     or coalesce(jsonb_typeof(p_state -> 'connected'), '') <> 'array' then
    raise exception 'Invalid progress';
  end if;

  energy_value := floor((p_state ->> 'energy')::numeric)::bigint;
  relay_level := floor((p_state ->> 'relayLevel')::numeric)::integer;
  if energy_value < 0 or relay_level < 1 or relay_level > 8 or jsonb_array_length(p_state -> 'connected') > 7 then
    raise exception 'Invalid progress';
  end if;

  select * into current_row
  from public.guardian_progress
  where user_id = current_user_id
  for update;

  if found and current_row.revision <> coalesce(p_base_revision, 0) then
    return query select current_row.revision, current_row.state, true, current_row.updated_at;
    return;
  end if;

  insert into public.guardian_progress as progress (user_id, state, economy_version, revision, updated_at)
  values (
    current_user_id,
    p_state,
    coalesce(nullif(p_state ->> 'economyVersion', '')::integer, 2),
    1,
    now()
  )
  on conflict (user_id) do update set
    state = excluded.state,
    economy_version = excluded.economy_version,
    revision = progress.revision + 1,
    updated_at = now()
  returning * into current_row;

  -- Miroir dans les systèmes acquis : énergie et niveau (le relais du jeu = niveau de base).
  select max(level) into max_base_level from public.base_level_rules;
  update public.guardian_systems as systems
  set
    energy = energy_value,
    base_level = least(relay_level, coalesce(max_base_level, 1)),
    last_collected_at = now()
  where systems.user_id = current_user_id
    and (systems.energy is distinct from energy_value
      or systems.base_level is distinct from least(relay_level, coalesce(max_base_level, 1)));

  return query select current_row.revision, current_row.state, false, current_row.updated_at;
end;
$$;

revoke all on function public.save_guardian_progress(jsonb, bigint) from public;
grant execute on function public.save_guardian_progress(jsonb, bigint) to authenticated;
