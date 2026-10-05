import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import type { ViewerBody } from '../../model/solar-system-get';
import {
  VIEWER_SCENE_DEFAULT_PLANET_COLOR,
  VIEWER_SCENE_DEFAULT_STAR_COLOR,
  VIEWER_SCENE_GATE_COLOR,
  VIEWER_SCENE_GATE_ORBIT_COLOR,
  VIEWER_SCENE_MARKET_ORBIT_COLOR,
  VIEWER_SCENE_MARKET_STATION_COLOR,
  VIEWER_SCENE_MOON_BASE_RADIUS,
  VIEWER_SCENE_MOON_MAX_RADIUS,
  VIEWER_SCENE_MOON_MIN_RADIUS,
  VIEWER_SCENE_PLANET_BASE_RADIUS,
  VIEWER_SCENE_PLANET_MAX_RADIUS,
  VIEWER_SCENE_PLANET_MIN_RADIUS,
  VIEWER_SCENE_STAR_BASE_RADIUS,
  VIEWER_SCENE_STAR_MAX_RADIUS,
  VIEWER_SCENE_STAR_MIN_RADIUS,
  isGateBody,
  isMarketStationBody,
  isMoonBody,
  isStarBody,
  resolveBodyColor,
  resolveBodyScenePosition,
  resolveSceneDistanceFromKm,
  resolveBodySceneRadius,
  resolveMoonSceneRadius,
  resolveOrbitColor,
  resolvePlanetSceneRadius,
  resolveStarSceneRadius,
  resolveViewerDisplayVector,
  resolveOrbitRotationEuler,
  resolveScenePositionFromSpatialKm,
} from './viewer-formatters';

describe('Viewer display coordinate boundary', () => {
  it('preserves distance ratios and relative offsets in proportional mode without minimum radii', () => {
    const au = 149_597_870.7;
    expect(resolveSceneDistanceFromKm(au, 'proportional')).toBe(5);
    expect(resolveSceneDistanceFromKm(30.1 * au, 'proportional')).toBeCloseTo(150.5, 12);
    const earth = { x: au, y: 0, z: 0 };
    const moon = { x: au, y: 384400, z: 500 };
    const a = resolveScenePositionFromSpatialKm(earth, 'proportional');
    const b = resolveScenePositionFromSpatialKm(moon, 'proportional');
    expect(a).toEqual([5, 0, 0]);
    expect(b[1] - a[1]).toBeCloseTo(-500 / au * 5, 12);
    expect(b[2] - a[2]).toBeCloseTo(384400 / au * 5, 12);
    expect(resolveSceneDistanceFromKm(1200, 'proportional')).toBeLessThan(0.001);
    expect(resolveScenePositionFromSpatialKm(earth, 'compressed')[0]).toBeGreaterThan(5);
    expect(earth).toEqual({ x: au, y: 0, z: 0 });
  });
  it('rotates canonical axes without reflecting, scaling or mutating them', () => {
    const x = new Vector3(...resolveViewerDisplayVector({ x: 1, y: 0, z: 0 }));
    const y = new Vector3(...resolveViewerDisplayVector({ x: 0, y: 1, z: 0 }));
    const z = new Vector3(...resolveViewerDisplayVector({ x: 0, y: 0, z: 1 }));
    expect(x.toArray()).toEqual([1, 0, 0]);
    expect(y.toArray()).toEqual([0, 0, 1]);
    expect(z.toArray()).toEqual([0, -1, 0]);
    expect(x.clone().cross(y).toArray()).toEqual(z.toArray());
    const input = Object.freeze({ x: 3, y: 4, z: 12 });
    expect(Math.hypot(...resolveViewerDisplayVector(input))).toBe(13);
    expect(input).toEqual({ x: 3, y: 4, z: 12 });
    expect(Math.hypot(...resolveScenePositionFromSpatialKm({ x: 0, y: 1e6, z: 0 }))).toBe(5);
  });

  it('orients guides using the canonical orbital formula followed by one display rotation', () => {
    const orbital = {
      semiMajorAxisKm: 1, eccentricity: 0, inclinationDeg: 25,
      longitudeOfAscendingNodeDeg: 35, argumentOfPeriapsisDeg: 55,
      meanAnomalyAtEpochDeg: 90, orbitalPeriodSec: -100,
      epoch: '2026-01-01T00:00:00.000Z',
    };
    const canonical = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 35 * Math.PI / 180)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 25 * Math.PI / 180))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 55 * Math.PI / 180));
    const guide = new Euler(...resolveOrbitRotationEuler(orbital), 'XYZ');
    for (const vector of [new Vector3(1, 0, 0), new Vector3(0, 1, 0)]) {
      const expected = new Vector3(...resolveViewerDisplayVector(vector.clone().applyQuaternion(canonical)));
      expect(vector.clone().applyEuler(guide).distanceTo(expected)).toBeLessThan(1e-12);
    }
    const inclined = { ...orbital, longitudeOfAscendingNodeDeg: 0, argumentOfPeriapsisDeg: 0 };
    expect(new Vector3(0, 1, 0).applyEuler(new Euler(...resolveOrbitRotationEuler(inclined))).y).toBeLessThan(0);
  });
});

