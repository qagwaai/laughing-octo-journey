import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialMissionGateState } from '../../mission/ship-exterior-mission';
import {
  createShipExteriorBareSceneTestApi,
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
        getActiveShipInventoryItemTypes: vi.fn(),
        getActiveLaunchToast: vi.fn(),
      },
    };

    registerShipExteriorBareSceneTestApi(api);

    expect(window.__shipExteriorBareSceneTestUtils?.getMissionGateState).toBe(api.getMissionGateState);
    expect(window.__shipExteriorBareSceneTestUtils?.resetMissionGateState).toBe(resetMissionGateState);
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.resetMissionGateState).toBeDefined();
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.getScannableDebrisSamples).toBeDefined();
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.forceCompleteDebrisScan).toBeDefined();
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.getHoveredScannableDebrisId).toBeDefined();
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.getScannableShipSamples).toBeDefined();
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.forceCompleteShipScan).toBeDefined();
    expect(window.__shipExteriorBareSceneTestUtils?.legacy.getHoveredScannableShipId).toBeDefined();
  });

  it('keeps formal and legacy callbacks separate until registration', () => {
    const formal = {
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
    } satisfies Omit<ShipExteriorBareSceneTestApi, 'legacy'>;
    const legacy = {
      getMissionGateState: vi.fn(),
      resetMissionGateState: vi.fn(),
    } as never;

    const api = createShipExteriorBareSceneTestApi({ formal, legacy });

    expect(api.contextKeys).toBe(formal.contextKeys);
    expect(api.legacy).toBe(legacy);
    expect(api.getMissionGateState).toBe(formal.getMissionGateState);
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
  });

  it('removes the adapter global during teardown', () => {
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
  });

  it('replaces a previously registered adapter during registration', () => {
    const firstApi = {
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
    const secondApi = { ...firstApi, getMissionGateState: vi.fn() } satisfies ShipExteriorBareSceneTestApi;

    registerShipExteriorBareSceneTestApi(firstApi);
    registerShipExteriorBareSceneTestApi(secondApi);

    expect(window.__shipExteriorBareSceneTestUtils).toBe(secondApi);
  });
});
