export interface ShipExteriorLaunchHotkeySlot {
  hotkey: 1 | 2 | 3 | 4 | 5;
  item: unknown | null;
  label: string;
  enabled: boolean;
  launching: boolean;
}

export interface ShipExteriorLaunchToast {
  message: string;
  tone: 'success' | 'error';
  seed: number | null;
}

export interface ShipExteriorObjectivePanelViewModel {
  shipConditionLine: string;
  missionObjectiveText: string;
}

export interface ShipExteriorPropertiesPanelViewModel {
  showPanel: boolean;
  showReveal: boolean;
  showAsteroidProperties: boolean;
  showDebrisProperties: boolean;
  showTractorBeamCapabilityDetails: boolean;
  panelTitle: string;
  asteroid: {
    materialText: string;
    rarityText: string;
    velocityText: string;
    spinText: string;
    massText: string;
    diameterText: string;
    locationText: string;
    clusterText: string;
    offsetText: string;
  };
  debris: {
    itemTypeText: string;
    nameText: string;
    positionText: string;
    distanceText: string;
    stateText: string;
    tractorBeamCapabilityText: string;
    tractorBeamTimingText: string;
  };
}

export interface ShipExteriorFlightPanelViewModel {
  enabled: boolean;
  pointerLocked: boolean;
  invertY: boolean;
  sensitivitySlider: number;
  statusLine: string;
  coordsLine: string;
  speedLine: string;
  controlLine: string;
  viewDirectionLine: string;
  movementVectorsLine: string;
  framePressureLine: string;
  qualityScalerLine: string;
}

export interface ShipExteriorDebugPanelViewModel {
  showAnyTag: boolean;
  showAsteroidTag: boolean;
  asteroidHeaderText: string;
  asteroidMaterialText: string;
  asteroidPbrText: string;
  asteroidDetailRuleText: string;
  asteroidTierText: string;
  asteroidSw13SeedText: string;
  asteroidSw13TierText: string;
  asteroidSw13GeneratorText: string;
  asteroidSw13BundleHashText: string;
  asteroidSw13ProfilePresetText: string;
  asteroidSw13SurfacesText: string;
  asteroidSw13ValidationText: string;
  asteroidSw13ParitySummaryText: string;
  debrisHeaderText: string;
  debrisDisplayNameText: string;
  debrisPositionText: string;
}

export interface ShipExteriorLaunchPanelViewModel {
  hotkeySlots: ReadonlyArray<ShipExteriorLaunchHotkeySlot>;
  launchInventoryDebugLine: string;
  launchIdentityDebugLine: string;
  socketCorrelationDebugLine: string;
  socketContractViolationCounterLine: string;
  showQuickTargetIronControl: boolean;
  activeLaunchToast: ShipExteriorLaunchToast | null;
}

export interface ShipExteriorViewFacadeSource {
  showPropertiesPanel(): boolean;
  showPropertiesPanelReveal(): boolean;
  propertiesPanelTitle(): string;
  propertiesMaterialText(): string;
  propertiesRarityText(): string;
  propertiesVelocityText(): string;
  propertiesSpinText(): string;
  propertiesMassText(): string;
  propertiesDiameterText(): string;
  propertiesLocationText(): string;
  propertiesClusterText(): string;
  propertiesOffsetText(): string;
  showAsteroidProperties(): boolean;
  showDebrisProperties(): boolean;
  debrisPropertiesItemTypeText(): string;
  debrisPropertiesNameText(): string;
  debrisPropertiesPositionText(): string;
  debrisPropertiesDistanceText(): string;
  debrisPropertiesStateText(): string;
  showTractorBeamCapabilityDetails(): boolean;
  tractorBeamCapabilityText(): string;
  tractorBeamTimingText(): string;

  shipConditionLine(): string;
  missionObjectiveText(): string;

  flightModeEnabled(): boolean;
  flightPointerLocked(): boolean;
  flightInvertY(): boolean;
  getFlightMouseSensitivitySliderValue(): number;
  flightStatusLine(): string;
  flightCoordsLine(): string;
  flightSpeedLine(): string;
  flightControlLine(): string;
  flightViewDirectionLine(): string;
  flightMovementVectorsLine(): string;
  framePressureLine(): string;
  qualityScalerLine(): string;

