import { Injectable, inject, signal } from '@angular/core';
import type {
  NavigationDirectReference,
  NavigationDriveProfile,
  NavigationRouteBatchResponse,
  NavigationRouteBatchUnavailableResponse,
  NavigationRouteCapture,
  NavigationRouteJob,
  NavigationRouteMode,
  NavigationRouteProfileId,
  NavigationRouteSuccess,
  NavigationSide,
} from '../model/navigation-route-search';
import { NAVIGATION_ROUTE_FAILURE_REASONS } from '../model/navigation-route-search';
import type { NavigationPositionVector } from '../model/solar-system-get';
import { selectNavigationRoutes, type NavigationRouteChoice } from './navigation-route-selection';
import { createUuidCorrelationId } from './socket-correlation';
import { SocketService } from './socket.service';
import type { NavigationPreviewSelection } from './viewer-navigation-preview.service';

const REQUEST_EVENT = 'navigation-route-edge-batch-request';
const RESPONSE_EVENT = 'navigation-route-edge-batch-response';
const PROFILE_BOUNDS: Record<NavigationRouteProfileId, { maxPathKm: number; maxLegKm: number | null }> = {
  'navigation-phase3-legacy-v1': { maxPathKm: 448_793_612.1, maxLegKm: 74_798_935.35 },
  'stellar-sol-station-100au-v1': { maxPathKm: 14_959_787_070, maxLegKm: null },
};
const SPEED = 12466.489225;
const AU_KM = 149_597_870.7;
const ROUTE_PROFILE: NavigationRouteProfileId = 'stellar-sol-station-100au-v1';
const SEARCH_TIMEOUT_MS = 30_000;
const SEARCH_JOB_LIMIT = 512;

function isUnavailableResponse(
  response: NavigationRouteBatchResponse,
): response is NavigationRouteBatchUnavailableResponse {
  if (
    !('availability' in response) ||
    response.availability !== 'unavailable' ||
    response.success !== false ||
    response.message !== 'Game unavailable' ||
    !('reason' in response) ||
    response.reason !== 'startup_not_verified' ||
    Object.keys(response).some(
      (key) => !['success', 'message', 'availability', 'reason', 'correlationId', 'requestIdentity'].includes(key),
    ) ||
    (response.correlationId !== undefined &&
      (typeof response.correlationId !== 'string' || !/\S/.test(response.correlationId)))
  ) {
    return false;
  }

  const identity = response.requestIdentity;
  return (
    identity === undefined ||
    (identity !== null &&
      typeof identity === 'object' &&
      Object.keys(identity).length === 3 &&
      identity.operation === 'navigation-route-edge-batch' &&
      identity.entityType === 'solar-system' &&
      identity.containerId === 'sol')
  );
}

function validEpoch(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 946_684_800_000 && value < 4_102_444_800_000;
}

function validVector(value: NavigationPositionVector): boolean {
  return !!value && [value.x, value.y, value.z].every(Number.isFinite);
}

function samePosition(a: NavigationPositionVector, b: NavigationPositionVector): boolean {
  return validVector(a) && validVector(b) && a.x === b.x && a.y === b.y && a.z === b.z;
}

function nearEqual(a: number, b: number): boolean {
  // Permit floating-point evaluation differences, not a gameplay distance margin.
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Math.abs(a - b) <= 8 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b))
  );
}

function validLegGeometry(
  start: NavigationPositionVector,
  end: NavigationPositionVector,
  departure: number,
  arrival: number,
  distance: number,
  duration: number,
  fuel: number,
): boolean {
  return (
    validVector(start) &&
    validVector(end) &&
    validEpoch(departure) &&
    validEpoch(arrival) &&
    Number.isSafeInteger(duration) &&
    duration >= 0 &&
    arrival - departure === duration &&
    Number.isFinite(distance) &&
    distance >= 0 &&
    nearEqual(distance, Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z)) &&
    Math.abs(departure + (1000 * distance) / SPEED - arrival) <= 1 &&
    fuel >= 0 &&
    nearEqual(fuel, distance / AU_KM)
  );
}

