import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_UPSERT_REQUEST_EVENT = 'mission-upsert-request';
export const MISSION_UPSERT_RESPONSE_EVENT = 'mission-upsert-response';

/**
 * Legacy compatibility upsert request contract mirroring mission-upsert.model.ts.
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
 * Legacy compatibility upsert response contract mirroring mission-upsert.model.ts.
 */
export interface MissionUpsertResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId: string;
  mission?: CharacterMissionProgress;
}
