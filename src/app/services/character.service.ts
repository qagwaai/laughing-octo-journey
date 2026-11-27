import { Injectable, inject } from '@angular/core';
import {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
  type CharacterAddRequest,
  type CharacterAddRequestIdentity,
  type CharacterAddResponse,
} from '../model/character-add';
import {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT,
  type CharacterDeleteRequest,
  type CharacterDeleteRequestIdentity,
  type CharacterDeleteResponse,
} from '../model/character-delete';
import {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
  type CharacterEditRequest,
  type CharacterEditRequestIdentity,
  type CharacterEditResponse,
} from '../model/character-edit';
import {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
  type CharacterListRequest,
  type CharacterListRequestIdentity,
  type CharacterListResult,
} from '../model/character-list';
import { appLogger } from './logger';
import { createCorrelationId, createUuidCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { AUTH_SELECTION_TIMEOUT_MS, responseRecord, validCharacterListResponse } from './auth-selection-response';
import { locale } from '../i18n/locale';
import { SocketService } from './socket.service';
import { SessionService } from './session.service';

function matchesRequestIdentity(
  left:
    | CharacterAddRequestIdentity
    | CharacterEditRequestIdentity
    | CharacterListRequestIdentity
    | CharacterDeleteRequestIdentity
    | undefined,
  right:
    | CharacterAddRequestIdentity
    | CharacterEditRequestIdentity
    | CharacterListRequestIdentity
    | CharacterDeleteRequestIdentity
    | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function emitSocketCorrelationWarning(operation: string, detail: Record<string, unknown>): void {
  const serializedDetail = Object.keys(detail)
    .map((key) => `${key}=${detail[key] ?? 'missing'}`)
    .join(' ');

  appLogger.warn(`[socket-correlation] Dropping unmatched ${operation} response. ${serializedDetail}`);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('socket-correlation-warning', {
        detail: {
          operation,
          ...detail,
        },
      }),
    );
  }
}

function buildDefaultCharacterEditRequestIdentity(request: CharacterEditRequest): CharacterEditRequestIdentity {
  return {
    operation: 'character-edit',
    entityType: 'character',
    containerId: normalizeIdentityValue(request.characterId) || 'unknown-character-id',
  };
}

function isCharacterEditResponseForRequest(
  response: CharacterEditResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CharacterEditRequestIdentity,
  expectedRequest: CharacterEditRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  if (normalizeIdentityValue(response.playerName) !== normalizeIdentityValue(expectedRequest.playerName)) {
    return false;
  }

  if (normalizeIdentityValue(response.characterId) !== normalizeIdentityValue(expectedRequest.characterId)) {
    return false;
  }

  const responseCharacterName = normalizeIdentityValue(response.characterName);
  const expectedCharacterName = normalizeIdentityValue(expectedRequest.characterName);
  if (responseCharacterName && expectedCharacterName && responseCharacterName !== expectedCharacterName) {
    return false;
  }

  return true;
}

function buildDefaultCharacterListRequestIdentity(request: CharacterListRequest): CharacterListRequestIdentity {
  return {
    operation: 'character-list',
    entityType: 'character',
    containerId: `player-${normalizeIdentityValue(request.playerName) || 'unknown-player'}`,
  };
}

function buildDefaultCharacterDeleteRequestIdentity(request: CharacterDeleteRequest): CharacterDeleteRequestIdentity {
  return {
    operation: 'character-delete',
    entityType: 'character',
    containerId: normalizeIdentityValue(request.characterId) || 'unknown-character-id',
  };
}

function isCharacterDeleteResponseForRequest(
  response: CharacterDeleteResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CharacterDeleteRequestIdentity,
  expectedRequest: CharacterDeleteRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  if (normalizeIdentityValue(response.playerName) !== normalizeIdentityValue(expectedRequest.playerName)) {
    return false;
  }

  const responseCharacterId = normalizeIdentityValue(response.characterId);
  const expectedCharacterId = normalizeIdentityValue(expectedRequest.characterId);
  if (responseCharacterId && expectedCharacterId && responseCharacterId !== expectedCharacterId) {
    return false;
  }

  return true;
}

@Injectable({ providedIn: 'root' })
/**
 * Centralizes character CRUD socket interactions used by character selection flows.
 */
export class CharacterService {
  private socketService = inject(SocketService);
  private sessionService = inject(SessionService);

