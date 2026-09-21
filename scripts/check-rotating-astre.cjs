const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const initCanvasKit = require('canvaskit-wasm');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/components/rotating-astre.shader.ts'), 'utf8');
  const shaderText = source.match(/= `([\s\S]*?)`;/)?.[1];
  assert.ok(shaderText, 'Shader source must be available');
  const bin = path.dirname(require.resolve('canvaskit-wasm'));
  const kit = await initCanvasKit({ locateFile: file => path.join(bin, file) });
  let compileError = '';
  const effect = kit.RuntimeEffect.Make(shaderText, message => { compileError = message; });
  assert.ok(effect, `Shader must compile: ${compileError}`);

  function render(angle, size = 320, background = false) {
    const surface = kit.MakeSurface(size, size);
    assert.ok(surface, 'Raster surface must be available');
    const paint = new kit.Paint();
    const shader = effect.makeShader([size, size, angle]);
    paint.setShader(shader);
    surface.getCanvas().clear(background ? kit.Color(7, 9, 17, 1) : kit.TRANSPARENT);
    surface.getCanvas().drawRect(kit.XYWHRect(0, 0, size, size), paint);
    surface.flush();
    const image = surface.makeImageSnapshot();
    const pixels = image.readPixels(0, 0, {
      width: size, height: size, colorType: kit.ColorType.RGBA_8888,
      alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB,
    });
    const png = image.encodeToBytes();
    image.delete(); shader.delete(); paint.delete(); surface.delete();
    assert.ok(pixels && png);
    return { pixels, png };
  }

  for (const size of [60, 120, 220, 320]) {
    const { pixels } = render(0, size);
    for (const corner of [0, size - 1, size * (size - 1), size * size - 1]) {
      assert.equal(pixels[corner * 4 + 3], 0, 'Corners must remain transparent');
    }
    assert.equal(pixels[(Math.floor(size / 2) * size + Math.floor(size / 2)) * 4 + 3], 255,
      'Sphere center must be opaque');
  }
  const first = render(0);
  const quarter = render(Math.PI / 2);
  const loop = render(Math.PI * 2);
  let movingPixels = 0;
  let loopError = 0;
  for (let i = 0; i < first.pixels.length; i++) {
    if (Math.abs(first.pixels[i] - quarter.pixels[i]) > 8) movingPixels++;
    loopError += Math.abs(first.pixels[i] - loop.pixels[i]);
  }
  assert.ok(movingPixels > 3000, 'Surface must visibly rotate');
  assert.ok(loopError / first.pixels.length < 0.1, 'Full rotation must loop without a visible seam');
  if (process.argv.includes('--preview')) {
    const directory = path.join(root, 'output', 'astre-preview');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'astre-front.png'), first.png);
    fs.writeFileSync(path.join(directory, 'astre-quarter-turn.png'), quarter.png);
    fs.writeFileSync(path.join(directory, 'astre-on-app-background.png'), render(0, 320, true).png);
    console.log(`Preview: ${directory}`);
  }
  effect.delete();
  console.log('PASS: shader compilation, transparent background, four mobile sizes, moving surface and seamless loop.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
