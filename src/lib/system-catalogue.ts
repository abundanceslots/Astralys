/**
 * Charge depuis Supabase ce qui différencie le système d'une étoile :
 * son profil visuel Jev (system_visual_profiles), ses planètes confirmées (celestial_objects)
 * et leur ordre orbital (planetary_system_planets). Construit ensuite le système avec
 * src/features/system-definition.ts. Résultats gardés en mémoire pour la session.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { buildSystemDefinition, type PlanetRecord, type StarRecord, type SystemDefinition, type VisualProfileRecord } from '@/features/system-definition';

export const STAR_FIELDS = 'id, scientific_name, common_name, visual_category, visual_seed, distance_ly, apparent_magnitude, temperature_k, raw_data';
const cache = new Map<string, SystemDefinition>();
const pending = new Map<string, Promise<SystemDefinition>>();

export type SystemSourceData = { star: StarRecord | null; planets: PlanetRecord[]; profile: VisualProfileRecord | null };

export async function loadSystemSourceData(starId: string): Promise<SystemSourceData> {
  const [starResult, systemResult, planetResult] = await Promise.all([
    // La fiche complète de l'étoile (couleur Gaia, graine…) : l'objet reçu de l'écran appelant peut être partiel,
    // or le système doit être identique quel que soit l'écran d'où l'on vient.
    supabase.from('celestial_objects').select(STAR_FIELDS).eq('id', starId).maybeSingle(),
    supabase.from('planetary_systems').select('id').eq('star_id', starId).maybeSingle(),
    supabase.from('celestial_objects')
      .select('id, scientific_name, radius_earth, mass_earth, equilibrium_temperature_k, orbital_period_days')
      .eq('object_type', 'planet').eq('host_object_id', starId).limit(20),
  ]);
  if (planetResult.error) throw planetResult.error;
  const systemId = (systemResult.data as { id: string } | null)?.id ?? null;
  let profile: VisualProfileRecord | null = null;
  const orders = new Map<string, number | null>();
  if (systemId) {
    const [profileResult, linkResult] = await Promise.all([
      supabase.from('system_visual_profiles')
        .select('system_architecture, planet_visual_style, rendering_focus, visual_mood, visual_seed, confidence')
        .eq('system_id', systemId).eq('status', 'complete').maybeSingle(),
      supabase.from('planetary_system_planets').select('planet_id, orbit_order').eq('system_id', systemId),
    ]);
    // Le profil est facultatif : sans lui, le système est déduit des données de l'étoile.
    profile = (profileResult.data as VisualProfileRecord | null) ?? null;
    for (const row of (linkResult.data ?? []) as { planet_id: string; orbit_order: number | null }[]) orders.set(row.planet_id, row.orbit_order);
  }
  const planets = ((planetResult.data ?? []) as PlanetRecord[]).map(p => ({ ...p, orbit_order: orders.get(p.id) ?? null }));
  return { star: (starResult.data as StarRecord | null) ?? null, planets, profile };
}

export async function loadSystemDefinition(star: StarRecord): Promise<SystemDefinition> {
  const cached = cache.get(star.id);
  if (cached) return cached;
  const running = pending.get(star.id);
  if (running) return running;
  const request = loadSystemSourceData(star.id)
    .then(({ star: fullStar, planets, profile }) => {
      const definition = buildSystemDefinition(fullStar ? { ...star, ...fullStar } : star, planets, profile);
      cache.set(star.id, definition);
      return definition;
    })
    .finally(() => { pending.delete(star.id); });
  pending.set(star.id, request);
  return request;
}

/**
 * Système d'une étoile. Affiche tout de suite une version déduite de l'étoile seule,
 * puis la version complète (vraies planètes + profil) dès qu'elle est chargée.
 */
export function useSystemDefinition(star: StarRecord | null | undefined): { system: SystemDefinition | null; loading: boolean; error: boolean } {
  const [state, setState] = useState<{ key: string | null; system: SystemDefinition | null; loading: boolean; error: boolean }>(() => ({
    key: star?.id ?? null,
    system: star ? cache.get(star.id) ?? buildSystemDefinition(star) : null,
    loading: Boolean(star && !cache.has(star.id)),
    error: false,
  }));
  useEffect(() => {
    if (!star) { setState({ key: null, system: null, loading: false, error: false }); return; }
    let active = true;
    const cached = cache.get(star.id);
    setState({ key: star.id, system: cached ?? buildSystemDefinition(star), loading: !cached, error: false });
    if (cached) return;
    loadSystemDefinition(star)
      .then(system => { if (active) setState({ key: star.id, system, loading: false, error: false }); })
      .catch(() => { if (active) setState(current => ({ ...current, loading: false, error: true })); });
    return () => { active = false; };
  }, [star?.id]);
  return { system: state.system, loading: state.loading, error: state.error };
}
