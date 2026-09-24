import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ExternalAnchorsComponent } from '../../component/external-anchors';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipFlightPositionPersistenceService } from '../../services/ship-flight-position-persistence.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { resolveNavigationState } from '../navigation-state';

interface LogoutNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-logout-page',
  templateUrl: './logout.html',
  styleUrls: ['./logout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, ExternalAnchorsComponent],
})
/**
 * Logout confirmation page for clearing session and routing to public entry points.
 */
export default class LogoutPage {
  protected readonly t = locale;
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private shipFlightPositionPersistence = inject(ShipFlightPositionPersistenceService);
  private socketLifecycle = inject(SocketLifecycleService);
  private navigationState: LogoutNavigationState = resolveNavigationState<LogoutNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected isLoggingOut = signal(false);
  protected logoutError = signal<string | null>(null);

  /**
   * Clears session state and routes user back to intro/login outlets.
   */
  async confirmLogout(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.logoutError.set(null);
    try {
      await this.shipFlightPositionPersistence.flushPending();
      this.sessionService.clearSession();
      await this.router.navigate([{ outlets: { primary: ['intro'], left: ['login'], right: null } }], {
        preserveFragment: true,
      });
    } catch (error) {
      appLogger.error('Logout blocked because the ship location could not be saved.', error);
      this.logoutError.set(this.t.game.logout.locationSaveError);
    } finally {
      this.isLoggingOut.set(false);
    }
  }

  /**
   * Leaves the active game session view and returns to character list.
   * Uses 'intro' as the primary route to avoid NgtStore injection errors
   * that occur when transitioning directly from ship-exterior-view to the
   * knot scene (the ngt-canvas hasn't remounted before knot is instantiated).
   */
  async navigateToCharacterList(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.logoutError.set(null);
    try {
      await this.shipFlightPositionPersistence.flushPending();
      this.socketLifecycle.disconnect();
      await this.router.navigate([{ outlets: { primary: ['intro'], left: ['character-list'], right: null } }], {
        state: { playerName: this.playerName() },
      });
    } catch (error) {
      appLogger.error('Leave game blocked because the ship location could not be saved.', error);
      this.logoutError.set(this.t.game.logout.locationSaveError);
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
