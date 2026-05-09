import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';
import { type ShipSummary } from '../../model/ship-list';
import { PrinterStateService } from '../../services';
import { type PrintQueueNavigationState } from './repair-retrofit-state';

interface FabricationLabNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  joinShip?: ShipSummary;
}

@Component({
  selector: 'app-fabrication-lab-page',
  templateUrl: './fabrication-lab.html',
  styleUrls: ['./fabrication-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Fabrication lab page that reflects printer queue state and opens queue details.
 */
export default class FabricationLabPage {
  protected readonly t = locale;
  private router = inject(Router);
  private printerService = inject(PrinterStateService);
  private navigationState: FabricationLabNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as FabricationLabNavigationState | undefined) ??
    (history.state as FabricationLabNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected activeShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);

  protected printerQueue = this.printerService.queue;
  protected printerStatus = computed(() => (this.printerQueue().length > 0 ? 'printing' : 'idle'));
  protected printerActiveJobCount = computed(() => this.printerQueue().length);

  constructor() {
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    if (playerName && characterId) {
      this.printerService.loadQueue(playerName, characterId);
    }
  }

  /**
   * Opens character profile panel from fabrication flow.
   */
  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }

  /**
   * Opens print-queue panel carrying player/character/ship context.
   */
  protected openPrintQueueView(): void {
    const state: PrintQueueNavigationState = {
      playerName: this.playerName(),
      joinCharacter: this.joinCharacter(),
      joinShip: this.activeShip(),
    };

    this.router.navigate([{ outlets: { right: ['print-queue'], left: ['fabrication-lab'] } }], {
      preserveFragment: true,
      state,
    });
  }
}
