import { describe, expect, it } from 'vitest';
import type { ShipSummary } from '../../model/ship-list';
import type { ViewerBody } from '../../model/solar-system-get';
import {
  VIEWER_SCENE_ACTIVE_SHIP_COLOR,
  VIEWER_SCENE_INACTIVE_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_COLOR,
  VIEWER_SCENE_UNKNOWN_SHIP_POSITION,
  resolveScenePositionFromSpatialKm,
  resolveBodySceneRadius,
  isStationBody,
} from './viewer-formatters';
import { resolveDescriptorRenderProfile } from './viewer-descriptor-selectors';
import { resolveViewerShipMeshKind } from './viewer-ship-mesh';
import {
  degToRad,
  mapBodiesToRendered,
  mapShipsToRendered,
  resolveOrbitRotationEuler,
  resolveTargetScenePosition,
  resolveViewerSceneCameraDistanceRange,
  resolveZoomDistance,
  resolveZoomPercent,
  VIEWER_STATION_MESH_SCALE,
} from './viewer-system-scene';

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
  surfaceArchetype: 'rocky',
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
    orbitalPeriodSec: 100_000,
    epoch: '2026-01-01T00:00:00.000Z',
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
  surfaceArchetype: 'rocky',
  displayName: 'Mars',
  spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 227_923_661, y: 0, z: 0 }, epochMs: 0 },
  visualization: { colorHex: '#c1440e' },
  physicalCatalog: { estimatedDiameterM: 6_792_000 },
};

const asteroidA: ViewerBody = {
  id: 'asteroid-a',
  bodyType: 'asteroid',
  surfaceArchetype: 'asteroid',
  displayName: 'Asteroid A',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 350_000_000, y: 0, z: 0 }, epochMs: 0 },
  physicalCatalog: { estimatedDiameterM: 800 },
};

const asteroidB: ViewerBody = {
  id: 'asteroid-b',
  bodyType: 'asteroid',
  surfaceArchetype: 'asteroid',
  displayName: 'Asteroid B',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 350_004_000, y: 500, z: -250 }, epochMs: 0 },
  physicalCatalog: { estimatedDiameterM: 1200 },
};

