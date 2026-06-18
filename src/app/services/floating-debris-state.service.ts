import { Injectable, signal, type Signal } from '@angular/core';
import type { FloatingDebrisItem } from '../model/floating-debris-item';
import { resolveDebrisExternalObjectDescriptor } from '../model/ship-exterior-descriptors';
import type { ShipItem } from '../model/ship-item';

@Injectable({
  providedIn: 'root',
})
export class FloatingDebrisStateService {
  private readonly itemsByScope = new Map<string, Map<string, FloatingDebrisItem>>();
  private activeScopeKey = this.resolveScopeKey(null);
  private readonly itemsSignal = signal<FloatingDebrisItem[]>([]);

  readonly items: Signal<FloatingDebrisItem[]> = this.itemsSignal.asReadonly();

  getAll(): FloatingDebrisItem[] {
    return Array.from(this.getActiveScopeItems().values());
  }

  setScope(celestialBodyId: string | null | undefined): void {
    const nextScopeKey = this.resolveScopeKey(celestialBodyId);
    if (nextScopeKey === this.activeScopeKey) {
      return;
    }

    this.activeScopeKey = nextScopeKey;
    this.itemsSignal.set(this.getAll());
  }

  clear(): void {
    this.getActiveScopeItems().clear();
    this.itemsSignal.set([]);
  }

  upsertFromShipItems(items: readonly ShipItem[]): void {
    const activeScopeItems = this.getActiveScopeItems();
    let changed = false;
    for (const item of items) {
      const mapped = this.mapFromShipItem(item);
      if (!mapped) {
        continue;
      }
      activeScopeItems.set(mapped.id, mapped);
      changed = true;
    }
    if (changed) {
      this.itemsSignal.set(this.getAll());
    }
  }

  replaceFromShipItems(items: readonly ShipItem[]): void {
    const nextItemsById = new Map<string, FloatingDebrisItem>();
    for (const item of items) {
      const mapped = this.mapFromShipItem(item);
      if (!mapped) {
        continue;
      }
      nextItemsById.set(mapped.id, mapped);
    }

    this.itemsByScope.set(this.activeScopeKey, nextItemsById);
    this.itemsSignal.set(this.getAll());
  }

  /** Inserts client-synthesised debris (e.g. cold-boot Sensor Array fallback). */
  upsertLocal(items: readonly FloatingDebrisItem[]): void {
    const activeScopeItems = this.getActiveScopeItems();
    let changed = false;
    for (const item of items) {
      if (!item.id || !item.itemType || !item.positionKm) {
        continue;
      }
      activeScopeItems.set(item.id, item);
      changed = true;
    }
    if (changed) {
      this.itemsSignal.set(this.getAll());
    }
  }

  removeById(id: string): boolean {
    const removed = this.getActiveScopeItems().delete(id);
    if (removed) {
      this.itemsSignal.set(this.getAll());
    }
    return removed;
  }

  private getActiveScopeItems(): Map<string, FloatingDebrisItem> {
    const existing = this.itemsByScope.get(this.activeScopeKey);
    if (existing) {
      return existing;
    }

    const created = new Map<string, FloatingDebrisItem>();
    this.itemsByScope.set(this.activeScopeKey, created);
    return created;
  }

  private resolveScopeKey(celestialBodyId: string | null | undefined): string {
    const normalizedCelestialBodyId = celestialBodyId?.trim();
    return normalizedCelestialBodyId ? `celestial-body:${normalizedCelestialBodyId}` : 'scene';
  }

  private mapFromShipItem(item: ShipItem): FloatingDebrisItem | null {
    if (!item.id || !item.itemType || !item.spatial?.positionKm) {
      return null;
    }

    return {
      id: item.id,
      itemType: item.itemType,
      displayName: item.displayName || item.itemType,
      externalObjectDescriptor: resolveDebrisExternalObjectDescriptor({
        itemType: item.itemType,
        displayName: item.displayName,
      }),
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
      state: item.state ?? undefined,
      damageStatus: item.damageStatus ?? undefined,
    };
  }
}
