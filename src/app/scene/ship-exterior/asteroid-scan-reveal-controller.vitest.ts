import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFirstTargetMissionInitialGateState } from '../../mission/first-target-ship-exterior-mission';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
  AsteroidScanRevealController,
  type AsteroidScanRevealContext,
  type AsteroidScanRevealSample,
} from './asteroid-scan-reveal-controller';

const CHARACTER_ID = 'char-1';
const CONTEXT_KEY = 'context-1';

const CAPTURED_KINEMATICS: AsteroidKinematics = {
  velocityKmPerSec: { x: 1, y: 2, z: 3 },
  angularVelocityRadPerSec: { x: 0.1, y: 0.2, z: 0.3 },
} as unknown as AsteroidKinematics;

interface TestSample extends AsteroidScanRevealSample {
  displayLabel?: string;
}

function makeSample(overrides: Partial<TestSample> = {}): TestSample {
  return {
    id: 'sample-1',
    scanned: false,
    scanProgress: 0,
    revealedMaterial: { material: 'Copper' },
    revealedKinematics: null,
    capturedKinematics: CAPTURED_KINEMATICS,
    ...overrides,
  };
}

function makeGateState(
  statuses: Record<string, ShipExteriorMissionGateState['steps'][number]['status']> = {},
): ShipExteriorMissionGateState {
  const initial = createFirstTargetMissionInitialGateState(CHARACTER_ID);
  return {
    ...initial,
    steps: initial.steps.map((step) => ({ ...step, status: statuses[step.key] ?? step.status })),
  };
}

class FakeContext implements AsteroidScanRevealContext<TestSample> {
  samples: TestSample[];
  gateState: ShipExteriorMissionGateState | null;
  targetHoldCandidateId: string | null = 'pending-hold';

  constructor(samples: TestSample[], gateState: ShipExteriorMissionGateState | null) {
    this.samples = samples;
    this.gateState = gateState;
  }

  getAsteroidSamples(): readonly TestSample[] {
    return this.samples;
  }

  setAsteroidSamples(samples: readonly TestSample[]): void {
    this.samples = [...samples];
  }

  setTargetHoldCandidateId(sampleId: string | null): void {
    this.targetHoldCandidateId = sampleId;
  }

  getMissionGateState(): ShipExteriorMissionGateState | null {
    return this.gateState;
  }

  setMissionGateState(gateState: ShipExteriorMissionGateState): void {
    this.gateState = gateState;
  }

  getState() {
    return { playerName: 'Pioneer', characterId: CHARACTER_ID, shipId: 'ship-1' };
  }
}

function createHarness(options: {
  samples: TestSample[];
  gateState?: ShipExteriorMissionGateState | null;
  identity?: boolean;
}) {
  const context = new FakeContext(
    options.samples,
    options.gateState === undefined ? makeGateState() : options.gateState,
  );
  const advanceScanThroughFacade = vi.fn().mockReturnValue(null);
  const persistScanComplete = vi.fn();
  const onRuntimeChanged = vi.fn();
  const onMissionChanged = vi.fn();
  const ensureMissionGateState = vi.fn();

  const controller = new AsteroidScanRevealController<TestSample, FakeContext>({
    getActiveContext: () => context,
    getContext: (contextKey) => (contextKey === CONTEXT_KEY ? context : null),
    ensureAsteroidSamples: (target) => target.getAsteroidSamples(),
    ensureMissionGateState,
    buildMissionStateContext: (state) =>
      options.identity === false
        ? null
        : {
            missionId: FIRST_TARGET_MISSION_ID,
            playerName: state.playerName,
            characterId: state.characterId,
            shipId: state.shipId,
          },
    getSessionKey: () => 'session-1',
    advanceScanThroughFacade,
    persistScanComplete,
    onRuntimeChanged,
    onMissionChanged,
  });

  return {
    controller,
    context,
    advanceScanThroughFacade,
    persistScanComplete,
    onRuntimeChanged,
    onMissionChanged,
    ensureMissionGateState,
  };
}

