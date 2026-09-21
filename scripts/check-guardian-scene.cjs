const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, Float32Array, Math, require: name => load(path.resolve(path.dirname(file), `${name}.ts`)) };
  vm.runInNewContext(output, context, { filename: file }); cache.set(file, context.exports); return context.exports;
}
const scene = load(path.join(root, 'src/features/guardian-scene.ts'));
const model = load(path.join(root, 'src/features/guardian-demo-model.ts'));
const { createGuardianRenderer } = load(path.join(root, 'src/features/guardian-gl-renderer.ts'));
const relayView = scene.initialRelayInspection();
const rotated = scene.dragRelayInspection(relayView, 80, -30, 390, 250);
assert.notEqual(rotated.yaw, relayView.yaw, 'Horizontal drag orbits the satellite');
assert.notEqual(rotated.pitch, relayView.pitch, 'Vertical drag tilts the satellite inspection camera');
assert.equal(scene.adjustRelayInspection(relayView, 0, 1000).pitch, 1.35);
assert.equal(scene.adjustRelayInspection(relayView, 0, -1000).pitch, -1.35);
assert.equal(scene.relayZoomDistance(0.1), 3);
assert.equal(scene.relayZoomDistance(10000), 14);
assert.ok(Math.abs(scene.adjustRelayInspection(relayView, Math.PI * 2, 0).yaw - relayView.yaw) < 1e-9, 'A full orbit restores the angle');
for (const view of [relayView, rotated, scene.adjustRelayInspection(relayView, Math.PI, 0), { yaw: 0, pitch: -1.35 }, { yaw: 0, pitch: 1.35 }]) {
  for (const [width, height] of [[320, 170], [390, 260], [350, 600]]) {
    const camera = { x: 0, z: 0, distance: scene.relayOverviewDistance(width, height) };
    const matrix = scene.cameraMatrix(camera, width / height, true, view);
    assert.ok([...matrix].every(Number.isFinite), 'Inspection matrix stays valid above and below the model');
    assert.ok(Math.abs(Math.hypot(...scene.cameraEye(camera, true, view)) - camera.distance) < 1e-9, 'Orbiting changes orientation, not zoom');
    const center = scene.project([0, 0, 0], matrix, width, height);
    assert.ok(Math.abs(center.x - width / 2) < 1e-3 && Math.abs(center.y - height / 2) < 1e-3, 'Satellite stays centered while orbiting');
  }
}
for (const mesh of [scene.sphereMesh(), scene.boxMesh(), scene.cylinderMesh(), scene.dishMesh(), scene.ringMesh(), scene.billboardMesh()]) {
  assert.equal(mesh.vertices.length, mesh.count * 6);
  assert.ok([...mesh.vertices].every(Number.isFinite), 'All uploaded geometry must be finite');
  for (let i = 0; i < mesh.vertices.length; i += 6) assert.ok(Math.abs(Math.hypot(...mesh.vertices.slice(i + 3, i + 6)) - 1) < 0.0001, 'Normals must be normalized');
}
for (const matrix of [
  scene.orientedModelMatrix([1, 2, 3], [0.5, 1.5, 0.75], 0.7, -0.4, 0.25),
  scene.orientedModelMatrix([0, 0, 0], [1, 1, 1], -Math.PI, Math.PI / 2, -Math.PI / 3),
]) assert.ok([...matrix].every(Number.isFinite), 'Oriented satellite parts must keep valid transforms');
const sphereVertices = scene.sphereMesh().vertices;
for (let i = 0; i < sphereVertices.length; i += 18) {
  const a = [...sphereVertices.slice(i, i + 3)], b = [...sphereVertices.slice(i + 6, i + 9)], c = [...sphereVertices.slice(i + 12, i + 15)];
  const u = b.map((v, k) => v - a[k]), v = c.map((n, k) => n - a[k]);
  const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  assert.ok(cross.reduce((sum, n, k) => sum + n * a[k], 0) >= -1e-8, 'Sphere faces must point outward for atmosphere culling');
}
for (const [width, height] of [[320, 440], [390, 550], [430, 640], [780, 400]]) {
  for (const available of [['b', 'c', 'd'], model.demoPlanets]) {
    const camera = scene.overviewCamera(width, height, available);
    const matrix = scene.cameraMatrix(camera, width / height);
    const star = scene.project([0, 0, 0], matrix, width, height);
    assert.ok(Math.abs(star.x - width / 2) < 0.001 && Math.abs(star.y - height / 2) < 0.001);
    for (const planet of scene.scenePlanets.filter(p => available.includes(p.id))) {
      const point = scene.project(planet.position, matrix, width, height);
      assert.ok(point.x > 0 && point.x < width && point.y > 0 && point.y < height, 'Overview must contain available planets');
      assert.equal(scene.pickPlanet(point.x, point.y, camera, width, height, available), planet.id, 'Picking and 3D projection must agree');
      const focused = scene.focusedCamera(planet.id, width, height);
      const centered = scene.project(planet.position, scene.cameraMatrix(focused, width / height), width, height);
      assert.ok(Math.abs(centered.x - width / 2) < 0.001 && Math.abs(centered.y - height / 2) < 0.001);
      const radius = scene.projectedBodyRadius(planet.position, planet.size, focused, width, height);
      assert.ok(radius * 2 >= Math.min(width, height) * 0.38 && radius * 2 <= Math.min(width, height) * 0.46, 'Focused planet must be large and fit the actual scene');
      for (const sign of [-1, 1]) assert.equal(scene.pickPlanet(centered.x + sign * radius * 0.8, centered.y, focused, width, height, available), planet.id, 'The whole visible sphere, not just its center, must accept taps');
      assert.equal(scene.pickPlanet(-1000, -1000, focused, width, height, available), undefined, 'Empty space must not select a planet');
    }
    const moved = scene.panCamera(camera, 100000, -100000, width, height);
    assert.equal(moved.x, -10); assert.equal(moved.z, 10);
  }
  for (const distance of [5.2, 16, 32]) for (const [dx, dy] of [[-24, -30], [24, -30], [-24, 30], [24, 30], [0, -30], [0, 30], [-24, 0], [24, 0]]) {
    for (const [ax, ay] of [[width / 2, height / 2], [width * 0.3, height * 0.7]]) {
      const camera = { x: 0, z: 0, distance };
      const ground = scene.screenToGround(camera, ax, ay, width, height);
      for (const zoomFactor of [1, 0.8, 1.2]) {
        const dragged = scene.panCamera(camera, dx, dy, width, height, ax, ay, distance * zoomFactor);
        const point = scene.project(ground, scene.cameraMatrix(dragged, width / height), width, height);
        assert.ok(Math.abs(point.x - ax - dx) < 0.001 && Math.abs(point.y - ay - dy) < 0.001,
          `Content must follow the finger exactly, including diagonal drags and combined pinch (${dx}, ${dy})`);
      }
    }
  }
}
const initialAvailable = model.navigableDemoPlanets(['b', 'c']);
assert.equal(initialAvailable.join(','), 'b,c,d');
const hidden = scene.scenePlanets.find(p => p.id === 'h');
const camera = scene.overviewCamera(390, 550, model.demoPlanets);
const point = scene.project(hidden.position, scene.cameraMatrix(camera, 390 / 550), 390, 550);
assert.notEqual(scene.pickPlanet(point.x, point.y, camera, 390, 550, initialAvailable), 'h', 'Undiscovered planets cannot be selected');