function sameJob(
  result: Pick<NavigationRouteSuccess, 'target' | 'prefixBodyIds' | 'prefixSides'>,
  job: NavigationRouteJob,
): boolean {
  return (
    !!result.target &&
    result.target.kind === job.target.kind &&
    result.target.id === job.target.id &&
    Array.isArray(result.prefixBodyIds) &&
    result.prefixBodyIds.join('\0') === job.prefixBodyIds.join('\0') &&
    Array.isArray(result.prefixSides) &&
    result.prefixSides.join(',') === job.prefixSides.join(',')
  );
}

function validDriveProfile(profile: NavigationDriveProfile | null): boolean {
  return (
    profile === null ||
    (!!profile &&
      typeof profile.id === 'string' &&
      !!profile.id.trim() &&
      typeof profile.name === 'string' &&
      !!profile.name.trim() &&
      [profile.rangeAu, profile.cruiseSpeedAuPerHour, profile.fuelCostPerAu].every(
        (value) => Number.isFinite(value) && value > 0,
      ))
  );
}

function sameDriveProfile(a: NavigationDriveProfile | null, b: NavigationDriveProfile | null): boolean {
  return a === null || b === null
    ? a === b
    : a.id === b.id &&
        a.name === b.name &&
        a.rangeAu === b.rangeAu &&
        a.cruiseSpeedAuPerHour === b.cruiseSpeedAuPerHour &&
        a.fuelCostPerAu === b.fuelCostPerAu;
}

function validDriveEligibility(
  result: Pick<NavigationDirectReference, 'navigationMode' | 'flightAuthorized' | 'driveEligibility'>,
  capture: NavigationRouteCapture,
  distances: number[],
): boolean {
  const drive = result.driveEligibility;
  if (
    result.navigationMode !== capture.navigationMode ||
    result.flightAuthorized !== false ||
    !drive ||
    drive.flightAuthorized !== false
  )
    return false;
  if (capture.navigationMode === 'bounded-preview-100au') {
    return drive.status === 'not-applicable' && drive.reason === 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE';
  }
  if (!capture.driveProfile) return false;
  const rangeAu = capture.driveProfile.rangeAu;
  const rangeKm = rangeAu * AU_KM;
  const exceeding = distances.some((distance) => distance > rangeKm);
  return (
    drive.status === (exceeding ? 'ineligible' : 'eligible') &&
    drive.reason === (exceeding ? 'OUTSIDE_SHIP_LEG_RANGE' : 'WITHIN_SHIP_LEG_RANGE') &&
    (drive.rangeAu === undefined || drive.rangeAu === rangeAu) &&
    (drive.rangeKm === undefined || drive.rangeKm === rangeKm)
  );
}

function validDirect(
  direct: NavigationDirectReference,
  destinationId: string,
  capture: NavigationRouteCapture,
): boolean {
  const bounds = PROFILE_BOUNDS[capture.profileId];
  const exceedsDrive =
    capture.navigationMode === 'ship-drive-normal' &&
    !!capture.driveProfile &&
    direct.distanceKm > capture.driveProfile.rangeAu * AU_KM;
  const eligible =
    !exceedsDrive &&
    direct.distanceKm <= bounds.maxPathKm &&
    (bounds.maxLegKm === null || direct.distanceKm <= bounds.maxLegKm);
  return (
    direct.status === 'supported' &&
    direct.kind === 'direct-reference' &&
    direct.target?.kind === 'market' &&
    direct.target.id === destinationId &&
    direct.departureEpochMs === capture.searchStartEpochMs &&
    samePosition(direct.departurePositionKm, capture.departurePositionKm) &&
    validLegGeometry(
      direct.departurePositionKm,
      direct.destinationPositionKm,
      direct.departureEpochMs,
      direct.arrivalEpochMs,
      direct.distanceKm,
      direct.durationMs,
      direct.fuelUnits,
    ) &&
    direct.eligible === eligible &&
    direct.eligibilityReason ===
      (eligible
        ? 'WITHIN_PHASE3_BOUNDS'
        : exceedsDrive
          ? 'OUTSIDE_SHIP_LEG_RANGE'
          : bounds.maxLegKm === null
            ? 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT'
            : 'DIRECT_REFERENCE_MAY_EXCEED_HOP_LIMIT') &&
    validDriveEligibility(direct, capture, [direct.distanceKm]) &&
    !!direct.hazardAssessment &&
    Array.isArray(direct.hazardAssessment.markers) &&
    Array.isArray(direct.hazardAssessment.unresolvedAssessments)
  );
}

