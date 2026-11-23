import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import type { SupportedNavigationPositionState } from '../../model/solar-system-get';
import { resolveScenePositionFromSpatialKm } from './viewer-formatters';
import {
  buildNavigationDetour,
  buildCalculatedRouteIllustration,
  NAVIGATION_CANDIDATE_MARKER_RADIUS,
  NAVIGATION_DETOUR_MARGIN,
  navigationRouteClearsScreenMarker,
} from './viewer-navigation-detour';
import type { NavigationRouteLeg } from '../../model/navigation-route-search';

describe('buildCalculatedRouteIllustration', () => {
  const first: NavigationRouteLeg = {
    legIndex: 1, fromBodyOrShipId: 'ship', toBodyOrMarketId: 'mars',
    startPositionKm: { x: -200_000_000, y: 0, z: 0 },
    endPositionKm: { x: 0, y: 10_000, z: 0 },
    departureEpochMs: 1, arrivalEpochMs: 2, distanceKm: 1, durationMs: 1, fuelUnits: 1, withinHopLimit: true,
    encounter: {
      bodyId: 'mars', side: 1, encounterEpochMs: 2,
      bodyCenterPositionKm: { x: 0, y: 0, z: 0 },
      waypointPositionKm: { x: 0, y: 10_000, z: 0 },
      offsetKm: { x: 0, y: 10_000, z: 0 },
      coordinateBasisId: 'basis', positionEvaluationModelId: 'model', sourceRevision: 'revision',
    },
  };
  const last: NavigationRouteLeg = {
    ...first, legIndex: 2, fromBodyOrShipId: 'mars', toBodyOrMarketId: 'market',
    startPositionKm: first.endPositionKm, endPositionKm: { x: 200_000_000, y: 0, z: 0 }, encounter: undefined,
  };

  it.each(['proportional', 'compressed'] as const)(
    'renders a sweep around the timed center in %s mode',
    (mode) => {
      const points = buildCalculatedRouteIllustration([first, last], mode);
      expect(points).not.toBeNull();
      expect(points![0]).toEqual(resolveScenePositionFromSpatialKm(first.startPositionKm, mode));
      expect(points!.at(-1)).toEqual(resolveScenePositionFromSpatialKm(last.endPositionKm, mode));
      expect(points!.length).toBeGreaterThan(10);
      expect(points!.some((point) => Math.abs(point[2]) > 0.4)).toBe(true);
    },
  );

  it('does not invent a center when encounter data is missing', () => {
    expect(buildCalculatedRouteIllustration([{ ...first, encounter: undefined }, last], 'proportional')).toBeNull();
  });

  it('joins sweeps for multiple timed encounters in order', () => {
    const second: NavigationRouteLeg = {
      ...first,
      legIndex: 2,
      fromBodyOrShipId: 'mars',
      toBodyOrMarketId: 'earth',
      startPositionKm: first.endPositionKm,
      endPositionKm: { x: 300_000_000, y: 10_000, z: 0 },
      encounter: {
        ...first.encounter!,
        bodyId: 'earth',
        bodyCenterPositionKm: { x: 300_000_000, y: 0, z: 0 },
        waypointPositionKm: { x: 300_000_000, y: 10_000, z: 0 },
      },
    };
    const destination = {
      ...last,
      legIndex: 3,
      fromBodyOrShipId: 'earth',
      startPositionKm: second.endPositionKm,
      endPositionKm: { x: 500_000_000, y: 0, z: 0 },
    };
    const points = buildCalculatedRouteIllustration([first, second, destination], 'proportional');
    expect(points).not.toBeNull();
    expect(points![0]).toEqual(resolveScenePositionFromSpatialKm(first.startPositionKm, 'proportional'));
    expect(points!.at(-1)).toEqual(resolveScenePositionFromSpatialKm(destination.endPositionKm, 'proportional'));
    expect(points!.length).toBeGreaterThan(100);
  });
});

const state: SupportedNavigationPositionState = {
  status: 'supported',
  solarSystemId: 'sol',
  coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
  epochMs: 1_794_694_161_611,
  departure: { shipId: 'ship-1', positionKm: { x: -200_000_000, y: 0, z: 0 } },
  destination: { marketId: 'market-1', positionKm: { x: 200_000_000, y: 0, z: 0 } },
  candidates: [{ bodyId: 'mars', positionKm: { x: 0, y: 0, z: 0 } }],
  previewEligibility: { status: 'eligible-with-warnings', reason: 'CLEARANCE_UNVERIFIED' },
};

function distanceToSegment(point: number[], start: number[], end: number[]): number {
  const dx = end[0]! - start[0]!;
  const dy = end[2]! - start[2]!;
  const lengthSquared = dx * dx + dy * dy;
  const projection =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point[0]! - start[0]!) * dx + (point[2]! - start[2]!) * dy) / lengthSquared));
  return Math.hypot(point[0]! - (start[0]! + dx * projection), point[2]! - (start[2]! + dy * projection));
}