  /**
   * Creates a character and invokes the callback when the matching response arrives.
   */
  addCharacter(request: CharacterAddRequest, onResponse: (response: CharacterAddResponse) => void): () => void {
    const expectedCorrelationId = createUuidCorrelationId();
    const playerId = this.sessionService.getPlayerId()?.trim();
    if (!playerId) {
      appLogger.warn('[character-add] Cannot create a character without the authenticated player ID');
      throw new Error('Cannot create a character without the authenticated player ID.');
    }
    const expectedRequestIdentity = {
      operation: 'character-add',
      entityType: 'character',
      containerId: playerId,
    };
    const requestWithCorrelation: CharacterAddRequest = {
      playerName: request.playerName,
      characterName: request.characterName,
      sessionKey: request.sessionKey,
      correlationId: expectedCorrelationId,
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      handled = true;
      clearTimeout(timer);
      unsubscribe();
    };
    const unknownOutcome = (clientError: 'timeout' | 'invalid_response') => {
      appLogger.warn('[character-add] Creation outcome is unknown; check the character list', { clientError });
      onResponse({
        success: false,
        message: locale.character.setup.messages.creationOutcomeUnknown,
        playerName: request.playerName,
        correlationId: expectedCorrelationId,
        requestIdentity: expectedRequestIdentity,
        clientError,
      });
    };
    const unsubscribe = this.socketService.on(CHARACTER_ADD_RESPONSE_EVENT, (response: unknown) => {
      if (handled || !responseRecord(response) || response['correlationId'] !== expectedCorrelationId) return;
      const identity = response['requestIdentity'];
      if (!responseRecord(identity) || identity['operation'] !== expectedRequestIdentity.operation ||
          identity['entityType'] !== expectedRequestIdentity.entityType ||
          identity['containerId'] !== expectedRequestIdentity.containerId ||
          response['playerName'] !== request.playerName) return;
      cleanup();
      const validSuccess = response['success'] === true && typeof response['characterId'] === 'string' &&
        !!response['characterId'].trim() && response['characterName'] === request.characterName;
      const validFailure = response['success'] === false && !('characterId' in response) &&
        !('characterName' in response);
      if (typeof response['message'] !== 'string' || (!validSuccess && !validFailure)) {
        unknownOutcome('invalid_response');
        return;
      }
      const characterId = response['characterId'];
      onResponse({
        success: validSuccess,
        message: response['message'],
        playerName: request.playerName,
        correlationId: expectedCorrelationId,
        requestIdentity: expectedRequestIdentity,
        ...(validSuccess && typeof characterId === 'string' ? { characterName: request.characterName, characterId } : {}),
      });
    });
    timer = setTimeout(() => {
      if (handled) return;
      cleanup();
      unknownOutcome('timeout');
    }, AUTH_SELECTION_TIMEOUT_MS);
    this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, requestWithCorrelation);
    return cleanup;
  }

  /**
   * Updates an existing character and returns an unsubscribe hook for safety.
   */
  editCharacter(request: CharacterEditRequest, onResponse: (response: CharacterEditResponse) => void): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('character-edit');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultCharacterEditRequestIdentity(request);
    const requestWithCorrelation: CharacterEditRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'character-service.editCharacter',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(CHARACTER_EDIT_RESPONSE_EVENT, (response: CharacterEditResponse) => {
      if (handled) {
        return;
      }

      if (
        !isCharacterEditResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        emitSocketCorrelationWarning('character-edit', {
          responseCorrelationId: response.correlationId ?? null,
          expectedCorrelationId,
          responsePlayerName: response.playerName,
          expectedPlayerName: requestWithCorrelation.playerName,
          responseCharacterId: response.characterId,
          expectedCharacterId: requestWithCorrelation.characterId,
        });
        return;
      }

      handled = true;
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_EDIT_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
  }

  /**
   * Requests character list data for the active player context.
   */
  listCharacters(request: CharacterListRequest, onResponse: (response: CharacterListResult) => void): () => void {
    const expectedCorrelationId = createUuidCorrelationId();
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultCharacterListRequestIdentity(request);
    const requestWithCorrelation: CharacterListRequest = {
      playerName: request.playerName,
      sessionKey: request.sessionKey,
      correlationId: expectedCorrelationId,
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      handled = true;
      clearTimeout(timer);
      unsubscribe();
    };
    const unsubscribe = this.socketService.on(CHARACTER_LIST_RESPONSE_EVENT, (response: unknown) => {
      if (handled || !responseRecord(response) || response['correlationId'] !== expectedCorrelationId) return;
      const identity = response['requestIdentity'];
      if (!responseRecord(identity) ||
          ['operation', 'entityType', 'containerId'].some(
            (key) => identity[key] !== expectedRequestIdentity[key as keyof CharacterListRequestIdentity],
          )) return;
      cleanup();
      if (validCharacterListResponse(response) &&
          normalizeIdentityValue(response['playerName']) === normalizeIdentityValue(request.playerName)) {
        onResponse(response);
      } else {
        appLogger.warn('[character-list] Invalid matched selection response');
        onResponse({ success: false, message: locale.character.list.errors.invalidResponse, clientError: 'invalid_response' });
      }
    });
    timer = setTimeout(() => {
      if (handled) return;
      cleanup();
      appLogger.warn('[character-list] Selection response timed out');
      onResponse({ success: false, message: locale.character.list.errors.responseTimeout, clientError: 'timeout' });
    }, AUTH_SELECTION_TIMEOUT_MS);
    this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, requestWithCorrelation);
    return cleanup;
  }

  /**
   * Deletes a character and emits the backend result through the callback.
   */
  deleteCharacter(
    request: CharacterDeleteRequest,
    onResponse: (response: CharacterDeleteResponse) => void,
  ): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('character-delete');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultCharacterDeleteRequestIdentity(request);
    const requestWithCorrelation: CharacterDeleteRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'character-service.deleteCharacter',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(CHARACTER_DELETE_RESPONSE_EVENT, (response: CharacterDeleteResponse) => {
      if (handled) {
        return;
      }

      if (
        !isCharacterDeleteResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        emitSocketCorrelationWarning('character-delete', {
          responseCorrelationId: response.correlationId ?? null,
          expectedCorrelationId,
          responsePlayerName: response.playerName,
          expectedPlayerName: requestWithCorrelation.playerName,
          responseCharacterId: response.characterId ?? null,
          expectedCharacterId: requestWithCorrelation.characterId,
        });
        return;
      }

      handled = true;
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_DELETE_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
  }
}
