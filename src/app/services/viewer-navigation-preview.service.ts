import { Injectable, inject, signal } from '@angular/core';
import type {
  NavigationPositionRequest,
  NavigationPositionVector,
  PairedNavigationEstimate,
  SolarSystemGetResponse,
  SupportedNavigationPositionState,
  SupportedNavigationRouteEstimate,
} from '../model/solar-system-get';
import { getNavigationPrediction, type NavigationPredictionDisplay } from './navigation-prediction-validation';
import { SolarSystemService } from './solar-system.service';

const SOL_POSITION_BASIS = 'stellar:sol:catalog-cartesian:v1';
const POSITION_EVALUATION_MODEL = 'sol-catalog-kepler-position-v1';
const DISTANCE_ESTIMATION_MODEL = 'frozen-endpoints-constant-speed-v1';

export interface NavigationPreviewSelection {
  playerName: string;
  sessionKey: string;
  characterId: string;
  solarSystemId: string;
  shipId: string;
  shipName: string;
  shipEpochMs: number;
  shipPositionKm: NavigationPositionVector;
  destinationMarketId: string;
  destinationName: string;
  candidateBodyId?: string;
}

type PreviewDisplaySelection = Omit<NavigationPreviewSelection, 'playerName' | 'sessionKey'>;

export type NavigationEstimateDisplay =
  { status: 'ready'; distanceKm: number } | { status: 'unavailable'; reason: string };

export type ViewerNavigationPreview =
  | { status: 'loading'; selection: PreviewDisplaySelection }
  | { status: 'unsupported'; selection: PreviewDisplaySelection; reason?: string }
  | { status: 'error'; selection: PreviewDisplaySelection; reason?: string }
  | { status: 'ineligible'; selection: PreviewDisplaySelection; reason: string }
  | {
      status: 'ready';
      selection: PreviewDisplaySelection;
      state: SupportedNavigationPositionState;
      estimate: NavigationEstimateDisplay;
    };

function isValidVector(position: NavigationPositionVector | undefined): position is NavigationPositionVector {
  return !!position && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z);
}

function getNavigationEstimate(
  paired: PairedNavigationEstimate | undefined,
  state: SupportedNavigationPositionState,
  selection: PreviewDisplaySelection,
): NavigationEstimateDisplay {
  if (!paired || paired.association !== 'same-response-direct-endpoints') {
    return { status: 'unavailable', reason: 'PAIRED_ESTIMATE_INVALID' };
  }

  const estimate = paired.estimate;
  if (paired.success === false) {
    return estimate && estimate.status !== 'supported' && typeof estimate.reason === 'string'
      ? { status: 'unavailable', reason: estimate.reason }
      : { status: 'unavailable', reason: 'PAIRED_ESTIMATE_INVALID' };
  }

  if (!isSupportedEstimate(estimate, state, selection)) {
    return { status: 'unavailable', reason: 'PAIRED_ESTIMATE_INVALID' };
  }

  return { status: 'ready', distanceKm: estimate.distanceKm };
}

function isSupportedEstimate(
  estimate: PairedNavigationEstimate['estimate'],
  state: SupportedNavigationPositionState,
  selection: PreviewDisplaySelection,
): estimate is SupportedNavigationRouteEstimate {
  return (
    estimate.status === 'supported' &&
    estimate.solarSystemId === state.solarSystemId &&
    estimate.solarSystemId === selection.solarSystemId &&
    estimate.departure?.shipId === selection.shipId &&
    estimate.destination?.marketId === selection.destinationMarketId &&
    estimate.coordinateBasisId === state.coordinateBasisId &&
    estimate.referenceEpochMs === state.epochMs &&
    estimate.positionEvaluationModelId === POSITION_EVALUATION_MODEL &&
    estimate.estimationModelId === DISTANCE_ESTIMATION_MODEL &&
    Number.isFinite(estimate.distanceKm) &&
    estimate.distanceKm >= 0 &&
    estimate.classification === 'hypothetical-not-eta' &&
    estimate.assumptions?.endpointsFrozen === true &&
    estimate.assumptions?.constantScenarioSpeed === true &&
    estimate.assumptions?.accelerationBrakingOmitted === true &&
    estimate.assumptions?.assistSpeedChangesOmitted === true &&
    estimate.assumptions?.movementDuringTripOmitted === true &&
    Array.isArray(estimate.warnings) &&
    estimate.warnings.length === 1 &&
    estimate.warnings[0] === 'CLEARANCE_UNVERIFIED' &&
    estimate.duration?.status === 'unavailable' &&
    estimate.duration.reason === 'SCENARIO_SPEED_NOT_SUPPLIED'
  );
}

