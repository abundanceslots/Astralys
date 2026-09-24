/**
 * Données des missions — source unique de vérité.
 * Le monde est un carré virtuel 100 × 100, centré sur (50, 50).
 * Les corps en orbite tournent autour de ce centre.
 *
 * Tuning : c'est ici et nulle part ailleurs. Le moteur et le rendu
 * ne contiennent aucune constante de niveau.
 */

export type Vec = { x: number; y: number };

export type Orbit = {
  /** rayon de l'orbite autour du centre (50, 50), en unités virtuelles */
  r: number;
  /** vitesse angulaire en rad/s — négatif = sens rétrograde */
  speed: number;
  /** phase initiale en radians */
  phase: number;
};

export type Body = {
  /** position fixe — ignorée si `orbit` est défini */
  x?: number;
  y?: number;
  orbit?: Orbit;
  /** rayon de collision et de dessin */
  r: number;
  /** masse gravitationnelle (G = 1) */
  m: number;
  type: 'star' | 'planet' | 'satellite';
  /** couleur du corps, ignorée pour les étoiles */
  hue?: string;
};

export type Level = {
  name: string;
  sequence?: number;
  total?: number;
  /** phrase affichée à la première tentative — jamais un tutoriel */
  brief: string;
  station: Vec;
  /** poussée maximale au lancement, en unités/s */
  maxDv: number;
  bodies: Body[];
  target: Vec & { r: number };
  /** Chapitre d'Orbital Run (1 à 6). */
  chapter?: number;
  /** Balises supplémentaires : toutes doivent être atteintes (une par satellite). */
  targets?: (Vec & { r: number })[];
  /** Satellites disponibles pour atteindre toutes les balises ; au-delà, l'essai échoue. */
  probes?: number;
  /** Éruptions solaires : l'étoile devient mortelle jusqu'à `scale` × son rayon pendant `duration` s, toutes les `period` s. */
  flare?: { period: number; duration: number; scale: number };
  /** Astéroïdes en ligne droite (sans gravité), qui réapparaissent de l'autre côté. */
  asteroids?: { x: number; y: number; vx: number; vy: number; r: number }[];
  /** Vent ionique : accélération constante appliquée aux sondes (unités/s²). */
  wind?: { ax: number; ay: number };
};

export const LEVELS: Level[] = [
  {
    name: 'Direct supply',
    brief: 'Gravity bends every path. Aim around the star.',
    station: { x: 16, y: 80 },
    maxDv: 30,
    bodies: [{ x: 50, y: 50, r: 8, m: 7500, type: 'star' }],
    target: { x: 84, y: 20, r: 4.8 },
  },
  {
    name: 'Detour',
    brief: 'A planet blocks the route. Find a path around it.',
    station: { x: 11, y: 50 },
    maxDv: 30,
    bodies: [
      { x: 50, y: 50, r: 7, m: 6500, type: 'star' },
      { x: 50, y: 26, r: 5, m: 2200, type: 'planet', hue: '#7E9BC4' },
    ],
    target: { x: 89, y: 50, r: 4.6 },
  },
  {
    name: 'Launch window',
    brief: 'The target is still. The planet beside it moves.',
    station: { x: 50, y: 91 },
    maxDv: 30,
    bodies: [
      { x: 50, y: 50, r: 7, m: 6800, type: 'star' },
      { orbit: { r: 25, speed: 0.62, phase: 1.1 }, r: 4.6, m: 1900, type: 'planet', hue: '#C48A6E' },
    ],
    target: { x: 88, y: 26, r: 4.6 },
  },
  {
    name: 'Gravity assist',
    brief: 'Use the moving planet to curve your trajectory.',
    station: { x: 10, y: 88 },
    maxDv: 20,
    bodies: [
      { x: 50, y: 50, r: 6, m: 5000, type: 'star' },
      { orbit: { r: 27, speed: 0.72, phase: 2.6 }, r: 5.2, m: 3100, type: 'planet', hue: '#6E9C86' },
    ],
    target: { x: 91, y: 11, r: 5 },
  },
  {
    name: 'The corridor',
    brief: 'Two moving worlds. Wait for an opening.',
    station: { x: 50, y: 93 },
    maxDv: 32,
    bodies: [
      { x: 50, y: 50, r: 6, m: 6000, type: 'star' },
      { orbit: { r: 19, speed: 0.85, phase: 0 }, r: 4.2, m: 1700, type: 'planet', hue: '#9A7EC4' },
      { orbit: { r: 34, speed: -0.44, phase: 2.2 }, r: 4.6, m: 2100, type: 'planet', hue: '#C4A96E' },
    ],
    target: { x: 50, y: 7, r: 4.8 },
  },
];

/** Constantes du moteur — exposées pour le réglage du ressenti. */
export const ENGINE = {
  /** constante gravitationnelle */
  G: 1,
  /** pas d'intégration (s) */
  H: 1 / 360,
  /** sous-pas par image */
  SUB: 6,
  /** durée de vol maximale avant abandon (s) */
  MAX_FLIGHT: 11,
  /** pas de trajectoire prévisionnelle affichés au joueur */
  PREVIEW_BASE: 300,
  /** pas ajoutés à la prévision par tentative ratée (plafonné à 7) */
  PREVIEW_ASSIST: 60,
};

export type Palette = {
  void: string;
  void2: string;
  panel: string;
  line: string;
  lineSoft: string;
  ink: string;
  dim: string;
  trace: string;
  star: string;
  starHot: string;
  colony: string;
  danger: string;
};

export const PALETTE: Palette = {
  void: '#070911',
  void2: '#111629',
  panel: 'rgba(13,17,30,.95)',
  line: '#343650',
  lineSoft: '#26293D',
  ink: '#F4F1FF',
  dim: '#9BA3BC',
  trace: '#C8BAF5',
  star: '#FFD4A3',
  starHot: '#E79072',
  colony: '#9ED7E5',
  danger: '#FF8A8E',
};
