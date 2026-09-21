import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve(process.argv[2] ?? 'supabase/imports/gaia-9000-20260918');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const payload = JSON.parse(await readFile(path.join(directory, 'astralys_gaia_9000_payload.json'), 'utf8'));
const oldIds = JSON.parse(await readFile(path.join(directory, 'existing-catalogue-ids.json'), 'utf8'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Load the project .env.local');
async function request(query, method = 'GET') {
  const response = await fetch(`${url}/rest/v1/celestial_objects?${query}`, { method, headers: { apikey: key, Prefer: 'count=exact' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Public catalogue request failed: HTTP ${response.status}`);
  return response;
}
const totalResponse = await request('select=id&object_type=eq.star', 'HEAD');
const total = Number(totalResponse.headers.get('content-range')?.split('/').at(-1));
assert.equal(total, manifest.expected_stars, 'Global star count must match the import');
const records = [];
for (let offset = 0; offset < 9000; offset += 1000) {
  const response = await request(`select=*&object_type=eq.star&raw_data->>import_batch=eq.${manifest.batch}&order=id.asc&offset=${offset}&limit=1000`);
  assert.equal(Number(response.headers.get('content-range')?.split('/').at(-1)), 9000);
  records.push(...await response.json());
}
assert.equal(records.length, 9000);
assert.equal(new Set(records.map(row => row.source_id)).size, 9000);
const expected = new Map(payload.map(row => [row.source_id, row]));
const previous = new Set(oldIds.filter(row => row.source_catalog === 'GAIA_DR3').map(row => row.source_id));
for (const row of records) {
  const source = expected.get(row.source_id);
  assert.ok(source && !previous.has(row.source_id), 'New identifier must match the source and exclude previous stars');
  for (const field of ['object_type', 'source_catalog', 'scientific_name', 'visual_seed', 'visual_category', 'is_purchasable', 'catalog_release_date']) assert.equal(row[field], source[field], field);
  for (const field of ['ra_deg', 'dec_deg', 'distance_ly', 'apparent_magnitude']) assert.ok(Math.abs(Number(row[field]) - source[field]) < 1e-5, field);
  assert.deepEqual(row.raw_data, source.raw_data);
  assert.equal(row.discovery_year, null, 'Catalogue release must not become a fabricated discovery year');
}
// Confirm every previous Gaia record is still present through the app's public API.
let preserved = 0;
for (let offset = 0; offset < oldIds.length; offset += 100) {
  const ids = oldIds.slice(offset, offset + 100).map(row => row.source_id).join(',');
  const response = await request(`select=source_id&source_catalog=eq.GAIA_DR3&source_id=in.(${ids})`);
  preserved += (await response.json()).length;
}
assert.equal(preserved, oldIds.length);
const report = { verified_at: new Date().toISOString(), batch: manifest.batch, imported: records.length, total_stars: total,
  duplicates: 0, overlap_with_previous_stars: 0, previous_stars_preserved: preserved,
  matches_gaia_payload: true, accessible_to_app_public_key: true, individual_discovery_dates_fabricated: false };
await writeFile(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
