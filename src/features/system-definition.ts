/**
 * Astralys — un système par étoile, construit à partir de la base de données.
 *
 * Ce qui VARIE selon l'étoile (toujours identique pour une même étoile) :
 *   couleur et taille de l'étoile (couleur Gaia BP-RP, magnitude absolue), architecture,
 *   espacement des orbites, matières / couleurs / tailles des planètes, et les vraies
 *   planètes confirmées (nom, rayon, masse, température, ordre) quand le catalogue en a.
 * Ce qui NE VARIE PAS (même jeu pour tout le monde) :
 *   7 emplacements de planètes b…h, mêmes coûts, mêmes temps de trajet, même économie
 *   (guardian-demo-model.ts ne dépend d'aucune donnée de ce fichier).
 *
 * Aucun fait astronomique n'est inventé : les planètes sans correspondance dans le catalogue
 * sont marquées `real: false` (simulation) et n'ont pas de nom scientifique.
 * Module pur (sans React Native) : utilisé par l'app, l'écran de test et scripts/check-system-variety.cjs.
 */
import { demoPlanets, type DemoPlanet } from './guardian-demo-model';
import { cameraMatrix, overviewCamera, project, type Vec3 } from './guardian-scene';
import {
  buildSystemVisualBodies,
  planetVisualStyles,
  systemArchitectures,
  visualMoods,
  type PlanetVisualStyle,
  type SystemArchitecture,
  type SystemVisualProfile,
  type VisualMood,
} from './system-visual-profile';

/* ------------------------------------------------------------------ */
/* Données d'entrée (lignes Supabase)                                   */
/* ------------------------------------------------------------------ */
export type StarRecord = {
  id: string;
  scientific_name: string;
  common_name?: string | null;
  visual_category?: string | null;
  visual_seed?: number | null;
  distance_ly?: number | null;
  apparent_magnitude?: number | null;
  temperature_k?: number | null;
  raw_data?: { bp_rp?: number | null } | null;
};
export type PlanetRecord = {
  id: string;
  scientific_name: string;
  radius_earth?: number | null;
  mass_earth?: number | null;
  equilibrium_temperature_k?: number | null;
  orbital_period_days?: number | null;
  /** Ordre orbital depuis planetary_system_planets, si connu. */
  orbit_order?: number | null;
};
export type VisualProfileRecord = {
  system_architecture?: string | null;
  planet_visual_style?: string | null;
  rendering_focus?: string | null;
  visual_mood?: string | null;
  visual_seed?: number | null;
  confidence?: Record<string, number> | null;
};

/* ------------------------------------------------------------------ */
/* Résultat                                                             */
/* ------------------------------------------------------------------ */
export type SystemBody = {
  id: DemoPlanet;
  orbit: number;
  angle: number;
  size: number;
  seed: number;
  surfaceStyle: 0 | 1 | 2 | 3;
  atmosphere: number;
  color: [number, number, number];
  position: Vec3;
  /** Nom scientifique si c'est une planète confirmée du catalogue, sinon null (simulation). */
  name: string | null;
  real: boolean;
};
export type SystemDefinition = {
  starId: string;
  starName: string;
  profile: SystemVisualProfile;
  star: { color: [number, number, number]; size: number; temperatureK: number };
  bodies: SystemBody[];
  realPlanetCount: number;
  /** D'où vient chaque choix : « database » (profil Jev fiable) ou « star » (déduit des données de l'étoile). */
  sources: { architecture: 'database' | 'star' | 'planets'; mood: 'database' | 'star'; style: 'database' | 'star' | 'planets' };
};

/* ------------------------------------------------------------------ */
/* Constantes de mise en page (vérifiées par le script de test)         */
/* ------------------------------------------------------------------ */
/** Rayon de l'orbite du relais principal autour de l'étoile (guardian-gl-renderer.ts). */
export const MAIN_RELAY_ORBIT = 1.15;
/** Au-delà, la vue d'ensemble ne cadre plus tout le système. */
export const MAX_OUTER_ORBIT = 9.2;
/** Place laissée entre deux planètes voisines (petits relais en orbite à 0,5 autour d'elles). */
export const MIN_ORBIT_CLEARANCE = 0.35;
export const STAR_SIZE_RANGE = [0.45, 0.85] as const;
export const PLANET_SIZE_RANGE = [0.15, 0.6] as const;

