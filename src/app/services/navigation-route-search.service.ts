import { Injectable, inject, signal } from '@angular/core';
import type {
  NavigationDirectReference,
  NavigationRouteBatchResponse,
  NavigationRouteCapture,
  NavigationDriveProfile,
  NavigationRouteJob,
  NavigationRouteMode,
  NavigationRouteProfileId,
  NavigationRouteSuccess,
  NavigationSide,
} from '../model/navigation-route-search';
import type { NavigationPreviewSelection } from './viewer-navigation-preview.service';
import { createUuidCorrelationId } from './socket-correlation';
import { SocketService } from './socket.service';
import { selectNavigationRoutes, type NavigationRouteChoice } from './navigation-route-selection';

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

function validDriveProfile(profile: NavigationDriveProfile | null): boolean {
  return profile === null || (
    !!profile && typeof profile.id === 'string' && !!profile.id.trim() &&
    typeof profile.name === 'string' && !!profile.name.trim() &&
    [profile.rangeAu, profile.cruiseSpeedAuPerHour, profile.fuelCostPerAu].every((value) => Number.isFinite(value) && value > 0)
  );
}

function sameDriveProfile(a: NavigationDriveProfile | null, b: NavigationDriveProfile | null): boolean {
  return a === null || b === null ? a === b :
    a.id === b.id && a.name === b.name && a.rangeAu === b.rangeAu &&
    a.cruiseSpeedAuPerHour === b.cruiseSpeedAuPerHour && a.fuelCostPerAu === b.fuelCostPerAu;
}

function validDriveEligibility(
  result: Pick<NavigationDirectReference, 'navigationMode' | 'flightAuthorized' | 'driveEligibility'>,
  capture: NavigationRouteCapture,
  distances: number[],
): boolean {
  const drive = result.driveEligibility;
  if (result.navigationMode !== capture.navigationMode || result.flightAuthorized !== false || !drive || drive.flightAuthorized !== false) return false;
  if (capture.navigationMode === 'bounded-preview-100au') {
    return drive.status === 'not-applicable' && drive.reason === 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE';
  }
  if (!capture.driveProfile) return false;
  const rangeAu = capture.driveProfile.rangeAu;
  const rangeKm = rangeAu * AU_KM;
  const exceeding = distances.some((distance) => distance > rangeKm);
  return drive.status === (exceeding ? 'ineligible' : 'eligible') &&
    drive.reason === (exceeding ? 'OUTSIDE_SHIP_LEG_RANGE' : 'WITHIN_SHIP_LEG_RANGE') &&
    (drive.rangeAu === undefined || drive.rangeAu === rangeAu) &&
    (drive.rangeKm === undefined || drive.rangeKm === rangeKm);
}

