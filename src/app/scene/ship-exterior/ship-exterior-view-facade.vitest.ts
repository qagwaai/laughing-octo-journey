import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createShipExteriorViewFacade,
  type ShipExteriorViewFacadeSource,
  type ShipExteriorLaunchHotkeySlot,
} from './ship-exterior-view-facade';

describe('ShipExteriorViewFacade', () => {
  it('returns stable defaults when source is unavailable', () => {
    const facade = createShipExteriorViewFacade(() => undefined);

    expect(facade.objectivePanel()).toEqual({
      shipConditionLine: 'SHIP CONDITION // UNKNOWN',
      missionObjectiveText: 'Objective unavailable.',
    });

    expect(facade.propertiesPanel()).toEqual(
      expect.objectContaining({
        showPanel: false,
        showReveal: false,
        panelTitle: 'ASTEROID // PROPERTIES',
      }),
    );

    expect(facade.flightPanel()).toEqual(
      expect.objectContaining({
        enabled: false,
        statusLine: 'FLIGHT // OFF',
      }),
    );

    expect(facade.launchPanel()).toEqual(
      expect.objectContaining({
        hotkeySlots: expect.any(Array),
        showQuickTargetIronControl: false,
      }),
    );

    expect(facade.debugPanel()).toEqual(
      expect.objectContaining({
        showAnyTag: false,
        asteroidHeaderText: 'ASTEROID DEBUG // NO SAMPLE',
      }),
    );
  });

  it('maps values from the source without mutating them', () => {
    const source = createSourceMock();
    const facade = createShipExteriorViewFacade(() => source);

    const objective = facade.objectivePanel();
    expect(objective.shipConditionLine).toBe('SHIP CONDITION // READY');
    expect(objective.missionObjectiveText).toBe('Destroy target.');

    const properties = facade.propertiesPanel();
    expect(properties.showPanel).toBe(true);
    expect(properties.panelTitle).toBe('ASTEROID A1 // PROPERTIES');
    expect(properties.asteroid.materialText).toBe('MATERIAL: IRON');
    expect(properties.debris.itemTypeText).toBe('ITEM TYPE: SHIP-TRACTOR-BEAM');

    const flight = facade.flightPanel();
    expect(flight.enabled).toBe(true);
    expect(flight.sensitivitySlider).toBe(41);
    expect(flight.framePressureLine).toBe('FRAME PRESSURE // 2.30 ms');

    const launch = facade.launchPanel();
    expect(launch.hotkeySlots).toEqual(source.launchHotkeySlots());
    expect(launch.activeLaunchToast).toEqual({ message: 'ok', tone: 'success', seed: 9 });

    const debug = facade.debugPanel();
    expect(debug.showAnyTag).toBe(true);
    expect(debug.showAsteroidTag).toBe(true);
    expect(debug.asteroidSw13TierText).toBe('SW13 TIER // H');
  });

  it('delegates command calls to the source', () => {
    const source = createSourceMock();
    const facade = createShipExteriorViewFacade(() => source);

    facade.commands.hidePropertiesPanel();
    facade.commands.revealPropertiesPanel();
    facade.commands.launchFromHotkeySlot(3);
    facade.commands.quickTargetIronAsteroidForTest();
    facade.commands.scanAllAsteroidsToHeroForTest();
    facade.commands.toggleFlightMode();
    facade.commands.setFlightInvertY(true);
    facade.commands.setFlightMouseSensitivityFromSliderValue(55);

    expect(source.hidePropertiesPanel).toHaveBeenCalledTimes(1);
    expect(source.revealPropertiesPanel).toHaveBeenCalledTimes(1);
    expect(source.launchFromHotkeySlot).toHaveBeenCalledTimes(1);
    expect(source.launchFromHotkeySlot).toHaveBeenCalledWith(3);
    expect(source.selectFirstScannedIronTargetForTest).toHaveBeenCalledTimes(1);
    expect(source.scanAllAsteroidsToHeroForTest).toHaveBeenCalledTimes(1);
    expect(source.toggleFlightMode).toHaveBeenCalledTimes(1);
    expect(source.setFlightInvertY).toHaveBeenCalledTimes(1);
    expect(source.setFlightInvertY).toHaveBeenCalledWith(true);
    expect(source.setFlightMouseSensitivityFromSliderValue).toHaveBeenCalledTimes(1);
    expect(source.setFlightMouseSensitivityFromSliderValue).toHaveBeenCalledWith(55);
  });

  it('keeps command methods as safe no-ops when source is unavailable', () => {
    const facade = createShipExteriorViewFacade(() => undefined);

    expect(() => {
      facade.commands.hidePropertiesPanel();
      facade.commands.revealPropertiesPanel();
      facade.commands.launchFromHotkeySlot(1);
      facade.commands.quickTargetIronAsteroidForTest();
      facade.commands.scanAllAsteroidsToHeroForTest();
      facade.commands.toggleFlightMode();
      facade.commands.setFlightInvertY(false);
      facade.commands.setFlightMouseSensitivityFromSliderValue(23);
    }).not.toThrow();
  });
});

