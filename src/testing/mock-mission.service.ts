import type { MissionListRequest } from '../app/model/mission-list';
import type { MissionUpsertRequest } from '../app/model/mission-upsert.model';
import type {
  EnsureMissionExistsRequest,
  EnsureMissionExistsResult,
  ListMissionsResult,
  UpsertMissionStatusResult,
} from '../app/services/mission.service';

type SpyLike<TReq, TRes> = ((req: TReq) => Promise<TRes>) & {
  mockResolvedValue(value: TRes): unknown;
  mockImplementation(fn: (req: TReq) => Promise<TRes>): unknown;
};

function createCompatibleSpy(name: string): any {
  const g = globalThis as any;
  if (g.vi?.fn) {
    return g.vi.fn();
  }
  throw new Error(`Vitest spy framework is not available for ${name}`);
}

function setSpyResolvedValue(spy: any, value: unknown): void {
  if (spy?.mockResolvedValue) {
    spy.mockResolvedValue(value);
    return;
  }
  if (spy?.mockImplementation) {
    spy.mockImplementation(() => Promise.resolve(value));
  }
}

/**
 * Canonical MockMissionService for use in Vitest files.
 * All methods are Vitest spies that resolve to reasonable defaults.
 *
 * Usage:
 *   import { createMockMissionService, MockMissionService } from '../../../testing';
 *   let missionService: MockMissionService;
 *   beforeEach(() => { missionService = createMockMissionService(); });
 *   // Override a specific result:
 *   missionService.upsertMissionStatus.mockResolvedValue('updated');
 */
export interface MockMissionService {
  ensureMissionExists: SpyLike<EnsureMissionExistsRequest, EnsureMissionExistsResult>;
  listMissions: SpyLike<MissionListRequest, ListMissionsResult>;
  upsertMissionStatus: SpyLike<MissionUpsertRequest, UpsertMissionStatusResult>;
}

export function createMockMissionService(): MockMissionService {
  const ensureMissionExists = createCompatibleSpy('ensureMissionExists');
  const listMissions = createCompatibleSpy('listMissions');
  const upsertMissionStatus = createCompatibleSpy('upsertMissionStatus');

  setSpyResolvedValue(ensureMissionExists, 'already-exists');
  setSpyResolvedValue(listMissions, { status: 'loaded', missions: [] } satisfies ListMissionsResult);
  setSpyResolvedValue(upsertMissionStatus, 'updated');

  return {
    ensureMissionExists,
    listMissions,
    upsertMissionStatus,
  };
}
