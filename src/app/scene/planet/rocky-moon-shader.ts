import { ROCKY_MOON_CRATER_COUNT } from '../../model/planet/rocky-moon-surface';

/** Mirrors rocky-moon-surface.ts; exercised by the GPU/CPU parity tests. */
export const ROCKY_MOON_SURFACE_GLSL = /* glsl */ `
float rockyMoonElevation(vec3 p) {
  uint seed = planetSeed();
  float regions = fbm3(p * 2.8, seed, 4);
  float highlands = smoothstep(0.38, 0.62, regions);
  float mountains = ridged3(p * 12.0, seed ^ 0x27d4eb2fu, 4);
  float regolith = fbm3(p * 42.0, seed ^ 0x71a3b925u, 2);
  float elevation = 0.34 + highlands * 0.19 + mountains * highlands * 0.15 + (regolith - 0.5) * 0.018;

  for (int index = 0; index < ${ROCKY_MOON_CRATER_COUNT}; index++) {
    uint hash = lowbias32(seed + uint(index + 1) * 0x9e3779b1u);
    vec3 center = vec3(
      float(hash >> 16),
      float(lowbias32(hash) >> 16),
      float(lowbias32(hash ^ 0x51e3f9adu) >> 16)
    ) / 65536.0 * 2.0 - 1.0;
    float dot0 = dot(p, center) / max(length(center), 0.000001);
    float size = float(lowbias32(hash ^ 0x68bc21ebu) >> 16) / 65536.0;
    float radius = index < 6 ? 0.2 + size * 0.18 : 0.035 + size * 0.105;
    float distance0 = sqrt(max(0.0, 2.0 - 2.0 * dot0)) / radius;
    float bowl = (1.0 - smoothstep(0.12, 0.92, distance0)) * 0.11;
    float rim = (1.0 - smoothstep(0.04, 0.22, abs(distance0 - 1.0))) * 0.06;
    float peak = index < 6 ? (1.0 - smoothstep(0.0, 0.22, distance0)) * 0.045 : 0.0;
    elevation += rim + peak - bowl;
  }
  return elevation;
}

vec3 rockyMoonAlbedo(float elevation) {
  float highlands = smoothstep(0.34, 0.6, elevation);
  float rims = smoothstep(0.6, 0.72, elevation);
  return mix(mix(vec3(0.22, 0.215, 0.21), vec3(0.57, 0.55, 0.52), highlands), vec3(0.7, 0.68, 0.65), rims);
}

vec3 rockyMoonMaterial(float elevation) {
  return vec3(1.0, mix(0.88, 0.98, smoothstep(0.34, 0.65, elevation)), 0.0);
}
`;
