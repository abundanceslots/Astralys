import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const output = path.resolve(process.argv[2] ?? 'supabase/imports/gaia-9000-20260918');
const endpoint = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
const batch = 'astralys_gaia_9000_20260918';
const release = '2022-06-13T00:00:00Z';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Load the project .env.local with node --env-file=.env.local');
const api = async (query, options = {}) => {
  const response = await fetch(`${url}/rest/v1/celestial_objects?${query}`, { ...options, headers: { apikey: key, Prefer: 'count=exact', ...options.headers }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Catalogue read failed: HTTP ${response.status}`);
  return response;
};
const totalResponse = await api('select=id&object_type=eq.star', { method: 'HEAD' });
const previousBatch = await api(`select=id&raw_data->>import_batch=eq.${batch}`, { method: 'HEAD' });
if (Number(previousBatch.headers.get('content-range')?.split('/').at(-1)) > 0) throw new Error('This batch is already imported or in progress. Reuse its existing SQL files; do not regenerate different stars under the same batch identifier.');
const total = Number(totalResponse.headers.get('content-range')?.split('/').at(-1));
if (!Number.isInteger(total)) throw new Error('Cannot establish initial catalogue size');
const existing = [];
for (let offset = 0; offset < total; offset += 1000) {
  const response = await api(`select=id,source_catalog,source_id,catalog_release_date&object_type=eq.star&order=id.asc&offset=${offset}&limit=1000`);
  existing.push(...await response.json());
}
if (existing.length !== total) throw new Error('Catalogue pagination did not return the expected star count');
const known = new Set(existing.filter(row => row.source_catalog === 'GAIA_DR3').map(row => row.source_id));
console.log(`Existing stars: ${total}; Gaia identifiers excluded: ${known.size}`);
const query = `SELECT TOP ${Math.max(20000, known.size + 9000)}
  source_id, ra, dec, parallax, phot_g_mean_mag, bp_rp,
  parallax_error, parallax_over_error, ruwe
FROM gaiadr3.gaia_source
WHERE parallax >= 10
  AND phot_g_mean_mag BETWEEN 1 AND 12
  AND ra IS NOT NULL AND dec IS NOT NULL AND bp_rp IS NOT NULL
  AND parallax_over_error >= 10 AND ruwe < 1.4
  AND duplicated_source = 'false'
ORDER BY phot_g_mean_mag ASC, source_id ASC`;
const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'CSV', QUERY: query }), signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Gaia TAP failed: HTTP ${response.status}`);
const raw = await response.text();
const lines = raw.trim().split(/\r?\n/), headers = lines.shift().split(',').map(v => v.replaceAll('"', ''));
if (headers[0] !== 'source_id') throw new Error(`Invalid Gaia response: ${raw.slice(0, 160)}`);
const records = lines.map(line => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value.replaceAll('"', '')])));
const seen = new Set();
const selected = records.filter(row => {
  if (!/^\d+$/.test(row.source_id) || known.has(row.source_id) || seen.has(row.source_id)) return false;
  for (const field of headers.filter(v => v !== 'source_id')) if (row[field] === '' || !Number.isFinite(Number(row[field]))) return false;
  if (Number(row.ra) < 0 || Number(row.ra) >= 360 || Math.abs(Number(row.dec)) > 90 || Number(row.parallax) < 10) return false;
  seen.add(row.source_id); return true;
}).slice(0, 9000);
if (selected.length !== 9000) throw new Error(`Expected 9000 new stars; found ${selected.length}`);
const category = color => color < 0.1 ? 'blue' : color < 0.5 ? 'blue-white' : color < 1 ? 'white-yellow' : color < 1.5 ? 'golden' : 'orange-red';
const data = selected.map(row => ({
  object_type: 'star', source_catalog: 'GAIA_DR3', source_id: row.source_id,
  scientific_name: `Gaia DR3 ${row.source_id}`, ra_deg: Number(row.ra), dec_deg: Number(row.dec),
  distance_ly: Number((3261.56 / Number(row.parallax)).toFixed(6)), apparent_magnitude: Number(row.phot_g_mean_mag),
  visual_seed: Number(BigInt(row.source_id) % 2147483647n), visual_category: category(Number(row.bp_rp)),
  is_purchasable: true, source_updated_at: release, catalog_release_date: '2022-06-13',
  raw_data: { parallax_mas: Number(row.parallax), bp_rp: Number(row.bp_rp), parallax_error_mas: Number(row.parallax_error),
    parallax_over_error: Number(row.parallax_over_error), ruwe: Number(row.ruwe), gaia_release: 'DR3', import_batch: batch,
    distance_method: 'inverse_parallax', distance_is_estimate: true },
}));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const columns = Object.keys(data[0]);
const value = (item, column) => column === 'raw_data' ? `${quote(JSON.stringify(item[column]))}::jsonb` :
  typeof item[column] === 'string' ? quote(item[column]) : String(item[column]);
