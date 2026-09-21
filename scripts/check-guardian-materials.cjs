// Evaluate the shared fragment math using headless CanvasKit, without a browser.
// This validates procedural appearances, not native Expo GL compilation/performance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/features/guardian-materials.ts'), 'utf8');
const fragment = source.match(/export const sceneFragmentShader = `([\s\S]*?)`;/)[1];
let sksl = fragment.replace(/^#.*$/gm, '').replace(/^precision.*$/gm, '')
  .replace(/varying mediump /g, '').replace(/\bvec([234])\b/g, 'float$1')
  .replace(/\bgl_FragColor\b/g, 'outputColor').replace(/\breturn;/g, 'return outputColor;')
  .replace('void main() {', `half4 main(float2 coord) {
    float2 uv = (coord - previewSize * 0.5) / (min(previewSize.x, previewSize.y) * 0.36);
    vLocal = float3(uv, 0.0);
    if (uMaterial < 4.5) {
      float r2 = dot(uv, uv);
      if (r2 > 1.0) return half4(0.0);
      float z = sqrt(max(0.0, 1.0 - r2));
      vNormal = float3(uv.x, 0.93974 * z - 0.3419 * uv.y, 0.3419 * z + 0.93974 * uv.y);
      vLocal = vNormal;
      vWorld = previewCenter + vNormal * previewRadius;
    }
  `);
sksl = 'uniform float2 previewSize; uniform float3 previewCenter; uniform float previewRadius; float4 outputColor;\n' + sksl;
const finalBrace = sksl.lastIndexOf('}');
sksl = sksl.slice(0, finalBrace) + 'return outputColor;\n' + sksl.slice(finalBrace);

async function main() {
  const initialize = require('canvaskit-wasm');
  const kit = await initialize({ locateFile: file => path.join(path.dirname(require.resolve('canvaskit-wasm')), file) });
  let compilationError = '';
  const effect = kit.RuntimeEffect.Make(sksl, error => { compilationError = error; });
  assert.ok(effect, compilationError || 'Material shader must compile');
  const size = 240, directory = path.join(root, 'output/guardian-material-preview');
  const preview = process.argv.includes('--preview');
  if (preview) fs.mkdirSync(directory, { recursive: true });
  function render(overrides, filename) {
    const center = overrides.previewCenter ?? [2.0, 0, -2.4];
    const values = { previewSize: [size, size], previewCenter: center, previewRadius: 0.27,
      uColor: [0.66, 0.51, 0.43], uMaterial: 1, uAlpha: 1, uTime: 0, uCamera: [center[0], 6.0, center[2] + 2.18],
      uSeed: 23, uStyle: 0, uDetail: 1, uReveal: 1, uCloud: 0, ...overrides };
    const uniforms = new Float32Array(effect.getUniformFloatCount());
    for (let i = 0; i < effect.getUniformCount(); i++) {
      const meta = effect.getUniform(i), value = values[effect.getUniformName(i)];
      assert.notEqual(value, undefined, 'Every material uniform must be initialized');
      uniforms.set(Array.isArray(value) ? value : [value], meta.slot);
    }
    const surface = kit.MakeSurface(size, size), canvas = surface.getCanvas(), paint = new kit.Paint();
    canvas.clear(kit.TRANSPARENT);
    const shader = effect.makeShader(uniforms); paint.setShader(shader);
    canvas.drawRect(kit.XYWHRect(0, 0, size, size), paint); surface.flush();
    const image = surface.makeImageSnapshot();
    const pixels = image.readPixels(0, 0, { width: size, height: size, colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB });
    assert.ok(pixels);
    if (preview && filename) fs.writeFileSync(path.join(directory, filename), image.encodeToBytes());
    const result = Buffer.from(pixels);
    image.delete(); shader.delete(); paint.delete(); surface.delete();
    return result;
  }
  const alpha = (pixels, x, y) => pixels[(y * size + x) * 4 + 3];
  const rock = render({}, 'rocky-craters.png');
  assert.equal(alpha(rock, size / 2, size / 2), 255);
  assert.equal(alpha(rock, 0, 0), 0, 'No rectangular background around a planet');
  assert.deepEqual(rock, render({}), 'Planet identity is deterministic');
  assert.notDeepEqual(rock, render({ uSeed: 71 }), 'Different planets have distinct surfaces');
  assert.notDeepEqual(rock, render({ uTime: 20 }), 'Surface rotation must advance');
  assert.notDeepEqual(rock, render({ uDetail: 0 }), 'Relief/detail is adaptive');
  assert.notDeepEqual(rock, render({ uReveal: 0 }), 'Frontier should not show discovered terrain');
  assert.notDeepEqual(rock, render({ uStyle: 2, uColor: [0.64, 0.72, 0.78] }, 'icy-surface.png'));
  assert.notDeepEqual(rock, render({ uCloud: 0.2 }, 'light-clouds.png'));
  const star = { uMaterial: 0, previewCenter: [0, 0, 0], previewRadius: 0.65, uCamera: [0, 6, 2.18], uColor: [0.94, 0.42, 0.2] };
  assert.notDeepEqual(render(star, 'living-star.png'), render({ ...star, uTime: 20 }), 'Star plasma is animated');
  const halo = render({ uMaterial: 5, uAlpha: 0.24, uColor: [1, 0.5, 0.27] }, 'soft-star-halo.png');
  assert.equal(alpha(halo, 0, 0), 0);
  assert.ok(alpha(halo, 120, 120) > alpha(halo, 175, 120) && alpha(halo, 175, 120) > alpha(halo, 203, 120), 'Halo fades outward');
  const atmosphere = render({ uMaterial: 4, uAlpha: 0.2, uColor: [0.45, 0.64, 0.85] }, 'atmospheric-rim.png');
  assert.ok(alpha(atmosphere, 120, 120) < 2, 'Atmosphere does not veil the center');
  assert.ok([...atmosphere].filter((_, i) => i % 4 === 3).some(v => v > 3), 'Atmospheric rim must be visible');
  effect.delete();
  console.log('PASS: headless shared material math, stable identities, rotation, relief LOD, rocky/icy/cloud surfaces, living star, transparent halo and atmospheric rim. Native GL still needs Expo Go.');
  if (preview) console.log(`Material previews (not device screenshots): ${directory}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
