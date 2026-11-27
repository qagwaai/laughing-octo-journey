import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  NavigationDirectReference,
  NavigationRouteBatchFailureResponse,
  NavigationRouteBatchResponse,
  NavigationRouteBatchSuccessResponse,
  NavigationRouteBatchUnavailableResponse,
  NavigationRouteBounds,
  NavigationRouteCapture,
  NavigationRouteCompletion,
  NavigationRouteFailure,
  NavigationRouteJob,
  NavigationRouteSuccess,
} from '../model/navigation-route-search';
import { NavigationRouteSearchService } from './navigation-route-search.service';
import { SocketService } from './socket.service';
import type { NavigationPreviewSelection } from './viewer-navigation-preview.service';

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
const epoch = 1_715_000_000_000;
const speed = 12466.489225;
const au = 149_597_870.7;
const capture: NavigationRouteCapture = {
  bootstrapId: 'bootstrap',
  planningRevision: 'a'.repeat(64),
  shipId: 'ship',
  shipRevision: 'c'.repeat(64),
  destinationMarketId: 'market',
  candidateBodyIds: ['earth'],
  shipPositionEpochMs: epoch - 86_400_000,
  departurePositionKm: { x: 0, y: 0, z: 0 },
  coordinateBasisId: 'stellar:sol:catalog-cartesian:v1',
  positionEvaluationModelId: 'sol-catalog-kepler-position-v1',
  sourceRevision: 'b'.repeat(64),
  clockGeneration: 1,
  clockLineage: 'clock',
  searchStartEpochMs: epoch,
  profileId: 'stellar-sol-station-100au-v1',
  profileVersion: 'v1',
  navigationMode: 'bounded-preview-100au',
  driveProfile: null,
  driveProfileRevision: null,
  flightAuthorized: false,
};
const previewDrive = {
  status: 'not-applicable' as const,
  reason: 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE' as const,
  flightAuthorized: false as const,
};
const normalCapture: NavigationRouteCapture = {
  ...capture,
  navigationMode: 'ship-drive-normal',
  driveProfile: { id: 'drive', name: 'Drive', rangeAu: 1, cruiseSpeedAuPerHour: 1, fuelCostPerAu: 1 },
  driveProfileRevision: 'd'.repeat(64),
};
const normalDrive = {
  status: 'eligible' as const,
  reason: 'WITHIN_SHIP_LEG_RANGE' as const,
  flightAuthorized: false as const,
};
const bounds: NavigationRouteBounds = {
  profileId: capture.profileId,
  maxEligiblePathKm: 14_959_787_070,
  maxLegDistanceKm: null,
  candidateDiscovery: 'automatic',
  candidateBodyCount: 1,
  maxEncounters: 5,
  maxLegs: 6,
  fuelUnitsPerAu: 1,
  cruiseSpeedKmPerSec: 12466.489225,
  maxJobs: 32,
  maxLogicalLegs: 192,
  maxTimeoutMs: 30000,
};
const direct: NavigationDirectReference = {
  status: 'supported',
  kind: 'direct-reference',
  target: { kind: 'market', id: 'market' },
  departureEpochMs: epoch,
  arrivalEpochMs: epoch,
  departurePositionKm: { x: 0, y: 0, z: 0 },
  destinationPositionKm: { x: 1, y: 0, z: 0 },
  distanceKm: 1,
  durationMs: 0,
  fuelUnits: 1 / au,
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

type FixtureResponse =
  | (Omit<NavigationRouteBatchSuccessResponse, 'batch'> & {
      batch: Partial<Omit<NavigationRouteBatchSuccessResponse['batch'], 'completion'>> &
        Pick<NavigationRouteBatchSuccessResponse['batch'], 'status' | 'capture' | 'directReference' | 'jobs'> & {
          completion?: Partial<NavigationRouteCompletion> &
            Pick<NavigationRouteCompletion, 'mode' | 'completedJobCount' | 'failedJobCount'>;
        };
    })
  | (Omit<NavigationRouteBatchFailureResponse, 'batch'> & {
      batch: Partial<NavigationRouteBatchFailureResponse['batch']> &
        Pick<NavigationRouteBatchFailureResponse['batch'], 'status' | 'capture' | 'directReference' | 'jobs'>;
    });

function setup(responseCapture: NavigationRouteCapture = capture) {
  let handler: ((response: NavigationRouteBatchResponse) => void) | null = null;
  const requests: SentRequest[] = [];
  const socket = {
    on: vi.fn((_event: string, callback: (response: NavigationRouteBatchResponse) => void) => {
      handler = callback;
      return () => {
        handler = null;
      };
    }),
    emit: vi.fn((_event: string, request: SentRequest) => requests.push(request)),
  };
  TestBed.configureTestingModule({ providers: [{ provide: SocketService, useValue: socket }] });
  const service = TestBed.inject(NavigationRouteSearchService);
  const respond = (response: FixtureResponse, callback = handler) => {
    if (response.success === false) {
      callback?.({
        ...response,
        batch: {
          clock: null,
          bounds: null,
          hazardSurvey: null,
          numericPrecision: null,
          completion: null,
          ...response.batch,
        },
      });
      return;
    }
    const jobs = response.batch.jobs;
    callback?.({
      ...response,
      batch: {
        clock: {
          status: 'supported',
          epochMs: response.batch.capture.searchStartEpochMs,
          timeScaleId: 'stellar:unix-ms-uniform:v1',
          running: true,
          generation: response.batch.capture.clockGeneration,
          lineage: response.batch.capture.clockLineage,
          durability: 'durable-mongo-game-state',
        },
        bounds,
        hazardSurvey: {
          surveyId: 'sol-hazard-survey-v1',
          status: 'complete',
          approximation: 'coarse-spherical-moving-body-warning-envelope',
          inventoryBodyIds: [],
          profiles: [],
        },
        numericPrecision: {
          epochUnit: 'uniform-game-millisecond',
          positionUnit: 'kilometre',
          distanceUnit: 'kilometre',
          durationUnit: 'game-millisecond',
          fuelUnit: 'prototype-fuel-unit-per-AU',
          distanceRounding: 'IEEE-754-binary64-full-precision-response',
          epochRounding: 'Math.round-nearest-millisecond',
          finiteValueRequirement: 'all-output-numbers-must-be-finite',
        },
        ...response.batch,
        completion: {
          mode: 'complete',
          submittedJobCount: requests[requests.length - 1].jobs.length,
          completedJobCount: jobs.filter((job) => job.success).length,
          failedJobCount: jobs.filter((job) => !job.success).length,
          logicalLegCount: jobs.reduce((sum, job) => sum + job.prefixBodyIds.length + 1, 0),
          ...response.batch.completion,
        },
      },
    });
  };
  const reply = (
    jobs: (NavigationRouteSuccess | NavigationRouteFailure)[],
    mode: 'complete' | 'timeout' = 'complete',
    overrides: Partial<NavigationRouteBatchSuccessResponse['batch']> = {},
  ) => {
    const request = requests[requests.length - 1];
    respond({
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
        completion: {
          mode,
          completedJobCount: jobs.filter((job) => job.success).length,
          failedJobCount: jobs.filter((job) => !job.success).length,
          submittedJobCount: request.jobs.length,
          logicalLegCount: jobs.reduce((sum, job) => sum + job.prefixBodyIds.length + 1, 0),
        },
        ...overrides,
      },
    });
  };
  return { service, requests, reply, respond, getHandler: () => handler };
}

