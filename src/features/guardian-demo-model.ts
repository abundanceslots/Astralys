// All progression is fictional and in memory. Never send this state to Supabase.
export const demoPlanets = ['b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export type DemoPlanet = typeof demoPlanets[number];
export const nextDemoPlanet = (connected: readonly DemoPlanet[]) => demoPlanets.find(planet => !connected.includes(planet));
export const navigableDemoPlanets = (connected: readonly DemoPlanet[]) => demoPlanets.filter(planet => connected.includes(planet) || planet === nextDemoPlanet(connected));
export const explorationCosts: Readonly<Record<DemoPlanet, number>> = { b: 0, c: 0, d: 600, e: 1200, f: 2400, g: 4800, h: 9600 };
export const probeCost = (planet: DemoPlanet) => explorationCosts[planet];
export const maximumRelayLevel = 4;
export const energyPerHour = (level: number) => level * 10;
export const storageCapacity = (level: number) => level * 120;
export const upgradeCost = (level: number) => level === 2 ? 90 : 160;
export function nextRelayUpgrade(level: number, energy: number) {
  if (level >= maximumRelayLevel) return undefined;
  const cost = upgradeCost(level);
  return { title: level === 2 ? 'Solar arrays' : 'Deep-space antenna', level: level + 1, cost,
    production: energyPerHour(level + 1), capacity: storageCapacity(level + 1),
    missingEnergy: Math.max(0, cost - energy), affordable: energy >= cost };
}

export type GuardianDemoState = {
  energy: number;
  stored: number;
  relayLevel: number;
  connected: DemoPlanet[];
  observations: number;
  collectionId: number;
  lastCollected: number;
  message: string;
};
export type GuardianDemoAction =
  | { type: 'collect' }
  | { type: 'advance' }
  | { type: 'upgrade' }
  | { type: 'probe'; planet: DemoPlanet }
  | { type: 'reset' };

export function createGuardianDemo(): GuardianDemoState {
  return { energy: 80, stored: 120, relayLevel: 2, connected: ['b', 'c'],
    observations: 12, collectionId: 0, lastCollected: 0,
    message: 'Tap Collect energy to begin.' };
}

export function guardianDemoReducer(state: GuardianDemoState, action: GuardianDemoAction): GuardianDemoState {
  switch (action.type) {
    case 'reset': return createGuardianDemo();
    case 'collect':
      if (state.stored === 0) return state;
      return { ...state, energy: state.energy + state.stored, stored: 0,
        collectionId: state.collectionId + 1, lastCollected: state.stored,
        message: `${state.stored} energy collected.` };
    case 'advance': {
      const stored = Math.min(storageCapacity(state.relayLevel), state.stored + 6 * energyPerHour(state.relayLevel));
      return { ...state, stored, message: stored === state.stored ? 'Relay storage is full. Collect energy.' : '6 demo hours passed. Energy is ready.' };
    }
    case 'upgrade': {
      if (state.relayLevel >= maximumRelayLevel || state.energy < upgradeCost(state.relayLevel)) return state;
      return { ...state, energy: state.energy - upgradeCost(state.relayLevel), relayLevel: state.relayLevel + 1,
        message: `Relay upgraded to level ${state.relayLevel + 1}.` };
    }
    case 'probe':
      if (!demoPlanets.includes(action.planet) || action.planet !== nextDemoPlanet(state.connected) || state.energy < probeCost(action.planet)) return state;
      return { ...state, energy: state.energy - probeCost(action.planet), connected: [...state.connected, action.planet],
        observations: state.observations + 10, message: `Probe connected to TRAPPIST-1 ${action.planet}.` };
  }
}
