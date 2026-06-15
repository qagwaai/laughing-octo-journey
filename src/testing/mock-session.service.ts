import type { PlayerCharacterSummary } from '../app/model/character-list';
import type { ShipSummary } from '../app/model/ship-list';
import { createSignal, WritableSignalLike } from './signal';

/**
 * Canonical MockSessionService for use in spec files.
 * Covers the full public surface of SessionService.
 *
 * Usage:
 *   import { createMockSessionService, MockSessionService } from '../../../testing';
 *   let session: MockSessionService;
 *   beforeEach(() => { session = createMockSessionService('my-key'); });
 */
export interface MockSessionService {
  /** Direct read accessor — mirrors the storedKey getter used in some specs. */
  readonly storedKey: string | null;
  activeShip: WritableSignalLike<ShipSummary | null>;
  activeCharacter: WritableSignalLike<PlayerCharacterSummary | null>;
  setSessionKey(key: string): void;
  getSessionKey(): string | null;
  clearSession(): void;
  hasSession(): boolean;
  setActiveShip(ship: ShipSummary): void;
  clearActiveShip(): void;
  forceUpdateActiveShipSpatial(shipId: string, spatial: ShipSummary['spatial']): void;
  setActiveCharacter(character: PlayerCharacterSummary): void;
  clearActiveCharacter(): void;
}

export function createMockSessionService(initialKey: string | null = null): MockSessionService {
  const state = { key: initialKey };
  const activeShip = createSignal<ShipSummary | null>(null);
  const activeCharacter = createSignal<PlayerCharacterSummary | null>(null);

  return {
    get storedKey() {
      return state.key;
    },
    activeShip,
    activeCharacter,
    setSessionKey(key: string) {
      state.key = key;
    },
    getSessionKey() {
      return state.key;
    },
    clearSession() {
      state.key = null;
      activeShip.set(null);
      activeCharacter.set(null);
    },
    hasSession() {
      return state.key !== null;
    },
    setActiveShip(ship: ShipSummary) {
      activeShip.set(ship);
    },
    clearActiveShip() {
      activeShip.set(null);
    },
    forceUpdateActiveShipSpatial(shipId: string, spatial: ShipSummary['spatial']) {
      const current = activeShip();
      if (!current || current.id?.trim().toLowerCase() !== shipId?.trim().toLowerCase()) {
        return;
      }
      activeShip.set({ ...current, spatial });
    },
    setActiveCharacter(character: PlayerCharacterSummary) {
      activeCharacter.set(character);
    },
    clearActiveCharacter() {
      activeCharacter.set(null);
    },
  };
}