const asteroidHero: ViewerBody = {
  id: 'asteroid-hero-1',
  bodyType: 'asteroid',
  surfaceArchetype: 'asteroid',
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

const asteroidHeroVariant: ViewerBody = {
  ...asteroidHero,
  id: 'asteroid-hero-2',
  displayName: 'Hero Asteroid Variant',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 361_000_000, y: 0, z: 0 }, epochMs: 0 },
  externalObjectDescriptor: {
    ...(asteroidHero.externalObjectDescriptor as NonNullable<ViewerBody['externalObjectDescriptor']>),
    descriptorId: 'asteroids-cinematic-hero-2',
    displayLabel: 'Hero Asteroid Variant',
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
  const stationVariants: {
    name: string;
    family?: string;
    kind: string;
    scale: [number, number, number];
    rotation: [number, number, number];
  }[] = [
    { name: 'legacy market', kind: 'box', scale: [1.5, 0.85, 1.5], rotation: [0, 0.2, 0] },
    { name: 'legacy non-market', family: '', kind: 'sphere', scale: [1, 1, 1], rotation: [0, 0, 0] },
    { name: 'trade hub', family: 'trade-hub', kind: 'box', scale: [1.65, 0.82, 1.65], rotation: [0, 0.14, 0] },
    { name: 'refinery', family: 'refinery', kind: 'cylinder', scale: [0.92, 1.5, 0.92], rotation: [0, 0.2, 0] },
    { name: 'naval outpost', family: 'naval-outpost', kind: 'octahedron', scale: [1.12, 1.48, 1.12], rotation: [0.1, 0.28, 0] },
    { name: 'research platform', family: 'research-platform', kind: 'torus', scale: [1.36, 1.36, 1.36], rotation: [Math.PI / 2, 0.3, 0] },
  ];

  it.each(stationVariants)('scales $name mesh dimensions to 5% without changing scene data', (variant) => {
    const body: ViewerBody = {
      ...marketStation,
      stationKind: variant.family === undefined ? 'market' : undefined,
      physicalCatalog: { meanRadiusKm: 2 },
      ...(variant.family ? {
        externalObjectDescriptor: {
          ...gateBody.externalObjectDescriptor!,
          domain: 'stations',
          objectFamily: variant.family,
        },
      } : {}),
    };
    const original = structuredClone(body);
    const profile = resolveDescriptorRenderProfile(body.externalObjectDescriptor);
    expect(VIEWER_STATION_MESH_SCALE).toBe(0.05);
    for (const mode of ['compressed', 'proportional'] as const) {
      for (const zoom of [0, 50, 100]) {
        const rendered = mapBodiesToRendered([body], zoom, body.id, [], mode)[0];
        const baselineRadius = +(resolveBodySceneRadius(body, zoom) * (profile?.radiusScale ?? 1)).toFixed(4);
        expect(rendered.radius).toBe(baselineRadius);
        expect(rendered.geometryKind).toBe(variant.kind);
        expect(rendered.geometryRotation).toEqual(variant.rotation);
        for (let axis = 0; axis < 3; axis++) {
          expect(rendered.geometryScale[axis] / variant.scale[axis]).toBeCloseTo(0.05, 12);
        }
        expect(rendered.geometryTorusTubeRadius).toBe(Math.max(baselineRadius * 0.2, 0.03));
        expect(rendered.position).toEqual(resolveScenePositionFromSpatialKm(body.spatial.positionKm, mode));
        expect(resolveTargetScenePosition(body.id, [rendered], [])).toEqual(rendered.position);
        expect(rendered.source).toBe(body);
      }
    }
    expect(body).toEqual(original);
  });

  it('recognizes descriptor and normalized legacy stations without shrinking gates or other meshes', () => {
    expect(isStationBody({ ...marketStation, bodyType: ' Station ' })).toBe(true);
    const descriptorStation: ViewerBody = {
      ...planet,
      externalObjectDescriptor: { ...gateBody.externalObjectDescriptor!, domain: 'stations', objectFamily: 'refinery' },
    };
    expect(isStationBody(descriptorStation)).toBe(true);
    expect(mapBodiesToRendered([descriptorStation])[0].geometryScale).toEqual([0.92 * 0.05, 1.5 * 0.05, 0.92 * 0.05]);
    expect(isStationBody(gateBody)).toBe(false);
    const bodies = [star, planet, asteroidA, debrisCanister, gateBody];
    const expectedScales = [[1, 1, 1], [1, 1, 1], null, [0.9, 1.25, 0.9], [1.8, 1.8, 1.8]];
    const baselineAsteroid = mapBodiesToRendered([asteroidA])[0].geometryScale;
    for (const mode of ['compressed', 'proportional'] as const) {
      for (const zoom of [0, 50, 100]) {
        const rendered = mapBodiesToRendered(bodies, zoom, null, [], mode);
        rendered.forEach((body, index) => {
          expect(isStationBody(body.source)).toBe(false);
          expect(body.geometryScale).toEqual(expectedScales[index] ?? baselineAsteroid);
        });
      }
    }
  });

  it('preserves proportional separations even when an asteroid is targeted at close zoom', () => {
    const normal = mapBodiesToRendered([asteroidA, asteroidB], 0, null, [], 'proportional');
    const targeted = mapBodiesToRendered([asteroidA, asteroidB], 0, asteroidA.id, [], 'proportional');
    expect(targeted.map((body) => body.position)).toEqual(normal.map((body) => body.position));
    expect(targeted[1].position[2] - targeted[0].position[2]).toBeCloseTo(500 / 149_597_870.7 * 5, 12);
  });
  it('extends camera framing beyond the compressed ceiling for proportional outer systems', () => {
    const outer = { ...planet, spatial: { ...planet.spatial, positionKm: { x: 1e10, y: 0, z: 0 } } };
    const range = resolveViewerSceneCameraDistanceRange([outer], 'proportional');
    expect(range.max).toBeGreaterThan(180);
    const distance = resolveZoomDistance(63, [outer], 'proportional');
    expect(resolveZoomPercent(distance, [outer], 'proportional')).toBeCloseTo(63, 8);
  });
  it('keeps ships, stations, gates, targets and canonical snapshots in consistent spaces', () => {
    const spatial = { solarSystemId: 'sol', frame: 'barycentric' as const,
      positionKm: Object.freeze({ x: 1e6, y: 2e6, z: 3e6 }), epochMs: 0 };
    const ship: ShipSummary = { id: 'display-ship', name: 'Display ship', model: 'Scavenger Pod',
      tier: 1, status: 'ACTIVE', spatial };
    const bodies = [planet, marketStation, star, { ...marketStation, id: 'gate', bodyType: 'gate' }]
      .map((body) => ({ ...body, spatial }));
    const rendered = mapBodiesToRendered(bodies);
    const ships = mapShipsToRendered([ship], ship.id);
    const expected = resolveScenePositionFromSpatialKm(spatial.positionKm);
    expect(ships[0].position).toEqual(expected);
    for (const body of rendered) expect(body.position).toEqual(expected);
    expect(resolveTargetScenePosition(ship.id, rendered, ships)).toEqual(expected);
    expect(spatial.positionKm).toEqual({ x: 1e6, y: 2e6, z: 3e6 });
  });
  it('uses barycentric snapshots for anchored bodies and stellar children independent of response order', () => {
    const anchor: ViewerBody = {
      ...planet,
      spatial: { ...planet.spatial, positionKm: { x: 10_000_000, y: 0, z: 0 } },
    };
    const moon: ViewerBody = {
      ...marketStation,
      id: 'snapshot-moon',
      bodyType: 'moon',
      surfaceArchetype: 'rocky-moon',
      parentBodyId: anchor.id,
      spatial: { ...planet.spatial, positionKm: { x: 0, y: 3_000_000, z: 4_000_000 } },
      orbitalElements: { ...marketStation.orbitalElements!, anchorBodyId: anchor.id },
    };
    const companion: ViewerBody = {
      ...star,
      id: 'snapshot-companion',
      parentBodyId: star.id,
      spatial: { ...star.spatial, positionKm: { x: -10_000_000, y: 0, z: 0 } },
    };
    const ordered = mapBodiesToRendered([star, anchor, moon, companion]);
    const reordered = mapBodiesToRendered([companion, moon, anchor, star]);
    for (const body of ordered) {
      expect(reordered.find((entry) => entry.id === body.id)?.position).toEqual(body.position);
    }
    const projectedMoon = ordered.find((body) => body.id === moon.id)!;
    expect(projectedMoon.position[0]).toBe(0);
    expect(projectedMoon.position[1]).toBeLessThan(0);
    expect(projectedMoon.position[2]).toBeGreaterThan(0);
    expect(Math.abs(projectedMoon.position[1])).toBeGreaterThan(projectedMoon.position[2]);
    expect(ordered.find((body) => body.id === companion.id)?.position[0]).toBeLessThan(0);
    expect(mapBodiesToRendered([moon])[0].position).toEqual(projectedMoon.position);
  });
  it('partitions stars and non-stars and assigns colors/positions', () => {
    const rendered = mapBodiesToRendered([star, planet, marketStation]);
    expect(rendered.length).toBe(3);

    const renderedStar = rendered.find((b) => b.id === 'star-1');
    const renderedPlanet = rendered.find((b) => b.id === 'planet-1');
    const renderedMarketStation = rendered.find((b) => b.id === 'station-market-1');

    expect(renderedStar?.isStar).toBe(true);
    expect(renderedStar?.color).toBe('#fff5b6');
    expect(renderedStar?.position).toEqual([0, 0, 0]);
    expect(renderedPlanet?.isStar).toBe(false);
    expect(renderedPlanet?.color).toBe('#3399ff');
    expect(renderedPlanet?.position[0]).toBeGreaterThan(0);
    expect(renderedMarketStation?.isStar).toBe(false);
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
    expect(renderedGate?.geometryKind).toBe('torus');
  });

  it('applies asteroid descriptor profile rendering deterministically', () => {
    const first = mapBodiesToRendered([star, asteroidHero]).find((body) => body.id === 'asteroid-hero-1');
    const second = mapBodiesToRendered([star, asteroidHero]).find((body) => body.id === 'asteroid-hero-1');

    expect(first).toBeDefined();
    expect(first?.materialColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(first?.materialColor).toBe(second?.materialColor);
    expect(first?.materialEmissive).toBe('#78350f');
    expect(first?.materialEmissiveIntensity).toBeCloseTo(0.2478, 4);
    expect(first?.geometrySegments).toBe(28);
    expect(first).toEqual(second);
  });

  it('keeps hero asteroid geometry deterministic but non-uniform across descriptor ids', () => {
    const rendered = mapBodiesToRendered([star, asteroidHero, asteroidHeroVariant]);
    const firstHero = rendered.find((body) => body.id === 'asteroid-hero-1');
    const secondHero = rendered.find((body) => body.id === 'asteroid-hero-2');

    expect(firstHero).toBeDefined();
    expect(secondHero).toBeDefined();
    expect(firstHero?.geometryKind).toBe('rock-deformed');
    expect(firstHero?.geometryKind).toBe(secondHero?.geometryKind);
    expect(firstHero?.geometryScale).not.toEqual(secondHero?.geometryScale);
    expect(firstHero?.geometryRotation).not.toEqual(secondHero?.geometryRotation);
  });

  it('applies debris descriptor profile rendering deterministically', () => {
    const first = mapBodiesToRendered([star, debrisCanister]).find((body) => body.id === 'debris-canister-1');
    const second = mapBodiesToRendered([star, debrisCanister]).find((body) => body.id === 'debris-canister-1');

    expect(first).toBeDefined();
    expect(first?.materialColor).toBe('#14b8a6');
    expect(first?.materialEmissive).toBe('#042f2e');
    expect(first?.materialEmissiveIntensity).toBe(0.12);
    expect(first?.geometrySegments).toBe(14);
    expect(first?.geometryKind).toBe('capsule');
    expect(first?.geometryScale).toEqual([0.9, 1.25, 0.9]);
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
    expect(localB!.position[1] - localA!.position[1]).toBeGreaterThan(0);
    expect(localB!.position[2] - localA!.position[2]).toBeGreaterThan(0);
    expect(localB!.position[2] - localA!.position[2]).toBeCloseTo(
      2 * (localB!.position[1] - localA!.position[1]), 3,
    );
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
    expect(rendered.length).toBe(1);
    expect(rendered[0].isActive).toBe(true);
    expect(rendered[0].isUnknownSpatial).toBe(false);
    expect(rendered[0].model).toBe('Scavenger Pod');
    expect(rendered[0].color).toBe(VIEWER_SCENE_ACTIVE_SHIP_COLOR);
    expect(rendered[0].position[0]).toBeGreaterThan(0);
  });

  it('colors non-active ships with the inactive color', () => {
    const rendered = mapShipsToRendered([beltShip], 'someone-else');
    expect(rendered[0].isActive).toBe(false);
    expect(rendered[0].color).toBe(VIEWER_SCENE_INACTIVE_SHIP_COLOR);
  });

  it('routes ships with null spatial to the unknown-offset fallback', () => {
    const rendered = mapShipsToRendered([ghostShip], null);
    expect(rendered[0].isUnknownSpatial).toBe(true);
    expect(rendered[0].color).toBe(VIEWER_SCENE_UNKNOWN_SHIP_COLOR);
    expect(rendered[0].position).toEqual(VIEWER_SCENE_UNKNOWN_SHIP_POSITION);
  });

  it('routes ships sitting at the sun origin to the unknown-offset fallback', () => {
    const rendered = mapShipsToRendered([sunOriginShip], null);
    expect(rendered[0].isUnknownSpatial).toBe(true);
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
    const result = resolveTargetScenePosition(
      'earth',
      [{ id: 'earth', position: bodyPos }],
      [{ id: 'ship-1', position: shipPos }],
    );
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
    const result = resolveTargetScenePosition(
      'missing',
      [{ id: 'earth', position: [1, 2, 3] }],
      [{ id: 'ship-1', position: [8, 0, 0] }],
    );
    expect(result).toBeNull();
  });
});

