import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { environment } from '../../../environments/environment';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
  EXPENDABLE_DART_DRONE_DISPLAY_NAME,
  EXPENDABLE_DART_DRONE_ITEM_TYPE,
} from '../../model/domain/expendable-dart-drone';
import type { ItemUpsertResponse } from '../../model/item-upsert';
import { ShipItem } from '../../model/ship-item';
import {
  coerceShipDamageProfileOrNull,
  coerceShipInventory,
  coerceShipModel,
  coerceShipStatus,
  coerceShipTier,
  type ShipListRequest,
  type ShipListResponse,
  ShipSummary,
} from '../../model/ship-list';
import type { ShipSubsystemDamage } from '../../model/ship-damage';
import { SessionService } from '../../services/session.service';
import { ConsumedItemShadowService } from '../../services/consumed-item-shadow.service';
import { ShipService } from '../../services/ship.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { SocketService } from '../../services/socket.service';

interface ShipViewInventoryNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
  joinShip?: ShipSummary;
}

export interface InventoryGroup {
  groupKey: string;
  itemType: string;
  name: string;
  quantity: number;
  tier: number | null;
  item: ShipItem;
}

type InventorySortKey = 'name' | 'tier';
type SortDirection = 'asc' | 'desc';
type DevInventoryActionKey = 'add-dart-drone' | 'add-sensor-array' | 'add-tractor-beam';

interface DevInventoryAction {
  key: DevInventoryActionKey;
  label: string;
  buttonLabel: string;
}

const SENSOR_ARRAY_ITEM_TYPE = 'sensor-array';
const SENSOR_ARRAY_DISPLAY_NAME = 'Sensor Array';
const TRACTOR_BEAM_ITEM_TYPE = 'ship-tractor-beam';
const TRACTOR_BEAM_DISPLAY_NAME = 'Tractor Beam';
const SENSOR_ARRAY_MIN_TIER = 1;
const SENSOR_ARRAY_MAX_TIER = 20;

