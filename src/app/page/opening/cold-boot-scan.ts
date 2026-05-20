import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import ShipExteriorViewScene from '../../scene/ship-exterior-view';

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
  imports: [NgtCanvas, ShipExteriorViewScene],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Host page for ship-exterior scan scene, exposing scene state to template bindings.
 */
export default class ColdBootScanPage {
  private shipExteriorView = viewChild(ShipExteriorViewScene);

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
  protected launchHotkeySlots = computed(() => this.shipExteriorView()?.launchHotkeySlots() ?? DEFAULT_HOTKEY_SLOTS);
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
