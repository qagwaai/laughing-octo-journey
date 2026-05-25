import { Injectable, inject } from '@angular/core';
import {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
  type CharacterAddRequestIdentity,
  type CharacterAddRequest,
  type CharacterAddResponse,
} from '../model/character-add';
import {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT,
  type CharacterDeleteRequestIdentity,
  type CharacterDeleteRequest,
  type CharacterDeleteResponse,
} from '../model/character-delete';
import {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
  type CharacterEditRequestIdentity,
  type CharacterEditRequest,
  type CharacterEditResponse,
} from '../model/character-edit';
import {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
  type CharacterListRequestIdentity,
  type CharacterListRequest,
  type CharacterListResponse,
} from '../model/character-list';
import { appLogger } from './logger';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

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

function buildDefaultCharacterAddRequestIdentity(request: CharacterAddRequest): CharacterAddRequestIdentity {
  return {
    operation: 'character-add',
    entityType: 'character',
    containerId: `player-${normalizeIdentityValue(request.playerName) || 'unknown-player'}`,
  };
}

function isCharacterAddResponseForRequest(
  response: CharacterAddResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CharacterAddRequestIdentity,
  expectedRequest: CharacterAddRequest,
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

  const responseCharacterName = normalizeIdentityValue(response.characterName);
  const expectedCharacterName = normalizeIdentityValue(expectedRequest.characterName);
  if (responseCharacterName && expectedCharacterName && responseCharacterName !== expectedCharacterName) {
    return false;
  }

  return true;
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

function isCharacterListResponseForRequest(
  response: CharacterListResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CharacterListRequestIdentity,
  expectedRequest: CharacterListRequest,
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

  return normalizeIdentityValue(response.playerName) === normalizeIdentityValue(expectedRequest.playerName);
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

  /**
   * Creates a character and invokes the callback when the matching response arrives.
   */
  addCharacter(request: CharacterAddRequest, onResponse: (response: CharacterAddResponse) => void): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('character-add');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultCharacterAddRequestIdentity(request);
    const requestWithCorrelation: CharacterAddRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'character-service.addCharacter',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(CHARACTER_ADD_RESPONSE_EVENT, (response: CharacterAddResponse) => {
      if (handled) {
        return;
      }

      if (
        !isCharacterAddResponseForRequest(response, expectedCorrelationId, expectedRequestIdentity, requestWithCorrelation)
      ) {
        emitSocketCorrelationWarning('character-add', {
          responseCorrelationId: response.correlationId ?? null,
          expectedCorrelationId,
          responsePlayerName: response.playerName,
          expectedPlayerName: requestWithCorrelation.playerName,
          responseCharacterName: response.characterName ?? null,
          expectedCharacterName: requestWithCorrelation.characterName,
        });
        return;
      }

      handled = true;
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
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
        !isCharacterEditResponseForRequest(response, expectedCorrelationId, expectedRequestIdentity, requestWithCorrelation)
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
  listCharacters(request: CharacterListRequest, onResponse: (response: CharacterListResponse) => void): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('character-list');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultCharacterListRequestIdentity(request);
    const requestWithCorrelation: CharacterListRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'character-service.listCharacters',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(CHARACTER_LIST_RESPONSE_EVENT, (response: CharacterListResponse) => {
      if (handled) {
        return;
      }

      if (
        !isCharacterListResponseForRequest(response, expectedCorrelationId, expectedRequestIdentity, requestWithCorrelation)
      ) {
        emitSocketCorrelationWarning('character-list', {
          responseCorrelationId: response.correlationId ?? null,
          expectedCorrelationId,
          responsePlayerName: response.playerName,
          expectedPlayerName: requestWithCorrelation.playerName,
        });
        return;
      }

      handled = true;
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
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
