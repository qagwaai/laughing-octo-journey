import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import {
	MISSION_LIST_REQUEST_EVENT,
	MISSION_LIST_RESPONSE_EVENT,
	type MissionListRequest,
	type MissionListResponse,
} from '../../model/mission-list';
import type { CharacterMissionProgress } from '../../model/mission';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { CharacterShipBadge } from '../../component/character-ship-badge';
import { locale } from '../../i18n/locale';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
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
} from '../../model/mission-catalog';

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
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private missionStateService = inject(ShipExteriorMissionStateService);
	private unsubscribeMissionListResponse?: () => void;
	private navigationState: MissionBoardNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as MissionBoardNavigationState | undefined) ??
		(history.state as MissionBoardNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected missions = signal<CharacterMissionProgress[]>([]);
	protected isLoadingMissions = signal(false);
	protected missionListError = signal<string | null>(null);

	/**
	 * The set of mission IDs already tracked by the backend (assigned).
	 * Used to decide which catalog missions are "new" vs already in the list.
	 */
	private readonly assignedMissionIds = computed(() =>
		new Set(this.missions().map((m) => m.missionId)),
	);

	/** IDs of missions with completed/turned-in status — drives which missions are visible. */
	private readonly completedMissionIds = computed(() =>
		new Set(this.missions().filter((m) => isMissionCompleted(m.status)).map((m) => m.missionId)),
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
		this.socketService.connect(this.socketService.serverUrl);

		if (this.socketService.getIsConnected()) {
			this.loadMissionsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadMissionsForCharacter());
		}
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

		this.unsubscribeMissionListResponse = this.socketService.on(
			MISSION_LIST_RESPONSE_EVENT,
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

		const request: MissionListRequest = { playerName, characterId, sessionKey };
		this.socketService.emit(MISSION_LIST_REQUEST_EVENT, request);
	}

	getMissionStageInfo(mission: CharacterMissionProgress): { stage: string; nextStep: string } {
		const gateState = this.resolveEffectiveMissionGateState(mission);
		const totalSteps = gateState.steps.length;
		const completedCount = gateState.steps.filter((s) => s.status === 'completed' || s.status === 'pending-retry').length;
		const activeStepIndex = gateState.steps.findIndex((s) => s.status === 'active' || s.status === 'pending-retry');
		const stageNumber = activeStepIndex >= 0 ? activeStepIndex + 1 : completedCount;
		const stage =
			completedCount >= totalSteps && totalSteps > 0
				? `Stage ${totalSteps} of ${totalSteps} — Complete`
				: `Stage ${stageNumber} of ${totalSteps}`;
		return { stage, nextStep: gateState.activeObjectiveText };
	}

	getMissionDisplayStatus(mission: CharacterMissionProgress): string {
		// Non-ship-exterior missions don't have gate steps; return status directly.
		const catalogEntry = resolveMissionById(mission.missionId);
		if (catalogEntry && mission.missionId !== 'first-target') {
			return mission.status ?? 'unknown';
		}
		const gateState = this.resolveEffectiveMissionGateState(mission);
		const missionDef = resolveShipExteriorMission(mission.missionId);
		return missionDef.resolveMissionStatusFromGateState(gateState);
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

				return parseMissionGateState({
					rawStatusDetail: JSON.stringify(stored),
					missionId: mission.missionId,
					characterId,
					steps: stepDefinitions,
				}) ?? stored;
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
		const gateState = this.resolvePreferredMissionGateState(
			persistedGateState,
			parsedGateState,
			initialGateState,
		);

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

	protected formatDate(isoString?: string): string {		if (!isoString) {
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
