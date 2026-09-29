/**
 * GLSL mirror of the CPU reference in src/app/model/planet/.
 *
 * The CPU implementation is canonical. Every function here has a counterpart in
 * planet-noise.ts / planet-surface.ts and must stay in step with it; the
 * Playwright parity test in e2e/tests/planet-bake-parity.spec.ts compares the
 * two and is what prevents drift.
 *
 * Requires WebGL2 (GLSL ES 3.00) for unsigned integer arithmetic. The seed is
 * supplied as two 16-bit halves so it survives as an exact float uniform
 * regardless of how uniforms are introspected.
 */
import type { PlanetClimate } from '../../model/planet/planet-seed';
import {
  ICE_ROUGHNESS,
  LAND_METALNESS,
  LAND_ROUGHNESS,
  OCEAN_SHELF_FRACTION,
  RELIEF_FADE_ABOVE_FRACTION,
  RELIEF_FADE_BELOW_FRACTION,
  WATER_EDGE_FRACTION,
  WATER_METALNESS,
  WATER_ROUGHNESS,
} from '../../model/planet/planet-surface';

/** GLSL has no implicit int-to-float promotion, so literals must keep a decimal point. */
function glslFloat(value: number): string {
  return value.toFixed(6);
}

export const PLANET_BAKE_MODE_ALBEDO = 0;
export const PLANET_BAKE_MODE_NORMAL = 1;
export const PLANET_BAKE_MODE_MATERIAL = 2;

/**
 * The `#version` directive is deliberately NOT part of the shader sources
 * below. three.js prepends its own `#define SHADER_TYPE ...` preamble to
 * RawShaderMaterial sources, which would push `#version` off line 1 and fail
 * compilation; instead three emits the directive itself when the material sets
 * `glslVersion: GLSL3`. Consumers that compile these sources directly (the
 * parity test) must prepend PLANET_SHADER_VERSION_DIRECTIVE themselves.
 */
export const PLANET_SHADER_VERSION_DIRECTIVE = '#version 300 es\n';

/**
 * Emits clip-space coordinates directly so it needs no camera matrices. That
 * lets the parity test drive this exact shader through raw WebGL2 without
 * three.js, while three still renders it through a 2x2 plane.
 */
export const PLANET_VERTEX_SHADER = /* glsl */ `precision highp float;

in vec3 position;

out vec2 vUv;

void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const PLANET_FRAGMENT_SHADER = /* glsl */ `precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform float uSeedLo;
uniform float uSeedHi;
uniform float uSeaLevel;
uniform float uOceanSpan;
uniform float uLandSpan;
uniform float uIceLatitudeDeg;
uniform float uContinentFrequency;
uniform float uWarpStrength;
uniform float uMountainAmplitude;
uniform float uAridity;
uniform float uHueBias;
uniform int uMode;
uniform vec2 uTexel;

const float PI = 3.141592653589793;
const float NORMAL_RELIEF_SCALE = 6.0;
const float MIN_LATITUDE_COSINE = 0.15;

const vec3 DEEP_OCEAN = vec3(0.02, 0.09, 0.24);
const vec3 SHALLOW_OCEAN = vec3(0.06, 0.26, 0.45);
const vec3 SHORE = vec3(0.76, 0.7, 0.5);
const vec3 GRASS = vec3(0.18, 0.4, 0.16);
const vec3 FOREST = vec3(0.09, 0.27, 0.12);
const vec3 DESERT = vec3(0.72, 0.58, 0.32);
const vec3 ROCK = vec3(0.38, 0.33, 0.28);
const vec3 SNOW = vec3(0.92, 0.93, 0.95);

uint planetSeed() {
  return (uint(uSeedHi) << 16) | uint(uSeedLo);
}

uint lowbias32(uint x) {
  x ^= x >> 16;
  x *= 0x7feb352du;
  x ^= x >> 15;
  x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}

uint hashCell(int ix, int iy, int iz, uint seed) {
  uint mixed = uint(ix) * 73856093u ^ uint(iy) * 19349663u ^ uint(iz) * 83492791u ^ seed;
  return lowbias32(mixed);
}

float latticeValue(int ix, int iy, int iz, uint seed) {
  return float(hashCell(ix, iy, iz, seed) >> 16) / 65536.0;
}

