const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function evaluate(file, requireModule) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: requireModule });
  return exports;
}
const data = evaluate('src/data/star-names.ts');
const names = evaluate('src/utils/celestial-display-name.ts', () => data);
for (const [original, expected] of [
  ['Êta Sagittaire', 'Eta Sagittarii'],
  ['Bêta Grande Ourse', 'Beta Ursae Majoris'],
  ['Zêta 1 Grande Ourse', 'Zeta 1 Ursae Majoris'],
  ['Thêta Aigle', 'Theta Aquilae'],
  ['Rhô Bouvier', 'Rho Boötis'],
  ['Alpha 2 Chiens de chasse', 'Alpha 2 Canum Venaticorum'],
  ['Schedar', 'Schedar'],
  ['iot UMa A', 'iot UMa A'],
]) assert.equal(names.canonicalDesignation(original), expected);
const etaId = '4038055447778237312';
assert.ok(names.findLocalStarSourceIds('Eta Sagittarii').includes(etaId));
assert.ok(names.findLocalStarSourceIds('eta sagittaire').includes(etaId));
const schedar = { source_id: '418551920284673408', scientific_name: 'Gaia DR3 418551920284673408', common_name: null };
assert.equal(names.getCelestialDisplayName(schedar), 'Schedar');
assert.equal(names.getCelestialScientificName(schedar), 'Alpha Cassiopeiae');
const unnamed = { source_id: '9999999999999999999', scientific_name: 'Gaia DR3 9999999999999999999', common_name: null };
const generatedName = names.getCelestialDisplayName(unnamed);
assert.equal(generatedName, names.getAstralysCatalogueName(unnamed.source_id));
assert.match(generatedName, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
assert.doesNotMatch(generatedName, /\d/);
assert.notEqual(generatedName, names.getAstralysCatalogueName('9999999999999999998'));
assert.equal(names.hasAstralysCatalogueName(unnamed), true);
assert.equal(names.getCelestialScientificName(unnamed), 'Star 9999999999999999999');
const numberedScientificName = { source_id: '13-lyr', scientific_name: '13 Lyrae', common_name: null };
assert.equal(names.getCelestialDisplayName(numberedScientificName), '13 Lyrae');
assert.equal(names.hasAstralysCatalogueName(numberedScientificName), false);
assert.deepEqual(Object.keys(unnamed), ['source_id', 'scientific_name', 'common_name']);
console.log('Astralys: proper, scientific and generated display-name checks passed.');
