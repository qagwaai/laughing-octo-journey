import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from './guarded-left-menu';
import { locale } from '../../i18n/locale';

interface StellarInitiationNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-stellar-initiation-page',
	templateUrl: './stellar-initiation.html',
	styleUrls: ['./stellar-initiation.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class StellarInitiationPage {
	protected readonly t = locale;
	private router = inject(Router);
	private navigationState: StellarInitiationNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as StellarInitiationNavigationState | undefined) ??
		(history.state as StellarInitiationNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
}
