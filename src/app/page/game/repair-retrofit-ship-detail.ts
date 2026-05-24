import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import {
  evaluateMissionGateOnRepair,
  parseMissionGateState,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { type ItemUpsertResponse } from '../../model/item-upsert';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { HULL_PATCH_KIT_PRINTABLE_ITEM } from '../../model/printable-item';
import {
  coerceShipDamageProfile,
  createColdBootStarterShipDamageProfile,
  type ShipDamageProfile,
} from '../../model/ship-damage';
import { type ShipItem } from '../../model/ship-item';
import { type ShipListByOwnerRequest } from '../../model/ship-list-by-owner';
import { type ShipSummary } from '../../model/ship-list';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { SessionService, SocketService } from '../../services';
import { ConsumedItemShadowService } from '../../services/consumed-item-shadow.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { resolveNavigationState } from '../navigation-state';
import {
  describeSummaryForSystems,
  mapOverallStatusToShipStatus,
  type RepairAssetFilter,
  type RepairAssetGrouping,
  type RepairDetailNavigationState,
} from './repair-retrofit-state';

@Component({
  selector: 'app-repair-retrofit-ship-detail-page',
  templateUrl: './repair-retrofit-ship-detail.html',
  styleUrls: ['./repair-retrofit-ship-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Ship-level repair detail page that applies full hull restoration and consumes patch kit.
 */
export default class RepairRetrofitShipDetailPage {
  protected readonly t = locale;
  private router = inject(Router);
  private socketService = inject(SocketService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private shipService = inject(ShipService);
  private consumedItemShadowService = inject(ConsumedItemShadowService);
  private sessionService = inject(SessionService);
  private missionProgressSyncService = inject(MissionProgressSyncService);
  private missionStateService = inject(ShipExteriorMissionStateService);
  private navigationState: RepairDetailNavigationState = resolveNavigationState<RepairDetailNavigationState>(
    this.router,
  );

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
  protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
  protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
  protected selectedAsset = signal(this.navigationState.asset ?? null);
  protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
  protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
  protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
  protected missionId = signal<string>(this.navigationState.missionId ?? FIRST_TARGET_MISSION_ID);
  protected isPersisting = signal(false);
  protected persistError = signal<string | null>(null);
  protected persistSuccess = signal<string | null>(null);

  protected hasHullPatchKit = computed(() => this.resolveHullPatchKitItem(this.joinShip()) !== null);

  protected canFullyRepair = computed(() => {
    const profile = this.damageProfile();
    return !!profile && profile.overallStatus !== 'intact' && this.hasHullPatchKit();
  });

  constructor() {
    this.socketLifecycleService.ensureConnected();
  }

  private isFirstTargetMissionContext(): boolean {
    const missionId = this.navigationState.missionId?.trim().toLowerCase() ?? '';
    if (missionId === FIRST_TARGET_MISSION_ID) {
      return true;
    }

    const missions = this.navigationState.joinCharacter?.missions;
    if (!Array.isArray(missions)) {
      return false;
    }

    const status = missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status?.toLowerCase();
    return status === 'started' || status === 'in-progress' || status === 'paused';
  }

  private hasShipDamageStatusWithoutProfile(): boolean {
    const status = this.navigationState.joinShip?.status?.trim().toLowerCase() ?? '';
    return status === 'damaged' || status === 'disabled';
  }

  private resolveInitialDamageProfile(): ShipDamageProfile | null {
    const directProfile = coerceShipDamageProfile(
      this.navigationState.damageProfile ?? this.navigationState.joinShip?.damageProfile,
    );
    if (directProfile) {
      return directProfile;
    }

    if (this.isFirstTargetMissionContext() || this.hasShipDamageStatusWithoutProfile()) {
      return createColdBootStarterShipDamageProfile();
    }

    return null;
  }

  private resolveHullPatchKitItem(ship: ShipSummary | null): ShipItem | null {
    const inventory = ship?.inventory ?? [];
    const normalizedKitType = HULL_PATCH_KIT_PRINTABLE_ITEM.itemType.trim().toLowerCase();
    const normalizedKitName = HULL_PATCH_KIT_PRINTABLE_ITEM.displayName.trim().toLowerCase();

    return (
      inventory.find((item) => {
        const normalizedItemType = item.itemType.trim().toLowerCase();
        const normalizedDisplayName = (item.displayName || '').trim().toLowerCase();
        const usableState = item.state === 'contained' && item.damageStatus !== 'destroyed';
        const notDestroyed = item.destroyedAt == null && item.destroyedReason == null;

        return (
          usableState &&
          notDestroyed &&
          (normalizedItemType === normalizedKitType ||
            normalizedItemType.includes(normalizedKitType) ||
            normalizedDisplayName === normalizedKitName ||
            normalizedDisplayName.includes(normalizedKitName))
        );
      }) ?? null
    );
  }

  protected getShipName(): string {
    const ship = this.joinShip();
    return (
      ship?.name?.trim() || ship?.model?.trim() || ship?.id || this.t.game.repairRetrofitShipDetail.fallbackShipName
    );
  }

  protected navigateBackToRepairItems(): void {
    const state: RepairDetailNavigationState = {
      playerName: this.playerName(),
      joinCharacter: this.joinCharacter(),
      joinShip: this.joinShip(),
      damageProfile: this.damageProfile(),
      selectedFilter: this.selectedFilter(),
      selectedGrouping: this.selectedGrouping(),
      searchQuery: this.searchQuery(),
      missionId: this.missionId(),
    };

    this.router.navigate([{ outlets: { right: ['repair-retrofit-items'], left: ['repair-retrofit'] } }], {
      preserveFragment: true,
      queryParams: { repairNav: Date.now() },
      state,
    });
  }

  /**
   * Performs full ship repair and updates mission gate progress when applicable.
   */
  protected fullyRepairShip(): void {
    const profile = this.damageProfile();
    const ship = this.joinShip();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!profile || !ship?.id || !characterId || !playerName || !sessionKey) {
      this.persistError.set(this.t.game.repairRetrofitShipDetail.missingContextError);
      return;
    }

    const nextProfile: ShipDamageProfile = {
      ...profile,
      overallStatus: 'intact',
      summary: describeSummaryForSystems([]),
      systems: [],
      updatedAt: new Date().toISOString(),
    };

    this.isPersisting.set(true);
    this.persistError.set(null);
    this.persistSuccess.set(null);

    const kitItem = this.resolveHullPatchKitItem(ship);

    if (!kitItem) {
      this.isPersisting.set(false);
      this.persistError.set(this.t.game.repairRetrofitShipDetail.hullPatchKitRequiredLabel);
      return;
    }

    const nextInventory = kitItem
      ? (ship.inventory ?? []).filter((item) => item.id !== kitItem.id)
      : (ship.inventory ?? []);

    const correlationId = `repair:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    this.socketService.upsertShip(
      {
        playerName,
        characterId,
        sessionKey,
        correlationId,
        ship: {
          id: ship.id,
          status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
          model: ship.model,
          tier: ship.tier,
          launchable: ship.launchable,
          damageProfile: nextProfile,
          inventory: nextInventory,
          spatial: ship.spatial,
        },
      },
      (response: ShipUpsertResponse) => {
        if (!response.success) {
          this.isPersisting.set(false);
          this.persistError.set(response.message || this.t.game.repairRetrofitShipDetail.persistFailedLabel);
          return;
        }

        this.damageProfile.set(nextProfile);

        // Optimistically remove the kit from local state immediately so downstream
        // navigation (back to items list, ship inventory) never sees a stale kit,
        // regardless of when or whether the backend item-upsert response arrives.
        if (kitItem) {
          this.consumedItemShadowService.markConsumed(playerName, characterId, kitItem.id);
          this.joinShip.update((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              inventory: (current.inventory ?? []).filter((item) => item.id !== kitItem.id),
            };
          });
        }

        this.isPersisting.set(false);
        this.persistSuccess.set(
          kitItem
            ? this.t.game.repairRetrofitShipDetail.kitConsumedLabel
            : this.t.game.repairRetrofitShipDetail.successLabel,
        );
        this.advanceMissionGateOnRepair(characterId);

        const refreshSnapshot = () =>
          this.forceRefreshActiveShip({
            playerName,
            characterId,
            sessionKey,
            shipId: ship.id,
            fallbackProfile: nextProfile,
            consumedKitId: kitItem?.id ?? null,
          });

        // Fire-and-forget backend persistence for the kit destruction.
        if (kitItem) {
          this.socketService.upsertItem(
            {
              playerName,
              sessionKey,
              correlationSource: 'repair-retrofit-ship-detail.consume-hull-patch-kit',
              item: {
                id: kitItem.id,
                state: 'destroyed',
                damageStatus: 'destroyed',
                container: null,
                spatial: null,
                motion: null,
                owningPlayerId: kitItem.owningPlayerId ?? this.playerName(),
                owningCharacterId: kitItem.owningCharacterId ?? this.joinCharacter()?.id ?? null,
                destroyedAt: new Date().toISOString(),
                destroyedReason: this.t.game.repairRetrofitShipDetail.kitDestroyedReason,
              },
            },
            (itemResponse: ItemUpsertResponse) => {
              if (!itemResponse.success) {
                this.persistError.set(
                  itemResponse.message || this.t.game.repairRetrofitShipDetail.persistFailedLabel,
                );
              }

              refreshSnapshot();
            },
          );
          return;
        }

        refreshSnapshot();
      },
    );
  }

  /**
   * Refreshes active ship snapshot from backend after repair writes to avoid stale
   * local state due to event ordering between ship/item upserts.
   */
  private forceRefreshActiveShip(params: {
    playerName: string;
    characterId: string;
    sessionKey: string;
    shipId: string;
    fallbackProfile: ShipDamageProfile;
    consumedKitId: string | null;
  }): void {
    const request: ShipListByOwnerRequest = {
      playerName: params.playerName,
      sessionKey: params.sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId: params.characterId,
      },
    };

    this.shipService.listShipsByOwner(request, (response) => {
      if (!response.success) {
        return;
      }

      const matchingShip = (response.ships ?? []).find((candidate) => candidate.id === params.shipId);
      if (!matchingShip) {
        return;
      }

      const inventoryWithErrorLogging = this.consumedItemShadowService.filterInventory(
        params.playerName,
        params.characterId,
        matchingShip.inventory,
      );
      const inventory = params.consumedKitId
        ? inventoryWithErrorLogging.filter((item) => item.id !== params.consumedKitId)
        : inventoryWithErrorLogging;
      const refreshedProfile = coerceShipDamageProfile(matchingShip.damageProfile);

      this.joinShip.set({
        ...matchingShip,
        inventory,
        damageProfile: refreshedProfile ?? params.fallbackProfile,
      });
      this.damageProfile.set(refreshedProfile ?? params.fallbackProfile);
    });
  }

  private advanceMissionGateOnRepair(characterId: string): void {
    const missionId = this.missionId().trim();
    const playerName = this.playerName().trim();
    if (!missionId || !playerName || !characterId) {
      return;
    }

    const mission = resolveShipExteriorMission(missionId);
    const context = { missionId, playerName, characterId };
    const stored = this.missionStateService.loadState(context);
    const steps = mission.getGateStepDefinitions();
    const gateState = stored
      ? (parseMissionGateState({
          rawStatusDetail: JSON.stringify(stored),
          missionId,
          characterId,
          steps,
        }) ?? stored)
      : null;
    if (!gateState) {
      return;
    }

    const evaluation = evaluateMissionGateOnRepair({
      mission,
      gateState,
      repairKind: 'ship',
    });
    const nextGateState = evaluation.changed ? evaluation.gateState : gateState;

    if (evaluation.changed) {
      this.missionStateService.saveState(context, evaluation.gateState);
    }

    // Always perform an idempotent sync after ship repair so backend mission
    // status remains aligned even if local gate state was already advanced.
    void this.syncMissionProgressToBackend(nextGateState);
  }

  /**
   * Syncs updated mission gate state to backend mission progress service.
   */
  private async syncMissionProgressToBackend(gateState: ShipExteriorMissionGateState): Promise<void> {
    await this.missionProgressSyncService.syncGateState({
      playerName: this.playerName(),
      characterId: this.joinCharacter()?.id ?? '',
      sessionKey: this.sessionService.getSessionKey() ?? '',
      gateState,
    });
  }
}
