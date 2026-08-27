import { Injectable, inject } from '@angular/core';
import type { LaunchItemResponse, LaunchItemYieldedItem, LaunchItemYieldedMaterial } from '../../model/launch-item';
import type { ShipItem } from '../../model/ship-item';
import type { ShipSummary } from '../../model/ship-list';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

@Injectable({
  providedIn: 'root',
})
export class InventoryRewardService {
  private readonly socketService = inject(SocketService);
  private readonly sessionService = inject(SessionService);

  consumeLaunchedItem(response: LaunchItemResponse): ShipSummary | null {
    const activeShip = this.sessionService.activeShip();
    if (!activeShip || activeShip.id !== response.shipId) {
      return null;
    }

    const nextInventory = (activeShip.inventory ?? []).filter((item) => item.id !== response.itemId);
    const nextShip = {
      ...activeShip,
      inventory: nextInventory,
    };
    this.sessionService.setActiveShip(nextShip);
    return nextShip;
  }

  applyMaterialRewards(
    materials: readonly LaunchItemYieldedMaterial[],
    activeShip: ShipSummary | null = this.sessionService.activeShip(),
    ownerCharacterId: string | null = this.sessionService.activeCharacter()?.id?.trim() ?? null,
  ): ShipSummary | null {
    if (materials.length === 0) {
      return activeShip ?? null;
    }

    if (!activeShip) {
      return null;
    }

    const nowIso = new Date().toISOString();
    const rewardedInventoryItems: ShipItem[] = materials.flatMap((material) => {
      const normalizedItemType = material.material
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-');
      const quantity = Number.isFinite(material.quantity) && material.quantity > 0 ? Math.floor(material.quantity) : 0;
      return Array.from({ length: quantity }, (_, index) => ({
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `reward-${Date.now()}-${normalizedItemType}-${index}`,
        itemType: normalizedItemType || 'unknown-material',
        displayName: `${material.material} (raw material)`,
        launchable: false,
        state: 'contained',
        damageStatus: 'intact',
        container: {
          containerType: 'ship',
          containerId: activeShip.id,
        },
        owningPlayerId: activeShip.ownership?.playerId ?? null,
        owningCharacterId: ownerCharacterId,
        spatial: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));
    });

    if (rewardedInventoryItems.length === 0) {
      return activeShip;
    }

    const nextShip = {
      ...activeShip,
      inventory: [...(activeShip.inventory ?? []), ...rewardedInventoryItems],
    };

    this.sessionService.setActiveShip(nextShip);
    this.persistRewardItemsToBackend(rewardedInventoryItems, {
      playerName: this.sessionService.getPlayerName()?.trim() ?? '',
      characterId: ownerCharacterId ?? this.sessionService.activeCharacter()?.id?.trim() ?? '',
      shipId: activeShip.id,
    });
    return nextShip;
  }

  applyYieldedItems(
    items: readonly LaunchItemYieldedItem[],
    activeShip: ShipSummary | null = this.sessionService.activeShip(),
    ownerCharacterId: string | null = this.sessionService.activeCharacter()?.id?.trim() ?? null,
  ): ShipSummary | null {
    if (items.length === 0 || !activeShip) {
      return activeShip ?? null;
    }

    const yieldedInventoryItems: ShipItem[] = items.flatMap((item) => {
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 0;
      if (quantity === 0) {
        return [];
      }

      const first: ShipItem = {
        id: item.id,
        itemType: item.itemType,
        displayName: item.displayName,
        launchable: item.launchable,
        state: item.state,
        damageStatus: 'intact',
        container: item.container
          ? {
              containerType: item.container.containerType,
              containerId: item.container.containerId,
            }
          : null,
        owningPlayerId: activeShip.ownership?.playerId ?? null,
        owningCharacterId: ownerCharacterId,
        spatial: null,
        destroyedAt: null,
        destroyedReason: null,
        discoveredAt: null,
        discoveredByCharacterId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const rest = Array.from({ length: quantity - 1 }, (_, index) => ({
        ...first,
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${item.id}-copy-${index + 1}`,
      }));
      return [first, ...rest];
    });

    if (yieldedInventoryItems.length === 0) {
      return activeShip;
    }

    const nextShip = {
      ...activeShip,
      inventory: [...(activeShip.inventory ?? []), ...yieldedInventoryItems],
    };

    this.sessionService.setActiveShip(nextShip);
    this.persistRewardItemsToBackend(yieldedInventoryItems, {
      playerName: this.sessionService.getPlayerName()?.trim() ?? '',
      characterId: ownerCharacterId ?? this.sessionService.activeCharacter()?.id?.trim() ?? '',
      shipId: activeShip.id,
    });
    return nextShip;
  }

  persistRewardItemsToBackend(
    items: readonly ShipItem[],
    context: { playerName?: string; characterId?: string; shipId?: string } = {},
  ): void {
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const playerName = (context.playerName ?? this.sessionService.getPlayerName()?.trim() ?? '').trim();
    const characterId = (context.characterId ?? this.sessionService.activeCharacter()?.id?.trim() ?? '').trim();
    const shipId = (context.shipId ?? this.sessionService.activeShip()?.id?.trim() ?? '').trim();

    if (!sessionKey || !playerName || !characterId || !shipId) {
      appLogger.warn('InventoryRewardService.persistRewardItemsToBackend: skipped due to missing context', {
        hasSessionKey: !!sessionKey,
        hasPlayerName: !!playerName,
        hasCharacterId: !!characterId,
        hasShipId: !!shipId,
      });
      return;
    }

    items.forEach((item) => {
      this.socketService.upsertItem(
        {
          playerName,
          sessionKey,
          correlationSource: 'ship-exterior.launch-reward',
          item: {
            id: item.id,
            itemType: item.itemType,
            displayName: item.displayName,
            launchable: item.launchable,
            state: item.state,
            damageStatus: item.damageStatus,
            container: item.container ?? { containerType: 'ship', containerId: shipId },
            owningPlayerId: item.owningPlayerId ?? playerName,
            owningCharacterId: item.owningCharacterId ?? characterId,
          },
        },
        (response) => {
          if (!response.success || !response.item) {
            appLogger.warn('InventoryRewardService.persistRewardItemsToBackend: reward item upsert failed', {
              message: response.message,
              itemId: item.id,
              itemType: item.itemType,
            });
          }
        },
      );
    });
  }
}
