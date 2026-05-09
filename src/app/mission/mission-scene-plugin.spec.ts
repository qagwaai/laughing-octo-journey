import {
  DEFAULT_MISSION_SCENE_HUD_CONFIG,
  createDefaultSeedPolicy,
  createMissionScenePlugin,
  registerMissionScenePlugin,
  resolveMissionScenePlugin,
} from './mission-scene-plugin';
import { resolveShipExteriorMission } from './ship-exterior-mission';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';

describe('MissionScenePlugin', () => {
  it('builds a default plugin from a mission definition', () => {
    const definition = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
    const plugin = createMissionScenePlugin(definition);

    expect(plugin.missionId).toBe(FIRST_TARGET_MISSION_ID);
    expect(plugin.definition).toBe(definition);
    expect(plugin.hudConfig).toEqual(DEFAULT_MISSION_SCENE_HUD_CONFIG);
    expect(plugin.hooks).toEqual({});
    expect(typeof plugin.seedPolicy.createFallbackSamples).toBe('function');
    expect(typeof plugin.seedPolicy.createNewSamples).toBe('function');
    expect(typeof plugin.seedPolicy.createResumedSamples).toBe('function');
  });

  it('default seed policy delegates to the mission definition', () => {
    const fallback = [{ id: 'sample-1' }] as never;
    const definition = {
      missionId: 'unit-test',
      createFallbackAsteroidSamples: jasmine.createSpy('fallback').and.returnValue(fallback),
      createNewAsteroidSamplesAroundShip: jasmine.createSpy('new').and.returnValue(fallback),
      createResumedAsteroidSamples: jasmine.createSpy('resumed').and.returnValue(fallback),
    } as never;
    const seedPolicy = createDefaultSeedPolicy(definition);

    expect(seedPolicy.createFallbackSamples()).toBe(fallback);
    expect(
      seedPolicy.createNewSamples({
        playerName: 'p',
        characterId: 'c',
        center: { x: 0, y: 0, z: 0 },
      }),
    ).toBe(fallback);
    expect(
      seedPolicy.createResumedSamples({
        playerName: 'p',
        characterId: 'c',
        center: { x: 0, y: 0, z: 0 },
        existingBodies: [],
      }),
    ).toBe(fallback);
  });

  it('applies hud and hook overrides', () => {
    const definition = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
    const onScan = jasmine.createSpy('onScan');
    const plugin = createMissionScenePlugin(definition, {
      hudConfig: { showRepairBay: false, objectiveBannerOverride: 'Custom' },
      hooks: { onScan },
    });

    expect(plugin.hudConfig.showRepairBay).toBeFalse();
    expect(plugin.hudConfig.showFabricationLab).toBeTrue();
    expect(plugin.hudConfig.objectiveBannerOverride).toBe('Custom');
    expect(plugin.hooks.onScan).toBe(onScan);
  });

  it('resolveMissionScenePlugin returns a default plugin when no factory is registered', () => {
    const plugin = resolveMissionScenePlugin(FIRST_TARGET_MISSION_ID);
    expect(plugin.missionId).toBe(FIRST_TARGET_MISSION_ID);
    expect(plugin.hudConfig).toEqual(DEFAULT_MISSION_SCENE_HUD_CONFIG);
  });

  it('resolveMissionScenePlugin uses a registered factory when present', () => {
    const customMissionId = 'unit-test-mission-' + Math.random();
    const factory = jasmine
      .createSpy('factory')
      .and.callFake((def) =>
        createMissionScenePlugin(def, { hudConfig: { showLaunchPanel: false } }),
      );
    registerMissionScenePlugin(customMissionId, factory);

    // Unknown mission ids fall back to the default mission, so the factory
    // is keyed on the *resolved* definition's id. Use the default mission id
    // path: register against the default mission and verify the override is
    // applied.
    const defaultId = resolveShipExteriorMission(undefined).missionId;
    const overrideFactory = jasmine
      .createSpy('default-factory')
      .and.callFake((def) =>
        createMissionScenePlugin(def, { hudConfig: { showScanPanel: false } }),
      );
    registerMissionScenePlugin(defaultId, overrideFactory);

    const plugin = resolveMissionScenePlugin(defaultId);
    expect(overrideFactory).toHaveBeenCalled();
    expect(plugin.hudConfig.showScanPanel).toBeFalse();

    // Cleanup: re-register a no-op default to avoid bleeding into other tests.
    registerMissionScenePlugin(defaultId, (def) => createMissionScenePlugin(def));
  });
});
