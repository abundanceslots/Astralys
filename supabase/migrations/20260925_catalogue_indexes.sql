-- Astralys : index pour les listes de l'app (Explore, Store, système d'une étoile).
-- Sans risque : ne modifie aucune donnée, peut être relancé (IF NOT EXISTS).

-- Recherche par nom (« ilike '%texte%' ») : index trigramme.
create extension if not exists pg_trgm with schema extensions;
create index if not exists celestial_objects_scientific_name_trgm_idx
  on public.celestial_objects using gin (scientific_name extensions.gin_trgm_ops);

-- Tris d'Explore (plus proches, plus brillantes) limités aux étoiles.
create index if not exists celestial_objects_star_distance_idx
  on public.celestial_objects (distance_ly, id) where object_type = 'star';
create index if not exists celestial_objects_star_magnitude_idx
  on public.celestial_objects (apparent_magnitude, id) where object_type = 'star';

-- Planètes d'une étoile (écran du système).
create index if not exists celestial_objects_planet_host_idx
  on public.celestial_objects (host_object_id) where object_type = 'planet';

-- Recherche par identifiant Gaia.
create index if not exists celestial_objects_source_id_idx
  on public.celestial_objects (source_id);

-- Store et filtres « vraies planètes » : jointure et filtre sur le nombre de planètes confirmées.
create index if not exists planetary_systems_confirmed_count_idx
  on public.planetary_systems (confirmed_planet_count, star_id);

analyze public.celestial_objects;
analyze public.planetary_systems;
