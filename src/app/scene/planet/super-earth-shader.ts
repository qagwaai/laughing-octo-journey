/** Mirrors super-earth-surface.ts; exercised by the GPU/CPU parity tests. */
export const SUPER_EARTH_SURFACE_GLSL = /* glsl */ `
float superEarthElevation(vec3 p) {
  uint seed = planetSeed();
  float plates = fbm3(p * 2.2, seed, 5);
  float uplands = smoothstep(0.42, 0.66, plates);
  float ranges = ridged3(p * 7.0, seed ^ 0x27d4eb2fu, 5);
  float scarps = ridged3(p * 18.0, seed ^ 0x1f83d9abu, 3);
  float grit = fbm3(p * 48.0, seed ^ 0x71a3b925u, 2);
  return 0.28 + uplands * 0.22 + ranges * (0.1 + uplands * 0.2) + scarps * 0.05 + (grit - 0.5) * 0.02;
}

vec3 superEarthAlbedo(float elevation, float sinLatitude) {
  float uplands = smoothstep(0.42, 0.66, elevation);
  float peaks = smoothstep(0.68, 0.84, elevation);
  float frost = smoothstep(0.7, 0.86, abs(sinLatitude));
  vec3 color = mix(vec3(0.13, 0.12, 0.115), vec3(0.42, 0.35, 0.29), uplands);
  color = mix(color, vec3(0.56, 0.53, 0.49), peaks);
  return mix(color, vec3(0.86, 0.88, 0.9), frost);
}

vec3 superEarthMaterial(float elevation, float sinLatitude) {
  float uplands = smoothstep(0.42, 0.66, elevation);
  float frost = smoothstep(0.7, 0.86, abs(sinLatitude));
  return vec3(1.0, mix(mix(0.8, 0.95, uplands), 0.62, frost), 0.0);
}
`;