describe('buildNavigationDetour', () => {
  it.each(['proportional', 'compressed'] as const)(
    'builds a broad, deterministic marker-avoiding sweep in %s mode',
    (mode) => {
      const first = buildNavigationDetour(state, mode);
      const second = buildNavigationDetour(state, mode);
      expect(first).toEqual(second);
      expect(first.status).toBe('detour');
      if (first.status !== 'detour') return;

      const start = resolveScenePositionFromSpatialKm(state.departure.positionKm, mode);
      const end = resolveScenePositionFromSpatialKm(state.destination.positionKm, mode);
      const center = resolveScenePositionFromSpatialKm(state.candidates[0]!.positionKm, mode);
      expect(first.points[0]).toEqual(start);
      expect(first.points[first.points.length - 1]).toEqual(end);
      expect(first.points.length).toBeGreaterThan(3);

      const minimumClearance = NAVIGATION_CANDIDATE_MARKER_RADIUS + NAVIGATION_DETOUR_MARGIN;
      const endpointDistance = Math.hypot(start[0] - center[0], start[2] - center[2]);
      const segmentClearances: number[] = [];
      for (let index = 1; index < first.points.length; index++) {
        const clearance = distanceToSegment(center, first.points[index - 1]!, first.points[index]!);
        segmentClearances.push(clearance);
        expect(clearance).toBeGreaterThanOrEqual(minimumClearance - 1e-5);
      }
      expect(Math.min(...segmentClearances)).toBeGreaterThan(endpointDistance * 0.25);
      expect(first.points.some(([x, , z]) => x < start[0] / 2 && Math.abs(z) > endpointDistance * 0.05)).toBe(true);
      expect(first.points.some(([x, , z]) => x > end[0] / 2 && Math.abs(z) > endpointDistance * 0.05)).toBe(true);
    },
  );

  it('keeps the direct route when no candidate is selected', () => {
    const noCandidate = { ...state, candidates: [] };
    const route = buildNavigationDetour(noCandidate, 'proportional');
    expect(route.status).toBe('direct');
    if (route.status === 'direct') {
      expect(route.points).toEqual([
        resolveScenePositionFromSpatialKm(noCandidate.departure.positionKm, 'proportional'),
        resolveScenePositionFromSpatialKm(noCandidate.destination.positionKm, 'proportional'),
      ]);
    }
  });

  it('does not draw a direct fallback when an endpoint overlaps the candidate marker', () => {
    const overlapping = {
      ...state,
      departure: { ...state.departure, positionKm: state.candidates[0]!.positionKm },
    };
    expect(buildNavigationDetour(overlapping, 'proportional')).toEqual({
      status: 'unavailable',
      reason: 'ENDPOINT_OVERLAPS_CANDIDATE',
    });
  });

  it.each(['proportional', 'compressed'] as const)(
    'handles non-collinear positions and distinct heights in %s mode',
    (mode) => {
      const tilted = {
        ...state,
        destination: { ...state.destination, positionKm: { x: 90_000_000, y: 170_000_000, z: 50_000_000 } },
        candidates: [{ bodyId: 'mars', positionKm: { x: 50_000_000, y: 40_000_000, z: -10_000_000 } }],
      };
      const route = buildNavigationDetour(tilted, mode);
      expect(route.status).toBe('detour');
      if (route.status !== 'detour') return;
      expect(route.points.at(-1)).toEqual(resolveScenePositionFromSpatialKm(tilted.destination.positionKm, mode));
      const center = resolveScenePositionFromSpatialKm(tilted.candidates[0]!.positionKm, mode);
      for (let index = 1; index < route.points.length; index++) {
        expect(distanceToSegment(center, route.points[index - 1]!, route.points[index]!)).toBeGreaterThanOrEqual(
          0.4 - 1e-6,
        );
      }
    },
  );

  it('fails explicitly for nonfinite coordinates and coincident projected endpoints', () => {
    expect(
      buildNavigationDetour(
        {
          ...state,
          destination: { ...state.destination, positionKm: { x: NaN, y: 0, z: 0 } },
        },
        'proportional',
      ).status,
    ).toBe('unavailable');
    expect(
      buildNavigationDetour(
        {
          ...state,
          destination: { ...state.destination, positionKm: state.departure.positionKm },
        },
        'proportional',
      ).status,
    ).toBe('unavailable');
  });

  it('keeps the curve outside the marker with a much longer outbound leg', () => {
    const asymmetric = {
      ...state,
      destination: { ...state.destination, positionKm: { x: 6_000_000_000, y: 1_000_000_000, z: 0 } },
    };
    const route = buildNavigationDetour(asymmetric, 'proportional');
    expect(route.status).toBe('detour');
    if (route.status !== 'detour') return;
    for (let index = 1; index < route.points.length; index++) {
      expect(distanceToSegment([0, 0, 0], route.points[index - 1]!, route.points[index]!)).toBeGreaterThan(0.4);
    }
    expect(route.points.at(-1)).toEqual(
      resolveScenePositionFromSpatialKm(asymmetric.destination.positionKm, 'proportional'),
    );
  });

  it('validates the final camera projection and rejects an edge-on overlap', () => {
    const route = buildNavigationDetour(state, 'proportional');
    expect(route.status).toBe('detour');
    if (route.status !== 'detour') return;
    const camera = new PerspectiveCamera(55, 1, 0.1, 1000);
    camera.position.set(0, 15, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    expect(navigationRouteClearsScreenMarker(route.points, [0, 0, 0], camera, { width: 800, height: 800 })).toBe(true);
    camera.position.set(0, 0, 15);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    expect(navigationRouteClearsScreenMarker(route.points, [0, 0, 0], camera, { width: 800, height: 800 })).toBe(false);
    expect(navigationRouteClearsScreenMarker(route.points, [0, 0, 0], camera, { width: 0, height: 0 })).toBe(false);
  });
});
