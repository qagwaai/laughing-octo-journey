import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import { resolvePlanetViewBodyRadiusKm, resolvePlanetViewCameraDistanceRange } from './planet-view-scene';

function makeBody(id: string, bodyType: string, estimatedDiameterM?: number): ViewerBody {
  return {
    id,
    bodyType,
    displayName: id,
    spatial: {
      solarSystemId: 'sol',
      frame: 'icrs',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 0,
    },
    physicalCatalog: estimatedDiameterM ? { estimatedDiameterM } : undefined,
  };
}

describe('resolvePlanetViewCameraDistanceRange', () => {
  it('uses stable defaults when selected body is missing', () => {
    expect(resolvePlanetViewCameraDistanceRange(null)).toEqual({ min: 4.2, max: 80 });
  });

  it('uses stable defaults when selected body has no estimated diameter', () => {
    const noDiameterBody = makeBody('earth', 'planet');
    expect(resolvePlanetViewCameraDistanceRange(noDiameterBody)).toEqual({ min: 4.2, max: 80 });
  });

  it('scales camera range by selected-body diameter', () => {
    const earthLike = makeBody('earth', 'planet', 12_742_000);
    const lunaLike = makeBody('luna', 'moon', 3_474_200);

    const earthRange = resolvePlanetViewCameraDistanceRange(earthLike);
    const lunaRange = resolvePlanetViewCameraDistanceRange(lunaLike);

    expect(earthRange.min).toBeGreaterThan(lunaRange.min);
    expect(earthRange.max).toBeGreaterThan(lunaRange.max);
  });

  it('clamps extremely small selected bodies to zoom lower bounds', () => {
    const tinyBody = makeBody('tiny', 'moon', 1);
    const range = resolvePlanetViewCameraDistanceRange(tinyBody);

    expect(range.min).toBe(3.2);
    expect(range.max).toBe(40);
  });

  it('clamps extremely large selected bodies to zoom upper bounds', () => {
    const hugeBody = makeBody('huge', 'planet', 1e15);
    const range = resolvePlanetViewCameraDistanceRange(hugeBody);

    expect(range.min).toBe(14);
    expect(range.max).toBe(180);
  });
});

describe('resolvePlanetViewBodyRadiusKm', () => {
  it('prefers explicit radius when present', () => {
    const body = makeBody('moon-1', 'moon');
    body.physicalCatalog = { radiusKm: 1737 };

    expect(resolvePlanetViewBodyRadiusKm(body)).toBe(1737);
  });

  it('derives moon fallback radius from relative orbital distance when metadata is missing', () => {
    const nearMoon = makeBody('near-moon', 'moon');
    nearMoon.orbitalElements = {
      anchorBodyId: 'planet-1',
      semiMajorAxisKm: 120_000,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 1,
      epoch: '2026-01-01T00:00:00.000Z',
    };

    const farMoon = makeBody('far-moon', 'moon');
    farMoon.orbitalElements = {
      anchorBodyId: 'planet-1',
      semiMajorAxisKm: 1_800_000,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 1,
      epoch: '2026-01-01T00:00:00.000Z',
    };

    const nearRadiusKm = resolvePlanetViewBodyRadiusKm(nearMoon);
    const farRadiusKm = resolvePlanetViewBodyRadiusKm(farMoon);

    expect(nearRadiusKm).not.toBe(farRadiusKm);
    expect(farRadiusKm).toBeGreaterThan(nearRadiusKm);
  });

  it('falls back to stable moon defaults when distance metadata is unavailable', () => {
    const body = makeBody('moon-stable', 'moon');

    const first = resolvePlanetViewBodyRadiusKm(body);
    const second = resolvePlanetViewBodyRadiusKm(body);

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(700);
    expect(first).toBeLessThanOrEqual(3200);
  });
});
