const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const actions = [
  'observe_now',
  'discover_planet',
  'upgrade_relay',
  'meet_guardian',
  'return_later',
] as const;

type DailyAction = typeof actions[number];

type DailyState = {
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

const astralysDecisionPolicy = [
  'You are the decision engine for Astralys, a mobile observatory built around real stars and planetary systems.',
  'Your role is to select one useful next action from the options supplied by the application; you do not write prose or invent new actions.',
  'Prioritize a real observation opportunity when the selected star is currently visible.',
  'Otherwise prefer meaningful discovery inside the selected system, then an available relay improvement, then a nearby social connection.',
  'Choose return_later when the required conditions for every other action are false or when waiting for the next visibility window is more useful.',
  'Never invent astronomical facts, planets, visibility, resources, upgrades, guardians, purchases, rewards, urgency, or availability.',
  'Never select an action whose required condition is false.',
  'Avoid manipulative engagement: the recommendation must help the user understand, observe, or revisit a real celestial object.',
].join(' ');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseState(value: unknown): DailyState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Record<string, unknown>;
  if (
    typeof state.starName !== 'string'
    || state.starName.length < 1
    || state.starName.length > 120
    || typeof state.isVisibleNow !== 'boolean'
    || !(state.nextVisibilityLabel === null || typeof state.nextVisibilityLabel === 'string')
    || !isFiniteNumber(state.discoveredPlanets)
    || !isFiniteNumber(state.totalPlanets)
    || !isFiniteNumber(state.relayLevel)
    || typeof state.canUpgradeRelay !== 'boolean'
    || !isFiniteNumber(state.nearbyGuardianCount)
    || !isFiniteNumber(state.daysSinceLastVisit)
  ) return null;

  return {
    starName: state.starName.slice(0, 120),
    isVisibleNow: state.isVisibleNow,
    nextVisibilityLabel: typeof state.nextVisibilityLabel === 'string'
      ? state.nextVisibilityLabel.slice(0, 120)
      : null,
    discoveredPlanets: Math.max(0, Math.floor(state.discoveredPlanets)),
    totalPlanets: Math.max(0, Math.floor(state.totalPlanets)),
    relayLevel: Math.max(0, Math.floor(state.relayLevel)),
    canUpgradeRelay: state.canUpgradeRelay,
    nearbyGuardianCount: Math.max(0, Math.floor(state.nearbyGuardianCount)),
    daysSinceLastVisit: Math.max(0, Math.floor(state.daysSinceLastVisit)),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!request.headers.get('Authorization')?.startsWith('Bearer ')) {
    return json({ error: 'Authentication required.' }, 401);
  }

  const apiKey = Deno.env.get('TYPESAFE_API_KEY');
  if (!apiKey) return json({ error: 'Jev is not configured.' }, 503);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const state = parseState(input);
  if (!state) return json({ error: 'Invalid Astralys state.' }, 400);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'jev-latest',
        state: JSON.stringify({
          product: 'Astralys',
          policy: astralysDecisionPolicy,
          guardian: state,
        }),
        questions: {
          daily_action: {
            type: 'choice',
            instructions: 'Apply the Astralys policy to choose the single best next action supported by the guardian state.',
            criteria: {
              observe_now: 'Valid only when isVisibleNow is true. This has highest priority because it is a time-sensitive real observation.',
              discover_planet: 'Valid only when discoveredPlanets is lower than totalPlanets. Use when no observation is available now.',
              upgrade_relay: 'Valid only when canUpgradeRelay is true. Use when no immediate observation or undiscovered planet has priority.',
              meet_guardian: 'Valid only when nearbyGuardianCount is greater than zero. Use when no astronomical or system-progress action is more useful.',
              return_later: 'The safe choice when all other actions are invalid, or when nextVisibilityLabel identifies a better observation time.',
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      return json({ error: 'Jev request failed.', requestId }, 502);
    }

    const payload = await response.json();
    const answer = payload?.answers?.daily_action;
    const action = answer?.choice as DailyAction | undefined;
    if (!action || !actions.includes(action)) return json({ error: 'Unexpected Jev response.' }, 502);

    return json({
      action,
      confidence: typeof answer.confidence === 'number' ? answer.confidence : 0,
      probabilities: answer.probabilities ?? {},
      model: payload.model ?? 'jev-latest',
    });
  } catch (error) {
    return json({ error: error instanceof Error && error.name === 'AbortError' ? 'Jev timed out.' : 'Jev is unavailable.' }, 504);
  } finally {
    clearTimeout(timeout);
  }
});
