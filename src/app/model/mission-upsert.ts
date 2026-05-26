import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_UPSERT_REQUEST_EVENT = 'mission-upsert-request';
export const MISSION_UPSERT_RESPONSE_EVENT = 'mission-upsert-response';

export interface MissionUpsertRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Legacy compatibility upsert request contract mirroring mission-upsert.model.ts.
 */
export interface MissionUpsertRequest {
  playerName: string;
  characterId: string;
  missionId: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: MissionUpsertRequestIdentity;
  status: MissionStatus;
  statusDetail?: string;
}

/**
 * Legacy compatibility upsert response contract mirroring mission-upsert.model.ts.
 */
export interface MissionUpsertResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: MissionUpsertRequestIdentity;
  playerName: string;
  characterId: string;
  mission?: CharacterMissionProgress;
}
