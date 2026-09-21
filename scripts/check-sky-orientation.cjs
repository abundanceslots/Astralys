const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const file = path.resolve(__dirname, '../src/features/sky-orientation.ts');
const source = fs.readFileSync(file, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, Math, Number };
vm.runInNewContext(output, context, { filename: file });
const sky = context.exports;

const close = (actual, expected, tolerance = 0.001, message = '') => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `${message} expected ${expected}, received ${actual}`,
);

// Portrait phone held upright, rear camera looking north at the horizon.
const north = sky.createSkyOrientationFrame([0, -9.81, 0], [0, 4, -42], 0);
assert.ok(north);
close(north.cameraAzimuth, 0, 0.001, 'North-facing azimuth');
close(north.cameraAltitude, 0, 0.001, 'Horizon altitude');
const northTarget = sky.projectHorizontalPosition(0, 0, north);
close(northTarget.left, 50, 0.001, 'North target horizontal center');
close(northTarget.top, 50, 0.001, 'North target vertical center');
assert.equal(northTarget.inside, true);

// Rotate right to east: the east target becomes centered and north moves left.
const east = sky.createSkyOrientationFrame([0, -9.81, 0], [-42, 4, 0], 0);
assert.ok(east);
close(east.cameraAzimuth, 90, 0.001, 'East-facing azimuth');
const eastTarget = sky.projectHorizontalPosition(90, 0, east);
close(eastTarget.left, 50, 0.001, 'East target center');
assert.ok(sky.projectHorizontalPosition(0, 0, east).left < 0, 'A north target moves left when the phone turns right');

// Tilt the rear camera 30 degrees above the northern horizon.
const tilt = 30 * Math.PI / 180;
const tilted = sky.createSkyOrientationFrame(
  [0, -Math.cos(tilt) * 9.81, Math.sin(tilt) * 9.81],
  [0, -Math.sin(tilt) * 42, -Math.cos(tilt) * 42],
  0,
);
assert.ok(tilted);
close(tilted.cameraAltitude, 30, 0.001, 'Tilted camera altitude');
const elevatedTarget = sky.projectHorizontalPosition(0, 30, tilted);
close(elevatedTarget.left, 50, 0.001, 'Elevated target horizontal center');
close(elevatedTarget.top, 50, 0.001, 'Elevated target vertical center');

const behind = sky.projectHorizontalPosition(180, 0, north);
assert.equal(behind.visible, false, 'Objects behind the rear camera cannot appear in frame');
const corrected = sky.createSkyOrientationFrame([0, -9.81, 0], [0, 4, -42], 10);
close(corrected.cameraAzimuth, 10, 0.001, 'Magnetic declination correction');
assert.deepEqual([...sky.lowPassSensorVector([0, 0, 0], [10, -10, 5], 0.2)], [2, -2, 1]);
assert.deepEqual([...sky.isolateGravityVector([2, -10, 3], [2, -0.19, 3])], [0, -9.81, 0]);
close(sky.adaptiveSensorWeight(0.2), 0.035, 0.000001, 'Stationary sensor damping');
close(sky.adaptiveSensorWeight(20), 0.3, 0.000001, 'Moving sensor responsiveness');
const tinyNorthVariation = sky.createSkyOrientationFrame([0, -9.81, 0], [0.01, 4, -42], 0);
assert.ok(tinyNorthVariation);
assert.ok(
  sky.skyOrientationDistance(north, tinyNorthVariation) < 0.35,
  'Tiny stationary compass variations remain inside the dead zone',
);

console.log('PASS: tilt-compensated 3D sky lock, target-only projection, north correction and adaptive stabilization.');
