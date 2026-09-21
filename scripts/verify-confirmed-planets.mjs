import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve('supabase/imports/nasa-planets-20260918');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const expected = JSON.parse(await readFile(path.join(directory, 'payload.json'), 'utf8'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
async function request(table, query) {
  const r = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: { apikey: key, Prefer: 'count=exact' }, signal: AbortSignal.timeout(30000) });
  assert.ok(r.ok, `${table} HTTP ${r.status}`);
  return { count: Number(r.headers.get('content-range')?.split('/').at(-1)), rows: await r.json() };
}
const planets = await request('celestial_objects', `select=*&object_type=eq.planet&raw_data->>import_batch=eq.${manifest.batch}&limit=1000`);
assert.equal(planets.count, 653); assert.equal(planets.rows.length, 653);
assert.equal(new Set(planets.rows.map(p => p.source_id)).size, 653);
assert.equal(new Set(planets.rows.map(p => p.host_object_id)).size, 435);
for (const row of planets.rows) {
  const source = expected.find(p => p.source_id === row.source_id);
  assert.ok(source);
  for (const [field, value] of Object.entries(source)) {
    if (typeof value === 'number') assert.ok(Math.abs(Number(row[field]) - value) < 1e-5, field);
    else if (field === 'source_updated_at') assert.equal(new Date(row[field]).getTime(), new Date(value).getTime(), field);
    else if (field !== 'source_updated_at') assert.deepEqual(row[field], value, field);
  }
}
const mapping = await request('planetary_system_planets', 'select=*&limit=1000');
assert.equal(mapping.count, 653); assert.equal(new Set(mapping.rows.map(p => p.planet_id)).size, 653);
const systems = await request('planetary_systems', 'select=*&confirmed_planet_count=gt.0&limit=1000');
assert.equal(systems.count, 435);
assert.equal(systems.rows.reduce((sum, system) => sum + system.confirmed_planet_count, 0), 653);
for (const system of systems.rows) {
  const attached = planets.rows.filter(p => p.host_object_id === system.star_id);
  assert.equal(attached.length, system.confirmed_planet_count);
  assert.equal(system.data_status, 'confirmed');
  assert.equal(mapping.rows.filter(p => p.system_id === system.id).length, attached.length);
}
// Check the exact star-detail query used by the app against a known six-planet host.
const example = planets.rows.find(p => p.host_name === 'HD 219134');
assert.ok(example);
const children = await request('celestial_objects', `select=*&object_type=eq.planet&host_object_id=eq.${example.host_object_id}&order=orbital_period_days.asc.nullslast,scientific_name.asc&limit=100`);
assert.equal(children.count, 6);
const unknown = await request('planetary_systems', 'select=star_id,data_status&confirmed_planet_count=eq.0&limit=1');
assert.equal(unknown.count, 9665); assert.equal(unknown.rows[0].data_status, 'unknown');
const incorrectlyClassified = await request('planetary_systems', 'select=star_id&confirmed_planet_count=eq.0&data_status=neq.unknown&limit=1');
assert.equal(incorrectlyClassified.count, 0);
const stars = await request('celestial_objects', 'select=id&object_type=eq.star&limit=1');
assert.equal(stars.count, 10100);
const report = { verified_at: new Date().toISOString(), imported_planets: 653, linked_host_stars: 435, system_mappings: 653,
  catalogue_stars: stars.count, no_matched_confirmed_planets: unknown.count, science_status_for_unmatched: 'unknown',
  duplicates: 0, public_app_access: true, source_data_verified: true, six_planet_example: 'HD 219134',
  simulated_planets_added_to_scientific_catalogue: 0 };
await writeFile(path.join(directory, 'verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
