/**
 * CPU reference noise. This file is the canonical definition of planet surface
 * noise; the GLSL in src/app/scene/planet/planet-shader.ts mirrors it and is
 * held to it by the Playwright parity test.
 *
 * Parity rules, do not break without updating the shader:
 * - Integer math is 32-bit wrapping (Math.imul / `>>> 0`), matching GLSL `uint`.
 * - Lattice values use only the top 16 bits of the hash, so they are exactly
 *   representable in both float32 and float64 and cannot drift.
 */

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Bit-identical to the GLSL `lowbias32`. */
export function lowbias32(value: number): number {
  let x = value >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x >>> 0;
}

export function hashCell(ix: number, iy: number, iz: number, seed: number): number {
  const mixed =
    (Math.imul(ix | 0, 73856093) ^ Math.imul(iy | 0, 19349663) ^ Math.imul(iz | 0, 83492791) ^ (seed | 0)) >>> 0;
  return lowbias32(mixed);
}

/** Top 16 bits only: exact in float32 and float64 alike. */
function latticeValue(ix: number, iy: number, iz: number, seed: number): number {
  return (hashCell(ix, iy, iz, seed) >>> 16) / 65536;
}

export function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smootherstep(x - ix);
  const fy = smootherstep(y - iy);
  const fz = smootherstep(z - iz);

  const c000 = latticeValue(ix, iy, iz, seed);
  const c100 = latticeValue(ix + 1, iy, iz, seed);
  const c010 = latticeValue(ix, iy + 1, iz, seed);
  const c110 = latticeValue(ix + 1, iy + 1, iz, seed);
  const c001 = latticeValue(ix, iy, iz + 1, seed);
  const c101 = latticeValue(ix + 1, iy, iz + 1, seed);
  const c011 = latticeValue(ix, iy + 1, iz + 1, seed);
  const c111 = latticeValue(ix + 1, iy + 1, iz + 1, seed);

  const x00 = lerp(c000, c100, fx);
  const x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx);
  const x11 = lerp(c011, c111, fx);

  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;

  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise3(x * frequency, y * frequency, z * frequency, (seed + octave * 0x9e3779b1) | 0) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return sum / total;
}

/** Ridged noise for mountain relief: folds the signal about its midpoint. */
export function ridged3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;

  for (let octave = 0; octave < octaves; octave += 1) {
    const sample = valueNoise3(x * frequency, y * frequency, z * frequency, (seed + octave * 0x85ebca6b) | 0);
    sum += (1 - Math.abs(sample * 2 - 1)) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return sum / total;
}