const baseSpatial = (x = 0, y = 0, z = 0) => ({
  solarSystemId: 'sol',
  frame: 'icrs',
  positionKm: { x, y, z },
  epochMs: 0,
});

const starBody: ViewerBody = {
  id: 'star-1',
  bodyType: 'star',
  displayName: 'Sol',
  spatial: baseSpatial(),
  spectralClass: 'G2V',
  luminositySolar: 1,
  visualization: { colorHex: '#fff5b6' },
};

const planetBody: ViewerBody = {
  id: 'planet-1',
  bodyType: 'planet',
  displayName: 'Earth',
  spatial: baseSpatial(149_597_870),
  physicalCatalog: { estimatedDiameterM: 12_742_000 },
  visualization: { colorHex: '#3399ff' },
};

const moonBody: ViewerBody = {
  id: 'moon-1',
  bodyType: 'moon',
  displayName: 'Luna',
  spatial: baseSpatial(149_982_270),
  physicalCatalog: { estimatedDiameterM: 3_474_200 },
  visualization: { colorHex: '#9bb1c9' },
};

const marketStationBody: ViewerBody = {
  id: 'station-market-1',
  bodyType: 'station',
  stationKind: 'market',
  displayName: 'Sol Market Alpha',
  spatial: baseSpatial(160_000_000),
};

const gateBody: ViewerBody = {
  id: 'gate-ring-1',
  bodyType: 'station',
  displayName: 'Ring Gate Alpha',
  spatial: baseSpatial(180_000_000),
  externalObjectDescriptor: {
    descriptorId: 'gates-ring-gate-alpha',
    schemaVersion: 'sw-13-m0-v1',
    domain: 'gates',
    objectFamily: 'ring-gate',
    roleCue: 'navigation',
    factionCue: 'neutral',
    fallbackTier: 'hero',
    displayLabel: 'Ring Gate Alpha',
    silhouetteProfile: 'ring',
    materialProfile: 'infrastructure',
    emissiveProfile: 'navigation',
  },
};

