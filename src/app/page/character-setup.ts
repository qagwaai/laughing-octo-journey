import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
	CHARACTER_ADD_REQUEST_EVENT,
	CHARACTER_ADD_RESPONSE_EVENT,
	CharacterAddRequest,
	CharacterAddResponse,
} from '../model/character-add';
import { INVALID_SESSION_EVENT } from '../model/session';
import { SessionService } from '../services/session.service';
import { SocketService } from '../services/socket.service';

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

	protected playerName = signal<string>(
		(this.router.getCurrentNavigation()?.extras.state?.['playerName'] as string | undefined) ??
			(history.state?.playerName as string | undefined) ??
			'',
	);

	protected characterForm = this.fb.group({
		characterName: [
			this.playerName(),
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
			this.errorMessage.set('Player name is required to add a character.');
			this.isSaved.set(false);
			return;
		}

		this.isSubmitting.set(true);
		this.errorMessage.set(null);
		this.successMessage.set(null);
		this.isSaved.set(false);
		this.unsubscribeAddResponse?.();

		this.unsubscribeAddResponse = this.socketService.on(
			CHARACTER_ADD_RESPONSE_EVENT,
			(response: CharacterAddResponse) => {
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
