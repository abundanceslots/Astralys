// Fictional exploration progress. Computed on the device, backed up to the account
// through save_guardian_progress (see lib/guardian-cloud.ts).
import { RUN_PACK_COUNT } from './orbital/run-levels';
export const demoPlanets = ['b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export type DemoPlanet = typeof demoPlanets[number];

export const signalIntervalMs = 4 * 60 * 60 * 1000;
export const nextDemoPlanet = (connected: readonly DemoPlanet[]) => demoPlanets.find(planet => !connected.includes(planet));
export const navigableDemoPlanets = (connected: readonly DemoPlanet[]) => demoPlanets.filter(planet => connected.includes(planet));
/* ------------------------------------------------------------------ */
/* Économie v2 — toutes les valeurs d'équilibrage sont ici.            */
/*                                                                    */
/* Cible (simulée) : un système complet en ~9-10 jours pour un joueur */
/* qui passe 3 fois par jour et joue ~10 niveaux d'Orbital Run par    */
/* visite, ~12 jours sans jouer. Les premières planètes tombent le    */
/* premier jour pour accrocher le joueur.                             */
/* ------------------------------------------------------------------ */
export const ECONOMY_VERSION = 2;
const HOUR = 60 * 60 * 1000;
/** Énergie de départ d'un nouveau système. */
export const startingEnergy = 450;
export const startingRelayLevel = 1;
export const maximumRelayLevel = 8;
/** Production de base par heure, par niveau de relais (index = niveau). */
const relayProduction = [0, 60, 110, 180, 270, 380, 510, 660, 830] as const;
/** Coût pour passer du niveau N au niveau N+1 (index = niveau actuel). */
const relayUpgradeCosts = [0, 150, 600, 1_800, 4_500, 10_000, 20_000, 36_000] as const;
const relayUpgradeTitles = ['', '', 'Solar arrays', 'Deep-space antenna', 'Twin solar wings', 'Plasma regulators', 'Quantum receivers', 'Interstellar dish', 'Stellar core link'] as const;
/** Chaque canal ouvert (toutes les 2 planètes) ajoute +25 % de production. */
export const channelBonus = 0.25;
/** Au-delà, le relais ne stocke plus : il faut revenir pour relancer la production. */
export const offlineCapMs = 8 * HOUR;

export const explorationCosts: Readonly<Record<DemoPlanet, number>> = { b: 0, c: 250, d: 1_200, e: 4_000, f: 11_000, g: 26_000, h: 55_000 };
export const probeTravelTimes: Readonly<Record<DemoPlanet, number>> = { b: 0, c: 5 * 60_000, d: 30 * 60_000, e: 2 * HOUR, f: 6 * HOUR, g: 10 * HOUR, h: 16 * HOUR };
/** Niveau de relais nécessaire pour envoyer une sonde vers chaque planète. */
export const planetRelayRequirements: Readonly<Record<DemoPlanet, number>> = { b: 1, c: 1, d: 2, e: 3, f: 4, g: 5, h: 6 };
export const probeCost = (planet: DemoPlanet) => explorationCosts[planet];
export const probeTravelTime = (planet: DemoPlanet) => probeTravelTimes[planet];
export const requiredRelayLevel = (planet: DemoPlanet) => planetRelayRequirements[planet];

export const relayChannelCount = (exploredPlanets: number) => Math.min(4, 1 + Math.floor(Math.max(0, exploredPlanets - 1) / 2));
export const nextChannelQuota = (exploredPlanets: number) => relayChannelCount(exploredPlanets) >= 4 ? null : relayChannelCount(exploredPlanets) * 2 + 1;
export const energyPerHour = (level: number, channels = 1) =>
  Math.round(relayProduction[Math.max(1, Math.min(maximumRelayLevel, level))] * (1 + channelBonus * (Math.max(1, channels) - 1)));
export const energyCycleMs = (level: number, channels = 1) => Math.round(HOUR / energyPerHour(level, channels));
export const upgradeCost = (level: number) => relayUpgradeCosts[Math.max(1, Math.min(maximumRelayLevel - 1, level))];
/* ---- Planètes : chaque monde exploré produit aussi, et s'améliore (niveaux 1 à 5) ---- */
export const maximumPlanetLevel = 5;
/** Production de base d'une planète au niveau 1 (⚡/h). La planète d'origine b produit peu. */
export const planetBaseYields: Readonly<Record<DemoPlanet, number>> = { b: 10, c: 15, d: 30, e: 50, f: 80, g: 120, h: 170 };
/** Chaque niveau ajoute +60 % de la production de base (niveau 5 = ×3,4). */
export const planetYield = (planet: DemoPlanet, level: number) =>
  level <= 0 ? 0 : Math.round(planetBaseYields[planet] * (1 + 0.6 * (Math.min(maximumPlanetLevel, level) - 1)));
const planetUpgradeFactors = [0, 0.4, 0.8, 1.5, 2.5] as const;
/** Coût pour passer une planète du niveau N au niveau N+1, proportionnel à son coût d'exploration. */
export const planetUpgradeCost = (planet: DemoPlanet, level: number) =>
  Math.round(Math.max(150, explorationCosts[planet]) * (planetUpgradeFactors[Math.max(1, Math.min(maximumPlanetLevel - 1, level))] ?? 0));
export const planetLevel = (state: Pick<GuardianDemoState, 'connected' | 'planetLevels'>, planet: DemoPlanet) =>
  state.connected.includes(planet) ? Math.max(1, Math.min(maximumPlanetLevel, state.planetLevels[planet] ?? 1)) : 0;
export const planetsEnergyPerHour = (state: Pick<GuardianDemoState, 'connected' | 'planetLevels'>) =>
  state.connected.reduce((sum, planet) => sum + planetYield(planet, planetLevel(state, planet)), 0);
/** Production totale : relais (avec ses canaux) + planètes explorées. */
export const stateEnergyPerHour = (state: Pick<GuardianDemoState, 'relayLevel' | 'connected' | 'planetLevels'>) =>
  energyPerHour(state.relayLevel, relayChannelCount(state.connected.length)) + planetsEnergyPerHour(state);

/* ---- Orbital Run : deux types d'épreuves, courtes et bien séparées ------------------ */
/*  · Épreuves d'avancement (« route ») : ouvertes seulement pendant le voyage d'une sonde. */
/*    Chaque niveau réussi rapproche la sonde ; la route entière divise le trajet par deux. */
/*  · Épreuves du jour : 3 niveaux par jour, remis à zéro à minuit, avec série de jours.   */
export const dayStamp = (now = Date.now()) => { const d = new Date(now); return d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const nextMidnight = (now = Date.now()) => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); };

