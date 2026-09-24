/**
 * Astralys — vérifie les systèmes de TOUTES les étoiles du catalogue.
 *
 * Utilise l'export public Supabase (supabase/exports/<dernier dossier>/) : étoiles, planètes
 * confirmées, liens système-planète et profils visuels Jev. Pour chaque étoile :
 *   1. construit son système (src/features/system-definition.ts) ;
 *   2. vérifie les règles (tailles, orbites sans chevauchement, cadrage, valeurs finies) ;
 *   3. vérifie que le résultat est identique d'un appel à l'autre (déterminisme) ;
 *   4. vérifie que chaque planète confirmée apparaît avec son vrai nom ;
 * puis mesure la diversité et vérifie que l'économie (identique pour tous) se termine dans le temps visé.
 *
 * Lancer :  node scripts/check-system-variety.cjs
 * Options : --export <dossier>   --limit <n>   --show <n> (affiche n systèmes en détail)
 * Code de sortie 1 si au moins un système enfreint une règle.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);

/* ---- chargement des modules TypeScript de l'app (sans bundler) ---- */
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  cache.set(file, module.exports);
  const context = { module, exports: module.exports, Float32Array, Math, Number, Object, Array, JSON, Date, console,
    require: name => load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : `${name}.ts`)) };
  vm.runInNewContext(output, context, { filename: file });
  cache.set(file, module.exports);
  return module.exports;
}
const systems = load(path.join(root, 'src/features/system-definition.ts'));
const model = load(path.join(root, 'src/features/guardian-demo-model.ts'));

/* ---- données ---- */
const exportsDir = path.join(root, 'supabase/exports');
const exportDir = args.get('--export') ?? path.join(exportsDir, fs.readdirSync(exportsDir).filter(n => n.startsWith('public-')).sort().pop());
const read = name => { const data = JSON.parse(fs.readFileSync(path.join(exportDir, `${name}.json`), 'utf8')); return Array.isArray(data) ? data : data.rows; };
const objects = read('celestial_objects');
const planetarySystems = read('planetary_systems');
const links = read('planetary_system_planets');
const profiles = read('system_visual_profiles');

const stars = objects.filter(o => o.object_type === 'star');
const planetsByHost = new Map();
for (const p of objects.filter(o => o.object_type === 'planet')) {
  if (!planetsByHost.has(p.host_object_id)) planetsByHost.set(p.host_object_id, []);
  planetsByHost.get(p.host_object_id).push(p);
}
const systemByStar = new Map(planetarySystems.map(s => [s.star_id, s]));
const orderByPlanet = new Map(links.map(l => [l.planet_id, l.orbit_order]));
const profileBySystem = new Map(profiles.filter(p => p.status === 'complete').map(p => [p.system_id, p]));

const limit = Number(args.get('--limit') ?? stars.length);
const show = Number(args.get('--show') ?? 0);
console.log(`Export : ${path.relative(root, exportDir)} · ${stars.length} étoiles · ${planetsByHost.size} avec planètes confirmées · ${profileBySystem.size} profils Jev`);

/* ---- vérification système par système ---- */
const failures = [];
const fingerprints = new Map();
const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const stats = { architecture: new Map(), mood: new Map(), style: new Map(), archSource: new Map(), moodSource: new Map(), starHue: new Map(), real: new Map() };
let checked = 0;
const started = Date.now();

