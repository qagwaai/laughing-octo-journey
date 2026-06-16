import { Injectable } from '@angular/core';
import type { FlightOrientation } from '../scene/ship-exterior/ship-exterior-flight-controls';

export interface ShipExteriorViewStateContext {
  playerName: string;
  characterId: string;
  shipId: string;
}

export interface ShipExteriorFlightPreferences {
  invertY: boolean;
  mouseSensitivity: number;
}

export interface ShipExteriorCameraPose {
  position: {
    x: number;
    y: number;
    z: number;
  };
  quaternion: {
    w: number;
    x: number;
    y: number;
    z: number;
  };
}

@Injectable({
  providedIn: 'root',
})
/**
 * Persists ship-exterior camera orientation for the active browser session.
 */
export class ShipExteriorViewStateService {
  private static readonly STORAGE_PREFIX = 'ship-exterior:view-state';
  private static readonly CAMERA_POSE_STORAGE_PREFIX = 'ship-exterior:camera-pose';
  private static readonly FLIGHT_PREFERENCES_STORAGE_PREFIX = 'ship-exterior:flight-preferences';
  private static readonly SCENE_ELAPSED_SECONDS_STORAGE_PREFIX = 'ship-exterior:scene-elapsed-seconds';

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

  loadCameraPose(context: ShipExteriorViewStateContext): ShipExteriorCameraPose | null {
    const storageKey = this.resolveCameraPoseStorageKey(context);
    if (!storageKey) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<ShipExteriorCameraPose>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const position = parsed.position;
      const quaternion = parsed.quaternion;
      if (!position || typeof position !== 'object' || !quaternion || typeof quaternion !== 'object') {
        return null;
      }

      const x = Number(position.x);
      const y = Number(position.y);
      const z = Number(position.z);
      const qw = Number(quaternion.w);
      const qx = Number(quaternion.x);
      const qy = Number(quaternion.y);
      const qz = Number(quaternion.z);

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(z) ||
        !Number.isFinite(qw) ||
        !Number.isFinite(qx) ||
        !Number.isFinite(qy) ||
        !Number.isFinite(qz)
      ) {
        return null;
      }

      return {
        position: { x, y, z },
        quaternion: { w: qw, x: qx, y: qy, z: qz },
      };
    } catch {
      return null;
    }
  }

  saveCameraPose(context: ShipExteriorViewStateContext, pose: ShipExteriorCameraPose): void {
    const storageKey = this.resolveCameraPoseStorageKey(context);
    if (!storageKey) {
      return;
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pose));
    } catch {
      // Ignore storage failures; callers should continue gracefully.
    }
  }

  clearCameraPose(context: ShipExteriorViewStateContext): void {
    const storageKey = this.resolveCameraPoseStorageKey(context);
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

  loadSceneElapsedSeconds(context: ShipExteriorViewStateContext): number | null {
    const storageKey = this.resolveSceneElapsedSecondsStorageKey(context);
    if (!storageKey) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as { elapsedSeconds?: unknown };
      const elapsedSeconds = Number(parsed?.elapsedSeconds);
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
        return null;
      }

      return elapsedSeconds;
    } catch {
      return null;
    }
  }

  saveSceneElapsedSeconds(context: ShipExteriorViewStateContext, elapsedSeconds: number): void {
    const storageKey = this.resolveSceneElapsedSecondsStorageKey(context);
    if (!storageKey || !Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      return;
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ elapsedSeconds }));
    } catch {
      // Ignore storage failures; callers should continue gracefully.
    }
  }

  clearSceneElapsedSeconds(context: ShipExteriorViewStateContext): void {
    const storageKey = this.resolveSceneElapsedSecondsStorageKey(context);
    if (!storageKey) {
      return;
    }

    try {
      sessionStorage.removeItem(storageKey);
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

  private resolveCameraPoseStorageKey(context: ShipExteriorViewStateContext): string | null {
    const playerName = context.playerName?.trim().toLowerCase();
    const characterId = context.characterId?.trim();
    const shipId = context.shipId?.trim();
    if (!playerName || !characterId || !shipId) {
      return null;
    }

    return `${ShipExteriorViewStateService.CAMERA_POSE_STORAGE_PREFIX}:${playerName}:${characterId}:${shipId}`;
  }

  private resolveSceneElapsedSecondsStorageKey(context: ShipExteriorViewStateContext): string | null {
    const playerName = context.playerName?.trim().toLowerCase();
    const characterId = context.characterId?.trim();
    const shipId = context.shipId?.trim();
    if (!playerName || !characterId || !shipId) {
      return null;
    }

    return `${ShipExteriorViewStateService.SCENE_ELAPSED_SECONDS_STORAGE_PREFIX}:${playerName}:${characterId}:${shipId}`;
  }
}
