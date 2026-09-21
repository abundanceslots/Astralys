const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-batch-secret',
};

const choices = {
  system_architecture: ['catalogue_layout', 'compact_rocky', 'balanced_mixed', 'wide_gas_giants', 'cold_sparse'],
  planet_visual_style: ['catalogue_based', 'rocky_mineral', 'ocean_cloud', 'frozen_ice', 'gas_banded', 'volcanic_dark'],
  rendering_focus: ['system_overview', 'planet_focus', 'star_focus', 'relay_network'],
  visual_mood: ['deep_violet', 'cold_cyan', 'solar_gold', 'dust_red', 'neutral_observatory'],
} as const;

type ChoiceKey = keyof typeof choices;
type ClaimedSystem = {
  system_id: string;
  visual_seed: number;
  source_fingerprint: string;
  source_snapshot: Record<string, unknown>;
};

const policy = [
  'You are the visual classification engine for Astralys, a mobile observatory based on real stars.',
  'Choose exactly one supplied preset for each question.',
  'Use only the supplied catalogue snapshot. Never invent planets, measurements, discoveries, or scientific certainty.',
  'catalogue_layout and catalogue_based have priority when measured planet data is available.',
  'For systems without confirmed planets, choices describe an explicitly artistic simulation and never a scientific claim.',
  'Keep the system readable on a mobile screen and prefer visual variety without exaggerating scientific meaning.',
].join(' ');

const questions = {
  system_architecture: {
    type: 'choice',
    instructions: 'Choose the most suitable orbital composition preset.',
    criteria: {
      catalogue_layout: 'Use when confirmed planets and orbit ordering provide enough real structure.',
      compact_rocky: 'A compact artistic layout dominated by small inner worlds.',
      balanced_mixed: 'A balanced artistic layout with readable variation and spacing.',
      wide_gas_giants: 'A wide artistic layout emphasizing large outer worlds.',
      cold_sparse: 'A sparse artistic layout suited to a cold or distant visual mood.',
    },
  },
  planet_visual_style: {
    type: 'choice',
    instructions: 'Choose the dominant procedural material family.',
    criteria: {
      catalogue_based: 'Use measured radius, mass, and temperature when available; unknown fields remain neutral.',
      rocky_mineral: 'Neutral mineral terrain for an artistic unconfirmed system.',
      ocean_cloud: 'Blue atmosphere and cloud direction, only as an artistic rendering preset.',
      frozen_ice: 'Cold cyan ice direction, only as an artistic rendering preset.',
      gas_banded: 'Banded gas direction for large-world composition.',
      volcanic_dark: 'Dark mineral and restrained magma accents for visual contrast.',
    },
  },
  rendering_focus: {
    type: 'choice',
    instructions: 'Choose the default camera and interface emphasis.',
    criteria: {
      system_overview: 'Show orbit relationships first.',
      planet_focus: 'Emphasize direct planet selection and inspection.',
      star_focus: 'Emphasize the real host star and its identity.',
      relay_network: 'Emphasize satellite links without hiding the astronomical system.',
    },
  },
  visual_mood: {
    type: 'choice',
    instructions: 'Choose a restrained Astralys color-lighting preset.',
    criteria: {
      deep_violet: 'Dark violet space with subtle warm highlights.',
      cold_cyan: 'Cold cyan lighting suited to restrained icy scenes.',
      solar_gold: 'Warm gold lighting centered on the host star.',
      dust_red: 'Muted red mineral accents with a dark background.',
      neutral_observatory: 'Scientific neutral palette with maximum label readability.',
    },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function supabaseRpc(url: string, key: string, name: string, body: unknown) {
  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function updateProfile(url: string, key: string, systemId: string, values: Record<string, unknown>) {
  return fetch(`${url}/rest/v1/system_visual_profiles?system_id=eq.${encodeURIComponent(systemId)}`, {
    method: 'PATCH',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  });
}

function parseAnswer(payload: Record<string, any>, key: ChoiceKey) {
  const answer = payload?.answers?.[key];
  const choice = answer?.choice;
  if (!choices[key].includes(choice)) throw new Error(`Invalid Jev choice for ${key}.`);
  return { choice, confidence: typeof answer.confidence === 'number' ? answer.confidence : 0, probabilities: answer.probabilities ?? {} };
}

async function classify(system: ClaimedSystem, typesafeKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${typesafeKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'jev-latest',
        state: JSON.stringify({ product: 'Astralys', policy, visualSeed: system.visual_seed, catalogue: system.source_snapshot }),
        questions,
      }),
    });
    if (!response.ok) throw new Error(`Jev returned ${response.status}.`);
    const payload = await response.json();
    const answers = Object.fromEntries((Object.keys(choices) as ChoiceKey[]).map(key => [key, parseAnswer(payload, key)]));
    return { payload, answers };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const batchSecret = Deno.env.get('JEV_BATCH_SECRET');
  if (!batchSecret || request.headers.get('x-batch-secret') !== batchSecret) return json({ error: 'Batch authorization required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const typesafeKey = Deno.env.get('TYPESAFE_API_KEY');
  if (!supabaseUrl || !serviceKey || !typesafeKey) return json({ error: 'Server configuration is incomplete.' }, 503);

  let batchSize = 20;
  try {
    const body = await request.json();
    if (Number.isFinite(body?.batchSize)) batchSize = Math.max(1, Math.min(25, Math.floor(body.batchSize)));
  } catch { /* Empty body uses the default size. */ }

  const claimResponse = await supabaseRpc(supabaseUrl, serviceKey, 'claim_system_visual_profile_batch', { p_limit: batchSize });
  if (!claimResponse.ok) return json({ error: 'Could not claim the next systems.' }, 502);
  const systems = await claimResponse.json() as ClaimedSystem[];

  const results = await Promise.all(systems.map(async system => {
    try {
      const { payload, answers } = await classify(system, typesafeKey);
      const now = new Date().toISOString();
      const update = await updateProfile(supabaseUrl, serviceKey, system.system_id, {
        status: 'complete',
        system_architecture: answers.system_architecture.choice,
        planet_visual_style: answers.planet_visual_style.choice,
        rendering_focus: answers.rendering_focus.choice,
        visual_mood: answers.visual_mood.choice,
        confidence: Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, value.confidence])),
        probabilities: Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, value.probabilities])),
        source_snapshot: system.source_snapshot,
        model_name: payload.model ?? 'jev-latest',
        model_version: payload.version ?? null,
        classified_at: now,
        claimed_at: null,
        last_error: null,
      });
      if (!update.ok) throw new Error(`Profile update returned ${update.status}.`);
      return { systemId: system.system_id, status: 'complete' };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown classification failure.';
      await updateProfile(supabaseUrl, serviceKey, system.system_id, {
        status: 'failed',
        claimed_at: null,
        last_error: message,
        next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      return { systemId: system.system_id, status: 'failed', error: message };
    }
  }));

  return json({ claimed: systems.length, complete: results.filter(item => item.status === 'complete').length, results });
});

