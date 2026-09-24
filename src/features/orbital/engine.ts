/**
 * Moteur physique d'Orbital Hook — TypeScript pur, sans dépendance de rendu.
 *
 * Toutes les fonctions sont des worklets : elles tournent sur le thread UI
 * (Reanimated) dans la version native, sans aller-retour avec le thread JS.
 * Les positions sont stockées dans des tableaux plats [x0, y0, x1, y1, …]
 * pour éviter d'allouer des objets à chaque sous-pas.
 *
 * Mécaniques par chapitre (voir run-levels.ts) :
 * - plusieurs balises à atteindre, un satellite par balise (+1 de réserve) ;
 * - éruptions solaires qui agrandissent la zone mortelle de l'étoile ;
 * - astéroïdes en ligne droite ;
 * - vent ionique qui pousse les sondes.
 */
import { ENGINE, type Level } from './levels';

export type Outcome = 'ok' | 'ko' | null;

export type Probe = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  /** traînée, tableau plat [x, y, x, y, …] */
  trail: number[];
  /** plus petite distance atteinte jusqu'au bord d'une balise non atteinte */
  closest: number;
  /** nombre de sous-pas simulés depuis le lancement */
  n: number;
};

export type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: string };

export type GameState = {
  lvl: number;
  attempts: number;
  totalAttempts: number;
  supply: number;
  /** temps de simulation du niveau (s) — fait tourner les orbites */
  t: number;
  aimA: number;
  aimP: number;
  dragging: boolean;
  probe: Probe | null;
  outcome: Outcome;
  /** horodatage (ms) de l'issue du tir, pour enchaîner sans setTimeout */
  outcomeAt: number;
  done: boolean;
  paused: boolean;
  startedAt: number;
  /** vitesse de simulation du vol : 1 ou 3 (avance rapide) */
  speed: number;
  /** trajectoire du dernier tir raté, affichée en fantôme */
  ghost: number[];
  particles: Particle[];
  /** anneau de réussite sur la balise atteinte */
  burstAt: number;
  burstX: number;
  burstY: number;
  /** accumulateur de pas fixes */
  acc: number;
  /** dernier cran de puissance signalé (retour haptique) */
  aimTick: number;
  /** balises déjà atteintes pendant cet essai */
  reached: boolean[];
  /** satellites restants pour cet essai */
  satsLeft: number;
  /** vrai quand le tir en cours a atteint une balise mais qu'il en reste d'autres */
  partial: boolean;
};

/** Rayon (unités virtuelles) autour de la station : relâcher ici annule le tir. */
export const CANCEL_RADIUS = 4.5;
/** Délais avant d'enchaîner après une réussite / un échec (ms). */
export const SUCCESS_DELAY = 750;
export const FAIL_DELAY = 560;
/** Préavis visuel avant une éruption solaire (s). */
export const FLARE_WARNING = 1.2;

export function createState(now: number): GameState {
  'worklet';
  return {
    lvl: 0,
    attempts: 1,
    totalAttempts: 0,
    supply: 0,
    t: 0,
    aimA: -Math.PI / 4,
    aimP: 0.75,
    dragging: false,
    probe: null,
    outcome: null,
    outcomeAt: 0,
    done: false,
    paused: false,
    startedAt: now,
    speed: 1,
    ghost: [],
    particles: [],
    burstAt: -1,
    burstX: 0,
    burstY: 0,
    acc: 0,
    aimTick: -1,
    reached: [],
    satsLeft: 0,
    partial: false,
  };
}

/** Toutes les balises du niveau : la principale puis les supplémentaires. */
export function allTargets(level: Level): { x: number; y: number; r: number }[] {
  'worklet';
  return level.targets && level.targets.length > 0 ? [level.target, ...level.targets] : [level.target];
}

/** Satellites disponibles par essai (1 = mode classique : chaque échec compte comme un essai). */
export function probesFor(level: Level): number {
  'worklet';
  return level.probes ?? allTargets(level).length;
}

/** Remet balises et satellites à zéro pour un nouvel essai. */
export function resetTargets(level: Level, s: GameState): void {
  'worklet';
  s.reached = allTargets(level).map(() => false);
  s.satsLeft = probesFor(level);
  s.partial = false;
}

/** Rayon effectif d'une balise : elle s'agrandit un peu après plusieurs échecs (aide discrète). */
export function targetRadius(level: Level, attempts: number, index = 0): number {
  'worklet';
  const t = allTargets(level)[index] ?? level.target;
  return t.r * (1 + Math.min(0.3, Math.max(0, attempts - 2) * 0.05));
}

