import type { StarDetail } from '@/components/star-detail-modal';
import { findLocalStarSourceIds } from '@/utils/celestial-display-name';
import { getSkyRegionOption, sortOptions, type SkyRegion, type StarSort } from '@/features/catalogue-filters';
import { supabase } from '@/lib/supabase';

/**
 * Requêtes du catalogue d'étoiles, partagées par la liste Explore
 * et les collections de la page d'accueil Explore.
 */

export type StarColor = 'all' | 'blue' | 'blue-white' | 'white-yellow' | 'golden' | 'orange-red';
export type StarCategory = 'all' | 'nearby-confirmed' | 'confirmed' | 'nearby' | 'imagined-distant' | 'bright';

export const categoryOptions: readonly { value: StarCategory; label: string; tab: string; description: string }[] = [
  { value: 'nearby-confirmed', label: 'Nearby real worlds', tab: 'Nearby worlds', description: '≤ 100 ly with real planets' },
  { value: 'confirmed', label: 'Confirmed systems', tab: 'Real planets', description: 'NASA-confirmed planets' },
  { value: 'nearby', label: 'Close to Earth', tab: 'Nearby', description: '≤ 100 ly' },
  { value: 'bright', label: 'Bright beacons', tab: 'Bright', description: 'Visible to the naked eye' },
  { value: 'imagined-distant', label: 'Distant frontiers', tab: 'Imagined', description: '≥ 250 ly · imagined worlds' },
  { value: 'all', label: 'All stars', tab: 'All', description: 'Every star' },
] as const;

export function getCategoryOption(category: StarCategory) {
  return categoryOptions.find(option => option.value === category) ?? categoryOptions[categoryOptions.length - 1];
}

type PlanetarySystemSummary = { confirmed_planet_count: number; data_status: string };
type CatalogueRow = StarDetail & { planetary_systems?: PlanetarySystemSummary | PlanetarySystemSummary[] | null };

export type StarQuery = {
  from?: number;
  limit: number;
  search?: string;
  region?: SkyRegion;
  color?: StarColor;
  sort?: StarSort;
  category?: StarCategory;
  /** Compte exact du total (plus lent) : seulement pour la liste. */
  withCount?: boolean;
};

export async function fetchStars({
  from = 0,
  limit,
  search = '',
  region = 'all',
  color = 'all',
  sort = 'nearest',
  category = 'all',
  withCount = false,
}: StarQuery): Promise<{ stars: StarDetail[]; total: number | null; error: boolean }> {
  const sortOption = sortOptions.find(option => option.value === sort) ?? sortOptions[0];

  let request = supabase
    .from('celestial_objects')
    .select(
      'id, object_type, source_catalog, source_id, scientific_name, common_name, ra_deg, dec_deg, distance_ly, apparent_magnitude, visual_category, temperature_k, radius_solar, mass_solar, radius_earth, mass_earth, equilibrium_temperature_k, is_purchasable, planetary_systems!inner(confirmed_planet_count,data_status)',
      withCount ? { count: 'exact' } : undefined,
    )
    .eq('object_type', 'star')
    .order(sortOption.column, { ascending: sortOption.ascending, nullsFirst: false })
    .order('id', { ascending: true });

  if (search) {
    const localMatches = findLocalStarSourceIds(search);
    request = localMatches.length > 0
      ? request.in('source_id', localMatches)
      : (/^\d+$/.test(search) ? request.eq('source_id', search) : request.ilike('scientific_name', `%${search}%`));
  }

  const regionOption = getSkyRegionOption(region);
  if (regionOption.minimumDeclination !== undefined) request = request.gte('dec_deg', regionOption.minimumDeclination);
  if (regionOption.maximumDeclination !== undefined) request = request.lt('dec_deg', regionOption.maximumDeclination);

  if (color !== 'all') request = request.eq('visual_category', color);

  if (category === 'nearby-confirmed') request = request.lte('distance_ly', 100).gt('planetary_systems.confirmed_planet_count', 0);
  else if (category === 'confirmed') request = request.gt('planetary_systems.confirmed_planet_count', 0);
  else if (category === 'nearby') request = request.lte('distance_ly', 100);
  else if (category === 'imagined-distant') request = request.gte('distance_ly', 250).eq('planetary_systems.confirmed_planet_count', 0);
  else if (category === 'bright') request = request.lte('apparent_magnitude', 6);

  const { data, error, count } = await request.range(from, from + limit - 1);
  if (error) return { stars: [], total: null, error: true };

  const stars = ((data ?? []) as CatalogueRow[]).map(item => {
    const system = Array.isArray(item.planetary_systems) ? item.planetary_systems[0] : item.planetary_systems;
    const { planetary_systems: _omit, ...star } = item;
    return {
      ...star,
      confirmed_planet_count: system?.confirmed_planet_count ?? 0,
      system_experience: category === 'imagined-distant' ? 'imagined' as const : 'catalogue' as const,
    };
  });
  return { stars, total: count ?? null, error: false };
}

export function imaginedWorldCount(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = Math.imul(hash ^ id.charCodeAt(index), 31);
  return 2 + (Math.abs(hash) % 4);
}

export function formatDistance(distance: number | null, short = false) {
  if (distance === null) return short ? '— ly' : 'Unknown distance';
  const value = distance < 10 ? distance.toFixed(1) : Math.round(distance).toLocaleString('en-US');
  return short ? `${value} ly` : `${value} light-years`;
}

/** Étiquette courte affichée sur chaque étoile. */
export function systemLabel(star: StarDetail) {
  if (star.system_experience === 'imagined') return `${imaginedWorldCount(star.id)} IMAGINED`;
  const planets = star.confirmed_planet_count ?? 0;
  if (planets > 0) return `${planets} ${planets === 1 ? 'PLANET' : 'PLANETS'}`;
  if (star.apparent_magnitude !== null && star.apparent_magnitude <= 6) return `MAG ${star.apparent_magnitude.toFixed(1)}`;
  return 'CATALOGUED';
}