/** Nombre de niveaux de la route vers chaque planète (courtes au début). */
export const routeLengths: Readonly<Record<DemoPlanet, number>> = { b: 0, c: 3, d: 3, e: 3, f: 4, g: 4, h: 4 };
/** La route complète raccourcit le trajet de moitié. */
export const routeTravelCut = 0.5;
export const routeLength = (planet: DemoPlanet) => routeLengths[planet];
/** Chapitre (mécanique) de la route : c → 1, d → 2 … h → 6. */
export const routeChapter = (planet: DemoPlanet) => Math.max(1, demoPlanets.indexOf(planet));
/** Chapitres débloqués : ceux des routes déjà ouvertes (sonde lancée ou arrivée). */
export const unlockedChapters = (state: Pick<GuardianDemoState, 'connected' | 'probeTarget'>) =>
  Math.max(1, Math.min(6, state.connected.length - 1 + (state.probeTarget ? 1 : 0)));
export const routeStage = (state: Pick<GuardianDemoState, 'probeTarget' | 'orbitalNextMission'>) =>
  state.probeTarget ? Math.min(state.orbitalNextMission, routeLength(state.probeTarget)) : 0;
export const routeComplete = (state: Pick<GuardianDemoState, 'probeTarget' | 'orbitalNextMission'>) =>
  Boolean(state.probeTarget) && routeStage(state) >= routeLength(state.probeTarget!);
/** Part du trajet gagnée par niveau de route. */
export const routeCutPerLevel = (planet: DemoPlanet) => routeTravelCut / Math.max(1, routeLength(planet));
export const routeMissionReward = (state: GuardianDemoState) => Math.max(1, Math.round(stateEnergyPerHour(state) * 0.15));

export const dailyTrialLength = 3;
export const dailyStageToday = (state: Pick<GuardianDemoState, 'dailyDay' | 'dailyStage'>, now = Date.now()) =>
  state.dailyDay === dayStamp(now) ? Math.min(dailyTrialLength, state.dailyStage) : 0;
export const dailyDone = (state: Pick<GuardianDemoState, 'dailyDay' | 'dailyStage'>, now = Date.now()) => dailyStageToday(state, now) >= dailyTrialLength;
export const msUntilNextDaily = (now = Date.now()) => nextMidnight(now) - now;
/** Série affichée : elle reste valable si la dernière journée complétée est hier ou aujourd'hui. */
export const dailyStreak = (state: Pick<GuardianDemoState, 'dailyStreak' | 'dailyLastCompleted'>, now = Date.now()) =>
  state.dailyLastCompleted === dayStamp(now) || state.dailyLastCompleted === dayStamp(now - 86_400_000) ? state.dailyStreak : 0;
