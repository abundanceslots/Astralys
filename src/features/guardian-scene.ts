import { demoPlanets, type DemoPlanet } from './guardian-demo-model';
import { buildSystemVisualBodies, type SystemVisualProfile } from './system-visual-profile';

export type Vec3 = [number, number, number];
export type SceneCamera = { x: number; z: number; distance: number };
export type RelayInspection = { yaw: number; pitch: number };
export const initialRelayInspection = (): RelayInspection => ({ yaw: 0.67, pitch: 0.42 });
export const minimumCameraDistance = 1.25;
export type SceneMesh = { vertices: Float32Array; count: number };
export const demoSystemVisualProfile: SystemVisualProfile = {
  systemId: 'astralys-demo-system',
  visualSeed: 7429,
  systemArchitecture: 'balanced_mixed',
  planetVisualStyle: 'rocky_mineral',
  renderingFocus: 'system_overview',
  visualMood: 'deep_violet',
};

export const scenePlanets = buildSystemVisualBodies(
  demoSystemVisualProfile,
  demoPlanets.map((id, index) => ({ id, orbitOrder: index + 1 })),
).map(body => ({
  ...body,
  position: [Math.cos(body.angle) * body.orbit, 0, Math.sin(body.angle) * body.orbit] as Vec3,
}));
export const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));
export function adjustRelayInspection(view: RelayInspection, yaw: number, pitch: number): RelayInspection {
  const angle = view.yaw + yaw;
  return { yaw: Math.atan2(Math.sin(angle), Math.cos(angle)), pitch: clamp(view.pitch + pitch, -1.35, 1.35) };
}
export function dragRelayInspection(view: RelayInspection, dx: number, dy: number, width: number, height: number): RelayInspection {
  return adjustRelayInspection(view, -dx * Math.PI * 2 / Math.max(width, 1), dy * Math.PI / Math.max(height, 1));
}
export const relayOverviewDistance = (width: number, height: number) => clamp(4.8 / Math.min(1, width / Math.max(height, 1)), 4.8, 12);
export const relayZoomDistance = (distance: number) => clamp(distance, 3, 14);
const normalize = (v: Vec3): Vec3 => { const length = Math.hypot(...v) || 1; return v.map(n => n / length) as Vec3; };
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
  }
  return out;
}
export function perspective(aspect: number): Float32Array {
  const f = 1 / Math.tan(Math.PI / 8), near = 0.1, far = 100;
  return new Float32Array([f / Math.max(0.1, aspect), 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
export function lookAt(eye: Vec3, target: Vec3): Float32Array {
  const z = normalize(eye.map((n, i) => n - target[i]) as Vec3);
  const x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
export function cameraEye(camera: SceneCamera, relay = false, inspection = initialRelayInspection()): Vec3 {
  const horizontal = camera.distance * Math.cos(inspection.pitch);
  return relay ? [horizontal * Math.sin(inspection.yaw), camera.distance * Math.sin(inspection.pitch), horizontal * Math.cos(inspection.yaw)]
    : [camera.x, camera.distance * 0.94, camera.z + camera.distance * 0.342];
}
export function cameraMatrix(camera: SceneCamera, aspect: number, relay = false, inspection = initialRelayInspection()): Float32Array {
  // System: 20 degrees from vertical. Relay: an angled inspection view.
  return multiply(perspective(aspect), lookAt(cameraEye(camera, relay, inspection), relay ? [0, 0, 0] : [camera.x, 0, camera.z]));
}
export function billboardMatrix(position: Vec3, radius: number): Float32Array {
  const length = Math.hypot(0.94, 0.342), up = 0.342 / length, elevation = 0.94 / length;
  return new Float32Array([radius, 0, 0, 0, 0, up * radius, -elevation * radius, 0, 0, elevation, up, 0, ...position, 1]);
}
export function projectedBodyRadius(position: Vec3, radius: number, camera: SceneCamera, width: number, height: number): number {
  const matrix = cameraMatrix(camera, width / Math.max(height, 1));
  const center = project(position, matrix, width, height), edge = project([position[0] + radius, position[1], position[2]], matrix, width, height);
  return center && edge ? Math.abs(edge.x - center.x) : 0;
}
export const bodyDetailLevel = (radiusPixels: number) => radiusPixels < 14 ? 0 : radiusPixels < 40 ? 1 : 2;
export function modelMatrix(position: Vec3, scale: Vec3, rotation = 0): Float32Array {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return new Float32Array([c * scale[0], 0, -s * scale[0], 0, 0, scale[1], 0, 0, s * scale[2], 0, c * scale[2], 0, ...position, 1]);
}
export function orientedModelMatrix(position: Vec3, scale: Vec3, yaw = 0, pitch = 0, roll = 0): Float32Array {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const translation = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...position, 1]);
  const rotateY = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
  const rotateX = new Float32Array([1, 0, 0, 0, 0, cp, -sp, 0, 0, sp, cp, 0, 0, 0, 0, 1]);
  const rotateZ = new Float32Array([cr, sr, 0, 0, -sr, cr, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const resize = new Float32Array([scale[0], 0, 0, 0, 0, scale[1], 0, 0, 0, 0, scale[2], 0, 0, 0, 0, 1]);
  return multiply(translation, multiply(rotateY, multiply(rotateZ, multiply(rotateX, resize))));
}
export function project(position: Vec3, matrix: Float32Array, width: number, height: number) {
  const p = [...position, 1];
  const clip = [0, 1, 2, 3].map(row => p.reduce((sum, v, i) => sum + v * matrix[i * 4 + row], 0));
  if (clip[3] <= 0) return null;
  return { x: (clip[0] / clip[3] + 1) * width / 2, y: (1 - clip[1] / clip[3]) * height / 2, depth: clip[2] / clip[3] };
}
export function pickPlanet(x: number, y: number, camera: SceneCamera, width: number, height: number, available: readonly DemoPlanet[]): DemoPlanet | undefined {
  const matrix = cameraMatrix(camera, width / Math.max(1, height));
  return scenePlanets.filter(p => available.includes(p.id)).map(p => {
    const point = project(p.position, matrix, width, height);
    const radius = Math.max(28, projectedBodyRadius(p.position, p.size, camera, width, height) + 8);
    return { id: p.id, distance: point && point.depth >= -1 && point.depth <= 1 ? Math.hypot(point.x - x, point.y - y) / radius : Infinity };
  }).filter(p => p.distance <= 1).sort((a, b) => a.distance - b.distance)[0]?.id;
}
export function overviewCamera(width: number, height: number, available: readonly DemoPlanet[]): SceneCamera {
  const extent = Math.max(3.1, ...scenePlanets.filter(p => available.includes(p.id)).map(p => p.orbit + 0.5));
  const distance = clamp(extent / (Math.tan(Math.PI / 8) * Math.min(1, width / Math.max(height, 1))) * 1.17, 8, 40);
  return { x: 0, z: 0, distance };
}
export function focusedCamera(planet: DemoPlanet, width = 390, height = 550): SceneCamera {
  const body = scenePlanets.find(p => p.id === planet)!;
  // Fit the selected sphere to ~42% of the shorter scene dimension, without HUD occlusion.
  const diameter = Math.max(1, Math.min(width, height) * 0.42);
  const distance = clamp(body.size * Math.max(1, height) / (Math.tan(Math.PI / 8) * diameter), minimumCameraDistance, 8);
  return { x: body.position[0], z: body.position[2], distance };
}
export function screenToGround(camera: SceneCamera, x: number, y: number, width: number, height: number): Vec3 | null {
  // Ray from the same tilted perspective camera used to draw the system.
  const length = Math.hypot(0.94, 0.342), elevation = 0.94 / length, tilt = 0.342 / length;
  const tangent = Math.tan(Math.PI / 8), aspect = Math.max(0.1, width / Math.max(height, 1));
  const nx = (2 * x / Math.max(width, 1) - 1) * tangent * aspect;
  const ny = (1 - 2 * y / Math.max(height, 1)) * tangent;
  const rayY = -elevation + ny * tilt, rayZ = -tilt - ny * elevation;
  if (rayY >= -0.00001) return null;
  const distance = -camera.distance * 0.94 / rayY;
  return [camera.x + nx * distance, 0, camera.z + camera.distance * 0.342 + rayZ * distance];
}
export function panCamera(camera: SceneCamera, dx: number, dy: number, width: number, height: number,
  anchorX = width / 2, anchorY = height / 2, distance = camera.distance): SceneCamera {
  const next = { ...camera, distance: clamp(distance, minimumCameraDistance, 40) };
  const start = screenToGround(camera, anchorX, anchorY, width, height);
  const end = screenToGround(next, anchorX + dx, anchorY + dy, width, height);
  if (start && end) return { ...next, x: clamp(camera.x + start[0] - end[0], -10, 10), z: clamp(camera.z + start[2] - end[2], -10, 10) };
  // Defensive fallback for coordinates beyond the camera horizon.
  const units = next.distance * 2 * Math.tan(Math.PI / 8) / Math.max(height, 1);
  return { ...next, x: clamp(camera.x - dx * units, -10, 10), z: clamp(camera.z - dy * units / 0.94, -10, 10) };
}

export function sphereMesh(latitude = 18, longitude = 28): SceneMesh {
  const vertices: number[] = [];
  const vertex = (lat: number, lon: number) => {
    const a = lat / latitude * Math.PI, b = lon / longitude * Math.PI * 2;
    const n = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)];
    vertices.push(...n, ...n);
  };
  for (let lat = 0; lat < latitude; lat++) for (let lon = 0; lon < longitude; lon++) {
    vertex(lat, lon); vertex(lat, lon + 1); vertex(lat + 1, lon);
    vertex(lat, lon + 1); vertex(lat + 1, lon + 1); vertex(lat + 1, lon);
  }
  return { vertices: new Float32Array(vertices), count: vertices.length / 6 };
}
export function ringMesh(): SceneMesh {
  const vertices: number[] = [];
  for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; vertices.push(Math.cos(a), 0, Math.sin(a), 0, 1, 0); }
  return { vertices: new Float32Array(vertices), count: vertices.length / 6 };
}
export function boxMesh(): SceneMesh {
  const vertices: number[] = [];
  const faces = [
    [[0, 0, 1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
    [[0, 0, -1], [1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
    [[1, 0, 0], [1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
    [[-1, 0, 0], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
    [[0, 1, 0], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
    [[0, -1, 0], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
  ];
  for (const [normal, ...corners] of faces) for (const index of [0, 1, 2, 0, 2, 3]) vertices.push(...corners[index].map(n => n * 0.5), ...normal);
  return { vertices: new Float32Array(vertices), count: vertices.length / 6 };
}
export function cylinderMesh(segments = 20): SceneMesh {
  const vertices: number[] = [];
  const vertex = (position: Vec3, normal: Vec3) => vertices.push(...position, ...normal);
  for (let i = 0; i < Math.max(3, segments); i++) {
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
    const ax = Math.cos(a) * 0.5, az = Math.sin(a) * 0.5, bx = Math.cos(b) * 0.5, bz = Math.sin(b) * 0.5;
    const an = normalize([Math.cos(a), 0, Math.sin(a)]), bn = normalize([Math.cos(b), 0, Math.sin(b)]);
    vertex([ax, -0.5, az], an); vertex([bx, -0.5, bz], bn); vertex([ax, 0.5, az], an);
    vertex([ax, 0.5, az], an); vertex([bx, -0.5, bz], bn); vertex([bx, 0.5, bz], bn);
    vertex([0, 0.5, 0], [0, 1, 0]); vertex([ax, 0.5, az], [0, 1, 0]); vertex([bx, 0.5, bz], [0, 1, 0]);
    vertex([0, -0.5, 0], [0, -1, 0]); vertex([bx, -0.5, bz], [0, -1, 0]); vertex([ax, -0.5, az], [0, -1, 0]);
  }
  return { vertices: new Float32Array(vertices), count: vertices.length / 6 };
}
export function billboardMesh(): SceneMesh {
  return { vertices: new Float32Array([-1, -1, 0, 0, 0, 1, 1, -1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1,
    -1, -1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, -1, 1, 0, 0, 0, 1]), count: 6 };
}
export function dishMesh(): SceneMesh {
  const vertices: number[] = [];
  const vertex = (r: number, a: number) => {
    const x = r * Math.cos(a), z = r * Math.sin(a);
    vertices.push(x, r * r * 0.4, z, ...normalize([-0.8 * x, 1, -0.8 * z]));
  };
  for (let ring = 0; ring < 6; ring++) for (let slice = 0; slice < 32; slice++) {
    const r = ring / 6, next = (ring + 1) / 6, a = slice / 32 * Math.PI * 2, b = (slice + 1) / 32 * Math.PI * 2;
    vertex(r, a); vertex(next, a); vertex(r, b); vertex(r, b); vertex(next, a); vertex(next, b);
  }
  return { vertices: new Float32Array(vertices), count: vertices.length / 6 };
}

export { sceneVertexShader, sceneFragmentShader } from './guardian-materials';
