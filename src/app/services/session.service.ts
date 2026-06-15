import { Injectable, signal } from '@angular/core';
import type { PlayerCharacterSummary } from '../model/character-list';
import type { ShipSummary } from '../model/ship-list';
import { isValidShipSpatial } from '../model/spatial';

@Injectable({
  providedIn: 'root',
})
/**
 * Client session state container for session key and currently active ship.
 */
export class SessionService {
  private sessionKey = signal<string | null>(null);
  private activeShipSignal = signal<ShipSummary | null>(null);
  private activeCharacterSignal = signal<PlayerCharacterSummary | null>(null);

  readonly activeShip = this.activeShipSignal.asReadonly();
  readonly activeCharacter = this.activeCharacterSignal.asReadonly();

  /**
   * Persists the current authenticated session key.
   */
  setSessionKey(key: string): void {
    this.sessionKey.set(key);
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
  }

  /**
   * Clears active character state without affecting the session key.
   */
  clearActiveCharacter(): void {
    this.activeCharacterSignal.set(null);
  }
}