describe('viewer-formatters', () => {
  it('detects star bodies', () => {
    expect(isStarBody(starBody)).toBe(true);
    expect(isStarBody(planetBody)).toBe(false);
  });

  it('detects moon bodies', () => {
    expect(isMoonBody(moonBody)).toBe(true);
    expect(isMoonBody(planetBody)).toBe(false);
  });

  it('detects market station bodies', () => {
    expect(isMarketStationBody(marketStationBody)).toBe(true);
    expect(isMarketStationBody(planetBody)).toBe(false);
  });

  it('detects market stations from descriptor family without legacy stationKind', () => {
    const descriptorStation: ViewerBody = {
      ...marketStationBody,
      stationKind: undefined,
      externalObjectDescriptor: {
        descriptorId: 'stations-trade-hub-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'stations',
        objectFamily: 'trade-hub',
        roleCue: 'trade',
        factionCue: 'consortium',
        fallbackTier: 'standard',
        displayLabel: 'Trade Hub Station',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
    };
    expect(isMarketStationBody(descriptorStation)).toBe(true);
  });

  it('detects gate bodies via descriptor domain', () => {
    expect(isGateBody(gateBody)).toBe(true);
    expect(isGateBody(planetBody)).toBe(false);
  });

  it('uses explicit visualization colors when present', () => {
    expect(resolveBodyColor(starBody)).toBe('#fff5b6');
    expect(resolveBodyColor(planetBody)).toBe('#3399ff');
  });

  it('falls back to defaults when color is missing', () => {
    const star = { ...starBody, visualization: undefined };
    const planet = { ...planetBody, visualization: undefined };
    const marketStation = { ...marketStationBody, visualization: undefined };
    expect(resolveBodyColor(star)).toBe(VIEWER_SCENE_DEFAULT_STAR_COLOR);
    expect(resolveBodyColor(planet)).toBe(VIEWER_SCENE_DEFAULT_PLANET_COLOR);
    expect(resolveBodyColor(marketStation)).toBe(VIEWER_SCENE_MARKET_STATION_COLOR);
    expect(resolveBodyColor(gateBody)).toBe(VIEWER_SCENE_GATE_COLOR);
  });

  it('clamps star radius using luminosity', () => {
    expect(resolveStarSceneRadius(undefined)).toBe(VIEWER_SCENE_STAR_BASE_RADIUS);
    expect(resolveStarSceneRadius(0)).toBe(VIEWER_SCENE_STAR_MIN_RADIUS);
    expect(resolveStarSceneRadius(1)).toBe(VIEWER_SCENE_STAR_BASE_RADIUS);
    expect(resolveStarSceneRadius(0.0001)).toBe(VIEWER_SCENE_STAR_MIN_RADIUS);
    expect(resolveStarSceneRadius(10_000)).toBe(VIEWER_SCENE_STAR_MAX_RADIUS);
  });

  it('clamps planet radius using diameter', () => {
    expect(resolvePlanetSceneRadius(undefined)).toBe(VIEWER_SCENE_PLANET_BASE_RADIUS);
    expect(resolvePlanetSceneRadius(0)).toBe(VIEWER_SCENE_PLANET_BASE_RADIUS);
    expect(resolvePlanetSceneRadius(1)).toBeCloseTo(VIEWER_SCENE_PLANET_MIN_RADIUS, 1);
    expect(resolvePlanetSceneRadius(1e15)).toBe(VIEWER_SCENE_PLANET_MAX_RADIUS);
  });

  it('clamps moon radius using diameter', () => {
    expect(resolveMoonSceneRadius(undefined)).toBe(VIEWER_SCENE_MOON_BASE_RADIUS);
    expect(resolveMoonSceneRadius(0)).toBe(VIEWER_SCENE_MOON_BASE_RADIUS);
    expect(resolveMoonSceneRadius(1)).toBeCloseTo(VIEWER_SCENE_MOON_MIN_RADIUS, 2);
    expect(resolveMoonSceneRadius(1e15)).toBe(VIEWER_SCENE_MOON_MAX_RADIUS);
  });

  it('uses moon-specific scaling for moon bodies', () => {
    expect(resolveBodySceneRadius(moonBody)).toBe(resolveMoonSceneRadius(3_474_200));
  });

  it('places stars at scene origin and planets along their direction vector', () => {
    expect(resolveBodyScenePosition(starBody)).toEqual([0, 0, 0]);
    const [px, py, pz] = resolveBodyScenePosition(planetBody);
    expect(px).toBeGreaterThan(0);
    expect(py).toBe(0);
    expect(pz).toBe(0);
  });

  it('returns origin when planet position magnitude is zero', () => {
    const placed: ViewerBody = { ...planetBody, spatial: baseSpatial(0, 0, 0) };
    expect(resolveBodyScenePosition(placed)).toEqual([0, 0, 0]);
  });

  it('projects a companion star snapshot instead of forcing every star to origin', () => {
    const companion: ViewerBody = {
      ...starBody,
      id: 'companion',
      parentBodyId: starBody.id,
      spatial: baseSpatial(0, 3_000_000, 4_000_000),
    };
    const position = resolveBodyScenePosition(companion);
    const distance = resolveSceneDistanceFromKm(5_000_000);
    expect(position).toEqual([0, +(-distance * 0.8).toFixed(3), +(distance * 0.6).toFixed(3)]);
  });

  it('routes resolveBodySceneRadius to star/planet helpers', () => {
    expect(resolveBodySceneRadius(starBody)).toBe(resolveStarSceneRadius(1));
    expect(resolveBodySceneRadius(planetBody)).toBe(resolvePlanetSceneRadius(12_742_000));
  });

  it('uses catalog scalar radius precedence for scene sizing', () => {
    const body = {
      ...planetBody,
      physicalCatalog: { meanRadiusKm: 6_000, equatorialRadiusKm: 6_500, estimatedDiameterM: 12_000_000 },
    };
    expect(resolveBodySceneRadius(body)).toBe(resolvePlanetSceneRadius(12_000_000));
  });

  it('keeps valid zero luminosity distinct from unknown for stellar size presentation', () => {
    expect(resolveStarSceneRadius(0)).toBe(VIEWER_SCENE_STAR_MIN_RADIUS);
    expect(resolveStarSceneRadius(null)).toBe(VIEWER_SCENE_STAR_BASE_RADIUS);
  });

  it('resolves market station orbit color as light green', () => {
    expect(resolveOrbitColor(marketStationBody)).toBe(VIEWER_SCENE_MARKET_ORBIT_COLOR);
    expect(resolveOrbitColor(planetBody)).toBe('#ffffff');
    expect(resolveOrbitColor(gateBody)).toBe(VIEWER_SCENE_GATE_ORBIT_COLOR);
  });

  it('uses a station snapshot even when orbital elements specify a different position', () => {
    const station = {
        ...marketStationBody,
        orbitalElements: {
          anchorBodyId: 'sol-asteroid-belt',
          semiMajorAxisKm: 8_200,
          eccentricity: 0.11,
          inclinationDeg: 5.1,
          longitudeOfAscendingNodeDeg: 0,
          argumentOfPeriapsisDeg: 96,
          meanAnomalyAtEpochDeg: 140,
          orbitalPeriodSec: 100_000,
          epoch: '2026-01-01T00:00:00.000Z',
        },
      };
    expect(resolveBodyScenePosition(station)).toEqual(resolveBodyScenePosition(marketStationBody));
  });
});
