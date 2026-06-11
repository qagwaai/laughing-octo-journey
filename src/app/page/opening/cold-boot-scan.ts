import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { NgtsStats } from 'angular-three-soba/stats';
import {
  createShipExteriorViewFacade,
  type ShipExteriorViewFacadeSource,
} from '../../scene/ship-exterior/ship-exterior-view-facade';
import ShipExteriorViewScene from '../../scene/ship-exterior-view';
import { RenderStatsService } from '../../services/render-stats.service';

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
  private readonly sceneFacade = createShipExteriorViewFacade(
    () => this.shipExteriorView() as ShipExteriorViewFacadeSource | undefined,
  );
  protected readonly persistentStatsOptions = { parent: this.host, domClass: 'stats' };
  protected objectivePanel = computed(() => this.sceneFacade.objectivePanel());
  protected propertiesPanel = computed(() => this.sceneFacade.propertiesPanel());
  protected flightPanel = computed(() => this.sceneFacade.flightPanel());
  protected launchPanel = computed(() => this.sceneFacade.launchPanel());
  protected debugPanel = computed(() => this.sceneFacade.debugPanel());

  private readonly debugCollapsedState = signal(false);
  protected debugCollapsed = this.debugCollapsedState.asReadonly();

  protected toggleDebugCollapsed(): void {
    this.debugCollapsedState.update((v) => !v);
  }

  protected hidePropertiesPanel(): void {
    this.sceneFacade.commands.hidePropertiesPanel();
  }

  protected revealPropertiesPanel(): void {
    this.sceneFacade.commands.revealPropertiesPanel();
  }

  /**
   * Delegates launch command to scene hotkey slot action.
   */
  protected launchFromHotkeySlot(hotkey: 1 | 2 | 3 | 4 | 5): void {
    this.sceneFacade.commands.launchFromHotkeySlot(hotkey);
  }

  protected quickTargetIronAsteroidForTest(): void {
    this.sceneFacade.commands.quickTargetIronAsteroidForTest();
  }

  protected scanAllAsteroidsToHeroForTest(): void {
    this.sceneFacade.commands.scanAllAsteroidsToHeroForTest();
  }

  protected toggleFlightMode(): void {
    this.sceneFacade.commands.toggleFlightMode();
  }

  protected onFlightInvertYChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.sceneFacade.commands.setFlightInvertY(target.checked);
  }

  protected onFlightSensitivityInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.sceneFacade.commands.setFlightMouseSensitivityFromSliderValue(Number(target.value));
  }
}
