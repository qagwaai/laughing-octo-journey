import {
  MISSION_CATALOG,
  MISSION_IDS,
  isMissionCompleted,
  resolveMissionById,
  resolveNewlyUnlockedMissionIds,
  resolveVisibleMissions,
} from './mission-catalog';

describe('MISSION_CATALOG', () => {
  it('should contain all 11 expected mission IDs', () => {
    const ids = MISSION_CATALOG.map((m) => m.id);
    expect(ids).toContain(MISSION_IDS.firstTarget);
    expect(ids).toContain(MISSION_IDS.m01);
    expect(ids).toContain(MISSION_IDS.m02);
    expect(ids).toContain(MISSION_IDS.m03);
    expect(ids).toContain(MISSION_IDS.m04);
    expect(ids).toContain(MISSION_IDS.m05);
    expect(ids).toContain(MISSION_IDS.sq01);
    expect(ids).toContain(MISSION_IDS.sq02);
    expect(ids).toContain(MISSION_IDS.sq03);
    expect(ids).toContain(MISSION_IDS.sq04);
    expect(ids).toContain(MISSION_IDS.sqSystemSurvey01);
  });

  it('should have no duplicate mission IDs', () => {
    const ids = MISSION_CATALOG.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toEqual(ids.length);
  });

  it('should classify first-target as tutorial/main with no prerequisites', () => {
    const mission = resolveMissionById(MISSION_IDS.firstTarget);
    expect(mission).toBeDefined();
    expect(mission!.type).toBe('main');
    expect(mission!.act).toBe('tutorial');
    expect(mission!.prerequisites.length).toBe(0);
  });

  it('should require first-target as prerequisite for M-01', () => {
    const mission = resolveMissionById(MISSION_IDS.m01);
    expect(mission!.prerequisites).toContain(MISSION_IDS.firstTarget);
  });

  it('should require M-01 as prerequisite for M-02', () => {
    const mission = resolveMissionById(MISSION_IDS.m02);
    expect(mission!.prerequisites).toContain(MISSION_IDS.m01);
  });

  it('should require M-02 as prerequisite for SQ-01', () => {
    const mission = resolveMissionById(MISSION_IDS.sq01);
    expect(mission!.prerequisites).toContain(MISSION_IDS.m02);
  });

  it('should require first-target as prerequisite for SQ-02, SQ-03, and Local Survey Contract', () => {
    expect(resolveMissionById(MISSION_IDS.sq02)!.prerequisites).toContain(MISSION_IDS.firstTarget);
    expect(resolveMissionById(MISSION_IDS.sq03)!.prerequisites).toContain(MISSION_IDS.firstTarget);
    expect(resolveMissionById(MISSION_IDS.sqSystemSurvey01)!.prerequisites).toContain(MISSION_IDS.firstTarget);
  });

  it('should require M-04 as prerequisite for SQ-04', () => {
    expect(resolveMissionById(MISSION_IDS.sq04)!.prerequisites).toContain(MISSION_IDS.m04);
  });

  it('should classify all side quests as type side', () => {
    const sideQuests = [
      MISSION_IDS.sq01,
      MISSION_IDS.sq02,
      MISSION_IDS.sq03,
      MISSION_IDS.sq04,
      MISSION_IDS.sqSystemSurvey01,
    ];
    for (const id of sideQuests) {
      expect(resolveMissionById(id)!.type).toBe('side');
    }
  });

  it('should ensure all prerequisite IDs reference existing missions', () => {
    const allIds = new Set(MISSION_CATALOG.map((m) => m.id));
    for (const mission of MISSION_CATALOG) {
      for (const prereq of mission.prerequisites) {
        expect(allIds.has(prereq)).toBe(true);
      }
    }
  });
});

describe('resolveMissionById', () => {
  it('should return the mission for a known ID', () => {
    const mission = resolveMissionById(MISSION_IDS.m01);
    expect(mission).toBeDefined();
    expect(mission!.id).toBe(MISSION_IDS.m01);
  });

  it('should return undefined for an unknown ID', () => {
    expect(resolveMissionById('unknown-mission-xyz')).toBeUndefined();
  });
});

