import type { MissionStatus } from './mission';

export type ShipExteriorViewSeedPolicy = 'auto' | 'new' | 'resume';

export interface ShipExteriorViewMissionContext {
	missionId: string;
	missionStatusHint?: MissionStatus;
	seedPolicy?: ShipExteriorViewSeedPolicy;
}

export function resolveShipExteriorViewSeedPolicy(params: {
	seedPolicy?: ShipExteriorViewSeedPolicy;
	missionStatusHint?: MissionStatus | null;
}): Exclude<ShipExteriorViewSeedPolicy, 'auto'> {
	if (params.seedPolicy === 'new' || params.seedPolicy === 'resume') {
		return params.seedPolicy;
	}

	const status = params.missionStatusHint?.trim().toLowerCase();
	if (!status) {
		return 'new';
	}

	if (status === 'started' || status === 'in-progress' || status === 'paused') {
		return 'resume';
	}

	return 'new';
}