// Exercise the actual renderer without a browser or phone. Shader compilation is mocked;
// the optional preview rasterizes its real geometry/commands on the CPU, not native GL.
function recordingContext(failCompile = false) {
  const commands = [], buffers = new Set(), shaders = new Set(); let bound, uniforms = {}, id = 0, presentations = 0;
  const gl = {
    drawingBufferWidth: 780, drawingBufferHeight: 1100,
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DEPTH_TEST: 7, BLEND: 8, SRC_ALPHA: 9, ONE_MINUS_SRC_ALPHA: 10, FLOAT: 11, TRIANGLES: 12, LINE_STRIP: 13, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32,
    createProgram: () => ({ id: ++id }), createShader: () => { const s = { id: ++id }; shaders.add(s); return s; }, shaderSource: () => {}, compileShader: () => {}, getShaderParameter: () => !failCompile, getShaderInfoLog: () => 'Mock compilation failure', attachShader: () => {}, linkProgram: () => {}, getProgramParameter: () => true,
    createBuffer: () => { const b = { id: ++id }; buffers.add(b); return b; }, bindBuffer: (_, b) => { bound = b; }, bufferData: (_, data) => { assert.ok([...data].every(Number.isFinite)); bound.data = data; },
    getAttribLocation: (_, name) => name === 'aPosition' ? 0 : 1, getUniformLocation: (_, name) => name,
    uniformMatrix4fv: (name, _, value) => { uniforms[name] = [...value]; }, uniform3fv: (name, value) => { uniforms[name] = [...value]; }, uniform1f: (name, value) => { uniforms[name] = value; },
    drawArrays: (mode, start, count) => { assert.equal(start, 0); assert.ok(count * 6 <= bound.data.length); commands.push({ mode, count, data: bound.data, uniforms: { ...uniforms } }); },
    deleteBuffer: b => buffers.delete(b), deleteShader: s => shaders.delete(s), deleteProgram: () => {},
    CULL_FACE: 33, BACK: 34, disable: () => {}, cullFace: () => {}, enable: () => {}, blendFunc: () => {}, vertexAttribPointer: () => {}, viewport: () => {}, clearColor: () => {}, clear: () => { commands.length = 0; }, useProgram: () => {}, enableVertexAttribArray: () => {}, depthMask: () => {}, flush: () => {}, endFrameEXP: () => { presentations++; },
  };
  return { gl, commands, buffers, shaders, presentations: () => presentations };
}
const recording = recordingContext();
const renderer = createGuardianRenderer(recording.gl);
const initialScene = { mode: 'system', camera: scene.overviewCamera(390, 550, initialAvailable), selected: 'c', connected: ['b', 'c'], relayLevel: 2, time: 0 };
renderer.render(initialScene);
assert.ok(recording.commands.some(command => command.mode === recording.gl.TRIANGLES), '3D scene must draw meshes, not only flat orbit lines');
assert.ok(recording.commands.some(command => command.mode === recording.gl.LINE_STRIP));
assert.equal(recording.commands.filter(c => c.uniforms.uMaterial === 5).length, 1, 'Star glow must be a single soft billboard, not concentric rings');
assert.equal(recording.commands.find(c => c.uniforms.uMaterial === 5).count, 6);
const initialBodies = recording.commands.filter(c => c.uniforms.uMaterial === 1);
assert.equal(initialBodies.length, 3, 'Only connected worlds and the next frontier are drawn');
assert.equal(initialBodies.filter(c => c.uniforms.uReveal === 0).length, 1);
assert.equal(recording.commands.filter(c => c.uniforms.uMaterial === 4).length, 0, 'Starter rocky worlds have no atmospheric overlay');
const farBody = initialBodies.find(c => c.uniforms.uSeed === scene.scenePlanets[1].seed);
renderer.render({ ...initialScene, camera: scene.focusedCamera('c') });
const nearBody = recording.commands.find(c => c.uniforms.uMaterial === 1 && c.uniforms.uSeed === scene.scenePlanets[1].seed);
assert.ok(nearBody.count > farBody.count && nearBody.uniforms.uDetail > farBody.uniforms.uDetail, 'Zoom increases geometry and surface detail');
renderer.render({ ...initialScene, connected: model.demoPlanets });
assert.equal(recording.commands.filter(c => c.uniforms.uMaterial === 4).length, 3);
assert.ok(recording.commands.every(c => c.uniforms.uCamera.every(Number.isFinite)));
renderer.render({ ...initialScene, mode: 'relay', camera: { x: 0, z: 0, distance: 6.9 } });
const level2Draws = recording.commands.length;
assert.ok(level2Draws >= 40 && level2Draws <= 70, 'Detailed reference satellite stays inside its draw-call budget');
assert.ok(recording.commands.filter(c => c.uniforms.uColor[0] > 0.65 && c.uniforms.uColor[1] < 0.6).length >= 7, 'Gold insulation and articulated hardware remain visibly represented');
assert.ok(recording.commands.filter(c => c.uniforms.uColor[2] > 0.4 && c.uniforms.uColor[0] < 0.3).length >= 10, 'Solar wings retain visible panel segmentation');
assert.equal(recording.commands.filter(c => c.mode === recording.gl.LINE_STRIP).length, 0, 'Inspection has no decorative orbit ring');
const beforeOrbit = recording.commands[0].uniforms.uViewProjection;
const beforeModel = recording.commands[0].uniforms.uModel;
renderer.render({ ...initialScene, mode: 'relay', camera: { x: 0, z: 0, distance: 6.9 }, relayView: rotated, time: 10 });
assert.notDeepEqual(recording.commands[0].uniforms.uViewProjection, beforeOrbit, 'Renderer uses the interactive orbit');
assert.deepEqual(recording.commands[0].uniforms.uModel, beforeModel, 'Satellite does not auto-spin while being inspected');
renderer.render({ ...initialScene, mode: 'relay', relayLevel: 4, camera: { x: 0, z: 0, distance: 6.9 } });
assert.ok(recording.commands.length > level2Draws, 'Upgrades must change the reference satellite geometry');
renderer.dispose(); assert.equal(recording.buffers.size, 0); assert.equal(recording.shaders.size, 0);
const presentations = recording.presentations(); renderer.render(initialScene); assert.equal(recording.presentations(), presentations, 'Disposed scene cannot render');
renderer.dispose();
const failing = recordingContext(true);
assert.throws(() => createGuardianRenderer(failing.gl), /compilation failure/);
assert.equal(failing.shaders.size, 0, 'Failed initialization must release resources');

