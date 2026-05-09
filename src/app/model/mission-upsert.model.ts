import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_UPSERT_REQUEST_EVENT = 'add-mission-request';
export const MISSION_UPSERT_RESPONSE_EVENT = 'add-mission-response';

/**
 * Socket payload for mission status upsert operations.
 */
export interface MissionUpsertRequest {
  playerName: string;
  characterId: string;
  missionId: string;
  sessionKey: string;
  status: MissionStatus;
  statusDetail?: string;
}

/**
 * Socket response payload for mission upsert operations.
 */
export interface MissionUpsertResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId: string;
  mission?: CharacterMissionProgress;
}
