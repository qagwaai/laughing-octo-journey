import type { ViewerBody } from '../../model/solar-system-get';
import type { ShipSummary } from '../../model/ship-list';
import {
  mapBodiesToRendered,
  mapShipsToRendered,
  resolveTargetScenePosition,
  resolveViewerSceneCameraDistanceRange,
} from './viewer-system-scene';
import { resolveViewerShipMeshKind } from './viewer-ship-mesh';
import {
  VIEWER_SCENE_ACTIVE_SHIP_COLOR,
  VIEWER_SCENE_INACTIVE_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_POSITION,
} from './viewer-formatters';

const star: ViewerBody = {
  id: 'star-1',
  bodyType: 'star',
  displayName: 'Sol',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
  visualization: { colorHex: '#fff5b6' },
  spectralClass: 'G2V',
  luminositySolar: 1,
};
const planet: ViewerBody = {
  id: 'planet-1',
  bodyType: 'planet',
  displayName: 'Earth',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 149_597_870, y: 0, z: 0 }, epochMs: 0 },
  visualization: { colorHex: '#3399ff' },
  physicalCatalog: { estimatedDiameterM: 12_742_000 },
};
const marketStation: ViewerBody = {
  id: 'station-market-1',
  bodyType: 'station',
  stationKind: 'market',
  displayName: 'Sol Market Hub',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 149_900_000, y: 0, z: 0 }, epochMs: 0 },
  orbitalElements: {
    anchorBodyId: 'sun',
    semiMajorAxisKm: 149_900_000,
    eccentricity: 0.01,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPeriapsisDeg: 15,
    meanAnomalyAtEpochDeg: 45,
  },
};

const distantPlanet: ViewerBody = {
  id: 'planet-2',
  bodyType: 'planet',
  displayName: 'Mars',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 227_923_661, y: 0, z: 0 }, epochMs: 0 },
  visualization: { colorHex: '#c1440e' },
  physicalCatalog: { estimatedDiameterM: 6_792_000 },
};

const asteroidA: ViewerBody = {
  id: 'asteroid-a',
  bodyType: 'asteroid',
  displayName: 'Asteroid A',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 350_000_000, y: 0, z: 0 }, epochMs: 0 },
  physicalCatalog: { estimatedDiameterM: 800 },
};

const asteroidB: ViewerBody = {
  id: 'asteroid-b',
  bodyType: 'asteroid',
  displayName: 'Asteroid B',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 350_004_000, y: 500, z: -250 }, epochMs: 0 },
  physicalCatalog: { estimatedDiameterM: 1200 },
};

const localProjectionShip: ShipSummary = {
  id: 'ship-local-1',
  name: 'Anchor Ship',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 350_000_500, y: 0, z: 0 },
    epochMs: 1700000000000,
  },
};

describe('ViewerSystemScene mapBodiesToRendered', () => {
  it('partitions stars and non-stars and assigns colors/positions', () => {
    const rendered = mapBodiesToRendered([star, planet, marketStation]);
    expect(rendered.length).toBe(3);

    const renderedStar = rendered.find((b) => b.id === 'star-1');
    const renderedPlanet = rendered.find((b) => b.id === 'planet-1');
    const renderedMarketStation = rendered.find((b) => b.id === 'station-market-1');

    expect(renderedStar?.isStar).toBeTrue();
    expect(renderedStar?.color).toBe('#fff5b6');
    expect(renderedStar?.position).toEqual([0, 0, 0]);
    expect(renderedPlanet?.isStar).toBeFalse();
    expect(renderedPlanet?.color).toBe('#3399ff');
    expect(renderedPlanet?.position[0]).toBeGreaterThan(0);
    expect(renderedMarketStation?.isStar).toBeFalse();
    expect(renderedMarketStation?.color).toBe('#22c55e');
    expect(renderedMarketStation?.position[0]).toBeGreaterThan(0.5);
  });

  it('returns an empty array when no bodies are provided', () => {
    expect(mapBodiesToRendered([])).toEqual([]);
  });

  it('derives a camera distance range from the scene extent', () => {
    const nearRange = resolveViewerSceneCameraDistanceRange([star, planet]);
    const farRange = resolveViewerSceneCameraDistanceRange([star, planet, distantPlanet, marketStation]);

    expect(nearRange.min).toBeLessThan(nearRange.max);
    expect(farRange.max).toBeGreaterThanOrEqual(nearRange.max);
    expect(farRange.min).toBeGreaterThan(0);
  });

  it('reprojects nearby asteroids into local space when an asteroid is targeted at close zoom', () => {
    const globalRendered = mapBodiesToRendered([star, asteroidA, asteroidB], 0, null);
    const localRendered = mapBodiesToRendered([star, asteroidA, asteroidB], 0, 'asteroid-a');

    const globalB = globalRendered.find((b) => b.id === 'asteroid-b');
    const localB = localRendered.find((b) => b.id === 'asteroid-b');
    const localA = localRendered.find((b) => b.id === 'asteroid-a');

    expect(globalB).toBeDefined();
    expect(localB).toBeDefined();
    expect(localA).toBeDefined();
    expect(localB!.position).not.toEqual(globalB!.position);

    const localSeparation = Math.hypot(
      localB!.position[0] - localA!.position[0],
      localB!.position[1] - localA!.position[1],
      localB!.position[2] - localA!.position[2],
    );
    expect(localSeparation).toBeGreaterThan(0.05);
  });

  it('reprojects nearby asteroids into local space when a ship is targeted at close zoom', () => {
    const globalRendered = mapBodiesToRendered([star, asteroidA, asteroidB], 0, null, [localProjectionShip]);
    const localRendered = mapBodiesToRendered([star, asteroidA, asteroidB], 0, 'ship-local-1', [localProjectionShip]);

    const globalB = globalRendered.find((b) => b.id === 'asteroid-b');
    const localB = localRendered.find((b) => b.id === 'asteroid-b');

    expect(globalB).toBeDefined();
    expect(localB).toBeDefined();
    expect(localB!.position).not.toEqual(globalB!.position);
  });

  it('does not apply local asteroid projection above the zoom threshold', () => {
    const globalRendered = mapBodiesToRendered([star, asteroidA, asteroidB], 30, null);
    const thresholdRendered = mapBodiesToRendered([star, asteroidA, asteroidB], 30, 'asteroid-a');

    const globalB = globalRendered.find((b) => b.id === 'asteroid-b');
    const thresholdB = thresholdRendered.find((b) => b.id === 'asteroid-b');

    expect(globalB).toBeDefined();
    expect(thresholdB).toBeDefined();
    expect(thresholdB!.position).toEqual(globalB!.position);
  });
});

