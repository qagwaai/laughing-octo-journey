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
import {
  describePrintableMaterials,
  findConsumableMaterialsForPrintableItem,
  formatPrintableDuration,
  getMissingPrintableMaterials,
  hasPrintableItemInInventory,
  isPrintableItemQueued,
  resolvePrintableItemDefinition,
  type PrintableConsumedMaterial,
  type PrintableItemDefinition,
} from '../../model/printable-item';
import {
  coerceShipDamageProfile,
  createColdBootStarterShipDamageProfile,
  type ShipDamageProfile,
} from '../../model/ship-damage';
import { type ShipItem } from '../../model/ship-item';
import { DEFAULT_SHIP_MODEL, type ShipSummary } from '../../model/ship-list';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { SessionService, SocketService } from '../../services';
import { ConsumedItemShadowService } from '../../services/consumed-item-shadow.service';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import { PrinterStateService } from '../../services/printer-state.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { resolveNavigationState } from '../navigation-state';
import {
  describeSummaryForSystems,
  mapOverallStatusToShipStatus,
  resolveOverallStatusFromSystems,
  type PrintQueueNavigationState,
  type RepairAssetEntry,
  type RepairAssetFilter,
  type RepairAssetGrouping,
  type RepairAssetKind,
  type RepairDetailNavigationState,
} from './repair-retrofit-state';

interface RepairAssetGroup {
  group: string;
  entries: RepairAssetEntry[];
}

