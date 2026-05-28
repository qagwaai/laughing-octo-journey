export const MISSION_STATUS_VALUES = ['AVAILABLE', 'ACTIVE', 'COMPLETED'] as const;

export type CanonicalMissionStatus = (typeof MISSION_STATUS_VALUES)[number];

export type MissionStatus = CanonicalMissionStatus;

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