  launchHotkeySlots(): ReadonlyArray<ShipExteriorLaunchHotkeySlot>;
  launchInventoryDebugLine(): string;
  launchIdentityDebugLine(): string;
  socketCorrelationDebugLine(): string;
  socketContractViolationCounterLine(): string;
  showQuickTargetIronControl(): boolean;
  activeLaunchToast(): ShipExteriorLaunchToast | null;

  showAnyDebugTag(): boolean;
  showAsteroidDebugTag(): boolean;
  asteroidDebugHeaderText(): string;
  asteroidDebugMaterialText(): string;
  asteroidDebugPbrText(): string;
  asteroidDebugDetailRuleText(): string;
  asteroidDebugTierText(): string;
  asteroidDebugSw13SeedText(): string;
  asteroidDebugSw13TierText(): string;
  asteroidDebugSw13GeneratorText(): string;
  asteroidDebugSw13BundleHashText(): string;
  asteroidDebugSw13ProfilePresetText(): string;
  asteroidDebugSw13SurfacesText(): string;
  asteroidDebugSw13ValidationText(): string;
  asteroidSw13ParitySummaryText(): string;
  debrisDebugHeaderText(): string;
  debrisDebugDisplayNameText(): string;
  debrisDebugPositionText(): string;

  hidePropertiesPanel(): void;
  revealPropertiesPanel(): void;
  launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void;
  selectFirstScannedIronTargetForTest(): void;
  scanAllAsteroidsToHeroForTest(): void;
  toggleFlightMode(): void;
  setFlightInvertY(enabled: boolean): void;
  setFlightMouseSensitivityFromSliderValue(rawValue: number): void;
}

const DEFAULT_HOTKEY_SLOTS: ReadonlyArray<ShipExteriorLaunchHotkeySlot> = [
  { hotkey: 1, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 2, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 3, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 4, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 5, item: null, label: 'empty', enabled: false, launching: false },
];

const DEFAULT_OBJECTIVE_PANEL: ShipExteriorObjectivePanelViewModel = {
  shipConditionLine: 'SHIP CONDITION // UNKNOWN',
  missionObjectiveText: 'Objective unavailable.',
};

const DEFAULT_PROPERTIES_PANEL: ShipExteriorPropertiesPanelViewModel = {
  showPanel: false,
  showReveal: false,
  showAsteroidProperties: false,
  showDebrisProperties: false,
  showTractorBeamCapabilityDetails: false,
  panelTitle: 'ASTEROID // PROPERTIES',
  asteroid: {
    materialText: 'MATERIAL: UNKNOWN',
    rarityText: 'RARITY: UNKNOWN',
    velocityText: 'VEL: ---',
    spinText: 'SPIN: ---',
    massText: 'MASS: ---',
    diameterText: 'DIAM: ---',
    locationText: 'LOC(Mkm): ---',
    clusterText: 'CLUSTER(Mkm): ---',
    offsetText: 'OFFSET(km): ---',
  },
  debris: {
    itemTypeText: 'ITEM TYPE: UNKNOWN',
    nameText: 'NAME: UNKNOWN',
    positionText: 'POS KM: ---',
    distanceText: 'DIST KM: ---',
    stateText: 'STATE: ---',
    tractorBeamCapabilityText: 'TRACTOR EQ: UNAVAILABLE',
    tractorBeamTimingText: 'TRACTOR PULL: ---',
  },
};

const DEFAULT_FLIGHT_PANEL: ShipExteriorFlightPanelViewModel = {
  enabled: false,
  pointerLocked: false,
  invertY: false,
  sensitivitySlider: 23,
  statusLine: 'FLIGHT // OFF',
  coordsLine: 'COORD KM // ---',
  speedLine: 'SPD // 0 km/s',
  controlLine: 'W/S FWD-BACK | A/D STRAFE | SPACE/CTRL VERT | Q/E ROLL',
  viewDirectionLine: 'VIEW // YAW 0.0° PITCH 0.0° ROLL 0.0°',
  movementVectorsLine: 'MOVE // FWD(0.00,0.00,-1.00) RIGHT(1.00,0.00,0.00) UP(0.00,1.00,0.00)',
  framePressureLine: 'FRAME PRESSURE // 0.00 ms',
  qualityScalerLine: 'QUALITY SCALER // 100%',
};

