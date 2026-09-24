import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { cometPosition, type SceneComet, billboardMatrix, billboardMesh, bodyDetailLevel, boxMesh, cameraEye, cameraMatrix, cylinderMesh, dishMesh, modelMatrix, orientedModelMatrix, projectedBodyRadius, ringMesh, sceneFragmentShader, scenePlanets, bodiesAt, sceneVertexShader, sphereMesh, type RelayInspection, type SceneCamera, type SceneMesh, type Vec3 } from './guardian-scene';
import { navigableDemoPlanets, nextDemoPlanet, type DemoPlanet } from './guardian-demo-model';

/** Trajectoire vers la prochaine planète : un arc de points, légèrement bombé au-dessus du plan. */
const ROUTE_DOTS = 22;
function routePoint(from: Vec3, to: Vec3, t: number): Vec3 {
  const lift = Math.sin(Math.PI * t) * Math.hypot(to[0] - from[0], to[2] - from[2]) * 0.18;
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + lift, from[2] + (to[2] - from[2]) * t];
}

/** Nuage de poussière qui cache une planète verrouillée : 7 volutes autour d'elle. */
const VEIL_PUFFS: readonly [number, number, number, number][] = [
  [0, 0, 0, 2.3], [0.9, 0.25, 0.4, 1.7], [-0.85, 0.15, -0.3, 1.8], [0.3, 0.35, -0.95, 1.6],
  [-0.35, 0.3, 0.9, 1.6], [1.1, -0.1, -0.6, 1.3], [-1.05, -0.05, 0.75, 1.4],
];

