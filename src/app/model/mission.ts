export const MISSION_STATUS_VALUES = [
	'available',
	'started',
	'in-progress',
	'failed',
	'completed',
	'locked',
	'abandoned',
	'paused',
	'turned-in',
] as const;

export type CanonicalMissionStatus = (typeof MISSION_STATUS_VALUES)[number];

/**
 * Allows server-side extensions while preserving canonical values.
 * Example extensions: "expired", "reward-claimed", "timed-out".
 */
export type MissionStatus = CanonicalMissionStatus | (string & {});

export interface CharacterMissionProgress {
	missionId: string;
	status: MissionStatus;
	startedAt?: string;
	inProgressAt?: string;
	failedAt?: string;
	completedAt?: string;
	updatedAt?: string;
	failureReason?: string;
	statusDetail?: string;
}
