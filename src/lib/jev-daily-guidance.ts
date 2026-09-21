import { supabase } from '@/lib/supabase';

export type DailyGuidanceAction =
  | 'observe_now'
  | 'discover_planet'
  | 'upgrade_relay'
  | 'meet_guardian'
  | 'return_later';

export type DailyGuidanceState = {
  starName: string;
  isVisibleNow: boolean;
  nextVisibilityLabel: string | null;
  discoveredPlanets: number;
  totalPlanets: number;
  relayLevel: number;
  canUpgradeRelay: boolean;
  nearbyGuardianCount: number;
  daysSinceLastVisit: number;
};

export type DailyGuidance = {
  action: DailyGuidanceAction;
  title: string;
  message: string;
  confidence: number | null;
  source: 'jev' | 'fallback';
};

const actionCopy: Record<DailyGuidanceAction, (state: DailyGuidanceState) => Pick<DailyGuidance, 'title' | 'message'>> = {
  observe_now: (state) => ({
    title: 'Observe your star',
    message: `${state.starName} is visible now. Open Sky Finder and align the target.`,
  }),
  discover_planet: (state) => ({
    title: 'Continue the discovery',
    message: `${state.totalPlanets - state.discoveredPlanets} planetary signal${state.totalPlanets - state.discoveredPlanets === 1 ? '' : 's'} remain in this system.`,
  }),
  upgrade_relay: () => ({
    title: 'Improve the relay',
    message: 'Your next relay upgrade can extend the system scan.',
  }),
  meet_guardian: (state) => ({
    title: 'Nearby guardians',
    message: `${state.nearbyGuardianCount} nearby guardian${state.nearbyGuardianCount === 1 ? '' : 's'} can form a local alliance.`,
  }),
  return_later: (state) => ({
    title: 'Next observation',
    message: state.nextVisibilityLabel
      ? `${state.starName} will be easier to observe ${state.nextVisibilityLabel}.`
      : 'Return later for the next observation window.',
  }),
};

function fallbackAction(state: DailyGuidanceState): DailyGuidanceAction {
  if (state.isVisibleNow) return 'observe_now';
  if (state.discoveredPlanets < state.totalPlanets) return 'discover_planet';
  if (state.canUpgradeRelay) return 'upgrade_relay';
  if (state.nearbyGuardianCount > 0) return 'meet_guardian';
  return 'return_later';
}

function buildGuidance(
  action: DailyGuidanceAction,
  state: DailyGuidanceState,
  confidence: number | null,
  source: DailyGuidance['source'],
): DailyGuidance {
  return { action, ...actionCopy[action](state), confidence, source };
}

export function getFallbackDailyGuidance(state: DailyGuidanceState) {
  return buildGuidance(fallbackAction(state), state, null, 'fallback');
}

export async function getJevDailyGuidance(state: DailyGuidanceState): Promise<DailyGuidance> {
  const fallback = getFallbackDailyGuidance(state);

  try {
    const { data, error } = await supabase.functions.invoke('astralys-daily-guidance', {
      body: state,
    });
    if (error) return fallback;

    const action = data?.action as DailyGuidanceAction | undefined;
    const confidence = typeof data?.confidence === 'number' ? data.confidence : null;
    if (!action || !(action in actionCopy) || confidence === null || confidence < 0.35) return fallback;

    return buildGuidance(action, state, confidence, 'jev');
  } catch {
    return fallback;
  }
}
