import { Injectable } from '@angular/core';
import type { FloatingDebrisItem } from '../model/floating-debris-item';
import type { ShipItem } from '../model/ship-item';

@Injectable({
  providedIn: 'root',
})
export class FloatingDebrisStateService {
  private itemsById = new Map<string, FloatingDebrisItem>();

  getAll(): FloatingDebrisItem[] {
    return Array.from(this.itemsById.values());
  }

  clear(): void {
    this.itemsById.clear();
  }

  upsertFromShipItems(items: readonly ShipItem[]): void {
    for (const item of items) {
      const mapped = this.mapFromShipItem(item);
      if (!mapped) {
        continue;
      }
      this.itemsById.set(mapped.id, mapped);
    }
  }

  /** Inserts client-synthesised debris (e.g. cold-boot Sensor Array fallback). */
  upsertLocal(items: readonly FloatingDebrisItem[]): void {
    for (const item of items) {
      if (!item.id || !item.itemType || !item.positionKm) {
        continue;
      }
      this.itemsById.set(item.id, item);
    }
  }

  private mapFromShipItem(item: ShipItem): FloatingDebrisItem | null {
    if (!item.id || !item.itemType || !item.spatial?.positionKm) {
      return null;
    }

    return {
      id: item.id,
      itemType: item.itemType,
      displayName: item.displayName || item.itemType,
      positionKm: {
        x: item.spatial.positionKm.x,
        y: item.spatial.positionKm.y,
        z: item.spatial.positionKm.z,
      },
      velocityKmPerSec: item.motion?.velocityKmPerSec
        ? {
            x: item.motion.velocityKmPerSec.x,
            y: item.motion.velocityKmPerSec.y,
            z: item.motion.velocityKmPerSec.z,
          }
        : undefined,
    };
  }
}