describe('mapShipsToRendered', () => {
  const beltShip: ShipSummary = {
    id: 'ship-belt',
    name: 'Nomad',
    model: 'Scavenger Pod',
    tier: 1,
    status: 'ACTIVE',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 3.5e8, y: 0, z: 0 },
      epochMs: 1700000000000,
    },
  };
  const ghostShip = {
    id: 'ship-ghost',
    name: 'Wraith',
    model: 'Scavenger Pod',
    tier: 1,
    status: 'ACTIVE',
    spatial: null,
  } as unknown as ShipSummary;
  const sunOriginShip: ShipSummary = {
    id: 'ship-origin',
    name: 'Sunwreck',
    model: 'Scavenger Pod',
    tier: 1,
    status: 'ACTIVE',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 0,
    },
  };

  it('marks the matching active ship with the amber color', () => {
    const rendered = mapShipsToRendered([beltShip], 'ship-belt');
    expect(rendered).toHaveSize(1);
    expect(rendered[0].isActive).toBeTrue();
    expect(rendered[0].isUnknownSpatial).toBeFalse();
    expect(rendered[0].model).toBe('Scavenger Pod');
    expect(rendered[0].color).toBe(VIEWER_SCENE_ACTIVE_SHIP_COLOR);
    expect(rendered[0].position[0]).toBeGreaterThan(0);
  });

  it('colors non-active ships with the inactive color', () => {
    const rendered = mapShipsToRendered([beltShip], 'someone-else');
    expect(rendered[0].isActive).toBeFalse();
    expect(rendered[0].color).toBe(VIEWER_SCENE_INACTIVE_SHIP_COLOR);
  });

  it('routes ships with null spatial to the unknown-offset fallback', () => {
    const rendered = mapShipsToRendered([ghostShip], null);
    expect(rendered[0].isUnknownSpatial).toBeTrue();
    expect(rendered[0].color).toBe(VIEWER_SCENE_UNKNOWN_SHIP_COLOR);
    expect(rendered[0].position).toEqual(VIEWER_SCENE_UNKNOWN_SHIP_POSITION);
  });

  it('routes ships sitting at the sun origin to the unknown-offset fallback', () => {
    const rendered = mapShipsToRendered([sunOriginShip], null);
    expect(rendered[0].isUnknownSpatial).toBeTrue();
    expect(rendered[0].color).toBe(VIEWER_SCENE_UNKNOWN_SHIP_COLOR);
    expect(rendered[0].position).toEqual(VIEWER_SCENE_UNKNOWN_SHIP_POSITION);
  });

  it('defaults missing ship models through the shared ship-model coercion path', () => {
    const rendered = mapShipsToRendered(
      [
        {
          id: 'ship-missing-model',
          name: 'Fallback',
          model: '' as unknown as string,
          tier: 1,
          status: 'ACTIVE',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 3.5e8, y: 0, z: 0 },
            epochMs: 1700000000000,
          },
        } as ShipSummary,
      ],
      null,
    );

    expect(rendered[0].model).toBe('Scavenger Pod');
  });
});

describe('resolveViewerShipMeshKind', () => {
  it('selects the GLB mesh for Scavenger Pod models (registered in asset catalog)', () => {
    expect(resolveViewerShipMeshKind('Scavenger Pod')).toBe('glb');
  });

  it('falls back to the generic mesh for unknown ship models', () => {
    expect(resolveViewerShipMeshKind('Courier Mk2')).toBe('generic');
  });
});

describe('resolveTargetScenePosition', () => {
  it('resolves a body target id to the body position', () => {
    const bodyPos: [number, number, number] = [1, 2, 3];
    const shipPos: [number, number, number] = [8, 0, 0];
    const result = resolveTargetScenePosition('earth', [{ id: 'earth', position: bodyPos }], [{ id: 'ship-1', position: shipPos }]);
    expect(result).toEqual(bodyPos);
  });

  it('falls back to ship position when target id is a ship', () => {
    const result = resolveTargetScenePosition(
      'ship-1',
      [{ id: 'earth', position: [1, 2, 3] }],
      [{ id: 'ship-1', position: [8, 0, 0] }],
    );
    expect(result).toEqual([8, 0, 0]);
  });

  it('returns null when target id does not exist in bodies or ships', () => {
    const result = resolveTargetScenePosition('missing', [{ id: 'earth', position: [1, 2, 3] }], [{ id: 'ship-1', position: [8, 0, 0] }]);
    expect(result).toBeNull();
  });
});
