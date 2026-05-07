import type {
	EnsureMissionExistsRequest,
	EnsureMissionExistsResult,
	ListMissionsResult,
	UpsertMissionStatusResult,
} from '../app/services/mission.service';
import type { MissionUpsertRequest } from '../app/model/mission-upsert.model';
import type { MissionListRequest } from '../app/model/mission-list';

/**
 * Canonical MockMissionService for use in spec files.
 * All methods are jasmine spies that resolve to reasonable defaults.
 *
 * Usage:
 *   import { createMockMissionService, MockMissionService } from '../../../testing';
 *   let missionService: MockMissionService;
 *   beforeEach(() => { missionService = createMockMissionService(); });
 *   // Override a specific result:
 *   missionService.upsertMissionStatus.and.resolveTo('updated');
 */
export interface MockMissionService {
	ensureMissionExists: jasmine.Spy<(req: EnsureMissionExistsRequest) => Promise<EnsureMissionExistsResult>>;
	listMissions: jasmine.Spy<(req: MissionListRequest) => Promise<ListMissionsResult>>;
	upsertMissionStatus: jasmine.Spy<(req: MissionUpsertRequest) => Promise<UpsertMissionStatusResult>>;
}

export function createMockMissionService(): MockMissionService {
	return {
		ensureMissionExists: jasmine.createSpy('ensureMissionExists').and.resolveTo('already-exists'),
		listMissions: jasmine
			.createSpy('listMissions')
			.and.resolveTo({ status: 'loaded', missions: [] } satisfies ListMissionsResult),
		upsertMissionStatus: jasmine.createSpy('upsertMissionStatus').and.resolveTo('updated'),
	};
}