float smootherstepf(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float valueNoise3(vec3 p, uint seed) {
  vec3 base = floor(p);
  int ix = int(base.x);
  int iy = int(base.y);
  int iz = int(base.z);

  float fx = smootherstepf(p.x - base.x);
  float fy = smootherstepf(p.y - base.y);
  float fz = smootherstepf(p.z - base.z);

  float c000 = latticeValue(ix, iy, iz, seed);
  float c100 = latticeValue(ix + 1, iy, iz, seed);
  float c010 = latticeValue(ix, iy + 1, iz, seed);
  float c110 = latticeValue(ix + 1, iy + 1, iz, seed);
  float c001 = latticeValue(ix, iy, iz + 1, seed);
  float c101 = latticeValue(ix + 1, iy, iz + 1, seed);
  float c011 = latticeValue(ix, iy + 1, iz + 1, seed);
  float c111 = latticeValue(ix + 1, iy + 1, iz + 1, seed);

  float x00 = mix(c000, c100, fx);
  float x10 = mix(c010, c110, fx);
  float x01 = mix(c001, c101, fx);
  float x11 = mix(c011, c111, fx);

  return mix(mix(x00, x10, fy), mix(x01, x11, fy), fz);
}

float fbm3(vec3 p, uint seed, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  float frequency = 1.0;

  for (int octave = 0; octave < octaves; octave++) {
    sum += valueNoise3(p * frequency, seed + uint(octave) * 0x9e3779b1u) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return sum / total;
}

float ridged3(vec3 p, uint seed, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  float total = 0.0;
  float frequency = 1.0;

  for (int octave = 0; octave < octaves; octave++) {
    float sample0 = valueNoise3(p * frequency, seed + uint(octave) * 0x85ebca6bu);
    sum += (1.0 - abs(sample0 * 2.0 - 1.0)) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return sum / total;
}

float planetElevation(vec3 p) {
  uint seed = planetSeed();

  float warpX = fbm3(vec3(p.x * 1.7 + 11.3, p.y * 1.7, p.z * 1.7), seed ^ 0x1f83d9abu, 3) - 0.5;
  float warpY = fbm3(vec3(p.x * 1.7, p.y * 1.7 + 7.1, p.z * 1.7), seed ^ 0x5be0cd19u, 3) - 0.5;
  float warpZ = fbm3(vec3(p.x * 1.7, p.y * 1.7, p.z * 1.7 + 3.7), seed ^ 0xcbbb9d5du, 3) - 0.5;

  vec3 q = p + vec3(warpX, warpY, warpZ) * 2.0 * uWarpStrength;

  float continents = fbm3(q * uContinentFrequency, seed, 6);
  float mountains = ridged3(q * uContinentFrequency * 4.0, seed ^ 0x27d4eb2fu, 4);

  // Mirrors planetElevation in planet-surface.ts: ridged relief fades out below
  // sea level so ocean colour does not show mountain filaments.
  float landness = smoothstep(
    uSeaLevel - uOceanSpan * ${glslFloat(RELIEF_FADE_BELOW_FRACTION)},
    uSeaLevel + uLandSpan * ${glslFloat(RELIEF_FADE_ABOVE_FRACTION)},
    continents
  );

  return clamp(continents + (mountains - 0.5) * uMountainAmplitude * landness, 0.0, 1.0);
}

vec3 planetAlbedo(float elevation, float sinLatitude) {
  float absLatitude = abs(sinLatitude);
  vec3 color;

  if (elevation < uSeaLevel) {
    float depth = smoothstep(uSeaLevel - uOceanSpan * ${glslFloat(OCEAN_SHELF_FRACTION)}, uSeaLevel, elevation);
    color = mix(DEEP_OCEAN, SHALLOW_OCEAN, depth);
  } else {
    float land = clamp((elevation - uSeaLevel) / uLandSpan, 0.0, 1.0);
    color = mix(SHORE, GRASS, smoothstep(0.0, 0.14, land));
    color = mix(color, FOREST, smoothstep(0.14, 0.42, land));

    float aridBand = 1.0 - smoothstep(0.1, 0.5, abs(absLatitude - 0.34));
    color = mix(color, DESERT, aridBand * uAridity);

    color = mix(color, ROCK, smoothstep(0.5, 0.72, land));
    color = mix(color, SNOW, smoothstep(0.78, 0.94, land));
  }

  float iceSin = sin(uIceLatitudeDeg * PI / 180.0);
  color = mix(color, SNOW, smoothstep(iceSin - 0.1, iceSin + 0.06, absLatitude));

  return clamp(vec3(color.r + uHueBias, color.g, color.b - uHueBias), 0.0, 1.0);
}

vec3 planetMaterial(float elevation, float sinLatitude) {
  float absLatitude = abs(sinLatitude);

  // Mirrors planetMaterial in planet-surface.ts.
  float shore = smoothstep(uSeaLevel - uOceanSpan * ${glslFloat(WATER_EDGE_FRACTION)}, uSeaLevel, elevation);

  float roughness = mix(${glslFloat(WATER_ROUGHNESS)}, ${glslFloat(LAND_ROUGHNESS)}, shore);
  float metalness = mix(${glslFloat(WATER_METALNESS)}, ${glslFloat(LAND_METALNESS)}, shore);

  float land = clamp((elevation - uSeaLevel) / uLandSpan, 0.0, 1.0);
  float snow = shore * smoothstep(0.78, 0.94, land);

  float iceSin = sin(uIceLatitudeDeg * PI / 180.0);
  float cap = smoothstep(iceSin - 0.1, iceSin + 0.06, absLatitude);
  float frozen = max(snow, cap);

  roughness = mix(roughness, ${glslFloat(ICE_ROUGHNESS)}, frozen);
  metalness = mix(metalness, 0.0, frozen);

  return vec3(1.0, clamp(roughness, 0.0, 1.0), clamp(metalness, 0.0, 1.0));
}

vec3 directionFromEquirect(vec2 uv) {
  float longitude = (uv.x - 0.5) * PI * 2.0;
  float latitude = (0.5 - uv.y) * PI;
  float cosLatitude = cos(latitude);
  return vec3(cosLatitude * sin(longitude), sin(latitude), cosLatitude * cos(longitude));
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  if (uMode == ${PLANET_BAKE_MODE_NORMAL}) {
    float cosLatitude = max(cos((0.5 - uv.y) * PI), MIN_LATITUDE_COSINE);

    // Clamping to sea level keeps the ocean flat; see encodeNormal in
    // planet-texture.ts for why.
    float left = max(planetElevation(directionFromEquirect(vec2(uv.x - uTexel.x, uv.y))), uSeaLevel);
    float right = max(planetElevation(directionFromEquirect(vec2(uv.x + uTexel.x, uv.y))), uSeaLevel);
    float up = max(planetElevation(directionFromEquirect(vec2(uv.x, clamp(uv.y - uTexel.y, 0.0, 1.0)))), uSeaLevel);
    float down = max(planetElevation(directionFromEquirect(vec2(uv.x, clamp(uv.y + uTexel.y, 0.0, 1.0)))), uSeaLevel);

    float dx = (right - left) * NORMAL_RELIEF_SCALE / cosLatitude;
    float dy = (down - up) * NORMAL_RELIEF_SCALE;
    vec3 normal = normalize(vec3(-dx, -dy, 1.0));

    fragColor = vec4(normal * 0.5 + 0.5, 1.0);
    return;
  }

  vec3 direction = directionFromEquirect(uv);
  float elevation = planetElevation(direction);

  if (uMode == ${PLANET_BAKE_MODE_MATERIAL}) {
    fragColor = vec4(planetMaterial(elevation, direction.y), 1.0);
    return;
  }

  fragColor = vec4(planetAlbedo(elevation, direction.y), 1.0);
}
`;

export interface PlanetShaderUniformValues {
  uSeedLo: number;
  uSeedHi: number;
  uSeaLevel: number;
  uOceanSpan: number;
  uLandSpan: number;
  uIceLatitudeDeg: number;
  uContinentFrequency: number;
  uWarpStrength: number;
  uMountainAmplitude: number;
  uAridity: number;
  uHueBias: number;
  uMode: number;
  uTexel: readonly [number, number];
}

export function buildPlanetShaderUniforms(
  climate: PlanetClimate,
  mode: number,
  width: number,
  height: number,
): PlanetShaderUniformValues {
  return {
    uSeedLo: climate.seed & 0xffff,
    uSeedHi: (climate.seed >>> 16) & 0xffff,
    uSeaLevel: climate.seaLevel,
    uOceanSpan: climate.oceanSpan,
    uLandSpan: climate.landSpan,
    uIceLatitudeDeg: climate.iceLatitudeDeg,
    uContinentFrequency: climate.continentFrequency,
    uWarpStrength: climate.warpStrength,
    uMountainAmplitude: climate.mountainAmplitude,
    uAridity: climate.aridity,
    uHueBias: climate.hueBias,
    uMode: mode,
    uTexel: [1 / width, 1 / height],
  };
}
