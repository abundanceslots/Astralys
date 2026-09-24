import { LEVELS, type Level, type Vec } from './levels';

export const RUN_LEVEL_COUNT = 10_000;
export const RUN_PACK_SIZE = LEVELS.length;
export const RUN_PACK_COUNT = RUN_LEVEL_COUNT / RUN_PACK_SIZE;
const tierNames = ['Cadet', 'Navigator', 'Pilot', 'Commander', 'Ace'] as const;
const directions = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2] as const;
const planetColors = ['#7E9BC4', '#C48A6E', '#6E9C86', '#9A7EC4', '#C4A96E'] as const;

/* ------------------------------------------------------------------ */
/* Chapitres : chacun ajoute une mécanique. Les bornes sont des        */
/* multiples de 5 : un paquet de 5 niveaux ne chevauche jamais deux     */
/* chapitres.                                                           */
/* ------------------------------------------------------------------ */
export type RunChapter = { number: number; name: string; firstLevel: number; lastLevel: number; rule: string };

export const RUN_CHAPTERS: readonly RunChapter[] = [
  { number: 1, name: 'First Light', firstLevel: 1, lastLevel: 150, rule: 'Bend your path around gravity to reach the beacon.' },
  { number: 2, name: 'Constellation', firstLevel: 151, lastLevel: 800, rule: 'Several beacons: reach them all. One satellite per beacon, plus one spare.' },
  { number: 3, name: 'Solar Storm', firstLevel: 801, lastLevel: 2_500, rule: 'The star flares regularly. Launch between eruptions.' },
  { number: 4, name: 'Asteroid Drift', firstLevel: 2_501, lastLevel: 5_000, rule: 'Asteroids cross the system. Time your launch to slip between them.' },
  { number: 5, name: 'Ion Winds', firstLevel: 5_001, lastLevel: 7_500, rule: 'A steady wind pushes every satellite. Aim against it.' },
  { number: 6, name: 'Deep Frontier', firstLevel: 7_501, lastLevel: RUN_LEVEL_COUNT, rule: 'Everything at once: beacons, flares, asteroids and wind.' },
] as const;

export function chapterForLevel(levelNumber: number): RunChapter {
  return RUN_CHAPTERS.find(c => levelNumber >= c.firstLevel && levelNumber <= c.lastLevel) ?? RUN_CHAPTERS[RUN_CHAPTERS.length - 1];
}

