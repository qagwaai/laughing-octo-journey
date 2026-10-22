import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import type { PlayerCharacterSummary } from '../../model/character-list';
import { LeftPanelNavigationContextService } from '../../services/left-panel-navigation-context.service';
import { RenderStatsService } from '../../services/render-stats.service';
import { SessionService } from '../../services/session.service';
import { resolveNavigationState } from '../navigation-state';

interface SettingsNavigationState {
  settingsReturnUrl?: string;
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.html',
  styleUrls: ['./settings.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
export default class SettingsPage {
  protected readonly t = locale.game.settings;
  protected readonly renderStats = inject(RenderStatsService);
  private readonly session = inject(SessionService);
  private readonly context = inject(LeftPanelNavigationContextService);
  private readonly navigationState = resolveNavigationState<SettingsNavigationState>(inject(Router));
  private readonly router = inject(Router);
  protected readonly publicView = !this.session.hasSession() || !!this.navigationState.settingsReturnUrl;

  protected backToPublicPage(): void {
    void this.router.navigateByUrl(this.navigationState.settingsReturnUrl ?? '/splash(left:login)');
  }

  protected readonly playerName =
    this.navigationState.playerName || this.context.playerName() || this.session.getPlayerName() || '';
  protected readonly joinCharacter =
    this.navigationState.joinCharacter ?? this.context.joinCharacter() ?? this.session.activeCharacter();
}