/* ------------------------------------------------------------------ */
/* Outils déterministes                                                 */
/* ------------------------------------------------------------------ */
function hashString(seed: number, value: string) {
  let result = (seed ^ 0x9e3779b9) | 0;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
function unit(seed: number, salt: string) {
  let v = hashString(seed, salt);
  v ^= v << 13; v ^= v >>> 17; v ^= v << 5;
  return (v >>> 0) / 4294967296;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function weighted<T extends string>(seed: number, salt: string, table: readonly [T, number][]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = unit(seed, salt) * total;
  for (const [value, weight] of table) { roll -= weight; if (roll < 0) return value; }
  return table[table.length - 1][0];
}
const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value);

/* ------------------------------------------------------------------ */
/* Étoile : couleur Gaia → température → couleur affichée, taille       */
/* ------------------------------------------------------------------ */
const CATEGORY_TEMPERATURE: Record<string, number> = { blue: 16000, 'blue-white': 9500, 'white-yellow': 6400, golden: 5200, 'orange-red': 3900 };

export function starTemperature(star: StarRecord): number {
  if (star.temperature_k && Number.isFinite(star.temperature_k)) return clamp(star.temperature_k, 2400, 40000);
  const bpRp = star.raw_data?.bp_rp;
  if (typeof bpRp === 'number' && Number.isFinite(bpRp)) {
    // BP-RP (Gaia) → B-V approché → température (formule de Ballesteros).
    const bv = clamp(0.78 * bpRp + 0.03, -0.35, 2.2);
    return clamp(4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62)), 2400, 40000);
  }
  return CATEGORY_TEMPERATURE[star.visual_category ?? ''] ?? 5800;
}

/** Couleur affichée selon la température : palette stylisée (rouge-orangé → jaune → blanc → bleu), interpolée. */
const STAR_COLOR_STOPS: readonly [number, [number, number, number]][] = [
  [2800, [1.0, 0.4, 0.18]], [3800, [1.0, 0.52, 0.24]], [4800, [1.0, 0.66, 0.32]], [5600, [1.0, 0.8, 0.46]],
  [6400, [1.0, 0.9, 0.66]], [7500, [0.95, 0.93, 0.9]], [9500, [0.78, 0.84, 1.0]], [14000, [0.62, 0.72, 1.0]], [25000, [0.52, 0.64, 1.0]],
];
export function temperatureColor(kelvin: number): [number, number, number] {
  const stops = STAR_COLOR_STOPS;
  if (kelvin <= stops[0][0]) return [...stops[0][1]];
  for (let i = 1; i < stops.length; i++) {
    if (kelvin <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (kelvin - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k) as [number, number, number];
    }
  }
  return [...stops[stops.length - 1][1]];
}

/** Plus l'étoile est lumineuse (magnitude absolue), plus elle est grande dans la scène. */
export function starSceneSize(star: StarRecord): number {
  const m = star.apparent_magnitude, d = star.distance_ly;
  if (typeof m !== 'number' || typeof d !== 'number' || !(d > 0)) return 0.62;
  const absolute = m - 5 * Math.log10(d / 3.26156 / 10);
  return clamp(0.64 + (4.8 - absolute) * 0.028, STAR_SIZE_RANGE[0], STAR_SIZE_RANGE[1]);
}

