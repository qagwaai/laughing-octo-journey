import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
	CHARACTER_ADD_REQUEST_EVENT,
	CHARACTER_ADD_RESPONSE_EVENT,
	CharacterAddRequest,
	CharacterAddResponse,
} from '../../model/character-add';
import {
	CHARACTER_EDIT_REQUEST_EVENT,
	CHARACTER_EDIT_RESPONSE_EVENT,
	CharacterEditRequest,
	CharacterEditResponse,
} from '../../model/character-edit';
import { PlayerCharacterSummary } from '../../model/character-list';
import { INVALID_SESSION_EVENT } from '../../model/session';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

interface CharacterSetupNavigationState {
	playerName?: string;
	mode?: 'create' | 'edit';
	editCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-character-setup-page',
	templateUrl: './character-setup.html',
	styleUrls: ['./character-setup.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
})
export default class CharacterSetupPage implements OnDestroy {
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeAddResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private setupState: CharacterSetupNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as CharacterSetupNavigationState | undefined) ??
		(history.state as CharacterSetupNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(
		this.setupState.playerName ??
			'',
	);
	protected editCharacter = signal<PlayerCharacterSummary | null>(this.setupState.editCharacter ?? null);
	protected isEditMode = signal(
		this.setupState.mode === 'edit' && !!this.setupState.editCharacter,
	);

	protected characterForm = this.fb.group({
		characterName: [
			this.editCharacter()?.characterName ?? this.playerName(),
			[Validators.required, Validators.minLength(2), Validators.maxLength(24)],
		],
	});

	protected isSaved = signal(false);
	protected successMessage = signal<string | null>(null);
	protected errorMessage = signal<string | null>(null);
	protected isSubmitting = signal(false);

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
	}

	saveCharacter(): void {
		if (this.characterForm.invalid) {
			this.characterForm.markAllAsTouched();
			return;
		}

		const playerName = this.playerName().trim();
		const characterName = this.characterForm.value.characterName!;

		if (!playerName) {
			this.errorMessage.set('Player name is required to save a character.');
			this.isSaved.set(false);
			return;
		}

		this.isSubmitting.set(true);
		this.errorMessage.set(null);
		this.successMessage.set(null);
		this.isSaved.set(false);
		this.unsubscribeAddResponse?.();

		const isEditMode = this.isEditMode();
		if (isEditMode) {
			const editCharacter = this.editCharacter();
			if (!editCharacter?.id) {
				this.isSubmitting.set(false);
				this.errorMessage.set('Character id is required to edit a character.');
				return;
			}
		}

		const responseEventName = isEditMode ? CHARACTER_EDIT_RESPONSE_EVENT : CHARACTER_ADD_RESPONSE_EVENT;

		this.unsubscribeAddResponse = this.socketService.on(
			responseEventName,
			(response: CharacterAddResponse | CharacterEditResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					this.isSaved.set(true);
					this.successMessage.set(response.message);
					this.errorMessage.set(null);
				} else {
					this.isSaved.set(false);
					this.successMessage.set(null);
					this.errorMessage.set(response.message);
				}
				this.unsubscribeAddResponse?.();
			},
		);

		if (isEditMode) {
			const editCharacter = this.editCharacter()!;
			const request: CharacterEditRequest = {
				characterId: editCharacter.id,
				playerName,
				characterName,
				sessionKey: this.sessionService.getSessionKey()!,
			};
			this.socketService.emit(CHARACTER_EDIT_REQUEST_EVENT, request);
			return;
		}

		const request: CharacterAddRequest = {
			playerName,
			characterName,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, request);
	}

	navigateToCharacterList(): void {
		const playerName = this.playerName() || this.characterForm.value.characterName || '';
		this.router.navigate([{ outlets: { left: ['character-list'] } }], {
			preserveFragment: true,
			state: { playerName },
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeAddResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}
