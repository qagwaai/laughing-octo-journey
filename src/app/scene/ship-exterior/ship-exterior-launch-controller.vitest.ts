import { describe, expect, it, vi } from 'vitest';
import { ShipExteriorLaunchController } from './ship-exterior-launch-controller';
import type { ShipExteriorMissionDefinition, ShipExteriorMissionGateStepDefinition } from '../../mission/ship-exterior-mission';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { LaunchItemResponse } from '../../model/launch-item';

function createMissionDefinition(): ShipExteriorMissionDefinition {
  const steps: readonly ShipExteriorMissionGateStepDefinition[] = [];
  return {
    missionId: 'first-target',
    canTargetAsteroids: () => true,
    resolveTargetingCapabilityFromInventory: () => true,
    resolveLaunchItemResponse: () => ({
      removeAsteroidSampleIds: ['sample-1'],
      shouldRefreshAfterLaunch: false,
    }),
    createFallbackAsteroidSamples: () => [],
    createNewAsteroidSamplesAroundShip: () => [],
    createResumedAsteroidSamples: () => [],
    getGateStepDefinitions: () => steps,
    doesScanCompleteGateStep: () => false,
    doesLaunchCompleteGateStep: () => false,
    resolveMissionStatusFromGateState: () => 'active',
  };
}

function createGateState(): ShipExteriorMissionGateState {
  return {
    missionId: 'first-target',
    characterId: 'character-1',
    activeObjectiveText: 'Launch the probe.',
    updatedAt: '2026-08-07T00:00:00.000Z',
    steps: [],
  };
}

