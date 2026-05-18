import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { type ShipItem } from '../../model/ship-item';
import { type ShipSummary } from '../../model/ship-list';
import { SessionService } from '../../services';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { resolveNavigationState } from '../navigation-state';
import {
  type RepairAssetFilter,
  type RepairAssetGrouping,
  type RepairDetailNavigationState,
} from './repair-retrofit-state';

@Component({
  selector: 'app-repair-retrofit-item-detail-page',
  templateUrl: './repair-retrofit-item-detail.html',
  styleUrls: ['./repair-retrofit-item-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Inventory-item repair detail page for restoring a damaged item to intact state.
 */
export default class RepairRetrofitItemDetailPage {
  protected readonly t = locale;
  private router = inject(Router);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private navigationState: RepairDetailNavigationState = resolveNavigationState<RepairDetailNavigationState>(
    this.router,
  );

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
  protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
  protected selectedAsset = signal(this.navigationState.asset ?? null);
  protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
  protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
  protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
  protected isPersisting = signal(false);
  protected persistError = signal<string | null>(null);
  protected persistSuccess = signal<string | null>(null);

  protected selectedItem = computed<ShipItem | null>(() => {
    const itemId = this.selectedAsset()?.itemId;
    if (!itemId) {
      return null;
    }

    return this.joinShip()?.inventory?.find((item) => item.id === itemId) ?? null;
  });

  protected canFullyRepair = computed(() => false);
  protected blockedReason = computed(() => this.t.game.repairRetrofitItemDetail.blockedReasonMissionPartsUnavailable);

  constructor() {
    this.socketLifecycleService.ensureConnected();
  }

  protected navigateBackToRepairItems(): void {
    const state: RepairDetailNavigationState = {
      playerName: this.playerName(),
      joinCharacter: this.joinCharacter(),
      joinShip: this.joinShip(),
      selectedFilter: this.selectedFilter(),
      selectedGrouping: this.selectedGrouping(),
      searchQuery: this.searchQuery(),
    };

    this.router.navigate([{ outlets: { right: ['repair-retrofit-items'], left: ['repair-retrofit'] } }], {
      preserveFragment: true,
      queryParams: { repairNav: Date.now() },
      state,
    });
  }

  /**
   * Inventory-item repair is mission-locked until salvage-part systems are implemented.
   */
  protected fullyRepairItem(): void {
    this.persistSuccess.set(null);
    this.persistError.set(this.t.game.repairRetrofitItemDetail.blockedReasonMissionPartsUnavailable);
  }
}
