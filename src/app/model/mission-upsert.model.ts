import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_UPSERT_REQUEST_EVENT = 'mission-upsert-request';
export const MISSION_UPSERT_RESPONSE_EVENT = 'mission-upsert-response';

export interface MissionUpsertRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for mission status upsert operations.
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
 * Socket response payload for mission upsert operations.
 */
export interface MissionUpsertResponse {
  success: boolean;
  message: string;
  correlationId?: string;
  requestIdentity?: MissionUpsertRequestIdentity;
  playerName: string;
  characterId: string;
  mission?: CharacterMissionProgress;
}
