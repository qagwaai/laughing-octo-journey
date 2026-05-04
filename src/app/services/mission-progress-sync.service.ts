import { Injectable } from '@angular/core';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import { MissionService, type UpsertMissionStatusResult } from './mission.service';
import { MissionAssignmentService } from './mission-assignment.service';
import type { CharacterMissionProgress } from '../model/mission';

export interface MissionProgressSyncRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
	gateState: ShipExteriorMissionGateState;
	/** Current mission list used to determine what follow-on missions to assign. */
	currentMissions?: CharacterMissionProgress[];
}

@Injectable({
	providedIn: 'root',
})
export class MissionProgressSyncService {
	constructor(
		private missionService: MissionService,
		private missionAssignmentService: MissionAssignmentService,
	) {}

	async syncGateState(request: MissionProgressSyncRequest): Promise<UpsertMissionStatusResult | 'skipped'> {
		const playerName = request.playerName.trim();
		const characterId = request.characterId.trim();
		const sessionKey = request.sessionKey.trim();
		const missionId = request.gateState.missionId?.trim();
		if (!playerName || !characterId || !sessionKey || !missionId) {
			return 'skipped';
		}

		const status = this.resolveStatusFromGateState(request.gateState);
		const upsertResult = await this.missionService.upsertMissionStatus({
			playerName,
			characterId,
			sessionKey,
			missionId,
			status,
			statusDetail: JSON.stringify(request.gateState),
		});

		// When a mission completes, auto-assign unlocked follow-on missions client-side.
		if (status === 'completed') {
			await this.missionAssignmentService.assignFollowOnMissions(missionId, {
				playerName,
				characterId,
				currentMissions: request.currentMissions ?? [],
			});
		}

		return upsertResult;
	}

	private resolveStatusFromGateState(gateState: ShipExteriorMissionGateState): string {
		const totalSteps = gateState.steps.length;
		if (totalSteps > 0 && gateState.steps.every((step) => step.status === 'completed')) {
			return 'completed';
		}

		if (gateState.steps.some((step) => step.status === 'completed' || step.status === 'pending-retry')) {
			return 'in-progress';
		}

		return 'started';
	}
}
