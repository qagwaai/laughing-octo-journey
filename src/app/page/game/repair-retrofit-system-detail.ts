import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
  coerceShipDamageProfile,
  createColdBootStarterShipDamageProfile,
  type ShipDamageProfile,
} from '../../model/ship-damage';
import { type ShipSummary } from '../../model/ship-list';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { SessionService, SocketService } from '../../services';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { resolveNavigationState } from '../navigation-state';
import {
  describeSummaryForSystems,
  mapOverallStatusToShipStatus,
  resolveOverallStatusFromSystems,
  type RepairAssetFilter,
  type RepairAssetGrouping,
  type RepairDetailNavigationState,
} from './repair-retrofit-state';

@Component({
  selector: 'app-repair-retrofit-system-detail-page',
  templateUrl: './repair-retrofit-system-detail.html',
  styleUrls: ['./repair-retrofit-system-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Subsystem repair detail page for clearing a single damaged ship subsystem.
 */
export default class RepairRetrofitSystemDetailPage {
  protected readonly t = locale;
  private router = inject(Router);
  private socketService = inject(SocketService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private navigationState: RepairDetailNavigationState = resolveNavigationState<RepairDetailNavigationState>(
    this.router,
  );

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
  protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
  protected missionId = signal<string>(this.navigationState.missionId ?? FIRST_TARGET_MISSION_ID);
  protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
  protected selectedAsset = signal(this.navigationState.asset ?? null);
  protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
  protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
  protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
  protected isPersisting = signal(false);
  protected persistError = signal<string | null>(null);
  protected persistSuccess = signal<string | null>(null);

  protected systemDamage = computed(() => {
    const code = this.selectedAsset()?.systemCode;
    const profile = this.damageProfile();
    if (!code || !profile) {
      return null;
    }

    return profile.systems.find((system) => system.code === code) ?? null;
  });

  protected canFullyRepair = computed(() => !!this.systemDamage());

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

    const status = missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status?.toUpperCase();
    return status === 'ACTIVE';
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
   * Persists full repair for selected subsystem and recomputes overall damage state.
   */
  protected fullyRepairSystem(): void {
    const profile = this.damageProfile();
    const ship = this.joinShip();
    const code = this.selectedAsset()?.systemCode;
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!profile || !ship?.id || !code || !characterId || !playerName || !sessionKey) {
      this.persistError.set(this.t.game.repairRetrofitSystemDetail.missingContextError);
      return;
    }

    const nextSystems = profile.systems.filter((system) => system.code !== code);
    const nextProfile: ShipDamageProfile = {
      ...profile,
      overallStatus: resolveOverallStatusFromSystems(nextSystems),
      summary: describeSummaryForSystems(nextSystems),
      systems: nextSystems,
      updatedAt: new Date().toISOString(),
    };

    this.isPersisting.set(true);
    this.persistError.set(null);
    this.persistSuccess.set(null);

    this.socketService.upsertShip(
      {
        playerName,
        characterId,
        sessionKey,
        ship: {
          id: ship.id,
          status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
          model: ship.model,
          tier: ship.tier,
          launchable: ship.launchable,
          inventory: ship.inventory ?? [],
          damageProfile: nextProfile,
          spatial: ship.spatial,
        },
      },
      (response: ShipUpsertResponse) => {
        this.isPersisting.set(false);
        if (!response.success) {
          this.persistError.set(response.message || this.t.game.repairRetrofitSystemDetail.persistFailedLabel);
          return;
        }

        this.damageProfile.set(nextProfile);
        this.persistSuccess.set(this.t.game.repairRetrofitSystemDetail.successLabel);
      },
    );
  }
}
