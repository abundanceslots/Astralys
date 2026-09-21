// Sphere-space texture: rotation changes the surface, not the lighting.
export const rotatingAstreShader = `
uniform float2 size;
uniform float angle;
float cloud(float3 p) {
  return sin(p.x * 7.0 + sin(p.z * 5.0) + p.y * 3.0) * 0.5
    + sin(p.z * 13.0 - p.x * 8.0 + sin(p.y * 11.0)) * 0.25
    + sin(p.x * 27.0 + p.z * 21.0 + p.y * 18.0) * 0.125;
}
half4 main(float2 position) {
  float radius = min(size.x, size.y) * 0.36;
  float2 uv = (position - size * 0.5) / radius;
  float distance = length(uv);
  if (distance > 1.36) return half4(0.0);
  float glow = 0.075 * exp(-max(distance - 1.0, 0.0) * 15.0)
    * (1.0 - smoothstep(1.15, 1.36, distance));
  float coverage = 1.0 - smoothstep(1.0 - 1.0 / radius, 1.0, distance);
  float3 color = float3(0.58, 0.49, 0.84);
  if (distance < 1.0) {
    float3 normal = float3(uv, sqrt(max(0.0, 1.0 - dot(uv, uv))));
    float3 tilted = float3(normal.x * 0.9701 + normal.y * 0.2425,
      normal.y * 0.9701 - normal.x * 0.2425, normal.z);
    float3 surface = float3(tilted.x * cos(angle) + tilted.z * sin(angle),
      tilted.y, tilted.z * cos(angle) - tilted.x * sin(angle));
    float turbulence = cloud(surface);
    float bands = sin(surface.y * 24.0 + turbulence * 2.8);
    float detail = sin(surface.y * 63.0 + turbulence * 4.0) * 0.055;
    float pattern = clamp(0.52 + bands * 0.18 + turbulence * 0.16 + detail, 0.0, 1.0);
    float3 albedo = mix(float3(0.29, 0.24, 0.46), float3(0.77, 0.70, 0.91), pattern);
    float3 light = normalize(float3(-0.55, -0.65, 1.0));
    float diffuse = max(dot(normal, light), 0.0);
    float rim = pow(1.0 - normal.z, 3.0);
    float highlight = pow(max(dot(normal, normalize(light + float3(0.0, 0.0, 1.0))), 0.0), 38.0);
    color = albedo * (0.10 + 0.90 * diffuse)
      + float3(0.58, 0.52, 0.83) * rim * (0.08 + diffuse * 0.18)
      + float3(0.90, 0.86, 1.0) * highlight * 0.055;
  }
  float haloAlpha = glow * (1.0 - coverage);
  return half4(color * coverage + float3(0.58, 0.49, 0.84) * haloAlpha,
    coverage + haloAlpha);
}
`;