function isSupportedForSelection(state: SupportedNavigationPositionState, selection: PreviewDisplaySelection): boolean {
  if (
    state.solarSystemId !== selection.solarSystemId ||
    state.coordinateBasisId !== SOL_POSITION_BASIS ||
    !Number.isSafeInteger(state.epochMs) ||
    state.epochMs < 946_684_800_000 ||
    state.epochMs >= 4_102_444_800_000 ||
    state.departure?.shipId !== selection.shipId ||
    state.destination?.marketId !== selection.destinationMarketId ||
    !isValidVector(state.departure?.positionKm) ||
    !isValidVector(state.destination?.positionKm) ||
    !Array.isArray(state.candidates) ||
    state.candidates.length > 1 ||
    !(
      (state.previewEligibility?.status === 'ineligible' &&
        ['KNOWN_INVALID_DESTINATION', 'KNOWN_INVALID_SOURCE'].includes(state.previewEligibility.reason)) ||
      (state.previewEligibility?.status === 'eligible-with-warnings' &&
        state.previewEligibility.reason === 'CLEARANCE_UNVERIFIED')
    )
  ) {
    return false;
  }

  if (selection.candidateBodyId) {
    return (
      state.candidates.length === 1 &&
      state.candidates[0]?.bodyId === selection.candidateBodyId &&
      isValidVector(state.candidates[0]?.positionKm)
    );
  }

  return state.candidates.length === 0;
}

