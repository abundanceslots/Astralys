// Seam-free sphere-space materials. No image downloads or unique heavy models per planet.
export const sceneVertexShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uViewProjection;
uniform mat4 uModel;
varying mediump vec3 vNormal;
varying mediump vec3 vLocal;
varying mediump vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vLocal = aPosition;
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uViewProjection * world;
}`;
export const sceneFragmentShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uColor;
uniform float uMaterial;
uniform float uAlpha;
uniform float uTime;
uniform vec3 uCamera;
uniform float uSeed;
uniform float uStyle;
uniform float uDetail;
uniform float uReveal;
uniform float uCloud;
varying mediump vec3 vNormal;
varying mediump vec3 vLocal;
varying mediump vec3 vWorld;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float valueNoise(vec3 p) {
  vec3 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(cell), hash31(cell + vec3(1.0, 0.0, 0.0)), f.x),
    mix(hash31(cell + vec3(0.0, 1.0, 0.0)), hash31(cell + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(cell + vec3(0.0, 0.0, 1.0)), hash31(cell + vec3(1.0, 0.0, 1.0)), f.x),
    mix(hash31(cell + vec3(0.0, 1.0, 1.0)), hash31(cell + vec3(1.0)), f.x), f.y), f.z);
}
float terrain(vec3 p) {
  vec3 offset = vec3(uSeed * 0.137, uSeed * 0.071, uSeed * 0.193);
  return valueNoise(p * 3.7 + offset) * 0.68 + valueNoise(p * 11.0 + offset) * 0.32;
}
float craterHeight(vec3 p) {
  vec3 cell = floor(p), f = fract(p) - 0.5;
  // Compact craters fade before cell edges, avoiding grid seams in finite-difference normals.
  vec3 center = vec3(hash31(cell), hash31(cell + vec3(7.0)), hash31(cell + vec3(13.0))) * 0.12 - 0.06;
  float radius = 0.16 + hash31(cell + vec3(3.0)) * 0.14;
  float d = length(f - center), rim = (d - radius) / 0.036;
  float taper = 1.0 - smoothstep(radius + 0.07, radius + 0.11, d);
  return (-0.09 * (1.0 - smoothstep(0.0, radius, d)) + 0.025 * exp(-rim * rim)) * taper;
}
float heightAt(vec3 p) {
  float h = terrain(p);
  if (uStyle < 0.5) h += craterHeight(p * 5.5 + vec3(uSeed * 0.1));
  if (uStyle > 1.5 && uStyle < 2.5) h = h * 0.45 + abs(valueNoise(p * 12.0 + vec3(uSeed)) - 0.5) * 0.13;
  return h;
}
vec3 rotateSurface(vec3 p, float angle) {
  return vec3(p.x * cos(angle) - p.z * sin(angle), p.y, p.x * sin(angle) + p.z * cos(angle));
}
vec3 displayColor(vec3 linearColor) {
  vec3 mapped = linearColor / (linearColor + vec3(0.8));
  return pow(max(mapped, vec3(0.0)), vec3(1.0 / 2.2));
}
void main() {
  if (uMaterial > 4.5) {
    float r = length(vLocal.xy);
    float edge = 1.0 - smoothstep(0.65, 1.0, r);
    float wisps = 0.9 + 0.1 * valueNoise(vec3(vLocal.xy * 7.0, uTime * 0.04));
    float glow = exp(-r * r * 4.0) * edge * wisps;
    gl_FragColor = vec4(uColor, uAlpha * glow);
    return;
  }
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorld);
  vec3 light = uMaterial < 1.5 || uMaterial > 3.5 ? normalize(-vWorld) : normalize(vec3(-3.0, 6.0, 4.0));
  if (uMaterial > 3.5) {
    float rim = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.0);
    float daylight = smoothstep(-0.2, 0.65, dot(normal, light));
    gl_FragColor = vec4(uColor, uAlpha * rim * (0.2 + 0.8 * daylight));
    return;
  }
  if (uMaterial > 2.5) { gl_FragColor = vec4(uColor, uAlpha); return; }
  float angle = uTime * (0.025 + fract(uSeed * 0.137) * 0.018);
  vec3 surface = rotateSurface(normalize(vLocal), angle);
  vec3 albedo = pow(max(uColor, vec3(0.001)), vec3(2.2));
  if (uMaterial < 0.5) {
    vec3 plasma = surface * 14.0 + vec3(uTime * 0.035, sin(uTime * 0.07) * 0.35, 0.0);
    float cells = valueNoise(plasma);
    if (uDetail > 0.35) cells = cells * 0.7 + valueNoise(plasma * 2.3) * 0.3;
    float darkSpots = smoothstep(0.62, 0.8, terrain(surface * 1.3));
    float limb = 0.5 + 0.5 * pow(max(dot(normal, view), 0.0), 0.4);
    vec3 hot = mix(albedo, vec3(1.0, 0.53, 0.18), smoothstep(0.35, 0.85, cells) * 0.5);
    float pulse = 1.0 + 0.025 * sin(uTime * 0.4);
    gl_FragColor = vec4(displayColor(hot * (1.65 + cells * 1.8) * limb * (1.0 - darkSpots * 0.32) * pulse), uAlpha);
    return;
  }
  float roughness = 0.72;
  if (uMaterial < 1.5 && uReveal > 0.5) {
    float height = heightAt(surface);
    float fine = uDetail > 0.35 ? valueNoise(surface * 42.0 + vec3(uSeed)) - 0.5 : 0.0;
    albedo *= 0.58 + height * 0.92 + fine * 0.08;
    albedo = mix(albedo, albedo * vec3(1.22, 1.13, 0.96), smoothstep(0.5, 0.73, terrain(surface * 1.2)) * 0.45);
    if (uStyle > 1.5 && uStyle < 2.5) {
      float frost = smoothstep(0.43, 0.66, height + abs(surface.y) * 0.22);
      albedo = mix(albedo, vec3(0.59, 0.76, 0.84), frost * 0.7);
      roughness = 0.4;
    }
    // Banding is available for gas-planet art profiles; the demo's rocky worlds do not use it.
    if (uStyle > 2.5 && uStyle < 3.5) {
      float bands = sin(surface.y * 29.0 + terrain(surface * 2.0) * 5.0);
      albedo *= 0.8 + bands * 0.2; roughness = 0.65;
    }
    if (uCloud > 0.001) {
      vec3 cloudSurface = rotateSurface(normalize(vLocal), angle * 0.84 + 0.16);
      float clouds = clamp(smoothstep(0.52, 0.7, terrain(cloudSurface * 1.6)) * uCloud * 2.0, 0.0, 1.0);
      albedo = mix(albedo, vec3(0.8, 0.84, 0.87), clouds);
    }
    if (uDetail > 0.35) {
      float e = 0.012;
      vec3 gradient = vec3(heightAt(surface + vec3(e, 0.0, 0.0)), heightAt(surface + vec3(0.0, e, 0.0)), heightAt(surface + vec3(0.0, 0.0, e))) - vec3(height);
      gradient /= e;
      gradient = rotateSurface(gradient, -angle);
      gradient -= normal * dot(gradient, normal);
      normal = normalize(normal - gradient * mix(0.03, 0.045, uDetail));
    }
  }
  float ndl = max(dot(normal, light), 0.0);
  float daylight = smoothstep(-0.08, 0.12, dot(normalize(vNormal), light));
  vec3 halfVector = normalize(light + view);
  float specular = pow(max(dot(normal, halfVector), 0.0), mix(65.0, 14.0, roughness)) * (1.0 - roughness) * 0.14 * daylight;
  vec3 color = albedo * (0.045 + 0.95 * ndl) + vec3(specular);
  if (uMaterial > 1.5) color += pow(albedo, vec3(0.6)) * specular * 0.35;
  gl_FragColor = vec4(displayColor(color), uAlpha);
}`;
