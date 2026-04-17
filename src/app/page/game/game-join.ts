import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	DRONE_LIST_REQUEST_EVENT,
	DRONE_LIST_RESPONSE_EVENT,
	DroneListRequest,
	DroneListResponse,
	DroneSummary,
} from '../../model/drone-list';
import { INVALID_SESSION_EVENT } from '../../model/session';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

interface GameJoinNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-game-join-page',
	templateUrl: './game-join.html',
	styleUrls: ['./game-join.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class GameJoinPage {
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeDroneListResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private navigationState: GameJoinNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as GameJoinNavigationState | undefined) ??
		(history.state as GameJoinNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected characterName = signal<string>(this.joinCharacter()?.characterName ?? 'Unknown Character');
	protected drones = signal<DroneSummary[]>([]);
	protected isLoadingDrones = signal(false);
	protected droneListError = signal<string | null>(null);

	constructor() {
		effect(() => {
			this.socketService.connect(this.socketService.serverUrl);
		});

		this.unsubscribeInvalidSession = this.socketService.on(
			INVALID_SESSION_EVENT,
			() => {
				this.sessionService.clearSession();
				this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
			},
		);

		if (this.socketService.getIsConnected()) {
			this.loadDronesForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadDronesForCharacter());
		}
	}

	loadDronesForCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.joinCharacter();

		if (!playerName) {
			this.droneListError.set('Player name is required to load drones.');
			this.drones.set([]);
			return;
		}

		if (!character?.id) {
			this.droneListError.set('Character id is required to load drones.');
			this.drones.set([]);
			return;
		}

		this.isLoadingDrones.set(true);
		this.droneListError.set(null);
		this.unsubscribeDroneListResponse?.();

		this.unsubscribeDroneListResponse = this.socketService.on(
			DRONE_LIST_RESPONSE_EVENT,
			(response: DroneListResponse) => {
				this.isLoadingDrones.set(false);
				if (response.success) {
					this.drones.set(response.drones ?? []);
					this.droneListError.set(null);
				} else {
					this.drones.set([]);
					this.droneListError.set(response.message);
				}
				this.unsubscribeDroneListResponse?.();
			},
		);

		const request: DroneListRequest = {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(DRONE_LIST_REQUEST_EVENT, request);
	}

	ngOnDestroy(): void {
		this.unsubscribeDroneListResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}
