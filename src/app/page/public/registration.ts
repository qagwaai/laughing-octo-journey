import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  currentLocaleCode,
  isSupportedLocaleCode,
  locale,
  setActiveLocaleCode,
  supportedLocaleCodes,
  type SupportedLocaleCode,
} from '../../i18n/locale';
import { RegisterRequest, RegisterResponse } from '../../model/register';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../services/session.service';

interface RegistrationNavigationState {
  preferredLocale?: string;
}

/**
 * Validates matching password fields on registration form.
 */
export const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-registration-page',
  templateUrl: './registration.html',
  styleUrls: ['./registration.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
/**
 * Registration page that creates accounts and initializes session state on success.
 */
export default class RegistrationPage implements OnDestroy {
  protected readonly t = locale;
  protected readonly supportedLocaleCodes = supportedLocaleCodes;
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private unsubscribeResponse?: () => void;
  private navigationState: RegistrationNavigationState =
    (this.router.getCurrentNavigation()?.extras.state as RegistrationNavigationState | undefined) ??
    (history.state as RegistrationNavigationState | undefined) ??
    {};
  private defaultLocale: SupportedLocaleCode =
    typeof this.navigationState.preferredLocale === 'string' &&
    isSupportedLocaleCode(this.navigationState.preferredLocale)
      ? this.navigationState.preferredLocale
      : currentLocaleCode;

  protected registrationForm = this.fb.group(
    {
      locale: [this.defaultLocale, [Validators.required]],
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

  /**
   * Validates registration form and submits account creation request.
   */
  submit(): void {
    if (this.registrationForm.invalid) {
      this.registrationForm.markAllAsTouched();
      return;
    }

    const { playerName, email, password, locale: selectedLocale } = this.registrationForm.value;
    const normalizedPlayerName = playerName?.trim() ?? '';
    const normalizedEmail = email?.trim() ?? '';
    const normalizedPassword = password ?? '';
    const normalizedLocale =
      typeof selectedLocale === 'string' && isSupportedLocaleCode(selectedLocale) ? selectedLocale : currentLocaleCode;

    if (!normalizedPlayerName || !normalizedEmail || !normalizedPassword) {
      this.registrationForm.markAllAsTouched();
      this.errorMessage.set(this.t.public.registration.messages.requiredFields);
      return;
    }

    const request: RegisterRequest = {
      playerName: normalizedPlayerName,
      email: normalizedEmail,
      password: normalizedPassword,
      locale: normalizedLocale,
    };
    setActiveLocaleCode(request.locale ?? currentLocaleCode);

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.unsubscribeResponse?.();

    this.unsubscribeResponse = this.authService.register(request, (response: RegisterResponse) => {
      this.isSubmitting.set(false);
      if (response.success) {
        if (response.sessionKey) {
          this.sessionService.setSessionKey(response.sessionKey);
        }
        this.successMessage.set(response.message);
        this.router.navigate([{ outlets: { left: ['character-list'] } }], {
          preserveFragment: true,
          state: { playerName: request.playerName },
        });
        this.registrationForm.reset();
      } else {
        this.errorMessage.set(response.message);
      }
      this.unsubscribeResponse?.();
    });
  }

  /**
   * Navigates back to login while preserving selected locale.
   */
  navigateToLogin(): void {
    const selectedLocale = this.registrationForm.value.locale;
    this.router.navigate([{ outlets: { left: ['login'] } }], {
      preserveFragment: true,
      state: {
        preferredLocale:
          typeof selectedLocale === 'string' && isSupportedLocaleCode(selectedLocale)
            ? selectedLocale
            : currentLocaleCode,
      },
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeResponse?.();
  }
}