const insert = rows => `INSERT INTO public.celestial_objects (${columns.join(', ')})\nVALUES\n${rows.map(item => `(${columns.map(column => value(item, column)).join(', ')})`).join(',\n')}\nON CONFLICT (source_catalog, source_id) DO NOTHING;`;
const chunks = Array.from({ length: 36 }, (_, index) => insert(data.slice(index * 250, (index + 1) * 250)));
const note = `-- Astralys: 9000 additional real Gaia DR3 stars.\n-- Existing public catalogue: ${total} stars; expected after first import: ${total + 9000}.\n-- Existing rows/names are preserved; repeat execution skips conflicts.\n-- G<=12 includes stars not visible to the naked eye. Distances are inverse-parallax estimates.\n-- Catalogue release is NOT an individual discovery date.\n-- Source: ${endpoint}\n-- ${query.replaceAll('\n', '\n-- ')}\n`;
const check = `DO $$ BEGIN\n  IF (SELECT count(*) FROM public.celestial_objects WHERE raw_data->>'import_batch' = '${batch}') <> 9000 THEN\n    RAISE EXCEPTION 'Import incomplete: expected 9000 rows in this batch; transaction rolled back';\n  END IF;\nEND $$;`;
const summaryQuery = `SELECT count(*) FILTER (WHERE raw_data->>'import_batch'='${batch}') AS added_batch, count(*) AS total_stars FROM public.celestial_objects WHERE object_type='star';`;
const sql = `${note}\nBEGIN;\n${chunks.join('\n\n')}\n${check}\nCOMMIT;\n${summaryQuery}\n`;
const csvColumns = ['object_type', 'source_catalog', 'source_id', 'scientific_name', 'ra_deg', 'dec_deg', 'distance_ly', 'apparent_magnitude', 'visual_seed', 'visual_category', 'is_purchasable', 'source_updated_at', 'parallax_mas', 'bp_rp'];
const csv = csvColumns.join(',') + '\n' + data.map(item => csvColumns.map(column => column === 'parallax_mas' || column === 'bp_rp' ? item.raw_data[column] : item[column]).join(',')).join('\n') + '\n';
await mkdir(path.join(output, 'lots'), { recursive: true });
await writeFile(path.join(output, 'astralys_gaia_9000_etoiles_supplementaires.sql'), sql);
await writeFile(path.join(output, 'astralys_gaia_9000_etoiles_supplementaires.csv'), csv);
await writeFile(path.join(output, 'astralys_gaia_9000_payload.json'), JSON.stringify(data));
await writeFile(path.join(output, 'existing-catalogue-ids.json'), JSON.stringify(existing.map(({ source_catalog, source_id }) => ({ source_catalog, source_id }))));
await writeFile(path.join(output, 'gaia-source.csv'), raw);
await Promise.all(chunks.map((chunk, index) => writeFile(path.join(output, 'lots', `lot_${String(index + 1).padStart(2, '0')}_sur_36.sql`), `${note}\nBEGIN;\n${chunk}\nCOMMIT;\n`)));
await mkdir(path.join(output, 'application'), { recursive: true });
await Promise.all(Array.from({ length: 9 }, (_, index) => writeFile(path.join(output, 'application', `import_${index + 1}_sur_9.sql`),
  `${note}\n-- Application batch ${index + 1}/9: 1000 stars.\nBEGIN;\n${chunks.slice(index * 4, (index + 1) * 4).join('\n\n')}\nCOMMIT;\n${summaryQuery}\n`)));
const manifest = { generated_at: new Date().toISOString(), rows: data.length, initial_stars: total, expected_stars: total + data.length,
  duplicates: data.length - new Set(data.map(row => row.source_id)).size, overlaps: data.filter(row => known.has(row.source_id)).length,
  batch, source: endpoint, query, sql_sha256: createHash('sha256').update(sql).digest('hex'),
  magnitude_range: [Math.min(...data.map(row => row.apparent_magnitude)), Math.max(...data.map(row => row.apparent_magnitude))],
  distance_ly_range: [Math.min(...data.map(row => row.distance_ly)), Math.max(...data.map(row => row.distance_ly))],
  visual_categories: Object.fromEntries([...new Set(data.map(row => row.visual_category))].map(c => [c, data.filter(row => row.visual_category === c).length])) };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
// Re-read saved deliverables, ensuring no identifier was coerced into a lossy JS Number.
const saved = JSON.parse(await readFile(path.join(output, 'astralys_gaia_9000_payload.json'), 'utf8'));
if (saved.length !== 9000 || saved.some((row, index) => row.source_id !== selected[index].source_id)) throw new Error('Saved catalogue failed validation');
console.log(JSON.stringify({ ...manifest, query: undefined, output }, null, 2));
