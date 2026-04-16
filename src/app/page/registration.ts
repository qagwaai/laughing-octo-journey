import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { REGISTER_EVENT, REGISTER_RESPONSE_EVENT, RegisterRequest, RegisterResponse } from '../model/register';
import { SocketService } from '../services/socket.service';

export const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
	const password = group.get('password')?.value;
	const confirmPassword = group.get('confirmPassword')?.value;
	return password && confirmPassword && password !== confirmPassword
		? { passwordMismatch: true }
		: null;
};

@Component({
	selector: 'app-registration-page',
	templateUrl: './registration.html',
	styleUrls: ['./registration.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
})
export default class RegistrationPage implements OnDestroy {
	private socketService = inject(SocketService);
	private fb = inject(FormBuilder);
	private router = inject(Router);
	private unsubscribeResponse?: () => void;

	protected registrationForm = this.fb.group(
		{
			playerName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
			email: ['', [Validators.required, Validators.email]],
			password: ['', [Validators.required, Validators.minLength(8)]],
			confirmPassword: ['', [Validators.required]],
		},
		{ validators: passwordMatchValidator },
	);

	protected isSubmitting = signal(false);
	protected successMessage = signal<string | null>(null);
	protected errorMessage = signal<string | null>(null);

    constructor() { 
        effect(() => {
            this.socketService.connect(this.socketService.serverUrl);
        });
    }

	submit(): void {
		if (this.registrationForm.invalid) {
			this.registrationForm.markAllAsTouched();
			return;
		}

		const { playerName, email, password } = this.registrationForm.value;
		const request: RegisterRequest = {
			playerName: playerName!,
			email: email!,
			password: password!,
		};

		this.isSubmitting.set(true);
		this.successMessage.set(null);
		this.errorMessage.set(null);

		this.unsubscribeResponse = this.socketService.on(
			REGISTER_RESPONSE_EVENT,
			(response: RegisterResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					this.successMessage.set(response.message);
					this.registrationForm.reset();
				} else {
					this.errorMessage.set(response.message);
				}
				this.unsubscribeResponse?.();
			},
		);

		this.socketService.emit(REGISTER_EVENT, request);
	}

		navigateToLogin(): void {
			this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
		}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
	}
}
