import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const directory = path.resolve('supabase/imports/nasa-planets-20260918');
try {
  await access(directory);
  throw new Error('Import audit directory already exists. Choose a new batch/date and output directory before generating another lot.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const batch = 'astralys_nasa_confirmed_planets_20260918';
const retrieved = new Date().toISOString();
const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!apiUrl || !key) throw new Error('Load .env.local using --env-file');
async function catalogue(query, method = 'GET') {
  const r = await fetch(`${apiUrl}/rest/v1/celestial_objects?${query}`, { method, headers: { apikey: key, Prefer: 'count=exact' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Catalogue HTTP ${r.status}`);
  return r;
}
const countResponse = await catalogue('select=id&object_type=eq.star', 'HEAD');
const starCount = Number(countResponse.headers.get('content-range')?.split('/').at(-1));
if (!Number.isInteger(starCount)) throw new Error('Cannot count catalogue stars');
const stars = [];
for (let offset = 0; offset < starCount; offset += 1000) {
  const r = await catalogue(`select=id,source_id,source_catalog,ra_deg,dec_deg,distance_ly&object_type=eq.star&order=id.asc&offset=${offset}&limit=1000`);
  stars.push(...await r.json());
}
if (stars.length !== starCount) throw new Error('Catalogue pagination mismatch');
const hostByGaia = new Map(stars.filter(s => s.source_catalog === 'GAIA_DR3').map(s => [s.source_id, s]));
const columns = ['pl_name', 'hostname', 'gaia_dr3_id', 'ra', 'dec', 'sy_dist', 'sy_gaiamag', 'pl_rade', 'pl_radelim', 'pl_bmasse', 'pl_bmasselim', 'pl_bmassprov', 'pl_orbper', 'pl_orbperlim', 'pl_orbsmax', 'pl_eqt', 'pl_eqtlim', 'disc_year', 'discoverymethod', 'disc_refname'];
const nasaUrl = new URL('https://exoplanetarchive.ipac.caltech.edu/TAP/sync');
const query = `select ${columns.join(',')} from pscomppars`;
nasaUrl.searchParams.set('query', query); nasaUrl.searchParams.set('format', 'json');
const response = await fetch(nasaUrl, { signal: AbortSignal.timeout(45000) });
if (!response.ok) throw new Error(`NASA HTTP ${response.status}: ${(await response.text()).slice(0, 2000)}`);
const sourceRows = await response.json();
if (!Array.isArray(sourceRows)) throw new Error('NASA response is not a planetary table');
const gaiaId = row => String(row.gaia_dr3_id ?? '').trim().split(/\s+/).at(-1);
const matched = [...new Map(sourceRows.filter(row => hostByGaia.has(gaiaId(row))).map(row => [row.pl_name, row])).values()];
if (matched.length !== 653) throw new Error(`Catalogue changed: review expected 653 planets, found ${matched.length}`);
const positive = value => value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const measured = (value, limit) => Number(limit ?? 0) === 0 ? positive(value) : null;
const stableSeed = name => { let h = 2166136261; for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 2147483647; };
const orbitOrders = new Map();
for (const id of new Set(matched.map(gaiaId))) {
  const ordered = matched.filter(row => gaiaId(row) === id && measured(row.pl_orbper, row.pl_orbperlim) !== null)
    .sort((a, b) => a.pl_orbper - b.pl_orbper || a.pl_name.localeCompare(b.pl_name));
  ordered.forEach((row, index) => orbitOrders.set(row.pl_name, index + 1));
}
const objects = matched.map(row => {
  const host = hostByGaia.get(gaiaId(row));
  const radius = measured(row.pl_rade, row.pl_radelim), bestMass = measured(row.pl_bmasse, row.pl_bmasselim), temperature = measured(row.pl_eqt, row.pl_eqtlim);
  // Best mass can be M*sin(i), a minimum, not a true mass. Keep that in raw_data only.
  const mass = row.pl_bmassprov === 'Mass' ? bestMass : null;
  const category = radius >= 4 || mass >= 30 ? 'gas' : temperature !== null && temperature >= 700 ? 'lava' : temperature !== null && temperature <= 200 ? 'ice' : 'rocky';
  const reference = row.disc_refname?.match(/href\s*=\s*['"]([^'"]+)/i)?.[1] ?? row.disc_refname?.replace(/<[^>]*>/g, '') ?? null;
  return { object_type: 'planet', source_catalog: 'NASA_EXOPLANET_ARCHIVE', source_id: row.pl_name, scientific_name: row.pl_name,
    host_object_id: host.id, host_name: row.hostname, ra_deg: row.ra ?? host.ra_deg, dec_deg: row.dec ?? host.dec_deg,
    distance_ly: positive(row.sy_dist) === null ? positive(host.distance_ly) : Number((row.sy_dist * 3.26156).toFixed(6)),
    // A planet's host-system magnitude is not its own apparent magnitude.
    apparent_magnitude: null, radius_earth: radius, mass_earth: mass, orbital_period_days: measured(row.pl_orbper, row.pl_orbperlim),
    equilibrium_temperature_k: temperature === null ? null : Math.round(temperature), discovery_year: row.disc_year ?? null,
    discovery_method: row.discoverymethod ?? null, discovery_reference: reference, visual_seed: stableSeed(row.pl_name), visual_category: category,
    source_updated_at: retrieved, raw_data: { ...row, import_batch: batch, discovery_status: 'confirmed', table: 'pscomppars',
      gaia_host_source_id: gaiaId(row), orbit_order: orbitOrders.get(row.pl_name) ?? null,
      retrieved_at: retrieved, sky_position_kind: 'host_system_direction', visual_is_interpretation: true,
      best_mass_is_minimum: row.pl_bmassprov === 'Msini' || row.pl_bmassprov === 'Msin(i)' } };
});
const quote = v => `'${String(v).replaceAll("'", "''")}'`;
const fields = Object.keys(objects[0]);
const sqlValue = (row, field) => row[field] === null ? 'NULL' : field === 'raw_data' ? `${quote(JSON.stringify(row[field]))}::jsonb` : typeof row[field] === 'string' ? quote(row[field]) : String(row[field]);
const statements = [];
for (let offset = 0; offset < objects.length; offset += 250) statements.push(`INSERT INTO public.celestial_objects (${fields.join(', ')})\nVALUES\n${objects.slice(offset, offset + 250).map(row => `(${fields.map(f => sqlValue(row, f)).join(', ')})`).join(',\n')}\nON CONFLICT (source_catalog, source_id) DO NOTHING;`);
const mapping = `INSERT INTO public.planetary_systems (star_id, data_status)
SELECT DISTINCT host_object_id, 'unknown' FROM public.celestial_objects WHERE raw_data->>'import_batch'='${batch}'
ON CONFLICT (star_id) DO NOTHING;

INSERT INTO public.planetary_system_planets (system_id, planet_id, orbit_order, discovery_status)
SELECT systems.id, planets.id, (planets.raw_data->>'orbit_order')::integer, 'confirmed'
FROM public.celestial_objects planets JOIN public.planetary_systems systems ON systems.star_id=planets.host_object_id
WHERE planets.raw_data->>'import_batch'='${batch}'
ON CONFLICT (planet_id) DO NOTHING;

UPDATE public.planetary_systems systems SET
  nasa_hostname = coalesce(systems.nasa_hostname, imported.hostname), source_name='NASA Exoplanet Archive', source_updated_at='${retrieved}'::timestamptz
FROM (SELECT host_object_id, min(host_name) AS hostname FROM public.celestial_objects WHERE raw_data->>'import_batch'='${batch}' GROUP BY host_object_id) imported
WHERE systems.star_id=imported.host_object_id;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.celestial_objects WHERE raw_data->>'import_batch'='${batch}') <> 653 OR
     (SELECT count(*) FROM public.planetary_system_planets mapping JOIN public.celestial_objects p ON p.id=mapping.planet_id WHERE p.raw_data->>'import_batch'='${batch}') <> 653 THEN
    RAISE EXCEPTION 'Expected 653 confirmed planets and 653 system mappings; rolled back';
  END IF;
END $$;`;
const summary = `SELECT count(*) AS imported_planets, count(DISTINCT host_object_id) AS host_stars FROM public.celestial_objects WHERE raw_data->>'import_batch'='${batch}';`;
const sql = `-- Astralys: confirmed NASA planets matched by exact Gaia DR3 host ID.\n-- No fictional planets and no replacement of existing stars/names.\n-- Source table: PSCompPars, one row per confirmed planet; composite metrics can have different references.\n-- Query: ${query}\nBEGIN;\n${statements.join('\n\n')}\n${mapping}\nCOMMIT;\n${summary}\n`;
const escapeCsv = v => { const s = v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
const csv = fields.join(',') + '\n' + objects.map(row => fields.map(f => escapeCsv(row[f])).join(',')).join('\n') + '\n';
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'astralys_653_planetes_confirmees.sql'), sql);
await writeFile(path.join(directory, 'astralys_653_planetes_confirmees.csv'), csv);
await writeFile(path.join(directory, 'payload.json'), JSON.stringify(objects));
await writeFile(path.join(directory, 'nasa-source.json'), JSON.stringify(sourceRows));
await writeFile(path.join(directory, 'hosts.json'), JSON.stringify(stars.filter(s => objects.some(p => p.host_object_id === s.id))));
const manifest = { retrieved_at: retrieved, batch, planets: objects.length, host_stars: new Set(objects.map(p => p.host_object_id)).size,
  catalogue_stars: stars.length, stars_without_matched_confirmed_planet: stars.length - new Set(objects.map(p => p.host_object_id)).size,
  source: nasaUrl.toString(), query, match_method: 'exact_gaia_dr3_identifier', sql_sha256: createHash('sha256').update(sql).digest('hex'),
  duplicates: objects.length - new Set(objects.map(p => p.source_id)).size, unknown_orbit_order: objects.filter(p => p.raw_data.orbit_order === null).length };
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ ...manifest, source: 'NASA Exoplanet Archive TAP', query: undefined, output: directory }, null, 2));