/** Un niveau du jour ≈ 36 min de production (+15 % par niveau, +20 % au premier essai). */
export const dailyMissionReward = (state: GuardianDemoState, mission: number, attempts: number) =>
  Math.max(5, Math.round(stateEnergyPerHour(state) * 0.6 * (1 + Math.max(0, mission) * 0.15) * (attempts === 1 ? 1.2 : 1)));
/** Bonus de fin des épreuves du jour ≈ 1 h 12 de production. */
export const dailyCompletionBonus = (state: GuardianDemoState) => Math.round(stateEnergyPerHour(state) * 1.2);

/** Récompense d'un signal : ~30 à 55 min de production selon la découverte. */
export const signalReward = (state: GuardianDemoState, discovery: SignalDiscovery) => Math.round(stateEnergyPerHour(state) * discovery.reward / 140);

export type SignalDiscovery = {
  id: string;
  label: string;
  title: string;
  description: string;
  reward: number;
};

export const signalDiscoveries: readonly SignalDiscovery[] = [
  { id: 'transit-window', label: 'ORBITAL WINDOW', title: 'A transit path is becoming clear', description: 'The observatory has isolated a stable passage through the simulated system.', reward: 60 },
  { id: 'relay-echo', label: 'RELAY ECHO', title: 'A distant echo answered the satellite', description: 'The response adds a new fragment to the system atlas and strengthens the relay.', reward: 70 },
  { id: 'thermal-trace', label: 'THERMAL TRACE', title: 'A quiet thermal signature emerged', description: 'The signal reveals a region worth approaching with the next probe.', reward: 50 },
  { id: 'orbital-resonance', label: 'ORBITAL PATTERN', title: 'Several paths have aligned', description: 'The atlas records a repeating pattern inside the illustrative planetary system.', reward: 80 },
  { id: 'deep-space-pulse', label: 'DEEP-SPACE PULSE', title: 'The relay found a faint pulse', description: 'The new reading extends the mapped frontier beyond the current planets.', reward: 60 },
  { id: 'spectral-fragment', label: 'SPECTRAL FRAGMENT', title: 'A missing band of light was recovered', description: 'The fragment completes another part of your personal observation archive.', reward: 70 },
  { id: 'system-marker', label: 'SYSTEM MARKER', title: 'A new route is ready to explore', description: 'The completed sequence points the probe toward the next planetary frontier.', reward: 90 },
] as const;

export const signalDiscoveryAt = (index: number) => signalDiscoveries[Math.max(0, index) % signalDiscoveries.length];

export function nextRelayUpgrade(level: number, energy: number, channels = 1) {
  if (level >= maximumRelayLevel) return undefined;
  const cost = upgradeCost(level);
  return {
    title: relayUpgradeTitles[level + 1],
    level: level + 1,
    cost,
    production: energyPerHour(level + 1, channels),
    missingEnergy: Math.max(0, cost - energy),
    affordable: energy >= cost,
  };
}

