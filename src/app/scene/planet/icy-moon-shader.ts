import { ICY_MOON_CRATER_COUNT } from '../../model/planet/icy-moon-surface';

/** Mirrors icy-moon-surface.ts; exercised by the GPU/CPU parity tests. */
export const ICY_MOON_SURFACE_GLSL = /* glsl */ `
float icyMoonElevation(vec3 p) {
  uint seed = planetSeed();
  float frost = fbm3(p * 3.0, seed, 3);
  float warp = (frost - 0.5) * 1.4;
  float plates = fbm3(p * 5.0 + vec3(warp, -warp, 0.0), seed ^ 0x71a3b925u, 3);
  float cracks = 1.0 - smoothstep(0.008, 0.035, abs(plates - 0.5));
  float branches = fbm3(p * 11.0 + vec3(0.0, 0.0, warp), seed ^ 0x35f91a7du, 2);
  float fineCracks = (1.0 - smoothstep(0.004, 0.018, abs(branches - 0.5))) * cracks;
  float mountains = ridged3(p * 9.0, seed ^ 0x27d4eb2fu, 3);
  float mountainMask = smoothstep(0.48, 0.7, frost);
  float elevation = 0.52 + (frost - 0.5) * 0.07 + mountains * mountainMask * 0.09;
  elevation -= cracks * 0.075 + fineCracks * 0.025;

  for (int index = 0; index < ${ICY_MOON_CRATER_COUNT}; index++) {
    uint hash = lowbias32(seed + uint(index + 1) * 0x9e3779b1u);
    float cy = float(hash >> 16) / 65536.0 * 2.0 - 1.0;
    float angle = float(lowbias32(hash) >> 16) / 65536.0 * PI * 2.0;
    float radial = sqrt(1.0 - cy * cy);
    float dot0 = dot(p, vec3(radial * cos(angle), cy, radial * sin(angle)));
    float radius = 0.055 + float(lowbias32(hash ^ 0x68bc21ebu) >> 16) / 65536.0 * 0.13;
    float distance0 = sqrt(max(0.0, 2.0 - 2.0 * dot0)) / radius;
    float bowl = (1.0 - smoothstep(0.0, 0.86, distance0)) * 0.065;
    float rim = (1.0 - smoothstep(0.06, 0.24, abs(distance0 - 1.0))) * 0.035;
    elevation += rim - bowl;
  }
  return elevation;
}

vec3 icyMoonAlbedo(float elevation) {
  float frozen = smoothstep(0.42, 0.515, elevation);
  float snow = smoothstep(0.515, 0.59, elevation);
  return mix(mix(vec3(0.29, 0.25, 0.23), vec3(0.72, 0.83, 0.9), frozen), vec3(0.94, 0.96, 0.98), snow);
}

vec3 icyMoonMaterial(float elevation) {
  return vec3(1.0, mix(0.48, 0.88, smoothstep(0.44, 0.57, elevation)), 0.0);
}
`;