function result(job: NavigationRouteJob): NavigationRouteSuccess {
  const bodyIds = job.target.kind === 'body' ? [...job.prefixBodyIds, job.target.id] : job.prefixBodyIds;
  const sides = job.target.kind === 'body' ? [...job.prefixSides, job.targetSide!] : job.prefixSides;
  const ids = ['ship', ...bodyIds, ...(job.target.kind === 'market' ? [job.target.id] : [])];
  const legs = Array.from({ length: job.prefixBodyIds.length + 1 }, (_, index) => ({
    legIndex: index + 1,
    fromBodyOrShipId: ids[index],
    toBodyOrMarketId: ids[index + 1],
    startPositionKm: { x: index, y: 0, z: 0 },
    endPositionKm: { x: index + 1, y: 0, z: 0 },
    departureEpochMs: epoch,
    arrivalEpochMs: epoch,
    distanceKm: 1,
    durationMs: 0,
    fuelUnits: 1 / au,
    withinHopLimit: true,
  }));
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
    legs,
    totalDistanceKm: legs.length,
    totalDurationMs: 0,
    fuelUnits: legs.length / au,
    hazardAssessment: assessment,
  };
}

function normalResult(job: NavigationRouteJob, distances: number[], range = 149_597_870.7): NavigationRouteSuccess {
  const route = result(job);
  const exceeds = distances.some((distance) => distance > range);
  let position = 0;
  let departure = epoch;
  const legs = route.legs.map((leg, index) => {
    const distance = distances[index];
    const duration = Math.round((1000 * distance) / speed);
    const next = {
      ...leg,
      startPositionKm: { x: position, y: 0, z: 0 },
      endPositionKm: { x: position + distance, y: 0, z: 0 },
      departureEpochMs: departure,
      arrivalEpochMs: departure + duration,
      durationMs: duration,
      distanceKm: distance,
      fuelUnits: distance / au,
      withinShipLegRange: distance <= range,
      shipLegRangeKm: range,
    };
    position += distance;
    departure += duration;
    return next;
  });
  return {
    ...route,
    navigationMode: 'ship-drive-normal',
    driveEligibility: exceeds
      ? { status: 'ineligible', reason: 'OUTSIDE_SHIP_LEG_RANGE', flightAuthorized: false }
      : normalDrive,
    eligible: !exceeds,
    eligibilityReason: exceeds ? 'OUTSIDE_SHIP_LEG_RANGE' : 'WITHIN_PHASE3_BOUNDS',
    totalDistanceKm: distances.reduce((sum, distance) => sum + distance, 0),
    totalDurationMs: legs.reduce((sum, leg) => sum + leg.durationMs, 0),
    fuelUnits: legs.reduce((sum, leg) => sum + leg.fuelUnits, 0),
    legs,
  };
}

