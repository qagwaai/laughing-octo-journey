import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';

interface CharacterProfileNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-character-profile-page',
  templateUrl: './character-profile.html',
  styleUrls: ['./character-profile.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge, DatePipe],
})
/**
 * Displays character profile details and links back to profile outlet flows.
 */
export default class CharacterProfilePage {
  protected readonly t = locale;
  private router = inject(Router);
  private navigationState: CharacterProfileNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as CharacterProfileNavigationState | undefined) ??
    (history.state as CharacterProfileNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);

  /**
   * Re-opens character profile outlet while preserving current player context.
   */
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
