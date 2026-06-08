import { Injectable, signal } from '@angular/core';
import type { PlayerCharacterSummary } from '../model/character-list';

export type LeftMenuMode = 'unpinned' | 'pinned' | 'keep-mini';

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

  updateContext(playerName: string, joinCharacter: PlayerCharacterSummary | null): void {
    const normalizedPlayerName = playerName?.trim() ?? '';
    if (normalizedPlayerName) {
      this.playerNameSignal.set(normalizedPlayerName);
    }

    if (joinCharacter?.id?.trim()) {
      this.joinCharacterSignal.set(joinCharacter);
    }
  }

  clearContext(): void {
    this.playerNameSignal.set('');
    this.joinCharacterSignal.set(null);
  }

  setMenuMode(mode: LeftMenuMode): void {
    this.menuModeSignal.set(mode);
  }
}
