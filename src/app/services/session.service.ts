import { Injectable, signal } from '@angular/core';
import type { PlayerCharacterSummary } from '../model/character-list';
import type { ShipSummary } from '../model/ship-list';
import { isValidShipSpatial } from '../model/spatial';
import { appLogger } from './logger';

const SESSION_KEY_STORAGE_KEY = 'stellar.sessionKey';
const PLAYER_NAME_STORAGE_KEY = 'stellar.playerName';
const ACTIVE_CHARACTER_STORAGE_KEY = 'stellar.activeCharacter';
const MISSION_ENTRY_CONTEXT_STORAGE_KEY = 'stellar.missionEntryContext';

export interface MissionEntryContext {
  playerName: string;
  joinCharacter: PlayerCharacterSummary;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Client session state container for session key and currently active ship.
 */
export class SessionService {
  private sessionKey = signal<string | null>(this.readPersistedSessionKey());
  private activeShipSignal = signal<ShipSummary | null>(null);
  private activeCharacterSignal = signal<PlayerCharacterSummary | null>(this.readPersistedActiveCharacter());
  private playerNameSignal = signal<string | null>(this.readPersistedPlayerName());
  private missionEntryContextSignal = signal<MissionEntryContext | null>(this.readPersistedMissionEntryContext());

  readonly activeShip = this.activeShipSignal.asReadonly();
  readonly activeCharacter = this.activeCharacterSignal.asReadonly();
  readonly playerName = this.playerNameSignal.asReadonly();
  readonly missionEntryContext = this.missionEntryContextSignal.asReadonly();

  /**
   * Persists the current authenticated session key.
   */
  setSessionKey(key: string): void {
    this.sessionKey.set(key);
    this.persistSessionKey(key);
  }

  /**
   * Returns the current session key if one is active.
   */
  getSessionKey(): string | null {
    return this.sessionKey();
  }

  /**
   * Clears all session-scoped state, including selected active ship.
   */
  clearSession(): void {
    this.sessionKey.set(null);
    this.activeShipSignal.set(null);
    this.activeCharacterSignal.set(null);
    this.playerNameSignal.set(null);
    this.missionEntryContextSignal.set(null);
    this.clearPersistedSessionKey();
    this.clearPersistedPlayerName();
    this.clearPersistedActiveCharacter();
    this.clearPersistedMissionEntryContext();
  }

  /**
   * Indicates whether a session key is currently present.
   */
  hasSession(): boolean {
    return this.sessionKey() !== null;
  }

  private normalizeShipId(id: string | undefined | null): string {
    return typeof id === 'string' ? id.trim().toLowerCase() : '';
  }

  /**
   * Sets the active ship used by game pages for contextual operations.
   * Applies stickiness guard: same-ship updates preserve existing usable spatial
   * against stale backend rehydration.
   */
  setActiveShip(ship: ShipSummary): void {
    const current = this.activeShipSignal();
    this.activeShipSignal.set(this.resolveActiveShipUpdate(current, ship));
  }

  /**
   * Forces a spatial update for the active ship, bypassing the stickiness guard.
   * Used exclusively by the flight controller to persist authoritative local position.
   */
  forceUpdateActiveShipSpatial(shipId: string, spatial: ShipSummary['spatial']): void {
    const current = this.activeShipSignal();
    if (!current || this.normalizeShipId(current.id) !== this.normalizeShipId(shipId)) {
      return;
    }
    this.activeShipSignal.set({ ...current, spatial });
  }

  private resolveActiveShipUpdate(current: ShipSummary | null, next: ShipSummary): ShipSummary {
    if (!current || this.normalizeShipId(current.id) !== this.normalizeShipId(next.id)) {
      return next;
    }

    const currentSpatial = current.spatial;
    const nextSpatial = next.spatial;
    const currentSpatialUsable = isValidShipSpatial(currentSpatial);
    const nextSpatialUsable = isValidShipSpatial(nextSpatial);

    if (currentSpatialUsable && !nextSpatialUsable) {
      return {
        ...next,
        spatial: currentSpatial,
      };
    }

    // During an active session, keep the current same-ship usable spatial as
    // the authoritative local last-known location. Some backend list paths can
    // return older coordinates with newer timestamps, which would otherwise
    // roll position back after page transitions.
    if (currentSpatialUsable && nextSpatialUsable) {
      return {
        ...next,
        spatial: currentSpatial,
      };
    }

    return next;
  }

  /**
   * Clears active ship state without affecting the session key.
   */
  clearActiveShip(): void {
    this.activeShipSignal.set(null);
  }

  /**
   * Sets the active character for the current session.
   */
  setActiveCharacter(character: PlayerCharacterSummary): void {
    this.activeCharacterSignal.set(character);
    this.persistActiveCharacter(character);
  }