@Component({
  selector: 'app-repair-retrofit-items-page',
  templateUrl: './repair-retrofit-items.html',
  styleUrls: ['./repair-retrofit-items.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
/**
 * Repair asset listing page with filtering/grouping, repair actions, and printable kit queueing.
 */
export default class RepairRetrofitItemsPage {
  protected readonly t = locale;
  private router = inject(Router);
  private socketService = inject(SocketService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private consumedItemShadowService = inject(ConsumedItemShadowService);
  private missionProgressSyncService = inject(MissionProgressSyncService);
  private missionStateService = inject(ShipExteriorMissionStateService);
  private printerService = inject(PrinterStateService);
  private navigationState: RepairDetailNavigationState = resolveNavigationState<RepairDetailNavigationState>(
    this.router,
  );

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
  protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
  protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
  protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
  protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
  protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
  protected missionId = signal<string>(this.navigationState.missionId ?? '');
  protected activeRepairKey = signal<string | null>(null);
  protected persistError = signal<string | null>(null);
  protected persistSuccess = signal<string | null>(null);
  private isQueueingHullPatchKit = signal(false);
  private hullPatchKitPrintableItem: PrintableItemDefinition = resolvePrintableItemDefinition('hull-patch-kit')!;

  protected shipName = computed(
    () => this.joinShip()?.name?.trim() || this.joinShip()?.model?.trim() || DEFAULT_SHIP_MODEL,
  );

  protected hasHullPatchKit = computed(() =>
    hasPrintableItemInInventory(this.resolveVisibleInventory(this.joinShip()), this.hullPatchKitPrintableItem),
  );

  protected isHullPatchKitQueued = computed(() =>
    isPrintableItemQueued(this.printerService.queue(), this.hullPatchKitPrintableItem),
  );

  protected canQueueHullPatchKit = computed(
    () =>
      !this.hasHullPatchKit() &&
      !this.isHullPatchKitQueued() &&
      !!findConsumableMaterialsForPrintableItem(this.resolveVisibleInventory(this.joinShip()), this.hullPatchKitPrintableItem),
  );

  private resolveVisibleInventory(ship: ShipSummary | null): ShipItem[] {
    return this.consumedItemShadowService.filterInventory(
      this.playerName(),
      this.joinCharacter()?.id ?? '',
      ship?.inventory,
    );
  }

  constructor() {
    this.socketLifecycleService.runWhenConnected(() => {
      const playerName = this.playerName().trim();
      const characterId = this.joinCharacter()?.id?.trim() ?? '';
      if (playerName && characterId) {
        this.printerService.loadQueue(playerName, characterId);
      }
    });
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

  private normalizeSubsystemToken(value: string | null | undefined): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private isDuplicateSubsystemInventoryItem(item: ShipItem, profile: ShipDamageProfile | null): boolean {
    const systems = profile?.systems ?? [];
    if (systems.length === 0) {
      return false;
    }

    const normalizedItemType = this.normalizeSubsystemToken(item.itemType);
    const normalizedDisplayName = this.normalizeSubsystemToken(item.displayName);

    return systems.some((system) => {
      const normalizedCode = this.normalizeSubsystemToken(system.code);
      const normalizedLabel = this.normalizeSubsystemToken(system.label);

      if (!normalizedCode && !normalizedLabel) {
        return false;
      }

      return (
        (normalizedCode.length > 0 &&
          (normalizedItemType === normalizedCode || normalizedItemType.startsWith(`${normalizedCode}-`))) ||
        (normalizedLabel.length > 0 &&
          (normalizedDisplayName === normalizedLabel || normalizedItemType === normalizedLabel))
      );
    });
  }

  protected allAssets = computed<RepairAssetEntry[]>(() => {
    const entries: RepairAssetEntry[] = [];
    const ship = this.joinShip();
    const shipProfile = this.damageProfile();
    const shipName = ship?.name?.trim() || ship?.model?.trim() || DEFAULT_SHIP_MODEL;
    const shipId = ship?.id?.trim() || 'active';

    entries.push({
      key: `ship:${shipId}`,
      kind: 'ship',
      label: shipName,
      severity: shipProfile?.overallStatus ?? 'intact',
      summary: shipProfile?.summary ?? this.t.game.repairRetrofitItems.noActiveDamageProfileLabel,
      repairPriority: 0,
      shipId,
    });

    for (const system of (shipProfile?.systems ?? [])
      .slice()
      .sort((left, right) => left.repairPriority - right.repairPriority)) {
      entries.push({
        key: `ship-system:${system.code}`,
        kind: 'ship-system',
        label: system.label,
        severity: system.severity,
        summary: system.summary,
        repairPriority: system.repairPriority,
        shipId,
        systemCode: system.code,
      });
    }

    for (const item of this.resolveVisibleInventory(ship)) {
      if (item.state === 'destroyed' || item.damageStatus === 'destroyed') {
        continue;
      }

      if (this.isDuplicateSubsystemInventoryItem(item, shipProfile)) {
        continue;
      }

      entries.push({
        key: `inventory-item:${item.id}`,
        kind: 'inventory-item',
        label: item.displayName || item.itemType,
        severity: item.damageStatus,
        summary: `${this.t.game.repairRetrofitItems.inventoryItemSummaryPrefix} ${item.damageStatus} ${this.t.game.repairRetrofitItems.inventoryItemSummaryInfix} ${item.state}.`,
        repairPriority: 100,
        shipId,
        itemId: item.id,
      });
    }

    return entries.sort((left, right) => (left.repairPriority ?? 1000) - (right.repairPriority ?? 1000));
  });

  protected filteredAssets = computed(() => {
    const filter = this.selectedFilter();
    const normalizedSearch = this.searchQuery().trim().toLowerCase();
    const byFilter = (() => {
      if (filter === 'all') {
        return this.allAssets();
      }

      if (filter === 'needs-repair') {
        return this.allAssets().filter((asset) => asset.severity !== 'intact');
      }

      if (filter === 'critical-only') {
        return this.allAssets().filter((asset) => this.isCriticalSeverity(asset.severity));
      }

      return this.allAssets().filter((asset) => asset.severity === 'intact');
    })();

    if (!normalizedSearch) {
      return byFilter;
    }

    return byFilter.filter(
      (asset) =>
        asset.label.toLowerCase().includes(normalizedSearch) ||
        asset.summary.toLowerCase().includes(normalizedSearch) ||
        asset.kind.toLowerCase().includes(normalizedSearch),
    );
  });

  protected groupedAssets = computed<RepairAssetGroup[]>(() => {
    const grouping = this.selectedGrouping();
    const groups = new Map<string, RepairAssetEntry[]>();

    for (const asset of this.filteredAssets()) {
      const group = this.resolveGroupName(asset, grouping);
      const current = groups.get(group) ?? [];
      current.push(asset);
      groups.set(group, current);
    }

    return Array.from(groups.entries())
      .map(([group, entries]) => ({
        group,
        entries: entries.slice().sort((left, right) => (left.repairPriority ?? 1000) - (right.repairPriority ?? 1000)),
      }))
      .sort((left, right) => left.group.localeCompare(right.group));
  });

  protected setFilter(filter: RepairAssetFilter): void {
    this.selectedFilter.set(filter);
  }

  protected setGrouping(grouping: RepairAssetGrouping): void {
    this.selectedGrouping.set(grouping);
  }

  protected setSearchQuery(searchQuery: string): void {
    this.searchQuery.set(searchQuery);
  }

  protected getGroupingLabel(): string {
    const grouping = this.selectedGrouping();
    if (grouping === 'severity') {
      return this.t.game.repairRetrofitItems.groupSeverityLabel;
    }

    if (grouping === 'priority-band') {
      return this.t.game.repairRetrofitItems.groupPriorityLabel;
    }

    return this.t.game.repairRetrofitItems.groupAssetTypeLabel;
  }

  protected getRequiredMaterials(asset: RepairAssetEntry): string {
    if (asset.severity === 'intact') {
      return this.t.game.repairRetrofitItems.noMaterialsRequired;
    }

    if (asset.kind === 'ship') {
      return this.t.game.repairRetrofitItems.shipRepairMaterials;
    }

    if (asset.kind === 'ship-system') {
      return this.t.game.repairRetrofitItems.systemRepairMaterials;
    }

    return this.t.game.repairRetrofitItems.itemRepairMaterials;
  }

  protected getEstimatedWindow(asset: RepairAssetEntry): string {
    if (asset.severity === 'critical' || asset.severity === 'disabled' || asset.severity === 'destroyed') {
      return '2h 30m';
    }

    if (asset.severity === 'major' || asset.severity === 'damaged') {
      return '1h 20m';
    }

    if (asset.severity === 'minor') {
      return '35m';
    }

    return '0m';
  }

  protected getEstimatedCost(asset: RepairAssetEntry): string {
    if (asset.severity === 'critical' || asset.severity === 'disabled' || asset.severity === 'destroyed') {
      return '980 CR';
    }

    if (asset.severity === 'major' || asset.severity === 'damaged') {
      return '560 CR';
    }

    if (asset.severity === 'minor') {
      return '210 CR';
    }

    return '0 CR';
  }

  protected getBlockedReason(asset: RepairAssetEntry): string {
    if (asset.severity === 'intact') {
      return this.t.game.repairRetrofitItems.blockedReasonNoAction;
    }

    if (asset.kind !== 'ship') {
      return this.t.game.repairRetrofitItems.blockedReasonMissionPartsUnavailable;
    }

    if (
      asset.kind === 'ship' &&
      (asset.severity === 'critical' || asset.severity === 'disabled' || asset.severity === 'destroyed')
    ) {
      return this.t.game.repairRetrofitItems.blockedReasonDockLock;
    }

    return this.t.game.repairRetrofitItems.blockedReasonNone;
  }

  protected getActionAvailability(asset: RepairAssetEntry): string {
    if (asset.severity === 'intact') {
      return this.t.game.repairRetrofitItems.actionAvailabilityNoAction;
    }

    if (asset.kind !== 'ship') {
      return this.t.game.repairRetrofitItems.actionAvailabilityBlocked;
    }

    return this.t.game.repairRetrofitItems.actionAvailabilityReady;
  }

  protected canOpenDetail(asset: RepairAssetEntry): boolean {
    return asset.severity !== 'intact';
  }

  protected canRepairAsset(asset: RepairAssetEntry): boolean {
    return asset.severity !== 'intact' && asset.kind === 'ship';
  }

  protected isRepairing(asset: RepairAssetEntry): boolean {
    return this.activeRepairKey() === asset.key;
  }

  protected getRepairLabel(asset: RepairAssetEntry): string {
    if (asset.kind === 'ship-system') {
      return this.t.game.repairRetrofitItems.repairSystemLabel;
    }

    if (asset.kind === 'inventory-item') {
      return this.t.game.repairRetrofitItems.repairItemLabel;
    }

    return this.t.game.repairRetrofitItems.repairShipLabel;
  }

  /**
   * Dispatches repair action to the correct handler for ship/system/inventory asset types.
   */
  protected repairAsset(asset: RepairAssetEntry): void {
    if (!this.canRepairAsset(asset)) {
      return;
    }

    if (asset.kind === 'ship-system') {
      this.repairSystemAsset(asset);
      return;
    }

    if (asset.kind === 'inventory-item') {
      this.repairInventoryAsset(asset);
      return;
    }

    this.repairShipAsset(asset);
  }

  /**
   * Queues hull patch kit printing after verifying required consumable materials.
   */
  protected queueForPrinting(): void {
    if (this.isQueueingHullPatchKit()) {
      return;
    }

    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const ship = this.joinShip();
    const consumedMaterials = findConsumableMaterialsForPrintableItem(ship?.inventory, this.hullPatchKitPrintableItem);
    if (!playerName || !characterId || !sessionKey || !ship?.id || !consumedMaterials) {
      this.persistError.set(this.getHullPatchKitRequirementMessage());
      return;
    }

    this.persistError.set(null);
    this.persistSuccess.set(null);
    this.isQueueingHullPatchKit.set(true);

    const actionCorrelationId = `repair-retrofit-items.queue-hull-patch-kit:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2)}`;

    this.consumePrintableMaterials(playerName, sessionKey, consumedMaterials, 0, actionCorrelationId, () => {
      this.joinShip.update((current) => {
        if (!current) {
          return current;
        }

        const consumedMaterialIds = new Set(consumedMaterials.map((material) => material.id));
        return {
          ...current,
          inventory: (current.inventory ?? []).filter((item) => !consumedMaterialIds.has(item.id)),
        };
      });

      this.printerService.addToQueue(playerName, characterId, {
        itemType: this.hullPatchKitPrintableItem.itemType,
        label: this.hullPatchKitPrintableItem.displayName,
        durationMs: this.hullPatchKitPrintableItem.durationMs,
        consumedMaterials,
      });
      this.isQueueingHullPatchKit.set(false);
      this.persistSuccess.set(
        `${this.hullPatchKitPrintableItem.displayName} ${this.t.game.repairRetrofitItems.printQueuedPrefix} ${formatPrintableDuration(this.hullPatchKitPrintableItem.durationMs)}. ${this.t.game.repairRetrofitItems.printQueuedSuffix}`,
      );
    });
  }

  protected navigateToRepairDetail(asset: RepairAssetEntry): void {
    const targetRoute = this.resolveDetailRoute(asset.kind);
    const state: RepairDetailNavigationState = {
      playerName: this.playerName(),
      joinCharacter: this.joinCharacter(),
      joinShip: this.joinShip(),
      damageProfile: this.damageProfile(),
      asset,
      selectedFilter: this.selectedFilter(),
      selectedGrouping: this.selectedGrouping(),
      searchQuery: this.searchQuery(),
      missionId: this.missionId(),
    };

    this.router.navigate([{ outlets: { right: [targetRoute], left: ['repair-retrofit'] } }], {
      preserveFragment: true,
      queryParams: { repairNav: Date.now() },
      state,
    });
  }

  private isCriticalSeverity(severity: string): boolean {
    return severity === 'critical' || severity === 'disabled' || severity === 'destroyed';
  }

  private repairShipAsset(asset: RepairAssetEntry): void {
    const profile = this.damageProfile();
    const ship = this.joinShip();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!profile || !ship?.id || !characterId || !playerName || !sessionKey) {
      this.persistError.set(this.t.game.repairRetrofitItems.missingShipContextError);
      return;
    }

    const nextProfile: ShipDamageProfile = {
      ...profile,
      overallStatus: 'intact',
      summary: describeSummaryForSystems([]),
      systems: [],
      updatedAt: new Date().toISOString(),
    };

    // When repairing ship to fully intact, consume a hull patch kit if present
    const isFullRepair = profile.overallStatus !== 'intact';
    let kitItem: ShipItem | null = null;
    let nextInventory = ship.inventory ?? [];

    if (isFullRepair) {
      kitItem = this.resolveHullPatchKitItem(ship);
      if (kitItem) {
        const kitId = kitItem.id;
        nextInventory = nextInventory.filter((item) => item.id !== kitId);
      }
    }

    const correlationId = `repair:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    this.startPersistForAsset(asset.key);
    this.socketService.upsertShip(
      {
        playerName,
        characterId,
        sessionKey,
        correlationId,
        ship: {
          id: ship.id,
          status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
          damageProfile: nextProfile,
          inventory: nextInventory,
          spatial: ship.spatial,
        },
      },
      (response: ShipUpsertResponse) => {
        this.finishPersist();
        if (!response.success) {
          this.persistError.set(response.message || this.t.game.repairRetrofitItems.shipRepairPersistFailed);
          return;
        }

        this.damageProfile.set(nextProfile);
        this.joinShip.update((current) => (current ? { ...current, damageProfile: nextProfile } : current));

        // Optimistically mark kit as consumed in shadow service
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

        this.persistSuccess.set(`${asset.label} ${this.t.game.repairRetrofitItems.shipRepairedSuffix}`);
        this.advanceMissionGateOnRepair(characterId, 'ship');

        // Fire-and-forget item upsert for kit destruction
        if (kitItem) {
          this.socketService.upsertItem(
            {
              playerName,
              sessionKey,
              correlationSource: 'repair-retrofit-items.repair-ship-asset',
              item: {
                id: kitItem.id,
                state: 'destroyed',
                damageStatus: 'destroyed',
                container: null,
                spatial: null,
                motion: null,
              },
            },
          );
        }
      },
    );
  }

  private repairSystemAsset(asset: RepairAssetEntry): void {
    const profile = this.damageProfile();
    const ship = this.joinShip();
    const code = asset.systemCode;
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!profile || !ship?.id || !code || !characterId || !playerName || !sessionKey) {
      this.persistError.set(this.t.game.repairRetrofitItems.missingSystemContextError);
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

    this.startPersistForAsset(asset.key);
    this.socketService.upsertShip(
      {
        playerName,
        characterId,
        sessionKey,
        ship: {
          id: ship.id,
          status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
          damageProfile: nextProfile,
          spatial: ship.spatial,
        },
      },
      (response: ShipUpsertResponse) => {
        this.finishPersist();
        if (!response.success) {
          this.persistError.set(response.message || this.t.game.repairRetrofitItems.systemRepairPersistFailed);
          return;
        }

        this.damageProfile.set(nextProfile);
        this.joinShip.update((current) => (current ? { ...current, damageProfile: nextProfile } : current));
        this.persistSuccess.set(`${asset.label} ${this.t.game.repairRetrofitItems.systemRepairedSuffix}`);
      },
    );
  }

  private repairInventoryAsset(asset: RepairAssetEntry): void {
    const ship = this.joinShip();
    const itemId = asset.itemId;
    const playerName = this.playerName().trim();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const item = (ship?.inventory ?? []).find((entry) => entry.id === itemId) as ShipItem | undefined;

    if (!item || !playerName || !sessionKey) {
      this.persistError.set(this.t.game.repairRetrofitItems.missingItemContextError);
      return;
    }

    this.startPersistForAsset(asset.key);
    this.socketService.upsertItem(
      {
        playerName,
        sessionKey,
        item: {
          id: item.id,
          damageStatus: 'intact',
        },
      },
      (response: ItemUpsertResponse) => {
        this.finishPersist();
        if (!response.success || !response.item) {
          this.persistError.set(response.message || this.t.game.repairRetrofitItems.itemRepairPersistFailed);
          return;
        }

        this.joinShip.update((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            inventory: (current.inventory ?? []).map((entry) =>
              entry.id === response.item!.id ? response.item! : entry,
            ),
          };
        });
        this.persistSuccess.set(`${asset.label} ${this.t.game.repairRetrofitItems.itemRepairedSuffix}`);
      },
    );
  }

  private advanceMissionGateOnRepair(characterId: string, repairKind: string): void {
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
      repairKind,
    });
    const nextGateState = evaluation.changed ? evaluation.gateState : gateState;

    if (evaluation.changed) {
      this.missionStateService.saveState(context, evaluation.gateState);
    }

    // Ship repair is the mission-completion gate for first-target; always attempt
    // an idempotent backend upsert so mission-list status cannot silently drift.
    if (repairKind === 'ship' || evaluation.changed) {
      void this.syncMissionProgressToBackend(nextGateState);
    }
  }

  private async syncMissionProgressToBackend(gateState: ShipExteriorMissionGateState): Promise<void> {
    await this.missionProgressSyncService.syncGateState({
      playerName: this.playerName(),
      characterId: this.joinCharacter()?.id ?? '',
      sessionKey: this.sessionService.getSessionKey() ?? '',
      gateState,
    });
  }

  private consumePrintableMaterials(
    playerName: string,
    sessionKey: string,
    consumedMaterials: readonly PrintableConsumedMaterial[],
    index: number,
    actionCorrelationId: string,
    onComplete: () => void,
  ): void {
    const nextMaterial = consumedMaterials[index];
    if (!nextMaterial) {
      onComplete();
      return;
    }

    this.socketService.upsertItem(
      {
        playerName,
        sessionKey,
        correlationId: actionCorrelationId,
        correlationSource: `repair-retrofit-items.consume-print-material.step-${index}`,
        item: {
          id: nextMaterial.id,
          state: 'destroyed',
          damageStatus: 'destroyed',
          container: null,
          destroyedAt: new Date().toISOString(),
          destroyedReason: `Consumed by 3D printer job: ${this.hullPatchKitPrintableItem.itemType}`,
        },
      },
      (response) => {
        if (!response.success) {
          this.isQueueingHullPatchKit.set(false);
          this.persistError.set(
            response.message ||
              `${this.t.game.repairRetrofitItems.consumeMaterialFailedPrefix} ${nextMaterial.label} ${this.t.game.repairRetrofitItems.consumeMaterialFailedSuffix}`,
          );
          return;
        }

        this.consumePrintableMaterials(
          playerName,
          sessionKey,
          consumedMaterials,
          index + 1,
          actionCorrelationId,
          onComplete,
        );
      },
    );
  }

  protected getHullPatchKitRequirementMessage(): string {
    const missingMaterials = getMissingPrintableMaterials(this.hullPatchKitPrintableItem, this.joinShip()?.inventory);
    return missingMaterials.length > 0
      ? `${missingMaterials.join(', ')} ${this.t.game.repairRetrofitItems.missingMaterialsRequiredSuffix}`
      : `${describePrintableMaterials(this.hullPatchKitPrintableItem).join(', ')} ${this.t.game.repairRetrofitItems.missingMaterialsRequiredSuffix}`;
  }

  protected getHullPatchKitMaterialLabels(): string {
    return describePrintableMaterials(this.hullPatchKitPrintableItem).join(', ');
  }

  protected getHullPatchKitDurationLabel(): string {
    return formatPrintableDuration(this.hullPatchKitPrintableItem.durationMs);
  }

  private startPersistForAsset(assetKey: string): void {
    this.activeRepairKey.set(assetKey);
    this.persistError.set(null);
    this.persistSuccess.set(null);
  }

  private finishPersist(): void {
    this.activeRepairKey.set(null);
  }

  private resolveHullPatchKitItem(ship: ShipSummary | null): ShipItem | null {
    if (!ship?.inventory) {
      return null;
    }

    for (const item of ship.inventory) {
      if (!item) continue;

      const itemTypeNorm = item.itemType?.toLowerCase() ?? '';
      const displayNameNorm = item.displayName?.toLowerCase() ?? '';

      // Resolve by itemType or displayName using exact match or substring inclusion
      const isTypeMatch =
        itemTypeNorm === 'hull-patch-kit' ||
        itemTypeNorm.includes('hull-patch-kit') ||
        displayNameNorm === 'hull patch kit' ||
        displayNameNorm.includes('hull patch kit');

      if (!isTypeMatch) {
        continue;
      }

      // Check if item is usable (contained and not destroyed)
      const isUsableState = item.state === 'contained' || item.state === null;
      const isNotDestroyed = (item.destroyedAt == null && item.destroyedReason == null);

      if (isUsableState && isNotDestroyed) {
        return item;
      }
    }

    return null;
  }

  private resolveGroupName(asset: RepairAssetEntry, grouping: RepairAssetGrouping): string {
    if (grouping === 'severity') {
      return asset.severity.toUpperCase();
    }

    if (grouping === 'priority-band') {
      const priority = asset.repairPriority ?? 1000;
      if (priority <= 1) {
        return this.t.game.repairRetrofitItems.priority1;
      }
      if (priority <= 3) {
        return this.t.game.repairRetrofitItems.priority2to3;
      }
      return this.t.game.repairRetrofitItems.priority4plus;
    }

    if (asset.kind === 'ship') {
      return this.t.game.repairRetrofitItems.shipsGroupLabel;
    }

    if (asset.kind === 'ship-system') {
      return this.t.game.repairRetrofitItems.shipSystemsGroupLabel;
    }

    return this.t.game.repairRetrofitItems.inventoryItemsGroupLabel;
  }

  private resolveDetailRoute(kind: RepairAssetKind): string {
    if (kind === 'ship-system') {
      return 'repair-retrofit-system-detail';
    }

    if (kind === 'inventory-item') {
      return 'repair-retrofit-item-detail';
    }

    return 'repair-retrofit-ship-detail';
  }

  protected navigateToPrintQueue(): void {
    const state: PrintQueueNavigationState = {
      playerName: this.playerName(),
      joinCharacter: this.joinCharacter(),
      joinShip: this.joinShip(),
    };

    this.router.navigate([{ outlets: { right: ['print-queue'], left: ['repair-retrofit'] } }], {
      preserveFragment: true,
      state,
    });
  }
}
