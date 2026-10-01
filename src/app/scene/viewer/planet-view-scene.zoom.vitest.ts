import { describe, expect, it } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import {
  createStarGlowTexture,
  hexToRgb,
  resolveOrbitAngleRad,
  resolveOrbitRadiusUnits,
  resolvePlanetViewBodyRadiusKm,
  resolvePlanetViewCameraDistanceRange,
  resolveStarMarker,
  resolveStarMarkers,
} from './planet-view-scene';

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

  it('uses estimatedDiameterM/2000 when explicit radius is absent', () => {
    const body = makeBody('diameter-only', 'planet', 10_000);
    expect(resolvePlanetViewBodyRadiusKm(body)).toBe(5);
  });

  it('falls back to default planet radius when no metadata is available', () => {
    const body = makeBody('unknown-planet', 'planet');
    expect(resolvePlanetViewBodyRadiusKm(body)).toBe(6200);
  });
});

describe('planet-view helper utilities', () => {
  it('resolveOrbitRadiusUnits clamps to base and max bounds', () => {
    expect(resolveOrbitRadiusUnits(0)).toBe(4.5);
    expect(resolveOrbitRadiusUnits(1e12)).toBeGreaterThan(30);
    expect(resolveOrbitRadiusUnits(1e20)).toBe(42);
  });

  it('resolveOrbitAngleRad uses anomaly when present and hash fallback otherwise', () => {
    const withAnomaly = makeBody('moon-with-angle', 'moon');
    withAnomaly.orbitalElements = {
      anchorBodyId: 'planet-1',
      semiMajorAxisKm: 120_000,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 90,
      orbitalPeriodSec: 1,
      epoch: '2026-01-01T00:00:00.000Z',
    };

    expect(resolveOrbitAngleRad(withAnomaly)).toBeCloseTo(Math.PI / 2, 10);

    const fallbackA = makeBody('moon-hash-a', 'moon');
    const fallbackB = makeBody('moon-hash-b', 'moon');
    expect(resolveOrbitAngleRad(fallbackA)).not.toBe(resolveOrbitAngleRad(fallbackB));
  });

  it('resolveStarMarker returns null when no star exists', () => {
    const selected = makeBody('planet-1', 'planet', 12_742_000);
    const noStar = resolveStarMarker(selected, [selected], 8);
    expect(noStar).toBeNull();
  });

  it('resolveStarMarker computes deterministic marker around selected planet', () => {
    const selected = makeBody('planet-1', 'planet', 12_742_000);
    selected.spatial.positionKm.x = 1000;
    selected.spatial.positionKm.z = 250;

    const star = makeBody('star-1', 'star', 100_000_000);
    star.spatial.positionKm.x = -2000;
    star.spatial.positionKm.z = -500;
    star.visualization = { colorHex: '#ffaa00' };

    const marker = resolveStarMarker(selected, [selected, star], 9);
    expect(marker).not.toBeNull();
    expect(marker?.id).toBe('star-1');
    expect(marker?.radius).toBe(0.66);
    expect(marker?.glowSize).toBeGreaterThanOrEqual(7);
  });

  it('resolveStarMarkers places every star in a binary system', () => {
    // A system can be a binary, and the previous single-star lookup meant the
    // companion neither appeared nor contributed any light.
    const selected = makeBody('planet-1', 'planet', 12_742_000);
    selected.spatial.positionKm.x = 1000;
    selected.spatial.positionKm.z = 250;

    const primary = makeBody('star-1', 'star', 100_000_000);
    primary.spatial.positionKm.x = -2000;
    primary.spatial.positionKm.z = -500;

    const companion = makeBody('star-2', 'star', 50_000_000);
    companion.spatial.positionKm.x = 4000;
    companion.spatial.positionKm.z = 900;

    const markers = resolveStarMarkers(selected, [selected, primary, companion], 9);

    expect(markers.map((marker) => marker.id)).toEqual(['star-1', 'star-2']);
    expect(markers[0].position).not.toEqual(markers[1].position);
    expect(markers[0].body).toBe(primary);
  });

  it('resolveStarMarkers fans apart stars catalogued at the same point', () => {
    const selected = makeBody('planet-1', 'planet', 12_742_000);
    const first = makeBody('star-1', 'star', 100_000_000);
    const second = makeBody('star-2', 'star', 100_000_000);

    const markers = resolveStarMarkers(selected, [selected, first, second], 9);

    expect(markers).toHaveLength(2);
    expect(markers[0].position).not.toEqual(markers[1].position);
  });

  it('hexToRgb handles valid and invalid channels', () => {
    expect(hexToRgb('#112233')).toEqual([17, 34, 51]);
    expect(hexToRgb('zzzzzz')).toEqual([128, 128, 128]);
  });

  it('creates the star glow texture', () => {
    const glowTexture = createStarGlowTexture('#ffcc66');

    expect(glowTexture).toBeDefined();
    expect((glowTexture.image as HTMLCanvasElement).width).toBe(256);
  });
});
