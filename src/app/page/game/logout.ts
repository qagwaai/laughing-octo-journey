import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import { PlayerCharacterSummary } from '../../model/character-list';
import { SessionService } from '../../services/session.service';

interface LogoutNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-logout-page',
  templateUrl: './logout.html',
  styleUrls: ['./logout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu],
})
/**
 * Logout confirmation page for clearing session and routing to public entry points.
 */
export default class LogoutPage {
  protected readonly t = locale;
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private navigationState: LogoutNavigationState = resolveNavigationState<LogoutNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);

  /**
   * Clears session state and routes user back to intro/login outlets.
   */
  confirmLogout(): void {
    this.sessionService.clearSession();
    this.router.navigate([{ outlets: { primary: ['intro'], left: ['login'], right: null } }], {
      preserveFragment: true,
    });
  }

  /**
   * Leaves the active game session view and returns to character list + knot scene.
   */
  navigateToCharacterList(): void {
    this.router.navigate([{ outlets: { primary: ['knot'], left: ['character-list'], right: null } }], {
      preserveFragment: true,
      state: { playerName: this.playerName() },
    });
  }
}
