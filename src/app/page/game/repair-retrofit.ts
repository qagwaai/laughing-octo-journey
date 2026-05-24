import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { resolveActiveShipSelection } from '../../model/active-ship-selection';
import { PlayerCharacterSummary } from '../../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
  coerceShipDamageProfile,
  createColdBootStarterShipDamageProfile,
  type ShipDamageProfile,
} from '../../model/ship-damage';
import {
  coerceShipInventory,
  type ShipSummary,
} from '../../model/ship-list';
import { type ShipListByOwnerRequest, type ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { SessionService, ShipService, SocketService } from '../../services';
import { appLogger } from '../../services/logger';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import {
  type RepairAssetFilter,
  type RepairAssetGrouping,
  type RepairDetailNavigationState,
} from './repair-retrofit-state';
interface RepairRetrofitNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  joinShip?: ShipSummary;
  selectedFilter?: RepairAssetFilter;
  selectedGrouping?: RepairAssetGrouping;
  searchQuery?: string;
}

@Component({
  selector: 'app-repair-retrofit-page',
  templateUrl: './repair-retrofit.html',
  styleUrls: ['./repair-retrofit.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Repair/retrofit landing page that hydrates ship context and launches detail workflows.
 */
export default class RepairRetrofitPage {
  protected readonly t = locale;
  private router = inject(Router);
  private shipService = inject(ShipService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private navigationState: RepairRetrofitNavigationState =
    resolveNavigationState<RepairRetrofitNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected activeShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
  protected isLoadingShip = signal(false);
  protected shipLoadError = signal<string | null>(null);
  protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
  protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
  protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
  protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
  protected canOpenRepairItems = computed(() => !!this.activeShip());

  constructor() {
    if (this.activeShip()) {
      return;
    }

    this.socketLifecycleService.runWhenConnected(() => this.loadActiveShip());
  }

  private isFirstTargetInProgress(): boolean {
    const missions = this.joinCharacter()?.missions;
    if (!Array.isArray(missions)) {
      return false;
    }

    const status = missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status?.toLowerCase();
    return status === 'started' || status === 'in-progress' || status === 'paused';
  }

  private resolveInitialDamageProfile(): ShipDamageProfile | null {
    const shipProfile = coerceShipDamageProfile(this.navigationState.joinShip?.damageProfile);
    if (shipProfile) {
      return shipProfile;
    }

    if (this.isFirstTargetInProgress()) {
      return createColdBootStarterShipDamageProfile();
    }

    return null;
  }

  private resolveDamageProfileForShip(ship: ShipSummary | null): ShipDamageProfile | null {
    const shipProfile = coerceShipDamageProfile(ship?.damageProfile);
    if (shipProfile) {
      return shipProfile;
    }

    if (this.isFirstTargetInProgress()) {
      return createColdBootStarterShipDamageProfile();
    }

    return null;
  }

  /**
   * Loads active ship context used by downstream repair/retrofit routes.
   */
  private loadActiveShip(): void {
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName || !characterId || !sessionKey) {
      this.shipLoadError.set('Unable to load ship context for repair operations.');
      return;
    }

    this.isLoadingShip.set(true);
    this.shipLoadError.set(null);

    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };
    this.shipService.listShipsByOwner(request, (response: ShipListByOwnerResponse) => {
      this.isLoadingShip.set(false);

      if (!response.success) {
        this.shipLoadError.set(response.message || 'Unable to load ship for repair operations.');
        return;
      }

      const resolved = resolveActiveShipSelection({
        ships: response.ships ?? [],
        sessionActiveShipId: this.sessionService.activeShip()?.id,
        requestedShipId: this.navigationState.joinShip?.id,
      });

      if (!resolved.ship) {
        appLogger.log('RepairRetrofitPage.loadActiveShip: hard fail due to missing usable ship spatial data', {
          reason: resolved.reason,
          playerName,
          characterId,
        });
        this.activeShip.set(null);
        this.shipLoadError.set('No ship with usable spatial data is available.');
        this.damageProfile.set(this.resolveDamageProfileForShip(null));
        return;
      }

      const nextShip = resolved.ship;
      this.activeShip.set(
        nextShip
          ? {
              ...nextShip,
              inventory: coerceShipInventory(nextShip.inventory),
            }
          : null,
      );
      this.sessionService.setActiveShip(nextShip);
      this.shipLoadError.set(null);
      this.damageProfile.set(this.resolveDamageProfileForShip(nextShip));
    });
  }

  /**
   * Opens repair-items view carrying current filters, grouping, and ship state.
   */
  protected openRepairItemsView(): void {
    const state: RepairDetailNavigationState = {
      playerName: this.playerName(),
      joinCharacter: this.joinCharacter(),
      joinShip: this.activeShip(),
      damageProfile: this.damageProfile(),
      selectedFilter: this.selectedFilter(),
      selectedGrouping: this.selectedGrouping(),
      searchQuery: this.searchQuery(),
      missionId: FIRST_TARGET_MISSION_ID,
    };

    this.router.navigate([{ outlets: { right: ['repair-retrofit-items'], left: ['repair-retrofit'] } }], {
      preserveFragment: true,
      queryParams: { repairNav: Date.now() },
      state,
    });
  }

  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }
}
