import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { locale } from '../../i18n/locale';
import type { CharacterMissionProgress } from '../../model/mission';
import { MISSION_IDS, resolveMissionById } from '../../model/mission-catalog';

interface MarketHubNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	missions?: CharacterMissionProgress[];
}

@Component({
	selector: 'app-market-hub-page',
	templateUrl: './market-hub.html',
	styleUrls: ['./market-hub.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu, CharacterShipBadge],
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
	protected missions = signal<CharacterMissionProgress[]>(this.navigationState.missions ?? []);

	/** The M-01 mission progress entry if it is active. */
	protected readonly activeM01Mission = computed(() =>
		this.missions().find(
			(m) => m.missionId === MISSION_IDS.m01 && (m.status === 'available' || m.status === 'started' || m.status === 'in-progress'),
		) ?? null,
	);

	/** M-01 catalog definition for briefing/objectives display. */
	protected readonly m01Definition = resolveMissionById(MISSION_IDS.m01);

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
