import { Injectable } from '@angular/core';
import type { FlightOrientation } from '../scene/ship-exterior/ship-exterior-flight-controls';

export interface ShipExteriorViewStateContext {
  playerName: string;
  characterId: string;
  shipId: string;
}

export interface ShipExteriorViewStateSnapshot extends ShipExteriorViewStateContext {}

export interface ShipExteriorFlightPreferences {
  invertY: boolean;
  mouseSensitivity: number;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Persists ship-exterior camera orientation for the active browser session.
 */
export class ShipExteriorViewStateService {
  private static readonly STORAGE_PREFIX = 'ship-exterior:view-state';
  private static readonly VIEW_CONTEXT_STORAGE_KEY = 'ship-exterior:view-context';
  private static readonly FLIGHT_PREFERENCES_STORAGE_PREFIX = 'ship-exterior:flight-preferences';

  saveCurrentContext(context: ShipExteriorViewStateContext): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    const snapshot: ShipExteriorViewStateSnapshot = {
      playerName: context.playerName?.trim() ?? '',
      characterId: context.characterId?.trim() ?? '',
      shipId: context.shipId?.trim() ?? '',
    };

    try {
      window.sessionStorage.setItem(ShipExteriorViewStateService.VIEW_CONTEXT_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures; callers should continue gracefully.
    }
  }

  loadCurrentContext(): ShipExteriorViewStateSnapshot | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(ShipExteriorViewStateService.VIEW_CONTEXT_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<ShipExteriorViewStateSnapshot>;
      const playerName = typeof parsed.playerName === 'string' ? parsed.playerName.trim() : '';
      const characterId = typeof parsed.characterId === 'string' ? parsed.characterId.trim() : '';
      const shipId = typeof parsed.shipId === 'string' ? parsed.shipId.trim() : '';

      if (!playerName || !characterId || !shipId) {
        return null;
      }

      return { playerName, characterId, shipId };
    } catch {
      return null;
    }
  }

  clearCurrentContext(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.removeItem(ShipExteriorViewStateService.VIEW_CONTEXT_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  loadOrientation(context: ShipExteriorViewStateContext): FlightOrientation | null {
    const storageKey = this.resolveStorageKey(context);
    if (!storageKey) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<FlightOrientation>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const yawRad = Number(parsed.yawRad);
      const pitchRad = Number(parsed.pitchRad);
      const rollRad = Number(parsed.rollRad);
      if (!Number.isFinite(yawRad) || !Number.isFinite(pitchRad) || !Number.isFinite(rollRad)) {
        return null;
      }

      return { yawRad, pitchRad, rollRad };
    } catch {
      return null;
    }
  }

  saveOrientation(context: ShipExteriorViewStateContext, orientation: FlightOrientation): void {
    const storageKey = this.resolveStorageKey(context);
    if (!storageKey) {
      return;
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(orientation));
    } catch {
      // Ignore storage failures; callers should continue gracefully.
    }
  }

  clearOrientation(context: ShipExteriorViewStateContext): void {
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

  loadFlightPreferences(context: ShipExteriorViewStateContext): ShipExteriorFlightPreferences | null {
    const storageKey = this.resolveFlightPreferencesStorageKey(context);
    if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<ShipExteriorFlightPreferences>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const invertY = parsed.invertY;
      const mouseSensitivity = Number(parsed.mouseSensitivity);
      if (typeof invertY !== 'boolean' || !Number.isFinite(mouseSensitivity)) {
        return null;
      }

      return {
        invertY,
        mouseSensitivity,
      };
    } catch {
      return null;
    }
  }

  saveFlightPreferences(context: ShipExteriorViewStateContext, preferences: ShipExteriorFlightPreferences): void {
    const storageKey = this.resolveFlightPreferencesStorageKey(context);
    if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // Ignore storage failures; callers should continue gracefully.
    }
  }

  clearFlightPreferences(context: ShipExteriorViewStateContext): void {
    const storageKey = this.resolveFlightPreferencesStorageKey(context);
    if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
  }

  private resolveStorageKey(context: ShipExteriorViewStateContext): string | null {
    const playerName = context.playerName?.trim().toLowerCase();
    const characterId = context.characterId?.trim();
    const shipId = context.shipId?.trim();
    if (!playerName || !characterId || !shipId) {
      return null;
    }

    return `${ShipExteriorViewStateService.STORAGE_PREFIX}:${playerName}:${characterId}:${shipId}`;
  }

  private resolveFlightPreferencesStorageKey(context: ShipExteriorViewStateContext): string | null {
    const playerName = context.playerName?.trim().toLowerCase();
    const characterId = context.characterId?.trim();
    const shipId = context.shipId?.trim();
    if (!playerName || !characterId || !shipId) {
      return null;
    }

    return `${ShipExteriorViewStateService.FLIGHT_PREFERENCES_STORAGE_PREFIX}:${playerName}:${characterId}:${shipId}`;
  }
}
