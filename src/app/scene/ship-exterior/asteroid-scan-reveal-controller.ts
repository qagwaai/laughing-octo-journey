import {
  evaluateMissionGateOnScan,
  resolveShipExteriorMission,
  type MissionScanSample,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { generateRandomAsteroidKinematics, type AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import type { MissionProgressTransitionContext } from '../../services/mission-progression-facade.service';
import type { ShipExteriorMissionStateContext } from '../../services/ship-exterior-mission-state.service';

const IRON_MATERIAL_NAME = 'Iron';

/**
 * Minimal asteroid sample contract required to reveal survey results.
 *
 * Extends the canonical mission scan contract so the reveal path and gate evaluation
 * cannot drift apart.
 */
export interface AsteroidScanRevealSample extends MissionScanSample {
  scanned: boolean;
  scanProgress: number;
  revealedKinematics?: AsteroidKinematics | null;
  capturedKinematics?: AsteroidKinematics | null;
}

export interface AsteroidScanRevealContext<TSample extends AsteroidScanRevealSample> {
  getAsteroidSamples(): readonly TSample[];
  setAsteroidSamples(samples: readonly TSample[]): void;
  setTargetHoldCandidateId(sampleId: string | null): void;
  getMissionGateState(): ShipExteriorMissionGateState | null;
  setMissionGateState(gateState: ShipExteriorMissionGateState): void;
  getState(): { playerName: string; characterId: string; shipId: string };
}

export interface AsteroidScanRevealControllerDeps<
  TSample extends AsteroidScanRevealSample,
  TContext extends AsteroidScanRevealContext<TSample>,
> {
  getActiveContext: () => TContext | null;
  getContext: (contextKey: string) => TContext | null;
  ensureAsteroidSamples: (context: TContext) => readonly TSample[];
  ensureMissionGateState: (context: TContext) => void;
  buildMissionStateContext: (state: {
    playerName: string;
    characterId: string;
    shipId: string;
  }) => ShipExteriorMissionStateContext | null;
  getSessionKey: () => string;
  advanceScanThroughFacade: (
    context: MissionProgressTransitionContext,
    sample: AsteroidScanRevealSample,
  ) => ShipExteriorMissionGateState | null;
  persistScanComplete: (sample: TSample) => void;
  onRuntimeChanged: () => void;
  onMissionChanged: () => void;
}

/**
 * Owns asteroid scan completion for ship-exterior.
 *
 * Scanning reveals survey data that already exists on the sample; it never fabricates the
 * material or kinematics it reports. Mission progression is routed through the shared
 * mission progress boundary so publication, persistence, and synchronization stay consistent.
 */
export class AsteroidScanRevealController<
  TSample extends AsteroidScanRevealSample,
  TContext extends AsteroidScanRevealContext<TSample>,
> {
  constructor(private readonly deps: AsteroidScanRevealControllerDeps<TSample, TContext>) {}

  /**
   * Completes a hover scan for the requested sample.
   *
   * No-ops when the sample is absent: an asteroid can legitimately be destroyed or collected
   * between the start of the hold and its completion.
   */
  completeScanInContext(contextKey: string, sampleId: string): ShipExteriorMissionGateState | null {
    const context = this.deps.getContext(contextKey);
    if (!context) {
      return null;
    }

    const samples = this.deps.ensureAsteroidSamples(context);
    const targetSample = samples.find((sample) => sample.id === sampleId) ?? null;
    if (!targetSample) {
      return null;
    }

    context.setTargetHoldCandidateId(null);
    return this.revealScannedAsteroid(context, targetSample);
  }

  /**
   * Deterministically scans the genuinely Iron asteroid for gated scene-reaction coverage.
   *
   * A requested sample is honored only when it is actually Iron. Sample generation guarantees an
   * Iron asteroid exists, so its absence indicates a broken fixture and fails fast rather than
   * silently scanning an unrelated asteroid.
   */
  forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null {
    const active = this.deps.getActiveContext();
    if (!active) {
      return null;
    }

    const samples = this.deps.ensureAsteroidSamples(active);
    const requestedSample = sampleId ? (samples.find((sample) => sample.id === sampleId) ?? null) : null;
    const targetSample =
      requestedSample && this.isIronSample(requestedSample)
        ? requestedSample
        : (samples.find((sample) => this.isIronSample(sample)) ?? null);

    if (!targetSample) {
      throw new Error(
        `[ship-exterior-test-api] forceCompleteIronScan requires an Iron asteroid in the active context, but none was found among ${samples.length} sample(s). Asteroid generation guarantees one, so this indicates a broken test fixture.`,
      );
    }

    return this.revealScannedAsteroid(active, targetSample);
  }

  private isIronSample(sample: AsteroidScanRevealSample): boolean {
    return sample.revealedMaterial?.material === IRON_MATERIAL_NAME;
  }

  private revealScannedAsteroid(context: TContext, sample: TSample): ShipExteriorMissionGateState | null {
    const revealedSample: TSample = {
      ...sample,
      scanned: true,
      scanProgress: 100,
      revealedKinematics:
        sample.revealedKinematics ?? sample.capturedKinematics ?? generateRandomAsteroidKinematics(),
    };

    context.setAsteroidSamples(
      context.getAsteroidSamples().map((candidate) => (candidate.id === revealedSample.id ? revealedSample : candidate)),
    );
    this.deps.onRuntimeChanged();
    this.deps.persistScanComplete(revealedSample);

    return this.advanceMissionGateOnScan(context, revealedSample);
  }

  /**
   * Routes scan progression through the mission progress boundary.
   *
   * Contexts without a persistable identity fall back to in-memory canonical evaluation so
   * unidentified characters keep working without persistence or synchronization.
   */
  private advanceMissionGateOnScan(context: TContext, sample: TSample): ShipExteriorMissionGateState | null {
    this.deps.ensureMissionGateState(context);

    const storageContext = this.deps.buildMissionStateContext(context.getState());
    if (storageContext) {
      const nextState = this.deps.advanceScanThroughFacade(
        { ...storageContext, sessionKey: this.deps.getSessionKey() },
        sample,
      );
      if (nextState) {
        return nextState;
      }
    }

    const currentState = context.getMissionGateState();
    if (!currentState) {
      return null;
    }

    const evaluation = evaluateMissionGateOnScan({
      mission: resolveShipExteriorMission(currentState.missionId),
      gateState: currentState,
      sample,
    });
    if (evaluation.changed) {
      context.setMissionGateState(evaluation.gateState);
      this.deps.onMissionChanged();
    }

    return evaluation.gateState;
  }
}