function createSpyObj<T extends object>(methods: ReadonlyArray<Extract<keyof T, string>>) {
  return Object.fromEntries(methods.map((method) => [method, vi.fn()])) as {
    [K in Extract<keyof T, string>]: ReturnType<typeof vi.fn>;
  };
}

function createSourceMock(): ShipExteriorViewFacadeSource & Record<string, ReturnType<typeof vi.fn>> {
  const slots: ReadonlyArray<ShipExteriorLaunchHotkeySlot> = [
    { hotkey: 1, item: { id: 'slot-1' }, label: 'Alpha', enabled: true, launching: false },
    { hotkey: 2, item: null, label: 'empty', enabled: false, launching: false },
    { hotkey: 3, item: null, label: 'empty', enabled: false, launching: false },
    { hotkey: 4, item: null, label: 'empty', enabled: false, launching: false },
    { hotkey: 5, item: null, label: 'empty', enabled: false, launching: false },
  ];

  const source = createSpyObj<ShipExteriorViewFacadeSource>([
    'showPropertiesPanel',
    'showPropertiesPanelReveal',
    'propertiesPanelTitle',
    'propertiesMaterialText',
    'propertiesRarityText',
    'propertiesVelocityText',
    'propertiesSpinText',
    'propertiesMassText',
    'propertiesDiameterText',
    'propertiesLocationText',
    'propertiesClusterText',
    'propertiesOffsetText',
    'showAsteroidProperties',
    'showDebrisProperties',
    'debrisPropertiesItemTypeText',
    'debrisPropertiesNameText',
    'debrisPropertiesPositionText',
    'debrisPropertiesDistanceText',
    'debrisPropertiesStateText',
    'showTractorBeamCapabilityDetails',
    'tractorBeamCapabilityText',
    'tractorBeamTimingText',
    'shipConditionLine',
    'missionObjectiveText',
    'flightModeEnabled',
    'flightPointerLocked',
    'flightInvertY',
    'getFlightMouseSensitivitySliderValue',
    'flightStatusLine',
    'flightCoordsLine',
    'flightSpeedLine',
    'flightControlLine',
    'flightViewDirectionLine',
    'flightMovementVectorsLine',
    'framePressureLine',
    'qualityScalerLine',
    'launchHotkeySlots',
    'launchInventoryDebugLine',
    'launchIdentityDebugLine',
    'socketCorrelationDebugLine',
    'socketContractViolationCounterLine',
    'showQuickTargetIronControl',
    'activeLaunchToast',
    'showAnyDebugTag',
    'showAsteroidDebugTag',
    'asteroidDebugHeaderText',
    'asteroidDebugMaterialText',
    'asteroidDebugPbrText',
    'asteroidDebugDetailRuleText',
    'asteroidDebugTierText',
    'asteroidDebugSw13SeedText',
    'asteroidDebugSw13TierText',
    'asteroidDebugSw13GeneratorText',
    'asteroidDebugSw13BundleHashText',
    'asteroidDebugSw13ProfilePresetText',
    'asteroidDebugSw13SurfacesText',
    'asteroidDebugSw13ValidationText',
    'asteroidSw13ParitySummaryText',
    'debrisDebugHeaderText',
    'debrisDebugDisplayNameText',
    'debrisDebugPositionText',
    'hidePropertiesPanel',
    'revealPropertiesPanel',
    'launchFromHotkeySlot',
    'selectFirstScannedIronTargetForTest',
    'scanAllAsteroidsToHeroForTest',
    'toggleFlightMode',
    'setFlightInvertY',
    'setFlightMouseSensitivityFromSliderValue',
  ]);

  source.showPropertiesPanel.mockReturnValue(true);
  source.showPropertiesPanelReveal.mockReturnValue(false);
  source.propertiesPanelTitle.mockReturnValue('ASTEROID A1 // PROPERTIES');
  source.propertiesMaterialText.mockReturnValue('MATERIAL: IRON');
  source.propertiesRarityText.mockReturnValue('RARITY: COMMON');
  source.propertiesVelocityText.mockReturnValue('VEL: 1.2 km/s');
  source.propertiesSpinText.mockReturnValue('SPIN: 0.1 rad/s');
  source.propertiesMassText.mockReturnValue('MASS: 1000 kg');
  source.propertiesDiameterText.mockReturnValue('DIAM: 10 m');
  source.propertiesLocationText.mockReturnValue('LOC(Mkm): 410.0');
  source.propertiesClusterText.mockReturnValue('CLUSTER(Mkm): 0.3');
  source.propertiesOffsetText.mockReturnValue('OFFSET(km): 50');
  source.showAsteroidProperties.mockReturnValue(true);
  source.showDebrisProperties.mockReturnValue(false);
  source.debrisPropertiesItemTypeText.mockReturnValue('ITEM TYPE: SHIP-TRACTOR-BEAM');
  source.debrisPropertiesNameText.mockReturnValue('NAME: Tractor Beam');
  source.debrisPropertiesPositionText.mockReturnValue('POS KM: X 1 Y 2 Z 3');
  source.debrisPropertiesDistanceText.mockReturnValue('DIST KM: 3.7');
  source.debrisPropertiesStateText.mockReturnValue('STATE: DEPLOYED');
  source.showTractorBeamCapabilityDetails.mockReturnValue(true);
  source.tractorBeamCapabilityText.mockReturnValue('TRACTOR EQ: T20 // RANGE 25.0 KM');
  source.tractorBeamTimingText.mockReturnValue('TRACTOR PULL: 1200 MS');

  source.shipConditionLine.mockReturnValue('SHIP CONDITION // READY');
  source.missionObjectiveText.mockReturnValue('Destroy target.');

  source.flightModeEnabled.mockReturnValue(true);
  source.flightPointerLocked.mockReturnValue(true);
  source.flightInvertY.mockReturnValue(true);
  source.getFlightMouseSensitivitySliderValue.mockReturnValue(41);
  source.flightStatusLine.mockReturnValue('FLIGHT // ACTIVE');
  source.flightCoordsLine.mockReturnValue('COORD KM // X 1 Y 2 Z 3');
  source.flightSpeedLine.mockReturnValue('SPD // 12 km/s');
  source.flightControlLine.mockReturnValue('W/S FWD-BACK');
  source.flightViewDirectionLine.mockReturnValue('VIEW // YAW 2.0°');
  source.flightMovementVectorsLine.mockReturnValue('MOVE // FWD(0.00,0.00,-1.00)');
  source.framePressureLine.mockReturnValue('FRAME PRESSURE // 2.30 ms');
  source.qualityScalerLine.mockReturnValue('QUALITY SCALER // 98%');

  source.launchHotkeySlots.mockReturnValue(slots);
  source.launchInventoryDebugLine.mockReturnValue('LAUNCH DBG // ...');
  source.launchIdentityDebugLine.mockReturnValue('LAUNCH ID DBG // ...');
  source.socketCorrelationDebugLine.mockReturnValue('SOCKET DBG // ...');
  source.socketContractViolationCounterLine.mockReturnValue('CONTRACT VIOLATIONS // 0/min');
  source.showQuickTargetIronControl.mockReturnValue(true);
  source.activeLaunchToast.mockReturnValue({ message: 'ok', tone: 'success', seed: 9 });

  source.showAnyDebugTag.mockReturnValue(true);
  source.showAsteroidDebugTag.mockReturnValue(true);
  source.asteroidDebugHeaderText.mockReturnValue('ASTEROID DEBUG // SAMPLE-A1');
  source.asteroidDebugMaterialText.mockReturnValue('MAT // IRON COMMON');
  source.asteroidDebugPbrText.mockReturnValue('PBR // rough 0.60 metal 0.20');
  source.asteroidDebugDetailRuleText.mockReturnValue('DETAIL // post-scan mesh swap');
  source.asteroidDebugTierText.mockReturnValue('TIER // HERO');
  source.asteroidDebugSw13SeedText.mockReturnValue('SW13 SEED // sw13b-m0b-H-iron-001');
  source.asteroidDebugSw13TierText.mockReturnValue('SW13 TIER // H');
  source.asteroidDebugSw13GeneratorText.mockReturnValue('SW13 GEN // v1');
  source.asteroidDebugSw13BundleHashText.mockReturnValue('SW13 BUNDLE // sha256:abc123');
  source.asteroidDebugSw13ProfilePresetText.mockReturnValue('SW13 PROFILE // hero');
  source.asteroidDebugSw13SurfacesText.mockReturnValue('SW13 SURFACES // SV,SEV');
  source.asteroidDebugSw13ValidationText.mockReturnValue('SW13 VALIDATION // validated');
  source.asteroidSw13ParitySummaryText.mockReturnValue('SW13 PARITY // TOTAL 1 // B 0 H 1 // SV 1 SEV 1 // META 1/1');
  source.debrisDebugHeaderText.mockReturnValue('DEBRIS DEBUG // NO SAMPLE');
  source.debrisDebugDisplayNameText.mockReturnValue('NAME // ---');
  source.debrisDebugPositionText.mockReturnValue('POS KM // ---');

  return source as unknown as ShipExteriorViewFacadeSource & Record<string, ReturnType<typeof vi.fn>>;
}
