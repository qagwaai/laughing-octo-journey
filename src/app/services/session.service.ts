import { Injectable, signal } from '@angular/core';
import type { PlayerCharacterSummary } from '../model/character-list';
import type { ShipSummary } from '../model/ship-list';

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

  /**
   * Sets the active ship used by game pages for contextual operations.
   */
  setActiveShip(ship: ShipSummary): void {
    this.activeShipSignal.set(ship);
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