describe('viewer-system-scene helper math', () => {
  it('degToRad returns 0 for invalid input and converts finite degrees', () => {
    expect(degToRad(undefined)).toBe(0);
    expect(degToRad(Number.NaN)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
  });

  it('resolveZoomDistance clamps zoom and resolveZoomPercent inverts mapping', () => {
    const bodies = [star, planet, distantPlanet];
    const near = resolveZoomDistance(-10, bodies);
    const far = resolveZoomDistance(200, bodies);

    const range = resolveViewerSceneCameraDistanceRange(bodies);
    expect(near).toBeCloseTo(range.min, 6);
    expect(far).toBeCloseTo(range.max, 6);

    expect(resolveZoomPercent(near, bodies)).toBeCloseTo(0, 6);
    expect(resolveZoomPercent(far, bodies)).toBeCloseTo(100, 6);
  });

  it('resolveZoomPercent handles degenerate range without NaN', () => {
    expect(resolveZoomPercent(10, [])).toBeGreaterThanOrEqual(0);
  });

  it('resolveOrbitRotationEuler returns finite XYZ angles with and without orbital elements', () => {
    const withElements = resolveOrbitRotationEuler({
      anchorBodyId: 'sun',
      semiMajorAxisKm: 1,
      eccentricity: 0.1,
      inclinationDeg: 10,
      longitudeOfAscendingNodeDeg: 20,
      argumentOfPeriapsisDeg: 30,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 100_000,
      epoch: '2026-01-01T00:00:00.000Z',
    });
    const withoutElements = resolveOrbitRotationEuler(undefined);

    for (const value of withElements) {
      expect(Number.isFinite(value)).toBe(true);
    }
    for (const value of withoutElements) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
