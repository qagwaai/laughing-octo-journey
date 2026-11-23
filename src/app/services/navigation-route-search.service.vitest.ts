import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  NavigationDirectReference,
  NavigationRouteBatchResponse,
  NavigationRouteCapture,
  NavigationRouteFailure,
  NavigationRouteJob,
  NavigationRouteSuccess,
} from '../model/navigation-route-search';
import type { NavigationPreviewSelection } from './viewer-navigation-preview.service';
import { NavigationRouteSearchService } from './navigation-route-search.service';
import { SocketService } from './socket.service';

const selection: NavigationPreviewSelection = {
  playerName: 'pilot',
  sessionKey: 'session',
  characterId: 'character',
  solarSystemId: 'sol',
  shipId: 'ship',
  shipName: 'Ship',
  shipEpochMs: 1,
  shipPositionKm: { x: 0, y: 0, z: 0 },
  destinationMarketId: 'market',
  destinationName: 'Market',
};
const assessment = {
  level: 'clear-within-survey' as const,
  markers: [],
  unresolvedBodyIds: [],
  unresolvedAssessments: [],
  surveyStatus: 'complete' as const,
};
const capture: NavigationRouteCapture = {
  bootstrapId: 'bootstrap',
  planningRevision: 'a'.repeat(64),
  shipId: 'ship',
  shipRevision: 'c'.repeat(64),
  destinationMarketId: 'market',
  candidateBodyIds: ['earth'],
  departureEpochMs: 1000,
  departurePositionKm: { x: 0, y: 0, z: 0 },
  coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
  positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
  sourceRevision: 'b'.repeat(64),
  clockGeneration: 1,
  clockLineage: 'clock',
  clockEpochMs: 1000,
  profileId: 'stellar-sol-station-100au-v1',
  profileVersion: 'v1',
  navigationMode: 'bounded-preview-100au',
  driveProfile: null,
  driveProfileRevision: null,
  flightAuthorized: false,
};
const previewDrive = { status: 'not-applicable' as const, reason: 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE' as const, flightAuthorized: false as const };
const normalCapture: NavigationRouteCapture = {
  ...capture,
  navigationMode: 'ship-drive-normal',
  driveProfile: { id: 'drive', name: 'Drive', rangeAu: 1, cruiseSpeedAuPerHour: 1, fuelCostPerAu: 1 },
  driveProfileRevision: 'd'.repeat(64),
};
const normalDrive = { status: 'eligible' as const, reason: 'WITHIN_SHIP_LEG_RANGE' as const, flightAuthorized: false as const };
const bounds = { profileId: capture.profileId, maxEligiblePathKm: 14_959_787_070, maxLegDistanceKm: null };
const direct: NavigationDirectReference = {
  status: 'supported',
  target: { kind: 'market', id: 'market' },
  departurePositionKm: { x: 0, y: 0, z: 0 },
  destinationPositionKm: { x: 5, y: 0, z: 0 },
  distanceKm: 5,
  durationMs: 10,
  fuelUnits: 1,
  eligible: true,
  eligibilityReason: 'WITHIN_PHASE3_BOUNDS',
  navigationMode: 'bounded-preview-100au',
  flightAuthorized: false,
  driveEligibility: previewDrive,
  hazardAssessment: assessment,
};

interface SentRequest {
  correlationId: string;
  profileId: string;
  navigationMode: string;
  phase: string;
  bootstrapId?: string;
  planningRevision?: string;
  jobs: NavigationRouteJob[];
}

function setup(responseCapture: NavigationRouteCapture = capture) {
  let handler: ((response: NavigationRouteBatchResponse) => void) | null = null;
  const requests: SentRequest[] = [];
  const socket = {
    on: vi.fn((_event: string, callback: (response: NavigationRouteBatchResponse) => void) => {
      handler = callback;
      return () => { handler = null; };
    }),
    emit: vi.fn((_event: string, request: SentRequest) => requests.push(request)),
  };
  TestBed.configureTestingModule({ providers: [{ provide: SocketService, useValue: socket }] });
  const service = TestBed.inject(NavigationRouteSearchService);
  const reply = (jobs: (NavigationRouteSuccess | NavigationRouteFailure)[], mode: 'complete' | 'timeout' = 'complete') => {
    const request = requests[requests.length - 1];
    handler?.({
      success: true,
      message: 'ok',
      correlationId: request.correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: mode === 'complete' && jobs.every((job) => job.success) ? 'supported' : 'incomplete',
        capture: responseCapture,
        bounds,
        directReference: direct,
        jobs,
        completion: { mode, completedJobCount: jobs.length, failedJobCount: 0 },
      },
    });
  };
  const respond = (response: NavigationRouteBatchResponse) => handler?.(response);
  return { service, requests, reply, respond, getHandler: () => handler };
}