  /**
   * Clears active character state without affecting the session key.
   */
  clearActiveCharacter(): void {
    this.activeCharacterSignal.set(null);
    this.clearPersistedActiveCharacter();
  }

  setPlayerName(playerName: string): void {
    const normalized = playerName.trim();
    this.playerNameSignal.set(normalized.length > 0 ? normalized : null);
    this.persistPlayerName(normalized);
  }

  getPlayerName(): string | null {
    return this.playerNameSignal();
  }

  clearPlayerName(): void {
    this.playerNameSignal.set(null);
    this.clearPersistedPlayerName();
  }

  setMissionEntryContext(playerName: string, joinCharacter: PlayerCharacterSummary): void {
    const normalizedPlayerName = playerName.trim();
    const normalizedContext =
      normalizedPlayerName.length > 0 && typeof joinCharacter?.id === 'string'
        ? { playerName: normalizedPlayerName, joinCharacter }
        : null;
    this.missionEntryContextSignal.set(normalizedContext);
    if (normalizedContext) {
      this.persistMissionEntryContext(normalizedContext);
    } else {
      this.clearPersistedMissionEntryContext();
    }
  }

  getMissionEntryContext(): MissionEntryContext | null {
    return this.missionEntryContextSignal();
  }

  private readPersistedSessionKey(): string | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const persisted = window.sessionStorage.getItem(SESSION_KEY_STORAGE_KEY)?.trim() ?? '';
      return persisted.length > 0 ? persisted : null;
    } catch (error) {
      appLogger.warn('SessionService.readPersistedSessionKey failed', error);
      return null;
    }
  }

  private persistSessionKey(key: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    const normalized = key.trim();
    if (!normalized) {
      this.clearPersistedSessionKey();
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, normalized);
    } catch (error) {
      appLogger.warn('SessionService.persistSessionKey failed', error);
    }
  }

  private clearPersistedSessionKey(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
    } catch (error) {
      appLogger.warn('SessionService.clearPersistedSessionKey failed', error);
    }
  }

  private readPersistedPlayerName(): string | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const persisted = window.sessionStorage.getItem(PLAYER_NAME_STORAGE_KEY)?.trim() ?? '';
      return persisted.length > 0 ? persisted : null;
    } catch (error) {
      appLogger.warn('SessionService.readPersistedPlayerName failed', error);
      return null;
    }
  }

  private persistPlayerName(playerName: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    const normalized = playerName.trim();
    if (!normalized) {
      this.clearPersistedPlayerName();
      return;
    }

    try {
      window.sessionStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalized);
    } catch (error) {
      appLogger.warn('SessionService.persistPlayerName failed', error);
    }
  }

  private clearPersistedPlayerName(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
    } catch (error) {
      appLogger.warn('SessionService.clearPersistedPlayerName failed', error);
    }
  }

  private readPersistedActiveCharacter(): PlayerCharacterSummary | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(ACTIVE_CHARACTER_STORAGE_KEY)?.trim() ?? '';
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PlayerCharacterSummary;
      return typeof parsed?.id === 'string' ? parsed : null;
    } catch (error) {
      appLogger.warn('SessionService.readPersistedActiveCharacter failed', error);
      return null;
    }
  }

  private persistActiveCharacter(character: PlayerCharacterSummary): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.setItem(ACTIVE_CHARACTER_STORAGE_KEY, JSON.stringify(character));
    } catch (error) {
      appLogger.warn('SessionService.persistActiveCharacter failed', error);
    }
  }

  private clearPersistedActiveCharacter(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.removeItem(ACTIVE_CHARACTER_STORAGE_KEY);
    } catch (error) {
      appLogger.warn('SessionService.clearPersistedActiveCharacter failed', error);
    }
  }

  private readPersistedMissionEntryContext(): MissionEntryContext | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(MISSION_ENTRY_CONTEXT_STORAGE_KEY)?.trim() ?? '';
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as MissionEntryContext;
      if (typeof parsed?.playerName !== 'string' || typeof parsed?.joinCharacter?.id !== 'string') {
        return null;
      }

      return parsed;
    } catch (error) {
      appLogger.warn('SessionService.readPersistedMissionEntryContext failed', error);
      return null;
    }
  }

  private persistMissionEntryContext(context: MissionEntryContext): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.setItem(MISSION_ENTRY_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    } catch (error) {
      appLogger.warn('SessionService.persistMissionEntryContext failed', error);
    }
  }

  private clearPersistedMissionEntryContext(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      window.sessionStorage.removeItem(MISSION_ENTRY_CONTEXT_STORAGE_KEY);
    } catch (error) {
      appLogger.warn('SessionService.clearPersistedMissionEntryContext failed', error);
    }
  }
}
