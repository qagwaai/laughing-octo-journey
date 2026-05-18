import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
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
  itemType: string;
  name: string;
  quantity: number;
  item: ShipItem;
}

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

  constructor() {
    this.socketLifecycleService.runWhenConnected(() => this.refreshShipFromServer());
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
      const existing = counts.get(item.itemType);
      if (existing) {
        existing.quantity += 1;
        continue;
      }

      counts.set(item.itemType, {
        itemType: item.itemType,
        name: item.displayName,
        quantity: 1,
        item,
      });
    }
    return Array.from(counts.values());
  });

  protected getShipDisplayName(): string {
    const ship = this.joinShip();
    return ship?.name?.trim() || ship?.id || '';
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

        this.joinShip.update((current) => {
          if (!current) return current;
          return { ...current, inventory: [...(current.inventory ?? []), response.item!] };
        });
      },
    );
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
        this.joinShip.set(this.normalizeShipSummary(matchingShip));
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
