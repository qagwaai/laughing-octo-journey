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
export class AuthService {
  private socketService = inject(SocketService);

  login(request: LoginRequest, onResponse: (response: LoginResponse) => void): () => void {
    const unsubscribe = this.socketService.on(LOGIN_RESPONSE_EVENT, (response: LoginResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(LOGIN_EVENT, request);
    return unsubscribe;
  }

  register(request: RegisterRequest, onResponse: (response: RegisterResponse) => void): () => void {
    const unsubscribe = this.socketService.on(REGISTER_RESPONSE_EVENT, (response: RegisterResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(REGISTER_EVENT, request);
    return unsubscribe;
  }
}
