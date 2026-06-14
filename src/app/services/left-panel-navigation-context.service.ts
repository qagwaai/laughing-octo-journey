import { Injectable, signal } from '@angular/core';
import type { PlayerCharacterSummary } from '../model/character-list';

export type LeftMenuMode = 'unpinned' | 'pinned' | 'keep-mini';

const MENU_MODE_STORAGE_KEY = 'guarded_left_menu_pin_state';
const VALID_MENU_MODES = new Set<LeftMenuMode>(['unpinned', 'pinned', 'keep-mini']);

@Injectable({
  providedIn: 'root',
})
export class LeftPanelNavigationContextService {
  private readonly playerNameSignal = signal('');
  private readonly joinCharacterSignal = signal<PlayerCharacterSummary | null>(null);
  private readonly menuModeSignal = signal<LeftMenuMode>('unpinned');

  readonly playerName = this.playerNameSignal.asReadonly();
  readonly joinCharacter = this.joinCharacterSignal.asReadonly();
  readonly menuMode = this.menuModeSignal.asReadonly();

  constructor() {
    this.restoreMenuMode();
  }

  updateContext(playerName: string, joinCharacter: PlayerCharacterSummary | null): void {
    const normalizedPlayerName = playerName?.trim() ?? '';
    if (normalizedPlayerName) {
      this.playerNameSignal.set(normalizedPlayerName);
    }

    if (joinCharacter?.id?.trim()) {
      this.joinCharacterSignal.set(joinCharacter);
    }

    this.restoreMenuMode();
  }

  clearContext(): void {
    this.playerNameSignal.set('');
    this.joinCharacterSignal.set(null);
    this.menuModeSignal.set('unpinned');
  }

  setMenuMode(mode: LeftMenuMode): void {
    this.menuModeSignal.set(mode);
    try {
      localStorage.setItem(MENU_MODE_STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable (private browsing, storage quota exceeded)
    }
  }

  private restoreMenuMode(): void {
    try {
      const stored = localStorage.getItem(MENU_MODE_STORAGE_KEY);
      if (stored !== null && VALID_MENU_MODES.has(stored as LeftMenuMode)) {
        this.menuModeSignal.set(stored as LeftMenuMode);
      }
    } catch {
      // localStorage may be unavailable
    }
  }
}
