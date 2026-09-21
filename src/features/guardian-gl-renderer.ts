import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { billboardMatrix, billboardMesh, bodyDetailLevel, boxMesh, cameraEye, cameraMatrix, cylinderMesh, dishMesh, modelMatrix, orientedModelMatrix, projectedBodyRadius, ringMesh, sceneFragmentShader, scenePlanets, sceneVertexShader, sphereMesh, type RelayInspection, type SceneCamera, type SceneMesh, type Vec3 } from './guardian-scene';
import { navigableDemoPlanets, type DemoPlanet } from './guardian-demo-model';

export type RenderScene = { mode: 'system' | 'relay'; camera: SceneCamera; selected: DemoPlanet; connected: readonly DemoPlanet[]; relayLevel: number; time: number; relayView?: RelayInspection };
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
    const sphere = spheres[0], halo = upload(billboardMesh()), ring = upload(ringMesh()), box = upload(boxMesh()), cylinder = upload(cylinderMesh()), dish = upload(dishMesh());
    const position = gl.getAttribLocation(program, 'aPosition'), normal = gl.getAttribLocation(program, 'aNormal');
    const uniforms = Object.fromEntries(['uViewProjection', 'uModel', 'uColor', 'uMaterial', 'uAlpha', 'uTime', 'uCamera', 'uSeed', 'uStyle', 'uDetail', 'uReveal', 'uCloud'].map(name => [name, gl.getUniformLocation(program, name)]));
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
    const relay = (at: Vec3, scale: number, level: number, rotation: number) => {
      type PartRotation = { yaw?: number; pitch?: number; roll?: number };
      const part = (mesh: typeof sphere, p: Vec3, size: Vec3, color: Vec3, orientation: PartRotation = {}) => {
        const c = Math.cos(rotation), s = Math.sin(rotation);
        const world: Vec3 = [at[0] + (p[0] * c + p[2] * s) * scale, at[1] + p[1] * scale, at[2] + (p[2] * c - p[0] * s) * scale];
        const resized = size.map(v => v * scale) as Vec3;
        draw(mesh, world, resized, color, 2, 1, rotation, false, {
          matrix: orientedModelMatrix(world, resized, rotation + (orientation.yaw ?? 0), orientation.pitch ?? 0, orientation.roll ?? 0),
        });
      };
      const detailed = scale >= 0.5;
      const gold: Vec3 = [0.72, 0.53, 0.25], darkGold: Vec3 = [0.42, 0.31, 0.16];
      const silver: Vec3 = [0.7, 0.74, 0.82], darkMetal: Vec3 = [0.25, 0.29, 0.38];
      const solar: Vec3 = [0.08, 0.17, 0.42], solarHighlight: Vec3 = [0.23, 0.38, 0.72];
      const lavender: Vec3 = [0.79, 0.71, 0.96];

      // Satin-metal bus with a gold insulation face, matching the visual reference.
      part(box, [0, 0, 0], [0.66, 0.76, 0.66], silver);
      part(box, [0, 0, 0.336], [0.46, 0.53, 0.018], gold);
      part(box, [0, 0.36, 0], [0.73, 0.08, 0.73], darkMetal);
      part(box, [0, -0.39, 0], [0.58, 0.06, 0.58], darkMetal);

      if (detailed) {
        // Raised corner rails and small pieces of visible spacecraft hardware.
        for (const x of [-0.345, 0.345]) for (const z of [-0.345, 0.345]) part(box, [x, 0, z], [0.035, 0.75, 0.035], [0.83, 0.86, 0.93]);
        part(box, [-0.18, 0.45, 0.05], [0.2, 0.13, 0.23], silver);
        part(box, [0.13, 0.44, -0.12], [0.24, 0.11, 0.18], darkMetal);
        part(cylinder, [0, -0.52, 0], [0.26, 0.22, 0.26], silver);
        part(cylinder, [0, -0.65, 0], [0.15, 0.08, 0.15], gold);
        for (const x of [-0.16, 0.16]) for (const y of [-0.19, 0.19]) part(sphere, [x, y, 0.36], [0.025, 0.025, 0.025], [0.9, 0.86, 0.72]);
      }

      for (const side of [-1, 1]) {
        // Two-piece articulated boom and a visible rotary hinge.
        part(box, [side * 0.5, 0, 0], [0.34, 0.07, 0.07], silver);
        part(box, [side * 0.74, 0.04, 0], [0.2, 0.055, 0.055], gold, { roll: side * 0.22 });
        if (detailed) {
          part(cylinder, [side * 0.63, 0, 0], [0.12, 0.12, 0.12], darkMetal, { roll: Math.PI / 2 });
          part(cylinder, [side * 0.86, 0.08, 0], [0.1, 0.09, 0.1], gold, { roll: Math.PI / 2 });
        }

        const panelX = side * 1.4;
        part(box, [panelX, 0.08, 0], [1.62, 0.06, 1.25], solar);
        if (detailed) {
          // Strong frame and broad photovoltaic cells instead of noisy micro-grid detail.
          for (const z of [-0.625, 0.625]) part(box, [panelX, 0.115, z], [1.7, 0.025, 0.028], silver);
          for (const x of [panelX - side * 0.81, panelX + side * 0.81]) part(box, [x, 0.115, 0], [0.028, 0.025, 1.28], silver);
          for (let i = 1; i < 4; i++) part(box, [panelX - side * 0.81 + side * i * 0.405, 0.116, 0], [0.016, 0.026, 1.22], solarHighlight);
          part(box, [panelX, 0.117, 0], [1.58, 0.027, 0.015], solarHighlight);
        }
        if (level >= 3) {
          part(box, [panelX, 0.08, -0.9], [1.62, 0.06, 0.46], [0.16, 0.2, 0.54]);
          if (detailed) part(box, [panelX, 0.116, -0.9], [1.58, 0.025, 0.018], lavender);
        }
      }

      // Angled high-gain antenna, feed horn and upper sensor mast.
      part(cylinder, [0.1, 0.64, 0], [0.08, 0.46, 0.08], silver, { roll: -0.28 });
      part(cylinder, [0.17, 0.84, 0], [0.15, 0.08, 0.15], gold, { roll: -0.28 });
      part(dish, [0.23, 0.88, 0], [0.52, 0.52, 0.52], [0.82, 0.84, 0.9], { roll: -0.5, pitch: 0.08 });
      if (detailed) {
        part(cylinder, [0.37, 1.08, 0], [0.035, 0.34, 0.035], darkMetal, { roll: -0.5, pitch: 0.08 });
        part(sphere, [0.46, 1.21, 0], [0.07, 0.07, 0.07], gold);
        part(cylinder, [-0.22, 0.67, -0.13], [0.05, 0.44, 0.05], silver, { roll: 0.16 });
      }
      part(sphere, [-0.25, 0.91, -0.13], [0.075, 0.075, 0.075], lavender);
      if (level >= 4) {
        part(box, [0.36, -0.06, 0.25], [0.14, 0.22, 0.42], silver);
        part(dish, [0.42, 0.21, 0.25], [0.3, 0.3, 0.3], lavender, { roll: -0.3 });
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
      gl.uniform3fv(uniforms.uCamera, cameraEye(scene.camera, scene.mode === 'relay', scene.relayView));
      if (scene.mode === 'relay') {
        relay([0, 0, 0], 1, scene.relayLevel, 0);
      } else {
        const available = navigableDemoPlanets(scene.connected);
        for (const planet of scenePlanets) {
          if (!available.includes(planet.id)) continue;
          const selected = scene.selected === planet.id, connected = scene.connected.includes(planet.id);
          draw(ring, [0, -0.015, 0], [planet.orbit, 1, planet.orbit], selected ? [0.67, 0.57, 0.85] : [0.25, 0.27, 0.38], 3, selected ? 0.65 : 0.35, 0, true);
          const detail = bodyDetailLevel(projectedBodyRadius(planet.position, planet.size, scene.camera, width, height));
          draw(spheres[detail], planet.position, [planet.size, planet.size, planet.size], connected ? planet.color : [0.29, 0.27, 0.38], 1, 1, 0, false,
            { seed: planet.seed, style: planet.surfaceStyle, detail: detail / 2, reveal: connected ? 1 : 0, clouds: connected && detail > 0 ? planet.atmosphere * 0.65 : 0 });
          if (selected) draw(ring, [planet.position[0], -0.02, planet.position[2]], [planet.size * 1.65, 1, planet.size * 1.65], [0.8, 0.72, 0.97], 3, 0.9, 0, true);
          if (connected) {
            const angle = scene.time * 0.2 + planet.orbit;
            relay([planet.position[0] + Math.cos(angle) * 0.5, 0.15, planet.position[2] + Math.sin(angle) * 0.5], 0.06, 2, angle);
          }
        }
        const starDetail = bodyDetailLevel(projectedBodyRadius([0, 0, 0], 0.65, scene.camera, width, height));
        draw(spheres[starDetail], [0, 0, 0], [0.65, 0.65, 0.65], [0.94, 0.42, 0.2], 0, 1, 0, false, { detail: starDetail / 2 });
        const angle = scene.time * 0.08;
        relay([Math.cos(angle) * 1.15, 0.2, Math.sin(angle) * 1.15], 0.14, scene.relayLevel, angle);
        // Transparent passes follow opaque geometry; depth testing keeps foreground objects crisp.
        gl.depthMask(false);
        draw(halo, [0, 0, 0], [1, 1, 1], [1, 0.5, 0.27], 5, 0.24, 0, false, { matrix: billboardMatrix([0, 0, 0], 1.7) });
        gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
        for (const planet of scenePlanets) {
          if (!scene.connected.includes(planet.id) || planet.atmosphere <= 0) continue;
          const detail = bodyDetailLevel(projectedBodyRadius(planet.position, planet.size, scene.camera, width, height));
          const size = planet.size * 1.045;
          draw(spheres[detail], planet.position, [size, size, size], [0.45, 0.64, 0.85], 4, planet.atmosphere);
        }
        gl.disable(gl.CULL_FACE); gl.depthMask(true);
      }
      gl.flush(); gl.endFrameEXP();
    };
    return { render, dispose };
  } catch (error) { dispose(); throw error; }
}