/* ---- Événements de système : essaim de drones (menace) et passage de comète (bonus) ---- */
/*  · Au plus un événement à la fois par système, un toutes les ~10 à 18 h.                  */
/*  · Rien n'est jamais détruit : l'essaim ralentit la production, la comète se rate.        */
/*  · Ils se règlent avec de courts niveaux d'Orbital Run (jamais contre de l'argent).       */
export type SystemEventKind = 'drones' | 'comet';
export type SystemEvent = {
  kind: SystemEventKind;
  /** Numéro de l'événement dans ce système (sert aussi de graine pour les niveaux). */
  seq: number;
  startedAt: number;
  endsAt: number;
  /** Planète visée par l'essaim, ou d'où la comète est visible. */
  planet: DemoPlanet;
  /** Niveaux Orbital Run déjà réussis pour cet événement. */
  stage: number;
};
export const systemEventSpecs = {
  drones: { length: 3, durationMs: 12 * HOUR, drain: 0.2 },
  /** La comète se récolte d'un simple toucher dans la scène (pas de niveau). */
  comet: { length: 1, durationMs: 24 * HOUR, drain: 0 },
} as const satisfies Record<SystemEventKind, { length: number; durationMs: number; drain: number }>;
/** Premier événement : 2 h après la découverte de la 2e planète, puis 10 à 18 h entre deux. */
const FIRST_EVENT_DELAY = 2 * HOUR;
const eventRoll = (seq: number, salt: number) => {
  let h = Math.imul((seq + 1) ^ salt, 2654435761) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
const eventGap = (seq: number) => Math.round((10 + eventRoll(seq, 7) * 8) * HOUR);
export const systemEventLength = (event: Pick<SystemEvent, 'kind'>) => systemEventSpecs[event.kind].length;
/** Événement en cours (non expiré) à l'instant `now`. */
export const activeSystemEvent = (state: Pick<GuardianDemoState, 'event'>, now = Date.now()) =>
  state.event && now >= state.event.startedAt && now < state.event.endsAt ? state.event : null;
/** Énergie siphonnée par heure pendant l'essaim. */
export const droneDrainPerHour = (state: GuardianDemoState) => Math.round(stateEnergyPerHour(state) * systemEventSpecs.drones.drain);
/** Récompense d'un niveau d'événement, et bonus final (pièces de drones récupérées / glace de comète). */
export const systemEventLevelReward = (state: GuardianDemoState, kind: SystemEventKind) =>
  Math.max(5, Math.round(stateEnergyPerHour(state) * (kind === 'comet' ? 0.5 : 0.3)));
export const systemEventCompletionReward = (state: GuardianDemoState, kind: SystemEventKind) =>
  Math.max(20, Math.round(stateEnergyPerHour(state) * (kind === 'comet' ? 3 : 1.5)));

export type GuardianDemoState = {
  energy: number;
  relayLevel: number;
  connected: DemoPlanet[];
  observations: number;
  collectionId: number;
  lastCollected: number;
  message: string;
  lastSyncedAt: number;
  nextSignalAt: number;
  signalsAnalyzed: number;
  lastSignalId: string | null;
  probeTarget: DemoPlanet | null;
  probeStartedAt: number | null;
  probeReadyAt: number | null;
  probeBoostMs: number;
  orbitalNextMission: number;
  orbitalRunsCompleted: number;
  runIndex: number;
  runStage: number;
  runAttempts: number;
  runBestAttempts: number | null;
  /** Ancien mode Orbital Run (10 000 niveaux), conservé pour les sauvegardes. */
  runRewardDay: number;
  runRewardCount: number;
  /** Épreuves du jour : jour (AAAAMMJJ), niveaux réussis ce jour-là, série et dernier jour terminé. */
  dailyDay: number;
  dailyStage: number;
  dailyStreak: number;
  dailyLastCompleted: number;
  economyVersion: number;
  /** Niveau de chaque planète explorée (1 à 5 ; absente = 1). */
  planetLevels: Partial<Record<DemoPlanet, number>>;
  /** Événement en cours (essaim de drones, comète) et planification du suivant. */
  event: SystemEvent | null;
  nextEventAt: number;
  eventSeq: number;
  eventsCleared: number;
};

export type GuardianDemoAction =
  | { type: 'sync'; now?: number }
  | { type: 'analyze-signal'; now?: number }
  | { type: 'upgrade' }
  | { type: 'upgrade-planet'; planet: DemoPlanet }
  | { type: 'probe'; planet: DemoPlanet }
  | { type: 'orbital-mission'; mission: number; now?: number }
  | { type: 'daily-mission'; mission: number; attempts: number; now?: number }
  | { type: 'event-mission'; mission: number; now?: number }
  | { type: 'catch-comet'; now?: number }
  /** Développement uniquement (bouton affiché avec __DEV__) : déclenche ou efface un événement tout de suite. */
  | { type: 'debug-event'; kind: SystemEventKind | null; now?: number }
  | { type: 'reset'; now?: number };

export function createGuardianDemo(now = Date.now()): GuardianDemoState {
  return {
    energy: startingEnergy,
    relayLevel: startingRelayLevel,
    connected: ['b'],
    observations: 1,
    collectionId: 0,
    lastCollected: 0,
    message: 'A cosmic signal is ready to analyze.',
    lastSyncedAt: now,
    nextSignalAt: 0,
    signalsAnalyzed: 0,
    lastSignalId: null,
    probeTarget: null,
    probeStartedAt: null,
    probeReadyAt: null,
    probeBoostMs: 0,
    orbitalNextMission: 0,
    orbitalRunsCompleted: 0,
    runIndex: 0,
    runStage: 0,
    runAttempts: 0,
    runBestAttempts: null,
    runRewardDay: 0,
    runRewardCount: 0,
    dailyDay: 0,
    dailyStage: 0,
    dailyStreak: 0,
    dailyLastCompleted: 0,
    economyVersion: ECONOMY_VERSION,
    planetLevels: {},
    event: null,
    nextEventAt: 0,
    eventSeq: 0,
    eventsCleared: 0,
  };
}

/** Lance, fait expirer ou planifie les événements de système. */
function scheduleSystemEvents(state: GuardianDemoState, now: number): GuardianDemoState {
  // Pas d'événement tant que le système n'a qu'une planète.
  if (state.connected.length < 2) return state;
  if (!state.nextEventAt && !state.event) return { ...state, nextEventAt: now + FIRST_EVENT_DELAY };
  if (state.event && now >= state.event.endsAt) {
    const missed = state.event;
    return {
      ...state,
      event: null,
      nextEventAt: missed.endsAt + eventGap(missed.seq),
      message: missed.kind === 'drones' ? 'The drone swarm left on its own. Production is back to normal.' : 'The comet has left the system.',
    };
  }
  if (!state.event && state.nextEventAt && now >= state.nextEventAt) {
    const seq = state.eventSeq + 1;
    // Premier événement : toujours une comète (découverte positive). Ensuite ~55 % comètes, ~45 % essaims.
    const kind: SystemEventKind = seq === 1 || eventRoll(seq, 3) < 0.55 ? 'comet' : 'drones';
    // De retour après une longue absence : l'événement commence au plus 1 h avant le retour.
    const startedAt = Math.max(state.nextEventAt, now - HOUR);
    const producing = state.connected.filter(planet => planet !== 'b');
    const targets = producing.length ? producing : state.connected;
    const planet = targets[Math.floor(eventRoll(seq, 11) * targets.length) % targets.length];
    return {
      ...state,
      eventSeq: seq,
      event: { kind, seq, startedAt, endsAt: startedAt + systemEventSpecs[kind].durationMs, planet, stage: 0 },
      message: kind === 'drones' ? `A drone swarm is siphoning energy near planet ${planet}.` : 'A comet is crossing your system.',
    };
  }
  return state;
}

/** Temps (ms) pendant lequel l'essaim a siphonné l'énergie entre `from` et `to`. */
function droneOverlap(event: SystemEvent | null, from: number, to: number) {
  if (!event || event.kind !== 'drones') return 0;
  return Math.max(0, Math.min(to, event.endsAt) - Math.max(from, event.startedAt));
}

export function syncGuardianProgress(state: GuardianDemoState, now = Date.now()) {
  const safeNow = Math.max(now, state.lastSyncedAt);
  // Le relais ne produit que pendant `offlineCapMs` sans visite : au-delà, la production est perdue.
  if (safeNow - state.lastSyncedAt > offlineCapMs) state = { ...state, lastSyncedAt: safeNow - offlineCapMs };
  state = scheduleSystemEvents(state, safeNow);
  // Pendant un essaim de drones, une partie de la production est siphonnée (au prorata du temps).
  const span = safeNow - state.lastSyncedAt;
  const drained = span > 0 ? droneOverlap(state.event, state.lastSyncedAt, safeNow) / span * systemEventSpecs.drones.drain : 0;
  const production = Math.max(1, stateEnergyPerHour(state) * (1 - drained));
  const produced = Math.floor((safeNow - state.lastSyncedAt) * production / (60 * 60 * 1000));
  const consumedMs = produced > 0 ? Math.ceil(produced * 60 * 60 * 1000 / production) : 0;
  let nextState = produced > 0 ? {
      ...state,
      energy: state.energy + produced,
      lastSyncedAt: Math.min(safeNow, state.lastSyncedAt + consumedMs),
      collectionId: state.collectionId + 1,
      lastCollected: produced,
      message: `+${produced} energy produced.`,
    } : state;

  if (nextState.probeTarget && nextState.probeReadyAt && safeNow >= nextState.probeReadyAt) {
    const target = nextState.probeTarget;
    nextState = {
      ...nextState,
      connected: nextState.connected.includes(target) ? nextState.connected : [...nextState.connected, target],
      observations: nextState.observations + 10,
      probeTarget: null,
      probeStartedAt: null,
      probeReadyAt: null,
      probeBoostMs: 0,
      orbitalNextMission: 0,
      message: `Planet ${target} is now accessible.`,
    };
  }

  return scheduleSystemEvents(nextState, safeNow);
}

export function guardianDemoReducer(current: GuardianDemoState, action: GuardianDemoAction): GuardianDemoState {
  const state = action.type === 'sync' || action.type === 'analyze-signal' || action.type === 'orbital-mission' || action.type === 'daily-mission' || action.type === 'event-mission' || action.type === 'catch-comet'
    ? syncGuardianProgress(current, action.now)
    : current;

  switch (action.type) {
    case 'reset': return createGuardianDemo(action.now);
    case 'sync': return state;
    case 'analyze-signal': {
      const now = action.now ?? Date.now();
      if (now < state.nextSignalAt) return state;
      const discovery = signalDiscoveryAt(state.signalsAnalyzed);
      const reward = signalReward(state, discovery);
      return {
        ...state,
        energy: state.energy + reward,
        observations: state.observations + 1,
        signalsAnalyzed: state.signalsAnalyzed + 1,
        nextSignalAt: now + signalIntervalMs,
        lastSignalId: discovery.id,
        collectionId: state.collectionId + 1,
        lastCollected: reward,
        message: `${discovery.title}. +${reward} energy.`,
      };
    }
    case 'upgrade': {
      if (state.relayLevel >= maximumRelayLevel || state.energy < upgradeCost(state.relayLevel)) return state;
      return {
        ...state,
        energy: state.energy - upgradeCost(state.relayLevel),
        relayLevel: state.relayLevel + 1,
        message: `Relay upgraded to level ${state.relayLevel + 1}. Energy production increased.`,
      };
    }
    case 'upgrade-planet': {
      const level = planetLevel(state, action.planet);
      if (level < 1 || level >= maximumPlanetLevel) return state;
      const cost = planetUpgradeCost(action.planet, level);
      if (state.energy < cost) return state;
      return {
        ...state,
        energy: state.energy - cost,
        planetLevels: { ...state.planetLevels, [action.planet]: level + 1 },
        message: `Planet ${action.planet} reached level ${level + 1}.`,
      };
    }
    case 'orbital-mission': {
      // Épreuve d'avancement : un niveau de la route vers la planète visée.
      const now = action.now ?? Date.now();
      const target = state.probeTarget;
      if (!target || !Number.isInteger(action.mission) || action.mission !== routeStage(state) || action.mission >= routeLength(target)) return state;
      const complete = action.mission === routeLength(target) - 1;
      const reward = routeMissionReward(state);
      const travel = probeTravelTime(target);
      const boost = state.probeReadyAt ? Math.min(Math.ceil(travel * routeCutPerLevel(target)), Math.max(0, state.probeReadyAt - now)) : 0;
      const rewarded = {
        ...state,
        energy: state.energy + reward,
        orbitalNextMission: action.mission + 1,
        orbitalRunsCompleted: state.orbitalRunsCompleted + (complete ? 1 : 0),
        probeReadyAt: state.probeReadyAt === null ? null : state.probeReadyAt - boost,
        probeBoostMs: state.probeBoostMs + boost,
        message: complete ? `Route complete. The probe is on its final approach.` : `Route level cleared. +${reward} energy · probe ${Math.ceil(boost / 60_000)} min closer.`,
      };
      return syncGuardianProgress(rewarded, now);
    }
    case 'daily-mission': {
      const now = action.now ?? Date.now();
      const today = dayStamp(now);
      const stage = dailyStageToday(state, now);
      if (!Number.isInteger(action.mission) || !Number.isInteger(action.attempts) || action.attempts < 1 || action.mission !== stage || stage >= dailyTrialLength) return state;
      const finished = action.mission === dailyTrialLength - 1;
      const reward = dailyMissionReward(state, action.mission, action.attempts) + (finished ? dailyCompletionBonus(state) : 0);
      const streak = finished ? dailyStreak(state, now) + (state.dailyLastCompleted === today ? 0 : 1) : state.dailyStreak;
      return {
        ...state,
        energy: state.energy + reward,
        dailyDay: today,
        dailyStage: stage + 1,
        dailyStreak: streak,
        dailyLastCompleted: finished ? today : state.dailyLastCompleted,
        message: finished ? `Daily trials complete. +${reward} energy · ${streak}-day streak.` : `Daily level cleared. +${reward} energy.`,
      };
    }
    case 'debug-event': {
      const now = action.now ?? Date.now();
      if (!action.kind) return { ...state, event: null, nextEventAt: now + eventGap(state.eventSeq) };
      const seq = state.eventSeq + 1;
      const producing = state.connected.filter(planet => planet !== 'b');
      const planet = (producing.length ? producing : state.connected)[0];
      return {
        ...state,
        eventSeq: seq,
        event: { kind: action.kind, seq, startedAt: now, endsAt: now + systemEventSpecs[action.kind].durationMs, planet, stage: 0 },
        message: action.kind === 'drones' ? `A drone swarm is siphoning energy near planet ${planet}.` : 'A comet is crossing your system.',
      };
    }
    case 'catch-comet': {
      const now = action.now ?? Date.now();
      const event = activeSystemEvent(state, now);
      if (!event || event.kind !== 'comet') return state;
      const reward = systemEventCompletionReward(state, 'comet');
      return {
        ...state,
        energy: state.energy + reward,
        event: null,
        eventsCleared: state.eventsCleared + 1,
        nextEventAt: now + eventGap(event.seq),
        collectionId: state.collectionId + 1,
        lastCollected: reward,
        message: `Comet captured. Its ice brings +${reward} energy.`,
      };
    }
    case 'event-mission': {
      // Un niveau Orbital Run de l'événement en cours (défense contre l'essaim, capture de la comète).
      const now = action.now ?? Date.now();
      const event = activeSystemEvent(state, now);
      if (!event || event.kind !== 'drones' || !Number.isInteger(action.mission) || action.mission !== event.stage || event.stage >= systemEventLength(event)) return state;
      const finished = action.mission === systemEventLength(event) - 1;
      const reward = systemEventLevelReward(state, event.kind) + (finished ? systemEventCompletionReward(state, event.kind) : 0);
      if (!finished) {
        return { ...state, energy: state.energy + reward, event: { ...event, stage: event.stage + 1 }, message: `Event level cleared. +${reward} energy.` };
      }
      return {
        ...state,
        energy: state.energy + reward,
        event: null,
        eventsCleared: state.eventsCleared + 1,
        nextEventAt: now + eventGap(event.seq),
        message: event.kind === 'drones' ? `Drone swarm repelled. Salvaged parts: +${reward} energy.` : `Comet captured. Its ice brings +${reward} energy.`,
      };
    }
    case 'probe': {
      if (state.probeTarget || !demoPlanets.includes(action.planet) || action.planet !== nextDemoPlanet(state.connected) || state.energy < probeCost(action.planet) || state.relayLevel < requiredRelayLevel(action.planet)) return state;
      const probeStartedAt = Date.now();
      return {
        ...state,
        energy: state.energy - probeCost(action.planet),
        probeTarget: action.planet,
        probeStartedAt,
        probeReadyAt: probeStartedAt + probeTravelTime(action.planet),
        probeBoostMs: 0,
        orbitalNextMission: 0,
        message: `Probe launched toward planet ${action.planet}.`,
      };
    }
  }
}

export function restoreGuardianDemo(value: unknown, now = Date.now()): GuardianDemoState {
  if (!value || typeof value !== 'object') return createGuardianDemo(now);
  const candidate = value as Partial<GuardianDemoState>;
  const base = createGuardianDemo(now);
  const restoredConnected = Array.isArray(candidate.connected)
    ? demoPlanets.filter(planet => candidate.connected?.includes(planet))
    : base.connected;
  const firstLockedIndex = demoPlanets.findIndex(planet => !restoredConnected.includes(planet));
  const connected = firstLockedIndex < 0 ? [...demoPlanets] : demoPlanets.slice(0, firstLockedIndex);
  const restored: GuardianDemoState = {
    energy: typeof candidate.energy === 'number' && candidate.energy >= 0 ? Math.floor(candidate.energy) : base.energy,
    relayLevel: typeof candidate.relayLevel === 'number' ? Math.max(1, Math.min(maximumRelayLevel, Math.floor(candidate.relayLevel))) : base.relayLevel,
    connected: connected.length ? connected : base.connected,
    observations: typeof candidate.observations === 'number' && candidate.observations >= 0 ? Math.floor(candidate.observations) : base.observations,
    collectionId: typeof candidate.collectionId === 'number' && candidate.collectionId >= 0 ? Math.floor(candidate.collectionId) : 0,
    lastCollected: 0,
    message: typeof candidate.message === 'string' ? candidate.message : base.message,
    lastSyncedAt: typeof candidate.lastSyncedAt === 'number' && candidate.lastSyncedAt > 0 ? candidate.lastSyncedAt : now,
    nextSignalAt: typeof candidate.nextSignalAt === 'number' && candidate.nextSignalAt > 0 ? candidate.nextSignalAt : 0,
    signalsAnalyzed: typeof candidate.signalsAnalyzed === 'number' && candidate.signalsAnalyzed >= 0 ? Math.floor(candidate.signalsAnalyzed) : 0,
    lastSignalId: typeof candidate.lastSignalId === 'string' ? candidate.lastSignalId : null,
    probeTarget: candidate.probeTarget && demoPlanets.includes(candidate.probeTarget) && !connected.includes(candidate.probeTarget) ? candidate.probeTarget : null,
    probeStartedAt: typeof candidate.probeStartedAt === 'number' && candidate.probeStartedAt > 0 ? candidate.probeStartedAt : null,
    probeReadyAt: typeof candidate.probeReadyAt === 'number' && candidate.probeReadyAt > 0 ? candidate.probeReadyAt : null,
    probeBoostMs: typeof candidate.probeBoostMs === 'number' && candidate.probeBoostMs >= 0 ? Math.floor(candidate.probeBoostMs) : 0,
    orbitalNextMission: typeof candidate.orbitalNextMission === 'number' && Number.isInteger(candidate.orbitalNextMission) && candidate.orbitalNextMission >= 0 && candidate.orbitalNextMission <= 4 ? candidate.orbitalNextMission : 0,
    orbitalRunsCompleted: typeof candidate.orbitalRunsCompleted === 'number' && candidate.orbitalRunsCompleted >= 0 ? Math.floor(candidate.orbitalRunsCompleted) : 0,
    runIndex: typeof candidate.runIndex === 'number' && Number.isInteger(candidate.runIndex) && candidate.runIndex >= 0 ? Math.min(RUN_PACK_COUNT, candidate.runIndex) : 0,
    runStage: typeof candidate.runStage === 'number' && Number.isInteger(candidate.runStage) && candidate.runStage >= 0 && candidate.runStage < 5 && candidate.runIndex !== RUN_PACK_COUNT ? candidate.runStage : 0,
    runAttempts: typeof candidate.runAttempts === 'number' && Number.isInteger(candidate.runAttempts) && candidate.runAttempts >= 0 ? candidate.runAttempts : 0,
    runBestAttempts: typeof candidate.runBestAttempts === 'number' && Number.isInteger(candidate.runBestAttempts) && candidate.runBestAttempts > 0 ? candidate.runBestAttempts : null,
    runRewardDay: typeof candidate.runRewardDay === 'number' && Number.isInteger(candidate.runRewardDay) ? candidate.runRewardDay : 0,
    runRewardCount: typeof candidate.runRewardCount === 'number' && Number.isInteger(candidate.runRewardCount) && candidate.runRewardCount >= 0 ? candidate.runRewardCount : 0,
    dailyDay: typeof candidate.dailyDay === 'number' && Number.isInteger(candidate.dailyDay) ? candidate.dailyDay : 0,
    dailyStage: typeof candidate.dailyStage === 'number' && Number.isInteger(candidate.dailyStage) ? Math.max(0, Math.min(dailyTrialLength, candidate.dailyStage)) : 0,
    dailyStreak: typeof candidate.dailyStreak === 'number' && Number.isInteger(candidate.dailyStreak) && candidate.dailyStreak >= 0 ? candidate.dailyStreak : 0,
    dailyLastCompleted: typeof candidate.dailyLastCompleted === 'number' && Number.isInteger(candidate.dailyLastCompleted) ? candidate.dailyLastCompleted : 0,
    economyVersion: ECONOMY_VERSION,
    planetLevels: Object.fromEntries(
      connected.map(planet => {
        const raw = (candidate.planetLevels as Record<string, unknown> | undefined)?.[planet];
        return [planet, typeof raw === 'number' && Number.isFinite(raw) ? Math.max(1, Math.min(maximumPlanetLevel, Math.floor(raw))) : 1];
      }),
    ) as Partial<Record<DemoPlanet, number>>,
    event: restoreSystemEvent(candidate.event, connected),
    nextEventAt: typeof candidate.nextEventAt === 'number' && candidate.nextEventAt > 0 ? candidate.nextEventAt : 0,
    eventSeq: typeof candidate.eventSeq === 'number' && Number.isInteger(candidate.eventSeq) && candidate.eventSeq >= 0 ? candidate.eventSeq : 0,
    eventsCleared: typeof candidate.eventsCleared === 'number' && Number.isInteger(candidate.eventsCleared) && candidate.eventsCleared >= 0 ? candidate.eventsCleared : 0,
  };
  // Migration depuis l'ancienne économie (≈ 10× plus généreuse) : planètes et niveau de relais
  // sont conservés, l'énergie accumulée est plafonnée pour ne pas tout débloquer d'un coup.
  if (candidate.economyVersion !== ECONOMY_VERSION) {
    restored.energy = Math.min(restored.energy, 2_000);
    restored.lastSyncedAt = now;
    restored.message = 'The relay was recalibrated. Your planets and upgrades are kept.';
  }
  if (!restored.probeTarget) {
    restored.probeStartedAt = null;
    restored.probeReadyAt = null;
    restored.probeBoostMs = 0;
    restored.orbitalNextMission = 0;
  }
  if (restored.runIndex === RUN_PACK_COUNT) restored.runStage = 0;
  return syncGuardianProgress(restored, now);
}

function restoreSystemEvent(value: unknown, connected: readonly DemoPlanet[]): SystemEvent | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as Partial<SystemEvent>;
  if ((e.kind !== 'drones' && e.kind !== 'comet') || typeof e.startedAt !== 'number' || typeof e.endsAt !== 'number' || e.endsAt <= e.startedAt) return null;
  if (!e.planet || !connected.includes(e.planet)) return null;
  const length = systemEventSpecs[e.kind].length;
  return {
    kind: e.kind,
    seq: typeof e.seq === 'number' && Number.isInteger(e.seq) && e.seq > 0 ? e.seq : 1,
    startedAt: e.startedAt,
    endsAt: Math.min(e.endsAt, e.startedAt + systemEventSpecs[e.kind].durationMs),
    planet: e.planet,
    stage: typeof e.stage === 'number' && Number.isInteger(e.stage) ? Math.max(0, Math.min(length - 1, e.stage)) : 0,
  };
}