async function previews() {
  const initCanvasKit = require('canvaskit-wasm');
  const kit = await initCanvasKit({ locateFile: file => path.join(path.dirname(require.resolve('canvaskit-wasm')), file) });
  const directory = path.join(root, 'output/guardian-3d-preview'); fs.mkdirSync(directory, { recursive: true });
  function raster(state, filename) {
    const captured = recordingContext();
    if (state.mode === 'relay') captured.gl.drawingBufferHeight = 420;
    const engine = createGuardianRenderer(captured.gl); engine.render(state);
    const width = captured.gl.drawingBufferWidth, height = captured.gl.drawingBufferHeight, surface = kit.MakeSurface(width, height), canvas = surface.getCanvas(), paint = new kit.Paint(); paint.setAntiAlias(true); canvas.clear(kit.Color(7, 9, 17, 1));
    const primitives = [];
    const transform = (p, m) => [0, 1, 2].map(row => p[0] * m[row] + p[1] * m[4 + row] + p[2] * m[8 + row] + m[12 + row]);
    for (const command of captured.commands) {
      // CPU geometry preview does not evaluate the transparent fragment materials.
      if (command.uniforms.uMaterial >= 4) continue;
      const u = command.uniforms, data = command.data, step = command.mode === captured.gl.TRIANGLES ? 3 : 1;
      for (let i = 0; i < command.count - (step === 1 ? 1 : 0); i += step) {
        const vertices = [], normals = [], world = [];
        for (let j = 0; j < (step === 3 ? 3 : 2); j++) {
          const offset = (i + j) * 6, p = [...data.slice(offset, offset + 3)], w = transform(p, u.uModel);
          world.push(w); normals.push(transform([...data.slice(offset + 3, offset + 6)], [...u.uModel.slice(0, 12), 0, 0, 0, 1]));
          vertices.push(scene.project(w, new Float32Array(u.uViewProjection), width, height));
        }
        if (vertices.some(v => !v || v.depth < -1 || v.depth > 1)) continue;
        let shade = 1;
        if (u.uMaterial > 0.5 && u.uMaterial < 2.5) {
          const n = [0, 1, 2].map(k => normals.reduce((sum, v) => sum + v[k], 0));
          const at = [0, 1, 2].map(k => world.reduce((sum, v) => sum + v[k], 0) / world.length);
          const light = u.uMaterial < 1.5 ? [-at[0], 0.7 - at[1], -at[2]] : [-3, 6, 4];
          shade = 0.17 + 0.83 * Math.max(0, n.reduce((sum, v, k) => sum + v * light[k], 0) / (Math.hypot(...n) * Math.hypot(...light) || 1));
        }
        primitives.push({ vertices, color: u.uColor.map(v => Math.min(255, v * shade * 255)), alpha: u.uAlpha, line: step === 1, depth: vertices.reduce((sum, v) => sum + v.depth, 0) / vertices.length });
      }
    }
    primitives.sort((a, b) => b.depth - a.depth);
    for (const primitive of primitives) {
      const shape = kit.Path.MakeFromSVGString(primitive.vertices.map((v, i) => `${i ? 'L' : 'M'}${v.x} ${v.y}`).join(' ') + (primitive.line ? '' : ' Z'));
      paint.setStyle(primitive.line ? kit.PaintStyle.Stroke : kit.PaintStyle.Fill); paint.setStrokeWidth(1.2); paint.setColor(kit.Color(...primitive.color, primitive.alpha));
      canvas.drawPath(shape, paint); shape.delete();
    }
    surface.flush(); const image = surface.makeImageSnapshot(); fs.writeFileSync(path.join(directory, filename), image.encodeToBytes()); image.delete(); paint.delete(); surface.delete(); engine.dispose();
  }
  raster(initialScene, 'system-overview.png');
  raster({ ...initialScene, selected: 'c', camera: scene.focusedCamera('c') }, 'planet-focus.png');
  raster({ ...initialScene, mode: 'relay', camera: { x: 0, z: 0, distance: 6.9 } }, 'relay-level-2.png');
  raster({ ...initialScene, mode: 'relay', relayLevel: 4, camera: { x: 0, z: 0, distance: 6.9 } }, 'relay-level-4.png');
  console.log(`CPU geometry previews (not phone screenshots): ${directory}`);
}
console.log('PASS: 3D geometry, perspective, four viewport sizes, hit selection, camera limits, progressive navigation, renderer commands, upgrade geometry and GPU-resource cleanup. Native shader/device behavior still needs Expo Go.');
if (process.argv.includes('--preview')) previews().catch(error => { console.error(error); process.exitCode = 1; });
