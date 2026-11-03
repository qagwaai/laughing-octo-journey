/** GLSL mirror of lava-surface.ts; GPU/CPU parity is enforced by the bake tests. */
export const LAVA_SURFACE_GLSL = /* glsl */ `
float lavaCrackMask(vec3 p) {
  float veins = ridged3(p * 12.0, planetSeed() ^ 0x6a09e667u, 4);
  return smoothstep(0.78, 0.94, veins);
}

float lavaElevation(vec3 p) {
  uint seed = planetSeed();
  float plates = fbm3(p * 2.6, seed, 5);
  float ridges = ridged3(p * 5.0, seed ^ 0xbb67ae85u, 4);
  float cracks = lavaCrackMask(p);
  float grain = fbm3(p * 28.0, seed ^ 0x3c6ef372u, 2);
  return 0.24 + plates * 0.18 + ridges * 0.04 - cracks * 0.15 + (grain - 0.5) * 0.006;
}

vec3 lavaAlbedo(float elevation, vec3 p) {
  float basalt = 0.018 + smoothstep(0.28, 0.5, elevation) * 0.045;
  float intensity = lavaCrackMask(p) * 0.9;
  return mix(vec3(basalt, basalt * 0.92, basalt * 0.9), vec3(0.96, 0.17, 0.018), intensity);
}

vec3 lavaMaterial(vec3 p) {
  return vec3(1.0, mix(0.94, 0.32, lavaCrackMask(p)), 0.0);
}

vec3 lavaEmissive(vec3 p) {
  float cracks = lavaCrackMask(p);
  return vec3(cracks, cracks * 0.2, cracks * 0.025);
}
`;
