import type { MissionListRequest } from '../app/model/mission-list';
import type { MissionUpsertRequest } from '../app/model/mission-upsert.model';
import type {
  EnsureMissionExistsRequest,
  EnsureMissionExistsResult,
  ListMissionsResult,
  UpsertMissionStatusResult,
} from '../app/services/mission.service';

type AsyncMethod<TReq, TRes> = (req: TReq) => Promise<TRes>;
type SpyLike<T extends (...args: unknown[]) => unknown> = T & {
  and?: { resolveTo(value: Awaited<ReturnType<T>>): void };
  mockResolvedValue?: (value: Awaited<ReturnType<T>>) => unknown;
};

function createCompatibleSpy(name: string): any {
  const g = globalThis as any;
  if (g.jasmine?.createSpy) {
    return g.jasmine.createSpy(name);
  }
  if (g.vi?.fn) {
    return g.vi.fn();
  }
  throw new Error(`No supported test spy framework available for ${name}`);
}

function setSpyResolvedValue(spy: any, value: unknown): void {
  if (spy?.and?.resolveTo) {
    spy.and.resolveTo(value);
    return;
  }
  if (spy?.mockResolvedValue) {
    spy.mockResolvedValue(value);
    return;
  }
  if (spy?.and?.returnValue) {
    spy.and.returnValue(Promise.resolve(value));
    return;
  }
  if (spy?.mockImplementation) {
    spy.mockImplementation(() => Promise.resolve(value));
  }
}

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
  ensureMissionExists: SpyLike<AsyncMethod<EnsureMissionExistsRequest, EnsureMissionExistsResult>>;
  listMissions: SpyLike<AsyncMethod<MissionListRequest, ListMissionsResult>>;
  upsertMissionStatus: SpyLike<AsyncMethod<MissionUpsertRequest, UpsertMissionStatusResult>>;
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