function random(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function transform(point: Vec, angle: number, scale: number): Vec {
  const dx = point.x - 50;
  const dy = point.y - 50;
  const cos = Math.round(Math.cos(angle));
  const sin = Math.round(Math.sin(angle));
  return { x: 50 + (dx * cos - dy * sin) * scale, y: 50 + (dx * sin + dy * cos) * scale };
}

export function runLevelNumber(runIndex: number, stage: number) {
  return Math.min(RUN_LEVEL_COUNT, Math.max(1, runIndex * RUN_PACK_SIZE + stage + 1));
}

export function runDifficulty(levelNumber: number) {
  const progress = Math.min(1, Math.max(0, (levelNumber - 1) / (RUN_LEVEL_COUNT - 1)));
  return tierNames[Math.min(tierNames.length - 1, Math.floor(progress * tierNames.length))];
}

/**
 * Balises supplémentaires, placées sur un anneau extérieur (hors des orbites),
 * à distance de la station et de la balise principale.
 */
function extraTargets(count: number, primary: Vec & { r: number }, station: Vec, roll: () => number): (Vec & { r: number })[] {
  const out: (Vec & { r: number })[] = [];
  const base = Math.atan2(primary.y - 50, primary.x - 50);
  for (let attempt = 0; out.length < count && attempt < 40; attempt++) {
    const angle = base + (roll() < 0.5 ? -1 : 1) * (1.1 + roll() * 1.5);
    const radius = 39 + roll() * 6;
    const p = { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, r: primary.r };
    const far = (q: Vec, d: number) => Math.hypot(p.x - q.x, p.y - q.y) > d;
    if (p.x < 6 || p.x > 94 || p.y < 6 || p.y > 94) continue;
    if (!far(station, 22) || !far(primary, 16) || out.some(q => !far(q, 16))) continue;
    out.push(p);
  }
  return out;
}

function makeAsteroids(count: number, progress: number, roll: () => number) {
  return Array.from({ length: count }, () => {
    const horizontal = roll() < 0.5;
    const speed = (8 + roll() * 6 + progress * 6) * (roll() < 0.5 ? -1 : 1);
    const lane = 22 + roll() * 56;
    return horizontal
      ? { x: roll() * 100, y: lane, vx: speed, vy: 0, r: 1.8 + roll() * 0.8 }
      : { x: lane, y: roll() * 100, vx: 0, vy: speed, r: 1.8 + roll() * 0.8 };
  });
}

/** Five deterministic sectors are built on demand; no 10,000-level payload is loaded. */
export function createRunLevels(runIndex: number): Level[] {
  if (!Number.isInteger(runIndex) || runIndex < 0 || runIndex >= RUN_PACK_COUNT) return [];
  const roll = random((runIndex + 1) * 0x9e3779b1);
  return LEVELS.map((template, stage) => {
    const index = runIndex * RUN_PACK_SIZE + stage;
    const levelNumber = index + 1;
    const chapter = chapterForLevel(levelNumber);
    const progress = index / (RUN_LEVEL_COUNT - 1);
    const angle = directions[Math.floor(roll() * directions.length)];
    const scale = 0.93 + roll() * 0.14;
    const targetAngle = (roll() - 0.5) * progress * 0.36;
    const satelliteCount = index < 5 ? 0 : index < 750 ? 1 : index < 3_500 ? 2 : 3;
    const satellites = Array.from({ length: satelliteCount }, (_, slot) => ({
      type: 'satellite' as const,
      orbit: {
        r: [17, 25, 31][slot] * scale,
        speed: (slot % 2 ? -1 : 1) * (0.75 + 2.45 * progress + slot * 0.24),
        phase: (index * 2.399963229728653 + slot * 2.1 + angle) % (Math.PI * 2),
      },
      r: (slot === 0 ? 1.8 : 1.45) * scale,
      m: (slot === 0 ? 300 : 190) * scale ** 3,
      hue: '#C8BAF5',
    }));
    const station = transform(template.station, angle, scale);
    const target = { ...transform(template.target, angle + targetAngle, scale), r: template.target.r * scale * (1 - progress * 0.18) };
    const level: Level = {
      ...template,
      sequence: levelNumber,
      total: RUN_LEVEL_COUNT,
      chapter: chapter.number,
      name: template.name,
      // Le premier niveau d'un chapitre explique sa nouvelle règle.
      brief: levelNumber === chapter.firstLevel ? chapter.rule : template.brief,
      station,
      maxDv: template.maxDv * scale,
      target,
      bodies: [
        ...template.bodies.map(body => body.orbit
          ? { ...body, r: body.r * scale, m: body.m * scale ** 3, orbit: { ...body.orbit, r: body.orbit.r * scale, phase: body.orbit.phase + angle }, hue: body.type === 'planet' ? planetColors[Math.floor(roll() * planetColors.length)] : body.hue }
          : { ...body, ...transform({ x: body.x ?? 50, y: body.y ?? 50 }, angle, scale), r: body.r * scale, m: body.m * scale ** 3, hue: body.type === 'planet' ? planetColors[Math.floor(roll() * planetColors.length)] : body.hue }),
        ...satellites,
      ],
    };

    const n = chapter.number;
    // Chapitres 2 et 6 : plusieurs balises (2, puis 3 plus loin dans le chapitre).
    if (n === 2 || n === 6) {
      const extra = n === 2 ? (levelNumber > 500 ? 2 : 1) : (roll() < 0.5 ? 1 : 2);
      const targets = extraTargets(extra, target, station, roll);
      if (targets.length > 0) {
        level.targets = targets;
        level.probes = targets.length + 2;
        level.maxDv = level.maxDv * 1.1;
      }
    }
    // Chapitres 3 et 6 : éruptions solaires (plus fréquentes avec la progression).
    if (n === 3 || (n === 6 && roll() < 0.6)) {
      const period = 6.5 - progress * 1.8 + roll() * 0.8;
      level.flare = { period, duration: 1.4 + roll() * 0.6, scale: 2.4 + roll() * 0.6 };
    }
    // Chapitres 4 et 6 : astéroïdes.
    if (n === 4 || (n === 6 && roll() < 0.6)) {
      level.asteroids = makeAsteroids(n === 4 ? 2 + Math.floor(roll() * 2 + progress * 2) : 2, progress, roll);
    }
    // Chapitres 5 et 6 : vent ionique.
    if (n === 5 || (n === 6 && roll() < 0.5)) {
      const windAngle = roll() * Math.PI * 2;
      const strength = 1.5 + roll() * 1.5 + progress * 1.5;
      level.wind = { ax: Math.cos(windAngle) * strength, ay: Math.sin(windAngle) * strength };
    }
    return level;
  });
}

/* ------------------------------------------------------------------ */
/* Épreuves courtes construites à partir des chapitres.                 */
/* ------------------------------------------------------------------ */
const firstPackOf = (chapter: RunChapter) => Math.floor((chapter.firstLevel - 1) / RUN_PACK_SIZE);
/** Niveaux numérotés 1..n dans le HUD (pas de numéro sur 10 000). */
const standalone = (levels: Level[]) => levels.map(level => ({ ...level, sequence: undefined, total: undefined }));

/** Épreuve d'avancement : les premiers niveaux du chapitre (le premier explique la règle). */
export function createRouteLevels(chapterNumber: number, length: number): Level[] {
  const chapter = RUN_CHAPTERS[Math.max(1, Math.min(RUN_CHAPTERS.length, chapterNumber)) - 1];
  return standalone(createRunLevels(firstPackOf(chapter)).slice(0, Math.max(1, Math.min(RUN_PACK_SIZE, length))));
}

/** Épreuves du jour : même tirage pour tout le monde un jour donné, parmi les chapitres débloqués. */
export function createDailyLevels(day: number, unlocked: number, length: number): { chapter: RunChapter; levels: Level[] } {
  const roll = random((day * 2654435761) >>> 0);
  const max = Math.max(1, Math.min(RUN_CHAPTERS.length, unlocked));
  // Le dernier chapitre débloqué revient plus souvent, pour s'entraîner à sa mécanique.
  const chapterNumber = roll() < 0.55 ? max : 1 + Math.floor(roll() * max);
  const chapter = RUN_CHAPTERS[chapterNumber - 1];
  const packs = Math.max(1, Math.floor((chapter.lastLevel - chapter.firstLevel + 1) / RUN_PACK_SIZE) - 1);
  const pack = firstPackOf(chapter) + 1 + Math.floor(roll() * Math.min(packs, 12));
  const levels = createRunLevels(pack).slice(0, Math.max(1, Math.min(RUN_PACK_SIZE, length)));
  return { chapter, levels: standalone(levels.map((level, i) => (i === 0 ? { ...level, brief: chapter.rule } : level))) };
}
