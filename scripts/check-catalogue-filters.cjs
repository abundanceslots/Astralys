const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/features/catalogue-filters.ts');
const source = fs.readFileSync(file, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context, { filename: file });

const { defaultStarSort, getSkyRegionOption, regionOptions, sortOptions } = context.exports;
assert.equal(defaultStarSort, 'nearest');
assert.equal(sortOptions[0].value, 'nearest');
assert.equal(sortOptions[0].column, 'distance_ly');
assert.equal(sortOptions[0].ascending, true);

const bands = regionOptions.filter((option) => option.value !== 'all');
assert.equal(bands.length, 7, 'The sky must expose seven precise declination bands');
assert.equal(
  JSON.stringify(bands.map((option) => [option.minimumDeclination ?? -90, option.maximumDeclination ?? 90])),
  JSON.stringify([[60, 90], [30, 60], [10, 30], [-10, 10], [-30, -10], [-60, -30], [-90, -60]]),
);

for (let declination = -90; declination <= 90; declination += 0.25) {
  const matches = bands.filter((band) =>
    (band.minimumDeclination === undefined || declination >= band.minimumDeclination)
    && (band.maximumDeclination === undefined || declination < band.maximumDeclination));
  assert.equal(matches.length, 1, `Declination ${declination} must belong to exactly one sky region`);
}
assert.equal(getSkyRegionOption('north-high').label, 'High north');
assert.equal(getSkyRegionOption('invalid').value, 'all');

console.log('PASS: nearest-first catalogue default and seven continuous sky-location bands.');