for (const star of stars.slice(0, limit)) {
  const planets = (planetsByHost.get(star.id) ?? []).map(p => ({ ...p, orbit_order: orderByPlanet.get(p.id) ?? null }));
  const system = systemByStar.get(star.id);
  const profile = system ? profileBySystem.get(system.id) : undefined;
  const a = systems.buildSystemDefinition(star, planets, profile);
  const b = systems.buildSystemDefinition(star, planets, profile);
  const issues = systems.validateSystemDefinition(a);
  if (JSON.stringify(a) !== JSON.stringify(b)) issues.push('not deterministic');
  const expectedReal = Math.min(planets.length, model.demoPlanets.length);
  if (a.realPlanetCount !== expectedReal) issues.push(`real planets ${a.realPlanetCount} ≠ ${expectedReal}`);
  const names = new Set(a.bodies.filter(x => x.real).map(x => x.name));
  for (const p of planets.slice(0, model.demoPlanets.length)) if (!names.has(p.scientific_name)) issues.push(`missing real planet ${p.scientific_name}`);
  if (a.bodies.some(x => !x.real && x.name)) issues.push('simulated planet carries a scientific name');
  if (issues.length) failures.push({ star: star.common_name || star.scientific_name, id: star.id, issues });

  count(stats.architecture, a.profile.systemArchitecture);
  count(stats.mood, a.profile.visualMood);
  count(stats.style, a.profile.planetVisualStyle);
  count(stats.archSource, a.sources.architecture);
  count(stats.moodSource, a.sources.mood);
  count(stats.real, Math.min(3, a.realPlanetCount) === 3 ? '3+' : String(a.realPlanetCount));
  const t = a.star.temperatureK;
  count(stats.starHue, t >= 10000 ? 'bleue ≥10 000 K' : t >= 7500 ? 'blanc-bleu' : t >= 6000 ? 'blanche' : t >= 5000 ? 'jaune' : t >= 3700 ? 'orange' : 'rouge');
  // Empreinte visuelle grossière : deux systèmes « pareils » à l'œil auront la même.
  const fp = [a.profile.systemArchitecture, a.profile.visualMood, a.star.color.map(c => Math.round(c * 5)).join(''),
    ...a.bodies.map(x => `${x.surfaceStyle}${Math.round(x.orbit * 2)}${Math.round(x.size * 20)}${x.color.map(c => Math.round(c * 4)).join('')}`)].join('|');
  count(fingerprints, fp);
  if (checked < show) {
    console.log(`\n${a.starName} · ${a.profile.systemArchitecture} · ${a.profile.visualMood} · ${Math.round(t)} K · étoile ${a.star.size.toFixed(2)}`);
    for (const x of a.bodies) console.log(`  ${x.id} orbite ${x.orbit.toFixed(2)} taille ${x.size.toFixed(2)} matière ${x.surfaceStyle} ${x.real ? x.name : '(simulation)'}`);
  }
  checked++;
}

/* ---- rapport ---- */
const pct = (n, total = checked) => `${(n / total * 100).toFixed(1)} %`;
const table = (title, map) => console.log(`${title} : ${[...map].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}`);
console.log(`\n${checked} systèmes vérifiés en ${((Date.now() - started) / 1000).toFixed(1)} s`);
table('Architecture', stats.architecture);
table('Ambiance', stats.mood);
table('Style de planètes', stats.style);
table('Couleur d\'étoile', stats.starHue);
table('Planètes réelles', stats.real);
table('Architecture choisie par', stats.archSource);
table('Ambiance choisie par', stats.moodSource);
const unique = [...fingerprints.values()].filter(v => v === 1).length;
const largest = Math.max(...fingerprints.values());
console.log(`Diversité : ${fingerprints.size} apparences distinctes (${pct(fingerprints.size)}), ${pct(unique)} uniques, au plus ${largest} systèmes identiques à l'œil`);

/* ---- économie : la même pour tous les systèmes ---- */
function simulatePlayer(visitsPerDay = 3) {
  // Le lancement d'une sonde est daté avec l'heure réelle : la simulation part donc de maintenant.
  const base = Date.now();
  let state = model.createGuardianDemo(base);
  const visit = 24 * 3600_000 / visitsPerDay;
  for (let now = base; now < base + 60 * 24 * 3600_000; now += visit) {
    state = model.guardianDemoReducer(state, { type: 'sync', now });
    for (let guard = 0; guard < 20; guard++) {
      const next = model.nextDemoPlanet(state.connected);
      let action = null;
      if (next && !state.probeTarget && state.relayLevel >= model.requiredRelayLevel(next) && state.energy >= model.probeCost(next)) action = { type: 'probe', planet: next };
      else if (state.relayLevel < model.maximumRelayLevel && state.energy >= model.upgradeCost(state.relayLevel) && (!next || state.relayLevel < model.requiredRelayLevel(next) || state.energy - model.upgradeCost(state.relayLevel) >= 0)) action = { type: 'upgrade' };
      if (!action) break;
      const before = state; state = model.guardianDemoReducer(state, action);
      if (state === before) break;
    }
    if (state.connected.length === model.demoPlanets.length) return (now - base) / (24 * 3600_000);
  }
  return Infinity;
}
const days = simulatePlayer(3);
console.log(`Économie (identique pour chaque système) : toutes les planètes atteintes en ${days.toFixed(1)} jours pour un joueur qui passe 3 fois par jour, sans jouer à Orbital Run.`);

/* ---- verdict ---- */
if (failures.length) {
  console.log(`\n✗ ${failures.length} système(s) enfreignent une règle :`);
  for (const f of failures.slice(0, 25)) console.log(`  - ${f.star} (${f.id}) : ${f.issues.slice(0, 3).join(' ; ')}`);
  if (failures.length > 25) console.log(`  … et ${failures.length - 25} autres`);
  process.exitCode = 1;
} else {
  console.log('\n✓ Tous les systèmes respectent les règles.');
}
assert.ok(Number.isFinite(days) && days <= 30, 'Every system must be completable within 30 days by a regular player');
