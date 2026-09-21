// Emissive sphere-space surface: no flat sticker rotation, external texture or backdrop.
export const menuStarShader = `
uniform float2 size;
uniform float bodyRatio;
uniform float phase;
uniform float seed;
uniform float detail;
uniform float3 baseColor;
uniform float3 highlightColor;
float hash31(float3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float noise3(float3 p) {
  float3 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(cell), hash31(cell + float3(1.0, 0.0, 0.0)), f.x),
    mix(hash31(cell + float3(0.0, 1.0, 0.0)), hash31(cell + float3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(cell + float3(0.0, 0.0, 1.0)), hash31(cell + float3(1.0, 0.0, 1.0)), f.x),
    mix(hash31(cell + float3(0.0, 1.0, 1.0)), hash31(cell + float3(1.0)), f.x), f.y), f.z);
}
float3 toneMap(float3 color) {
  return pow(color / (color + float3(0.8)), float3(1.0 / 2.2));
}
half4 main(float2 position) {
  float radius = min(size.x, size.y) * bodyRatio;
  float2 uv = (position - size * 0.5) / radius;
  float r = length(uv);
  float haloEdge = min(1.55, 0.49 / bodyRatio);
  if (r >= haloEdge) return half4(0.0);
  float coverage = 1.0 - smoothstep(1.0 - 0.8 / radius, 1.0 + 0.5 / radius, r);
  float haloAlpha = 0.16 * exp(-max(r - 1.0, 0.0) * 7.0)
    * (1.0 - smoothstep(1.08, haloEdge, r)) * (1.0 - coverage);
  float3 bodyColor = baseColor;
  if (r < 1.0 + 0.5 / radius) {
    float3 normal = normalize(float3(uv, sqrt(max(0.0, 1.0 - dot(uv, uv)))));
    float3 tilted = float3(normal.x * 0.9701 + normal.y * 0.2425,
      normal.y * 0.9701 - normal.x * 0.2425, normal.z);
    float3 surface = float3(tilted.x * cos(phase) + tilted.z * sin(phase),
      tilted.y, tilted.z * cos(phase) - tilted.x * sin(phase));
    float3 offset = float3(seed * 0.071, seed * 0.137, seed * 0.193);
    float3 convection = float3(sin(phase) * 0.35, cos(phase) * 0.25, sin(phase * 2.0) * 0.15);
    float granules = noise3(surface * 13.0 + offset + convection);
    if (detail > 0.5) granules = granules * 0.7 + noise3(surface * 31.0 + offset - convection) * 0.3;
    float spots = smoothstep(0.68, 0.85, noise3(surface * 4.0 + offset));
    float3 linearBase = pow(baseColor, float3(2.2));
    float3 linearHot = pow(highlightColor, float3(2.2));
    float3 plasma = mix(linearBase, linearHot, smoothstep(0.24, 0.83, granules) * 0.33);
    float limb = 0.48 + 0.52 * pow(max(normal.z, 0.0), 0.42);
    float pulse = 1.0 + sin(phase * 2.0) * 0.012;
    bodyColor = toneMap(plasma * (1.45 + granules * 1.4) * limb * (1.0 - spots * 0.23) * pulse);
  }
  // Skia expects premultiplied color; alpha fades cleanly on any menu background.
  return half4(bodyColor * coverage + baseColor * haloAlpha, coverage + haloAlpha);
}
`;
