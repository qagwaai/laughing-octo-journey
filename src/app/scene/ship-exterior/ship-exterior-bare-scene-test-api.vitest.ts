import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialMissionGateState } from '../../mission/ship-exterior-mission';
import {
  registerShipExteriorBareSceneTestApi,
  unregisterShipExteriorBareSceneTestApi,
  type ShipExteriorBareSceneTestApi,
} from './ship-exterior-bare-scene-test-api';

describe('ship exterior bare scene test api', () => {
  beforeEach(() => {
    unregisterShipExteriorBareSceneTestApi();
  });

  afterEach(() => {
    unregisterShipExteriorBareSceneTestApi();
  });

  it('exposes the mission reset hook on the formal test api', () => {
    const resetMissionGateState = vi.fn(() =>
      createInitialMissionGateState({
        missionId: 'first-target',
        characterId: 'char-1',
        steps: [],
        nowIso: '2026-08-10T00:00:00.000Z',
      }),
    );
    const api: ShipExteriorBareSceneTestApi = {
      contextKeys: { asReadonly: () => [] } as never,
      activeContextKey: { asReadonly: () => null } as never,
      activateContext: vi.fn(),
      snapshotActiveContext: vi.fn(),
      toggleFlightMode: vi.fn(),
      setFlightInvertY: vi.fn(),
      setFlightMouseSensitivityFromSliderValue: vi.fn(),
      getActiveRouteFeedCounts: vi.fn(),
      getMissionGateState: vi.fn(),
      resetMissionGateState,
      legacy: {
        getAsteroidSamples: vi.fn(),
        getScannableDebrisSamples: vi.fn(),
        getScannableShipSamples: vi.fn(),
        beginAsteroidTargetHold: vi.fn(),
        unhoverAsteroid: vi.fn(),
        getTargetHoldCandidateId: vi.fn(),
        getMissionGateState: vi.fn(),
        resetMissionGateState: vi.fn(),
        forceCompleteIronScan: vi.fn(),
        forceTargetAsteroid: vi.fn(),
        getTargetedAsteroidId: vi.fn(),
        getHoveredAsteroidId: vi.fn(),
        forceCompleteDebrisScan: vi.fn(),
        getHoveredScannableDebrisId: vi.fn(),
        forceCompleteShipScan: vi.fn(),
        getHoveredScannableShipId: vi.fn(),
        launchFromHotkey: vi.fn(),
        simulateManufacture: vi.fn(),
        simulateRepair: vi.fn(),
        getActiveShipInventoryItemTypes: vi.fn(),
        getActiveLaunchToast: vi.fn(),
      },
    };

    registerShipExteriorBareSceneTestApi(api);

    expect(window.__shipExteriorBareSceneTestUtils?.getMissionGateState).toBe(api.getMissionGateState);
    expect(window.__shipExteriorBareSceneTestUtils?.resetMissionGateState).toBe(resetMissionGateState);
    expect(window.__shipExteriorTestUtils?.resetMissionGateState).toBeDefined();
    expect(window.__shipExteriorTestUtils?.getScannableDebrisSamples).toBeDefined();
    expect(window.__shipExteriorTestUtils?.forceCompleteDebrisScan).toBeDefined();
    expect(window.__shipExteriorTestUtils?.getHoveredScannableDebrisId).toBeDefined();
    expect(window.__shipExteriorTestUtils?.getScannableShipSamples).toBeDefined();
    expect(window.__shipExteriorTestUtils?.forceCompleteShipScan).toBeDefined();
    expect(window.__shipExteriorTestUtils?.getHoveredScannableShipId).toBeDefined();
    expect(window.__shipExteriorTestUtils?.simulateManufacture).toBe(api.legacy.simulateManufacture);
    expect(window.__shipExteriorTestUtils?.simulateRepair).toBe(api.legacy.simulateRepair);
  });

  it('does not register globals when the adapter is disabled', () => {
    const api = {
      contextKeys: { asReadonly: () => [] } as never,
      activeContextKey: { asReadonly: () => null } as never,
      activateContext: vi.fn(),
      snapshotActiveContext: vi.fn(),
      toggleFlightMode: vi.fn(),
      setFlightInvertY: vi.fn(),
      setFlightMouseSensitivityFromSliderValue: vi.fn(),
      getActiveRouteFeedCounts: vi.fn(),
      getMissionGateState: vi.fn(),
      resetMissionGateState: vi.fn(),
      legacy: {} as never,
    } satisfies ShipExteriorBareSceneTestApi;

    registerShipExteriorBareSceneTestApi(api, false);

    expect(window.__shipExteriorBareSceneTestUtils).toBeUndefined();
    expect(window.__shipExteriorTestUtils).toBeUndefined();
  });

  it('removes both globals during adapter teardown', () => {
    const api = {
      contextKeys: { asReadonly: () => [] } as never,
      activeContextKey: { asReadonly: () => null } as never,
      activateContext: vi.fn(),
      snapshotActiveContext: vi.fn(),
      toggleFlightMode: vi.fn(),
      setFlightInvertY: vi.fn(),
      setFlightMouseSensitivityFromSliderValue: vi.fn(),
      getActiveRouteFeedCounts: vi.fn(),
      getMissionGateState: vi.fn(),
      resetMissionGateState: vi.fn(),
      legacy: {} as never,
    } satisfies ShipExteriorBareSceneTestApi;

    registerShipExteriorBareSceneTestApi(api);
    unregisterShipExteriorBareSceneTestApi();

    expect(window.__shipExteriorBareSceneTestUtils).toBeUndefined();
    expect(window.__shipExteriorTestUtils).toBeUndefined();
  });
});
