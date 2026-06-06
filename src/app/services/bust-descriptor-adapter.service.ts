import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { BustDescriptorAdapter } from '../model/bust-adapter';
import {
  CHARACTER_BUST_CREATE_REQUEST_EVENT,
  CHARACTER_BUST_CREATE_RESPONSE_EVENT,
  CHARACTER_BUST_READ_REQUEST_EVENT,
  CHARACTER_BUST_READ_RESPONSE_EVENT,
  CHARACTER_BUST_UPDATE_REQUEST_EVENT,
  CHARACTER_BUST_UPDATE_RESPONSE_EVENT,
  NPC_BUST_CREATE_REQUEST_EVENT,
  NPC_BUST_CREATE_RESPONSE_EVENT,
  NPC_BUST_READ_REQUEST_EVENT,
  NPC_BUST_READ_RESPONSE_EVENT,
  NPC_BUST_UPDATE_REQUEST_EVENT,
  NPC_BUST_UPDATE_RESPONSE_EVENT,
  type BustRequestIdentity,
  type CharacterBustCreateRequest,
  type CharacterBustCreateTerminalResponse,
  type CharacterBustReadRequest,
  type CharacterBustReadResponse,
  type CharacterBustUpdateRequest,
  type CharacterBustUpdateTerminalResponse,
  type NpcBustCreateRequest,
  type NpcBustCreateTerminalResponse,
  type NpcBustReadRequest,
  type NpcBustReadResponse,
  type NpcBustUpdateRequest,
  type NpcBustUpdateTerminalResponse,
} from '../model/bust-descriptor';
import { appLogger } from './logger';
import { createCorrelationId, matchesBasicRequestIdentity } from './socket-correlation';
import { SocketService } from './socket.service';

type CorrelatedBustRequest = {
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: BustRequestIdentity;
};

type CorrelatedBustResponse = {
  correlationId?: unknown;
  requestIdentity?: unknown;
};

function buildRequestIdentity(operation: string, entityType: string, containerId: string): BustRequestIdentity {
  return {
    operation,
    entityType,
    containerId,
  };
}

function hasMatchingCorrelation(
  response: CorrelatedBustResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: BustRequestIdentity,
): boolean {
  const responseCorrelationId =
    typeof response.correlationId === 'string' ? response.correlationId.trim() : '';
  if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
    return false;
  }

  return matchesBasicRequestIdentity(
    response.requestIdentity as BustRequestIdentity | undefined,
    expectedRequestIdentity,
  );
}

@Injectable({ providedIn: 'root' })
export class BustDescriptorAdapterService implements BustDescriptorAdapter {
  private socketService = inject(SocketService);

  createCharacterBust(
    request: CharacterBustCreateRequest,
  ): Observable<CharacterBustCreateTerminalResponse> {
    return this.sendBustRequest(
      request,
      CHARACTER_BUST_CREATE_REQUEST_EVENT,
      CHARACTER_BUST_CREATE_RESPONSE_EVENT,
      'character-bust-create',
      'character-bust',
      request.characterId,
      'createCharacterBust',
    );
  }

  readCharacterBust(request: CharacterBustReadRequest): Observable<CharacterBustReadResponse> {
    return this.sendBustRequest(
      request,
      CHARACTER_BUST_READ_REQUEST_EVENT,
      CHARACTER_BUST_READ_RESPONSE_EVENT,
      'character-bust-read',
      'character-bust',
      request.characterId,
      'readCharacterBust',
    );
  }

  updateCharacterBust(
    request: CharacterBustUpdateRequest,
  ): Observable<CharacterBustUpdateTerminalResponse> {
    return this.sendBustRequest(
      request,
      CHARACTER_BUST_UPDATE_REQUEST_EVENT,
      CHARACTER_BUST_UPDATE_RESPONSE_EVENT,
      'character-bust-update',
      'character-bust',
      request.characterId,
      'updateCharacterBust',
    );
  }

  createNpcBust(request: NpcBustCreateRequest): Observable<NpcBustCreateTerminalResponse> {
    return this.sendBustRequest(
      request,
      NPC_BUST_CREATE_REQUEST_EVENT,
      NPC_BUST_CREATE_RESPONSE_EVENT,
      'npc-bust-create',
      'npc-bust',
      request.npcId,
      'createNpcBust',
    );
  }

  readNpcBust(request: NpcBustReadRequest): Observable<NpcBustReadResponse> {
    return this.sendBustRequest(
      request,
      NPC_BUST_READ_REQUEST_EVENT,
      NPC_BUST_READ_RESPONSE_EVENT,
      'npc-bust-read',
      'npc-bust',
      request.npcId,
      'readNpcBust',
    );
  }

  updateNpcBust(request: NpcBustUpdateRequest): Observable<NpcBustUpdateTerminalResponse> {
    return this.sendBustRequest(
      request,
      NPC_BUST_UPDATE_REQUEST_EVENT,
      NPC_BUST_UPDATE_RESPONSE_EVENT,
      'npc-bust-update',
      'npc-bust',
      request.npcId,
      'updateNpcBust',
    );
  }

  private sendBustRequest<TRequest extends CorrelatedBustRequest, TResponse>(
    request: TRequest,
    requestEvent: string,
    responseEvent: string,
    operation: string,
    entityType: string,
    containerId: string,
    correlationSourceSuffix: string,
  ): Observable<TResponse> {
    return new Observable<TResponse>((subscriber) => {
      const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId(operation);
      const expectedRequestIdentity =
        request.requestIdentity ?? buildRequestIdentity(operation, entityType, containerId);

      const requestWithCorrelation = {
        ...request,
        correlationId: expectedCorrelationId,
        correlationSource:
          request.correlationSource?.trim() || `bust-descriptor-adapter.${correlationSourceSuffix}`,
        requestIdentity: expectedRequestIdentity,
      };

      let handled = false;
      const unsubscribe = this.socketService.on(responseEvent, (rawResponse: unknown) => {
        if (handled) {
          return;
        }

        if (
          !hasMatchingCorrelation(
            rawResponse as CorrelatedBustResponse,
            expectedCorrelationId,
            expectedRequestIdentity,
          )
        ) {
          const responseCorrelationId =
            typeof (rawResponse as CorrelatedBustResponse)?.correlationId === 'string'
              ? ((rawResponse as CorrelatedBustResponse).correlationId as string)
              : 'missing';
          if (responseCorrelationId !== 'missing' && responseCorrelationId !== expectedCorrelationId) {
            // Another in-flight request received this response.
            return;
          }

          appLogger.warn(
            `[socket-correlation] Dropping unmatched ${operation} response. responseCorrelationId=${responseCorrelationId} expectedCorrelationId=${expectedCorrelationId} responseRequestIdentity=${JSON.stringify((rawResponse as CorrelatedBustResponse)?.requestIdentity ?? null)} expectedRequestIdentity=${JSON.stringify(expectedRequestIdentity)}`,
          );
          return;
        }

        handled = true;
        unsubscribe();
        subscriber.next(rawResponse as TResponse);
        subscriber.complete();
      });

      this.socketService.emit(requestEvent, requestWithCorrelation);

      return () => {
        unsubscribe();
      };
    });
  }
}