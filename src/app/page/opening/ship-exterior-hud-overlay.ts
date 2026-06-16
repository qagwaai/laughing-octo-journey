import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type {
  ShipExteriorDebugPanelViewModel,
  ShipExteriorFlightPanelViewModel,
  ShipExteriorLaunchPanelViewModel,
  ShipExteriorObjectivePanelViewModel,
  ShipExteriorPropertiesPanelViewModel,
} from '../../scene/ship-exterior/ship-exterior-view-facade';

@Component({
  selector: 'app-ship-exterior-hud-overlay',
  standalone: true,
  styleUrls: ['./cold-boot-scan.css'],
  template: `
    <section class="ship-exterior-objective" aria-live="polite">
      <p>{{ objectivePanel.shipConditionLine }}</p>
      <p>{{ objectivePanel.missionObjectiveText }}</p>
    </section>

    <section class="ship-exterior-flight-panel" aria-live="polite">
      <header class="ship-exterior-flight-panel__header">
        <p>{{ flightPanel.statusLine }}</p>
        <button
          type="button"
          class="ship-exterior-flight-panel__toggle"
          [class.ship-exterior-flight-panel__toggle--active]="flightPanel.enabled"
          [title]="
            flightPanel.enabled
              ? 'Press ESC to exit flight mode and release the mouse'
              : 'Click to enable flight; click view to lock mouse'
          "
          (click)="toggleFlightMode.emit()"
        >
          {{ flightPanel.enabled ? 'DISABLE FLIGHT' : 'ENABLE FLIGHT' }}
        </button>
      </header>
      <p>{{ flightPanel.coordsLine }}</p>
      <p>{{ flightPanel.viewDirectionLine }}</p>
      <p>{{ flightPanel.movementVectorsLine }}</p>
      <p>{{ flightPanel.framePressureLine }}</p>
      <p>{{ flightPanel.qualityScalerLine }}</p>
      <p>{{ flightPanel.speedLine }}</p>
      <p>{{ flightPanel.controlLine }}</p>
      @if (flightPanel.enabled) {
        <p class="ship-exterior-flight-panel__hint">ESC EXITS FLIGHT MODE // RELEASES MOUSE</p>
      }

      <div class="ship-exterior-flight-panel__settings">
        <label class="ship-exterior-flight-panel__checkbox">
          <input type="checkbox" [checked]="flightPanel.invertY" (change)="onFlightInvertYChange($event)" />
          INVERT Y
        </label>
        <label class="ship-exterior-flight-panel__slider">
          SENS
          <input
            type="range"
            min="10"
            max="70"
            [value]="flightPanel.sensitivitySlider"
            (input)="onFlightSensitivityInput($event)"
          />
        </label>
        <span class="ship-exterior-flight-panel__lock">{{ flightPanel.pointerLocked ? 'MOUSE LOCKED' : 'MOUSE FREE' }}</span>
      </div>
    </section>

    @if (debugPanel.showAnyTag) {
      <section class="ship-exterior-asteroid-debug" aria-live="polite">
        <header class="ship-exterior-asteroid-debug__header">
          <span class="ship-exterior-asteroid-debug__title">
            {{ debugPanel.showAsteroidTag ? debugPanel.asteroidHeaderText : debugPanel.debrisHeaderText }}
          </span>
          <button type="button" class="ship-exterior-asteroid-debug__toggle" (click)="toggleDebugCollapsed()">
            {{ debugCollapsed ? 'SHOW' : 'HIDE' }}
          </button>
        </header>
        @if (!debugCollapsed) {
          @if (debugPanel.showAsteroidTag) {
            <p>{{ debugPanel.asteroidMaterialText }}</p>
            <p>{{ debugPanel.asteroidPbrText }}</p>
            <p>{{ debugPanel.asteroidDetailRuleText }}</p>
            <p>{{ debugPanel.asteroidTierText }}</p>
            <p>{{ debugPanel.asteroidSw13SeedText }}</p>
            <p>{{ debugPanel.asteroidSw13TierText }}</p>
            <p>{{ debugPanel.asteroidSw13GeneratorText }}</p>
            <p>{{ debugPanel.asteroidSw13BundleHashText }}</p>
            <p>{{ debugPanel.asteroidSw13ProfilePresetText }}</p>
            <p>{{ debugPanel.asteroidSw13SurfacesText }}</p>
            <p>{{ debugPanel.asteroidSw13ValidationText }}</p>
            <p>{{ debugPanel.asteroidSw13ParitySummaryText }}</p>
          } @else {
            <p>{{ debugPanel.debrisDisplayNameText }}</p>
            <p>{{ debugPanel.debrisPositionText }}</p>
          }
        }
      </section>
    }

    @if (launchPanel.launchInventoryDebugLine; as launchDebug) {
      <section class="ship-exterior-launch-debug" aria-live="polite">
        <p>{{ launchDebug }}</p>
      </section>
    }

    @if (launchPanel.socketCorrelationDebugLine; as socketDebug) {
      <section class="ship-exterior-socket-debug" aria-live="polite">
        <p>{{ launchPanel.socketContractViolationCounterLine }}</p>
        <p>{{ socketDebug }}</p>
      </section>
    }

    @if (launchPanel.launchIdentityDebugLine; as launchIdentityDebug) {
      <section class="ship-exterior-launch-id-debug" aria-live="polite">
        <p>{{ launchIdentityDebug }}</p>
      </section>
    }

    <section class="ship-exterior-hotkey-row" aria-label="Launch hotkeys">
      @for (slot of launchPanel.hotkeySlots; track slot.hotkey) {
        <button
          type="button"
          class="ship-exterior-hotkey-tile"
          [class.ship-exterior-hotkey-tile--enabled]="slot.enabled"
          [class.ship-exterior-hotkey-tile--launching]="slot.launching"
          [disabled]="!slot.enabled"
          (click)="launchFromHotkeySlot.emit(slot.hotkey)"
        >
          <span class="ship-exterior-hotkey-tile__key">{{ slot.hotkey }}</span>
          <span class="ship-exterior-hotkey-tile__name">{{ slot.label }}</span>
        </button>
      } @if (launchPanel.showQuickTargetIronControl) {
        <button type="button" class="ship-exterior-test-target-button" (click)="quickTargetIronAsteroidForTest.emit()">
          TARGET IRON
        </button>
        <button type="button" class="ship-exterior-test-target-button" (click)="scanAllAsteroidsToHeroForTest.emit()">
          SCAN ALL HERO
        </button>
      }
    </section>

    @if (launchPanel.activeLaunchToast; as toast) {
      <section
        class="ship-exterior-launch-toast"
        [class.ship-exterior-launch-toast--success]="toast.tone === 'success'"
        [class.ship-exterior-launch-toast--error]="toast.tone === 'error'"
        role="status"
        aria-live="polite"
      >
        <p>{{ toast.message }}</p>
        @if (toast.seed !== null) {
          <span class="ship-exterior-launch-toast__seed">seed {{ toast.seed }}</span>
        }
      </section>
    }

    @if (propertiesPanel.showPanel) {
      <section class="ship-exterior-properties-panel" aria-live="polite">
        <header class="ship-exterior-properties-panel__header">
          <h3>{{ propertiesPanel.panelTitle }}</h3>
          <button type="button" class="ship-exterior-properties-panel__toggle" (click)="hidePropertiesPanel.emit()">
            HIDE
          </button>
        </header>

        <div class="ship-exterior-properties-panel__body">
          @if (propertiesPanel.showAsteroidProperties) {
            <p>{{ propertiesPanel.asteroid.materialText }}</p>
            <p>{{ propertiesPanel.asteroid.rarityText }}</p>
            <p>{{ propertiesPanel.asteroid.velocityText }}</p>
            <p>{{ propertiesPanel.asteroid.spinText }}</p>
            <p>{{ propertiesPanel.asteroid.massText }}</p>
            <p>{{ propertiesPanel.asteroid.diameterText }}</p>
            <p>{{ propertiesPanel.asteroid.locationText }}</p>
            <p>{{ propertiesPanel.asteroid.clusterText }}</p>
            <p>{{ propertiesPanel.asteroid.offsetText }}</p>
          } @else if (propertiesPanel.showDebrisProperties) {
            <p>{{ propertiesPanel.debris.itemTypeText }}</p>
            <p>{{ propertiesPanel.debris.nameText }}</p>
            <p>{{ propertiesPanel.debris.positionText }}</p>
            <p>{{ propertiesPanel.debris.distanceText }}</p>
            <p>{{ propertiesPanel.debris.stateText }}</p>
            @if (propertiesPanel.showTractorBeamCapabilityDetails) {
              <p>{{ propertiesPanel.debris.tractorBeamCapabilityText }}</p>
              <p>{{ propertiesPanel.debris.tractorBeamTimingText }}</p>
            }
          }
        </div>
      </section>
    } @else if (propertiesPanel.showReveal) {
      <button type="button" class="ship-exterior-properties-reveal" (click)="revealPropertiesPanel.emit()">
        SHOW PROPERTIES
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ShipExteriorHudOverlayComponent {
  @Input({ required: true }) objectivePanel!: ShipExteriorObjectivePanelViewModel;
  @Input({ required: true }) flightPanel!: ShipExteriorFlightPanelViewModel;
  @Input({ required: true }) propertiesPanel!: ShipExteriorPropertiesPanelViewModel;
  @Input({ required: true }) launchPanel!: ShipExteriorLaunchPanelViewModel;
  @Input({ required: true }) debugPanel!: ShipExteriorDebugPanelViewModel;
  protected debugCollapsed = false;

  @Output() hidePropertiesPanel = new EventEmitter<void>();
  @Output() revealPropertiesPanel = new EventEmitter<void>();
  @Output() launchFromHotkeySlot = new EventEmitter<1 | 2 | 3 | 4 | 5>();
  @Output() quickTargetIronAsteroidForTest = new EventEmitter<void>();
  @Output() scanAllAsteroidsToHeroForTest = new EventEmitter<void>();
  @Output() toggleFlightMode = new EventEmitter<void>();
  @Output() flightInvertYChange = new EventEmitter<boolean>();
  @Output() flightSensitivityInput = new EventEmitter<number>();

  protected onFlightInvertYChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.flightInvertYChange.emit(target.checked);
  }

  protected onFlightSensitivityInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.flightSensitivityInput.emit(Number(target.value));
  }

  protected toggleDebugCollapsed(): void {
    this.debugCollapsed = !this.debugCollapsed;
  }
}