describe('ShipExteriorLaunchController', () => {
  it('applies launch side effects for a destroyed iron target', () => {
    const removeAsteroidSamples = vi.fn();
    const consumeLaunchedItem = vi.fn();
    const applyMaterialRewards = vi.fn();
    const applyYieldedItems = vi.fn();
    const setMissionGateState = vi.fn();
    const persistMissionGateState = vi.fn();
    const enqueueMissionProgressUpsert = vi.fn();
    const queuePostLaunchRefresh = vi.fn();
    const setLaunchToast = vi.fn();
    const invokePluginHook = vi.fn();
    const setLaunchSeedHint = vi.fn();

    const controller = new ShipExteriorLaunchController({
      missionDefinition: createMissionDefinition(),
      getAsteroidSamples: () => [
        {
          id: 'sample-1',
          serverCelestialBodyId: 'body-1',
          revealedMaterial: { material: 'Iron' },
        },
      ],
      getMissionGateState: () => createGateState(),
      setMissionGateState,
      persistMissionGateState,
      enqueueMissionProgressUpsert,
      removeAsteroidSamples,
      consumeLaunchedItem,
      applyMaterialRewards,
      applyYieldedItems,
      queuePostLaunchRefresh,
      setLaunchToast,
      invokePluginHook,
      setLaunchSeedHint,
    });

    const response: LaunchItemResponse = {
      success: true,
      message: 'Launch complete',
      playerName: 'player-1',
      correlationId: 'corr-1',
      requestIdentity: {
        operation: 'launch',
        entityType: 'probe',
        containerId: 'ship-1',
        itemId: 'item-1',
        hotkey: 1,
        targetCelestialBodyId: 'body-1',
        characterId: 'character-1',
      },
      characterId: 'character-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'body-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'probe',
      launchedItem: {
        id: 'item-1',
        state: 'contained',
        container: null,
        launchable: true,
      },
      resolution: {
        outcome: 'target-destroyed',
        targetDestroyed: true,
        yieldedMaterials: [],
        yieldedItems: [],
        launchSeed: 42,
      },
    };

    controller.handleLaunchItemResponse(response);

    expect(setLaunchSeedHint).toHaveBeenCalledWith(42);
    expect(removeAsteroidSamples).toHaveBeenCalledWith(['sample-1']);
    expect(consumeLaunchedItem).toHaveBeenCalledWith(response);
    expect(applyMaterialRewards).toHaveBeenCalledWith([
      {
        material: 'Iron',
        rarity: 'Common',
        quantity: 1,
      },
    ]);
    expect(applyYieldedItems).not.toHaveBeenCalled();
    expect(setLaunchToast).toHaveBeenCalledWith(
      'Launch complete — Iron ×1',
      'success',
      42,
    );
    expect(queuePostLaunchRefresh).not.toHaveBeenCalled();
    expect(enqueueMissionProgressUpsert).not.toHaveBeenCalled();
    expect(invokePluginHook).not.toHaveBeenCalled();
    expect(setMissionGateState).not.toHaveBeenCalled();
    expect(persistMissionGateState).not.toHaveBeenCalled();
  });

  it('applies yielded items from launch resolution', () => {
    const applyYieldedItems = vi.fn();
    const setLaunchToast = vi.fn();

    const controller = new ShipExteriorLaunchController({
      missionDefinition: createMissionDefinition(),
      getAsteroidSamples: () => [],
      getMissionGateState: () => null,
      setMissionGateState: vi.fn(),
      persistMissionGateState: vi.fn(),
      enqueueMissionProgressUpsert: vi.fn(),
      removeAsteroidSamples: vi.fn(),
      consumeLaunchedItem: vi.fn(),
      applyMaterialRewards: vi.fn(),
      applyYieldedItems,
      queuePostLaunchRefresh: vi.fn(),
      setLaunchToast,
      invokePluginHook: vi.fn(),
      setLaunchSeedHint: vi.fn(),
    });

    controller.handleLaunchItemResponse({
      success: true,
      message: 'Target destroyed',
      playerName: 'player-1',
      correlationId: 'corr-2',
      requestIdentity: {
        operation: 'launch-item',
        entityType: 'item',
        containerId: 'ship-1',
        itemId: 'item-1',
        hotkey: 1,
        targetCelestialBodyId: 'body-1',
        characterId: 'character-1',
      },
      characterId: 'character-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'body-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'expendable-dart-drone',
      resolution: {
        outcome: 'target-destroyed',
        targetDestroyed: true,
        yieldedMaterials: [],
        yieldedItems: [
          {
            id: 'loot-1',
            itemType: 'iron-fragment',
            displayName: 'Iron Fragment',
            quantity: 2,
            state: 'contained',
            container: { containerType: 'ship', containerId: 'ship-1' },
            launchable: false,
          },
        ],
        launchSeed: 7,
      },
    });

    expect(applyYieldedItems).toHaveBeenCalledWith([
      {
        id: 'loot-1',
        itemType: 'iron-fragment',
        displayName: 'Iron Fragment',
        quantity: 2,
        state: 'contained',
        container: { containerType: 'ship', containerId: 'ship-1' },
        launchable: false,
      },
    ]);
    expect(setLaunchToast).toHaveBeenCalledWith(
      'Target destroyed — Iron Fragment ×2',
      'success',
      7,
    );
  });

  it('chains launch gate progression when one launch satisfies consecutive steps', () => {
    const setMissionGateState = vi.fn();
    const persistMissionGateState = vi.fn();
    const enqueueMissionProgressUpsert = vi.fn();

    const controller = new ShipExteriorLaunchController({
      missionDefinition: {
        missionId: 'first-target',
        canTargetAsteroids: () => true,
        resolveTargetingCapabilityFromInventory: () => true,
        resolveLaunchItemResponse: () => ({ removeAsteroidSampleIds: [], shouldRefreshAfterLaunch: false }),
        createFallbackAsteroidSamples: () => [],
        createNewAsteroidSamplesAroundShip: () => [],
        createResumedAsteroidSamples: () => [],
        getGateStepDefinitions: () => [
          { key: 'identify_iron_asteroid', objectiveText: 'identify', completionToastMessage: 'identified' },
          {
            key: 'neutralize_identified_asteroid',
            objectiveText: 'neutralize',
            completionToastMessage: 'neutralized',
            prerequisiteStepKeys: ['identify_iron_asteroid'],
          },
          {
            key: 'manufacture_hull_patch_kit',
            objectiveText: 'manufacture',
            completionToastMessage: 'manufactured',
            prerequisiteStepKeys: ['neutralize_identified_asteroid'],
          },
        ],
        doesScanCompleteGateStep: () => false,
        doesLaunchCompleteGateStep: (stepKey: string) =>
          stepKey === 'identify_iron_asteroid' || stepKey === 'neutralize_identified_asteroid',
        doesManufactureCompleteGateStep: () => false,
        doesRepairCompleteGateStep: () => false,
        resolveMissionStatusFromGateState: () => 'active',
      },
      getAsteroidSamples: () => [],
      getMissionGateState: () => ({
        missionId: 'first-target',
        characterId: 'character-1',
        activeObjectiveText: 'identify',
        updatedAt: '2026-08-07T00:00:00.000Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'active' },
          { key: 'neutralize_identified_asteroid', status: 'locked' },
          { key: 'manufacture_hull_patch_kit', status: 'locked' },
        ],
      }),
      setMissionGateState,
      persistMissionGateState,
      enqueueMissionProgressUpsert,
      removeAsteroidSamples: vi.fn(),
      consumeLaunchedItem: vi.fn(),
      applyMaterialRewards: vi.fn(),
      applyYieldedItems: vi.fn(),
      queuePostLaunchRefresh: vi.fn(),
      setLaunchToast: vi.fn(),
      invokePluginHook: vi.fn(),
      setLaunchSeedHint: vi.fn(),
    });

    controller.handleLaunchItemResponse({
      success: true,
      message: 'Target neutralized',
      playerName: 'player-1',
      correlationId: 'corr-3',
      requestIdentity: {
        operation: 'launch-item',
        entityType: 'item',
        containerId: 'ship-1',
        itemId: 'item-1',
        hotkey: 1,
        targetCelestialBodyId: 'body-1',
        characterId: 'character-1',
      },
      characterId: 'character-1',
      shipId: 'ship-1',
      targetCelestialBodyId: 'body-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'expendable-dart-drone',
      resolution: {
        outcome: 'target-destroyed',
        targetDestroyed: true,
        yieldedMaterials: [],
        yieldedItems: [],
        launchSeed: 11,
      },
    });

    expect(setMissionGateState).toHaveBeenCalledTimes(1);
    const finalGateState = setMissionGateState.mock.calls[0][0];
    expect(finalGateState.steps.find((step: { key: string; status: string }) => step.key === 'identify_iron_asteroid')?.status).toBe(
      'completed',
    );
    expect(
      finalGateState.steps.find((step: { key: string; status: string }) => step.key === 'neutralize_identified_asteroid')
        ?.status,
    ).toBe('completed');
    expect(finalGateState.steps.find((step: { key: string; status: string }) => step.key === 'manufacture_hull_patch_kit')?.status).toBe(
      'active',
    );
    expect(persistMissionGateState).toHaveBeenCalledTimes(1);
    expect(enqueueMissionProgressUpsert).toHaveBeenCalledTimes(1);
  });
});