@Component({
  selector: 'app-ship-view-inventory-page',
  templateUrl: './ship-view-inventory.html',
  styleUrls: ['./ship-view-inventory.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Ship inventory page with grouped item views, item upserts, and server refresh helpers.
 */
export default class ShipViewInventoryPage implements OnDestroy {
  protected readonly t = locale;
  protected readonly showDevTools = !environment.production;
  protected readonly devInventoryActions: readonly DevInventoryAction[] = [
    {
      key: 'add-dart-drone',
      label: 'Expendable Dart Drone',
      buttonLabel: 'Add',
    },
    {
      key: 'add-sensor-array',
      label: 'Sensor Array',
      buttonLabel: 'Add',
    },
    {
      key: 'add-tractor-beam',
      label: 'Tractor Beam',
      buttonLabel: 'Add',
    },
  ];
  private router = inject(Router);
  private socketService = inject(SocketService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private shipService = inject(ShipService);
  private consumedItemShadowService = inject(ConsumedItemShadowService);
  private sessionService = inject(SessionService);
  private navigationState: ShipViewInventoryNavigationState =
    resolveNavigationState<ShipViewInventoryNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
  protected readonly sortKey = signal<InventorySortKey | null>(null);
  protected readonly sortDirection = signal<SortDirection>('asc');
  private readonly equippedTierByItemType = computed<Map<string, number>>(() => {
    const inventory = this.resolveDisplayInventory(this.joinShip());
    const highestTierByItemType = new Map<string, number>();

    for (const item of inventory) {
      if (typeof item.tier !== 'number') {
        continue;
      }

      const currentHighestTier = highestTierByItemType.get(item.itemType);
      if (currentHighestTier === undefined || item.tier > currentHighestTier) {
        highestTierByItemType.set(item.itemType, item.tier);
      }
    }

    return highestTierByItemType;
  });

  constructor() {
    this.syncActiveShip(this.joinShip());
    this.socketLifecycleService.runWhenConnected(() => this.refreshShipFromServer());
  }

  private syncActiveShip(ship: ShipSummary | null): void {
    if (!ship) {
      return;
    }

    this.sessionService.setActiveShip(ship);
  }

  private coerceSubsystemItemType(system: ShipSubsystemDamage): string {
    const fromCode = system.code.trim().toLowerCase();
    if (fromCode.length > 0) {
      return fromCode;
    }

    return system.label
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private hasInventoryMatchForSubsystem(system: ShipSubsystemDamage, inventory: readonly ShipItem[]): boolean {
    const expectedTypeFromCode = this.coerceSubsystemItemType(system);
    const expectedTypeFromLabel = system.label
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const expectedLabel = system.label.trim().toLowerCase();

    return inventory.some((item) => {
      const itemType = item.itemType?.trim().toLowerCase() ?? '';
      const itemLabel = item.displayName?.trim().toLowerCase() ?? '';
      return itemType === expectedTypeFromCode || itemType === expectedTypeFromLabel || itemLabel === expectedLabel;
    });
  }

  private resolveDisplayInventory(ship: ShipSummary | null): ShipItem[] {
    if (!ship) {
      return [];
    }

    const visibleInventory = this.consumedItemShadowService.filterInventory(
      this.playerName(),
      this.joinCharacter()?.id ?? '',
      ship.inventory,
    );
    const inventory = [...visibleInventory].filter(
      (item) => item.state !== 'destroyed' && item.damageStatus !== 'destroyed',
    );
    const systems = ship.damageProfile?.systems ?? [];
    for (const system of systems) {
      if (this.hasInventoryMatchForSubsystem(system, inventory)) {
        continue;
      }

      const now = new Date().toISOString();
      const itemType = this.coerceSubsystemItemType(system) || 'unknown-subsystem';
      inventory.push({
        id: `damage-system:${ship.id}:${itemType}`,
        itemType,
        displayName: system.label,
        launchable: false,
        state: 'contained',
        damageStatus: 'damaged',
        container: { containerType: 'ship', containerId: ship.id },
        owningPlayerId: this.playerName() || null,
        owningCharacterId: this.joinCharacter()?.id ?? null,
        spatial: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return inventory;
  }

  protected inventoryGroups = computed<InventoryGroup[]>(() => {
    const inventory = this.resolveDisplayInventory(this.joinShip());
    const counts = new Map<string, InventoryGroup>();
    for (const item of inventory) {
      const groupKey = this.buildInventoryGroupKey(item);
      const existing = counts.get(groupKey);
      if (existing) {
        existing.quantity += 1;
        continue;
      }

      counts.set(groupKey, {
        groupKey,
        itemType: item.itemType,
        name: item.displayName,
        quantity: 1,
        tier: typeof item.tier === 'number' ? item.tier : null,
        item,
      });
    }

    const groups = Array.from(counts.values());
    const activeSortKey = this.sortKey();
    if (!activeSortKey) {
      return groups;
    }

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...groups].sort((left, right) => {
      if (activeSortKey === 'name') {
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) * direction;
      }

      // Always push missing tiers to the end so real tiers remain visible first.
      if (left.tier === null && right.tier === null) {
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) * direction;
      }
      if (left.tier === null) {
        return 1;
      }
      if (right.tier === null) {
        return -1;
      }

      if (left.tier === right.tier) {
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) * direction;
      }

      return (left.tier - right.tier) * direction;
    });
  });

  protected toggleSort(key: InventorySortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set('asc');
  }

  protected sortIndicator(key: InventorySortKey): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  protected isSortActive(key: InventorySortKey): boolean {
    return this.sortKey() === key;
  }

  protected getShipDisplayName(): string {
    const ship = this.joinShip();
    return ship?.name?.trim() || ship?.id || '';
  }

  protected isEquippedGroup(group: InventoryGroup): boolean {
    if (group.tier === null) {
      return false;
    }

    return this.equippedTierByItemType().get(group.itemType) === group.tier;
  }

  protected hasNonIntactStatus(group: InventoryGroup): boolean {
    return group.item.damageStatus !== 'intact';
  }

  ngOnDestroy(): void {}

  navigateBackToHangar(): void {
    this.router.navigate([{ outlets: { left: ['ship-hangar'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
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

  /**
   * Navigates to item specs page for the selected grouped inventory item.
   */
  navigateToItemSpecs(group: InventoryGroup): void {
    this.router.navigate([{ outlets: { right: ['item-view-specs'], left: ['ship-view-inventory'] } }], {
      preserveFragment: true,
      queryParams: { specsNav: Date.now() },
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
        itemType: group.itemType,
        item: group.item,
      },
    });
  }

  /**
   * Adds a starter expendable drone item directly into current ship inventory.
   */
  addDroneToInventory(): void {
    const ship = this.joinShip();
    const sessionKey = this.sessionService.getSessionKey();
    if (!ship || !sessionKey) {
      return;
    }

    this.socketService.upsertItem(
      {
        playerName: this.playerName(),
        sessionKey,
        item: {
          itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
          displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
          state: 'contained',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: ship.id },
          owningPlayerId: this.playerName(),
          owningCharacterId: this.joinCharacter()?.id ?? null,
        },
      },
      (response: ItemUpsertResponse) => {
        if (!response.success || !response.item) {
          console.log('Add drone failed:', response.message);
          return;
        }

        let updatedShip: ShipSummary | null = null;
        this.joinShip.update((current) => {
          if (!current) return current;
          updatedShip = { ...current, inventory: [...(current.inventory ?? []), response.item!] };
          return updatedShip;
        });
        this.syncActiveShip(updatedShip);
      },
    );
  }

  /**
   * Adds a sensor array item into current ship inventory for dev testing.
   */
  addSensorArrayToInventory(): void {
    if (environment.production) {
      return;
    }

    const tier = this.promptSensorArrayTier();
    if (tier === null) {
      return;
    }

    const ship = this.joinShip();
    const sessionKey = this.sessionService.getSessionKey();
    if (!ship || !sessionKey) {
      return;
    }

    this.socketService.upsertItem(
      {
        playerName: this.playerName(),
        sessionKey,
        item: {
          itemType: SENSOR_ARRAY_ITEM_TYPE,
          displayName: SENSOR_ARRAY_DISPLAY_NAME,
          tier,
          state: 'contained',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: ship.id },
          owningPlayerId: this.playerName(),
          owningCharacterId: this.joinCharacter()?.id ?? null,
        },
      },
      (response: ItemUpsertResponse) => {
        if (!response.success || !response.item) {
          console.log('Add sensor array failed:', response.message);
          return;
        }

        let updatedShip: ShipSummary | null = null;
        this.joinShip.update((current) => {
          if (!current) return current;
          updatedShip = { ...current, inventory: [...(current.inventory ?? []), response.item!] };
          return updatedShip;
        });
        this.syncActiveShip(updatedShip);
      },
    );
  }

  /**
   * Adds a tractor beam item into current ship inventory for dev testing.
   */
  addTractorBeamToInventory(): void {
    if (environment.production) {
      return;
    }

    const tier = this.promptTier(`${TRACTOR_BEAM_DISPLAY_NAME} tier`);
    if (tier === null) {
      return;
    }

    const ship = this.joinShip();
    const sessionKey = this.sessionService.getSessionKey();
    if (!ship || !sessionKey) {
      return;
    }

    this.socketService.upsertItem(
      {
        playerName: this.playerName(),
        sessionKey,
        item: {
          itemType: TRACTOR_BEAM_ITEM_TYPE,
          displayName: TRACTOR_BEAM_DISPLAY_NAME,
          tier,
          state: 'contained',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: ship.id },
          owningPlayerId: this.playerName(),
          owningCharacterId: this.joinCharacter()?.id ?? null,
        },
      },
      (response: ItemUpsertResponse) => {
        if (!response.success || !response.item) {
          console.log('Add tractor beam failed:', response.message);
          return;
        }

        let updatedShip: ShipSummary | null = null;
        this.joinShip.update((current) => {
          if (!current) return current;
          updatedShip = { ...current, inventory: [...(current.inventory ?? []), response.item!] };
          return updatedShip;
        });
        this.syncActiveShip(updatedShip);
      },
    );
  }

  protected runDevInventoryAction(actionKey: DevInventoryActionKey): void {
    switch (actionKey) {
      case 'add-dart-drone':
        this.addDroneToInventory();
        return;
      case 'add-sensor-array':
        this.addSensorArrayToInventory();
        return;
      case 'add-tractor-beam':
        this.addTractorBeamToInventory();
        return;
      default: {
        const exhaustiveCheck: never = actionKey;
        throw new Error(`Unsupported dev inventory action: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private clampSensorArrayTier(tier: number): number {
    return Math.max(SENSOR_ARRAY_MIN_TIER, Math.min(SENSOR_ARRAY_MAX_TIER, Math.trunc(tier)));
  }

  private promptSensorArrayTier(): number | null {
    return this.promptTier(`${SENSOR_ARRAY_DISPLAY_NAME} tier`);
  }

  private promptTier(itemLabel: string): number | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const rawValue = window.prompt(
      `${itemLabel} (${SENSOR_ARRAY_MIN_TIER}-${SENSOR_ARRAY_MAX_TIER})`,
      String(SENSOR_ARRAY_MIN_TIER),
    );
    if (rawValue === null) {
      return null;
    }

    const parsed = Number.parseInt(rawValue.trim(), 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return this.clampSensorArrayTier(parsed);
  }

  private buildInventoryGroupKey(item: ShipItem): string {
    const tierToken = typeof item.tier === 'number' ? String(item.tier) : 'none';
    return `${item.itemType}::tier:${tierToken}`;
  }

  /**
   * Reloads the active ship from backend ship-list for freshest inventory state.
   */
  private refreshShipFromServer(): void {
    const sessionKey = this.sessionService.getSessionKey();
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim();
    const shipId = this.joinShip()?.id?.trim();
    if (!sessionKey || !playerName || !characterId || !shipId) {
      return;
    }

    const request: ShipListRequest = { playerName, characterId, sessionKey };
    this.shipService.listShips(request, (response: ShipListResponse) => {
      if (!response.success) {
        return;
      }

      const matchingShip = (response.ships ?? []).find((ship) => ship.id === shipId);
      if (matchingShip) {
        const normalizedShip = this.normalizeShipSummary(matchingShip);
        this.joinShip.set(normalizedShip);
        this.syncActiveShip(normalizedShip);
      }
    });
  }

  private normalizeShipSummary(ship: ShipSummary): ShipSummary {
    const rawShip = ship as ShipSummary & { modelName?: string; tierLevel?: number };
    return {
      ...ship,
      status: coerceShipStatus(rawShip.status),
      damageProfile: coerceShipDamageProfileOrNull(rawShip.damageProfile),
      model: coerceShipModel(rawShip.model ?? rawShip.modelName),
      tier: coerceShipTier(rawShip.tier ?? rawShip.tierLevel),
      inventory: coerceShipInventory(rawShip.inventory),
    };
  }
}
