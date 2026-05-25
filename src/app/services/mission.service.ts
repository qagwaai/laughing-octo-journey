import { Injectable } from '@angular/core';
import { appLogger } from './logger';
import type { MissionStatus } from '../model/mission';
import type { ShipDamagePreset } from '../model/ship-damage';
import { resolveMissionInitializationStrategy } from './mission-navigation/mission-initialization-strategy';
import {
  MISSION_ADD_REQUEST_EVENT,
  MISSION_ADD_RESPONSE_EVENT,
  type MissionAddRequest,
  type MissionAddRequestIdentity,
  MissionAddResponse,
} from '../model/mission-add';
import {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT,
  type MissionListRequestIdentity,
  MissionListRequest,
  MissionListResponse,
} from '../model/mission-list';
import {
  MISSION_UPSERT_REQUEST_EVENT,
  MISSION_UPSERT_RESPONSE_EVENT,
  type MissionUpsertRequestIdentity,
  MissionUpsertRequest,
  MissionUpsertResponse,
} from '../model/mission-upsert.model';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

function buildDefaultMissionListRequestIdentity(request: MissionListRequest): MissionListRequestIdentity {
  return {
    operation: 'mission-list',
    entityType: 'mission',
    containerId: normalizeIdentityValue(request.characterId) || 'unknown-character',
  };
}

function matchesMissionListRequestIdentity(
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
      return matchesMissionListRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  return (
    normalizeIdentityValue(response.playerName) === normalizeIdentityValue(expectedRequest.playerName) &&
    normalizeIdentityValue(response.characterId) === normalizeIdentityValue(expectedRequest.characterId)
  );
}

function buildDefaultMissionAddRequestIdentity(request: MissionAddRequest): MissionAddRequestIdentity {
  return {
    operation: 'mission-upsert',
    entityType: 'mission',
    containerId: normalizeIdentityValue(request.characterId) || 'unknown-character',
  };
}

