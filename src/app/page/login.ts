import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
	LOGIN_EVENT,
	LOGIN_RESPONSE_EVENT,
	LoginRequest,
	LoginResponse,
} from '../model/login';
import { SocketService } from '../services/socket.service';

@Component({
	selector: 'app-login-page',
	templateUrl: './login.html',
	styleUrls: ['./login.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
})
export default class LoginPage implements OnDestroy {
	private socketService = inject(SocketService);
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private unsubscribeResponse?: () => void;

	protected loginForm = this.fb.group({
		playerName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
		password: ['', [Validators.required, Validators.minLength(8)]],
	});

	protected isSubmitting = signal(false);
	protected successMessage = signal<string | null>(null);
	protected errorMessage = signal<string | null>(null);
	protected canNavigateToRegister = signal(false);

	constructor() {
		effect(() => {
			this.socketService.connect(this.socketService.serverUrl);
		});
	}

	submit(): void {
		if (this.loginForm.invalid) {
			this.loginForm.markAllAsTouched();
			return;
		}

		const { playerName, password } = this.loginForm.value;
		const request: LoginRequest = {
			playerName: playerName!,
			password: password!,
		};

		this.isSubmitting.set(true);
		this.successMessage.set(null);
		this.errorMessage.set(null);
		this.canNavigateToRegister.set(false);

		this.unsubscribeResponse = this.socketService.on(
			LOGIN_RESPONSE_EVENT,
			(response: LoginResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					this.successMessage.set(response.message);
					this.canNavigateToRegister.set(false);
					this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
						preserveFragment: true,
						state: { playerName: request.playerName },
					});
					this.unsubscribeResponse?.();
					return;
				}

				if (response.reason === 'PLAYER_NOT_REGISTERED') {
					this.errorMessage.set('Player name is not registered. Please register first.');
					this.canNavigateToRegister.set(true);
				} else if (response.reason === 'PASSWORD_MISMATCH') {
					this.errorMessage.set('Password does not match the player name.');
					this.canNavigateToRegister.set(false);
				} else {
					this.errorMessage.set(response.message);
					this.canNavigateToRegister.set(false);
				}

				this.unsubscribeResponse?.();
			},
		);

		this.socketService.emit(LOGIN_EVENT, request);
	}

	navigateToRegistration(): void {
		this.router.navigate([{ outlets: { left: ['registration'] } }], { preserveFragment: true });
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
	}
}
