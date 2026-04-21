import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { SessionService } from '../../services/session.service';
import { GuardedLeftMenu } from './guarded-left-menu';
import { locale } from '../../i18n/locale';

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
export default class LogoutPage {
	protected readonly t = locale;
	private router = inject(Router);
	private sessionService = inject(SessionService);
	private navigationState: LogoutNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as LogoutNavigationState | undefined) ??
		(history.state as LogoutNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);

	confirmLogout(): void {
		this.sessionService.clearSession();
		this.router.navigate([{ outlets: { primary: ['intro'], left: ['login'], right: null } }], {
			preserveFragment: true,
		});
	}
}
