import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { PlayerCharacterSummary } from '../../model/character-list';
import type { SolarSystemListResponse, SolarSystemSummary } from '../../model/solar-system-list';
import { SessionService } from '../../services/session.service';
import { SolarSystemService } from '../../services/solar-system.service';

interface ViewerNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

const VIEWER_DEFAULT_LIST_LIMIT = 50;
const VIEWER_DEFAULT_DISTANCE_PARSEC = 50;

@Component({
  selector: 'app-viewer-page',
  templateUrl: './viewer.html',
  styleUrls: ['./viewer.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
/**
 * Left-pane Viewer page. Lists solar systems sourced from the HYG-backed
 * `solar-system-list` channel, lets the player select one, and routes the
 * right outlet to the Viewer system scene.
 *
 * Currently always unlocked via {@link isViewerUnlocked}; the predicate
 * exists so a future entitlement check can gate access without changing
 * the menu structure.
 */
export default class ViewerPage {
  protected readonly t = locale;
  private router = inject(Router);
  private sessionService = inject(SessionService);
  private solarSystemService = inject(SolarSystemService);

  private navigationState: ViewerNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as ViewerNavigationState | undefined) ??
    (history.state as ViewerNavigationState | undefined) ??
    {};

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);

  protected solarSystems = signal<SolarSystemSummary[]>([]);
  protected isLoading = signal(false);
  protected listError = signal<string | null>(null);
  protected selectedSystemId = signal<string | null>(null);

  protected readonly hasResults = computed(() => this.solarSystems().length > 0);

  /**
   * Future: replace with character/entitlement-based unlock check. Returns true
   * for all characters today so the route is universally accessible.
   */
  protected isViewerUnlocked(): boolean {
    return true;
  }

  ngOnInit(): void {
    if (!this.isViewerUnlocked()) {
      return;
    }
    this.loadSolarSystems();
  }

  protected loadSolarSystems(): void {
    const playerName = this.playerName();
    const sessionKey = this.sessionService.getSessionKey();
    if (!playerName || !sessionKey) {
      this.listError.set(this.t.game.viewer.listErrorPrefix + ' missing-session');
      return;
    }

    this.isLoading.set(true);
    this.listError.set(null);

    this.solarSystemService.listSolarSystems(
      {
        playerName,
        sessionKey,
        limit: VIEWER_DEFAULT_LIST_LIMIT,
        maxDistanceParsec: VIEWER_DEFAULT_DISTANCE_PARSEC,
      },
      (response: SolarSystemListResponse) => {
        this.isLoading.set(false);
        if (!response.success) {
          this.listError.set(this.t.game.viewer.listErrorPrefix + ' ' + (response.message ?? 'unknown-error'));
          return;
        }
        this.solarSystems.set(response.solarSystems ?? []);
      },
    );
  }

  protected selectSystem(system: SolarSystemSummary): void {
    if (!this.isViewerUnlocked()) {
      return;
    }
    this.selectedSystemId.set(system.id);
    this.router.navigate([{ outlets: { right: ['viewer-scene', system.id] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
        solarSystem: system,
      },
    });
  }

  protected formatDistance(parsecs: number | undefined): string {
    if (typeof parsecs !== 'number' || !Number.isFinite(parsecs)) {
      return '—';
    }
    return parsecs.toFixed(2);
  }
}
