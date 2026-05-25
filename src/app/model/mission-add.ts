import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_ADD_REQUEST_EVENT = 'add-mission-request';
export const MISSION_ADD_RESPONSE_EVENT = 'add-mission-response';

export interface MissionAddRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for creating mission progress records.
 */
export interface MissionAddRequest {
  playerName: string;
  characterId: string;
  missionId: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: MissionAddRequestIdentity;
  status?: MissionStatus;
}

/**
 * Socket response payload for mission add requests.
 */
export interface MissionAddResponse {
  success: boolean;
  message: string;
  correlationId?: string;
  requestIdentity?: MissionAddRequestIdentity;
  playerName: string;
  characterId: string;
  mission?: CharacterMissionProgress;
}
