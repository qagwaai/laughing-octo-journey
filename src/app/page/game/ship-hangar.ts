import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from './guarded-left-menu';
import { locale } from '../../i18n/locale';

interface ShipHangarNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-ship-hangar-page',
	templateUrl: './ship-hangar.html',
	styleUrls: ['./ship-hangar.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class ShipHangarPage {
	protected readonly t = locale;
	private router = inject(Router);
	private navigationState: ShipHangarNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as ShipHangarNavigationState | undefined) ??
		(history.state as ShipHangarNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
}
