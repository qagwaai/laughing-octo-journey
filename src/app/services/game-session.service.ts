import { Injectable, inject } from '@angular/core';
import { GAME_JOIN_REQUEST_EVENT, GAME_JOIN_RESPONSE_EVENT, type GameJoinRequest, type GameJoinResult } from '../model/game-join';
import { INVALID_SESSION_EVENT } from '../model/session';
import { locale } from '../i18n/locale';
import { AUTH_SELECTION_TIMEOUT_MS, responseRecord } from './auth-selection-response';
import { createUuidCorrelationId } from './socket-correlation';
import { appLogger } from './logger';
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
  requestGameJoin(request: GameJoinRequest, onResponse: (response: GameJoinResult) => void): () => void {
    const correlationId = createUuidCorrelationId();
    const requestIdentity = {
      operation: 'game-join',
      entityType: 'game-session',
      containerId: request.characterId,
    };
    let handled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      handled = true;
      clearTimeout(timer);
      unsubscribe();
    };
    const unsubscribe = this.socketService.on(GAME_JOIN_RESPONSE_EVENT, (response: unknown) => {
      if (handled || !responseRecord(response) || response['correlationId'] !== correlationId) return;
      const identity = response['requestIdentity'];
      if (!responseRecord(identity) || identity['operation'] !== requestIdentity.operation ||
          identity['entityType'] !== requestIdentity.entityType || identity['containerId'] !== requestIdentity.containerId) return;
      if (response['playerName'] !== request.playerName || response['characterId'] !== request.characterId) return;
      cleanup();
      if (typeof response['success'] !== 'boolean' || typeof response['message'] !== 'string' ||
          (response['availability'] !== undefined &&
            (response['success'] !== false || response['availability'] !== 'unavailable' ||
              response['reason'] !== 'startup_not_verified'))) {
        appLogger.warn('[game-join] Invalid matched response');
        onResponse({ success: false, message: locale.character.list.errors.joinInvalidResponse, clientError: 'invalid_response' });
        return;
      }
      if (response['success'] === false && response['availability'] === 'unavailable' &&
          response['reason'] === 'startup_not_verified') {
        onResponse({
          success: false,
          message: response['message'],
          availability: 'unavailable',
          reason: 'startup_not_verified',
          playerName: request.playerName,
          characterId: request.characterId,
          correlationId,
          requestIdentity,
        });
        return;
      }
      onResponse({
        success: response['success'],
        message: response['message'],
        playerName: response['playerName'],
        characterId: response['characterId'],
        correlationId,
        requestIdentity,
      });
    });
    timer = setTimeout(() => {
      if (handled) return;
      cleanup();
      appLogger.warn('[game-join] Response timed out; join outcome not established');
      onResponse({ success: false, message: locale.character.list.errors.joinTimeout, clientError: 'timeout' });
    }, AUTH_SELECTION_TIMEOUT_MS);
    this.socketService.emit(GAME_JOIN_REQUEST_EVENT, {
      playerName: request.playerName,
      characterId: request.characterId,
      sessionKey: request.sessionKey,
      correlationId,
      requestIdentity,
    });
    return cleanup;
  }
}
