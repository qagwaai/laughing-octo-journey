import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from './guarded-left-menu';
import { locale } from '../../i18n/locale';

interface MarketHubNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-market-hub-page',
	templateUrl: './market-hub.html',
	styleUrls: ['./market-hub.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class MarketHubPage {
	protected readonly t = locale;
	private router = inject(Router);
	private navigationState: MarketHubNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as MarketHubNavigationState | undefined) ??
		(history.state as MarketHubNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
}
