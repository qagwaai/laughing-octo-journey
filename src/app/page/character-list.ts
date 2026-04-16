import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
	CHARACTER_LIST_REQUEST_EVENT,
	CHARACTER_LIST_RESPONSE_EVENT,
	CharacterListRequest,
	CharacterListResponse,
	PlayerCharacterSummary,
} from '../model/character-list';
import { SocketService } from '../services/socket.service';

@Component({
	selector: 'app-character-list-page',
	templateUrl: './character-list.html',
	styleUrls: ['./character-list.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class CharacterListPage implements OnDestroy {
	private socketService = inject(SocketService);
	private router = inject(Router);
	private unsubscribeResponse?: () => void;

	protected playerName = signal<string>(
		(this.router.getCurrentNavigation()?.extras.state?.['playerName'] as string | undefined) ??
			(history.state?.playerName as string | undefined) ??
			'',
	);
	protected characters = signal<PlayerCharacterSummary[]>([]);
	protected isLoading = signal(false);
	protected errorMessage = signal<string | null>(null);

	constructor() {
		effect(() => {
			this.socketService.connect(this.socketService.serverUrl);
		});
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

		const request: CharacterListRequest = { playerName };
		this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, request);
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
	}
}
