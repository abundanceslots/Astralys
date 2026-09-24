/** Étoiles mises en avant dans la boutique, par rareté (requêtes Supabase). */
import type { StarDetail } from '@/components/star-detail-modal';
import { starTier, type StarTier } from '@/features/store-catalog';
import { supabase } from '@/lib/supabase';

const FIELDS = 'id, object_type, source_catalog, source_id, scientific_name, common_name, ra_deg, dec_deg, distance_ly, apparent_magnitude, visual_category, temperature_k, radius_solar, mass_solar, radius_earth, mass_earth, equilibrium_temperature_k, is_purchasable, planetary_systems!inner(confirmed_planet_count)';

type Row = StarDetail & { planetary_systems?: { confirmed_planet_count: number } | { confirmed_planet_count: number }[] | null };

export async function fetchStoreStars(tier: StarTier, limit = 8): Promise<StarDetail[]> {
  let request = supabase.from('celestial_objects').select(FIELDS).eq('object_type', 'star').neq('is_purchasable', false);
  // Palier = nombre de vraies planètes. Les systèmes les plus riches d'abord, puis les plus proches.
  if (tier === 'real4') request = request.gte('planetary_systems.confirmed_planet_count', 4).order('distance_ly', { ascending: true });
  else if (tier === 'real2') request = request.gte('planetary_systems.confirmed_planet_count', 2).lte('planetary_systems.confirmed_planet_count', 3).order('distance_ly', { ascending: true });
  else if (tier === 'real1') request = request.eq('planetary_systems.confirmed_planet_count', 1).order('distance_ly', { ascending: true });
  else request = request.eq('planetary_systems.confirmed_planet_count', 0).order('apparent_magnitude', { ascending: true });
  const { data, error } = await request.limit(limit * 2);
  if (error) throw error;
  return ((data ?? []) as Row[])
    .map(item => {
      const system = Array.isArray(item.planetary_systems) ? item.planetary_systems[0] : item.planetary_systems;
      const { planetary_systems: _omit, ...star } = item;
      return { ...star, confirmed_planet_count: system?.confirmed_planet_count ?? 0, system_experience: 'catalogue' as const };
    })
    .filter(star => starTier(star) === tier)
    .slice(0, limit);
}

/** Nombre de planètes confirmées d'une étoile (pour la rareté quand l'écran appelant ne l'a pas). */
export async function fetchPlanetCount(starId: string): Promise<number> {
  const { data } = await supabase.from('planetary_systems').select('confirmed_planet_count').eq('star_id', starId).maybeSingle();
  return (data as { confirmed_planet_count: number } | null)?.confirmed_planet_count ?? 0;
}