describe('resolveVisibleMissions', () => {
  it('should include only missions with all prerequisites satisfied', () => {
    const completed = new Set<string>([]);
    const visible = resolveVisibleMissions(completed);
    // Only first-target has no prerequisites — it is always visible.
    const visibleIds = visible.map((m) => m.id);
    expect(visibleIds).toContain(MISSION_IDS.firstTarget);
    expect(visibleIds).not.toContain(MISSION_IDS.m01);
  });

  it('should make M-01, SQ-02, SQ-03, and Local Survey Contract visible once first-target is completed', () => {
    const completed = new Set([MISSION_IDS.firstTarget]);
    const visible = resolveVisibleMissions(completed);
    const visibleIds = visible.map((m) => m.id);
    expect(visibleIds).toContain(MISSION_IDS.m01);
    expect(visibleIds).toContain(MISSION_IDS.sq02);
    expect(visibleIds).toContain(MISSION_IDS.sq03);
    expect(visibleIds).toContain(MISSION_IDS.sqSystemSurvey01);
    expect(visibleIds).not.toContain(MISSION_IDS.m02);
  });

  it('should make M-02 and SQ-01 visible once M-01 is completed', () => {
    const completed = new Set([MISSION_IDS.firstTarget, MISSION_IDS.m01]);
    const visible = resolveVisibleMissions(completed);
    const visibleIds = visible.map((m) => m.id);
    expect(visibleIds).toContain(MISSION_IDS.m02);
    expect(visibleIds).not.toContain(MISSION_IDS.sq01); // requires M-02
  });

  it('should unlock SQ-01 when both M-01 and M-02 are completed', () => {
    const completed = new Set([MISSION_IDS.firstTarget, MISSION_IDS.m01, MISSION_IDS.m02]);
    const visible = resolveVisibleMissions(completed);
    const visibleIds = visible.map((m) => m.id);
    expect(visibleIds).toContain(MISSION_IDS.sq01);
    expect(visibleIds).toContain(MISSION_IDS.m03);
  });
});

describe('resolveNewlyUnlockedMissionIds', () => {
  it('should return M-01 when first-target is just completed', () => {
    const alreadyCompleted = new Set<string>([]);
    const unlocked = resolveNewlyUnlockedMissionIds(MISSION_IDS.firstTarget, alreadyCompleted);
    expect(unlocked).toContain(MISSION_IDS.m01);
  });

  it('should return M-02 and SQ-01 when M-01 is just completed (with first-target also done)', () => {
    const alreadyCompleted = new Set([MISSION_IDS.firstTarget]);
    const unlocked = resolveNewlyUnlockedMissionIds(MISSION_IDS.m01, alreadyCompleted);
    expect(unlocked).toContain(MISSION_IDS.m02);
    // SQ-01 requires M-02, not just M-01, so it should NOT be unlocked here.
    expect(unlocked).not.toContain(MISSION_IDS.sq01);
  });

  it('should return SQ-02, SQ-03, and Local Survey Contract when first-target is just completed', () => {
    const alreadyCompleted = new Set<string>([]);
    const unlocked = resolveNewlyUnlockedMissionIds(MISSION_IDS.firstTarget, alreadyCompleted);
    expect(unlocked).toContain(MISSION_IDS.sq02);
    expect(unlocked).toContain(MISSION_IDS.sq03);
    expect(unlocked).toContain(MISSION_IDS.sqSystemSurvey01);
  });

  it('should not include missions already in the alreadyCompleted set', () => {
    const alreadyCompleted = new Set([MISSION_IDS.firstTarget, MISSION_IDS.m01]);
    const unlocked = resolveNewlyUnlockedMissionIds(MISSION_IDS.firstTarget, alreadyCompleted);
    // M-01 is already done, should not appear as newly unlocked.
    expect(unlocked).not.toContain(MISSION_IDS.m01);
  });

  it('should return an empty array for a mission that unlocks nothing', () => {
    const alreadyCompleted = new Set([
      MISSION_IDS.firstTarget,
      MISSION_IDS.m01,
      MISSION_IDS.m02,
      MISSION_IDS.m03,
      MISSION_IDS.m04,
    ]);
    const unlocked = resolveNewlyUnlockedMissionIds(MISSION_IDS.m05, alreadyCompleted);
    expect(unlocked.length).toBe(0);
  });
});

describe('isMissionCompleted', () => {
  it('should return true for completed status', () => {
    expect(isMissionCompleted('completed')).toBe(true);
  });

  it('should return true for turned-in status', () => {
    expect(isMissionCompleted('turned-in')).toBe(true);
  });

  it('should return false for in-progress, available, started, locked, and failed', () => {
    for (const status of ['in-progress', 'available', 'started', 'locked', 'failed', 'abandoned']) {
      expect(isMissionCompleted(status)).toBe(false);
    }
  });

  it('should return false for null and undefined', () => {
    expect(isMissionCompleted(null)).toBe(false);
    expect(isMissionCompleted(undefined)).toBe(false);
  });
});