export type RenderScene = {
  mode: 'system' | 'relay'; camera: SceneCamera; selected: DemoPlanet; connected: readonly DemoPlanet[]; relayLevel: number; time: number; relayView?: RelayInspection;
  /** Planète vers laquelle une sonde voyage : son voile s'éclaircit avec la progression (0 → 1). */
  probeTarget?: DemoPlanet | null; probeProgress?: number;
  /** Planètes et étoile du système affiché (construits depuis la base) ; à défaut, système de démonstration. */
  bodies?: readonly RenderBody[]; star?: { color: Vec3; size: number };
  /** Horloge des orbites (secondes, heure réelle). Absente : planètes immobiles. */
  orbitClock?: number | null;
  /** Comète de passage (événement), à toucher pour la récolter. */
  comet?: SceneComet | null;
  /** Essaim de drones en anneau parasite autour d'une planète ; il perd un tiers à chaque niveau de défense réussi. */
  swarm?: { planet: DemoPlanet; stage: number; length: number } | null;
};
export type RenderBody = { id: DemoPlanet; orbit: number; size: number; position: Vec3; angle?: number; color: Vec3; seed: number; surfaceStyle: number; atmosphere: number };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export function createGuardianRenderer(gl: ExpoWebGLRenderingContext) {
  const buffers: WebGLBuffer[] = [], shaders: WebGLShader[] = [];
  let disposed = false;
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create 3D program');
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const shader of shaders) gl.deleteShader(shader);
    gl.deleteProgram(program);
  };
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, sceneVertexShader], [gl.FRAGMENT_SHADER, sceneFragmentShader]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Unable to create 3D shader');
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || '3D shader compilation failed');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || '3D program link failed');
    const upload = (mesh: SceneMesh) => {
      const buffer = gl.createBuffer(); if (!buffer) throw new Error('Unable to create 3D geometry');
      buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      return { buffer, count: mesh.count };
    };
    const spheres = [upload(sphereMesh(12, 18)), upload(sphereMesh(24, 36)), upload(sphereMesh(36, 56))];
    const sphere = spheres[0], halo = upload(billboardMesh()), ring = upload(ringMesh()), box = upload(boxMesh()), cylinder = upload(cylinderMesh()), dish = upload(dishMesh()), hex = upload(cylinderMesh(6));
    const position = gl.getAttribLocation(program, 'aPosition'), normal = gl.getAttribLocation(program, 'aNormal');
    const uniforms = Object.fromEntries(['uViewProjection', 'uModel', 'uColor', 'uMaterial', 'uAlpha', 'uTime', 'uCamera', 'uSeed', 'uStyle', 'uDetail', 'uReveal', 'uCloud', 'uStarLight'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    type Appearance = { seed?: number; style?: number; detail?: number; reveal?: number; clouds?: number; matrix?: Float32Array };
    const draw = (mesh: typeof sphere, at: Vec3, scale: Vec3, color: Vec3, material = 2, alpha = 1, rotation = 0, lines = false, appearance: Appearance = {}) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
      gl.uniformMatrix4fv(uniforms.uModel, false, appearance.matrix ?? modelMatrix(at, scale, rotation));
      gl.uniform3fv(uniforms.uColor, color); gl.uniform1f(uniforms.uMaterial, material); gl.uniform1f(uniforms.uAlpha, alpha);
      gl.uniform1f(uniforms.uSeed, appearance.seed ?? 0); gl.uniform1f(uniforms.uStyle, appearance.style ?? 0);
      gl.uniform1f(uniforms.uDetail, appearance.detail ?? 0); gl.uniform1f(uniforms.uReveal, appearance.reveal ?? 1); gl.uniform1f(uniforms.uCloud, appearance.clouds ?? 0);
      gl.drawArrays(lines ? gl.LINE_STRIP : gl.TRIANGLES, 0, mesh.count);
    };
    /**
     * Satellite relais, construit en pièces simples. `lod` : 0 = silhouette (loin), 1 = pièces principales, 2 = tous les détails.
     * Progression : ailes plus longues (niveaux 1, 3, 5, 7), radiateurs (3), parabole (4, plus grande au 7),
     * capteurs (5), deuxième paire d'ailes (6), couronne de balises (8).
     */
    const relay = (at: Vec3, scale: number, level: number, rotation: number, time: number, lod: number, starLit = true) => {
      type PartRotation = { yaw?: number; pitch?: number; roll?: number };
      type Look = { style?: number; cols?: number; rows?: number; material?: number; alpha?: number };
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const part = (mesh: typeof sphere, p: Vec3, size: Vec3, color: Vec3, orientation: PartRotation = {}, look: Look = {}) => {
        const world: Vec3 = [at[0] + (p[0] * c + p[2] * s) * scale, at[1] + p[1] * scale, at[2] + (p[2] * c - p[0] * s) * scale];
        const resized = size.map(v => v * scale) as Vec3;
        draw(mesh, world, resized, color, look.material ?? 2, look.alpha ?? 1, rotation, false, {
          matrix: orientedModelMatrix(world, resized, rotation + (orientation.yaw ?? 0), orientation.pitch ?? 0, orientation.roll ?? 0),
          style: look.style ?? 0, seed: look.cols ?? 0, clouds: look.rows ?? 0,
        });
      };
      const SOLAR = 10, FOIL = 11, BRUSHED = 12, RADIATOR = 13;
      const silver: Vec3 = [0.74, 0.77, 0.84], darkMetal: Vec3 = [0.2, 0.22, 0.3], gold: Vec3 = [0.8, 0.58, 0.24];
      const white: Vec3 = [0.88, 0.9, 0.94], lavender: Vec3 = [0.8, 0.72, 0.98], solar: Vec3 = [0.1, 0.16, 0.44];

      // Corps : isolation dorée, plateaux en métal brossé, tuyère.
      part(hex, [0, 0, 0], [0.62, 0.78, 0.62], gold, {}, { style: FOIL });
      if (lod >= 1) {
        for (const y of [-0.41, 0.41]) part(hex, [0, y, 0], [0.66, 0.05, 0.66], silver, {}, { style: BRUSHED });
        part(cylinder, [0, -0.52, 0], [0.22, 0.16, 0.22], darkMetal);
      }
      if (lod >= 2) {
        part(cylinder, [0, -0.64, 0], [0.16, 0.09, 0.16], gold, {}, { style: FOIL });
        if (level >= 3) for (const side of [-1, 1]) part(box, [0, 0, side * 0.33], [0.4, 0.58, 0.02], white, {}, { style: RADIATOR });
      }

      // Ailes solaires : segments de cellules, qui pivotent lentement pour suivre l'étoile.
      const segments = Math.min(5, 2 + Math.floor((Math.max(1, level) - 1) / 2));
      const pairs = level >= 6 ? 2 : 1;
      // Les ailes restent presque à plat (lisibles depuis la caméra) et basculent doucement : en passant face à l'étoile, les cellules brillent.
      const track = Math.sin(time * 0.25 + (starLit ? rotation : 0)) * 0.5;
      const SEG = 0.26, ROOT = 0.62;
      for (let pair = 0; pair < pairs; pair++) for (const side of [0, Math.PI]) {
        const a = pair * Math.PI / 2 + side, cx = Math.cos(a), cz = Math.sin(a);
        const wing: PartRotation = { yaw: -a, pitch: track };
        if (lod === 0) {
          const mid = ROOT + segments * SEG / 2;
          part(box, [cx * mid, 0, cz * mid], [segments * SEG, 0.03, 0.42], solar, wing, { style: SOLAR, cols: segments * 3, rows: 4 });
          continue;
        }
        part(box, [cx * 0.45, 0, cz * 0.45], [0.34, 0.035, 0.035], silver, { yaw: -a }, { style: BRUSHED });
        if (lod >= 2) part(box, [cx * (ROOT - 0.02), 0, cz * (ROOT - 0.02)], [0.04, 0.04, 0.24], darkMetal, wing);
        for (let k = 0; k < segments; k++) {
          const center = ROOT + SEG * (k + 0.5);
          part(box, [cx * center, 0, cz * center], [SEG - 0.02, 0.025, 0.42], solar, wing, { style: SOLAR, cols: 3, rows: 4 });
          if (lod >= 2) part(box, [cx * (center + SEG / 2), 0, cz * (center + SEG / 2)], [0.018, 0.03, 0.44], silver, wing, { style: BRUSHED });
        }
      }

      // Antenne : mât simple, puis parabole sur son bras avec cornet et haubans (niveau 4+, plus grande au 7).
      if (level >= 4 && lod >= 1) {
        const dishSize = level >= 7 ? 0.64 : 0.48, top = 0.78;
        part(cylinder, [0, 0.6, 0], [0.05, 0.3, 0.05], silver, {}, { style: BRUSHED });
        part(dish, [0, top, 0], [dishSize, dishSize, dishSize], white, {}, { style: BRUSHED });
        if (lod >= 2) {
          part(cylinder, [0, top + dishSize * 0.3, 0], [0.02, dishSize * 0.55, 0.02], silver);
          part(sphere, [0, top + dishSize * 0.58, 0], [0.05, 0.05, 0.05], gold, {}, { style: FOIL });
          for (let k = 0; k < 3; k++) {
            const q = k * Math.PI * 2 / 3;
            part(cylinder, [Math.cos(q) * dishSize * 0.24, top + dishSize * 0.34, Math.sin(q) * dishSize * 0.24], [0.012, dishSize * 0.6, 0.012], silver, { yaw: -q, roll: 0.6 });
          }
        }
      } else {
        part(cylinder, [0, 0.62, 0], [0.035, 0.34, 0.035], silver, {}, { style: BRUSHED });
        if (lod >= 1) part(sphere, [0, 0.8, 0], [0.07, 0.07, 0.07], lavender);
      }

      if (lod < 2) return;
      // Petits détails, visibles seulement de près.
      for (let k = 0; k < 4; k++) {
        const q = k * Math.PI / 2 + Math.PI / 4, qx = Math.cos(q), qz = Math.sin(q);
        part(box, [qx * 0.28, -0.3, qz * 0.28], [0.09, 0.09, 0.09], darkMetal, { yaw: -q });
        part(cylinder, [qx * 0.35, -0.36, qz * 0.35], [0.035, 0.06, 0.035], silver, { yaw: -q, roll: -0.7 });
      }
      for (const side of [-1, 1]) part(cylinder, [side * 0.22, -0.78, 0.1], [0.012, 0.5, 0.012], silver, { roll: side * 0.35 });
      if (level >= 3) for (const side of [-1, 1]) part(cylinder, [0.12 * side, 0.5, -0.14], [0.08, 0.12, 0.08], darkMetal, { roll: side * 0.5 });
      if (level >= 5) for (const side of [-1, 1]) {
        part(cylinder, [side * 0.1, 0.22, 0.42], [0.035, 0.22, 0.035], darkMetal, { pitch: 0.9 });
        part(sphere, [side * 0.1, 0.3, 0.52], [0.1, 0.1, 0.1], gold, {}, { style: FOIL });
      }
      if (level >= 8) for (let k = 0; k < 6; k++) {
        const angle = (k / 6) * Math.PI * 2;
        part(sphere, [Math.cos(angle) * 0.28, 0.5, Math.sin(angle) * 0.28], [0.045, 0.045, 0.045], lavender, {}, { material: 3 });
      }
      // Feux de position : rouge et vert, clignotements décalés.
      const blink = (phase: number) => ((time * 0.8 + phase) % 1 < 0.14 ? 1 : 0.18);
      part(sphere, [0.3, 0.34, 0.2], [0.05, 0.05, 0.05], [1, 0.25, 0.25], {}, { material: 3, alpha: blink(0) });
      part(sphere, [-0.3, 0.34, 0.2], [0.05, 0.05, 0.05], [0.3, 1, 0.5], {}, { material: 3, alpha: blink(0.5) });
    };
    /** Niveau de détail d'un satellite selon sa taille à l'écran. */
    const relayLod = (at: Vec3, scale: number, camera: SceneCamera, width: number, height: number) =>
      bodyDetailLevel(projectedBodyRadius(at, scale * 1.4, camera, width, height));
    /** Traînée : points qui s'estompent derrière le satellite, le long de son orbite. */
    const trail = (center: Vec3, radius: number, angle: number, y: number, count: number, spacing: number, size: number, alpha: number) => {
      for (let i = 1; i <= count; i++) {
        const q = angle - i * spacing, fade = 1 - i / (count + 1);
        draw(sphere, [center[0] + Math.cos(q) * radius, y, center[2] + Math.sin(q) * radius], [size * fade, size * fade, size * fade], [0.78, 0.72, 0.98], 3, alpha * fade);
      }
    };
    const render = (scene: RenderScene) => {
      if (disposed) return;
      const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
      gl.viewport(0, 0, width, height); gl.clearColor(7 / 255, 9 / 255, 17 / 255, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(program);
      gl.enableVertexAttribArray(position); gl.enableVertexAttribArray(normal);
      gl.uniformMatrix4fv(uniforms.uViewProjection, false, cameraMatrix(scene.camera, width / Math.max(height, 1), scene.mode === 'relay', scene.relayView));
      gl.uniform1f(uniforms.uTime, scene.time);
      gl.uniform1f(uniforms.uStarLight, scene.mode === 'relay' ? 0 : 1);
      gl.uniform3fv(uniforms.uCamera, cameraEye(scene.camera, scene.mode === 'relay', scene.relayView));
      if (scene.mode === 'relay') {
        relay([0, 0, 0], 1, scene.relayLevel, 0, scene.time, 2, false);
      } else {
        const available = navigableDemoPlanets(scene.connected);
        // Planètes à leur position du moment sur leur orbite.
        const bodies: readonly RenderBody[] = bodiesAt(scene.bodies ?? scenePlanets, scene.orbitClock);
        const starSize = scene.star?.size ?? 0.65, starColor: Vec3 = scene.star?.color ?? [0.94, 0.42, 0.2];
        const trails: (() => void)[] = [];
        // Planètes verrouillées : silhouette sombre sur une orbite pâle, cachée ensuite derrière un voile de poussière.
        for (const planet of bodies) {
          if (available.includes(planet.id)) continue;
          const selected = scene.selected === planet.id;
          draw(ring, [0, -0.015, 0], [planet.orbit, 1, planet.orbit], selected ? [0.55, 0.48, 0.72] : [0.2, 0.21, 0.3], 3, selected ? 0.4 : 0.14, 0, true);
          draw(spheres[0], planet.position, [planet.size, planet.size, planet.size], [0.16, 0.15, 0.22], 1, 1, 0, false, { seed: planet.seed, reveal: 0 });
        }
        for (const planet of bodies) {
          if (!available.includes(planet.id)) continue;
          const selected = scene.selected === planet.id, connected = scene.connected.includes(planet.id);
          draw(ring, [0, -0.015, 0], [planet.orbit, 1, planet.orbit], selected ? [0.67, 0.57, 0.85] : [0.25, 0.27, 0.38], 3, selected ? 0.65 : 0.35, 0, true);
          const detail = bodyDetailLevel(projectedBodyRadius(planet.position, planet.size, scene.camera, width, height));
          draw(spheres[detail], planet.position, [planet.size, planet.size, planet.size], connected ? planet.color : [0.29, 0.27, 0.38], 1, 1, 0, false,
            { seed: planet.seed, style: planet.surfaceStyle, detail: detail / 2, reveal: connected ? 1 : 0, clouds: connected && detail > 0 ? planet.atmosphere * 0.65 : 0 });
          if (selected) draw(ring, [planet.position[0], -0.02, planet.position[2]], [planet.size * 1.65, 1, planet.size * 1.65], [0.8, 0.72, 0.97], 3, 0.9, 0, true);
          if (connected) {
            const angle = scene.time * 0.2 + planet.orbit;
            const at: Vec3 = [planet.position[0] + Math.cos(angle) * 0.5, 0.15, planet.position[2] + Math.sin(angle) * 0.5];
            relay(at, 0.032, 2, angle, scene.time, relayLod(at, 0.032, scene.camera, width, height));
            trails.push(() => trail(planet.position, 0.5, angle, 0.15, 8, 0.09, 0.012, 0.45));
          }
        }
        // Route du satellite : de la dernière planète explorée vers la suivante (voilée).
        const destinationId = scene.probeTarget ?? nextDemoPlanet(scene.connected);
        const origin = bodies.find(p => p.id === available[available.length - 1]);
        const destination = destinationId ? bodies.find(p => p.id === destinationId) : undefined;
        let probeAt: Vec3 | null = null;
        if (origin && destination) {
          const travelling = scene.probeTarget === destination.id;
          const progress = travelling ? Math.min(1, Math.max(0, scene.probeProgress ?? 0)) : 0;
          // Départ et arrivée au bord des planètes, pas en leur centre.
          const span = Math.hypot(destination.position[0] - origin.position[0], destination.position[2] - origin.position[2]) || 1;
          const t0 = Math.min(0.4, origin.size * 1.6 / span), t1 = 1 - Math.min(0.4, destination.size * 1.8 / span);
          for (let i = 0; i <= ROUTE_DOTS; i++) {
            const t = t0 + (t1 - t0) * (i / ROUTE_DOTS);
            const done = travelling && i / ROUTE_DOTS <= progress;
            const dot = done ? 0.05 : 0.038;
            draw(sphere, routePoint(origin.position, destination.position, t), [dot, dot, dot], done ? [0.8, 0.72, 0.97] : [0.42, 0.4, 0.58], 3, done ? 0.95 : 0.55);
          }
          // Satellite : en route, il avance avec la sonde ; sinon il attend au départ en flottant doucement.
          const t = travelling ? t0 + (t1 - t0) * progress : t0 + Math.sin(scene.time * 1.4) * 0.012;
          probeAt = routePoint(origin.position, destination.position, t);
          probeAt = [probeAt[0], probeAt[1] + 0.12, probeAt[2]];
          const heading = Math.atan2(destination.position[2] - origin.position[2], destination.position[0] - origin.position[0]);
          relay(probeAt, 0.045, 2, -heading, scene.time, relayLod(probeAt, 0.045, scene.camera, width, height));
        }
        const starDetail = bodyDetailLevel(projectedBodyRadius([0, 0, 0], starSize, scene.camera, width, height));
        draw(spheres[starDetail], [0, 0, 0], [starSize, starSize, starSize], starColor, 0, 1, 0, false, { detail: starDetail / 2 });
        const angle = scene.time * 0.08;
        const mainAt: Vec3 = [Math.cos(angle) * 1.15, 0.2, Math.sin(angle) * 1.15];
        relay(mainAt, 0.065, scene.relayLevel, angle, scene.time, relayLod(mainAt, 0.065, scene.camera, width, height));
        // Anneau parasite : segments de drones rouges collés en anneau autour de la planète attaquée.
        const swarmBody = scene.swarm ? bodies.find(b => b.id === scene.swarm!.planet) : undefined;
        const SWARM_SLOTS = 26;
        const swarmRadius = swarmBody ? Math.max(0.42, swarmBody.size * 1.75 + 0.12) : 0;
        if (swarmBody && scene.swarm) {
          const remaining = Math.max(0, scene.swarm.length - scene.swarm.stage) / Math.max(1, scene.swarm.length);
          const visible = Math.round(SWARM_SLOTS * remaining);
          const spin = scene.time * 0.55;
          const arc = (Math.PI * 2 * swarmRadius) / SWARM_SLOTS;
          for (let i = 0; i < visible; i++) {
            const a = spin + (i / SWARM_SLOTS) * Math.PI * 2;
            const at: Vec3 = [swarmBody.position[0] + Math.cos(a) * swarmRadius, swarmBody.position[1] + Math.sin(a * 3 + scene.time * 2) * 0.012, swarmBody.position[2] + Math.sin(a) * swarmRadius];
            const glow = 0.75 + 0.25 * Math.sin(scene.time * 4 + i * 0.9);
            draw(box, at, [0.05, 0.04, arc * 0.62], [1, 0.3 * glow + 0.12, 0.24], 3, 1, -a);
          }
        }
        // Comète : noyau glacé (opaque), puis chevelure et queue dans la passe transparente.
        const outer = Math.max(3, ...bodies.map(b => b.orbit));
        const cometAt: Vec3 | null = scene.comet ? cometPosition(scene.comet, scene.orbitClock, outer) : null;
        if (cometAt) draw(sphere, cometAt, [0.11, 0.11, 0.11], [0.88, 0.98, 1], 3, 1);
        // Transparent passes follow opaque geometry; depth testing keeps foreground objects crisp.
        gl.depthMask(false);
        if (swarmBody && scene.swarm) {
          // Lueur rouge de l'anneau et halo d'alerte qui pulse autour de la planète siphonnée.
          const pulse = 0.5 + 0.5 * Math.sin(scene.time * 3);
          draw(ring, [swarmBody.position[0], swarmBody.position[1], swarmBody.position[2]], [swarmRadius, 1, swarmRadius], [1, 0.35, 0.28], 3, 0.35, 0, true);
          draw(ring, [swarmBody.position[0], swarmBody.position[1], swarmBody.position[2]], [swarmRadius * 1.12, 1, swarmRadius * 1.12], [1, 0.5, 0.42], 3, 0.18, 0, true);
          draw(halo, swarmBody.position, [1, 1, 1], [1, 0.3, 0.22], 5, 0.18 + 0.14 * pulse, 0, false, { matrix: billboardMatrix(swarmBody.position, swarmBody.size * 3.2) });
        }
        if (cometAt) {
          // La queue pointe toujours à l'opposé de l'étoile, plus longue près d'elle.
          const dist = Math.hypot(cometAt[0], cometAt[2]) || 1;
          const away: Vec3 = [cometAt[0] / dist, 0, cometAt[2] / dist];
          const length = clamp01(2.6 / dist) * 2.4 + 1.1;
          const pulse = 0.85 + Math.sin(scene.time * 3) * 0.15;
          draw(halo, cometAt, [1, 1, 1], [0.7, 0.95, 1], 5, 0.95 * pulse, 0, false, { matrix: billboardMatrix(cometAt, 0.62) });
          draw(halo, cometAt, [1, 1, 1], [1, 1, 1], 5, 0.8, 0, false, { matrix: billboardMatrix(cometAt, 0.2) });
          for (let i = 1; i <= 22; i++) {
            const k = i / 22, fade = (1 - k) * (1 - k * 0.5);
            const at: Vec3 = [cometAt[0] + away[0] * length * k, cometAt[1] + away[1] * length * k, cometAt[2] + away[2] * length * k];
            draw(halo, at, [1, 1, 1], [0.55 + 0.3 * (1 - k), 0.88, 1], 5, 0.7 * fade, 0, false, { matrix: billboardMatrix(at, 0.36 * (1 - k * 0.55)) });
          }
        }
        // Orbite pâle et traînée du relais principal, traînées des petits relais.
        draw(ring, [0, 0.2, 0], [1.15, 1, 1.15], [0.55, 0.5, 0.75], 3, 0.1, 0, true);
        trail([0, 0, 0], 1.15, angle, 0.2, 22, 0.022, 0.016, 0.7);
        for (const t of trails) t();
        draw(halo, [0, 0, 0], [1, 1, 1], [Math.min(1, starColor[0] * 1.06), Math.min(1, starColor[1] * 1.1), Math.min(1, starColor[2] * 1.2)], 5, 0.24, 0, false, { matrix: billboardMatrix([0, 0, 0], starSize * 2.6) });
        if (probeAt) draw(halo, probeAt, [1, 1, 1], [0.78, 0.72, 0.98], 5, scene.probeTarget ? 0.55 : 0.3, 0, false, { matrix: billboardMatrix(probeAt, 0.2) });
        gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
        for (const planet of bodies) {
          if (!scene.connected.includes(planet.id) || planet.atmosphere <= 0) continue;
          const detail = bodyDetailLevel(projectedBodyRadius(planet.position, planet.size, scene.camera, width, height));
          const size = planet.size * 1.045;
          draw(spheres[detail], planet.position, [size, size, size], [0.45, 0.64, 0.85], 4, planet.atmosphere);
        }
        gl.disable(gl.CULL_FACE);
        // Voiles de poussière devant les planètes à débloquer (dessinés en dernier, par-dessus).
        for (const planet of bodies) {
          if (available.includes(planet.id)) continue;
          const probing = scene.probeTarget === planet.id;
          const thinning = probing ? 1 - Math.min(1, Math.max(0, scene.probeProgress ?? 0)) * 0.65 : 1;
          const tint: Vec3 = probing ? [0.55, 0.5, 0.78] : [0.33, 0.3, 0.42];
          // Le voile est avancé vers la caméra pour passer DEVANT la sphère (sinon le test de profondeur la laisse visible).
          const eye = cameraEye(scene.camera, false);
          const toEye: Vec3 = [eye[0] - planet.position[0], eye[1] - planet.position[1], eye[2] - planet.position[2]];
          const len = Math.hypot(toEye[0], toEye[1], toEye[2]) || 1;
          const push = planet.size * 1.4 / len;
          VEIL_PUFFS.forEach(([ox, oy, oz, radius], index) => {
            const drift = scene.time * (0.05 + index * 0.012) + planet.seed;
            const at: Vec3 = [
              planet.position[0] + (ox + Math.cos(drift) * 0.18) * planet.size + toEye[0] * push,
              planet.position[1] + oy * planet.size * 0.6 + toEye[1] * push,
              planet.position[2] + (oz + Math.sin(drift) * 0.18) * planet.size + toEye[2] * push,
            ];
            draw(halo, at, [1, 1, 1], tint, 5, 0.95 * thinning, 0, false, { matrix: billboardMatrix(at, radius * planet.size) });
          });
        }
        gl.depthMask(true);
      }
      gl.flush(); gl.endFrameEXP();
    };
    return { render, dispose };
  } catch (error) { dispose(); throw error; }
}
