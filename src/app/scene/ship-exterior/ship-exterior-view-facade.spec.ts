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
      jasmine.objectContaining({
        showPanel: false,
        showReveal: false,
        panelTitle: 'ASTEROID // PROPERTIES',
      }),
    );

    expect(facade.flightPanel()).toEqual(
      jasmine.objectContaining({
        enabled: false,
        statusLine: 'FLIGHT // OFF',
      }),
    );

    expect(facade.launchPanel()).toEqual(
      jasmine.objectContaining({
        hotkeySlots: jasmine.any(Array),
        showQuickTargetIronControl: false,
      }),
    );

    expect(facade.debugPanel()).toEqual(
      jasmine.objectContaining({
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
    expect(properties.showPanel).toBeTrue();
    expect(properties.panelTitle).toBe('ASTEROID A1 // PROPERTIES');
    expect(properties.asteroid.materialText).toBe('MATERIAL: IRON');
    expect(properties.debris.itemTypeText).toBe('ITEM TYPE: SHIP-TRACTOR-BEAM');

    const flight = facade.flightPanel();
    expect(flight.enabled).toBeTrue();
    expect(flight.sensitivitySlider).toBe(41);
    expect(flight.framePressureLine).toBe('FRAME PRESSURE // 2.30 ms');

    const launch = facade.launchPanel();
    expect(launch.hotkeySlots).toEqual(source.launchHotkeySlots());
    expect(launch.activeLaunchToast).toEqual({ message: 'ok', tone: 'success', seed: 9 });

    const debug = facade.debugPanel();
    expect(debug.showAnyTag).toBeTrue();
    expect(debug.showAsteroidTag).toBeTrue();
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
    expect(source.launchFromHotkeySlot).toHaveBeenCalledOnceWith(3);
    expect(source.selectFirstScannedIronTargetForTest).toHaveBeenCalledTimes(1);
    expect(source.scanAllAsteroidsToHeroForTest).toHaveBeenCalledTimes(1);
    expect(source.toggleFlightMode).toHaveBeenCalledTimes(1);
    expect(source.setFlightInvertY).toHaveBeenCalledOnceWith(true);
    expect(source.setFlightMouseSensitivityFromSliderValue).toHaveBeenCalledOnceWith(55);
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

function createSourceMock(): jasmine.SpyObj<ShipExteriorViewFacadeSource> {
  const slots: ReadonlyArray<ShipExteriorLaunchHotkeySlot> = [
    { hotkey: 1, item: { id: 'slot-1' }, label: 'Alpha', enabled: true, launching: false },
    { hotkey: 2, item: null, label: 'empty', enabled: false, launching: false },
    { hotkey: 3, item: null, label: 'empty', enabled: false, launching: false },
    { hotkey: 4, item: null, label: 'empty', enabled: false, launching: false },
    { hotkey: 5, item: null, label: 'empty', enabled: false, launching: false },
  ];

  const source = jasmine.createSpyObj<ShipExteriorViewFacadeSource>('ShipExteriorViewFacadeSource', [
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

  source.showPropertiesPanel.and.returnValue(true);
  source.showPropertiesPanelReveal.and.returnValue(false);
  source.propertiesPanelTitle.and.returnValue('ASTEROID A1 // PROPERTIES');
  source.propertiesMaterialText.and.returnValue('MATERIAL: IRON');
  source.propertiesRarityText.and.returnValue('RARITY: COMMON');
  source.propertiesVelocityText.and.returnValue('VEL: 1.2 km/s');
  source.propertiesSpinText.and.returnValue('SPIN: 0.1 rad/s');
  source.propertiesMassText.and.returnValue('MASS: 1000 kg');
  source.propertiesDiameterText.and.returnValue('DIAM: 10 m');
  source.propertiesLocationText.and.returnValue('LOC(Mkm): 410.0');
  source.propertiesClusterText.and.returnValue('CLUSTER(Mkm): 0.3');
  source.propertiesOffsetText.and.returnValue('OFFSET(km): 50');
  source.showAsteroidProperties.and.returnValue(true);
  source.showDebrisProperties.and.returnValue(false);
  source.debrisPropertiesItemTypeText.and.returnValue('ITEM TYPE: SHIP-TRACTOR-BEAM');
  source.debrisPropertiesNameText.and.returnValue('NAME: Tractor Beam');
  source.debrisPropertiesPositionText.and.returnValue('POS KM: X 1 Y 2 Z 3');
  source.debrisPropertiesDistanceText.and.returnValue('DIST KM: 3.7');
  source.debrisPropertiesStateText.and.returnValue('STATE: DEPLOYED');
  source.showTractorBeamCapabilityDetails.and.returnValue(true);
  source.tractorBeamCapabilityText.and.returnValue('TRACTOR EQ: T20 // RANGE 25.0 KM');
  source.tractorBeamTimingText.and.returnValue('TRACTOR PULL: 1200 MS');

  source.shipConditionLine.and.returnValue('SHIP CONDITION // READY');
  source.missionObjectiveText.and.returnValue('Destroy target.');

  source.flightModeEnabled.and.returnValue(true);
  source.flightPointerLocked.and.returnValue(true);
  source.flightInvertY.and.returnValue(true);
  source.getFlightMouseSensitivitySliderValue.and.returnValue(41);
  source.flightStatusLine.and.returnValue('FLIGHT // ACTIVE');
  source.flightCoordsLine.and.returnValue('COORD KM // X 1 Y 2 Z 3');
  source.flightSpeedLine.and.returnValue('SPD // 12 km/s');
  source.flightControlLine.and.returnValue('W/S FWD-BACK');
  source.flightViewDirectionLine.and.returnValue('VIEW // YAW 2.0°');
  source.flightMovementVectorsLine.and.returnValue('MOVE // FWD(0.00,0.00,-1.00)');
  source.framePressureLine.and.returnValue('FRAME PRESSURE // 2.30 ms');
  source.qualityScalerLine.and.returnValue('QUALITY SCALER // 98%');

  source.launchHotkeySlots.and.returnValue(slots);
  source.launchInventoryDebugLine.and.returnValue('LAUNCH DBG // ...');
  source.launchIdentityDebugLine.and.returnValue('LAUNCH ID DBG // ...');
  source.socketCorrelationDebugLine.and.returnValue('SOCKET DBG // ...');
  source.socketContractViolationCounterLine.and.returnValue('CONTRACT VIOLATIONS // 0/min');
  source.showQuickTargetIronControl.and.returnValue(true);
  source.activeLaunchToast.and.returnValue({ message: 'ok', tone: 'success', seed: 9 });

  source.showAnyDebugTag.and.returnValue(true);
  source.showAsteroidDebugTag.and.returnValue(true);
  source.asteroidDebugHeaderText.and.returnValue('ASTEROID DEBUG // SAMPLE-A1');
  source.asteroidDebugMaterialText.and.returnValue('MAT // IRON COMMON');
  source.asteroidDebugPbrText.and.returnValue('PBR // rough 0.60 metal 0.20');
  source.asteroidDebugDetailRuleText.and.returnValue('DETAIL // post-scan mesh swap');
  source.asteroidDebugTierText.and.returnValue('TIER // HERO');
  source.asteroidDebugSw13SeedText.and.returnValue('SW13 SEED // sw13b-m0b-H-iron-001');
  source.asteroidDebugSw13TierText.and.returnValue('SW13 TIER // H');
  source.asteroidDebugSw13GeneratorText.and.returnValue('SW13 GEN // v1');
  source.asteroidDebugSw13BundleHashText.and.returnValue('SW13 BUNDLE // sha256:abc123');
  source.asteroidDebugSw13ProfilePresetText.and.returnValue('SW13 PROFILE // hero');
  source.asteroidDebugSw13SurfacesText.and.returnValue('SW13 SURFACES // SV,SEV');
  source.asteroidDebugSw13ValidationText.and.returnValue('SW13 VALIDATION // validated');
  source.asteroidSw13ParitySummaryText.and.returnValue('SW13 PARITY // TOTAL 1 // B 0 H 1 // SV 1 SEV 1 // META 1/1');
  source.debrisDebugHeaderText.and.returnValue('DEBRIS DEBUG // NO SAMPLE');
  source.debrisDebugDisplayNameText.and.returnValue('NAME // ---');
  source.debrisDebugPositionText.and.returnValue('POS KM // ---');

  return source;
}
