import { Injectable, inject } from '@angular/core';
import { LOGIN_EVENT, LOGIN_RESPONSE_EVENT, type LoginRequest, type LoginResponse } from '../model/login';
import {
  REGISTER_EVENT,
  REGISTER_RESPONSE_EVENT,
  type RegisterRequest,
  type RegisterResponse,
} from '../model/register';
import { SocketService } from './socket.service';
import { AUTH_SELECTION_TIMEOUT_MS, responseRecord, validAuthResponse } from './auth-selection-response';
import { createUuidCorrelationId } from './socket-correlation';
import { locale } from '../i18n/locale';
import { appLogger } from './logger';

@Injectable({ providedIn: 'root' })
/**
 * Handles authentication socket workflows for login and registration.
 */
export class AuthService {
  private socketService = inject(SocketService);
  private cancelLogin?: () => void;

  /**
   * Sends login credentials and resolves once with the login response.
   */
  login(request: LoginRequest, onResponse: (response: LoginResponse) => void): () => void {
    this.cancelLogin?.();
    this.cancelLogin = this.send<LoginResponse>('login', request, onResponse, (value): value is LoginResponse => validAuthResponse(value, 'login'), onResponse);
    return this.cancelLogin;
  }

  /**
   * Sends registration data and resolves once with the registration response.
   */
  register(request: RegisterRequest, onResponse: (response: RegisterResponse) => void): () => void {
    return this.send<RegisterResponse>('register', request, onResponse, (value): value is RegisterResponse => validAuthResponse(value, 'register'), onResponse);
  }

  private send<T>(
    operation: 'login' | 'register',
    request: LoginRequest | RegisterRequest,
    onResponse: (response: T) => void,
    validate: (response: unknown) => response is T,
    onFailure: (response: { success: false; message: string; clientError: 'timeout' | 'invalid_response' }) => void,
  ): () => void {
    const correlationId = createUuidCorrelationId();
    let handled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      handled = true;
      clearTimeout(timer);
      unsubscribe();
    };
    const unsubscribe = this.socketService.on(
      operation === 'login' ? LOGIN_RESPONSE_EVENT : REGISTER_RESPONSE_EVENT,
      (response: unknown) => {
        if (handled || !responseRecord(response) || response['correlationId'] !== correlationId) return;
        cleanup();
        if (validate(response)) {
          onResponse(response);
        } else {
          appLogger.warn(`[auth] Invalid matched ${operation} response`);
          onFailure({ success: false, message: locale.public.login.messages.invalidResponse, clientError: 'invalid_response' });
        }
      },
    );
    timer = setTimeout(() => {
      if (handled) return;
      cleanup();
      appLogger.warn(`[auth] ${operation} response timed out; outcome not established`);
      onFailure({ success: false, message: locale.public.login.messages.outcomeUnknown, clientError: 'timeout' });
    }, AUTH_SELECTION_TIMEOUT_MS);
    const payload = {
      playerName: request.playerName,
      password: request.password,
      correlationId,
      ...(request.locale === undefined ? {} : { locale: request.locale }),
      ...(operation === 'register' && 'email' in request ? { email: request.email } : {}),
    };
    this.socketService.emit(operation === 'login' ? LOGIN_EVENT : REGISTER_EVENT, payload);
    return cleanup;
  }
}
