import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import {
	coerceShipDamageProfile,
	createColdBootStarterShipDamageProfile,
	type ShipDamageProfile,
} from '../../model/ship-damage';
import { type ShipSummary } from '../../model/ship-list';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { type ItemUpsertResponse } from '../../model/item-upsert';
import { SessionService, SocketService } from '../../services';
import { MissionProgressSyncService } from '../../services/mission-progress-sync.service';
import {
	HULL_PATCH_KIT_PRINTABLE_ITEM,
	hasPrintableItemInInventory,
} from '../../model/printable-item';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
	evaluateMissionGateOnRepair,
	parseMissionGateState,
	resolveShipExteriorMission,
	type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import {
	describeSummaryForSystems,
	mapOverallStatusToShipStatus,
	type RepairAssetFilter,
	type RepairAssetGrouping,
	type RepairDetailNavigationState,
} from './repair-retrofit-state';

@Component({
	selector: 'app-repair-retrofit-ship-detail-page',
	templateUrl: './repair-retrofit-ship-detail.html',
	styleUrls: ['./repair-retrofit-ship-detail.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RepairRetrofitShipDetailPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private missionProgressSyncService = inject(MissionProgressSyncService);
	private missionStateService = inject(ShipExteriorMissionStateService);
	private navigationState: RepairDetailNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as RepairDetailNavigationState | undefined) ??
		(history.state as RepairDetailNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
	protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
	protected selectedAsset = signal(this.navigationState.asset ?? null);
	protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
	protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
	protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
	protected missionId = signal<string>(this.navigationState.missionId ?? FIRST_TARGET_MISSION_ID);
	protected isPersisting = signal(false);
	protected persistError = signal<string | null>(null);
	protected persistSuccess = signal<string | null>(null);

	protected hasHullPatchKit = computed(() =>
		hasPrintableItemInInventory(this.joinShip()?.inventory, HULL_PATCH_KIT_PRINTABLE_ITEM),
	);

	protected canFullyRepair = computed(() => {
		const profile = this.damageProfile();
		return !!profile && profile.overallStatus !== 'intact' && this.hasHullPatchKit();
	});

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);
	}

	private isFirstTargetMissionContext(): boolean {
		const missionId = this.navigationState.missionId?.trim().toLowerCase() ?? '';
		if (missionId === FIRST_TARGET_MISSION_ID) {
			return true;
		}

		const missions = this.navigationState.joinCharacter?.missions;
		if (!Array.isArray(missions)) {
			return false;
		}

		const status = missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status?.toLowerCase();
		return status === 'started' || status === 'in-progress' || status === 'paused';
	}

	private hasShipDamageStatusWithoutProfile(): boolean {
		const status = this.navigationState.joinShip?.status?.trim().toLowerCase() ?? '';
		return status === 'damaged' || status === 'disabled';
	}

	private resolveInitialDamageProfile(): ShipDamageProfile | null {
		const directProfile = coerceShipDamageProfile(this.navigationState.damageProfile ?? this.navigationState.joinShip?.damageProfile);
		if (directProfile) {
			return directProfile;
		}

		if (this.isFirstTargetMissionContext() || this.hasShipDamageStatusWithoutProfile()) {
			return createColdBootStarterShipDamageProfile();
		}

		return null;
	}

	protected getShipName(): string {
		const ship = this.joinShip();
		return ship?.name?.trim() || ship?.model?.trim() || ship?.id || this.t.game.repairRetrofitShipDetail.fallbackShipName;
	}

	protected navigateBackToRepairItems(): void {
		const state: RepairDetailNavigationState = {
			playerName: this.playerName(),
			joinCharacter: this.joinCharacter(),
			joinShip: this.joinShip(),
			damageProfile: this.damageProfile(),
			selectedFilter: this.selectedFilter(),
			selectedGrouping: this.selectedGrouping(),
			searchQuery: this.searchQuery(),
			missionId: this.missionId(),
		};

		this.router.navigate([{ outlets: { right: ['repair-retrofit-items'], left: ['repair-retrofit'] } }], {
			preserveFragment: true,
			queryParams: { repairNav: Date.now() },
			state,
		});
	}

	protected fullyRepairShip(): void {
		const profile = this.damageProfile();
		const ship = this.joinShip();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!profile || !ship?.id || !characterId || !playerName || !sessionKey) {
			this.persistError.set(this.t.game.repairRetrofitShipDetail.missingContextError);
			return;
		}

		const nextProfile: ShipDamageProfile = {
			...profile,
			overallStatus: 'intact',
			summary: describeSummaryForSystems([]),
			systems: [],
			updatedAt: new Date().toISOString(),
		};

		this.isPersisting.set(true);
		this.persistError.set(null);
		this.persistSuccess.set(null);

		const kitItem = (ship.inventory ?? []).find((item) => item.itemType === HULL_PATCH_KIT_PRINTABLE_ITEM.itemType);

		this.socketService.upsertShip(
			{
				playerName,
				characterId,
				sessionKey,
				ship: {
					id: ship.id,
					status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
					damageProfile: nextProfile,
					spatial: ship.spatial,
				},
			},
			(response: ShipUpsertResponse) => {
				if (!response.success) {
					this.isPersisting.set(false);
					this.persistError.set(response.message || this.t.game.repairRetrofitShipDetail.persistFailedLabel);
					return;
				}

				this.damageProfile.set(nextProfile);

				if (!kitItem) {
					this.isPersisting.set(false);
					this.persistSuccess.set(this.t.game.repairRetrofitShipDetail.successLabel);
					this.advanceMissionGateOnRepair(characterId);
					return;
				}

				this.socketService.upsertItem(
					{
						playerName,
						sessionKey,
						item: {
							id: kitItem.id,
							state: 'destroyed',
							damageStatus: 'destroyed',
							container: null,
							destroyedAt: new Date().toISOString(),
							destroyedReason: this.t.game.repairRetrofitShipDetail.kitDestroyedReason,
						},
					},
					(itemResponse: ItemUpsertResponse) => {
						this.isPersisting.set(false);
						if (!itemResponse.success) {
							this.persistError.set(itemResponse.message || this.t.game.repairRetrofitShipDetail.kitRemovalFailedLabel);
							return;
						}

						this.joinShip.update((current) => {
							if (!current) {
								return current;
							}

							return {
								...current,
								inventory: (current.inventory ?? []).filter((item) => item.id !== kitItem.id),
							};
						});
						this.persistSuccess.set(this.t.game.repairRetrofitShipDetail.kitConsumedLabel);
						this.advanceMissionGateOnRepair(characterId);
					},
				);
			},
		);
	}

	private advanceMissionGateOnRepair(characterId: string): void {
		const missionId = this.missionId().trim();
		const playerName = this.playerName().trim();
		if (!missionId || !playerName || !characterId) {
			return;
		}

		const mission = resolveShipExteriorMission(missionId);
		const context = { missionId, playerName, characterId };
		const stored = this.missionStateService.loadState(context);
		const steps = mission.getGateStepDefinitions();
		const gateState = stored
			? (parseMissionGateState({
				rawStatusDetail: JSON.stringify(stored),
				missionId,
				characterId,
				steps,
			}) ?? stored)
			: null;
		if (!gateState) {
			return;
		}

		const evaluation = evaluateMissionGateOnRepair({
			mission,
			gateState,
			repairKind: 'ship',
		});
		const nextGateState = evaluation.changed ? evaluation.gateState : gateState;

		if (evaluation.changed) {
			this.missionStateService.saveState(context, evaluation.gateState);
		}

		// Always perform an idempotent sync after ship repair so backend mission
		// status remains aligned even if local gate state was already advanced.
		void this.syncMissionProgressToBackend(nextGateState);
	}

	private async syncMissionProgressToBackend(gateState: ShipExteriorMissionGateState): Promise<void> {
		await this.missionProgressSyncService.syncGateState({
			playerName: this.playerName(),
			characterId: this.joinCharacter()?.id ?? '',
			sessionKey: this.sessionService.getSessionKey() ?? '',
			gateState,
		});
	}

}