/* ------------------------------------------------------------------ */
/* Profil visuel : base de données d'abord, puis déduction depuis l'étoile */
/* ------------------------------------------------------------------ */
const ARCHITECTURE_BY_CATEGORY: Record<string, readonly [SystemArchitecture, number][]> = {
  blue: [['wide_gas_giants', 4], ['cold_sparse', 3], ['balanced_mixed', 2]],
  'blue-white': [['wide_gas_giants', 3], ['balanced_mixed', 3], ['cold_sparse', 2], ['compact_rocky', 1]],
  'white-yellow': [['balanced_mixed', 4], ['compact_rocky', 2], ['wide_gas_giants', 2], ['cold_sparse', 1.5]],
  golden: [['balanced_mixed', 4], ['compact_rocky', 3], ['wide_gas_giants', 2], ['cold_sparse', 1]],
  'orange-red': [['compact_rocky', 6], ['balanced_mixed', 3], ['cold_sparse', 1]],
};
const MOOD_BY_CATEGORY: Record<string, readonly [VisualMood, number][]> = {
  blue: [['cold_cyan', 6], ['deep_violet', 3], ['neutral_observatory', 1]],
  'blue-white': [['cold_cyan', 4], ['deep_violet', 4], ['neutral_observatory', 2]],
  'white-yellow': [['neutral_observatory', 3], ['deep_violet', 3], ['solar_gold', 3], ['cold_cyan', 1]],
  golden: [['solar_gold', 6], ['dust_red', 2], ['deep_violet', 2]],
  'orange-red': [['dust_red', 6], ['solar_gold', 2], ['deep_violet', 2]],
};
const STYLE_BY_ARCHITECTURE: Record<SystemArchitecture, readonly [PlanetVisualStyle, number][]> = {
  compact_rocky: [['rocky_mineral', 5], ['volcanic_dark', 4], ['ocean_cloud', 1]],
  balanced_mixed: [['rocky_mineral', 3], ['ocean_cloud', 3], ['frozen_ice', 2], ['volcanic_dark', 1]],
  wide_gas_giants: [['gas_banded', 6], ['ocean_cloud', 2], ['frozen_ice', 2]],
  cold_sparse: [['frozen_ice', 6], ['rocky_mineral', 2], ['gas_banded', 2]],
  catalogue_layout: [['catalogue_based', 1]],
};
/** Matière de chaque emplacement simulé (0 rocheux, 1 océan/nuages, 2 glace, 3 gazeux), de l'intérieur vers l'extérieur. */
const MATERIAL_PATTERNS: Record<SystemArchitecture, readonly (0 | 1 | 2 | 3)[]> = {
  compact_rocky: [0, 0, 1, 0, 1, 2, 0],
  balanced_mixed: [0, 1, 0, 3, 3, 2, 2],
  wide_gas_giants: [0, 1, 3, 3, 3, 3, 2],
  cold_sparse: [0, 2, 3, 2, 3, 2, 2],
  catalogue_layout: [0, 1, 0, 3, 3, 2, 2],
};
/** Écart de base entre orbites, et accroissement vers l'extérieur. */
const ORBIT_SPACING: Record<SystemArchitecture, { gap: number; growth: number }> = {
  compact_rocky: { gap: 0.86, growth: 0.02 },
  balanced_mixed: { gap: 1.02, growth: 0.05 },
  wide_gas_giants: { gap: 0.9, growth: 0.16 },
  cold_sparse: { gap: 1.12, growth: 0.1 },
  catalogue_layout: { gap: 1.02, growth: 0.05 },
};
const MOOD_PALETTES: Record<VisualMood, readonly [number, number, number][]> = {
  deep_violet: [[0.54, 0.36, 0.67], [0.38, 0.48, 0.7], [0.72, 0.48, 0.35], [0.46, 0.4, 0.62]],
  cold_cyan: [[0.42, 0.66, 0.72], [0.55, 0.72, 0.8], [0.42, 0.5, 0.62], [0.62, 0.7, 0.74]],
  solar_gold: [[0.78, 0.48, 0.24], [0.68, 0.58, 0.4], [0.58, 0.44, 0.34], [0.8, 0.66, 0.42]],
  dust_red: [[0.66, 0.34, 0.24], [0.54, 0.4, 0.34], [0.7, 0.5, 0.36], [0.5, 0.3, 0.28]],
  neutral_observatory: [[0.56, 0.58, 0.62], [0.46, 0.54, 0.62], [0.64, 0.62, 0.58], [0.52, 0.5, 0.56]],
};
const MATERIAL_TINT: Record<0 | 1 | 2 | 3, [number, number, number]> = {
  0: [1.05, 0.92, 0.82], 1: [0.78, 0.95, 1.12], 2: [0.95, 1.05, 1.15], 3: [1.08, 1.0, 0.86],
};
/** Seuil de confiance au-delà duquel on suit le choix du profil Jev enregistré en base. */
const TRUST = 0.7;

