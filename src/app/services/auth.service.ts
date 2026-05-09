import { Injectable, inject } from '@angular/core';
import { LOGIN_EVENT, LOGIN_RESPONSE_EVENT, type LoginRequest, type LoginResponse } from '../model/login';
import {
  REGISTER_EVENT,
  REGISTER_RESPONSE_EVENT,
  type RegisterRequest,
  type RegisterResponse,
} from '../model/register';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Handles authentication socket workflows for login and registration.
 */
export class AuthService {
  private socketService = inject(SocketService);

  /**
   * Sends login credentials and resolves once with the login response.
   */
  login(request: LoginRequest, onResponse: (response: LoginResponse) => void): () => void {
    const unsubscribe = this.socketService.on(LOGIN_RESPONSE_EVENT, (response: LoginResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(LOGIN_EVENT, request);
    return unsubscribe;
  }

  /**
   * Sends registration data and resolves once with the registration response.
   */
  register(request: RegisterRequest, onResponse: (response: RegisterResponse) => void): () => void {
    const unsubscribe = this.socketService.on(REGISTER_RESPONSE_EVENT, (response: RegisterResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(REGISTER_EVENT, request);
    return unsubscribe;
  }
}
