import { Injectable } from '@angular/core';
import type { ShipItem } from '../model/ship-item';

@Injectable({
  providedIn: 'root',
})
/**
 * Error logger for consumed inventory items that reappear from the backend.
 * If a consumed item reappears after repair, logs an error to surface backend persistence issues.
 * (Previous: silently filtered stale items. Now: emit errors so bugs are visible.)
 */
export class ConsumedItemShadowService {
  private static readonly STORAGE_PREFIX = 'consumed-item-log';

  markConsumed(playerName: string, characterId: string, itemId: string): void {
    const key = this.buildKey(playerName, characterId);
    const normalizedItemId = itemId?.trim();
    if (!key || !normalizedItemId || typeof window === 'undefined') {
      return;
    }

    const existing = this.loadConsumedSetByKey(key);
    if (existing.has(normalizedItemId)) {
      return;
    }

    existing.add(normalizedItemId);
    this.saveConsumedSetByKey(key, existing);
  }

  /**
   * Returns inventory filtered to remove consumed items, while logging an error when
   * a consumed item reappears from the backend.
   */
  filterInventory(
    playerName: string,
    characterId: string,
    inventory: readonly ShipItem[] | undefined,
  ): ShipItem[] {
    const key = this.buildKey(playerName, characterId);
    const inventoryArray = [...(inventory ?? [])];
    if (!key) {
      return inventoryArray;
    }

    const consumed = this.loadConsumedSetByKey(key);
    if (consumed.size === 0) {
      return inventoryArray;
    }

    return inventoryArray.filter((item) => {
      if (!consumed.has(item.id)) {
        return true;
      }

      console.error(
        `[Backend Persistence Bug] Consumed item reappeared after repair: ${item.id} (${item.displayName || item.itemType}). ` +
          `This indicates a backend concurrency issue in ship/inventory persistence.`,
      );
      return false;
    });
  }

  checkInventoryForConsumedItems(
    playerName: string,
    characterId: string,
    inventory: readonly ShipItem[] | undefined,
  ): ShipItem[] {
    return this.filterInventory(playerName, characterId, inventory);
  }

  private buildKey(playerName: string, characterId: string): string {
    const normalizedPlayer = playerName?.trim();
    const normalizedCharacter = characterId?.trim();
    if (!normalizedPlayer || !normalizedCharacter) {
      return '';
    }

    return `${ConsumedItemShadowService.STORAGE_PREFIX}:${normalizedPlayer}:${normalizedCharacter}`;
  }

  private loadConsumedSetByKey(key: string): Set<string> {
    if (typeof window === 'undefined') {
      return new Set<string>();
    }

    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (!Array.isArray(parsed)) {
        return new Set<string>();
      }

      return new Set<string>(parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0));
    } catch {
      return new Set<string>();
    }
  }

  private saveConsumedSetByKey(key: string, consumed: Set<string>): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(Array.from(consumed)));
  }
}