import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
	CHARACTER_DELETE_REQUEST_EVENT,
	CHARACTER_DELETE_RESPONSE_EVENT,
	CharacterDeleteRequest,
	CharacterDeleteResponse,
} from '../model/character-delete';
import {
	CHARACTER_LIST_REQUEST_EVENT,
	CHARACTER_LIST_RESPONSE_EVENT,
	CharacterListRequest,
	CharacterListResponse,
	PlayerCharacterSummary,
} from '../model/character-list';
import { INVALID_SESSION_EVENT } from '../model/session';
import { SessionService } from '../services/session.service';
import { SocketService } from '../services/socket.service';

@Component({
	selector: 'app-character-list-page',
	templateUrl: './character-list.html',
	styleUrls: ['./character-list.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CharacterListPage implements OnDestroy {
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
					this.characters.set(response.characters ?? []);
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
			state: { playerName },
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
		this.unsubscribeDeleteResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}
