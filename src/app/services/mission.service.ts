import { Injectable } from '@angular/core';
import { MISSION_ADD_REQUEST_EVENT, MISSION_ADD_RESPONSE_EVENT, MissionAddResponse } from '../model/mission-add';
import {
	MISSION_UPSERT_REQUEST_EVENT,
	MISSION_UPSERT_RESPONSE_EVENT,
	MissionUpsertRequest,
	MissionUpsertResponse,
} from '../model/mission-upsert.model';
import {
	MISSION_LIST_REQUEST_EVENT,
	MISSION_LIST_RESPONSE_EVENT,
	MissionListRequest,
	MissionListResponse,
} from '../model/mission-list';
import type { MissionStatus } from '../model/mission';
import { SocketService } from './socket.service';

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

export type UpsertMissionStatusResult =
	| 'updated'
	| 'invalid-request'
	| 'not-connected'
	| 'update-failed'
	| 'timeout';

@Injectable({
	providedIn: 'root',
})
export class MissionService {
	private static readonly RESPONSE_TIMEOUT_MS = 5000;

	constructor(private socketService: SocketService) {}

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

			unsubscribeList = this.socketService.on(
				MISSION_LIST_RESPONSE_EVENT,
				(response: MissionListResponse) => {
					if (response.playerName !== playerName || response.characterId !== characterId) {
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

					unsubscribeAdd = this.socketService.on(
						MISSION_ADD_RESPONSE_EVENT,
						(addResponse: MissionAddResponse) => {
							if (
								addResponse.playerName !== playerName ||
								addResponse.characterId !== characterId
							) {
								return;
							}

							settle(addResponse.success ? 'added' : 'add-failed');
						},
					);

					this.socketService.emit(MISSION_ADD_REQUEST_EVENT, {
						playerName,
						characterId,
						missionId,
						sessionKey,
						status: request.initialStatus ?? 'available',
					});
				},
			);

			this.socketService.emit(MISSION_LIST_REQUEST_EVENT, listRequest);
		});
	}

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

			unsubscribeAdd = this.socketService.on(
				MISSION_UPSERT_RESPONSE_EVENT,
				(addResponse: MissionUpsertResponse) => {
					if (addResponse.playerName !== playerName || addResponse.characterId !== characterId) {
						return;
					}

					settle(addResponse.success ? 'updated' : 'update-failed');
				},
			);

			this.socketService.emit(MISSION_UPSERT_REQUEST_EVENT, {
				playerName,
				characterId,
				missionId,
				sessionKey,
				status,
			});
		});
	}

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
}
