import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_LIST_REQUEST_EVENT = 'list-missions-request';
export const MISSION_LIST_RESPONSE_EVENT = 'list-missions-response';

/**
 * Socket payload for listing missions for a player character.
 */
export interface MissionListRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
  statuses?: MissionStatus[];
}

/**
 * Socket response payload containing mission progress list.
 */
export interface MissionListResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId: string;
  missions: CharacterMissionProgress[];
}
