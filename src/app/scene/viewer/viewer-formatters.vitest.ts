import { describe, expect, it } from 'vitest';
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
  isMoonBody,
  VIEWER_SCENE_STAR_BASE_RADIUS,
  VIEWER_SCENE_STAR_MAX_RADIUS,
  VIEWER_SCENE_STAR_MIN_RADIUS,
  isGateBody,
  isMarketStationBody,
  isStarBody,
  resolveBodyColor,
  resolveBodySceneRadius,
  resolveBodyScenePosition,
  resolveBodyOrbitalPositionRelativeToAnchor,
  resolveOrbitColor,
  resolveMoonSceneRadius,
  resolvePlanetSceneRadius,
  resolveStarSceneRadius,
} from './viewer-formatters';

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
    expect(resolveStarSceneRadius(0)).toBe(VIEWER_SCENE_STAR_BASE_RADIUS);
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

  it('routes resolveBodySceneRadius to star/planet helpers', () => {
    expect(resolveBodySceneRadius(starBody)).toBe(resolveStarSceneRadius(1));
    expect(resolveBodySceneRadius(planetBody)).toBe(resolvePlanetSceneRadius(12_742_000));
  });

  it('resolves market station orbit color as light green', () => {
    expect(resolveOrbitColor(marketStationBody)).toBe(VIEWER_SCENE_MARKET_ORBIT_COLOR);
    expect(resolveOrbitColor(planetBody)).toBe('#ffffff');
    expect(resolveOrbitColor(gateBody)).toBe(VIEWER_SCENE_GATE_ORBIT_COLOR);
  });

  it('keeps market station orbit positions visible instead of compressing them like moons', () => {
    const positioned = resolveBodyOrbitalPositionRelativeToAnchor(
      {
        ...marketStationBody,
        orbitalElements: {
          anchorBodyId: 'sol-asteroid-belt',
          semiMajorAxisKm: 8_200,
          eccentricity: 0.11,
          inclinationDeg: 5.1,
          longitudeOfAscendingNodeDeg: 0,
          argumentOfPeriapsisDeg: 96,
          meanAnomalyAtEpochDeg: 140,
        },
      },
      [0, 0, 0],
    );

    expect(positioned).not.toBeNull();
    const orbitDistance = Math.hypot(positioned![0], positioned![1], positioned![2]);
    expect(orbitDistance).toBeGreaterThan(0.5);
  });
});