function validDirect(direct: NavigationDirectReference, destinationId: string, capture: NavigationRouteCapture): boolean {
  const points = [direct.departurePositionKm, direct.destinationPositionKm];
  const bounds = PROFILE_BOUNDS[capture.profileId];
  const exceedsDrive = capture.navigationMode === 'ship-drive-normal' &&
    !!capture.driveProfile && direct.distanceKm > capture.driveProfile.rangeAu * AU_KM;
  const eligible = !exceedsDrive && direct.distanceKm <= bounds.maxPathKm &&
    (bounds.maxLegKm === null || direct.distanceKm <= bounds.maxLegKm);
  return (
    direct.status === 'supported' &&
    direct.target?.kind === 'market' &&
    direct.target.id === destinationId &&
    points.every((point) => point && [point.x, point.y, point.z].every(Number.isFinite)) &&
    Number.isFinite(direct.distanceKm) &&
    direct.distanceKm >= 0 &&
    direct.eligible === eligible &&
    direct.eligibilityReason ===
      (eligible ? 'WITHIN_PHASE3_BOUNDS' : exceedsDrive ? 'OUTSIDE_SHIP_LEG_RANGE' : bounds.maxLegKm === null
        ? 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT'
        : 'DIRECT_REFERENCE_MAY_EXCEED_HOP_LIMIT') &&
    Number.isSafeInteger(direct.durationMs) &&
    direct.durationMs >= 0 &&
    Number.isFinite(direct.fuelUnits) &&
    direct.fuelUnits >= 0 &&
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
    job.target.kind === 'body' && job.targetSide !== undefined
      ? [...job.prefixSides, job.targetSide]
      : job.prefixSides;
  if (
    !result.target ||
    !Array.isArray(result.prefixBodyIds) ||
    !Array.isArray(result.prefixSides) ||
    result.target.kind !== job.target.kind ||
    result.target.id !== job.target.id ||
    (job.target.kind === 'body' ? result.targetSide !== job.targetSide : result.targetSide !== undefined) ||
    result.prefixBodyIds.join('\0') !== job.prefixBodyIds.join('\0') ||
    result.prefixSides.join(',') !== job.prefixSides.join(',') ||
    !Array.isArray(result.sideHistory) ||
    result.sideHistory.length !== expectedBodies.length ||
    result.sideHistory.some(
      (side, index) =>
        side.encounterIndex !== index + 1 || side.bodyId !== expectedBodies[index] || side.side !== expectedSides[index],
    ) ||
    !Array.isArray(result.legs) ||
    result.legs.length !== job.prefixBodyIds.length + 1 ||
    !Number.isFinite(result.totalDistanceKm) ||
    result.totalDistanceKm < 0 ||
    !Number.isFinite(result.fuelUnits) ||
    result.fuelUnits < 0 ||
    !Number.isSafeInteger(result.totalDurationMs) ||
    result.totalDurationMs < 0 ||
    !result.hazardAssessment ||
    !Array.isArray(result.hazardAssessment.markers) ||
    !Array.isArray(result.hazardAssessment.unresolvedAssessments)
  ) return false;

  const bounds = PROFILE_BOUNDS[capture.profileId];
  const exceedsDrive = capture.navigationMode === 'ship-drive-normal' &&
    !!capture.driveProfile && result.legs.some((leg) => leg.distanceKm > capture.driveProfile!.rangeAu * AU_KM);
  const exceedsHop = bounds.maxLegKm !== null && result.legs.some((leg) => leg.distanceKm > bounds.maxLegKm!);
  const exceedsPath = result.totalDistanceKm > bounds.maxPathKm;
  const reason = exceedsDrive ? 'OUTSIDE_SHIP_LEG_RANGE' :
    exceedsHop ? 'OUTSIDE_HOP_OR_PATH_LIMIT' :
    exceedsPath ? (bounds.maxLegKm === null ? 'OUTSIDE_TOTAL_PATH_LIMIT' : 'OUTSIDE_HOP_OR_PATH_LIMIT') :
    'WITHIN_PHASE3_BOUNDS';
  if (
    !validDriveEligibility(result, capture, result.legs.map((leg) => leg.distanceKm)) ||
    result.eligible !== (reason === 'WITHIN_PHASE3_BOUNDS') ||
    result.eligibilityReason !== reason
  ) return false;

  const ids = [shipId, ...expectedBodies];
  if (job.target.kind === 'market') ids.push(job.target.id);
  return result.legs.every((leg, index) => {
    const previous = result.legs[index - 1];
    const encounter = leg.encounter;
    const encounterValid = !encounter || (
      index < expectedBodies.length &&
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
      (['x', 'y', 'z'] as const).every((axis) =>
        encounter.waypointPositionKm[axis] === leg.endPositionKm?.[axis] &&
        encounter.offsetKm[axis] === encounter.waypointPositionKm[axis] - encounter.bodyCenterPositionKm[axis],
      )
    );
    return (
      encounterValid &&
      leg.legIndex === index + 1 &&
      leg.fromBodyOrShipId === ids[index] &&
      leg.toBodyOrMarketId === ids[index + 1] &&
      [leg.startPositionKm, leg.endPositionKm].every(
        (point) => point && [point.x, point.y, point.z].every(Number.isFinite),
      ) &&
      Number.isFinite(leg.distanceKm) &&
      leg.distanceKm >= 0 &&
      Number.isFinite(leg.fuelUnits) &&
      leg.fuelUnits >= 0 &&
      typeof leg.withinHopLimit === 'boolean' &&
      (capture.navigationMode === 'ship-drive-normal'
        ? !!capture.driveProfile &&
          leg.shipLegRangeKm === capture.driveProfile.rangeAu * AU_KM &&
          leg.withinShipLegRange === (leg.distanceKm <= leg.shipLegRangeKm)
        : leg.shipLegRangeKm === undefined && leg.withinShipLegRange === undefined) &&
      Number.isSafeInteger(leg.departureEpochMs) &&
      Number.isSafeInteger(leg.arrivalEpochMs) &&
      Number.isSafeInteger(leg.durationMs) &&
      leg.durationMs >= 0 &&
      leg.arrivalEpochMs - leg.departureEpochMs === leg.durationMs &&
      (!previous ||
        (previous.arrivalEpochMs === leg.departureEpochMs &&
          previous.endPositionKm.x === leg.startPositionKm.x &&
          previous.endPositionKm.y === leg.startPositionKm.y &&
          previous.endPositionKm.z === leg.startPositionKm.z))
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
    const rejections = new Set<string>();
    let nextId = 0;
    const market = { kind: 'market' as const, id: selection.destinationMarketId };

    const finish = (incomplete: boolean): void => {
      if (sequence !== this.sequence) return;
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
      const correlationId = createUuidCorrelationId();
      const expected = new Map(jobs.map((job) => [job.jobId, job]));
      this.unsubscribe = this.socket.on(RESPONSE_EVENT, (response: NavigationRouteBatchResponse) => {
        if (sequence !== this.sequence || response?.correlationId !== correlationId) return;
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
        if (!response.success) {
          fail(response.failure?.reason ?? 'NAVIGATION_FAILED', response.failure?.message ?? response.message);
          return;
        }
        const batch = response.batch;
        if (
          !batch?.capture ||
          batch.capture.shipId !== selection.shipId ||
          batch.capture.destinationMarketId !== selection.destinationMarketId ||
          batch.capture.profileId !== profileId ||
          batch.capture.profileVersion !== 'v1' ||
          batch.capture.navigationMode !== navigationMode ||
          batch.capture.flightAuthorized !== false ||
          !batch.capture.shipRevision ||
          !batch.capture.clockLineage ||
          !Number.isSafeInteger(batch.capture.clockGeneration) ||
          !Number.isSafeInteger(batch.capture.clockEpochMs) ||
          !validDriveProfile(batch.capture.driveProfile) ||
          (batch.capture.driveProfileRevision !== null &&
            (typeof batch.capture.driveProfileRevision !== 'string' || !batch.capture.driveProfileRevision)) ||
          (navigationMode === 'ship-drive-normal' &&
            (!batch.capture.driveProfile || !batch.capture.driveProfileRevision ||
              !Number.isFinite(batch.capture.driveProfile.rangeAu) || batch.capture.driveProfile.rangeAu <= 0)) ||
          batch.bounds?.profileId !== profileId ||
          batch.bounds.maxLegDistanceKm !== bounds.maxLegKm ||
          batch.bounds.maxEligiblePathKm !== bounds.maxPathKm ||
          !Array.isArray(batch.capture.candidateBodyIds) ||
          batch.capture.candidateBodyIds.length > 10 ||
          new Set(batch.capture.candidateBodyIds).size !== batch.capture.candidateBodyIds.length ||
          batch.capture.candidateBodyIds.some((id) => typeof id !== 'string' || !id.trim()) ||
          !batch.capture.bootstrapId ||
          !batch.capture.planningRevision ||
          !Array.isArray(batch.jobs) ||
          batch.status === 'failed' ||
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
              batch.capture.clockEpochMs !== capture.clockEpochMs))
        ) {
          fail('INVALID_CAPTURE', 'Navigation capture did not match the selected ship or destination.');
          return;
        }
        if (batch.directReference && !validDirect(batch.directReference, selection.destinationMarketId, batch.capture)) {
          fail('INVALID_RESPONSE', 'Navigation response contained an invalid direct reference.');
          return;
        }
        if (!capture) {
          capture = batch.capture;
          direct = batch.directReference;
          enqueueChildren([], []);
        }
        const seen = new Set<string>();
        for (const result of batch.jobs) {
          if (!result || typeof result.jobId !== 'string' || typeof result.success !== 'boolean') {
            fail('INVALID_RESPONSE', 'Navigation response contained an invalid job.');
            return;
          }
          const job = expected.get(result.jobId);
          if (!job || seen.has(result.jobId)) {
            fail('INVALID_RESPONSE', 'Navigation response contained an unexpected job.');
            return;
          }
          seen.add(result.jobId);
          if (result.success === false) {
            if (typeof result.reason !== 'string' || typeof result.message !== 'string') {
              fail('INVALID_RESPONSE', 'Navigation response contained an invalid rejection.');
              return;
            }
            rejected += 1;
            rejections.add(`${result.reason}: ${result.message}`);
            if (result.reason !== 'OUT_OF_DOMAIN' && result.reason !== 'ENCOUNTER_UNAVAILABLE') unresolvedJobs = true;
            continue;
          }
          if (!validJobResult(result, job, selection.shipId, batch.capture)) {
            fail('INVALID_RESPONSE', 'Navigation response contained an incomplete or mismatched route.');
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
        this.state.set({ status: 'searching', completed, rejected, rejections: [...rejections] });
        if (batch.completion?.mode !== 'complete' || seen.size !== jobs.length) {
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
