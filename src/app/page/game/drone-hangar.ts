import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from './guarded-left-menu';
import { locale } from '../../i18n/locale';

interface DroneHangarNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-drone-hangar-page',
	templateUrl: './drone-hangar.html',
	styleUrls: ['./drone-hangar.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class DroneHangarPage {
	protected readonly t = locale;
	private router = inject(Router);
	private navigationState: DroneHangarNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as DroneHangarNavigationState | undefined) ??
		(history.state as DroneHangarNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
}
