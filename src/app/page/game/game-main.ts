import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';

interface GameMainNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-game-main-page',
  templateUrl: './game-main.html',
  styleUrls: ['./game-main.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
export default class GameMainPage {
  protected readonly t = locale;
  private router = inject(Router);
  private navigationState: GameMainNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as GameMainNavigationState | undefined) ??
    (history.state as GameMainNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);

  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }
}
