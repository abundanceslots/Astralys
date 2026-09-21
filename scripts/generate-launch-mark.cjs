const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const initCanvasKit = require('canvaskit-wasm');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src/components/astralys-mark.tsx'), 'utf8');
  const paths = [...source.matchAll(/d="([^"]+)"/g)].map(match => match[1]);
  assert.equal(paths.length, 2);
  const bin = path.dirname(require.resolve('canvaskit-wasm'));
  const kit = await initCanvasKit({ locateFile: file => path.join(bin, file) });
  function render(size, destination) {
  const surface = kit.MakeSurface(size, size);
  assert.ok(surface);
  const canvas = surface.getCanvas();
  canvas.clear(kit.TRANSPARENT);
  canvas.scale(size / 128, size / 128);
  const paint = new kit.Paint();
  paint.setAntiAlias(true);
  const theme = fs.readFileSync(path.join(root, 'src/constants/observatory-theme.ts'), 'utf8');
  const color = theme.match(/primary: '(#[0-9a-f]+)'/i)?.[1];
  assert.ok(color);
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
  paths.forEach((data, index) => {
    const shape = kit.Path.MakeFromSVGString(data);
    assert.ok(shape);
    paint.setStyle(index ? kit.PaintStyle.Fill : kit.PaintStyle.Stroke);
    paint.setStrokeWidth(1.5);
    paint.setColor(kit.Color(...rgb, index ? 1 : 0.5));
    canvas.drawPath(shape, paint);
    shape.delete();
  });
  canvas.drawCircle(106, 26, 3, paint);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes();
  assert.ok(bytes);
  fs.writeFileSync(destination, bytes);
  image.delete(); paint.delete(); surface.delete();
  console.log(`Astralys logo ${size} x ${size}: ${destination}`);
  }
  render(384, path.join(root, 'assets/images/astralys-launch-mark.png'));
  if (process.argv.includes('--hd')) {
    const directory = path.join(root, 'assets/brand');
    fs.mkdirSync(directory, { recursive: true });
    render(2048, path.join(directory, 'astralys-logo-2048.png'));
    render(512, path.join(directory, 'astralys-logo-preview.png'));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
