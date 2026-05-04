import { Injectable } from '@angular/core';
import {
	isMissionCompleted,
	resolveNewlyUnlockedMissionIds,
	MISSION_IDS,
} from '../model/mission-catalog';
import type { CharacterMissionProgress } from '../model/mission';
import { MissionService } from './mission.service';
import { SessionService } from './session.service';

export interface MissionAssignmentContext {
	playerName: string;
	characterId: string;
	currentMissions: CharacterMissionProgress[];
}

export interface MissionAssignmentResult {
	assignedMissionIds: string[];
	skippedMissionIds: string[];
}

/**
 * Client-side service responsible for assigning follow-on missions when a mission
 * is completed. This is a client-only optimistic approach until the backend
 * supports server-driven mission assignment.
 *
 * Assignment rules mirror the MISSION_CATALOG prerequisite graph: when a mission
 * transitions to 'completed' or 'turned-in', all catalog missions whose prerequisites
 * are now fully satisfied are assigned with status 'available'.
 */
@Injectable({
	providedIn: 'root',
})
export class MissionAssignmentService {
	constructor(
		private missionService: MissionService,
		private sessionService: SessionService,
	) {}

	/**
	 * Checks if `completedMissionId` unlocks any new missions and assigns them
	 * client-side with status 'available'. Already-assigned missions are skipped.
	 */
	async assignFollowOnMissions(
		completedMissionId: string,
		context: MissionAssignmentContext,
	): Promise<MissionAssignmentResult> {
		const playerName = context.playerName.trim();
		const characterId = context.characterId.trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			return { assignedMissionIds: [], skippedMissionIds: [] };
		}

		const alreadyCompletedIds = new Set(
			context.currentMissions
				.filter((m) => isMissionCompleted(m.status))
				.map((m) => m.missionId),
		);

		const alreadyAssignedIds = new Set(context.currentMissions.map((m) => m.missionId));

		const newlyUnlocked = resolveNewlyUnlockedMissionIds(completedMissionId, alreadyCompletedIds);

		const assignedMissionIds: string[] = [];
		const skippedMissionIds: string[] = [];

		for (const missionId of newlyUnlocked) {
			if (alreadyAssignedIds.has(missionId)) {
				skippedMissionIds.push(missionId);
				continue;
			}

			const result = await this.missionService.ensureMissionExists({
				playerName,
				characterId,
				sessionKey,
				missionId,
				initialStatus: 'available',
			});

			if (result === 'added' || result === 'already-exists') {
				assignedMissionIds.push(missionId);
			} else {
				skippedMissionIds.push(missionId);
			}
		}

		return { assignedMissionIds, skippedMissionIds };
	}

	/**
	 * Convenience: assign all missions unlocked when the first-target mission completes.
	 * Called from the ship exterior flow on first-target completion.
	 */
	async assignPostFirstTargetMissions(context: MissionAssignmentContext): Promise<MissionAssignmentResult> {
		return this.assignFollowOnMissions(MISSION_IDS.firstTarget, context);
	}
}
