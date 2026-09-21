export const systemArchitectures = ['catalogue_layout', 'compact_rocky', 'balanced_mixed', 'wide_gas_giants', 'cold_sparse'] as const;
export const planetVisualStyles = ['catalogue_based', 'rocky_mineral', 'ocean_cloud', 'frozen_ice', 'gas_banded', 'volcanic_dark'] as const;
export const renderingFocuses = ['system_overview', 'planet_focus', 'star_focus', 'relay_network'] as const;
export const visualMoods = ['deep_violet', 'cold_cyan', 'solar_gold', 'dust_red', 'neutral_observatory'] as const;

export type SystemArchitecture = typeof systemArchitectures[number];
export type PlanetVisualStyle = typeof planetVisualStyles[number];
export type RenderingFocus = typeof renderingFocuses[number];
export type VisualMood = typeof visualMoods[number];

export type SystemVisualProfile = {
  systemId: string;
  visualSeed: number;
  systemArchitecture: SystemArchitecture;
  planetVisualStyle: PlanetVisualStyle;
  renderingFocus: RenderingFocus;
  visualMood: VisualMood;
};

export type CataloguePlanet<Id extends string = string> = {
  id: Id;
  orbitOrder: number | null;
  radiusEarth?: number | null;
  massEarth?: number | null;
  equilibriumTemperatureK?: number | null;
};

export type GeneratedVisualBody<Id extends string = string> = {
  id: Id;
  orbit: number;
  angle: number;
  size: number;
  seed: number;
  surfaceStyle: 0 | 1 | 2 | 3;
  atmosphere: number;
  color: [number, number, number];
  source: 'catalogue' | 'artistic';
};

const palettes: Record<VisualMood, readonly [number, number, number][]> = {
  deep_violet: [[0.54, 0.36, 0.67], [0.38, 0.48, 0.7], [0.72, 0.48, 0.35]],
  cold_cyan: [[0.42, 0.66, 0.72], [0.55, 0.72, 0.8], [0.42, 0.5, 0.62]],
  solar_gold: [[0.78, 0.48, 0.24], [0.68, 0.58, 0.4], [0.58, 0.44, 0.34]],
  dust_red: [[0.66, 0.34, 0.24], [0.54, 0.4, 0.34], [0.7, 0.5, 0.36]],
  neutral_observatory: [[0.56, 0.58, 0.62], [0.46, 0.54, 0.62], [0.64, 0.62, 0.58]],
};

const architectureSpacing: Record<SystemArchitecture, number> = {
  catalogue_layout: 1,
  compact_rocky: 0.78,
  balanced_mixed: 1,
  wide_gas_giants: 1.34,
  cold_sparse: 1.55,
};

const styleMaterial: Record<PlanetVisualStyle, 0 | 1 | 2 | 3> = {
  catalogue_based: 1,
  rocky_mineral: 0,
  ocean_cloud: 1,
  frozen_ice: 2,
  gas_banded: 3,
  volcanic_dark: 0,
};

function hash(seed: number, value: string) {
  let result = seed | 0;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function random01(seed: number, salt: string) {
  let value = hash(seed, salt);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function measuredSize(radiusEarth: number | null | undefined, fallback: number) {
  if (radiusEarth == null || !Number.isFinite(radiusEarth)) return fallback;
  return clamp(0.18 + Math.log2(Math.max(0.2, radiusEarth) + 1) * 0.095, 0.17, 0.55);
}

function inferredMaterial(style: PlanetVisualStyle, planet: CataloguePlanet): 0 | 1 | 2 | 3 {
  if (style !== 'catalogue_based') return styleMaterial[style];
  if ((planet.radiusEarth ?? 0) >= 5 || (planet.massEarth ?? 0) >= 40) return 3;
  if ((planet.equilibriumTemperatureK ?? 400) < 210) return 2;
  return 1;
}

/**
 * Converts a Jev choice into inexpensive procedural 3D parameters.
 * It never creates astronomical records: callers decide which catalogue or explicitly
 * simulated bodies exist, and this function only controls their presentation.
 */
export function buildSystemVisualBodies<Id extends string>(profile: SystemVisualProfile, planets: readonly CataloguePlanet<Id>[]): GeneratedVisualBody<Id>[] {
  const ordered = [...planets].sort((left, right) => (left.orbitOrder ?? 999) - (right.orbitOrder ?? 999));
  const spacing = architectureSpacing[profile.systemArchitecture];

  return ordered.map((planet, index) => {
    const identity = `${profile.systemId}:${planet.id}`;
    const variation = random01(profile.visualSeed, identity);
    const orbit = (1.72 + index * 1.08) * spacing + variation * 0.2;
    const fallbackSize = profile.systemArchitecture === 'wide_gas_giants' && index >= Math.floor(ordered.length / 2)
      ? 0.38 + variation * 0.08
      : 0.22 + variation * 0.1;
    const material = inferredMaterial(profile.planetVisualStyle, planet);
    const palette = palettes[profile.visualMood];
    const baseColor = palette[index % palette.length];
    const colorScale = profile.planetVisualStyle === 'volcanic_dark' ? 0.72 : 0.9 + variation * 0.16;
    const atmosphere = material === 3 ? 0.14 : profile.planetVisualStyle === 'ocean_cloud' ? 0.24 : material === 2 ? 0.1 : 0;

    return {
      id: planet.id,
      orbit,
      angle: variation * Math.PI * 2,
      size: measuredSize(planet.radiusEarth, fallbackSize),
      seed: hash(profile.visualSeed, identity) % 997,
      surfaceStyle: material,
      atmosphere,
      color: baseColor.map(channel => clamp(channel * colorScale, 0.08, 0.92)) as [number, number, number],
      source: planet.radiusEarth != null || planet.massEarth != null || planet.equilibriumTemperatureK != null ? 'catalogue' : 'artistic',
    };
  });
}