function validJobResult(
  result: NavigationRouteSuccess,
  job: NavigationRouteJob,
  shipId: string,
  capture: NavigationRouteCapture,
): boolean {
  const expectedBodies = job.target.kind === 'body' ? [...job.prefixBodyIds, job.target.id] : job.prefixBodyIds;
  const expectedSides =
    job.target.kind === 'body' && job.targetSide !== undefined ? [...job.prefixSides, job.targetSide] : job.prefixSides;
  if (
    !sameJob(result, job) ||
    (job.target.kind === 'body' ? result.targetSide !== job.targetSide : result.targetSide !== undefined) ||
    !Array.isArray(result.sideHistory) ||
    result.sideHistory.length !== expectedBodies.length ||
    result.sideHistory.some(
      (side, index) =>
        !side ||
        side.encounterIndex !== index + 1 ||
        side.bodyId !== expectedBodies[index] ||
        side.side !== expectedSides[index],
    ) ||
    !Array.isArray(result.legs) ||
    result.legs.length !== job.prefixBodyIds.length + 1 ||
    result.legs.some((leg) => !leg) ||
    !Number.isFinite(result.totalDistanceKm) ||
    result.totalDistanceKm < 0 ||
    !Number.isFinite(result.fuelUnits) ||
    result.fuelUnits < 0 ||
    !Number.isSafeInteger(result.totalDurationMs) ||
    result.totalDurationMs < 0 ||
    !result.hazardAssessment ||
    !Array.isArray(result.hazardAssessment.markers) ||
    !Array.isArray(result.hazardAssessment.unresolvedAssessments)
  )
    return false;

  const bounds = PROFILE_BOUNDS[capture.profileId];
  const exceedsDrive =
    capture.navigationMode === 'ship-drive-normal' &&
    !!capture.driveProfile &&
    result.legs.some((leg) => leg.distanceKm > capture.driveProfile!.rangeAu * AU_KM);
  const exceedsHop = bounds.maxLegKm !== null && result.legs.some((leg) => leg.distanceKm > bounds.maxLegKm!);
  const exceedsPath = result.totalDistanceKm > bounds.maxPathKm;
  const reason = exceedsDrive
    ? 'OUTSIDE_SHIP_LEG_RANGE'
    : exceedsHop
      ? 'OUTSIDE_HOP_OR_PATH_LIMIT'
      : exceedsPath
        ? bounds.maxLegKm === null
          ? 'OUTSIDE_TOTAL_PATH_LIMIT'
          : 'OUTSIDE_HOP_OR_PATH_LIMIT'
        : 'WITHIN_PHASE3_BOUNDS';
  if (
    !nearEqual(
      result.totalDistanceKm,
      result.legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    ) ||
    result.totalDurationMs !== result.legs.reduce((sum, leg) => sum + leg.durationMs, 0) ||
    !nearEqual(
      result.fuelUnits,
      result.legs.reduce((sum, leg) => sum + leg.fuelUnits, 0),
    ) ||
    !validDriveEligibility(
      result,
      capture,
      result.legs.map((leg) => leg.distanceKm),
    ) ||
    result.eligible !== (reason === 'WITHIN_PHASE3_BOUNDS') ||
    result.eligibilityReason !== reason
  )
    return false;

  const ids = [shipId, ...expectedBodies];
  if (job.target.kind === 'market') ids.push(job.target.id);
  return result.legs.every((leg, index) => {
    const previous = result.legs[index - 1];
    const encounter = leg.encounter;
    const encounterValid =
      !encounter ||
      (index < expectedBodies.length &&
        encounter.bodyId === expectedBodies[index] &&
        encounter.side === expectedSides[index] &&
        encounter.encounterEpochMs === leg.arrivalEpochMs &&
        !!capture.coordinateBasisId &&
        !!capture.positionEvaluationModelId &&
        !!capture.sourceRevision &&
        encounter.coordinateBasisId === capture.coordinateBasisId &&
        encounter.positionEvaluationModelId === capture.positionEvaluationModelId &&
        encounter.sourceRevision === capture.sourceRevision &&
        [encounter.bodyCenterPositionKm, encounter.waypointPositionKm, encounter.offsetKm].every(
          (point) => point && [point.x, point.y, point.z].every(Number.isFinite),
        ) &&
        (['x', 'y', 'z'] as const).every(
          (axis) =>
            encounter.waypointPositionKm[axis] === leg.endPositionKm?.[axis] &&
            encounter.offsetKm[axis] === encounter.waypointPositionKm[axis] - encounter.bodyCenterPositionKm[axis],
        ));
    return (
      encounterValid &&
      leg.legIndex === index + 1 &&
      leg.fromBodyOrShipId === ids[index] &&
      leg.toBodyOrMarketId === ids[index + 1] &&
      validLegGeometry(
        leg.startPositionKm,
        leg.endPositionKm,
        leg.departureEpochMs,
        leg.arrivalEpochMs,
        leg.distanceKm,
        leg.durationMs,
        leg.fuelUnits,
      ) &&
      leg.withinHopLimit === (bounds.maxLegKm === null || leg.distanceKm <= bounds.maxLegKm) &&
      (capture.navigationMode === 'ship-drive-normal'
        ? !!capture.driveProfile &&
          leg.shipLegRangeKm === capture.driveProfile.rangeAu * AU_KM &&
          leg.withinShipLegRange === leg.distanceKm <= leg.shipLegRangeKm
        : leg.shipLegRangeKm === undefined && leg.withinShipLegRange === undefined) &&
      (previous
        ? previous.arrivalEpochMs === leg.departureEpochMs && samePosition(previous.endPositionKm, leg.startPositionKm)
        : leg.departureEpochMs === capture.searchStartEpochMs &&
          samePosition(leg.startPositionKm, capture.departurePositionKm))
    );
  });
}

