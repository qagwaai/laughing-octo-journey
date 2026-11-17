import type {
  NavigationPositionVector,
  NavigationPredictionConvergence,
  PairedNavigationPrediction,
  SupportedNavigationPositionState,
  SupportedNavigationPrediction,
} from '../model/solar-system-get';

export type NavigationPredictionDisplay =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string; message: string }
  | { status: 'ready'; prediction: SupportedNavigationPrediction };

function validVector(value: NavigationPositionVector | undefined): boolean {
  return !!value && [value.x, value.y, value.z].every(Number.isFinite);
}

function validEpoch(value: number | undefined): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 946_684_800_000 && value < 4_102_444_800_000
  );
}

function validConvergence(value: NavigationPredictionConvergence | undefined): boolean {
  return (
    !!value &&
    Number.isInteger(value.iterations) &&
    value.iterations >= 1 &&
    value.iterations <= 64 &&
    Number.isFinite(value.residualMs) &&
    value.residualMs >= 0 &&
    value.residualMs <= 1
  );
}

export function getNavigationPrediction(
  paired: PairedNavigationPrediction | undefined,
  state: SupportedNavigationPositionState,
  speed: number,
): NavigationPredictionDisplay {
  const invalid: NavigationPredictionDisplay = {
    status: 'unavailable',
    reason: 'PAIRED_PREDICTION_INVALID',
    message: '',
  };
  if (!paired || paired.association !== 'same-response-navigation-sources') return invalid;
  const p = paired.prediction;
  if (!p) return invalid;
  if (paired.success === false) {
    return ['invalid', 'unsupported', 'ineligible', 'failed'].includes(p.status) &&
      'reason' in p &&
      typeof p.reason === 'string' &&
      typeof p.message === 'string' &&
      Object.keys(p).every((key) => ['status', 'reason', 'message'].includes(key))
      ? { status: 'unavailable', reason: p.reason, message: p.message }
      : invalid;
  }
  if (paired.success !== true || p.status !== 'supported') return invalid;
  if (
    state.previewEligibility.status !== 'eligible-with-warnings' ||
    p.solarSystemId !== state.solarSystemId ||
    p.coordinateBasisId !== state.coordinateBasisId ||
    p.positionEvaluationModelId !== 'sol-catalog-kepler-position-v1' ||
    state.provenance?.evaluationModelId !== p.positionEvaluationModelId ||
    !/^[a-f0-9]{64}$/.test(p.sourceRevision) ||
    p.sourceRevision !== state.provenance.sourceRevision ||
    p.predictionModelId !== 'constant-speed-straight-legs-moving-targets-v1' ||
    p.timeScaleId !== 'stellar:unix-ms-uniform:v1' ||
    p.classification !== 'illustrative-not-eta' ||
    p.scenarioCruiseSpeedKmPerSec !== speed ||
    p.speedProvenance !== 'caller-supplied-scenario' ||
    !p.departure ||
    !p.encounter ||
    !p.arrival ||
    p.departure.shipId !== state.departure.shipId ||
    p.departure.epochMs !== state.epochMs ||
    !validVector(p.departure.positionKm) ||
    p.departure.positionKm.x !== state.departure.positionKm.x ||
    p.departure.positionKm.y !== state.departure.positionKm.y ||
    p.departure.positionKm.z !== state.departure.positionKm.z ||
    state.candidates.length !== 1 ||
    p.encounter.bodyId !== state.candidates[0]?.bodyId ||
    p.arrival.marketId !== state.destination.marketId ||
    !p.arrival.hostBodyId ||
    p.arrival.hostBodyId !== state.destination.hostBodyId ||
    !validVector(p.encounter.positionKm) ||
    !validVector(p.arrival.positionKm) ||
    !validVector(p.arrival.hostPositionKm) ||
    !validEpoch(p.departure.epochMs) ||
    !validEpoch(p.encounter.epochMs) ||
    !validEpoch(p.arrival.epochMs) ||
    p.encounter.epochMs < p.departure.epochMs ||
    p.arrival.epochMs < p.encounter.epochMs ||
    p.arrival.epochMs - p.departure.epochMs > 315_576_000_000 ||
    !validConvergence(p.encounter.convergence) ||
    !validConvergence(p.arrival.convergence) ||
    p.assumptions?.legDistanceStraightLine !== true ||
    p.assumptions?.constantScenarioSpeed !== true ||
    p.assumptions?.accelerationBrakingOmitted !== true ||
    p.assumptions?.gravityAndAssistEffectsOmitted !== true ||
    p.assumptions?.departureFixedAtNavigationEpoch !== true ||
    p.assumptions?.encounterAtBodyCenter !== true ||
    !Array.isArray(p.warnings) ||
    p.warnings.length !== 1 ||
    p.warnings[0] !== 'CLEARANCE_UNVERIFIED'
  )
    return invalid;
  return { status: 'ready', prediction: p };
}
