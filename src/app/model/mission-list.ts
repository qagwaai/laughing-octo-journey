import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_LIST_REQUEST_EVENT = 'list-missions-request';
export const MISSION_LIST_RESPONSE_EVENT = 'list-missions-response';

export interface MissionListRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
	statuses?: MissionStatus[];
}

export interface MissionListResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	missions: CharacterMissionProgress[];
}
