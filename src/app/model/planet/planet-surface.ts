/**
 * Canonical terran surface model. The GLSL mirror must stay in step with this
 * file; the Playwright parity test is the enforcement mechanism.
 *
 * Additional archetypes (barren, ice, desert, volcanic, gas giant) are planned
 * and documented in docs/procedural-planets-2026-09-28.md. Gas giants need a
 * separate banded-flow model rather than this elevation-driven one.
 */
import { clamp01, fbm3, lerp, ridged3 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';

export type Rgb = readonly [number, number, number];

/**
 * Coastline softness, as a fraction of the ocean and land spans respectively.
 *
 * These are fractions rather than raw field units so they stay meaningful
 * whatever spread the underlying noise happens to have for a given seed.
 * Shared with the GLSL mirror in `planet-shader.ts`; changing one without the
 * other breaks the parity test.
 */
export const RELIEF_FADE_BELOW_FRACTION = 0.2;
export const RELIEF_FADE_ABOVE_FRACTION = 0.1;

/**
 * How much of the ocean depth range is spent grading from shallow to deep.
 * Below this the water is uniformly deep, which keeps the bright shelf colour
 * hugging the coasts instead of washing out the whole ocean.
 */
export const OCEAN_SHELF_FRACTION = 0.55;

/**
 * Surface response constants, shared with the GLSL mirror.
 *
 * Water is deliberately not mirror-smooth: a roughness near zero collapses the
 * star's reflection to a pinprick, whereas a little spread reads as sun glint
 * across the ocean.
 */
export const WATER_ROUGHNESS = 0.2;
export const WATER_METALNESS = 0.02;
export const LAND_ROUGHNESS = 0.92;
export const LAND_METALNESS = 0;
export const ICE_ROUGHNESS = 0.55;
/** How sharply roughness switches from water to land, as a fraction of the ocean span. */
export const WATER_EDGE_FRACTION = 0.02;

const DEEP_OCEAN: Rgb = [0.02, 0.09, 0.24];
const SHALLOW_OCEAN: Rgb = [0.06, 0.26, 0.45];
const SHORE: Rgb = [0.76, 0.7, 0.5];
const GRASS: Rgb = [0.18, 0.4, 0.16];
const FOREST: Rgb = [0.09, 0.27, 0.12];
const DESERT: Rgb = [0.72, 0.58, 0.32];
const ROCK: Rgb = [0.38, 0.33, 0.28];
const SNOW: Rgb = [0.92, 0.93, 0.95];

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * Domain warp applied before sampling continents and mountains.
 *
 * Both layers must share the same warped point, or the ridges detach from the
 * landmasses they belong to.
 */
export function warpPoint(x: number, y: number, z: number, params: ContinentParams): [number, number, number] {
  const { seed, warpStrength } = params;

  const warpX = fbm3(x * 1.7 + 11.3, y * 1.7, z * 1.7, seed ^ 0x1f83d9ab, 3) - 0.5;
  const warpY = fbm3(x * 1.7, y * 1.7 + 7.1, z * 1.7, seed ^ 0x5be0cd19, 3) - 0.5;
  const warpZ = fbm3(x * 1.7, y * 1.7, z * 1.7 + 3.7, seed ^ 0xcbbb9d5d, 3) - 0.5;

  return [x + warpX * 2 * warpStrength, y + warpY * 2 * warpStrength, z + warpZ * 2 * warpStrength];
}

/**
 * The raw, un-normalised continent field.
 *
 * Its output is roughly Gaussian around 0.5 rather than uniform, and both its
 * mean and spread drift from seed to seed, so it is never thresholded
 * directly — see `calibrateContinents`.
 */
export function continentField(x: number, y: number, z: number, params: ContinentParams): number {
  const [qx, qy, qz] = warpPoint(x, y, z, params);
  const frequency = params.continentFrequency;

  return fbm3(qx * frequency, qy * frequency, qz * frequency, params.seed, 6);
}

export interface ContinentParams {
  seed: number;
  warpStrength: number;
  continentFrequency: number;
}

/**
 * Field-space landmarks derived by sampling a body's continent field.
 *
 * `waterFraction` is meant to be an *area* fraction, but the continent field
 * is not uniformly distributed, so comparing elevation against it directly
 * produced wildly wrong coverage — a body asking for 47% water rendered 29%,
 * another asking for 68% rendered 94%. Measuring the actual quantile makes the
 * parameter mean what its name says.
 */
export interface PlanetCalibration {
  /** Field value with exactly `waterFraction` of the surface area below it. */
  seaLevel: number;
  /** Field distance from the deepest sampled point up to sea level. */
  oceanSpan: number;
  /** Field distance from sea level up to the highest expected peak. */
  landSpan: number;
}

/**
 * Sample budget for the measurement below.
 *
 * Measured against true ocean coverage on a dense grid, accuracy is already at
 * its floor here: 1024 samples land within 0.015 of the requested fraction and
 * 4096 only reaches 0.013, because the residual error comes from the fixed-point
 * iteration rather than from sampling noise. The larger budget cost four times
 * as much noise evaluation for nothing, and this runs once per body on the main
 * thread before a system view can draw.
 */
const CALIBRATION_SAMPLES = 1024;
const CALIBRATION_ROUNDS = 3;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_SPAN = 1e-3;

/**
 * A deterministic, equal-area point set (Fibonacci sphere).
 *
 * Equal-area matters: sampling an equirectangular grid instead would
 * over-weight the poles and bias every measurement below.
 */
const CALIBRATION_DIRECTIONS = ((): Float64Array => {
  const directions = new Float64Array(CALIBRATION_SAMPLES * 3);
  for (let index = 0; index < CALIBRATION_SAMPLES; index += 1) {
    const y = 1 - (2 * (index + 0.5)) / CALIBRATION_SAMPLES;
    const radius = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = index * GOLDEN_ANGLE;
    directions[index * 3] = radius * Math.cos(theta);
    directions[index * 3 + 1] = y;
    directions[index * 3 + 2] = radius * Math.sin(theta);
  }
  return directions;
})();

/** Rounded so the CPU reference and the float32 GPU uniforms consume equal inputs. */
function quantize(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Measures a body's field landmarks by sampling it on an equal-area point set.
 *
 * `planetElevation` gates its relief fade on these same landmarks, so the
 * measurement is circular and is resolved by fixed-point iteration: start from
 * the continent field alone, then repeatedly rebuild the finished elevation
 * and re-take its quantile. The dependence is weak and it settles in a couple
 * of rounds. Skipping this entirely biased ocean coverage low by around five
 * points, because relief lifts near-shore points above the waterline.
 */
export function calibrateContinents(
  params: ContinentParams,
  waterFraction: number,
  mountainAmplitude: number,
): PlanetCalibration {
  const frequency = params.continentFrequency;
  const continents = new Float64Array(CALIBRATION_SAMPLES);
  const mountains = new Float64Array(CALIBRATION_SAMPLES);

  for (let index = 0; index < CALIBRATION_SAMPLES; index += 1) {
    const [qx, qy, qz] = warpPoint(
      CALIBRATION_DIRECTIONS[index * 3],
      CALIBRATION_DIRECTIONS[index * 3 + 1],
      CALIBRATION_DIRECTIONS[index * 3 + 2],
      params,
    );
    continents[index] = fbm3(qx * frequency, qy * frequency, qz * frequency, params.seed, 6);
    mountains[index] = ridged3(qx * frequency * 4, qy * frequency * 4, qz * frequency * 4, params.seed ^ 0x27d4eb2f, 4);
  }

  const quantileIndex = Math.round(clamp01(waterFraction) * (CALIBRATION_SAMPLES - 1));
  const sorted = Float64Array.from(continents).sort();
  let seaLevel = sorted[quantileIndex];
  let oceanSpan = Math.max(seaLevel - sorted[0], MIN_SPAN);
  let landSpan = Math.max(sorted[CALIBRATION_SAMPLES - 1] - seaLevel, MIN_SPAN);

  const elevations = new Float64Array(CALIBRATION_SAMPLES);
  for (let round = 0; round < CALIBRATION_ROUNDS; round += 1) {
    for (let index = 0; index < CALIBRATION_SAMPLES; index += 1) {
      const landness = smoothstep(
        seaLevel - oceanSpan * RELIEF_FADE_BELOW_FRACTION,
        seaLevel + landSpan * RELIEF_FADE_ABOVE_FRACTION,
        continents[index],
      );
      elevations[index] = clamp01(continents[index] + (mountains[index] - 0.5) * mountainAmplitude * landness);
    }
    elevations.sort();

    seaLevel = elevations[quantileIndex];
    oceanSpan = Math.max(seaLevel - elevations[0], MIN_SPAN);
    landSpan = Math.max(elevations[CALIBRATION_SAMPLES - 1] - seaLevel, MIN_SPAN);
  }

  return { seaLevel: quantize(seaLevel), oceanSpan: quantize(oceanSpan), landSpan: quantize(landSpan) };
}

/** Returns elevation in field units, where `climate.seaLevel` is the shoreline. */
export function planetElevation(x: number, y: number, z: number, climate: PlanetClimate): number {
  const { seed, continentFrequency, mountainAmplitude, seaLevel, oceanSpan, landSpan } = climate;

  const [qx, qy, qz] = warpPoint(x, y, z, climate);
  const continents = fbm3(qx * continentFrequency, qy * continentFrequency, qz * continentFrequency, seed, 6);
  const mountains = ridged3(
    qx * continentFrequency * 4,
    qy * continentFrequency * 4,
    qz * continentFrequency * 4,
    seed ^ 0x27d4eb2f,
    4,
  );

  // The ridged layer is faded out below sea level. Ocean colour is a ramp over
  // elevation, so leaving it in painted mountain filaments onto open water.
  // Gating on the smooth continent value rather than the final elevation keeps
  // this from being circular, and the band gives a soft coastline.
  const landness = smoothstep(
    seaLevel - oceanSpan * RELIEF_FADE_BELOW_FRACTION,
    seaLevel + landSpan * RELIEF_FADE_ABOVE_FRACTION,
    continents,
  );

  return clamp01(continents + (mountains - 0.5) * mountainAmplitude * landness);
}

/** `sinLatitude` is the unit-sphere Y component, i.e. sin of the latitude. */
export function planetAlbedo(elevation: number, sinLatitude: number, climate: PlanetClimate): Rgb {
  const { seaLevel, oceanSpan, landSpan, iceLatitudeDeg, aridity, hueBias } = climate;
  const absLatitude = Math.abs(sinLatitude);

  let color: Rgb;
  if (elevation < seaLevel) {
    const depth = smoothstep(seaLevel - oceanSpan * OCEAN_SHELF_FRACTION, seaLevel, elevation);
    color = mix(DEEP_OCEAN, SHALLOW_OCEAN, depth);
  } else {
    const land = clamp01((elevation - seaLevel) / landSpan);
    color = mix(SHORE, GRASS, smoothstep(0.0, 0.14, land));
    color = mix(color, FOREST, smoothstep(0.14, 0.42, land));

    const aridBand = 1 - smoothstep(0.1, 0.5, Math.abs(absLatitude - 0.34));
    color = mix(color, DESERT, aridBand * aridity);

    color = mix(color, ROCK, smoothstep(0.5, 0.72, land));
    color = mix(color, SNOW, smoothstep(0.78, 0.94, land));
  }

  const iceSin = Math.sin((iceLatitudeDeg * Math.PI) / 180);
  const cap = smoothstep(iceSin - 0.1, iceSin + 0.06, absLatitude);
  color = mix(color, SNOW, cap);

  return [clamp01(color[0] + hueBias), clamp01(color[1]), clamp01(color[2] - hueBias)];
}

/**
 * Surface response, packed the way three.js reads it: red is ambient
 * occlusion, green is roughness, blue is metalness.
 *
 * Water and land shared a single roughness before this existed, which left the
 * oceans looking like matte blue paint. Open water is smooth enough to catch a
 * specular highlight from the star; rock, soil and vegetation are not.
 */
export function planetMaterial(elevation: number, sinLatitude: number, climate: PlanetClimate): Rgb {
  const { seaLevel, oceanSpan, landSpan, iceLatitudeDeg } = climate;
  const absLatitude = Math.abs(sinLatitude);

  // Goes 0 to 1 right at the shoreline, so the beach is already dry.
  const shore = smoothstep(seaLevel - oceanSpan * WATER_EDGE_FRACTION, seaLevel, elevation);

  let roughness = lerp(WATER_ROUGHNESS, LAND_ROUGHNESS, shore);
  let metalness = lerp(WATER_METALNESS, LAND_METALNESS, shore);

  const land = clamp01((elevation - seaLevel) / landSpan);
  const snow = shore * smoothstep(0.78, 0.94, land);

  const iceSin = Math.sin((iceLatitudeDeg * Math.PI) / 180);
  const cap = smoothstep(iceSin - 0.1, iceSin + 0.06, absLatitude);
  const frozen = Math.max(snow, cap);

  roughness = lerp(roughness, ICE_ROUGHNESS, frozen);
  metalness = lerp(metalness, 0, frozen);

  return [1, clamp01(roughness), clamp01(metalness)];
}

export function directionFromEquirect(u: number, v: number): Rgb {
  const longitude = (u - 0.5) * Math.PI * 2;
  const latitude = (0.5 - v) * Math.PI;
  const cosLatitude = Math.cos(latitude);
  return [cosLatitude * Math.sin(longitude), Math.sin(latitude), cosLatitude * Math.cos(longitude)];
}
