import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

const outputDirectory = path.resolve(
  process.argv[2] ?? 'supabase/exports/public-20260921',
);
const apiUrl = new URL('/rest/v1/', supabaseUrl);
const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Accept-Profile': 'public',
};

const knownPublicTables = [
  'base_level_rules',
  'celestial_objects',
  'guardian_observatory_progress',
  'guardian_planets',
  'guardian_resource_ledger',
  'guardian_satellites',
  'guardian_systems',
  'interstellar_connection_rules',
  'interstellar_connections',
  'observatory_instrument_rules',
  'observatory_satellites',
  'planet_colonies',
  'planet_unlock_rules',
  'planetary_system_planets',
  'planetary_systems',
  'profiles',
  'satellite_level_rules',
  'stellar_alliance_contributions',
  'stellar_alliance_invitations',
  'stellar_alliance_members',
  'stellar_alliance_missions',
  'stellar_alliances',
  'stellar_neighbors',
  'stellar_network_links',
  'system_visual_profiles',
];

async function fetchJson(url, requestHeaders = {}) {
  const response = await fetch(url, {
    headers: { ...headers, ...requestHeaders },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }

  return { response, data: await response.json() };
}

async function exportTable(tableName) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  let exactTotal = null;

  while (true) {
    const tableUrl = new URL(encodeURIComponent(tableName), apiUrl);
    tableUrl.searchParams.set('select', '*');

    const { response, data } = await fetchJson(tableUrl, {
      Prefer: 'count=exact',
      Range: `${offset}-${offset + pageSize - 1}`,
      'Range-Unit': 'items',
    });

    if (!Array.isArray(data)) {
      throw new Error(`Unexpected response for public.${tableName}.`);
    }

    const contentRange = response.headers.get('content-range');
    const totalText = contentRange?.split('/')[1];
    if (totalText && totalText !== '*') exactTotal = Number(totalText);

    rows.push(...data);
    offset += data.length;

    if (
      data.length < pageSize ||
      data.length === 0 ||
      (Number.isFinite(exactTotal) && offset >= exactTotal)
    ) {
      break;
    }
  }

  await writeFile(
    path.join(outputDirectory, `${tableName}.json`),
    `${JSON.stringify(rows, null, 2)}\n`,
    'utf8',
  );

  return rows.length;
}

await mkdir(outputDirectory, { recursive: true });

let tableNames = knownPublicTables;
let discovery = 'known project tables';

try {
  const { data: openApi } = await fetchJson(apiUrl, {
    Accept: 'application/openapi+json',
  });
  await writeFile(
    path.join(outputDirectory, 'openapi.json'),
    `${JSON.stringify(openApi, null, 2)}\n`,
    'utf8',
  );

  tableNames = Object.entries(openApi.paths ?? {})
    .filter(([route, operations]) => {
      return route.startsWith('/') && !route.startsWith('/rpc/') && operations?.get;
    })
    .map(([route]) => decodeURIComponent(route.slice(1)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  discovery = 'PostgREST OpenAPI';
} catch {
  console.warn('OpenAPI discovery unavailable; using the known project tables.');
}

const tables = [];
for (const tableName of tableNames) {
  try {
    const rowCount = await exportTable(tableName);
    tables.push({ table: tableName, rowCount, status: 'exported' });
    console.log(`public.${tableName}: ${rowCount} rows`);
  } catch (error) {
    tables.push({
      table: tableName,
      rowCount: null,
      status: 'not_exported',
      reason: error instanceof Error ? error.message : String(error),
    });
    console.warn(`public.${tableName}: not exported`);
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  projectRef: new URL(supabaseUrl).hostname.split('.')[0],
  schema: 'public',
  access: 'anonymous application access with Row Level Security applied',
  discovery,
  tables,
};

await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Export written to ${outputDirectory}`);
