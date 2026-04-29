import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	DEFAULT_SHIP_MODEL,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../../model/ship-list';
import {
	coerceShipDamageProfile,
	createColdBootStarterShipDamageProfile,
	type ShipDamageProfile,
	type ShipDamageSeverity,
	type ShipSubsystemDamage,
} from '../../model/ship-damage';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { SessionService, SocketService } from '../../services';

interface RepairRetrofitNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
}

type DamagedAssetKind = 'ship' | 'ship-system' | 'inventory-item';

interface DamagedAssetEntry {
	key: string;
	kind: DamagedAssetKind;
	label: string;
	severity: string;
	summary: string;
	repairPriority?: number;
}

@Component({
	selector: 'app-repair-retrofit-page',
	templateUrl: './repair-retrofit.html',
	styleUrls: ['./repair-retrofit.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [GuardedLeftMenu],
})
export default class RepairRetrofitPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private unsubscribeShipListResponse?: () => void;
	private navigationState: RepairRetrofitNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as RepairRetrofitNavigationState | undefined) ??
		(history.state as RepairRetrofitNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal<PlayerCharacterSummary | null>(this.navigationState.joinCharacter ?? null);
	protected activeShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
	protected isLoadingShip = signal(false);
	protected shipLoadError = signal<string | null>(null);
	protected isPersistingRepair = signal(false);
	protected repairPersistError = signal<string | null>(null);
	protected repairPersistSuccess = signal<string | null>(null);
	protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());

	protected overallStatusLabel = computed(
		() => this.damageProfile()?.overallStatus.toUpperCase() ?? 'UNKNOWN',
	);

	protected subsystemDamages = computed(() => {
		const systems = this.damageProfile()?.systems ?? [];
		return systems.slice().sort((left, right) => left.repairPriority - right.repairPriority);
	});

	protected hasDamage = computed(() => {
		const profile = this.damageProfile();
		if (!profile) {
			return false;
		}

		return profile.overallStatus !== 'intact' || profile.systems.length > 0;
	});

	protected activeShipDisplayName = computed(
		() => this.activeShip()?.name?.trim() || this.activeShip()?.model?.trim() || DEFAULT_SHIP_MODEL,
	);

	protected damagedAssets = computed<DamagedAssetEntry[]>(() => {
		const entries: DamagedAssetEntry[] = [];
		const ship = this.activeShip();
		const shipProfile = this.damageProfile();

		if (shipProfile && shipProfile.overallStatus !== 'intact') {
			entries.push({
				key: `ship:${ship?.id ?? 'active'}`,
				kind: 'ship',
				label: ship?.name?.trim() || ship?.model?.trim() || DEFAULT_SHIP_MODEL,
				severity: shipProfile.overallStatus,
				summary: shipProfile.summary,
				repairPriority: 0,
			});
		}

		for (const system of this.subsystemDamages()) {
			entries.push({
				key: `ship-system:${system.code}`,
				kind: 'ship-system',
				label: system.label,
				severity: system.severity,
				summary: system.summary,
				repairPriority: system.repairPriority,
			});
		}

		for (const item of ship?.inventory ?? []) {
			if (item.damageStatus === 'intact') {
				continue;
			}

			entries.push({
				key: `inventory-item:${item.id}`,
				kind: 'inventory-item',
				label: item.displayName || item.itemType,
				severity: item.damageStatus,
				summary: `Ship inventory item is ${item.damageStatus} while ${item.state}.`,
				repairPriority: 100,
			});
		}

		return entries.sort((left, right) => (left.repairPriority ?? 1000) - (right.repairPriority ?? 1000));
	});

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);
		if (this.activeShip()) {
			return;
		}

		if (this.socketService.getIsConnected()) {
			this.loadActiveShip();
		} else {
			this.socketService.once('connect', () => this.loadActiveShip());
		}
	}

	private isFirstTargetInProgress(): boolean {
		const missions = this.joinCharacter()?.missions;
		if (!Array.isArray(missions)) {
			return false;
		}

		const status = missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status?.toLowerCase();
		return status === 'started' || status === 'in-progress' || status === 'paused';
	}

	private resolveInitialDamageProfile(): ShipDamageProfile | null {
		const shipProfile = coerceShipDamageProfile(this.navigationState.joinShip?.damageProfile);
		if (shipProfile) {
			return shipProfile;
		}

		if (this.isFirstTargetInProgress()) {
			return createColdBootStarterShipDamageProfile();
		}

		return null;
	}

	private resolveDamageProfileForShip(ship: ShipSummary | null): ShipDamageProfile | null {
		const shipProfile = coerceShipDamageProfile(ship?.damageProfile);
		if (shipProfile) {
			return shipProfile;
		}

		if (this.isFirstTargetInProgress()) {
			return createColdBootStarterShipDamageProfile();
		}

		return null;
	}

	private loadActiveShip(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			this.shipLoadError.set('Unable to load ship context for repair operations.');
			return;
		}

		this.isLoadingShip.set(true);
		this.shipLoadError.set(null);
		this.repairPersistError.set(null);
		this.unsubscribeShipListResponse?.();
		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: ShipListResponse) => {
				this.isLoadingShip.set(false);
				this.unsubscribeShipListResponse?.();

				if (!response.success) {
					this.shipLoadError.set(response.message || 'Unable to load ship for repair operations.');
					return;
				}

				const nextShip = response.ships?.[0] ?? null;
				this.activeShip.set(nextShip);
				this.damageProfile.set(this.resolveDamageProfileForShip(nextShip));
			},
		);

		const request: ShipListRequest = {
			playerName,
			characterId,
			sessionKey,
		};
		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
	}

	private downgradeSeverity(severity: ShipDamageSeverity): ShipDamageSeverity | null {
		if (severity === 'critical') {
			return 'major';
		}

		if (severity === 'major') {
			return 'minor';
		}

		return null;
	}

	private describeSummaryForSystems(systems: readonly ShipSubsystemDamage[]): string {
		if (systems.length === 0) {
			return 'All critical ship systems stabilized and nominal.';
		}

		const criticalCount = systems.filter((system) => system.severity === 'critical').length;
		if (criticalCount > 0) {
			return `Critical damage remains in ${criticalCount} subsystem${criticalCount > 1 ? 's' : ''}.`;
		}

		const majorCount = systems.filter((system) => system.severity === 'major').length;
		if (majorCount > 0) {
			return `Major damage remains in ${majorCount} subsystem${majorCount > 1 ? 's' : ''}.`;
		}

		return 'Minor damage remains. Full restoration pending final calibration.';
	}

	private resolveOverallStatusFromSystems(systems: readonly ShipSubsystemDamage[]): ShipDamageProfile['overallStatus'] {
		if (systems.length === 0) {
			return 'intact';
		}

		if (systems.some((system) => system.severity === 'critical')) {
			return 'disabled';
		}

		return 'damaged';
	}

	private createNextDamageProfile(current: ShipDamageProfile, code: string): ShipDamageProfile | null {
		let changed = false;
		const nextSystems = current.systems
			.map((system) => {
				if (system.code !== code) {
					return system;
				}

				const downgraded = this.downgradeSeverity(system.severity);
				if (!downgraded) {
					changed = true;
					return null;
				}

				changed = true;
				return {
					...system,
					severity: downgraded,
				};
			})
			.filter((system): system is ShipSubsystemDamage => system !== null);

		if (!changed) {
			return null;
		}

		return {
			...current,
			overallStatus: this.resolveOverallStatusFromSystems(nextSystems),
			summary: this.describeSummaryForSystems(nextSystems),
			systems: nextSystems,
			updatedAt: new Date().toISOString(),
		};
	}

	private mapOverallStatusToShipStatus(overallStatus: ShipDamageProfile['overallStatus']): string {
		if (overallStatus === 'intact') {
			return 'Operational';
		}

		if (overallStatus === 'disabled' || overallStatus === 'destroyed') {
			return 'Disabled';
		}

		return 'Damaged';
	}

	private applyShipUpsertResponse(response: ShipUpsertResponse, fallbackProfile: ShipDamageProfile): void {
		const upsertedShip = response.ship;
		if (!upsertedShip) {
			this.damageProfile.set(fallbackProfile);
			return;
		}

		const nextProfile = coerceShipDamageProfile(upsertedShip.damageProfile) ?? fallbackProfile;
		this.damageProfile.set(nextProfile);
		this.activeShip.update((current) => ({
			id: upsertedShip.id,
			name: upsertedShip.shipName || current?.name || upsertedShip.id,
			status: upsertedShip.status ?? this.mapOverallStatusToShipStatus(nextProfile.overallStatus),
			model: upsertedShip.model,
			tier: upsertedShip.tier,
			launchable: upsertedShip.launchable,
			inventory: upsertedShip.inventory ?? current?.inventory,
			damageProfile: nextProfile,
			location: upsertedShip.location,
			kinematics: upsertedShip.kinematics,
		}));
	}

	private persistDamageProfile(nextProfile: ShipDamageProfile): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const shipId = this.activeShip()?.id?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey || !shipId) {
			this.repairPersistError.set('Unable to persist repair state. Missing ship or session context.');
			return;
		}

		this.isPersistingRepair.set(true);
		this.repairPersistError.set(null);
		this.repairPersistSuccess.set(null);

		this.socketService.upsertShip(
			{
				playerName,
				characterId,
				sessionKey,
				ship: {
					id: shipId,
					status: this.mapOverallStatusToShipStatus(nextProfile.overallStatus),
					damageProfile: nextProfile,
				},
			},
			(response: ShipUpsertResponse) => {
				this.isPersistingRepair.set(false);
				if (!response.success) {
					this.repairPersistError.set(response.message || 'Ship repair update failed to persist.');
					return;
				}

				this.applyShipUpsertResponse(response, nextProfile);
				this.repairPersistSuccess.set('Repair state synchronized.');
			},
		);
	}

	repairSubsystem(code: string): void {
		const profile = this.damageProfile();
		if (!profile || this.isPersistingRepair()) {
			return;
		}

		const nextProfile = this.createNextDamageProfile(profile, code);
		if (!nextProfile) {
			return;
		}

		this.persistDamageProfile(nextProfile);
	}

	repairTopPrioritySubsystem(): void {
		const next = this.subsystemDamages()[0];
		if (!next) {
			return;
		}

		this.repairSubsystem(next.code);
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
}
