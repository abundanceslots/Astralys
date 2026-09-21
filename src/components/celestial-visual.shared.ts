export type CelestialVisualObject = {
  id: string;
  object_type: 'star' | 'planet';
  visual_category?: string | null;
  apparent_magnitude?: number | null;
  temperature_k?: number | null;
  radius_solar?: number | null;
  mass_solar?: number | null;
  radius_earth?: number | null;
  mass_earth?: number | null;
  equilibrium_temperature_k?: number | null;
};

export type CelestialVisualKind =
  | 'star'
  | 'rocky'
  | 'ocean'
  | 'ice'
  | 'gas'
  | 'lava';

export type CelestialTextureSpot = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
};

export type CelestialVisualProfile = {
  seed: number;
  kind: CelestialVisualKind;
  baseColor: string;
  highlightColor: string;
  shadowColor: string;
  accentColor: string;
  glowColor: string;
  bodyRatio: number;
  hasRings: boolean;
  tilt: number;
  spots: CelestialTextureSpot[];
  description: string;
};

const STAR_PALETTES: Record<string, readonly [string, string, string, string]> = {
  blue: ['#6AA7FF', '#EAF5FF', '#2457B8', '#A7CFFF'],
  'blue-white': ['#AFCBFF', '#FFFFFF', '#547BC9', '#DCE9FF'],
  'white-yellow': ['#F2EBCB', '#FFFFFF', '#A99358', '#FFF4BC'],
  golden: ['#F3C966', '#FFF4C6', '#A86426', '#FFD985'],
  'orange-red': ['#E9825F', '#FFD3A5', '#8D342D', '#FF9B70'],
};

const PLANET_PALETTES: Record<Exclude<CelestialVisualKind, 'star'>, readonly [string, string, string, string]> = {
  rocky: ['#9B806B', '#D8C0A4', '#352B2A', '#C79772'],
  ocean: ['#377FC2', '#9DDEF2', '#122B59', '#70C6C8'],
  ice: ['#9EC8D6', '#F0FCFF', '#38566C', '#C8ECF2'],
  gas: ['#C18E62', '#F3D7A8', '#5C4052', '#E5A96E'],
  lava: ['#9E382C', '#FFCA68', '#2B1016', '#FF6B35'],
};

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function starCategory(object: CelestialVisualObject) {
  if (object.visual_category && STAR_PALETTES[object.visual_category]) {
    return object.visual_category;
  }

  const temperature = object.temperature_k;
  if (temperature === null || temperature === undefined) return 'blue-white';
  if (temperature >= 10000) return 'blue';
  if (temperature >= 7500) return 'blue-white';
  if (temperature >= 5500) return 'white-yellow';
  if (temperature >= 4000) return 'golden';
  return 'orange-red';
}

function planetKind(object: CelestialVisualObject, seed: number): Exclude<CelestialVisualKind, 'star'> {
  const temperature = object.equilibrium_temperature_k;
  const radius = object.radius_earth;
  const mass = object.mass_earth;

  if ((radius !== null && radius !== undefined && radius >= 4) || (mass !== null && mass !== undefined && mass >= 30)) {
    return 'gas';
  }
  if (temperature !== null && temperature !== undefined && temperature >= 700) return 'lava';
  if (temperature !== null && temperature !== undefined && temperature <= 200) return 'ice';
  if (seed % 4 === 0) return 'ocean';
  return 'rocky';
}

function starDescription(category: string) {
  const labels: Record<string, string> = {
    blue: 'Very hot blue star',
    'blue-white': 'Blue-white star',
    'white-yellow': 'White-yellow star',
    golden: 'Golden star',
    'orange-red': 'Cooler orange-red star',
  };

  return labels[category] ?? 'Star generated from the available data';
}

export function getCelestialVisualProfile(object: CelestialVisualObject): CelestialVisualProfile {
  const seed = stableHash(object.id);
  const random = createRandom(seed);
  const spots = Array.from({ length: object.object_type === 'star' ? 7 : 9 }, () => ({
    x: 0.22 + random() * 0.56,
    y: 0.22 + random() * 0.56,
    radius: 0.018 + random() * 0.055,
    opacity: 0.1 + random() * 0.22,
  }));

  if (object.object_type === 'star') {
    const category = starCategory(object);
    const palette = STAR_PALETTES[category];
    const magnitude = object.apparent_magnitude ?? 5;
    const radiusInfluence = Math.log2(Math.max(object.radius_solar ?? 1, 0.2) + 1) * 0.018;

    return {
      seed: seed % 997,
      kind: 'star',
      baseColor: palette[0],
      highlightColor: palette[1],
      shadowColor: palette[2],
      accentColor: palette[3],
      glowColor: palette[0],
      bodyRatio: clamp(0.29 + radiusInfluence + (4 - magnitude) * 0.006, 0.27, 0.38),
      hasRings: false,
      tilt: (random() - 0.5) * 0.35,
      spots,
      description: starDescription(category),
    };
  }

  const kind = planetKind(object, seed);
  const palette = PLANET_PALETTES[kind];
  const radiusInfluence = Math.log2(Math.max(object.radius_earth ?? 1, 0.2) + 1) * 0.018;

  return {
    seed: seed % 997,
    kind,
    baseColor: palette[0],
    highlightColor: palette[1],
    shadowColor: palette[2],
    accentColor: palette[3],
    glowColor: palette[3],
    bodyRatio: clamp(0.3 + radiusInfluence, 0.29, 0.39),
    hasRings: kind === 'gas' ? seed % 3 !== 0 : seed % 11 === 0,
    tilt: -0.28 + random() * 0.56,
    spots,
    description: {
      rocky: 'Probable rocky world',
      ocean: 'Hypothetical ocean world',
      ice: 'Probable frozen world',
      gas: 'Probable gas giant',
      lava: 'Probable scorched world',
    }[kind],
  };
}

export function colorWithAlpha(hex: string, opacity: number) {
  const normalized = hex.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`;
}