function result(job: NavigationRouteJob): NavigationRouteSuccess {
  const bodyIds = job.target.kind === 'body' ? [...job.prefixBodyIds, job.target.id] : job.prefixBodyIds;
  const sides = job.target.kind === 'body' ? [...job.prefixSides, job.targetSide!] : job.prefixSides;
  const ids = ['ship', ...bodyIds, ...(job.target.kind === 'market' ? [job.target.id] : [])];
  return {
    success: true,
    jobId: job.jobId,
    prefixBodyIds: job.prefixBodyIds,
    prefixSides: job.prefixSides,
    sideHistory: bodyIds.map((bodyId, index) => ({ encounterIndex: index + 1, bodyId, side: sides[index] })),
    target: job.target,
    ...(job.target.kind === 'body' ? { targetSide: job.targetSide } : {}),
    eligible: true,
    eligibilityReason: 'WITHIN_PHASE3_BOUNDS',
    navigationMode: 'bounded-preview-100au',
    flightAuthorized: false,
    driveEligibility: previewDrive,
    legs: Array.from({ length: job.prefixBodyIds.length + 1 }, (_, index) => ({
      legIndex: index + 1,
      fromBodyOrShipId: ids[index],
      toBodyOrMarketId: ids[index + 1],
      startPositionKm: { x: index, y: 0, z: 0 },
      endPositionKm: { x: index + 1, y: 0, z: 0 },
      departureEpochMs: 1000 + index,
      arrivalEpochMs: 1001 + index,
      distanceKm: 1,
      durationMs: 1,
      fuelUnits: 1,
      withinHopLimit: true,
    })),
    totalDistanceKm: 2,
    totalDurationMs: 2,
    fuelUnits: 2,
    hazardAssessment: assessment,
  };
}

function normalResult(job: NavigationRouteJob, distances: number[], range = 149_597_870.7): NavigationRouteSuccess {
  const route = result(job);
  const exceeds = distances.some((distance) => distance > range);
  return {
    ...route,
    navigationMode: 'ship-drive-normal',
    driveEligibility: exceeds
      ? { status: 'ineligible', reason: 'OUTSIDE_SHIP_LEG_RANGE', flightAuthorized: false }
      : normalDrive,
    eligible: !exceeds,
    eligibilityReason: exceeds ? 'OUTSIDE_SHIP_LEG_RANGE' : 'WITHIN_PHASE3_BOUNDS',
    totalDistanceKm: distances.reduce((sum, distance) => sum + distance, 0),
    legs: route.legs.map((leg, index) => ({
      ...leg, distanceKm: distances[index], withinShipLegRange: distances[index] <= range, shipLegRangeKm: range,
    })),
  };
}