describe('AsteroidScanRevealController', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('production hover-scan completion', () => {
    it('reveals the requested sample without altering its generated material', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'sample-1', revealedMaterial: { material: 'Copper' } })],
      });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      const revealed = harness.context.samples.find((sample) => sample.id === 'sample-1');
      expect(revealed?.scanned).toBe(true);
      expect(revealed?.scanProgress).toBe(100);
      expect(revealed?.revealedMaterial).toEqual({ material: 'Copper' });
    });

    it('reveals the captured kinematics rather than fabricating new values', () => {
      const harness = createHarness({ samples: [makeSample()] });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      expect(harness.context.samples[0].revealedKinematics).toEqual(CAPTURED_KINEMATICS);
    });

    it('keeps already-revealed kinematics when present', () => {
      const alreadyRevealed = { velocityKmPerSec: { x: 9, y: 9, z: 9 } } as unknown as AsteroidKinematics;
      const harness = createHarness({ samples: [makeSample({ revealedKinematics: alreadyRevealed })] });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      expect(harness.context.samples[0].revealedKinematics).toEqual(alreadyRevealed);
    });

    it('falls back to generated kinematics only when no captured values exist', () => {
      const harness = createHarness({
        samples: [makeSample({ revealedKinematics: null, capturedKinematics: null })],
      });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      expect(harness.context.samples[0].revealedKinematics).toBeTruthy();
    });

    it('preserves unrelated sample fields when revealing', () => {
      const harness = createHarness({ samples: [makeSample({ displayLabel: 'Alpha' })] });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      expect(harness.context.samples[0].displayLabel).toBe('Alpha');
    });

    it('leaves other samples untouched', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'sample-1' }), makeSample({ id: 'sample-2' })],
      });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      const untouched = harness.context.samples.find((sample) => sample.id === 'sample-2');
      expect(untouched?.scanned).toBe(false);
      expect(untouched?.scanProgress).toBe(0);
    });

    it('clears the target hold candidate and notifies runtime and persistence', () => {
      const harness = createHarness({ samples: [makeSample()] });

      harness.controller.completeScanInContext(CONTEXT_KEY, 'sample-1');

      expect(harness.context.targetHoldCandidateId).toBeNull();
      expect(harness.onRuntimeChanged).toHaveBeenCalledTimes(1);
      expect(harness.persistScanComplete).toHaveBeenCalledTimes(1);
      expect(harness.persistScanComplete.mock.calls[0][0]).toMatchObject({ id: 'sample-1', scanned: true });
    });

    it('no-ops when the requested sample is no longer present', () => {
      const harness = createHarness({ samples: [makeSample({ id: 'sample-1' })] });

      const result = harness.controller.completeScanInContext(CONTEXT_KEY, 'missing-sample');

      expect(result).toBeNull();
      expect(harness.persistScanComplete).not.toHaveBeenCalled();
      expect(harness.onRuntimeChanged).not.toHaveBeenCalled();
      expect(harness.context.samples[0].scanned).toBe(false);
    });

    it('no-ops when the context is unknown', () => {
      const harness = createHarness({ samples: [makeSample()] });

      const result = harness.controller.completeScanInContext('unknown-context', 'sample-1');

      expect(result).toBeNull();
      expect(harness.persistScanComplete).not.toHaveBeenCalled();
    });
  });

  describe('gated iron scan control', () => {
    it('selects the genuinely Iron asteroid when no sample is requested', () => {
      const harness = createHarness({
        samples: [
          makeSample({ id: 'copper-1', revealedMaterial: { material: 'Copper' } }),
          makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } }),
        ],
      });

      harness.controller.forceCompleteIronScan();

      expect(harness.context.samples.find((sample) => sample.id === 'iron-1')?.scanned).toBe(true);
      expect(harness.context.samples.find((sample) => sample.id === 'copper-1')?.scanned).toBe(false);
    });

    it('ignores a requested sample that is not Iron and scans the Iron asteroid instead', () => {
      const harness = createHarness({
        samples: [
          makeSample({ id: 'copper-1', revealedMaterial: { material: 'Copper' } }),
          makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } }),
        ],
      });

      harness.controller.forceCompleteIronScan('copper-1');

      expect(harness.context.samples.find((sample) => sample.id === 'iron-1')?.scanned).toBe(true);
      expect(harness.context.samples.find((sample) => sample.id === 'copper-1')?.scanned).toBe(false);
    });

    it('honors a requested sample that is genuinely Iron', () => {
      const harness = createHarness({
        samples: [
          makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } }),
          makeSample({ id: 'iron-2', revealedMaterial: { material: 'Iron' } }),
        ],
      });

      harness.controller.forceCompleteIronScan('iron-2');

      expect(harness.context.samples.find((sample) => sample.id === 'iron-2')?.scanned).toBe(true);
      expect(harness.context.samples.find((sample) => sample.id === 'iron-1')?.scanned).toBe(false);
    });

    it('throws a descriptive error when no Iron asteroid exists', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'copper-1', revealedMaterial: { material: 'Copper' } })],
      });

      expect(() => harness.controller.forceCompleteIronScan()).toThrowError(/requires an Iron asteroid/);
      expect(harness.persistScanComplete).not.toHaveBeenCalled();
      expect(harness.context.samples[0].scanned).toBe(false);
    });

    it('reports the inspected sample count in the failure message', () => {
      const harness = createHarness({
        samples: [
          makeSample({ id: 'copper-1', revealedMaterial: { material: 'Copper' } }),
          makeSample({ id: 'nickel-1', revealedMaterial: { material: 'Nickel' } }),
        ],
      });

      expect(() => harness.controller.forceCompleteIronScan()).toThrowError(/among 2 sample\(s\)/);
    });
  });

  describe('mission progression routing', () => {
    it('routes progression through the facade when the context has a persistable identity', () => {
      const advancedState = makeGateState({ identify_iron_asteroid: 'completed' });
      const harness = createHarness({
        samples: [makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } })],
      });
      harness.advanceScanThroughFacade.mockReturnValue(advancedState);

      const result = harness.controller.forceCompleteIronScan();

      expect(result).toBe(advancedState);
      expect(harness.ensureMissionGateState).toHaveBeenCalledTimes(1);
      expect(harness.advanceScanThroughFacade).toHaveBeenCalledTimes(1);
      const [transitionContext, sample] = harness.advanceScanThroughFacade.mock.calls[0];
      expect(transitionContext).toMatchObject({ characterId: CHARACTER_ID, shipId: 'ship-1', sessionKey: 'session-1' });
      expect(sample).toMatchObject({ id: 'iron-1', scanned: true });
    });

    it('falls back to in-memory canonical evaluation when the context has no persistable identity', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } })],
        gateState: makeGateState({ identify_iron_asteroid: 'active' }),
        identity: false,
      });

      const result = harness.controller.forceCompleteIronScan();

      expect(harness.advanceScanThroughFacade).not.toHaveBeenCalled();
      expect(result?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
      expect(harness.context.gateState?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe(
        'completed',
      );
      expect(harness.onMissionChanged).toHaveBeenCalledTimes(1);
    });

    it('falls back to in-memory evaluation when the facade reports no persisted state', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } })],
        gateState: makeGateState({ identify_iron_asteroid: 'active' }),
      });
      harness.advanceScanThroughFacade.mockReturnValue(null);

      const result = harness.controller.forceCompleteIronScan();

      expect(harness.advanceScanThroughFacade).toHaveBeenCalledTimes(1);
      expect(result?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
    });

    it('does not publish a mission change for a non-qualifying scan in the fallback path', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'copper-1', revealedMaterial: { material: 'Copper' } })],
        gateState: makeGateState({ identify_iron_asteroid: 'active' }),
        identity: false,
      });

      const result = harness.controller.completeScanInContext(CONTEXT_KEY, 'copper-1');

      expect(result?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
      expect(harness.onMissionChanged).not.toHaveBeenCalled();
    });

    it('returns null when no gate state is available in the fallback path', () => {
      const harness = createHarness({
        samples: [makeSample({ id: 'iron-1', revealedMaterial: { material: 'Iron' } })],
        gateState: null,
        identity: false,
      });

      const result = harness.controller.forceCompleteIronScan();

      expect(result).toBeNull();
      expect(harness.onMissionChanged).not.toHaveBeenCalled();
      expect(harness.persistScanComplete).toHaveBeenCalledTimes(1);
    });
  });
});
