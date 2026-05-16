import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { resolveNavigationState } from '../navigation-state';
import {
  currentLocaleCode,
  isSupportedLocaleCode,
  locale,
  setActiveLocaleCode,
  supportedLocaleCodes,
  type SupportedLocaleCode,
} from '../../i18n/locale';
import { LoginRequest, LoginResponse } from '../../model/login';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../services/session.service';

interface LoginNavigationState {
  preferredLocale?: string;
}

@Component({
  selector: 'app-login-page',
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
/**
 * Login page that authenticates user credentials and applies locale preference.
 */
export default class LoginPage implements OnDestroy {
  protected readonly t = locale;
  protected readonly supportedLocaleCodes = supportedLocaleCodes;
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private unsubscribeResponse?: () => void;
  private navigationState: LoginNavigationState = resolveNavigationState<LoginNavigationState>(this.router);
  private defaultLocale: SupportedLocaleCode =
    typeof this.navigationState.preferredLocale === 'string' &&
    isSupportedLocaleCode(this.navigationState.preferredLocale)
      ? this.navigationState.preferredLocale
      : currentLocaleCode;

  protected loginForm = this.fb.group({
    playerName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    locale: [this.defaultLocale, [Validators.required]],
  });

  protected isSubmitting = signal(false);
  protected successMessage = signal<string | null>(null);
  protected errorMessage = signal<string | null>(null);
  protected canNavigateToRegister = signal(false);

  /**
   * Validates credentials, sends login request, and routes to character list on success.
   */
  submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { playerName, password } = this.loginForm.value;
    const normalizedPlayerName = playerName?.trim() ?? '';
    const normalizedPassword = password ?? '';
    const normalizedLocale =
      typeof this.loginForm.value.locale === 'string' && isSupportedLocaleCode(this.loginForm.value.locale)
        ? this.loginForm.value.locale
        : currentLocaleCode;

    if (!normalizedPlayerName || !normalizedPassword) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set(this.t.public.login.messages.requiredFields);
      this.canNavigateToRegister.set(false);
      return;
    }

    const request: LoginRequest = {
      playerName: normalizedPlayerName,
      password: normalizedPassword,
      locale: normalizedLocale,
    };
    setActiveLocaleCode(request.locale ?? currentLocaleCode);

    this.isSubmitting.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.canNavigateToRegister.set(false);
    this.unsubscribeResponse?.();

    this.unsubscribeResponse = this.authService.login(request, (response: LoginResponse) => {
      this.isSubmitting.set(false);
      if (response.success) {
        if (response.sessionKey) {
          this.sessionService.setSessionKey(response.sessionKey);
        }
        this.successMessage.set(response.message);
        this.canNavigateToRegister.set(false);
        this.router.navigate([{ outlets: { left: ['character-list'] } }], {
          preserveFragment: true,
          state: { playerName: request.playerName },
        });
        this.unsubscribeResponse?.();
        return;
      }

      if (response.reason === 'PLAYER_NOT_REGISTERED') {
        this.errorMessage.set(this.t.public.login.messages.playerNotRegistered);
        this.canNavigateToRegister.set(true);
      } else if (response.reason === 'PASSWORD_MISMATCH') {
        this.errorMessage.set(this.t.public.login.messages.passwordMismatch);
        this.canNavigateToRegister.set(false);
      } else {
        this.errorMessage.set(response.message);
        this.canNavigateToRegister.set(false);
      }

      this.unsubscribeResponse?.();
    });
  }

  /**
   * Navigates to registration while preserving locale preference.
   */
  navigateToRegistration(): void {
    const preferredLocale = this.loginForm.value.locale;
    this.router.navigate([{ outlets: { left: ['registration'] } }], {
      preserveFragment: true,
      state: {
        preferredLocale:
          typeof preferredLocale === 'string' && isSupportedLocaleCode(preferredLocale)
            ? preferredLocale
            : currentLocaleCode,
      },
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeResponse?.();
  }
}
