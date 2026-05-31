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

const gateBody: ViewerBody = {
  id: 'gate-ring-alpha',
  bodyType: 'station',
  displayName: 'Ring Gate Alpha',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 170_000_000, y: 0, z: 0 }, epochMs: 0 },
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

const asteroidHero: ViewerBody = {
  id: 'asteroid-hero-1',
  bodyType: 'asteroid',
  displayName: 'Hero Asteroid',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 360_000_000, y: 0, z: 0 }, epochMs: 0 },
  physicalCatalog: { estimatedDiameterM: 2000 },
  externalObjectDescriptor: {
    descriptorId: 'asteroids-cinematic-hero-1',
    schemaVersion: 'sw-13-m0-v1',
    domain: 'asteroids',
    objectFamily: 'cinematic-hero',
    roleCue: 'hazard',
    factionCue: 'neutral',
    fallbackTier: 'hero',
    displayLabel: 'Hero Asteroid',
    silhouetteProfile: 'boulder',
    materialProfile: 'rock',
    emissiveProfile: 'none',
  },
};

const debrisCanister: ViewerBody = {
  id: 'debris-canister-1',
  bodyType: 'debris',
  displayName: 'Cargo Canister Debris',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 360_500_000, y: 0, z: 0 }, epochMs: 0 },
  physicalCatalog: { estimatedDiameterM: 200 },
  externalObjectDescriptor: {
    descriptorId: 'debris-cargo-canister-1',
    schemaVersion: 'sw-13-m0-v1',
    domain: 'debris',
    objectFamily: 'cargo-canister',
    roleCue: 'salvage',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Cargo Canister Debris',
    silhouetteProfile: 'canister',
    materialProfile: 'industrial',
    emissiveProfile: 'none',
  },
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

  it('maps gate descriptor bodies with gate-specific color', () => {
    const rendered = mapBodiesToRendered([star, gateBody]);
    const renderedGate = rendered.find((body) => body.id === 'gate-ring-alpha');

    expect(renderedGate).toBeDefined();
    expect(renderedGate?.color).toBe('#38bdf8');
  });

  it('applies asteroid descriptor profile rendering deterministically', () => {
    const first = mapBodiesToRendered([star, asteroidHero]).find((body) => body.id === 'asteroid-hero-1');
    const second = mapBodiesToRendered([star, asteroidHero]).find((body) => body.id === 'asteroid-hero-1');

    expect(first).toBeDefined();
    expect(first?.materialColor).toBe('#f59e0b');
    expect(first?.materialEmissive).toBe('#78350f');
    expect(first?.materialEmissiveIntensity).toBeCloseTo(0.2478, 4);
    expect(first?.geometrySegments).toBe(28);
    expect(first).toEqual(second);
  });

  it('applies debris descriptor profile rendering deterministically', () => {
    const first = mapBodiesToRendered([star, debrisCanister]).find((body) => body.id === 'debris-canister-1');
    const second = mapBodiesToRendered([star, debrisCanister]).find((body) => body.id === 'debris-canister-1');

    expect(first).toBeDefined();
    expect(first?.materialColor).toBe('#14b8a6');
    expect(first?.materialEmissive).toBe('#042f2e');
    expect(first?.materialEmissiveIntensity).toBe(0.12);
    expect(first?.geometrySegments).toBe(14);
    expect(first).toEqual(second);
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
  const frigateDescriptorShip: ShipSummary = {
    id: 'ship-frigate-1',
    name: 'Frigate One',
    model: 'Scavenger Pod',
    tier: 2,
    status: 'ACTIVE',
    externalObjectDescriptor: {
      descriptorId: 'ships-frigate-1',
      schemaVersion: 'sw-13-m0-v1',
      domain: 'ships',
      objectFamily: 'frigate',
      roleCue: 'combat',
      factionCue: 'alliance',
      fallbackTier: 'standard',
      displayLabel: 'Frigate One',
      silhouetteProfile: 'wedge',
      materialProfile: 'alloy',
      emissiveProfile: 'low',
    },
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 3.6e8, y: 0, z: 0 },
      epochMs: 1700000000000,
    },
  };
  const minimalFrigateDescriptorShip: ShipSummary = {
    ...frigateDescriptorShip,
    id: 'ship-frigate-minimal-1',
    externalObjectDescriptor: {
      ...frigateDescriptorShip.externalObjectDescriptor!,
      descriptorId: 'ships-frigate-minimal-1',
      fallbackTier: 'minimal',
    },
  };
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

  it('applies ship descriptor profile colors for inactive ships', () => {
    const rendered = mapShipsToRendered([frigateDescriptorShip], null);
    expect(rendered[0].color).toBe('#6366f1');
    expect(rendered[0].recognitionDistanceKm).toBeGreaterThan(0);
  });

  it('keeps active ship color priority while preserving descriptor recognition distance', () => {
    const rendered = mapShipsToRendered([frigateDescriptorShip], 'ship-frigate-1');
    expect(rendered[0].color).toBe(VIEWER_SCENE_ACTIVE_SHIP_COLOR);
    expect(rendered[0].recognitionDistanceKm).toBeGreaterThan(0);
  });

  it('reduces recognition distance for minimal fallback tier versus standard', () => {
    const standard = mapShipsToRendered([frigateDescriptorShip], null)[0];
    const minimal = mapShipsToRendered([minimalFrigateDescriptorShip], null)[0];
    expect(standard.recognitionDistanceKm).toBeGreaterThan(minimal.recognitionDistanceKm);
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
