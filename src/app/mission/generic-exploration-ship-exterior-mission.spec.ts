import {
  GENERIC_EXPLORATION_MISSION_ID,
  GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION,
  __resetExplorationScanCountsForTest,
  createGenericExplorationInitialGateState,
  createGenericExplorationPlugin,
} from './generic-exploration-ship-exterior-mission';
import {
  evaluateMissionGateOnScan,
  resolveShipExteriorMission,
} from './ship-exterior-mission';
import { resolveMissionScenePlugin } from './mission-scene-plugin';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';

function makeSample(id: string): AsteroidScanSample {
  return {
    id,
    serverCelestialBodyId: null,
    position: [0, 0, 0],
    basePosition: [0, 0, 0],
    scanProgress: 100,
    scanned: true,
    revealedMaterial: null,
    revealedKinematics: null,
    solarSystemLocation: null,
    clusterCenterKm: { x: 0, y: 0, z: 0 },
    capturedKinematics: {
      velocityKmPerSec: { x: 0, y: 0, z: 0 },
      angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
      estimatedMassKg: 1,
      estimatedDiameterM: 1,
    },
    motionPhase: 0,
    motionRate: 0,
    motionRadius: 0,
    bobAmplitude: 0,
  } as unknown as AsteroidScanSample;
}

describe('GenericExplorationShipExteriorMission', () => {
  beforeEach(() => __resetExplorationScanCountsForTest());

  it('is registered with resolveShipExteriorMission', () => {
    expect(resolveShipExteriorMission(GENERIC_EXPLORATION_MISSION_ID)).toBe(
      GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION,
    );
  });

  it('exposes a single survey gate step', () => {
    const steps = GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION.getGateStepDefinitions();
    expect(steps.length).toBe(1);
    expect(steps[0].key).toBe('survey_asteroid_field');
  });

  it('disables targeting and launch capabilities', () => {
    expect(
      GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION.canTargetAsteroids({
        shipModel: 'Scavenger Pod',
        hasExpendableDartDrone: true,
      }),
    ).toBeFalse();
    expect(GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory([])).toBeFalse();
  });

  it('plugin hides repair/fabrication/launch panels', () => {
    const plugin = createGenericExplorationPlugin(GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION);
    expect(plugin.hudConfig.showRepairBay).toBeFalse();
    expect(plugin.hudConfig.showFabricationLab).toBeFalse();
    expect(plugin.hudConfig.showLaunchPanel).toBeFalse();
    expect(plugin.hudConfig.showScanPanel).toBeTrue();
  });

  it('resolveMissionScenePlugin returns the exploration plugin for the exploration id', () => {
    const plugin = resolveMissionScenePlugin(GENERIC_EXPLORATION_MISSION_ID);
    expect(plugin.missionId).toBe(GENERIC_EXPLORATION_MISSION_ID);
    expect(plugin.hudConfig.showFabricationLab).toBeFalse();
  });

  it('completes the survey step after three scan-hook invocations', () => {
    const plugin = resolveMissionScenePlugin(GENERIC_EXPLORATION_MISSION_ID);
    let gateState = createGenericExplorationInitialGateState('test-character');
    expect(gateState.steps[0].status).toBe('active');

    for (let i = 1; i <= 3; i++) {
      const sample = makeSample(`s-${i}`);
      // Simulate the scene's hook fire — must run *before* the gate evaluation.
      plugin.hooks.onScan?.({ sample, gateState });
      const result = evaluateMissionGateOnScan({
        mission: plugin.definition,
        gateState,
        sample,
      });
      gateState = result.gateState;
    }

    expect(gateState.steps[0].status).toBe('completed');
    expect(GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION.resolveMissionStatusFromGateState(gateState)).toBe(
      'completed',
    );
  });
});
