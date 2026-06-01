import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { appLogger } from '../../services/logger';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { resolveNavigationState } from '../navigation-state';
import {
  createInitialMissionGateState,
  parseMissionGateState,
  resolveShipExteriorMission,
  serializeMissionGateState,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import {
  MISSION_CATALOG,
  isMissionCompleted,
  resolveMissionById,
  type MissionDefinition,
} from '../../model/catalog/mission-catalog';
import { PlayerCharacterSummary } from '../../model/character-list';
import type { CharacterMissionProgress, MissionStatus } from '../../model/mission';
import { type MissionListRequest, type MissionListResponse } from '../../model/mission-list';
import { MissionBoardService } from '../../services/mission-board.service';
import { SessionService } from '../../services/session.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';

type MissionLane = 'available' | 'active' | 'completed';
type MissionLaneFilter = 'all' | MissionLane;

interface MissionBoardLaneEntry {
  missionId: string;
  title: string;
  status: MissionLane;
  source: 'assigned' | 'catalog-available';
  assignedMission?: CharacterMissionProgress;
  catalogMission?: MissionDefinition;
}

interface UnknownMissionStatusDiagnostic {
  missionId: string;
  status: unknown;
}

interface MissionBoardNavigationState {
  playerName?: string;
  joinCharacter?: PlayerCharacterSummary;
}

@Component({
  selector: 'app-mission-board-page',
  templateUrl: './mission-board.html',
  styleUrls: ['./mission-board.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuardedLeftMenu, CharacterShipBadge],
})
export default class MissionBoardPage {
  private static readonly CONTRACT_VIOLATION_STATUS = 'contract-violation';
  private static readonly FILTER_QUERY_PARAM = 'missionStatusFilter';
  private static readonly FILTER_STORAGE_FALLBACK_KEY = 'mission-board:lane-filter:last';
  private static readonly ALLOWED_FILTERS: readonly MissionLaneFilter[] = ['all', 'available', 'active', 'completed'];

  protected readonly t = locale;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private missionBoardService = inject(MissionBoardService);
  private socketLifecycleService = inject(SocketLifecycleService);
  private sessionService = inject(SessionService);
  private missionStateService = inject(ShipExteriorMissionStateService);
  private unsubscribeMissionListResponse?: () => void;
  private navigationState: MissionBoardNavigationState =
    resolveNavigationState<MissionBoardNavigationState>(this.router);

  protected playerName = signal<string>(this.navigationState.playerName ?? '');
  protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
  protected showGuardedMenu = computed(() => this.route.outlet !== 'right');
  protected missions = signal<CharacterMissionProgress[]>([]);
  protected isLoadingMissions = signal(false);
  protected missionListError = signal<string | null>(null);
  protected selectedLaneFilter = signal<MissionLaneFilter>('all');
  protected readonly allMissionLanes: readonly MissionLane[] = ['available', 'active', 'completed'];
  protected readonly missionLaneFilters: readonly MissionLaneFilter[] = ['all', 'available', 'active', 'completed'];
  private readonly reportedViolationSignatures = new Set<string>();

  private readonly unknownStatusDiagnostics = computed<UnknownMissionStatusDiagnostic[]>(() => {
    const diagnostics: UnknownMissionStatusDiagnostic[] = [];
    for (const mission of this.missions()) {
      const displayStatus = this.getMissionDisplayStatus(mission);
      if (displayStatus !== MissionBoardPage.CONTRACT_VIOLATION_STATUS) {
        continue;
      }

      diagnostics.push({
        missionId: mission.missionId,
        status: mission.status,
      });
    }

    return diagnostics;
  });

  private readonly violationTelemetry = effect(() => {
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? 'unknown-character';

    for (const diagnostic of this.unknownStatusDiagnostics()) {
      const signature = `${characterId}|${diagnostic.missionId}|${String(diagnostic.status)}`;
      if (this.reportedViolationSignatures.has(signature)) {
        continue;
      }

      this.reportedViolationSignatures.add(signature);
      appLogger.error('[mission-board-contract] Contract violation: unknown mission status in mission board lane mapping.', {
        feature: 'SW-01',
        component: 'mission-board',
        playerName,
        characterId,
        missionId: diagnostic.missionId,
        observedStatus: diagnostic.status,
        canonicalStatuses: ['available', 'active', 'completed'],
      });
    }
  });

  /**
   * The set of mission IDs already tracked by the backend (assigned).
   * Used to decide which catalog missions are "new" vs already in the list.
   */
  private readonly assignedMissionIds = computed(() => new Set(this.missions().map((m) => m.missionId)));

  /** IDs of missions with completed/turned-in status — drives which missions are visible. */
  private readonly completedMissionIds = computed(
    () =>
      new Set(
        this.missions()
          .filter((m) => isMissionCompleted(m.status))
          .map((m) => m.missionId),
      ),
  );

  /**
   * Catalog missions that are NOT yet assigned to the character but whose
   * prerequisites are all satisfied — shown as "Available" entries.
   */
  protected readonly availableCatalogMissions = computed<MissionDefinition[]>(() => {
    const completed = this.completedMissionIds();
    const assigned = this.assignedMissionIds();
    return MISSION_CATALOG.filter(
      (m) =>
        !assigned.has(m.id) &&
        m.prerequisites.length > 0 &&
        m.prerequisites.every((prereqId) => completed.has(prereqId)),
    );
  });

  /**
   * Catalog missions that are still locked (prerequisites not yet met and not assigned).
   * Only shown as a preview — not actionable.
   */
  protected readonly lockedCatalogMissions = computed<MissionDefinition[]>(() => {
    const completed = this.completedMissionIds();
    const assigned = this.assignedMissionIds();
    return MISSION_CATALOG.filter(
      (m) =>
        !assigned.has(m.id) &&
        m.prerequisites.length > 0 &&
        !m.prerequisites.every((prereqId) => completed.has(prereqId)),
    );
  });

  private readonly assignedLaneEntries = computed<{
    available: MissionBoardLaneEntry[];
    active: MissionBoardLaneEntry[];
    completed: MissionBoardLaneEntry[];
  }>(() => {
    const lanes = {
      available: [] as MissionBoardLaneEntry[],
      active: [] as MissionBoardLaneEntry[],
      completed: [] as MissionBoardLaneEntry[],
    };

    for (const mission of this.missions()) {
      const status = this.getMissionDisplayStatus(mission);
      if (status !== 'available' && status !== 'active' && status !== 'completed') {
        continue;
      }

      lanes[status].push({
        missionId: mission.missionId,
        title: this.getMissionTitle(mission.missionId),
        status,
        source: 'assigned',
        assignedMission: mission,
      });
    }

    return lanes;
  });

  protected readonly laneEntries = computed<{
    available: MissionBoardLaneEntry[];
    active: MissionBoardLaneEntry[];
    completed: MissionBoardLaneEntry[];
  }>(() => ({
    available: [
      ...this.assignedLaneEntries().available,
      ...this.availableCatalogMissions().map((mission) => ({
        missionId: mission.id,
        title: mission.title,
        status: 'available' as const,
        source: 'catalog-available' as const,
        catalogMission: mission,
      })),
    ],
    active: this.assignedLaneEntries().active,
    completed: this.assignedLaneEntries().completed,
  }));

  protected readonly laneCounts = computed(() => ({
    available: this.laneEntries().available.length,
    active: this.laneEntries().active.length,
    completed: this.laneEntries().completed.length,
  }));

  protected readonly visibleMissionLanes = computed<readonly MissionLane[]>(() => {
    const selected = this.selectedLaneFilter();
    return selected === 'all' ? this.allMissionLanes : [selected];
  });

  protected readonly visibleUnknownStatusViolations = computed(() => this.unknownStatusDiagnostics());

  protected readonly hasLaneContent = computed(() => {
    const counts = this.laneCounts();
    return counts.available + counts.active + counts.completed > 0;
  });

  protected readonly shouldRenderEmptyState = computed(
    () =>
      !this.isLoadingMissions() &&
      !this.missionListError() &&
      !this.hasLaneContent() &&
      this.visibleUnknownStatusViolations().length === 0 &&
      this.lockedCatalogMissions().length === 0,
  );

  protected readonly shouldRenderLaneSection = computed(
    () => !this.isLoadingMissions() && !this.missionListError() && (this.hasLaneContent() || this.visibleUnknownStatusViolations().length > 0),
  );

  protected readonly hasNoResultsForSelectedFilter = computed(() => {
    const selectedFilter = this.selectedLaneFilter();
    if (selectedFilter === 'all') {
      return false;
    }

    return this.getLaneEntries(selectedFilter).length === 0;
  });

  private readonly missionGateStageSync = effect(() => {
    const savedGateState = this.missionStateService.lastSaved();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    if (!savedGateState || !characterId || savedGateState.characterId !== characterId) {
      return;
    }

    this.missions.update((missions) =>
      missions.map((mission) =>
        mission.missionId !== savedGateState.missionId
          ? mission
          : {
              ...mission,
              statusDetail: serializeMissionGateState(savedGateState),
              updatedAt: savedGateState.updatedAt,
            },
      ),
    );
  });

  constructor() {
    const persistedFilter = this.readPersistedMissionLaneFilter();
    if (persistedFilter) {
      this.selectedLaneFilter.set(persistedFilter);
    }

    const routeFilterRaw = this.route.snapshot.queryParamMap.get(MissionBoardPage.FILTER_QUERY_PARAM);
    if (routeFilterRaw !== null) {
      const routeFilter = this.parseMissionLaneFilter(routeFilterRaw);
      this.selectedLaneFilter.set(routeFilter);
      if (routeFilter !== 'all') {
        this.persistMissionLaneFilter(routeFilter, false);
      }
    }

    this.socketLifecycleService.runWhenConnected(() => this.loadMissionsForCharacter());
  }

  setMissionLaneFilter(filter: MissionLaneFilter): void {
    if (filter === this.selectedLaneFilter()) {
      return;
    }

    this.selectedLaneFilter.set(filter);
    this.persistMissionLaneFilter(filter, true);
  }

  getLaneEntries(lane: MissionLane): MissionBoardLaneEntry[] {
    return this.laneEntries()[lane];
  }

  getMissionLaneTitle(lane: MissionLane): string {
    if (lane === 'available') {
      return this.t.game.missionBoard.availableLaneTitle;
    }
    if (lane === 'active') {
      return this.t.game.missionBoard.activeLaneTitle;
    }
    return this.t.game.missionBoard.completedLaneTitle;
  }

  getMissionLaneCount(lane: MissionLane): number {
    return this.laneCounts()[lane];
  }

  getMissionStatusLabel(status: MissionLane): string {
    if (status === 'available') {
      return this.t.game.missionBoard.availableStatusLabel;
    }
    if (status === 'active') {
      return this.t.game.missionBoard.activeStatusLabel;
    }
    return this.t.game.missionBoard.completedStatusLabel;
  }

  getMissionLaneFilterLabel(filter: MissionLaneFilter): string {
    if (filter === 'all') {
      return this.t.game.missionBoard.filterAllLabel;
    }
    return this.getMissionLaneTitle(filter);
  }

  loadMissionsForCharacter(): void {
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName) {
      this.missionListError.set(this.t.game.missionBoard.errors.loadMissionsRequiresPlayer);
      this.missions.set([]);
      return;
    }

    if (!characterId) {
      this.missionListError.set(this.t.game.missionBoard.errors.loadMissionsRequiresCharacterId);
      this.missions.set([]);
      return;
    }

    if (!sessionKey) {
      this.missionListError.set(this.t.game.missionBoard.errors.loadMissionsRequiresSessionKey);
      this.missions.set([]);
      return;
    }

    this.isLoadingMissions.set(true);
    this.missionListError.set(null);
    this.unsubscribeMissionListResponse?.();

    const request: MissionListRequest = { playerName, characterId, sessionKey };
    this.unsubscribeMissionListResponse = this.missionBoardService.listMissions(
      request,
      (response: MissionListResponse) => {
        this.isLoadingMissions.set(false);
        if (response.success) {
          this.missions.set(response.missions ?? []);
          this.missionListError.set(null);
        } else {
          this.missions.set([]);
          this.missionListError.set(response.message);
        }
      },
    );
  }

  getMissionStageInfo(mission: CharacterMissionProgress): { stage: string; nextStep: string } {
    const gateState = this.resolveEffectiveMissionGateState(mission);
    const totalSteps = gateState.steps.length;
    const completedCount = gateState.steps.filter(
      (s) => s.status === 'completed' || s.status === 'pending-retry',
    ).length;
    const activeStepIndex = gateState.steps.findIndex((s) => s.status === 'active' || s.status === 'pending-retry');
    const stageNumber = activeStepIndex >= 0 ? activeStepIndex + 1 : completedCount;
    const stage =
      completedCount >= totalSteps && totalSteps > 0
        ? `Stage ${totalSteps} of ${totalSteps} — Complete`
        : `Stage ${stageNumber} of ${totalSteps}`;
    return { stage, nextStep: gateState.activeObjectiveText };
  }

  getMissionDisplayStatus(mission: CharacterMissionProgress): string {
    if (mission.missionId !== 'first-target') {
      return this.normalizeCanonicalMissionStatus(mission.status);
    }

    const gateState = this.resolveEffectiveMissionGateState(mission);
    const missionDef = resolveShipExteriorMission(mission.missionId);
    return this.normalizeCanonicalMissionStatus(missionDef.resolveMissionStatusFromGateState(gateState));
  }

  getMissionDisplayStatusLabel(mission: CharacterMissionProgress): string {
    const status = this.getMissionDisplayStatus(mission);
    return status === MissionBoardPage.CONTRACT_VIOLATION_STATUS
      ? this.t.game.missionBoard.contractViolationStatusLabel
      : status;
  }

  private parseMissionLaneFilter(value: string | null): MissionLaneFilter {
    return MissionBoardPage.ALLOWED_FILTERS.includes(value as MissionLaneFilter) ? (value as MissionLaneFilter) : 'all';
  }

  private getMissionLaneStorageKey(): string | null {
    const playerName = this.playerName().trim();
    const characterId = this.joinCharacter()?.id?.trim() ?? '';
    if (!playerName || !characterId) {
      return null;
    }

    return `mission-board:lane-filter:${playerName}:${characterId}`;
  }

  private readPersistedMissionLaneFilter(): MissionLaneFilter | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const storageKey = this.getMissionLaneStorageKey();
    const storageKeys = storageKey
      ? [storageKey, MissionBoardPage.FILTER_STORAGE_FALLBACK_KEY]
      : [MissionBoardPage.FILTER_STORAGE_FALLBACK_KEY];

    for (const key of storageKeys) {
      try {
        const stored = window.localStorage.getItem(key);
        if (!stored) {
          continue;
        }

        return this.parseMissionLaneFilter(stored);
      } catch {
        // Ignore storage quota/availability issues.
      }
    }

    return null;
  }

  private persistMissionLaneFilter(filter: MissionLaneFilter, syncRoute: boolean): void {
    if (typeof window !== 'undefined') {
      const storageKey = this.getMissionLaneStorageKey();
      try {
        window.localStorage.setItem(MissionBoardPage.FILTER_STORAGE_FALLBACK_KEY, filter);
        if (storageKey) {
          window.localStorage.setItem(storageKey, filter);
        }
      } catch {
        // Ignore storage quota/availability issues.
      }
    }

    if (!syncRoute) {
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [MissionBoardPage.FILTER_QUERY_PARAM]: filter === 'all' ? null : filter,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
      preserveFragment: true,
    });
  }

  getMissionTitle(missionId: string): string {
    return resolveMissionById(missionId)?.title ?? missionId;
  }

  getMissionTypeLabel(type: MissionDefinition['type']): string {
    return type === 'side' ? this.t.game.missionBoard.typeLabelSide : this.t.game.missionBoard.typeLabelMain;
  }

  private resolveEffectiveMissionGateState(mission: CharacterMissionProgress): ShipExteriorMissionGateState {
    const characterId = this.resolveCharacterIdForMission(mission);
    const playerName = this.playerName().trim();

    const missionDef = resolveShipExteriorMission(mission.missionId);
    const stepDefinitions = missionDef.getGateStepDefinitions();
    const initialGateState = createInitialMissionGateState({
      missionId: mission.missionId,
      characterId,
      steps: stepDefinitions,
    });
    const persistedGateState = playerName
      ? (() => {
          const stored = this.missionStateService.loadState({
            missionId: mission.missionId,
            playerName,
            characterId,
          });
          if (!stored) {
            return null;
          }

          return (
            parseMissionGateState({
              rawStatusDetail: JSON.stringify(stored),
              missionId: mission.missionId,
              characterId,
              steps: stepDefinitions,
            }) ?? stored
          );
        })()
      : null;
    const parsedGateState = mission.statusDetail
      ? parseMissionGateState({
          rawStatusDetail: mission.statusDetail,
          missionId: mission.missionId,
          characterId,
          steps: stepDefinitions,
        })
      : null;
    const gateState = this.resolvePreferredMissionGateState(persistedGateState, parsedGateState, initialGateState);

    return gateState;
  }

  private resolveCharacterIdForMission(mission: CharacterMissionProgress): string {
    const navigationCharacterId = this.joinCharacter()?.id?.trim();
    if (navigationCharacterId) {
      return navigationCharacterId;
    }

    if (mission.statusDetail) {
      try {
        const parsed = JSON.parse(mission.statusDetail) as { characterId?: unknown };
        if (typeof parsed.characterId === 'string' && parsed.characterId.trim().length > 0) {
          return parsed.characterId.trim();
        }
      } catch {
        // Ignore malformed statusDetail and fall back to placeholder id.
      }
    }

    return 'unknown-character';
  }

  private resolvePreferredMissionGateState(
    persistedGateState: ShipExteriorMissionGateState | null,
    parsedGateState: ShipExteriorMissionGateState | null,
    fallbackGateState: ShipExteriorMissionGateState,
  ): ShipExteriorMissionGateState {
    if (!persistedGateState && !parsedGateState) {
      return fallbackGateState;
    }

    if (!persistedGateState) {
      return parsedGateState!;
    }

    if (!parsedGateState) {
      return persistedGateState;
    }

    return this.getMissionGateProgressRank(persistedGateState) >= this.getMissionGateProgressRank(parsedGateState)
      ? persistedGateState
      : parsedGateState;
  }

  private getMissionGateProgressRank(gateState: ShipExteriorMissionGateState): number {
    return gateState.steps.filter((step) => step.status === 'completed' || step.status === 'pending-retry').length;
  }

  private normalizeCanonicalMissionStatus(status: unknown): MissionStatus | string {
    if (status === 'available' || status === 'active' || status === 'completed') {
      return status;
    }

    return MissionBoardPage.CONTRACT_VIOLATION_STATUS;
  }

  protected formatDate(isoString?: string): string {
    if (!isoString) {
      return '—';
    }
    return isoString.slice(0, 10);
  }

  navigateToCharacterProfile(): void {
    this.router.navigate([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: this.playerName(),
        joinCharacter: this.joinCharacter(),
      },
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeMissionListResponse?.();
  }
}