export type NavigationRouteSearchState =
  | { status: 'idle' }
  | { status: 'searching'; completed: number; rejected: number; rejections: string[] }
  | {
      status: 'ready';
      choices: NavigationRouteChoice[];
      selected: number;
      incomplete: boolean;
      completed: number;
      rejected: number;
      rejections: string[];
      unfinishedJobIds: string[];
      directUnavailable: boolean;
    }
  | { status: 'error'; reason: string; message: string };

@Injectable({ providedIn: 'root' })
export class NavigationRouteSearchService {
  private readonly socket = inject(SocketService);
  private sequence = 0;
  private unsubscribe: (() => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  readonly state = signal<NavigationRouteSearchState>({ status: 'idle' });

  clear(): void {
    this.sequence += 1;
    this.stopPending();
    this.state.set({ status: 'idle' });
  }

  select(index: number): void {
    const state = this.state();
    if (state.status === 'ready' && Number.isInteger(index) && index >= 0 && index < state.choices.length) {
      this.state.set({ ...state, selected: index });
    }
  }

  start(selection: NavigationPreviewSelection, navigationMode: NavigationRouteMode): void {
    this.clear();
    const profileId = ROUTE_PROFILE;
    const bounds = PROFILE_BOUNDS[profileId];
    const sequence = this.sequence;
    let capture: NavigationRouteCapture | null = null;
    let direct: NavigationDirectReference | null = null;
    const routes: NavigationRouteSuccess[] = [];
    const queue: NavigationRouteJob[] = [];
    let completed = 0;
    let rejected = 0;
    let dispatched = 0;
    let unresolvedJobs = false;
    let pendingJobIds: string[] = [];
    const rejections = new Set<string>();
    let nextId = 0;
    const market = { kind: 'market' as const, id: selection.destinationMarketId };

    const finish = (incomplete: boolean): void => {
      if (sequence !== this.sequence) return;
      if (!direct) {
        fail(
          'DIRECT_REFERENCE_UNAVAILABLE',
          'Navigation search ended before the required direct reference was received.',
        );
        return;
      }
      this.stopPending();
      this.sequence += 1;
      const choices = selectNavigationRoutes(direct, routes);
      this.state.set({
        status: 'ready',
        choices,
        selected: 0,
        incomplete,
        completed,
        rejected,
        rejections: [...rejections],
        unfinishedJobIds: pendingJobIds,
        directUnavailable: !direct,
      });
    };
    const fail = (reason: string, message: string): void => {
      if (sequence !== this.sequence) return;
      this.stopPending();
      this.sequence += 1;
      this.state.set({ status: 'error', reason, message });
    };
    const enqueueChildren = (bodyIds: string[], sides: NavigationSide[]): void => {
      if (!capture || bodyIds.length >= 5) return;
      for (const bodyId of capture.candidateBodyIds) {
        if (bodyIds.includes(bodyId)) continue;
        for (const side of [-1, 1] as const) {
          queue.push({
            jobId: `edge-${++nextId}`,
            prefixBodyIds: bodyIds,
            prefixSides: sides,
            target: { kind: 'body', id: bodyId },
            targetSide: side,
          });
        }
      }
    };
    const dispatch = (jobs: NavigationRouteJob[]): void => {
      if (sequence !== this.sequence) return;
      dispatched += jobs.length;
      pendingJobIds = jobs.map((job) => job.jobId);
      const correlationId = createUuidCorrelationId();
      const expected = new Map(jobs.map((job) => [job.jobId, job]));
      this.unsubscribe = this.socket.on(RESPONSE_EVENT, (response: NavigationRouteBatchResponse) => {
        if (sequence !== this.sequence || response?.correlationId !== correlationId) return;
        if (isUnavailableResponse(response)) {
          fail(response.reason, response.message);
          return;
        }
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (
          response.requestIdentity?.operation !== 'navigation-route-edge-batch' ||
          response.requestIdentity.entityType !== 'solar-system' ||
          response.requestIdentity.containerId !== 'sol'
        ) {
          fail('INVALID_RESPONSE', 'Navigation response identity did not match the request.');
          return;
        }
        if (response.success === false) {
          const failed = response.batch;
          if (
            !response.failure ||
            !NAVIGATION_ROUTE_FAILURE_REASONS.includes(response.failure.reason) ||
            typeof response.failure.message !== 'string' ||
            !response.failure.message.trim() ||
            failed?.status !== 'failed' ||
            failed.capture !== null ||
            failed.clock !== null ||
            failed.directReference !== null ||
            !Array.isArray(failed.jobs) ||
            failed.jobs.length !== 0 ||
            failed.bounds !== null ||
            failed.hazardSurvey !== null ||
            failed.numericPrecision !== null ||
            failed.completion !== null
          ) {
            fail('INVALID_RESPONSE', 'Navigation response contained an invalid failure.');
            return;
          }
          fail(response.failure.reason, response.failure.message);
          return;
        }
        const batch = response.batch;
        if (
          response.success !== true ||
          !batch?.capture ||
          batch.capture.shipId !== selection.shipId ||
          batch.capture.destinationMarketId !== selection.destinationMarketId ||
          batch.capture.profileId !== profileId ||
          batch.capture.profileVersion !== 'v1' ||
          batch.capture.navigationMode !== navigationMode ||
          batch.capture.flightAuthorized !== false ||
          !/^[a-f0-9]{64}$/.test(batch.capture.shipRevision) ||
          !/^[a-f0-9]{64}$/.test(batch.capture.sourceRevision) ||
          typeof batch.capture.clockLineage !== 'string' ||
          !batch.capture.clockLineage.trim() ||
          batch.capture.coordinateBasisId !== 'stellar:sol:catalog-cartesian:v1' ||
          batch.capture.positionEvaluationModelId !== 'sol-catalog-kepler-position-v1' ||
          !validVector(batch.capture.departurePositionKm) ||
          !validEpoch(batch.capture.shipPositionEpochMs) ||
          !validEpoch(batch.capture.searchStartEpochMs) ||
          !Number.isSafeInteger(batch.capture.clockGeneration) ||
          batch.capture.clockGeneration < 1 ||
          !batch.clock ||
          !['supported', 'paused'].includes(batch.clock.status) ||
          batch.clock.timeScaleId !== 'stellar:unix-ms-uniform:v1' ||
          batch.clock.epochMs === null ||
          !validEpoch(batch.clock.epochMs) ||
          batch.clock.epochMs < batch.capture.searchStartEpochMs ||
          batch.clock.generation !== batch.capture.clockGeneration ||
          batch.clock.lineage !== batch.capture.clockLineage ||
          !validDriveProfile(batch.capture.driveProfile) ||
          (batch.capture.driveProfileRevision !== null && !/^[a-f0-9]{64}$/.test(batch.capture.driveProfileRevision)) ||
          (navigationMode === 'ship-drive-normal' &&
            (!batch.capture.driveProfile ||
              !batch.capture.driveProfileRevision ||
              !Number.isFinite(batch.capture.driveProfile.rangeAu) ||
              batch.capture.driveProfile.rangeAu <= 0)) ||
          batch.bounds?.profileId !== profileId ||
          batch.bounds.maxLegDistanceKm !== bounds.maxLegKm ||
          batch.bounds.maxEligiblePathKm !== bounds.maxPathKm ||
          batch.bounds.fuelUnitsPerAu !== 1 ||
          batch.bounds.cruiseSpeedKmPerSec !== SPEED ||
          batch.bounds.maxEncounters !== 5 ||
          batch.bounds.maxLegs !== 6 ||
          batch.bounds.maxJobs !== 32 ||
          batch.bounds.maxLogicalLegs !== 192 ||
          !Array.isArray(batch.capture.candidateBodyIds) ||
          batch.capture.candidateBodyIds.length > 10 ||
          new Set(batch.capture.candidateBodyIds).size !== batch.capture.candidateBodyIds.length ||
          batch.capture.candidateBodyIds.some((id) => typeof id !== 'string' || !id.trim()) ||
          typeof batch.capture.bootstrapId !== 'string' ||
          !batch.capture.bootstrapId.trim() ||
          !/^[a-f0-9]{64}$/.test(batch.capture.planningRevision) ||
          !Array.isArray(batch.jobs) ||
          !['supported', 'incomplete'].includes(batch.status) ||
          (capture &&
            (batch.capture.bootstrapId !== capture.bootstrapId ||
              batch.capture.planningRevision !== capture.planningRevision ||
              batch.capture.coordinateBasisId !== capture.coordinateBasisId ||
              batch.capture.positionEvaluationModelId !== capture.positionEvaluationModelId ||
              batch.capture.sourceRevision !== capture.sourceRevision ||
              batch.capture.shipRevision !== capture.shipRevision ||
              batch.capture.driveProfileRevision !== capture.driveProfileRevision ||
              !sameDriveProfile(batch.capture.driveProfile, capture.driveProfile) ||
              batch.capture.clockGeneration !== capture.clockGeneration ||
              batch.capture.clockLineage !== capture.clockLineage ||
              batch.capture.shipPositionEpochMs !== capture.shipPositionEpochMs ||
              batch.capture.searchStartEpochMs !== capture.searchStartEpochMs ||
              !samePosition(batch.capture.departurePositionKm, capture.departurePositionKm) ||
              batch.capture.candidateBodyIds.length !== capture.candidateBodyIds.length ||
              batch.capture.candidateBodyIds.some((id) => !capture?.candidateBodyIds.includes(id))))
        ) {
          fail('INVALID_CAPTURE', 'Navigation capture did not match the selected ship or destination.');
          return;
        }
        if (
          !batch.directReference ||
          !validDirect(batch.directReference, selection.destinationMarketId, batch.capture) ||
          (direct &&
            (batch.directReference.arrivalEpochMs !== direct.arrivalEpochMs ||
              !samePosition(batch.directReference.destinationPositionKm, direct.destinationPositionKm)))
        ) {
          fail('INVALID_RESPONSE', 'Navigation response contained an invalid direct reference.');
          return;
        }
        if (!capture) {
          capture = batch.capture;
          direct = batch.directReference;
          enqueueChildren([], []);
        }
        const seen = new Set<string>();
        let lastOrder = -1;
        for (const result of batch.jobs) {
          if (!result || typeof result.jobId !== 'string' || typeof result.success !== 'boolean') {
            fail('INVALID_RESPONSE', 'Navigation response contained an invalid job.');
            return;
          }
          const job = expected.get(result.jobId);
          const order = job ? jobs.indexOf(job) : -1;
          if (!job || seen.has(result.jobId) || order <= lastOrder) {
            fail('INVALID_RESPONSE', 'Navigation response contained an unexpected job.');
            return;
          }
          seen.add(result.jobId);
          lastOrder = order;
          if (result.success === false) {
            if (
              !sameJob(result, job) ||
              !['OUT_OF_DOMAIN', 'ENCOUNTER_UNAVAILABLE', 'TARGET_UNSUPPORTED', 'NUMERIC_FAILURE'].includes(
                result.reason,
              ) ||
              typeof result.message !== 'string' ||
              !result.message.trim() ||
              'legs' in result
            ) {
              fail('INVALID_RESPONSE', 'Navigation response contained an invalid rejection.');
              return;
            }
            rejected += 1;
            rejections.add(`${result.reason}: ${result.message}`);
            unresolvedJobs = true;
            continue;
          }
          if (!validJobResult(result, job, selection.shipId, batch.capture)) {
            fail('INVALID_RESPONSE', 'Navigation response contained an incomplete or mismatched route.');
            return;
          }
          if (
            job.target.kind === 'market' &&
            job.prefixBodyIds.length === 0 &&
            (!samePosition(result.legs[0].endPositionKm, batch.directReference.destinationPositionKm) ||
              result.legs[0].arrivalEpochMs !== batch.directReference.arrivalEpochMs)
          ) {
            fail('INVALID_RESPONSE', 'Navigation direct job did not match the required direct reference.');
            return;
          }
          completed += 1;
          if (job.target.kind === 'market') {
            if (job.prefixBodyIds.length && result.eligible) routes.push(result);
          } else if (result.eligible && job.targetSide !== undefined) {
            const bodyIds = [...job.prefixBodyIds, job.target.id];
            const sides = [...job.prefixSides, job.targetSide];
            queue.push({ jobId: `route-${++nextId}`, prefixBodyIds: bodyIds, prefixSides: sides, target: market });
            enqueueChildren(bodyIds, sides);
          }
        }
        const completion = batch.completion;
        const successes = batch.jobs.filter((result) => result.success).length;
        const failures = batch.jobs.length - successes;
        const logicalLegs = batch.jobs.reduce((sum, result) => sum + result.prefixBodyIds.length + 1, 0);
        const allTerminal = seen.size === jobs.length;
        if (
          !completion ||
          !['complete', 'timeout', 'interrupted', 'budget-limited'].includes(completion.mode) ||
          completion.submittedJobCount !== jobs.length ||
          completion.completedJobCount !== successes ||
          completion.failedJobCount !== failures ||
          completion.logicalLegCount !== logicalLegs ||
          (completion.mode === 'complete') !== allTerminal ||
          batch.status !== (allTerminal && failures === 0 ? 'supported' : 'incomplete')
        ) {
          fail('INVALID_RESPONSE', 'Navigation response contained inconsistent completion counts.');
          return;
        }
        pendingJobIds = jobs.filter((job) => !seen.has(job.jobId)).map((job) => job.jobId);
        this.state.set({ status: 'searching', completed, rejected, rejections: [...rejections] });
        if (!allTerminal) {
          finish(true);
        } else if (queue.length) {
          const remaining = SEARCH_JOB_LIMIT - dispatched;
          if (remaining === 0) {
            finish(true);
          } else {
            dispatch(queue.splice(0, Math.min(32, remaining)));
          }
        } else {
          finish(unresolvedJobs);
        }
      });
      this.socket.emit(REQUEST_EVENT, {
        playerName: selection.playerName,
        sessionKey: selection.sessionKey,
        operation: 'navigation-route-edge-batch.v1',
        profileId,
        navigationMode,
        phase: capture ? 'continuation' : 'bootstrap',
        correlationId,
        requestIdentity: { entityType: 'solar-system', containerId: 'sol' },
        selection: {
          solarSystemId: 'sol',
          shipId: selection.shipId,
          destination: market,
        },
        scenarioCruiseSpeedKmPerSec: SPEED,
        ...(capture ? { bootstrapId: capture.bootstrapId, planningRevision: capture.planningRevision } : {}),
        jobs,
      });
    };

    this.state.set({ status: 'searching', completed, rejected, rejections: [] });
    this.timeout = setTimeout(() => finish(true), SEARCH_TIMEOUT_MS);
    dispatch([{ jobId: 'direct', prefixBodyIds: [], prefixSides: [], target: market }]);
  }

  private stopPending(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
  }
}
