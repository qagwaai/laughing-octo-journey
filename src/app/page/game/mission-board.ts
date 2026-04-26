import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	MISSION_LIST_REQUEST_EVENT,
	MISSION_LIST_RESPONSE_EVENT,
	type MissionListRequest,
	type MissionListResponse,
} from '../../model/mission-list';
import type { CharacterMissionProgress } from '../../model/mission';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

interface MissionBoardNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-mission-board-page',
	templateUrl: './mission-board.html',
	styleUrls: ['./mission-board.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class MissionBoardPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeMissionListResponse?: () => void;
	private navigationState: MissionBoardNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as MissionBoardNavigationState | undefined) ??
		(history.state as MissionBoardNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected missions = signal<CharacterMissionProgress[]>([]);
	protected isLoadingMissions = signal(false);
	protected missionListError = signal<string | null>(null);

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);

		if (this.socketService.getIsConnected()) {
			this.loadMissionsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadMissionsForCharacter());
		}
	}

	loadMissionsForCharacter(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName) {
			this.missionListError.set('Player name is required to load missions.');
			this.missions.set([]);
			return;
		}

		if (!characterId) {
			this.missionListError.set('Character id is required to load missions.');
			this.missions.set([]);
			return;
		}

		if (!sessionKey) {
			this.missionListError.set('Session key is required to load missions.');
			this.missions.set([]);
			return;
		}

		this.isLoadingMissions.set(true);
		this.missionListError.set(null);
		this.unsubscribeMissionListResponse?.();

		this.unsubscribeMissionListResponse = this.socketService.on(
			MISSION_LIST_RESPONSE_EVENT,
			(response: MissionListResponse) => {
				this.isLoadingMissions.set(false);
				if (response.success) {
					this.missions.set(response.missions ?? []);
					this.missionListError.set(null);
				} else {
					this.missions.set([]);
					this.missionListError.set(response.message);
				}
				this.unsubscribeMissionListResponse?.();
			},
		);

		const request: MissionListRequest = { playerName, characterId, sessionKey };
		this.socketService.emit(MISSION_LIST_REQUEST_EVENT, request);
	}

	protected formatDate(isoString?: string): string {
		if (!isoString) {
			return '—';
		}
		return isoString.slice(0, 10);
	}

	navigateToCharacterProfile(): void {
		this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
			},
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeMissionListResponse?.();
	}
}
