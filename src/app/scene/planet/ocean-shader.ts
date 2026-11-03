/** GLSL mirror of ocean-surface.ts; GPU/CPU parity is enforced by the bake tests. */
export const OCEAN_SURFACE_GLSL = /* glsl */ `
vec3 oceanAlbedo(float elevation, vec3 p) {
  float shore = smoothstep(uSeaLevel - uOceanSpan * 0.035, uSeaLevel + uLandSpan * 0.025, elevation);
  float depth = smoothstep(uSeaLevel - uOceanSpan * 0.72, uSeaLevel, elevation);
  float waves = fbm3(p * 24.0, planetSeed() ^ 0xa54ff53au, 4);
  float glints = smoothstep(0.76, 0.93, ridged3(p * 36.0, planetSeed() ^ 0x510e527fu, 3));
  float waterBrightness = 0.04 + waves * 0.08 + glints * 0.22;
  vec3 deepWater = vec3(0.004, 0.025 + waterBrightness * 0.25, 0.12 + waterBrightness * 0.55);
  vec3 brightWater = vec3(0.012, 0.13 + waterBrightness * 0.45, 0.32 + waterBrightness * 0.65);
  vec3 water = mix(deepWater, brightWater, depth);
  float islandHeight = smoothstep(uSeaLevel, uSeaLevel + uLandSpan * 0.72, elevation);
  vec3 island = mix(vec3(0.12, 0.16, 0.17), vec3(0.34, 0.3, 0.25), islandHeight);
  return mix(water, island, shore);
}

vec3 oceanMaterial(float elevation) {
  float shore = smoothstep(uSeaLevel - uOceanSpan * 0.035, uSeaLevel + uLandSpan * 0.025, elevation);
  return vec3(1.0, mix(0.18, 0.9, shore), mix(0.025, 0.0, shore));
}
`;
