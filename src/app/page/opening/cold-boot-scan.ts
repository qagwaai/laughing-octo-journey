import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { NgtsStats } from 'angular-three-soba/stats';
import ShipExteriorViewScene from '../../scene/ship-exterior-view';
import { RenderStatsService } from '../../services/render-stats.service';

const DEFAULT_HOTKEY_SLOTS: ReadonlyArray<{
  hotkey: 1 | 2 | 3 | 4 | 5;
  item: null;
  label: string;
  enabled: boolean;
  launching: boolean;
}> = [
  { hotkey: 1, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 2, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 3, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 4, item: null, label: 'empty', enabled: false, launching: false },
  { hotkey: 5, item: null, label: 'empty', enabled: false, launching: false },
];

@Component({
  selector: 'app-cold-boot-scan-page',
  templateUrl: './cold-boot-scan.html',
  styleUrls: ['./cold-boot-scan.css'],
  imports: [NgtCanvas, NgtsStats, ShipExteriorViewScene],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Host page for ship-exterior scan scene, exposing scene state to template bindings.
 */
export default class ColdBootScanPage {
  protected host = inject(ElementRef);
  private renderStats = inject(RenderStatsService);
  private shipExteriorView = viewChild(ShipExteriorViewScene);
  protected readonly persistentStatsOptions = { parent: this.host, domClass: 'stats' };

  protected showPropertiesPanel = computed(() => this.shipExteriorView()?.showPropertiesPanel() ?? false);
  protected showPropertiesPanelReveal = computed(() => this.shipExteriorView()?.showPropertiesPanelReveal() ?? false);
  protected propertiesPanelTitle = computed(
    () => this.shipExteriorView()?.propertiesPanelTitle() ?? 'ASTEROID // PROPERTIES',
  );
  protected propertiesMaterialText = computed(
    () => this.shipExteriorView()?.propertiesMaterialText() ?? 'MATERIAL: UNKNOWN',
  );
  protected propertiesRarityText = computed(() => this.shipExteriorView()?.propertiesRarityText() ?? 'RARITY: UNKNOWN');
  protected propertiesVelocityText = computed(() => this.shipExteriorView()?.propertiesVelocityText() ?? 'VEL: ---');
  protected propertiesSpinText = computed(() => this.shipExteriorView()?.propertiesSpinText() ?? 'SPIN: ---');
  protected propertiesMassText = computed(() => this.shipExteriorView()?.propertiesMassText() ?? 'MASS: ---');
  protected propertiesDiameterText = computed(() => this.shipExteriorView()?.propertiesDiameterText() ?? 'DIAM: ---');
  protected propertiesLocationText = computed(
    () => this.shipExteriorView()?.propertiesLocationText() ?? 'LOC(Mkm): ---',
  );
  protected propertiesClusterText = computed(
    () => this.shipExteriorView()?.propertiesClusterText() ?? 'CLUSTER(Mkm): ---',
  );
  protected propertiesOffsetText = computed(() => this.shipExteriorView()?.propertiesOffsetText() ?? 'OFFSET(km): ---');

  protected showAsteroidProperties = computed(() => this.shipExteriorView()?.showAsteroidProperties() ?? false);
  protected showDebrisProperties = computed(() => this.shipExteriorView()?.showDebrisProperties() ?? false);
  protected debrisPropertiesItemTypeText = computed(
    () => this.shipExteriorView()?.debrisPropertiesItemTypeText() ?? 'ITEM TYPE: UNKNOWN',
  );
  protected debrisPropertiesNameText = computed(
    () => this.shipExteriorView()?.debrisPropertiesNameText() ?? 'NAME: UNKNOWN',
  );
  protected debrisPropertiesPositionText = computed(
    () => this.shipExteriorView()?.debrisPropertiesPositionText() ?? 'POS KM: ---',
  );
  protected debrisPropertiesDistanceText = computed(
    () => this.shipExteriorView()?.debrisPropertiesDistanceText() ?? 'DIST KM: ---',
  );
  protected debrisPropertiesStateText = computed(
    () => this.shipExteriorView()?.debrisPropertiesStateText() ?? 'STATE: ---',
  );
  protected showTractorBeamCapabilityDetails = computed(
    () => this.shipExteriorView()?.showTractorBeamCapabilityDetails() ?? false,
  );
  protected tractorBeamCapabilityText = computed(
    () => this.shipExteriorView()?.tractorBeamCapabilityText() ?? 'TRACTOR EQ: UNAVAILABLE',
  );
  protected tractorBeamTimingText = computed(
    () => this.shipExteriorView()?.tractorBeamTimingText() ?? 'TRACTOR PULL: ---',
  );
  protected launchHotkeySlots = computed(() => this.shipExteriorView()?.launchHotkeySlots() ?? DEFAULT_HOTKEY_SLOTS);
  protected launchInventoryDebugLine = computed(() => this.shipExteriorView()?.launchInventoryDebugLine() ?? '');
  protected launchIdentityDebugLine = computed(() => this.shipExteriorView()?.launchIdentityDebugLine() ?? '');
  protected socketCorrelationDebugLine = computed(() => this.shipExteriorView()?.socketCorrelationDebugLine() ?? '');
  protected showQuickTargetIronControl = computed(() => this.shipExteriorView()?.showQuickTargetIronControl() ?? false);
  protected activeLaunchToast = computed(() => this.shipExteriorView()?.activeLaunchToast() ?? null);
  protected missionObjectiveText = computed(
    () => this.shipExteriorView()?.missionObjectiveText() ?? 'Objective unavailable.',
  );
  protected shipConditionLine = computed(
    () => this.shipExteriorView()?.shipConditionLine() ?? 'SHIP CONDITION // UNKNOWN',
  );
  protected flightModeEnabled = computed(() => this.shipExteriorView()?.flightModeEnabled() ?? false);
  protected flightPointerLocked = computed(() => this.shipExteriorView()?.flightPointerLocked() ?? false);
  protected flightInvertY = computed(() => this.shipExteriorView()?.flightInvertY() ?? false);
  protected flightMouseSensitivitySlider = computed(
    () => this.shipExteriorView()?.getFlightMouseSensitivitySliderValue() ?? 23,
  );
  protected flightStatusLine = computed(() => this.shipExteriorView()?.flightStatusLine() ?? 'FLIGHT // OFF');
  protected flightCoordsLine = computed(() => this.shipExteriorView()?.flightCoordsLine() ?? 'COORD KM // ---');
  protected flightSpeedLine = computed(() => this.shipExteriorView()?.flightSpeedLine() ?? 'SPD // 0 km/s');
  protected flightControlLine = computed(
    () => this.shipExteriorView()?.flightControlLine() ?? 'W/S FWD-BACK | A/D STRAFE | SPACE/CTRL VERT | Q/E ROLL',
  );
  protected flightViewDirectionLine = computed(
    () => this.shipExteriorView()?.flightViewDirectionLine() ?? 'VIEW // YAW 0.0° PITCH 0.0° ROLL 0.0°',
  );
  protected flightMovementVectorsLine = computed(
    () =>
      this.shipExteriorView()?.flightMovementVectorsLine() ??
      'MOVE // FWD(0.00,0.00,-1.00) RIGHT(1.00,0.00,0.00) UP(0.00,1.00,0.00)',
  );
  protected framePressureLine = computed(() => this.shipExteriorView()?.framePressureLine() ?? 'FRAME PRESSURE // 0.00 ms');
  protected qualityScalerLine = computed(() => this.shipExteriorView()?.qualityScalerLine() ?? 'QUALITY SCALER // 100%');
  protected socketContractViolationCounterLine = computed(
    () => this.shipExteriorView()?.socketContractViolationCounterLine() ?? '',
  );
  protected showAsteroidDebugTag = computed(() => this.shipExteriorView()?.showAsteroidDebugTag() ?? false);
  protected asteroidDebugHeaderText = computed(
    () => this.shipExteriorView()?.asteroidDebugHeaderText() ?? 'ASTEROID DEBUG // NO SAMPLE',
  );
  protected asteroidDebugMaterialText = computed(
    () => this.shipExteriorView()?.asteroidDebugMaterialText() ?? 'MAT // ---',
  );
  protected asteroidDebugPbrText = computed(() => this.shipExteriorView()?.asteroidDebugPbrText() ?? 'PBR // ---');
  protected asteroidDebugDetailRuleText = computed(
    () => this.shipExteriorView()?.asteroidDebugDetailRuleText() ?? 'DETAIL // ---',
  );
  protected asteroidDebugTierText = computed(
    () => this.shipExteriorView()?.asteroidDebugTierText() ?? 'TIER // ---',
  );
  protected asteroidDebugSw13SeedText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13SeedText() ?? 'SW13 SEED // ---',
  );
  protected asteroidDebugSw13GeneratorText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13GeneratorText() ?? 'SW13 GEN // ---',
  );
  protected asteroidDebugSw13BundleHashText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13BundleHashText() ?? 'SW13 BUNDLE // ---',
  );
  protected asteroidDebugSw13ProfilePresetText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13ProfilePresetText() ?? 'SW13 PROFILE // ---',
  );
  protected asteroidDebugSw13SurfacesText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13SurfacesText() ?? 'SW13 SURFACES // ---',
  );
  protected asteroidDebugSw13ValidationText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13ValidationText() ?? 'SW13 VALIDATION // ---',
  );
  protected asteroidDebugSw13TierText = computed(
    () => this.shipExteriorView()?.asteroidDebugSw13TierText() ?? 'SW13 TIER // ---',
  );
  protected asteroidSw13ParitySummaryText = computed(
    () =>
      this.shipExteriorView()?.asteroidSw13ParitySummaryText() ??
      'SW13 PARITY // TOTAL 0 // B 0 H 0 // SV 0 SEV 0 // META 0/0',
  );

  protected showDebrisDebugTag = computed(() => this.shipExteriorView()?.showDebrisDebugTag() ?? false);
  protected debrisDebugHeaderText = computed(
    () => this.shipExteriorView()?.debrisDebugHeaderText() ?? 'DEBRIS DEBUG // NO SAMPLE',
  );
  protected debrisDebugDisplayNameText = computed(
    () => this.shipExteriorView()?.debrisDebugDisplayNameText() ?? 'NAME // ---',
  );
  protected debrisDebugPositionText = computed(
    () => this.shipExteriorView()?.debrisDebugPositionText() ?? 'POS KM // ---',
  );
  protected showAnyDebugTag = computed(() => this.shipExteriorView()?.showAnyDebugTag() ?? false);

  private readonly debugCollapsedState = signal(false);
  protected debugCollapsed = this.debugCollapsedState.asReadonly();
  protected toggleDebugCollapsed(): void {
    this.debugCollapsedState.update((v) => !v);
  }

  protected hidePropertiesPanel(): void {
    this.shipExteriorView()?.hidePropertiesPanel();
  }

  protected revealPropertiesPanel(): void {
    this.shipExteriorView()?.revealPropertiesPanel();
  }

  /**
   * Delegates launch command to scene hotkey slot action.
   */
  protected launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void {
    this.shipExteriorView()?.launchFromHotkeySlot(hotkey);
  }

  protected quickTargetIronAsteroidForTest(): void {
    this.shipExteriorView()?.selectFirstScannedIronTargetForTest();
  }

  protected scanAllAsteroidsToHeroForTest(): void {
    this.shipExteriorView()?.scanAllAsteroidsToHeroForTest();
  }

  protected toggleFlightMode(): void {
    this.shipExteriorView()?.toggleFlightMode();
  }

  protected onFlightInvertYChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.shipExteriorView()?.setFlightInvertY(target.checked);
  }

  protected onFlightSensitivityInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.shipExteriorView()?.setFlightMouseSensitivityFromSliderValue(Number(target.value));
  }
}
