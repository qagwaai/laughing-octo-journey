import type { CharacterMissionProgress, MissionStatus } from './mission';

export const MISSION_ADD_REQUEST_EVENT = 'add-mission-request';
export const MISSION_ADD_RESPONSE_EVENT = 'add-mission-response';

export interface MissionAddRequest {
	playerName: string;
	characterId: string;
	missionId: string;
	sessionKey: string;
	status?: MissionStatus;
}

export interface MissionAddResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	mission?: CharacterMissionProgress;
}
