import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_LIST_REQUEST_EVENT = 'list-missions-request';
export const MISSION_LIST_RESPONSE_EVENT = 'list-missions-response';

export interface MissionListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for listing missions for a player character.
 */
export interface MissionListRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: MissionListRequestIdentity;
  statuses?: MissionStatus[];
}

/**
 * Socket response payload containing mission progress list.
 */
export interface MissionListResponse {
  success: boolean;
  message: string;
  correlationId?: string;
  requestIdentity?: MissionListRequestIdentity;
  playerName: string;
  characterId: string;
  missions: CharacterMissionProgress[];
}