function directAtDistance(distanceKm: number): NavigationDirectReference {
  const durationMs = Math.round((1000 * distanceKm) / speed);
  return {
    ...direct,
    distanceKm,
    durationMs,
    arrivalEpochMs: epoch + durationMs,
    destinationPositionKm: { x: distanceKm, y: 0, z: 0 },
    fuelUnits: distanceKm / au,
  };
}

describe('NavigationRouteSearchService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it.each([true, false])('surfaces correlated unavailability with identity present=%s', (withIdentity) => {
    vi.useFakeTimers();
    const { service, requests, getHandler } = setup();
    service.start(selection, 'bounded-preview-100au');
    const callback = getHandler();
    const response: NavigationRouteBatchUnavailableResponse = {
      success: false,
      message: 'Game unavailable',
      availability: 'unavailable',
      reason: 'startup_not_verified',
      correlationId: requests[0].correlationId,
      ...(withIdentity ? {
        requestIdentity: {
          operation: 'navigation-route-edge-batch',
          entityType: 'solar-system',
          containerId: 'sol',
        } as const,
      } : {}),
    };
    callback?.(response);
    expect(service.state()).toEqual({
      status: 'error', reason: 'startup_not_verified', message: 'Game unavailable',
    });
    expect(getHandler()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    callback?.(response);
    vi.advanceTimersByTime(60_000);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'startup_not_verified' });
    expect(requests).toHaveLength(1);
  });

  it('leaves uncorrelated notices pending until the existing timeout and ignores late replies', () => {
    vi.useFakeTimers();
    const { service, requests, getHandler } = setup();
    service.start(selection, 'bounded-preview-100au');
    const callback = getHandler();
    const notice: NavigationRouteBatchUnavailableResponse = {
      success: false, message: 'Game unavailable', availability: 'unavailable', reason: 'startup_not_verified',
    };
    callback?.(notice);
    callback?.({ ...notice, correlationId: 'another-search' });
    expect(service.state().status).toBe('searching');
    expect(getHandler()).toBe(callback);
    vi.advanceTimersByTime(30_000);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'DIRECT_REFERENCE_UNAVAILABLE' });
    callback?.({ ...notice, correlationId: requests[0].correlationId });
    expect(service.state()).toMatchObject({ status: 'error', reason: 'DIRECT_REFERENCE_UNAVAILABLE' });
  });

  it('ignores unavailable replies from a replaced search', () => {
    const { service, requests, getHandler } = setup();
    service.start(selection, 'bounded-preview-100au');
    const oldCallback = getHandler();
    service.start({ ...selection, destinationMarketId: 'other-market' }, 'bounded-preview-100au');
    oldCallback?.({
      success: false, message: 'Game unavailable', availability: 'unavailable', reason: 'startup_not_verified',
      correlationId: requests[0].correlationId,
    });
    expect(service.state().status).toBe('searching');
    expect(getHandler()).not.toBeNull();
    service.clear();
  });

  it.each(['reason', 'identity', 'extra-domain-data'] as const)('rejects malformed unavailable %s', (defect) => {
    const { service, requests, getHandler } = setup();
    service.start(selection, 'bounded-preview-100au');
    const response: NavigationRouteBatchUnavailableResponse = {
      success: false, message: 'Game unavailable', availability: 'unavailable', reason: 'startup_not_verified',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
    };
    if (defect === 'reason') Reflect.set(response, 'reason', 'ready');
    if (defect === 'identity') Reflect.set(response.requestIdentity!, 'containerId', 'other');
    if (defect === 'extra-domain-data') Reflect.set(response, 'batch', {});
    getHandler()?.(response);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
    expect(requests).toHaveLength(1);
  });

  it('discards partial search results when a continuation reports unavailable', () => {
    const { service, requests, reply, getHandler } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply([result(requests[0].jobs[0])]);
    getHandler()?.({
      success: false, message: 'Game unavailable', availability: 'unavailable', reason: 'startup_not_verified',
      correlationId: requests[1].correlationId,
    });
    expect(service.state()).toEqual({
      status: 'error', reason: 'startup_not_verified', message: 'Game unavailable',
    });
    expect(requests).toHaveLength(2);
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
    respond({
      success: true,
      message: 'ok',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'incomplete',
        capture: normalCapture,
        bounds,
        directReference: {
          ...directAtDistance(distance),
          navigationMode: 'ship-drive-normal',
          eligible,
          eligibilityReason: eligible ? 'WITHIN_PHASE3_BOUNDS' : 'OUTSIDE_SHIP_LEG_RANGE',
          driveEligibility: eligible
            ? normalDrive
            : { status: 'ineligible', reason: 'OUTSIDE_SHIP_LEG_RANGE', flightAuthorized: false },
        },
        jobs: [],
        completion: { mode: 'timeout', completedJobCount: 0, failedJobCount: 0 },
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
    const send = (jobs: NavigationRouteSuccess[]) =>
      respond({
        success: true,
        message: 'ok',
        correlationId: requests[requests.length - 1].correlationId,
        requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
        batch: {
          status: 'supported',
          capture: tenAuCapture,
          bounds,
          directReference: normalDirect,
          jobs,
          completion: { mode: 'complete', completedJobCount: jobs.length, failedJobCount: 0 },
        },
      });
    send([normalResult(requests[0].jobs[0], [1], range)]);
    send(requests[1].jobs.map((job) => normalResult(job, [range], range)));
    send(requests[2].jobs.map((job) => normalResult(job, [range, range], range)));
    expect(service.state()).toMatchObject({
      status: 'ready',
      choices: [{ kind: 'direct' }, { kind: 'route' }, { kind: 'route' }],
    });
  });

  it('does not expand a body edge outside the ship range', () => {
    const { service, requests, respond } = setup(normalCapture);
    service.start(selection, 'ship-drive-normal');
    const send = (jobs: NavigationRouteSuccess[]) =>
      respond({
        success: true,
        message: 'ok',
        correlationId: requests[requests.length - 1].correlationId,
        requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
        batch: {
          status: 'supported',
          capture: normalCapture,
          bounds,
          directReference: { ...direct, navigationMode: 'ship-drive-normal', driveEligibility: normalDrive },
          jobs,
          completion: { mode: 'complete', completedJobCount: jobs.length, failedJobCount: 0 },
        },
      });
    send([normalResult(requests[0].jobs[0], [1])]);
    send([normalResult(requests[1].jobs[0], [149_597_870.71]), normalResult(requests[1].jobs[1], [1])]);
    expect(requests[2].jobs).toHaveLength(1);
    expect(requests[2].jobs[0].prefixSides).toEqual([1]);
  });

  it.each(['shipRevision', 'driveProfileRevision'] as const)('rejects a continuation with a changed %s', (revision) => {
    const { service, requests, respond } = setup(normalCapture);
    service.start(selection, 'ship-drive-normal');
    const batch = {
      status: 'supported' as const,
      capture: normalCapture,
      bounds,
      directReference: { ...direct, navigationMode: 'ship-drive-normal' as const, driveEligibility: normalDrive },
      jobs: [normalResult(requests[0].jobs[0], [1])],
      completion: { mode: 'complete' as const, completedJobCount: 1, failedJobCount: 0 },
    };
    respond({
      success: true,
      message: 'ok',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch,
    });
    respond({
      success: true,
      message: 'ok',
      correlationId: requests[1].correlationId,
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
      success: true,
      message: 'ok',
      correlationId: requests[0].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: {
        status: 'supported',
        capture: normalCapture,
        bounds,
        directReference: { ...direct, navigationMode: 'ship-drive-normal', driveEligibility: normalDrive },
        jobs: [job],
        completion: { mode: 'complete', completedJobCount: 1, failedJobCount: 0 },
      },
    });
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });

  it.each(['drive_profile_unavailable', 'drive_profile_changed'] as const)('surfaces %s explicitly', (reason) => {
    const { service, requests, respond } = setup();
    service.start(selection, 'ship-drive-normal');
    respond({
      success: false,
      message: reason,
      correlationId: requests[0].correlationId,
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
        encounterEpochMs: mismatch === 'epoch' ? epoch + 1 : epoch,
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
        directReference: { ...directAtDistance(distanceKm), eligible, eligibilityReason: reason },
        jobs: [],
        completion: { mode: 'timeout', completedJobCount: 0, failedJobCount: 0 },
      },
    });

    const state = service.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready' || state.choices[0].kind !== 'direct') throw new Error('Expected direct reference');
    expect(state.choices[0].direct.eligible).toBe(eligible);
  });

  it('ignores a late response from the previous mode after replanning', () => {
    const { service, requests, getHandler, respond } = setup();
    service.start(selection, 'bounded-preview-100au');
    const oldHandler = getHandler();
    const oldRequest = requests[0];
    service.start(selection, 'ship-drive-normal');
    respond(
      {
        success: true,
        message: 'ok',
        correlationId: oldRequest.correlationId,
        requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
        batch: { status: 'supported', capture, bounds, directReference: direct, jobs: [result(oldRequest.jobs[0])] },
      },
      oldHandler,
    );
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
      { ...requests[1].jobs[0], success: false, reason: 'ENCOUNTER_UNAVAILABLE', message: 'No waypoint' },
      result(requests[1].jobs[1]),
    ]);
    expect(requests[2].jobs).toHaveLength(1);
    reply(requests[2].jobs.map(result));
    expect(service.state()).toMatchObject({
      status: 'ready',
      incomplete: true,
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

  it('keeps the captured departure while the response clock advances between batches', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply(requests[0].jobs.map(result));
    reply(requests[1].jobs.map(result), 'complete', {
      clock: {
        status: 'supported',
        epochMs: epoch + 60_000,
        timeScaleId: 'stellar:unix-ms-uniform:v1',
        running: true,
        generation: 1,
        lineage: 'clock',
        durability: 'durable-mongo-game-state',
      },
    });
    reply(requests[2].jobs.map(result));
    const state = service.state();
    expect(state.status).toBe('ready');
    if (state.status !== 'ready' || state.choices[1].kind !== 'route') throw new Error('Expected captured route');
    expect(state.choices[1].route.legs[0].departureEpochMs).toBe(epoch);
    expect(capture.shipPositionEpochMs).toBe(epoch - 86_400_000);
  });

  it.each(['searchStartEpochMs', 'shipPositionEpochMs', 'departurePositionKm', 'candidateBodyIds'] as const)(
    'rejects a changed captured %s on continuation',
    (field) => {
      const { service, requests, reply } = setup();
      service.start(selection, 'bounded-preview-100au');
      reply(requests[0].jobs.map(result));
      const changed = { ...capture };
      Reflect.set(
        changed,
        field,
        field === 'departurePositionKm' ? { x: 2, y: 0, z: 0 } : field === 'candidateBodyIds' ? ['mars'] : epoch + 1,
      );
      reply(requests[1].jobs.map(result), 'complete', { capture: changed });
      expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_CAPTURE' });
    },
  );

  it.each([
    { residual: 1, accepted: true },
    { residual: 1 + 1 / 4096, accepted: false },
  ])('enforces the <=1 ms rounded timing residual at $residual ms', ({ residual, accepted }) => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    const distance = (speed * (2 - residual)) / 1000;
    const reference = {
      ...directAtDistance(distance),
      durationMs: 2,
      arrivalEpochMs: epoch + 2,
    };
    expect(Math.abs(epoch + (1000 * reference.distanceKm) / speed - reference.arrivalEpochMs)).toBe(residual);
    const job = result(requests[0].jobs[0]);
    job.legs[0] = {
      ...job.legs[0],
      endPositionKm: reference.destinationPositionKm,
      arrivalEpochMs: reference.arrivalEpochMs,
      distanceKm: distance,
      durationMs: 2,
      fuelUnits: distance / au,
    };
    job.totalDistanceKm = distance;
    job.totalDurationMs = 2;
    job.fuelUnits = distance / au;
    reply([job], 'complete', { directReference: reference });
    expect(service.state().status).toBe(accepted ? 'searching' : 'error');
  });

  it.each(['endpoint', 'duration', 'fuel'] as const)('rejects inconsistent direct %s geometry', (field) => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    const reference = { ...direct };
    if (field === 'endpoint') reference.destinationPositionKm = { x: 2, y: 0, z: 0 };
    if (field === 'duration') reference.durationMs = 10;
    if (field === 'fuel') reference.fuelUnits = 1;
    reply(requests[0].jobs.map(result), 'complete', { directReference: reference });
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });

  it('rejects a retimed first leg even when its duration and geometry are coherent', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    const job = result(requests[0].jobs[0]);
    job.legs[0].departureEpochMs += 10;
    job.legs[0].arrivalEpochMs += 10;
    reply([job]);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });

  it('reports unfinished requested IDs and retains only complete choices', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply(requests[0].jobs.map(result));
    const bodyRequest = requests[1];
    reply([result(bodyRequest.jobs[0])], 'timeout');
    expect(service.state()).toMatchObject({
      status: 'ready',
      incomplete: true,
      choices: [{ kind: 'direct' }],
      unfinishedJobIds: [bodyRequest.jobs[1].jobId],
    });
    expect(requests).toHaveLength(2);
  });

  it.each(['submittedJobCount', 'completedJobCount', 'failedJobCount', 'logicalLegCount'] as const)(
    'rejects inconsistent completion %s',
    (field) => {
      const { service, requests, reply } = setup();
      service.start(selection, 'bounded-preview-100au');
      const completion: NavigationRouteCompletion = {
        mode: 'complete',
        submittedJobCount: 1,
        completedJobCount: 1,
        failedJobCount: 0,
        logicalLegCount: 1,
      };
      completion[field] += 1;
      reply(requests[0].jobs.map(result), 'complete', { completion });
      expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
    },
  );

  it('rejects a timeout label when every submitted job has a terminal result', () => {
    const { service, requests, reply } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply(requests[0].jobs.map(result), 'timeout');
    expect(service.state()).toMatchObject({ status: 'error', reason: 'INVALID_RESPONSE' });
  });

  it.each([
    'direct_target_unsupported',
    'direct_source_unavailable',
    'direct_numeric_failure',
    'source_changed',
  ] as const)('discards the captured search on %s and waits for manual replan', (reason) => {
    vi.useFakeTimers();
    const { service, requests, reply, respond } = setup();
    service.start(selection, 'bounded-preview-100au');
    reply(requests[0].jobs.map(result));
    respond({
      success: false,
      message: reason,
      failure: { reason, message: reason },
      correlationId: requests[1].correlationId,
      requestIdentity: { operation: 'navigation-route-edge-batch', entityType: 'solar-system', containerId: 'sol' },
      batch: { status: 'failed', capture: null, directReference: null, jobs: [] },
    });
    expect(service.state()).toMatchObject({ status: 'error', reason });
    vi.advanceTimersByTime(60_000);
    expect(requests).toHaveLength(2);
    service.start(selection, 'bounded-preview-100au');
    expect(requests[2].phase).toBe('bootstrap');
    expect(requests[2].bootstrapId).toBeUndefined();
  });

  it('fails explicitly when the client deadline passes before a required direct reference arrives', () => {
    vi.useFakeTimers();
    const { service, requests } = setup();
    service.start(selection, 'bounded-preview-100au');
    vi.advanceTimersByTime(30_000);
    expect(service.state()).toMatchObject({ status: 'error', reason: 'DIRECT_REFERENCE_UNAVAILABLE' });
    expect(requests).toHaveLength(1);
  });
});
