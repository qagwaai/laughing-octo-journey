/**
 * Planet view scene units.
 *
 * The focused body is always drawn at `PLANET_FOCUS_RADIUS_UNIT`, so every
 * other size is relative to it. Terran systems compress moon sizes and orbits
 * hard (cube root, log10) so small worlds stay legible. Gas giants are tens of
 * times larger than their moons, so their moons keep more of the true ratio and
 * their orbits are spaced in planet radii, clear of any ring system.
 */

export const PLANET_FOCUS_RADIUS_UNIT = 2.2;
export const PLANET_BASE_MOON_ORBIT = 4.5;
const PLANET_MAX_ORBIT_UNITS = 42;

/** Smallest moon still large enough to see and click beside a giant. */
export const GAS_GIANT_MIN_MOON_RADIUS_UNITS = 0.12;
const GAS_GIANT_MOON_SIZE_EXPONENT = 0.75;
/** Orbit spacing in planet radii per e-fold of true distance. */
const GAS_GIANT_ORBIT_LOG_SPREAD = 1.6;
/** Gap, in planet radii, kept between the outer ring edge and the first orbit. */
const GAS_GIANT_RING_CLEARANCE = 0.35;
const GAS_GIANT_MIN_CAMERA_GAP = 3;

export interface PlanetViewDistanceRange {
  min: number;
  max: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveBodyRadiusUnits(bodyRadiusKm: number, referenceRadiusKm: number): number {
  const ratio = bodyRadiusKm / Math.max(referenceRadiusKm, 1);
  const scaled = PLANET_FOCUS_RADIUS_UNIT * Math.cbrt(Math.max(0.03, ratio));
  return clamp(scaled, 0.35, 3.8);
}

export function resolveOrbitRadiusUnits(distanceKm: number): number {
  const logDistance = Math.log10(1 + distanceKm);
  const unitRadius = PLANET_BASE_MOON_ORBIT + logDistance * 2.3;
  return clamp(unitRadius, PLANET_BASE_MOON_ORBIT, PLANET_MAX_ORBIT_UNITS);
}

/** Io beside Jupiter is ~0.14 units against the giant's 2.2. */
export function resolveGasGiantMoonRadiusUnits(moonRadiusKm: number, giantRadiusKm: number): number {
  const ratio = clamp(moonRadiusKm / Math.max(giantRadiusKm, 1), 0, 1);
  return Math.max(
    GAS_GIANT_MIN_MOON_RADIUS_UNITS,
    PLANET_FOCUS_RADIUS_UNIT * Math.pow(ratio, GAS_GIANT_MOON_SIZE_EXPONENT),
  );
}

/**
 * Orbit radius in scene units for a giant's moon, `distanceKm` from its centre.
 * `ringOuterRadius` is in planet radii (0 when ringless) and always stays clear.
 */
export function resolveGasGiantOrbitRadiusUnits(
  distanceKm: number,
  giantRadiusKm: number,
  ringOuterRadius = 0,
): number {
  const radii = Math.max(distanceKm, 1) / Math.max(giantRadiusKm, 1);
  const spread = 1 + GAS_GIANT_ORBIT_LOG_SPREAD * Math.log(Math.max(radii, 1));
  const floor = Math.max(1, ringOuterRadius) + GAS_GIANT_RING_CLEARANCE;
  return Math.min(PLANET_MAX_ORBIT_UNITS, PLANET_FOCUS_RADIUS_UNIT * Math.max(floor, spread));
}

/**
 * Camera range around a giant: close enough to fill the view without entering
 * the rings, far enough to frame the whole moon system.
 */
export function resolveGasGiantCameraDistanceRange(
  ringOuterRadius: number,
  maxOrbitUnits: number,
): PlanetViewDistanceRange {
  const min = PLANET_FOCUS_RADIUS_UNIT * Math.max(1, ringOuterRadius) + GAS_GIANT_MIN_CAMERA_GAP;
  const max = Math.max(min + 8, clamp(maxOrbitUnits * 2.6, 30, 110));
  return { min: +min.toFixed(3), max: +max.toFixed(3) };
}