export function resolveProfile(star: StarRecord, planets: readonly PlanetRecord[], row?: VisualProfileRecord | null) {
  const seed = (row?.visual_seed ?? star.visual_seed ?? hashString(7429, star.id)) >>> 0;
  const category = star.visual_category ?? 'white-yellow';
  const confidence = row?.confidence ?? {};
  const dbArchitecture = isOneOf(systemArchitectures, row?.system_architecture) ? row!.system_architecture as SystemArchitecture : null;
  const dbMood = isOneOf(visualMoods, row?.visual_mood) ? row!.visual_mood as VisualMood : null;
  const dbStyle = isOneOf(planetVisualStyles, row?.planet_visual_style) ? row!.planet_visual_style as PlanetVisualStyle : null;

  // Architecture : vraies planètes > choix Jev fiable et distinctif > déduction depuis la couleur de l'étoile.
  let architecture: SystemArchitecture, archSource: SystemDefinition['sources']['architecture'];
  if (planets.length >= 2) { architecture = 'catalogue_layout'; archSource = 'planets'; }
  else if (dbArchitecture && dbArchitecture !== 'balanced_mixed' && dbArchitecture !== 'catalogue_layout' && (confidence.system_architecture ?? 0) >= TRUST) { architecture = dbArchitecture; archSource = 'database'; }
  else { architecture = weighted(seed, 'architecture', ARCHITECTURE_BY_CATEGORY[category] ?? ARCHITECTURE_BY_CATEGORY['white-yellow']); archSource = 'star'; }

  let mood: VisualMood, moodSource: SystemDefinition['sources']['mood'];
  if (dbMood && dbMood !== 'neutral_observatory' && (confidence.visual_mood ?? 0) >= TRUST) { mood = dbMood; moodSource = 'database'; }
  else { mood = weighted(seed, 'mood', MOOD_BY_CATEGORY[category] ?? MOOD_BY_CATEGORY['white-yellow']); moodSource = 'star'; }

  let style: PlanetVisualStyle, styleSource: SystemDefinition['sources']['style'];
  if (planets.length > 0) { style = 'catalogue_based'; styleSource = 'planets'; }
  else if (dbStyle && dbStyle !== 'catalogue_based' && (confidence.planet_visual_style ?? 0) >= TRUST) { style = dbStyle; styleSource = 'database'; }
  else { style = weighted(seed, 'style', STYLE_BY_ARCHITECTURE[architecture]); styleSource = 'star'; }

  const profile: SystemVisualProfile = {
    systemId: star.id,
    visualSeed: seed,
    systemArchitecture: architecture,
    planetVisualStyle: style,
    renderingFocus: row?.rendering_focus === 'planet_focus' || row?.rendering_focus === 'star_focus' || row?.rendering_focus === 'relay_network' ? row.rendering_focus : 'system_overview',
    visualMood: mood,
  };
  return { profile, sources: { architecture: archSource, mood: moodSource, style: styleSource } };
}

/* ------------------------------------------------------------------ */
/* Orbites                                                              */
/* ------------------------------------------------------------------ */
function layoutOrbits(architecture: SystemArchitecture, seed: number, starSize: number, sizes: readonly number[], realPeriods: readonly (number | null)[]): number[] {
  const first = Math.max(MAIN_RELAY_ORBIT + 0.4 + sizes[0], starSize * 2 + 0.7);
  const { gap, growth } = ORBIT_SPACING[architecture];
  const orbits = [first + unit(seed, 'orbit0') * 0.2];
  for (let i = 1; i < sizes.length; i++) {
    let step = gap * (1 + growth * i) + (unit(seed, `orbit${i}`) - 0.5) * 0.24;
    // Systèmes réels : les rapports de périodes (3e loi de Kepler, a ∝ P^2/3) écartent plus ou moins les planètes.
    const pa = realPeriods[i - 1], pb = realPeriods[i];
    if (pa && pb && pb > pa) step *= clamp(0.75 + Math.log(Math.pow(pb / pa, 2 / 3)) * 0.55, 0.85, 1.6);
    step = Math.max(step, sizes[i - 1] + sizes[i] + MIN_ORBIT_CLEARANCE + 0.05);
    orbits.push(orbits[i - 1] + step);
  }
  // Tout doit tenir dans le cadre : on resserre les écarts (jamais sous le minimum) si besoin.
  const outer = orbits[orbits.length - 1];
  if (outer > MAX_OUTER_ORBIT) {
    const minimums = sizes.slice(1).map((s, i) => sizes[i] + s + MIN_ORBIT_CLEARANCE + 0.02);
    const steps = orbits.slice(1).map((o, i) => o - orbits[i]);
    const room = MAX_OUTER_ORBIT - orbits[0];
    const flexible = steps.reduce((sum, s, i) => sum + (s - minimums[i]), 0);
    const needed = steps.reduce((a, b) => a + b, 0) - room;
    const k = flexible > 0 ? clamp(1 - needed / flexible, 0, 1) : 0;
    for (let i = 1; i < orbits.length; i++) orbits[i] = orbits[i - 1] + minimums[i - 1] + (steps[i - 1] - minimums[i - 1]) * k;
  }
  return orbits;
}

