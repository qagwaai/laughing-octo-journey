import { Injectable } from '@angular/core';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';

/**
 * Storage key identity used for scan-sample persistence.
 */
export interface ShipExteriorAsteroidStateContext {
  celestialBodyId?: string;
  missionId: string;
  playerName: string;
  characterId: string;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Persists ship-exterior asteroid scan samples in session storage.
 */
export class ShipExteriorAsteroidStateService {
  private static readonly STORAGE_PREFIX = 'ship-exterior:asteroids';
  private static readonly TARGETED_STORAGE_PREFIX = 'ship-exterior:targeted-asteroid';

  /**
   * Restores asteroid scan samples for the active mission/player/character context.
   */
  loadSamples(context: ShipExteriorAsteroidStateContext): AsteroidScanSample[] | null {
    const storageKey = this.resolveStorageKey(context);
    if (!storageKey) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return null;
      }

      return parsed.filter(
        (candidate): candidate is AsteroidScanSample =>
          !!candidate && typeof candidate === 'object' && typeof (candidate as { id?: unknown }).id === 'string',
      );
    } catch {
      return null;
    }
  }

  /**
   * Saves asteroid scan samples so scene reloads can resume prior scan state.
   */
  saveSamples(context: ShipExteriorAsteroidStateContext, samples: readonly AsteroidScanSample[]): void {
    const storageKey = this.resolveStorageKey(context);
    if (!storageKey) {
      return;
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(samples));
    } catch {
      // Storage can fail in private mode/quota limits; callers should continue gracefully.
    }
  }

  /**
   * Clears persisted asteroid scan samples for the given context.
   */
  clearSamples(context: ShipExteriorAsteroidStateContext): void {
    const storageKey = this.resolveStorageKey(context);
    if (!storageKey) {
      return;
    }

    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  /**
   * Restores a previously targeted asteroid sample id for the active context.
   */
  loadTargetedSampleId(context: ShipExteriorAsteroidStateContext): string | null {
    const storageKey = this.resolveTargetedStorageKey(context);
    if (!storageKey) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as { targetedSampleId?: unknown };
      const targetedSampleId = typeof parsed?.targetedSampleId === 'string' ? parsed.targetedSampleId.trim() : '';
      return targetedSampleId ? targetedSampleId : null;
    } catch {
      return null;
    }
  }

  /**
   * Saves the targeted asteroid sample id for the active context.
   */
  saveTargetedSampleId(context: ShipExteriorAsteroidStateContext, targetedSampleId: string | null): void {
    const storageKey = this.resolveTargetedStorageKey(context);
    if (!storageKey) {
      return;
    }

    const normalizedTargetedSampleId = targetedSampleId?.trim() ?? '';
    if (!normalizedTargetedSampleId) {
      this.clearTargetedSampleId(context);
      return;
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ targetedSampleId: normalizedTargetedSampleId }));
    } catch {
      // Storage can fail in private mode/quota limits; callers should continue gracefully.
    }
  }

  /**
   * Clears persisted targeted asteroid id for the given context.
   */
  clearTargetedSampleId(context: ShipExteriorAsteroidStateContext): void {
    const storageKey = this.resolveTargetedStorageKey(context);
    if (!storageKey) {
      return;
    }

    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  private resolveStorageKey(context: ShipExteriorAsteroidStateContext): string | null {
    const celestialBodyId = context.celestialBodyId?.trim();
    if (celestialBodyId) {
      const playerName = context.playerName?.trim().toLowerCase();
      const characterId = context.characterId?.trim();
      if (!playerName || !characterId) {
        return null;
      }

      return `${ShipExteriorAsteroidStateService.STORAGE_PREFIX}:${celestialBodyId}:${playerName}:${characterId}`;
    }

    const missionId = context.missionId?.trim();
    const playerName = context.playerName?.trim().toLowerCase();
    const characterId = context.characterId?.trim();
    if (!missionId || !playerName || !characterId) {
      return null;
    }

    return `${ShipExteriorAsteroidStateService.STORAGE_PREFIX}:${missionId}:${playerName}:${characterId}`;
  }

  private resolveTargetedStorageKey(context: ShipExteriorAsteroidStateContext): string | null {
    const celestialBodyId = context.celestialBodyId?.trim();
    if (celestialBodyId) {
      const playerName = context.playerName?.trim().toLowerCase();
      const characterId = context.characterId?.trim();
      if (!playerName || !characterId) {
        return null;
      }

      return `${ShipExteriorAsteroidStateService.TARGETED_STORAGE_PREFIX}:${celestialBodyId}:${playerName}:${characterId}`;
    }

    const missionId = context.missionId?.trim();
    const playerName = context.playerName?.trim().toLowerCase();
    const characterId = context.characterId?.trim();
    if (!missionId || !playerName || !characterId) {
      return null;
    }

    return `${ShipExteriorAsteroidStateService.TARGETED_STORAGE_PREFIX}:${missionId}:${playerName}:${characterId}`;
  }
}