/** Phase de l'éruption solaire à l'instant t : 0 = calme, 1 = préavis, 2 = active. */
export function flarePhase(level: Level, t: number): number {
  'worklet';
  const f = level.flare;
  if (!f) return 0;
  const phase = ((t % f.period) + f.period) % f.period;
  if (phase >= f.period - f.duration) return 2;
  if (phase >= f.period - f.duration - FLARE_WARNING) return 1;
  return 0;
}

/** Écrit la position de chaque corps à l'instant t dans `out` (tableau plat). */
export function positionsAt(level: Level, t: number, out: number[]): number[] {
  'worklet';
  const bodies = level.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (b.orbit) {
      const a = b.orbit.phase + b.orbit.speed * t;
      out[i * 2] = 50 + Math.cos(a) * b.orbit.r;
      out[i * 2 + 1] = 50 + Math.sin(a) * b.orbit.r;
    } else {
      out[i * 2] = b.x ?? 50;
      out[i * 2 + 1] = b.y ?? 50;
    }
  }
  out.length = bodies.length * 2;
  return out;
}

/** Position d'un astéroïde à l'instant t (il réapparaît de l'autre côté du champ). */
export function asteroidAt(a: { x: number; y: number; vx: number; vy: number }, t: number): { x: number; y: number } {
  'worklet';
  const span = 124;
  const wrap = (v: number) => ((((v + 12) % span) + span) % span) - 12;
  return { x: wrap(a.x + a.vx * t), y: wrap(a.y + a.vy * t) };
}

/** Accélération gravitationnelle (adoucie) au point (x, y), vent ionique compris. */
export function accel(level: Level, pos: number[], x: number, y: number, out: number[]): void {
  'worklet';
  let ax = level.wind ? level.wind.ax : 0;
  let ay = level.wind ? level.wind.ay : 0;
  const bodies = level.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const dx = pos[i * 2] - x;
    const dy = pos[i * 2 + 1] - y;
    const d2 = dx * dx + dy * dy + b.r * b.r * 0.35;
    const inv = (ENGINE.G * b.m) / (d2 * Math.sqrt(d2));
    ax += dx * inv;
    ay += dy * inv;
  }
  out[0] = ax;
  out[1] = ay;
}

/** Rayon mortel d'un corps : l'étoile grossit pendant une éruption. */
export function hitRadius(level: Level, index: number, t: number): number {
  'worklet';
  const b = level.bodies[index];
  return b.type === 'star' && level.flare && flarePhase(level, t) === 2 ? b.r * level.flare.scale : b.r;
}

/** Index du corps touché au point (x, y), ou -1. */
export function hitBody(level: Level, pos: number[], x: number, y: number, t = 0): number {
  'worklet';
  const bodies = level.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const dx = pos[i * 2] - x;
    const dy = pos[i * 2 + 1] - y;
    const r = hitRadius(level, i, t);
    if (dx * dx + dy * dy < r * r) return i;
  }
  return -1;
}

export function hitAsteroid(level: Level, x: number, y: number, t: number): boolean {
  'worklet';
  const list = level.asteroids;
  if (!list) return false;
  for (let i = 0; i < list.length; i++) {
    const p = asteroidAt(list[i], t);
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy < list[i].r * list[i].r) return true;
  }
  return false;
}

export function launchVector(level: Level, s: GameState): { vx: number; vy: number } {
  'worklet';
  return {
    vx: Math.cos(s.aimA) * s.aimP * level.maxDv,
    vy: Math.sin(s.aimA) * s.aimP * level.maxDv,
  };
}

/**
 * Trajectoire prévisionnelle, volontairement tronquée : elle enseigne
 * la courbure sans résoudre le tir. Elle s'allonge après chaque échec.
 * Le vent est pris en compte ; les astéroïdes et éruptions non (à anticiper).
 */
export function previewPath(level: Level, s: GameState): number[] {
  'worklet';
  const v = launchVector(level, s);
  let x = level.station.x;
  let y = level.station.y;
  let vx = v.vx;
  let vy = v.vy;
  let t = s.t;
  const pts: number[] = [x, y];
  const steps = ENGINE.PREVIEW_BASE + Math.min(s.attempts - 1, 7) * ENGINE.PREVIEW_ASSIST;
  const h = ENGINE.H * 2;
  const pos: number[] = [];
  const a = [0, 0];
  for (let i = 0; i < steps; i++) {
    positionsAt(level, t, pos);
    accel(level, pos, x, y, a);
    vx += a[0] * h;
    vy += a[1] * h;
    x += vx * h;
    y += vy * h;
    t += h;
    if (x < -14 || x > 114 || y < -14 || y > 114) break;
    // On n'enregistre qu'un point sur deux : le tracé reste lisse et deux fois plus léger.
    if (i % 2 === 1) pts.push(x, y);
    if (hitBody(level, pos, x, y) >= 0) {
      pts.push(x, y);
      break;
    }
  }
  return pts;
}