function matchesMissionAddRequestIdentity(
  left: MissionAddRequestIdentity | undefined,
  right: MissionAddRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isMissionAddResponseForRequest(
  response: MissionAddResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: MissionAddRequestIdentity,
  expectedRequest: MissionAddRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesMissionAddRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  return (
    normalizeIdentityValue(response.playerName) === normalizeIdentityValue(expectedRequest.playerName) &&
    normalizeIdentityValue(response.characterId) === normalizeIdentityValue(expectedRequest.characterId)
  );
}

function buildDefaultMissionUpsertRequestIdentity(request: MissionUpsertRequest): MissionUpsertRequestIdentity {
  return {
    operation: 'mission-upsert',
    entityType: 'mission',
    containerId: normalizeIdentityValue(request.characterId) || 'unknown-character',
  };
}

function matchesMissionUpsertRequestIdentity(
  left: MissionUpsertRequestIdentity | undefined,
  right: MissionUpsertRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isMissionUpsertResponseForRequest(
  response: MissionUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: MissionUpsertRequestIdentity,
  expectedRequest: MissionUpsertRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesMissionUpsertRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  return (
    normalizeIdentityValue(response.playerName) === normalizeIdentityValue(expectedRequest.playerName) &&
    normalizeIdentityValue(response.characterId) === normalizeIdentityValue(expectedRequest.characterId)
  );
}

/**
 * Input contract for ensuring a mission record exists for a character session.
 */
export interface EnsureMissionExistsRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
  missionId: string;
  initialStatus?: MissionStatus;
}

export type EnsureMissionExistsResult =
  | 'added'
  | 'already-exists'
  | 'invalid-request'
  | 'not-connected'
  | 'list-failed'
  | 'add-failed'
  | 'timeout';

export type UpsertMissionStatusResult = 'updated' | 'invalid-request' | 'not-connected' | 'update-failed' | 'timeout';

export interface ListMissionsResult {
  status: 'loaded' | 'invalid-request' | 'not-connected' | 'list-failed' | 'timeout';
  missions: MissionListResponse['missions'];
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Mission workflow service that wraps list/add/upsert socket contracts with timeout handling.
 */
export class MissionService {
  private static readonly RESPONSE_TIMEOUT_MS = 5000;

  constructor(private socketService: SocketService) {}

  /**
   * Ensures a mission exists by listing first, then adding only when absent.
   */
  async ensureMissionExists(request: EnsureMissionExistsRequest): Promise<EnsureMissionExistsResult> {
    const playerName = request.playerName.trim();
    const characterId = request.characterId.trim();
    const missionId = request.missionId.trim();
    const sessionKey = request.sessionKey.trim();

    if (!playerName || !characterId || !missionId || !sessionKey) {
      return 'invalid-request';
    }

    const isConnected = await this.ensureConnected();
    if (!isConnected) {
      return 'not-connected';
    }

    const listRequest: MissionListRequest = { playerName, characterId, sessionKey };

    return new Promise<EnsureMissionExistsResult>((resolve) => {
      let settled = false;
      let unsubscribeList: (() => void) | undefined;
      let unsubscribeAdd: (() => void) | undefined;

      const settle = (result: EnsureMissionExistsResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        unsubscribeList?.();
        unsubscribeAdd?.();
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => {
        settle('timeout');
      }, MissionService.RESPONSE_TIMEOUT_MS);

      const listCorrelationId = createCorrelationId('mission-list');
      const listRequestIdentity = buildDefaultMissionListRequestIdentity(listRequest);

      unsubscribeList = this.socketService.on(MISSION_LIST_RESPONSE_EVENT, (response: MissionListResponse) => {
        if (!isMissionListResponseForRequest(response, listCorrelationId, listRequestIdentity, listRequest)) {
          appLogger.warn(
            `[socket-correlation] Dropping unmatched mission-list response. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${listCorrelationId} responsePlayerName=${response.playerName ?? 'missing'} responseCharacterId=${response.characterId ?? 'missing'}`,
          );
          return;
        }

        if (!response.success) {
          settle('list-failed');
          return;
        }

        const hasMission = (response.missions ?? []).some((mission) => mission.missionId === missionId);
        if (hasMission) {
          settle('already-exists');
          return;
        }

        const addRequest: MissionAddRequest = {
          playerName,
          characterId,
          missionId,
          sessionKey,
          status: request.initialStatus ?? 'available',
          correlationId: createCorrelationId('mission-add'),
          correlationSource: 'mission-service.ensureMissionExists.add',
        };
        const addRequestIdentity = buildDefaultMissionAddRequestIdentity(addRequest);
        addRequest.requestIdentity = addRequestIdentity;

        unsubscribeAdd = this.socketService.on(MISSION_ADD_RESPONSE_EVENT, (addResponse: MissionAddResponse) => {
          if (
            !isMissionAddResponseForRequest(
              addResponse,
              addRequest.correlationId!,
              addRequestIdentity,
              addRequest,
            )
          ) {
            appLogger.warn(
              `[socket-correlation] Dropping unmatched mission-add response. responseCorrelationId=${addResponse.correlationId ?? 'missing'} expectedCorrelationId=${addRequest.correlationId} responsePlayerName=${addResponse.playerName ?? 'missing'} responseCharacterId=${addResponse.characterId ?? 'missing'}`,
            );
            return;
          }

          settle(addResponse.success ? 'added' : 'add-failed');
        });

        this.socketService.emit(MISSION_ADD_REQUEST_EVENT, addRequest);
      });

      this.socketService.emit(MISSION_LIST_REQUEST_EVENT, {
        ...listRequest,
        correlationId: listCorrelationId,
        correlationSource: 'mission-service.ensureMissionExists.list',
        requestIdentity: listRequestIdentity,
      });
    });
  }

  /**
   * Loads missions for a player/character and returns structured status metadata.
   */
  async listMissions(request: MissionListRequest): Promise<ListMissionsResult> {
    const playerName = request.playerName.trim();
    const characterId = request.characterId.trim();
    const sessionKey = request.sessionKey.trim();

    if (!playerName || !characterId || !sessionKey) {
      return { status: 'invalid-request', missions: [] };
    }

    const isConnected = await this.ensureConnected();
    if (!isConnected) {
      return { status: 'not-connected', missions: [] };
    }

    return new Promise<ListMissionsResult>((resolve) => {
      let settled = false;
      let unsubscribeList: (() => void) | undefined;

      const settle = (result: ListMissionsResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        unsubscribeList?.();
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => {
        settle({ status: 'timeout', missions: [] });
      }, MissionService.RESPONSE_TIMEOUT_MS);

      const listRequestWithCorrelation: MissionListRequest = {
        playerName,
        characterId,
        sessionKey,
        ...(Array.isArray(request.statuses) ? { statuses: request.statuses } : {}),
        correlationId: createCorrelationId('mission-list'),
        correlationSource: 'mission-service.listMissions',
      };
      const listRequestIdentity = buildDefaultMissionListRequestIdentity(listRequestWithCorrelation);
      listRequestWithCorrelation.requestIdentity = listRequestIdentity;

      unsubscribeList = this.socketService.on(MISSION_LIST_RESPONSE_EVENT, (response: MissionListResponse) => {
        if (
          !isMissionListResponseForRequest(
            response,
            listRequestWithCorrelation.correlationId!,
            listRequestIdentity,
            listRequestWithCorrelation,
          )
        ) {
          appLogger.warn(
            `[socket-correlation] Dropping unmatched mission-list response. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${listRequestWithCorrelation.correlationId} responsePlayerName=${response.playerName ?? 'missing'} responseCharacterId=${response.characterId ?? 'missing'}`,
          );
          return;
        }

        if (!response.success) {
          settle({
            status: 'list-failed',
            missions: [],
            message: response.message,
          });
          return;
        }

        settle({
          status: 'loaded',
          missions: response.missions ?? [],
        });
      });

      this.socketService.emit(MISSION_LIST_REQUEST_EVENT, listRequestWithCorrelation);
    });
  }

  /**
   * Upserts mission status and optional status-detail payload for mission progress sync.
   */
  async upsertMissionStatus(request: MissionUpsertRequest): Promise<UpsertMissionStatusResult> {
    const playerName = request.playerName.trim();
    const characterId = request.characterId.trim();
    const missionId = request.missionId.trim();
    const sessionKey = request.sessionKey.trim();
    const status = request.status.trim();

    if (!playerName || !characterId || !missionId || !sessionKey || !status) {
      return 'invalid-request';
    }

    const isConnected = await this.ensureConnected();
    if (!isConnected) {
      return 'not-connected';
    }

    return new Promise<UpsertMissionStatusResult>((resolve) => {
      let settled = false;
      let unsubscribeAdd: (() => void) | undefined;

      const upsertRequest: MissionUpsertRequest = {
        playerName,
        characterId,
        missionId,
        sessionKey,
        status,
        ...(typeof request.statusDetail === 'string' ? { statusDetail: request.statusDetail } : {}),
        correlationId: createCorrelationId('mission-upsert'),
        correlationSource: 'mission-service.upsertMissionStatus',
      };
      const upsertRequestIdentity = buildDefaultMissionUpsertRequestIdentity(upsertRequest);
      upsertRequest.requestIdentity = upsertRequestIdentity;

      const settle = (result: UpsertMissionStatusResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        unsubscribeAdd?.();
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => {
        settle('timeout');
      }, MissionService.RESPONSE_TIMEOUT_MS);

      unsubscribeAdd = this.socketService.on(MISSION_UPSERT_RESPONSE_EVENT, (addResponse: MissionUpsertResponse) => {
        if (
          !isMissionUpsertResponseForRequest(
            addResponse,
            upsertRequest.correlationId!,
            upsertRequestIdentity,
            upsertRequest,
          )
        ) {
          appLogger.warn(
            `[socket-correlation] Dropping unmatched mission-upsert response. responseCorrelationId=${addResponse.correlationId ?? 'missing'} expectedCorrelationId=${upsertRequest.correlationId} responsePlayerName=${addResponse.playerName ?? 'missing'} responseCharacterId=${addResponse.characterId ?? 'missing'}`,
          );
          return;
        }

        settle(addResponse.success ? 'updated' : 'update-failed');
      });

      this.socketService.emit(MISSION_UPSERT_REQUEST_EVENT, upsertRequest);
    });
  }

  /**
   * Ensures socket connectivity before mission requests proceed.
   */
  private ensureConnected(): Promise<boolean> {
    if (this.socketService.getIsConnected()) {
      return Promise.resolve(true);
    }

    this.socketService.connect(this.socketService.serverUrl);

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timeoutId = window.setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, MissionService.RESPONSE_TIMEOUT_MS);

      this.socketService.once('connect', () => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(timeoutId);
        resolve(true);
      });
    });
  }

  /**
   * Returns true when the supplied mission status represents an active (in-progress) mission.
   */
  isMissionInProgress(status: MissionStatus | undefined | null): boolean {
    return status === 'started' || status === 'in-progress' || status === 'paused';
  }

  /**
   * Resolves the damage preset for a mission from its registered initialization strategy.
   */
  getMissionDamagePreset(
    missionId: string,
    status?: MissionStatus | null,
  ): ShipDamagePreset | undefined {
    const strategy = resolveMissionInitializationStrategy(missionId);
    return strategy.resolveDamagePreset?.({ missionId, missionStatus: status ?? null });
  }
}
