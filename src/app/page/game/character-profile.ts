import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { locale } from '../../i18n/locale';

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
export default class CharacterProfilePage {
	protected readonly t = locale;
	private router = inject(Router);
	private navigationState: CharacterProfileNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as CharacterProfileNavigationState | undefined) ??
		(history.state as CharacterProfileNavigationState | undefined) ??
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
