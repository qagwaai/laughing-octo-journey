import { Injectable, inject } from '@angular/core';
import { appLogger } from './logger';
import {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT,
  type MissionListRequestIdentity,
  type MissionListRequest,
  type MissionListResponse,
} from '../model/mission-list';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

function buildDefaultMissionListRequestIdentity(request: MissionListRequest): MissionListRequestIdentity {
  return {
    operation: 'mission-list',
    entityType: 'mission',
    containerId: normalizeIdentityValue(request.characterId) || 'unknown-character',
  };
}

function matchesRequestIdentity(
  left: MissionListRequestIdentity | undefined,
  right: MissionListRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isMissionListResponseForRequest(
  response: MissionListResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: MissionListRequestIdentity,
  expectedRequest: MissionListRequest,
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

  if (response.playerName && response.playerName !== expectedRequest.playerName) {
    return false;
  }

  if (response.characterId && response.characterId !== expectedRequest.characterId) {
    return false;
  }

  return true;
}

@Injectable({ providedIn: 'root' })
/**
 * Provides mission-board list retrieval through the mission-list socket contract.
 */
export class MissionBoardService {
  private socketService = inject(SocketService);

  /**
   * Requests visible missions for the current player and returns an unsubscribe function.
   */
  listMissions(request: MissionListRequest, onResponse: (response: MissionListResponse) => void): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('mission-list');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultMissionListRequestIdentity(request);
    const requestWithCorrelation: MissionListRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'mission-board-service.listMissions',
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(MISSION_LIST_RESPONSE_EVENT, (response: MissionListResponse) => {
      if (!isMissionListResponseForRequest(response, expectedCorrelationId, expectedRequestIdentity, requestWithCorrelation)) {
        appLogger.warn(
          `[socket-correlation] Dropping unmatched mission-list response in mission-board wrapper. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responsePlayerName=${response.playerName ?? 'missing'} expectedPlayerName=${requestWithCorrelation.playerName} responseCharacterId=${response.characterId ?? 'missing'} expectedCharacterId=${requestWithCorrelation.characterId}`,
        );
        return;
      }

      onResponse(response);
    });

    this.socketService.emit(MISSION_LIST_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
  }
}