@Injectable({ providedIn: 'root' })
export class ViewerNavigationPreviewService {
  private readonly solarSystemService = inject(SolarSystemService);
  private requestSequence = 0;
  private cancelPending: (() => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private selection: NavigationPreviewSelection | null = null;
  readonly preview = signal<ViewerNavigationPreview | null>(null);
  readonly prediction = signal<NavigationPredictionDisplay>({ status: 'idle' });

  getPlanningSelection(): NavigationPreviewSelection | null {
    return this.selection;
  }

  start(selection: NavigationPreviewSelection): void {
    this.prediction.set({ status: 'idle' });
    this.selection = selection;
    this.request(selection);
  }

  selectCandidate(candidateBodyId: string | null): void {
    if (!this.selection) return;
    const selection = { ...this.selection };
    if (candidateBodyId) selection.candidateBodyId = candidateBodyId;
    else delete selection.candidateBodyId;
    this.selection = selection;
    this.prediction.set({ status: 'idle' });
    this.request(selection);
  }

  calculatePrediction(speed: number): void {
    if (!this.selection || this.preview()?.status !== 'ready') return;
    if (!Number.isFinite(speed) || speed < 120 || speed > 10000) {
      this.clearPrediction();
      this.prediction.set({ status: 'unavailable', reason: 'SCENARIO_SPEED_INVALID', message: '' });
      return;
    }
    if (!this.selection.candidateBodyId) {
      this.clearPrediction();
      this.prediction.set({ status: 'unavailable', reason: 'CANDIDATE_REQUIRED', message: '' });
      return;
    }
    this.prediction.set({ status: 'loading' });
    this.request(this.selection, speed);
  }

  clearPrediction(): void {
    this.requestSequence += 1;
    this.stopPending();
    this.prediction.set({ status: 'idle' });
  }

  clear(): void {
    this.requestSequence += 1;
    this.stopPending();
    this.selection = null;
    this.preview.set(null);
    this.prediction.set({ status: 'idle' });
  }

  invalidateSession(): void {
    const preview = this.preview();
    this.clear();
    if (preview) {
      this.preview.set({ status: 'error', selection: preview.selection, reason: 'INVALID_SESSION' });
    }
  }

  private stopPending(): void {
    this.cancelPending?.();
    this.cancelPending = null;
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
  }

  private request(selection: NavigationPreviewSelection, predictionSpeed?: number): void {
    this.stopPending();
    const sequence = ++this.requestSequence;
    const displaySelection: PreviewDisplaySelection = {
      solarSystemId: selection.solarSystemId,
      characterId: selection.characterId,
      shipId: selection.shipId,
      shipName: selection.shipName,
      shipEpochMs: selection.shipEpochMs,
      shipPositionKm: { ...selection.shipPositionKm },
      destinationMarketId: selection.destinationMarketId,
      destinationName: selection.destinationName,
      candidateBodyId: selection.candidateBodyId,
    };
    if (predictionSpeed === undefined) this.preview.set({ status: 'loading', selection: displaySelection });

    const navigation: NavigationPositionRequest = {
      shipId: selection.shipId,
      destinationMarketId: selection.destinationMarketId,
      ...(selection.candidateBodyId ? { candidateBodyId: selection.candidateBodyId } : {}),
    };
    this.timeout = setTimeout(() => {
      if (sequence !== this.requestSequence) return;
      this.stopPending();
      this.requestSequence += 1;
      this.prediction.set({ status: 'unavailable', reason: 'PREDICTION_TIMEOUT', message: '' });
      if (predictionSpeed !== undefined) return;
      this.preview.set({ status: 'error', selection: displaySelection });
    }, 15_000);
    const cancel = this.solarSystemService.getSolarSystem(
      {
        playerName: selection.playerName,
        sessionKey: selection.sessionKey,
        solarSystemId: selection.solarSystemId,
        navigation,
        navigationEstimate: {},
        requestIdentity: {
          operation: 'solar-system-get',
          entityType: 'solar-system',
          containerId: selection.solarSystemId,
        },
        ...(predictionSpeed !== undefined
          ? { navigationPrediction: { scenarioCruiseSpeedKmPerSec: predictionSpeed } }
          : {}),
      },
      (response) => this.receiveResponse(sequence, displaySelection, response, predictionSpeed),
    );
    if (
      sequence === this.requestSequence &&
      (this.preview()?.status === 'loading' || this.prediction().status === 'loading')
    ) {
      this.cancelPending = cancel;
    }
  }

  private receiveResponse(
    sequence: number,
    selection: PreviewDisplaySelection,
    response: SolarSystemGetResponse,
    predictionSpeed?: number,
  ): void {
    if (sequence !== this.requestSequence) return;
    this.stopPending();
    if (!response.success) {
      this.prediction.set({ status: 'unavailable', reason: 'NAVIGATION_READ_FAILED', message: response.message });
      this.preview.set({ status: 'error', selection, reason: response.message });
      return;
    }

    const state = response.navigationState;
    this.prediction.set({ status: 'idle' });
    if (!state || state.status === 'unsupported') {
      this.preview.set({
        status: 'unsupported',
        selection,
        reason: state?.status === 'unsupported' ? state.reason : undefined,
      });
      return;
    }

    if (state.status !== 'supported' || !isSupportedForSelection(state, selection)) {
      this.preview.set({ status: 'unsupported', selection });
      return;
    }

    if (state.previewEligibility.status === 'ineligible') {
      this.preview.set({ status: 'ineligible', selection, reason: state.previewEligibility.reason });
      return;
    }

    const estimate = getNavigationEstimate(response.navigationEstimate, state, selection);
    this.preview.set({ status: 'ready', selection, state, estimate });
    if (predictionSpeed !== undefined) {
      this.prediction.set(getNavigationPrediction(response.navigationPrediction, state, predictionSpeed));
    }
  }
}