/* ------------------------------------------------------------------ */
/* Construction                                                         */
/* ------------------------------------------------------------------ */
export function buildSystemDefinition(star: StarRecord, planetRows: readonly PlanetRecord[] = [], profileRow?: VisualProfileRecord | null): SystemDefinition {
  // Vraies planètes, de l'intérieur vers l'extérieur ; les 7 premières occupent les emplacements b…h.
  const planets = [...planetRows]
    .sort((a, b) => (a.orbit_order ?? 999) - (b.orbit_order ?? 999) || (a.orbital_period_days ?? 1e9) - (b.orbital_period_days ?? 1e9) || a.scientific_name.localeCompare(b.scientific_name))
    .slice(0, demoPlanets.length);
  const { profile, sources } = resolveProfile(star, planets, profileRow);
  const temperatureK = starTemperature(star);
  const starSize = starSceneSize(star);

  const base = buildSystemVisualBodies(profile, demoPlanets.map((id, index) => {
    const real = planets[index];
    return { id, orbitOrder: index + 1, radiusEarth: real?.radius_earth ?? null, massEarth: real?.mass_earth ?? null, equilibriumTemperatureK: real?.equilibrium_temperature_k ?? null };
  }));
  const pattern = MATERIAL_PATTERNS[profile.systemArchitecture];
  const palette = MOOD_PALETTES[profile.visualMood];
  const shift = Math.floor(unit(profile.visualSeed, 'palette') * palette.length);

  const drafts = base.map((body, index) => {
    const real = planets[index];
    // Matière : déduite des mesures pour une vraie planète, sinon motif de l'architecture (légèrement varié).
    const simulated = pattern[(index + (unit(profile.visualSeed, 'pattern') < 0.25 ? 1 : 0)) % pattern.length];
    const material = real ? body.surfaceStyle : profile.planetVisualStyle === 'volcanic_dark' && index < 3 ? 0 : simulated;
    const tint = MATERIAL_TINT[material];
    const baseColor = palette[(index + shift) % palette.length];
    const variation = 0.88 + unit(profile.visualSeed, `color${index}`) * 0.24;
    const dark = profile.planetVisualStyle === 'volcanic_dark' && material === 0 ? 0.7 : 1;
    const size = real && real.radius_earth != null ? body.size
      : clamp((material === 3 ? 0.36 : material === 2 ? 0.24 : 0.21) + unit(profile.visualSeed, `size${index}`) * 0.1, PLANET_SIZE_RANGE[0], PLANET_SIZE_RANGE[1]);
    return {
      ...body,
      size: clamp(size, PLANET_SIZE_RANGE[0], PLANET_SIZE_RANGE[1]),
      surfaceStyle: material,
      atmosphere: material === 3 ? 0.14 : material === 1 ? 0.22 : material === 2 ? 0.1 : 0,
      color: baseColor.map((c, k) => clamp(c * tint[k] * variation * dark, 0.08, 0.92)) as [number, number, number],
      name: real ? real.scientific_name : null,
      real: Boolean(real),
    };
  });
  // Si de grosses planètes ne tiennent pas dans le cadre même serrées, on les réduit un peu (proportions gardées).
  const periods = drafts.map((_, i) => planets[i]?.orbital_period_days ?? null);
  let orbits = layoutOrbits(profile.systemArchitecture, profile.visualSeed, starSize, drafts.map(d => d.size), periods);
  for (let pass = 0; pass < 8 && orbits[orbits.length - 1] > MAX_OUTER_ORBIT; pass++) {
    for (const d of drafts) d.size = Math.max(PLANET_SIZE_RANGE[0], d.size * 0.92);
    orbits = layoutOrbits(profile.systemArchitecture, profile.visualSeed, starSize, drafts.map(d => d.size), periods);
  }
  const bodies: SystemBody[] = drafts.map((d, i) => ({
    id: d.id, orbit: orbits[i], angle: d.angle, size: d.size, seed: d.seed, surfaceStyle: d.surfaceStyle, atmosphere: d.atmosphere, color: d.color,
    position: [Math.cos(d.angle) * orbits[i], 0, Math.sin(d.angle) * orbits[i]], name: d.name, real: d.real,
  }));
  return {
    starId: star.id,
    starName: star.common_name || star.scientific_name,
    profile,
    star: { color: temperatureColor(temperatureK), size: starSize, temperatureK },
    bodies,
    realPlanetCount: planets.length,
    sources,
  };
}

