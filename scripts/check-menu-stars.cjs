// Native Skia shader evaluated headlessly: no browser or simulated phone screenshot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const profileFile = path.join(root, 'src/components/celestial-visual.shared.ts');
const context = { exports: {}, Math };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(profileFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const profileFor = context.exports.getCelestialVisualProfile;
const rgb = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255);

async function main() {
  const initialize = require('canvaskit-wasm');
  const kit = await initialize({ locateFile: file => path.join(path.dirname(require.resolve('canvaskit-wasm')), file) });
  const text = fs.readFileSync(path.join(root, 'src/components/menu-star.shader.ts'), 'utf8').match(/= `([\s\S]*?)`;/)[1];
  let compileError = '';
  const effect = kit.RuntimeEffect.Make(text, error => { compileError = error; });
  assert.ok(effect, compileError);
  const preview = process.argv.includes('--preview'), directory = path.join(root, 'output/menu-star-preview');
  if (preview) fs.mkdirSync(directory, { recursive: true });
  const warm = { id: 'menu-warm-star', object_type: 'star', temperature_k: 4200 };
  assert.deepEqual(profileFor(warm), profileFor(warm), 'Visual identity must remain stable');
  function render(object, size = 240, phase = 0, filename, background = false) {
    const profile = profileFor(object);
    const values = { size: [size, size], bodyRatio: profile.bodyRatio, seed: profile.seed, detail: size >= 60 ? 1 : 0, phase,
      baseColor: rgb(profile.baseColor), highlightColor: rgb(profile.highlightColor) };
    const uniforms = new Float32Array(effect.getUniformFloatCount());
    for (let i = 0; i < effect.getUniformCount(); i++) {
      const value = values[effect.getUniformName(i)];
      assert.notEqual(value, undefined);
      uniforms.set(Array.isArray(value) ? value : [value], effect.getUniform(i).slot);
    }
    const surface = kit.MakeSurface(size, size), paint = new kit.Paint(), shader = effect.makeShader(uniforms);
    surface.getCanvas().clear(background ? kit.Color(7, 9, 17, 1) : kit.TRANSPARENT); paint.setShader(shader);
    surface.getCanvas().drawRect(kit.XYWHRect(0, 0, size, size), paint); surface.flush();
    const image = surface.makeImageSnapshot();
    const pixels = Buffer.from(image.readPixels(0, 0, { width: size, height: size, colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB }));
    if (preview && filename) fs.writeFileSync(path.join(directory, filename), image.encodeToBytes());
    image.delete(); shader.delete(); paint.delete(); surface.delete();
    return pixels;
  }
  for (const size of [40, 48, 56, 96, 104, 240]) {
    const pixels = render(warm, size, 0, size === 48 ? 'catalogue-48px.png' : undefined);
    for (const corner of [0, size - 1, size * (size - 1), size * size - 1]) assert.equal(pixels[corner * 4 + 3], 0);
    assert.equal(pixels[(Math.floor(size / 2) * size + Math.floor(size / 2)) * 4 + 3], 255);
    for (let i = 0; i < size; i++) {
      assert.equal(pixels[(i * size) * 4 + 3], 0, 'Halo must not be clipped by the canvas boundary');
      assert.equal(pixels[(i * size + size - 1) * 4 + 3], 0);
    }
  }
  const first = render(warm, 240, 0, 'golden-star.png');
  const haloPixel = first[(120 * 240 + 210) * 4 + 3];
  assert.ok(haloPixel > 0 && haloPixel < 35, 'Halo must be translucent, not a solid disc');
  render(warm, 240, 0, 'golden-on-menu.png', true);
  assert.deepEqual(first, render(warm), 'Re-rendering a static catalogue star must not randomize it');
  assert.notDeepEqual(first, render({ ...warm, id: 'different-star' }), 'Different catalogue IDs have distinct surfaces');
  assert.notDeepEqual(first, render(warm, 240, Math.PI / 2, 'golden-quarter-turn.png'));
  const loop = render(warm, 240, Math.PI * 2);
  const averageError = first.reduce((sum, value, i) => sum + Math.abs(value - loop[i]), 0) / first.length;
  assert.ok(averageError < 0.1, 'Rotation and convection must loop seamlessly');
  assert.notDeepEqual(first, render({ id: 'blue-star', object_type: 'star', temperature_k: 16000 }, 240, 0, 'blue-star.png'));
  render({ id: 'cool-star', object_type: 'star', temperature_k: 3200 }, 240, 0, 'orange-red-star.png');
  render({ ...warm, radius_solar: 100, apparent_magnitude: -10 }, 240, 0, 'large-star.png');
  effect.delete();
  console.log('PASS: menu-star shader compilation, six mobile sizes, transparent unclipped halo, stable catalogue identity, temperature palettes, rotating surface and seamless loop. Phone performance still needs Expo Go.');
  if (preview) console.log(`Material samples (not phone screenshots): ${directory}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
