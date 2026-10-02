import { describe, expect, it } from 'vitest';
import {
  GAS_GIANT_MIN_MOON_RADIUS_UNITS,
  PLANET_FOCUS_RADIUS_UNIT,
  resolveBodyRadiusUnits,
  resolveGasGiantCameraDistanceRange,
  resolveGasGiantMoonRadiusUnits,
  resolveGasGiantOrbitRadiusUnits,
  resolveOrbitRadiusUnits,
} from './planet-view-scale';

const JUPITER_KM = 69_911;

describe('planet-view-scale', () => {
  it('keeps terran moon scaling unchanged', () => {
    expect(resolveBodyRadiusUnits(1737, 6371)).toBeCloseTo(2.2 * Math.cbrt(1737 / 6371), 5);
    expect(resolveOrbitRadiusUnits(0)).toBe(4.5);
  });

  it('shrinks giant moons toward true scale with a visible floor', () => {
    const io = resolveGasGiantMoonRadiusUnits(1821, JUPITER_KM);
    expect(io).toBeGreaterThan(GAS_GIANT_MIN_MOON_RADIUS_UNITS);
    expect(io).toBeLessThan(0.2);
    expect(resolveGasGiantMoonRadiusUnits(5, JUPITER_KM)).toBe(GAS_GIANT_MIN_MOON_RADIUS_UNITS);
    // Galilean moons are far smaller than the cube-root terran rule would draw them.
    expect(io).toBeLessThan(resolveBodyRadiusUnits(1821, JUPITER_KM));
  });

  it('orders giant orbits by distance and clears the rings', () => {
    const io = resolveGasGiantOrbitRadiusUnits(421_700, JUPITER_KM);
    const callisto = resolveGasGiantOrbitRadiusUnits(1_882_700, JUPITER_KM);
    expect(io).toBeGreaterThan(PLANET_FOCUS_RADIUS_UNIT);
    expect(callisto).toBeGreaterThan(io);
    const inner = resolveGasGiantOrbitRadiusUnits(80_000, JUPITER_KM, 2.4);
    expect(inner).toBeGreaterThanOrEqual(PLANET_FOCUS_RADIUS_UNIT * (2.4 + 0.35));
    expect(resolveGasGiantOrbitRadiusUnits(1e12, JUPITER_KM)).toBe(42);
  });

  it('frames rings and the moon system in the camera range', () => {
    const range = resolveGasGiantCameraDistanceRange(2.4, 20);
    expect(range.min).toBeCloseTo(PLANET_FOCUS_RADIUS_UNIT * 2.4 + 3, 5);
    expect(range.max).toBeGreaterThanOrEqual(range.min + 8);
    expect(resolveGasGiantCameraDistanceRange(0, 0).max).toBe(30);
  });
});