export type StepResult =
  | { kind: 'flying' }
  | { kind: 'ok'; index: number }
  | { kind: 'ko'; reason: string; x: number; y: number };

/**
 * Avance la sonde de `dt` secondes réelles (multipliées par `s.speed`).
 * Pas fixe ENGINE.H avec accumulateur : le vol dure la même durée à 60, 90 ou 120 Hz.
 */
export function stepProbe(level: Level, s: GameState, dt: number): StepResult {
  'worklet';
  const probe = s.probe;
  if (!probe) return { kind: 'flying' };
  s.acc += dt * s.speed;
  let steps = Math.floor(s.acc / ENGINE.H);
  s.acc -= steps * ENGINE.H;
  steps = Math.min(steps, ENGINE.SUB * 6);
  const pos: number[] = [];
  const a = [0, 0];
  const targets = allTargets(level);
  for (let i = 0; i < steps; i++) {
    positionsAt(level, s.t, pos);
    accel(level, pos, probe.x, probe.y, a);
    probe.vx += a[0] * ENGINE.H;
    probe.vy += a[1] * ENGINE.H;
    probe.x += probe.vx * ENGINE.H;
    probe.y += probe.vy * ENGINE.H;
    s.t += ENGINE.H;
    probe.age += ENGINE.H;

    for (let k = 0; k < targets.length; k++) {
      if (s.reached[k]) continue;
      const dxt = targets[k].x - probe.x;
      const dyt = targets[k].y - probe.y;
      const dist = Math.sqrt(dxt * dxt + dyt * dyt);
      const tr = targetRadius(level, s.attempts, k);
      if (dist - tr < probe.closest) probe.closest = dist - tr;
      if (dist < tr) return { kind: 'ok', index: k };
    }

    const hit = hitBody(level, pos, probe.x, probe.y, s.t);
    if (hit >= 0) {
      const star = level.bodies[hit].type === 'star';
      const flare = star && flarePhase(level, s.t) === 2 && Math.hypot(pos[hit * 2] - probe.x, pos[hit * 2 + 1] - probe.y) >= level.bodies[hit].r;
      return { kind: 'ko', reason: flare ? 'Caught in a solar flare' : star ? 'Lost in the star' : 'Collision', x: probe.x, y: probe.y };
    }
    if (hitAsteroid(level, probe.x, probe.y, s.t)) return { kind: 'ko', reason: 'Asteroid impact', x: probe.x, y: probe.y };
    if (probe.x < -16 || probe.x > 116 || probe.y < -16 || probe.y > 116) {
      return { kind: 'ko', reason: 'Lost in space', x: probe.x, y: probe.y };
    }
    if (probe.age > ENGINE.MAX_FLIGHT) return { kind: 'ko', reason: 'Fuel depleted', x: probe.x, y: probe.y };

    // Un point de traînée tous les 6 sous-pas, comme la version WebView (1 par image à 60 Hz),
    // quel que soit le taux de rafraîchissement de l'écran.
    probe.n += 1;
    if (probe.n % 6 === 0) {
      probe.trail.push(probe.x, probe.y);
      if (probe.trail.length > 840) probe.trail.splice(0, 2);
    }
  }
  return { kind: 'flying' };
}

/** Vrai si un tir raté est passé suffisamment près d'une balise pour mériter un « presque ». */
export function isNearMiss(level: Level, closest: number): boolean {
  'worklet';
  return closest < Math.max(2.4, level.target.r * 0.75);
}

/** Éclats lors d'un crash. */
export function spawnDebris(s: GameState, x: number, y: number, hue: string): void {
  'worklet';
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 6 + Math.random() * 16;
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.45, hue });
  }
}

export function stepParticles(s: GameState, dt: number): void {
  'worklet';
  if (s.particles.length === 0) return;
  const next: Particle[] = [];
  for (let i = 0; i < s.particles.length; i++) {
    const p = s.particles[i];
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    next.push(p);
  }
  s.particles = next;
}