/* ------------------------------------------------------------------ */
/* Règles vérifiées pour chacun des systèmes                            */
/* ------------------------------------------------------------------ */
export function validateSystemDefinition(system: SystemDefinition): string[] {
  const issues: string[] = [];
  const { bodies, star } = system;
  if (bodies.length !== demoPlanets.length) issues.push(`expected ${demoPlanets.length} planet slots, got ${bodies.length}`);
  bodies.forEach((b, i) => { if (b.id !== demoPlanets[i]) issues.push(`slot ${i} should be ${demoPlanets[i]}, got ${b.id}`); });
  const numbers = [star.size, star.temperatureK, ...star.color, ...bodies.flatMap(b => [b.orbit, b.angle, b.size, b.atmosphere, ...b.color, ...b.position])];
  if (!numbers.every(Number.isFinite)) issues.push('non-finite value');
  if (star.size < STAR_SIZE_RANGE[0] || star.size > STAR_SIZE_RANGE[1]) issues.push(`star size ${star.size.toFixed(2)} out of range`);
  if (star.color.some(c => c < 0 || c > 1)) issues.push('star color out of range');
  for (const b of bodies) {
    if (b.size < PLANET_SIZE_RANGE[0] || b.size > PLANET_SIZE_RANGE[1]) issues.push(`${b.id}: size ${b.size.toFixed(2)} out of range`);
    if (b.color.some(c => c < 0 || c > 1)) issues.push(`${b.id}: color out of range`);
  }
  if (bodies[0] && bodies[0].orbit - bodies[0].size < MAIN_RELAY_ORBIT + 0.3) issues.push(`b: orbit ${bodies[0].orbit.toFixed(2)} collides with the main relay`);
  if (bodies[0] && bodies[0].orbit - bodies[0].size < star.size * 1.6) issues.push('b: too close to the star');
  for (let i = 1; i < bodies.length; i++) {
    const gap = bodies[i].orbit - bodies[i - 1].orbit, need = bodies[i].size + bodies[i - 1].size + MIN_ORBIT_CLEARANCE;
    if (gap < need - 1e-6) issues.push(`${bodies[i - 1].id}-${bodies[i].id}: orbits ${gap.toFixed(2)} apart, need ${need.toFixed(2)}`);
  }
  const outer = bodies[bodies.length - 1]?.orbit ?? 0;
  if (outer > MAX_OUTER_ORBIT + 1e-6) issues.push(`outer orbit ${outer.toFixed(2)} exceeds ${MAX_OUTER_ORBIT}`);
  // Cadrage : tout le système visible dans la vue d'ensemble, sur des écrans étroits et larges, à toute heure.
  for (const [w, h] of [[320, 420], [390, 520], [430, 640]] as const) {
    const camera = overviewCamera(w, h, demoPlanets, bodies);
    const matrix = cameraMatrix(camera, w / h);
    // Les planètes tournent autour de l'étoile : on vérifie tout le tour de chaque orbite.
    outer: for (const b of bodies) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const p = project([Math.cos(a) * b.orbit, 0, Math.sin(a) * b.orbit], matrix, w, h);
        if (!p || p.x < 0 || p.x > w || p.y < 0 || p.y > h) { issues.push(`${b.id}: leaves the ${w}×${h} overview while orbiting`); break outer; }
      }
    }
  }
  return issues;
}
