import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TAP_URL = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
const BATCH_NAME = 'gaia_nearby_bright_0101_1100';
const GAIA_RELEASE_DATE = '2022-06-13T00:00:00Z';
const existingCsvPath = process.argv[2];
const outputDirectory = process.argv[3];

if (!existingCsvPath || !outputDirectory) {
  throw new Error('Usage: node generate-gaia-import.mjs <existing-100.csv> <output-directory>');
}

const query = `SELECT TOP 1100
  source_id,
  ra,
  dec,
  parallax,
  phot_g_mean_mag,
  bp_rp
FROM gaiadr3.gaia_source_lite
WHERE parallax >= 10
  AND phot_g_mean_mag BETWEEN 1 AND 6
  AND ra IS NOT NULL
  AND dec IS NOT NULL
  AND bp_rp IS NOT NULL
ORDER BY phot_g_mean_mag ASC`;

function parseNumericCsv(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = headerLine.split(',');

  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function visualCategory(bpRp) {
  if (bpRp < 0.1) return 'blue';
  if (bpRp < 0.5) return 'blue-white';
  if (bpRp < 1) return 'white-yellow';
  if (bpRp < 1.5) return 'golden';
  return 'orange-red';
}

function sqlNumber(value, decimals) {
  return Number(value).toFixed(decimals);
}

function makeSqlRow(row) {
  const sourceId = row.source_id;
  const parallax = Number(row.parallax);
  const bpRp = Number(row.bp_rp);
  const distanceLy = 3261.56 / parallax;
  const visualSeed = BigInt(sourceId) % 2147483647n;
  const rawData = JSON.stringify({
    parallax_mas: parallax,
    bp_rp: bpRp,
    gaia_release: 'DR3',
    import_batch: BATCH_NAME,
  }).replaceAll("'", "''");

  return `  ('star', 'GAIA_DR3', '${sourceId}', 'Gaia DR3 ${sourceId}', ${sqlNumber(row.ra, 10)}, ${sqlNumber(row.dec, 10)}, ${distanceLy.toFixed(6)}, ${sqlNumber(row.phot_g_mean_mag, 6)}, ${visualSeed}, '${visualCategory(bpRp)}', true, '${GAIA_RELEASE_DATE}'::timestamptz, '${rawData}'::jsonb)`;
}

function makeInsert(rows) {
  return `insert into public.celestial_objects (
  object_type,
  source_catalog,
  source_id,
  scientific_name,
  ra_deg,
  dec_deg,
  distance_ly,
  apparent_magnitude,
  visual_seed,
  visual_category,
  is_purchasable,
  source_updated_at,
  raw_data
)
values
${rows.map(makeSqlRow).join(',\n')}
on conflict (source_catalog, source_id)
do update set
  scientific_name = excluded.scientific_name,
  ra_deg = excluded.ra_deg,
  dec_deg = excluded.dec_deg,
  distance_ly = excluded.distance_ly,
  apparent_magnitude = excluded.apparent_magnitude,
  visual_seed = excluded.visual_seed,
  visual_category = excluded.visual_category,
  is_purchasable = excluded.is_purchasable,
  source_updated_at = excluded.source_updated_at,
  raw_data = excluded.raw_data,
  updated_at = now();`;
}

const existingCsv = await readFile(existingCsvPath, 'utf8');
const existingIds = new Set(parseNumericCsv(existingCsv).map((row) => row.source_id));

const requestBody = new URLSearchParams({
  REQUEST: 'doQuery',
  LANG: 'ADQL',
  FORMAT: 'CSV',
  QUERY: query,
});
const response = await fetch(TAP_URL, { method: 'POST', body: requestBody });

if (!response.ok) {
  throw new Error(`Gaia TAP returned HTTP ${response.status}`);
}

const resultText = await response.text();
if (!resultText.startsWith('source_id,')) {
  throw new Error(`Unexpected Gaia TAP response: ${resultText.slice(0, 200)}`);
}

const rows = parseNumericCsv(resultText)
  .filter((row) => !existingIds.has(row.source_id))
  .slice(0, 1000);

if (rows.length !== 1000) {
  throw new Error(`Expected 1000 new stars, received ${rows.length}`);
}

const duplicateCount = rows.length - new Set(rows.map((row) => row.source_id)).size;
if (duplicateCount !== 0) {
  throw new Error(`The Gaia result contains ${duplicateCount} duplicate source identifiers`);
}

const csvHeader = [
  'object_type',
  'source_catalog',
  'source_id',
  'scientific_name',
  'ra_deg',
  'dec_deg',
  'distance_ly',
  'apparent_magnitude',
  'visual_seed',
  'visual_category',
  'is_purchasable',
  'source_updated_at',
  'parallax_mas',
  'bp_rp',
].join(',');
const csvRows = rows.map((row) => {
  const parallax = Number(row.parallax);
  return [
    'star',
    'GAIA_DR3',
    row.source_id,
    `Gaia DR3 ${row.source_id}`,
    sqlNumber(row.ra, 10),
    sqlNumber(row.dec, 10),
    (3261.56 / parallax).toFixed(6),
    sqlNumber(row.phot_g_mean_mag, 6),
    String(BigInt(row.source_id) % 2147483647n),
    visualCategory(Number(row.bp_rp)),
    'true',
    GAIA_RELEASE_DATE,
    row.parallax,
    row.bp_rp,
  ].join(',');
});

const chunks = [];
for (let index = 0; index < rows.length; index += 250) {
  chunks.push(makeInsert(rows.slice(index, index + 250)));
}

const sql = `-- Astrélys — 1 000 étoiles Gaia DR3 supplémentaires (étoiles 101 à 1 100)
-- Source : catalogue Gaia DR3, service TAP du centre partenaire ARI Heidelberg.
-- Généré le 15 septembre 2026 à partir de la requête ADQL documentée ci-dessous.
-- Sélection : parallaxe >= 10 mas, magnitude G entre 1 et 6, couleur BP-RP disponible.
-- Les 100 identifiants du premier lot sont exclus. Le script est réexécutable.
--
-- ${query.replaceAll('\n', '\n-- ')}

begin;

${chunks.join('\n\n')}

commit;

-- Contrôles : le premier résultat doit être 1000.
select count(*) as etoiles_du_nouveau_lot
from public.celestial_objects
where raw_data ->> 'import_batch' = '${BATCH_NAME}';

-- Si seuls les deux lots Astrélys ont été importés, le résultat total attendu est 1100.
select count(*) as total_etoiles_gaia
from public.celestial_objects
where source_catalog = 'GAIA_DR3';
`;

await writeFile(path.join(outputDirectory, 'astrelys_gaia_1000_etoiles_supplementaires.csv'), `${csvHeader}\n${csvRows.join('\n')}\n`, 'utf8');
await writeFile(path.join(outputDirectory, 'astrelys_gaia_1000_etoiles_supplementaires.sql'), sql, 'utf8');
await Promise.all(chunks.map((chunk, index) => writeFile(
  path.join(outputDirectory, `astrelys_gaia_lot_${index + 1}_sur_4.sql`),
  `-- Astrélys — lot ${index + 1}/4 : 250 étoiles Gaia DR3 supplémentaires\n-- Script réexécutable grâce à ON CONFLICT.\n\nbegin;\n\n${chunk}\n\ncommit;\n`,
  'utf8',
)));

console.log(JSON.stringify({
  rows: rows.length,
  firstSourceId: rows[0].source_id,
  lastSourceId: rows.at(-1).source_id,
  minimumMagnitude: Math.min(...rows.map((row) => Number(row.phot_g_mean_mag))),
  maximumMagnitude: Math.max(...rows.map((row) => Number(row.phot_g_mean_mag))),
  duplicateCount,
}, null, 2));