const DEFAULT_DEBUG_PANEL: ShipExteriorDebugPanelViewModel = {
  showAnyTag: false,
  showAsteroidTag: false,
  asteroidHeaderText: 'ASTEROID DEBUG // NO SAMPLE',
  asteroidMaterialText: 'MAT // ---',
  asteroidPbrText: 'PBR // ---',
  asteroidDetailRuleText: 'DETAIL // ---',
  asteroidTierText: 'TIER // ---',
  asteroidSw13SeedText: 'SW13 SEED // ---',
  asteroidSw13TierText: 'SW13 TIER // ---',
  asteroidSw13GeneratorText: 'SW13 GEN // ---',
  asteroidSw13BundleHashText: 'SW13 BUNDLE // ---',
  asteroidSw13ProfilePresetText: 'SW13 PROFILE // ---',
  asteroidSw13SurfacesText: 'SW13 SURFACES // ---',
  asteroidSw13ValidationText: 'SW13 VALIDATION // ---',
  asteroidSw13ParitySummaryText: 'SW13 PARITY // TOTAL 0 // B 0 H 0 // SV 0 SEV 0 // META 0/0',
  debrisHeaderText: 'DEBRIS DEBUG // NO SAMPLE',
  debrisDisplayNameText: 'NAME // ---',
  debrisPositionText: 'POS KM // ---',
};

const DEFAULT_LAUNCH_PANEL: ShipExteriorLaunchPanelViewModel = {
  hotkeySlots: DEFAULT_HOTKEY_SLOTS,
  launchInventoryDebugLine: '',
  launchIdentityDebugLine: '',
  socketCorrelationDebugLine: '',
  socketContractViolationCounterLine: '',
  showQuickTargetIronControl: false,
  activeLaunchToast: null,
};

export interface ShipExteriorViewFacade {
  objectivePanel(): ShipExteriorObjectivePanelViewModel;
  propertiesPanel(): ShipExteriorPropertiesPanelViewModel;
  flightPanel(): ShipExteriorFlightPanelViewModel;
  launchPanel(): ShipExteriorLaunchPanelViewModel;
  debugPanel(): ShipExteriorDebugPanelViewModel;
  commands: {
    hidePropertiesPanel(): void;
    revealPropertiesPanel(): void;
    launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void;
    quickTargetIronAsteroidForTest(): void;
    scanAllAsteroidsToHeroForTest(): void;
    toggleFlightMode(): void;
    setFlightInvertY(enabled: boolean): void;
    setFlightMouseSensitivityFromSliderValue(rawValue: number): void;
  };
}