describe('NavigationRouteSearchService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('pins continuation batches and evaluates both sides into complete route choices', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    expect(requests[0].profileId).toBe('stellar-sol-station-100au-v1');
    reply([result(requests[0].jobs[0])]);
    expect(requests[1].phase).toBe('continuation');
    expect(requests[1].profileId).toBe('stellar-sol-station-100au-v1');
    expect(requests[1].bootstrapId).toBe(capture.bootstrapId);
    expect(requests[1].planningRevision).toBe(capture.planningRevision);
    expect(requests[1].jobs.map((job) => job.targetSide)).toEqual([-1, 1]);
    reply(requests[1].jobs.map(result));
    expect(requests[2].jobs.map((job) => job.prefixSides)).toEqual([[-1], [1]]);
    reply(requests[2].jobs.map(result));
    const state = service.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') throw new Error('Expected completed search');
    expect(state.incomplete).toBe(false);
    expect(state.choices).toHaveLength(3);
  });

  it.each([
    { distance: 149_597_870.7, eligible: true },
    { distance: 149_597_870.71, eligible: false },
  ])('uses the ship range for each exact leg at $distance km', ({ distance, eligible }) => {
    const { service, requests, respond } = setup(normalCapture);
    service.start(selection, 'ship-drive-normal');
    const job = requests[0].jobs[0];
    respond({
      success: true, message: 'ok', correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'incomplete', capture: normalCapture, bounds,
        directReference: {
          ...direct, distanceKm: distance, navigationMode: 'ship-drive-normal',
          eligible, eligibilityReason: eligible ? 'WITHIN_PHASE3_BOUNDS' : 'OUTSIDE_SHIP_LEG_RANGE',
          driveEligibility: eligible ? normalDrive : { status: 'ineligible', reason: 'OUTSIDE_SHIP_LEG_RANGE', flightAuthorized: false },
        },
        jobs: [normalResult(job, [distance])],
        completion: { mode: 'timeout', completedJobCount: 1, failedJobCount: 0 },
      },
    });
    const state = service.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready' || state.choices[0].kind !== 'direct') throw new Error('Expected direct reference');
    expect(state.choices[0].direct.eligible).toBe(eligible);
  });

  it('accepts multiple legs within range without imposing a total drive range', () => {
    const tenAuCapture = { ...normalCapture, driveProfile: { ...normalCapture.driveProfile!, rangeAu: 10 } };
    const range = 1_495_978_707;
    const { service, requests, respond } = setup(tenAuCapture);
    service.start(selection, 'ship-drive-normal');
    const normalDirect = { ...direct, navigationMode: 'ship-drive-normal' as const, driveEligibility: normalDrive };
    const send = (jobs: NavigationRouteSuccess[]) => respond({
      success: true, message: 'ok', correlationId: requests[requests.length - 1].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: { status: 'supported', capture: tenAuCapture, bounds, directReference: normalDirect, jobs,
        completion: { mode: 'complete', completedJobCount: jobs.length, failedJobCount: 0 } },
    });
    send([normalResult(requests[0].jobs[0], [1], range)]);
    send(requests[1].jobs.map((job) => normalResult(job, [range], range)));
    send(requests[2].jobs.map((job) => normalResult(job, [range, range], range)));
    expect(service.state()).toMatchObject({ status: 'ready', choices: [{ kind: 'direct' }, { kind: 'route' }, { kind: 'route' }] });
  });

  it('does not expand a body edge outside the ship range', () => {
    const { service, requests, respond } = setup(normalCapture);
    service.start(selection, 'ship-drive-normal');
    const send = (jobs: NavigationRouteSuccess[]) => respond({
      success: true, message: 'ok', correlationId: requests[requests.length - 1].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'supported', capture: normalCapture, bounds,
        directReference: { ...direct, navigationMode: 'ship-drive-normal', driveEligibility: normalDrive },
        jobs, completion: { mode: 'complete', completedJobCount: jobs.length, failedJobCount: 0 },
      },
    });
    send([normalResult(requests[0].jobs[0], [1])]);
    send([
      normalResult(requests[1].jobs[0], [149_597_870.71]),
      normalResult(requests[1].jobs[1], [1]),
    ]);
    expect(requests[2].jobs).toHaveLength(1);
    expect(requests[2].jobs[0].prefixSides).toEqual([1]);
  });

  it.each(['shipRevision', 'driveProfileRevision'] as const)('rejects a continuation with a changed %s', (revision) => {
    const { service, requests, respond } = setup(normalCapture);
    service.start(selection, 'ship-drive-normal');
    const batch = {
      status: 'supported' as const, capture: normalCapture, bounds,
      directReference: { ...direct, navigationMode: 'ship-drive-normal' as const, driveEligibility: normalDrive },
      jobs: [normalResult(requests[0].jobs[0], [1])],
      completion: { mode: 'complete' as const, completedJobCount: 1, failedJobCount: 0 },
    };
    respond({
      success: true, message: 'ok', correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' }, batch,
    });
    respond({
      success: true, message: 'ok', correlationId: requests[1].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: { ...batch, capture: { ...normalCapture, [revision]: 'e'.repeat(64) }, jobs: [] },
    });
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_CAPTURE' });
  });

  it('rejects a job with inconsistent drive eligibility', () => {
    const { service, requests, respond } = setup(normalCapture);
    service.start(selection, 'ship-drive-normal');
    const job = normalResult(requests[0].jobs[0], [149_597_870.71]);
    job.eligible = true;
    respond({
      success: true, message: 'ok', correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'supported', capture: normalCapture, bounds,
        directReference: { ...direct, navigationMode: 'ship-drive-normal', driveEligibility: normalDrive },
        jobs: [job], completion: { mode: 'complete', completedJobCount: 1, failedJobCount: 0 },
      },
    });
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });

  it.each(['drive_profile_unavailable', 'drive_profile_changed'])('surfaces %s explicitly', (reason) => {
    const { service, requests, respond } = setup();
    service.start(selection, 'ship-drive-normal');
    respond({
      success: false, message: reason, correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      failure: { reason, message: reason },
      batch: { status: 'failed', capture: null, directReference: null, jobs: [] },
    });
    expect(service.state()).toMatchObject({ status: 'error', reason });
  });

  it.each(['epoch', 'waypoint', 'body', 'source'] as const)(
    'rejects a timed encounter with a mismatched %s',
    (mismatch) => {
      const { service, requests, reply } = setup();
      service.start(selection, 'bounded-preview-100au');
      reply([result(requests[0].jobs[0])]);
      const job = requests[1].jobs[0];
      const response = result(job);
      response.legs[0].encounter = {
        bodyId: mismatch === 'body' ? 'wrong' : job.target.id,
        side: job.targetSide!,
        encounterEpochMs: mismatch === 'epoch' ? 1002 : 1001,
        bodyCenterPositionKm: { x: 0, y: 0, z: 0 },
        waypointPositionKm: { x: mismatch === 'waypoint' ? 2 : 1, y: 0, z: 0 },
        offsetKm: { x: mismatch === 'waypoint' ? 2 : 1, y: 0, z: 0 },
        coordinateBasisId: capture.coordinateBasisId,
        positionEvaluationModelId: capture.positionEvaluationModelId,
        sourceRevision: mismatch === 'source' ? 'wrong' : capture.sourceRevision,
      };
      reply([response]);
      expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
    },
  );

  it('retains the direct reference and marks a timed-out search incomplete', () => {
    vi.useFakeTimers();
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply([result(requests[0].jobs[0])]);
    vi.advanceTimersByTime(30_000);
    expect(service.state()).toMatchObject({
      status: 'ready',
      incomplete: true,
      choices: [{ kind: 'direct' }],
    });
  });

  it('stops at the search job limit and preserves the direct reference as incomplete', () => {
    const manyCandidates = { ...capture, candidateBodyIds: Array.from({ length: 10 }, (_, index) => `body-${index}`) };
    const { service, requests, reply } = setup(manyCandidates);
    service.start(selection, 'bounded-preview-100au');
    while (service.state().status === 'searching') {
      const request = requests[requests.length - 1];
      reply(request.jobs.map(result));
    }
    expect(requests.reduce((total, request) => total + request.jobs.length, 0)).toBe(512);
    expect(requests.every((request) => request.jobs.length <= 32)).toBe(true);
    const state = service.state();
    expect(state).toMatchObject({ status: 'ready', incomplete: true });
    if (state.status !== 'ready') throw new Error('Expected budget-limited search');
    expect(state.choices[0].kind).toBe('direct');
  });

  it('surfaces source changes instead of mixing results from different captures', () => {
    const { service, requests, reply, respond } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply([result(requests[0].jobs[0])]);
    respond({
      success: false,
      message: 'Sources changed',
      correlationId: requests[1].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      failure: { reason: 'source_changed', message: 'Sources changed' },
      batch: { status: 'failed', capture: null, directReference: null, jobs: [] },
    });
    expect(service.state()).toEqual({ status: 'error', reason: 'source_changed', message: 'Sources changed' });
  });

  it('reports an invalid direct reference separately from a capture mismatch', () => {
    const { service, requests, respond } = setup();
    service.start(selection, 'bounded-preview-100au');
    const invalidDirect = { ...direct };
    Reflect.deleteProperty(invalidDirect, 'status');
    respond({
      success: true,
      message: 'ok',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'supported',
        capture,
        bounds,
        directReference: invalidDirect,
        jobs: [result(requests[0].jobs[0])],
        completion: { mode: 'complete', completedJobCount: 1, failedJobCount: 0 },
      },
    });
    expect(service.state()).toEqual({
      status: 'error',
      reason: 'INVALID_RESPONSE',
      message: 'Navigation response contained an invalid direct reference.',
    });
  });

  it.each([
    { distanceKm: 14_959_787_070, eligible: true, reason: 'WITHIN_PHASE3_BOUNDS' as const },
    { distanceKm: 14_959_787_071, eligible: false, reason: 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT' as const },
  ])('retains the direct reference at distance $distanceKm', ({ distanceKm, eligible, reason }) => {
    const { service, requests, respond } = setup();
    service.start(selection, 'bounded-preview-100au');
    respond({
      success: true,
      message: 'ok',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'incomplete',
        capture,
        bounds,
        directReference: { ...direct, distanceKm, eligible, eligibilityReason: reason },
        jobs: [result(requests[0].jobs[0])],
        completion: { mode: 'timeout', completedJobCount: 1, failedJobCount: 0 },
      },
    });

    const state = service.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready' || state.choices[0].kind !== 'direct') throw new Error('Expected direct reference');
    expect(state.choices[0].direct.eligible).toBe(eligible);
  });

  it('ignores a late response from the previous mode after replanning', () => {
    const { service, requests, getHandler } = setup();
    service.start(selection, 'bounded-preview-100au');
    const oldHandler = getHandler();
    const oldRequest = requests[0];
    service.start(selection, 'ship-drive-normal');
    oldHandler?.({
      success: true,
      message: 'ok',
      correlationId: oldRequest.correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: { status: 'supported', capture, bounds, directReference: direct, jobs: [result(oldRequest.jobs[0])] },
    });
    expect(requests).toHaveLength(2);
    expect(requests[1].profileId).toBe('stellar-sol-station-100au-v1');
    expect(requests[1].navigationMode).toBe('ship-drive-normal');
    expect(service.state()).toMatchObject({ status: 'searching', completed: 0 });
  });

  it('rejects a response captured under the legacy profile', () => {
    const { service, requests, respond } = setup();
    service.start(selection, 'bounded-preview-100au');
    respond({
      success: true,
      message: 'ok',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'supported',
        capture: { ...capture, profileId: 'navigation-phase3-legacy-v1' },
        bounds,
        directReference: direct,
        jobs: [result(requests[0].jobs[0])],
      },
    });
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_CAPTURE' });
  });

  it('continues past rejected encounters and discloses their reason', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply([result(requests[0].jobs[0])]);
    reply([
      { success: false, jobId: requests[1].jobs[0].jobId, reason: 'ENCOUNTER_UNAVAILABLE', message: 'No waypoint' },
      result(requests[1].jobs[1]),
    ]);
    expect(requests[2].jobs).toHaveLength(1);
    reply(requests[2].jobs.map(result));
    expect(service.state()).toMatchObject({
      status: 'ready',
      incomplete: false,
      rejected: 1,
      rejections: ['ENCOUNTER_UNAVAILABLE: No waypoint'],
    });
  });

  it('rejects a body edge with a mismatched target side', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply([result(requests[0].jobs[0])]);
    const results = requests[1].jobs.map(result);
    results[0].targetSide = 1;
    reply(results);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });

  it('rejects a response with disconnected legs rather than showing a partial route', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply([result(requests[0].jobs[0])]);
    reply(requests[1].jobs.map(result));
    const jobs = requests[2].jobs.map(result);
    jobs[0].legs[1].startPositionKm = { x: 99, y: 0, z: 0 };
    reply(jobs);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });
});
