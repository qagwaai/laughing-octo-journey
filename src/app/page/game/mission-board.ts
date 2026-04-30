import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
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

interface MissionBoardNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
}

@Component({
	selector: 'app-mission-board-page',
	templateUrl: './mission-board.html',
	styleUrls: ['./mission-board.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
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
			this.missionListError.set('Player name is required to load missions.');
			this.missions.set([]);
			return;
		}

		if (!characterId) {
			this.missionListError.set('Character id is required to load missions.');
			this.missions.set([]);
			return;
		}

		if (!sessionKey) {
			this.missionListError.set('Session key is required to load missions.');
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
		const gateState = this.resolveEffectiveMissionGateState(mission);
		const missionDef = resolveShipExteriorMission(mission.missionId);
		return missionDef.resolveMissionStatusFromGateState(gateState);
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
			? this.missionStateService.loadState({
				missionId: mission.missionId,
				playerName,
				characterId,
			})
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
