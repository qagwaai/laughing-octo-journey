import { describe, expect, it } from 'vitest';
import type { NavigationDirectReference, NavigationRouteSuccess } from '../model/navigation-route-search';
import { selectNavigationRoutes } from './navigation-route-selection';

const assessment = {
  level: 'clear-within-survey' as const,
  markers: [],
  unresolvedBodyIds: [],
  unresolvedAssessments: [],
  surveyStatus: 'complete' as const,
};
const direct: NavigationDirectReference = {
  status: 'supported',
  kind: 'direct-reference',
  departureEpochMs: 1_715_000_000_000,
  arrivalEpochMs: 1_715_000_000_001,
  target: { kind: 'market', id: 'destination' },
  departurePositionKm: { x: 0, y: 0, z: 0 },
  destinationPositionKm: { x: 1, y: 0, z: 0 },
  distanceKm: 20,
  durationMs: 1,
  fuelUnits: 1,
  eligible: true,
  eligibilityReason: 'WITHIN_PHASE3_BOUNDS',
  navigationMode: 'bounded-preview-100au',
  flightAuthorized: false,
  driveEligibility: { status: 'not-applicable', reason: 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE', flightAuthorized: false },
  hazardAssessment: assessment,
};
function route(jobId: string, distance: number, bodies: string[], eligible = true): NavigationRouteSuccess {
  return {
    success: true,
    jobId,
    prefixBodyIds: bodies,
    prefixSides: bodies.map(() => 1),
    sideHistory: [],
    target: { kind: 'market', id: 'destination' },
    eligible,
    eligibilityReason: 'WITHIN_PHASE3_BOUNDS',
    navigationMode: 'bounded-preview-100au',
    flightAuthorized: false,
    driveEligibility: {
      status: 'not-applicable',
      reason: 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE',
      flightAuthorized: false,
    },
    legs: [],
    totalDistanceKm: distance,
    totalDurationMs: distance,
    fuelUnits: distance,
    hazardAssessment: assessment,
  };
}

describe('selectNavigationRoutes', () => {
  it('includes the shortest examined and diverse longer routes within five choices', () => {
    const choices = selectNavigationRoutes(direct, [
      route('a', 10, ['earth']),
      route('b', 11, ['earth']),
      route('c', 12, ['earth']),
      route('d', 30, ['mars']),
      route('e', 40, ['venus']),
    ]);
    expect(choices.map((choice) => (choice.kind === 'direct' ? 'direct' : choice.route.jobId))).toEqual([
      'direct',
      'a',
      'b',
      'd',
      'e',
    ]);
    expect(choices[1].reasons).toContain('shortest-examined');
    expect(choices[3].reasons).toContain('different-flyby');
  });

  it('labels an eligible shortest direct route without duplicating it or selecting ineligible routes', () => {
    const choices = selectNavigationRoutes(direct, [
      route('invalid', 2, ['earth'], false),
      route('other', 30, ['mars']),
    ]);
    expect(choices).toHaveLength(2);
    expect(choices[0].reasons).toEqual(['direct', 'shortest-examined']);
  });
});