export function createShipExteriorViewFacade(
  sourceAccessor: () => ShipExteriorViewFacadeSource | undefined,
): ShipExteriorViewFacade {
  const withSource = (action: (source: ShipExteriorViewFacadeSource) => void): void => {
    const source = sourceAccessor();
    if (!source) {
      return;
    }

    action(source);
  };

  return {
    objectivePanel: () => {
      const source = sourceAccessor();
      if (!source) {
        return DEFAULT_OBJECTIVE_PANEL;
      }

      return {
        shipConditionLine: source.shipConditionLine(),
        missionObjectiveText: source.missionObjectiveText(),
      };
    },
    propertiesPanel: () => {
      const source = sourceAccessor();
      if (!source) {
        return DEFAULT_PROPERTIES_PANEL;
      }

      return {
        showPanel: source.showPropertiesPanel(),
        showReveal: source.showPropertiesPanelReveal(),
        showAsteroidProperties: source.showAsteroidProperties(),
        showDebrisProperties: source.showDebrisProperties(),
        showTractorBeamCapabilityDetails: source.showTractorBeamCapabilityDetails(),
        panelTitle: source.propertiesPanelTitle(),
        asteroid: {
          materialText: source.propertiesMaterialText(),
          rarityText: source.propertiesRarityText(),
          velocityText: source.propertiesVelocityText(),
          spinText: source.propertiesSpinText(),
          massText: source.propertiesMassText(),
          diameterText: source.propertiesDiameterText(),
          locationText: source.propertiesLocationText(),
          clusterText: source.propertiesClusterText(),
          offsetText: source.propertiesOffsetText(),
        },
        debris: {
          itemTypeText: source.debrisPropertiesItemTypeText(),
          nameText: source.debrisPropertiesNameText(),
          positionText: source.debrisPropertiesPositionText(),
          distanceText: source.debrisPropertiesDistanceText(),
          stateText: source.debrisPropertiesStateText(),
          tractorBeamCapabilityText: source.tractorBeamCapabilityText(),
          tractorBeamTimingText: source.tractorBeamTimingText(),
        },
      };
    },
    flightPanel: () => {
      const source = sourceAccessor();
      if (!source) {
        return DEFAULT_FLIGHT_PANEL;
      }

      return {
        enabled: source.flightModeEnabled(),
        pointerLocked: source.flightPointerLocked(),
        invertY: source.flightInvertY(),
        sensitivitySlider: source.getFlightMouseSensitivitySliderValue(),
        statusLine: source.flightStatusLine(),
        coordsLine: source.flightCoordsLine(),
        speedLine: source.flightSpeedLine(),
        controlLine: source.flightControlLine(),
        viewDirectionLine: source.flightViewDirectionLine(),
        movementVectorsLine: source.flightMovementVectorsLine(),
        framePressureLine: source.framePressureLine(),
        qualityScalerLine: source.qualityScalerLine(),
      };
    },
    launchPanel: () => {
      const source = sourceAccessor();
      if (!source) {
        return DEFAULT_LAUNCH_PANEL;
      }

      return {
        hotkeySlots: source.launchHotkeySlots(),
        launchInventoryDebugLine: source.launchInventoryDebugLine(),
        launchIdentityDebugLine: source.launchIdentityDebugLine(),
        socketCorrelationDebugLine: source.socketCorrelationDebugLine(),
        socketContractViolationCounterLine: source.socketContractViolationCounterLine(),
        showQuickTargetIronControl: source.showQuickTargetIronControl(),
        activeLaunchToast: source.activeLaunchToast(),
      };
    },
    debugPanel: () => {
      const source = sourceAccessor();
      if (!source) {
        return DEFAULT_DEBUG_PANEL;
      }

      return {
        showAnyTag: source.showAnyDebugTag(),
        showAsteroidTag: source.showAsteroidDebugTag(),
        asteroidHeaderText: source.asteroidDebugHeaderText(),
        asteroidMaterialText: source.asteroidDebugMaterialText(),
        asteroidPbrText: source.asteroidDebugPbrText(),
        asteroidDetailRuleText: source.asteroidDebugDetailRuleText(),
        asteroidTierText: source.asteroidDebugTierText(),
        asteroidSw13SeedText: source.asteroidDebugSw13SeedText(),
        asteroidSw13TierText: source.asteroidDebugSw13TierText(),
        asteroidSw13GeneratorText: source.asteroidDebugSw13GeneratorText(),
        asteroidSw13BundleHashText: source.asteroidDebugSw13BundleHashText(),
        asteroidSw13ProfilePresetText: source.asteroidDebugSw13ProfilePresetText(),
        asteroidSw13SurfacesText: source.asteroidDebugSw13SurfacesText(),
        asteroidSw13ValidationText: source.asteroidDebugSw13ValidationText(),
        asteroidSw13ParitySummaryText: source.asteroidSw13ParitySummaryText(),
        debrisHeaderText: source.debrisDebugHeaderText(),
        debrisDisplayNameText: source.debrisDebugDisplayNameText(),
        debrisPositionText: source.debrisDebugPositionText(),
      };
    },
    commands: {
      hidePropertiesPanel: () => withSource((source) => source.hidePropertiesPanel()),
      revealPropertiesPanel: () => withSource((source) => source.revealPropertiesPanel()),
      launchFromHotkeySlot: (hotkey) => withSource((source) => source.launchFromHotkeySlot(hotkey)),
      quickTargetIronAsteroidForTest: () => withSource((source) => source.selectFirstScannedIronTargetForTest()),
      scanAllAsteroidsToHeroForTest: () => withSource((source) => source.scanAllAsteroidsToHeroForTest()),
      toggleFlightMode: () => withSource((source) => source.toggleFlightMode()),
      setFlightInvertY: (enabled) => withSource((source) => source.setFlightInvertY(enabled)),
      setFlightMouseSensitivityFromSliderValue: (rawValue) =>
        withSource((source) => source.setFlightMouseSensitivityFromSliderValue(rawValue)),
    },
  };
}
