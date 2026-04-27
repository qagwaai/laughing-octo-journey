import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import {
	CHARACTER_DELETE_REQUEST_EVENT,
	CHARACTER_DELETE_RESPONSE_EVENT,
	CharacterDeleteRequest,
	CharacterDeleteResponse,
} from '../../model/character-delete';
import {
	CHARACTER_LIST_REQUEST_EVENT,
	CHARACTER_LIST_RESPONSE_EVENT,
	CharacterListRequest,
	CharacterListResponse,
	PlayerCharacterSummary,
} from '../../model/character-list';
import type { CharacterMissionProgress, MissionStatus } from '../../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { type ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';
import {
	GAME_JOIN_REQUEST_EVENT,
	GameJoinRequest,
} from '../../model/game-join';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { INVALID_SESSION_EVENT } from '../../model/session';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';

@Component({
	selector: 'app-character-list-page',
	templateUrl: './character-list.html',
	styleUrls: ['./character-list.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class CharacterListPage implements OnDestroy {
	protected readonly t = locale;
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private router = inject(Router);
	private unsubscribeResponse?: () => void;
	private unsubscribeDeleteResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;

	protected playerName = signal<string>(
		(this.router.getCurrentNavigation()?.extras.state?.['playerName'] as string | undefined) ??
			(history.state?.playerName as string | undefined) ??
			'',
	);
	protected characters = signal<PlayerCharacterSummary[]>([]);
	protected isLoading = signal(false);
	protected errorMessage = signal<string | null>(null);
	protected pendingDeleteCharacter = signal<PlayerCharacterSummary | null>(null);
	protected isDeleting = signal(false);

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
			this.loadCharacters();
		} else {
			this.socketService.once('connect', () => this.loadCharacters());
		}
	}

	loadCharacters(): void {
		const playerName = this.playerName().trim();
		if (!playerName) {
			this.errorMessage.set('Player name is required to load characters.');
			this.characters.set([]);
			return;
		}

		this.isLoading.set(true);
		this.errorMessage.set(null);
		this.unsubscribeResponse?.();

		this.unsubscribeResponse = this.socketService.on(
			CHARACTER_LIST_RESPONSE_EVENT,
			(response: CharacterListResponse) => {
				this.isLoading.set(false);
				if (response.success) {
					this.characters.set(this.normalizeCharacters(response.characters));
				} else {
					this.characters.set([]);
					this.errorMessage.set(response.message);
				}
				this.unsubscribeResponse?.();
			},
		);

		const request: CharacterListRequest = { playerName, sessionKey: this.sessionService.getSessionKey()! };
		this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, request);
	}

	private normalizeCharacters(characters: unknown): PlayerCharacterSummary[] {
		if (!Array.isArray(characters)) {
			return [];
		}

		return characters.map((raw, index) => {
			const item = (raw ?? {}) as {
				id?: unknown;
				characterId?: unknown;
				characterName?: unknown;
				name?: unknown;
				character?: { name?: unknown };
				level?: unknown;
				createdAt?: unknown;
				missions?: unknown;
			};

			const nameFromObject =
				typeof item.character?.name === 'string' ? item.character.name : undefined;
			const resolvedCharacterName =
				typeof item.characterName === 'string'
					? item.characterName
					: typeof item.name === 'string'
						? item.name
						: nameFromObject;
			const missions = this.normalizeMissionProgress(item.missions);

			return {
				id:
					typeof item.id === 'string'
						? item.id
						: typeof item.characterId === 'string'
							? item.characterId
							: `char-${index}`,
				characterName: (resolvedCharacterName ?? '').trim(),
				level: typeof item.level === 'number' ? item.level : undefined,
				createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
				...(missions ? { missions } : {}),
			};
		});
	}

	private normalizeMissionProgress(missions: unknown): CharacterMissionProgress[] | undefined {
		if (!Array.isArray(missions)) {
			return undefined;
		}

		const normalizedMissions = missions.flatMap((rawMission) => {
			const mission = (rawMission ?? {}) as { missionId?: unknown; status?: unknown };
			if (typeof mission.missionId !== 'string' || typeof mission.status !== 'string') {
				return [];
			}

			return [{ missionId: mission.missionId, status: mission.status as MissionStatus }];
		});

		return normalizedMissions.length > 0 ? normalizedMissions : undefined;
	}

	private getFirstTargetStatus(character: PlayerCharacterSummary): MissionStatus | null {
		const firstTargetMission = character.missions?.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID);
		return firstTargetMission?.status ?? null;
	}

	protected getJoinGameLabel(character: PlayerCharacterSummary): string {
		return this.getFirstTargetStatus(character) === 'started'
			? this.t.character.list.joinInProgressLabel
			: this.t.character.list.joinLabel;
	}

	requestDeleteCharacter(character: PlayerCharacterSummary): void {
		this.errorMessage.set(null);
		this.pendingDeleteCharacter.set(character);
	}

	cancelDeleteCharacter(): void {
		if (this.isDeleting()) {
			return;
		}
		this.pendingDeleteCharacter.set(null);
	}

	confirmDeleteCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.pendingDeleteCharacter();
		if (!character) {
			return;
		}
		if (!playerName) {
			this.errorMessage.set('Player name is required to delete a character.');
			return;
		}

		this.isDeleting.set(true);
		this.errorMessage.set(null);
		this.unsubscribeDeleteResponse?.();

		this.unsubscribeDeleteResponse = this.socketService.on(
			CHARACTER_DELETE_RESPONSE_EVENT,
			(response: CharacterDeleteResponse) => {
				this.isDeleting.set(false);
				if (response.success) {
					this.characters.set(this.characters().filter((c) => c.id !== character.id));
					this.pendingDeleteCharacter.set(null);
				} else {
					this.errorMessage.set(response.message);
				}
				this.unsubscribeDeleteResponse?.();
			},
		);

		const request: CharacterDeleteRequest = {
			playerName,
			characterId: character.id,
			characterName: character.characterName,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(CHARACTER_DELETE_REQUEST_EVENT, request);
	}

	navigateToCharacterSetup(): void {
		const playerName = this.playerName();
		this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
			preserveFragment: true,
			state: { playerName, mode: 'create' },
		});
	}

	navigateToCharacterEdit(character: PlayerCharacterSummary): void {
		const playerName = this.playerName();
		this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
			preserveFragment: true,
			state: {
				playerName,
				mode: 'edit',
				editCharacter: character,
			},
		});
	}

	navigateToGameJoin(character: PlayerCharacterSummary): void {
		const playerName = this.playerName().trim();
		if (!playerName) {
			this.errorMessage.set('Player name is required to join a game.');
			return;
		}
		if (!character.id) {
			this.errorMessage.set('Character id is required to join a game.');
			return;
		}

		const request: GameJoinRequest = {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(GAME_JOIN_REQUEST_EVENT, request);

		const firstTargetStatus = this.getFirstTargetStatus(character);
		if (firstTargetStatus === 'started') {
			window.dispatchEvent(new CustomEvent(START_SCANNING_UI_EVENT));
		}

		const outlets =
			firstTargetStatus === 'started'
				? { right: ['opening-cold-boot-scan'], left: ['game-main'] }
				: { primary: ['opening-cold-boot'], left: ['opening-cold-boot'] };
		const missionContext = firstTargetStatus === 'started'
			? {
				missionId: FIRST_TARGET_MISSION_ID,
				missionStatusHint: firstTargetStatus,
				seedPolicy: 'auto',
			} satisfies ShipExteriorViewMissionContext
			: undefined;

		this.router.navigate([{ outlets }], {
			preserveFragment: true,
			state: {
				playerName,
				joinCharacter: character,
				...(missionContext ? { missionContext } : {}),
				...(firstTargetStatus === 'started' ? { firstTargetMissionStatus: firstTargetStatus } : {}),
			},
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
		this.unsubscribeDeleteResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}
