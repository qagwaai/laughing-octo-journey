import { Injectable, inject } from '@angular/core';
import { GAME_JOIN_REQUEST_EVENT, type GameJoinRequest } from '../model/game-join';
import { INVALID_SESSION_EVENT } from '../model/session';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Wraps game-session socket events used during join/bootstrap flows.
 */
export class GameSessionService {
  private socketService = inject(SocketService);

  /**
   * Subscribes to invalid-session events so callers can redirect to auth flows.
   */
  subscribeInvalidSession(onInvalidSession: () => void): () => void {
    return this.socketService.on(INVALID_SESSION_EVENT, () => {
      onInvalidSession();
    });
  }

  /**
   * Emits a game-join request for the active player/character session.
   */
  requestGameJoin(request: GameJoinRequest): void {
    this.socketService.emit(GAME_JOIN_REQUEST_EVENT, request);
  }
}
