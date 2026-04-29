import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerCharacterSummary } from '../../model/character-list';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import {
	SHIP_LIST_REQUEST_EVENT,
	SHIP_LIST_RESPONSE_EVENT,
	DEFAULT_SHIP_MODEL,
	coerceShipInventory,
	type ShipListRequest,
	type ShipListResponse,
	type ShipSummary,
} from '../../model/ship-list';
import {
	coerceShipDamageProfile,
	createColdBootStarterShipDamageProfile,
	type ShipDamageProfile,
} from '../../model/ship-damage';
import { GuardedLeftMenu } from '../../component/guarded-left-menu';
import { locale } from '../../i18n/locale';
import { SessionService, SocketService } from '../../services';
import {
	type RepairAssetEntry,
	type RepairAssetKind,
	type RepairAssetGrouping,
	type RepairAssetFilter,
	type RepairDetailNavigationState,
} from './repair-retrofit-state';

interface RepairRetrofitNavigationState {
	playerName?: string;
	joinCharacter?: PlayerCharacterSummary;
	joinShip?: ShipSummary;
	selectedFilter?: RepairAssetFilter;
	selectedGrouping?: RepairAssetGrouping;
}

interface RepairAssetGroup {
	group: string;
	entries: RepairAssetEntry[];
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
	protected damageProfile = signal<ShipDamageProfile | null>(this.resolveInitialDamageProfile());
	protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
	protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');

	protected overallStatusLabel = computed(
		() => this.damageProfile()?.overallStatus.toUpperCase() ?? 'UNKNOWN',
	);

	protected activeShipDisplayName = computed(
		() => this.activeShip()?.name?.trim() || this.activeShip()?.model?.trim() || DEFAULT_SHIP_MODEL,
	);

	protected allAssets = computed<RepairAssetEntry[]>(() => {
		const entries: RepairAssetEntry[] = [];
		const ship = this.activeShip();
		const shipProfile = this.damageProfile();
		const shipName = ship?.name?.trim() || ship?.model?.trim() || DEFAULT_SHIP_MODEL;
		const shipId = ship?.id?.trim() || 'active';

		entries.push({
			key: `ship:${shipId}`,
			kind: 'ship',
			label: shipName,
			severity: shipProfile?.overallStatus ?? 'intact',
			summary: shipProfile?.summary ?? 'No active damage profile found.',
			repairPriority: 0,
			shipId,
		});

		for (const system of (shipProfile?.systems ?? []).slice().sort((left, right) => left.repairPriority - right.repairPriority)) {
			entries.push({
				key: `ship-system:${system.code}`,
				kind: 'ship-system',
				label: system.label,
				severity: system.severity,
				summary: system.summary,
				repairPriority: system.repairPriority,
				shipId,
				systemCode: system.code,
			});
		}

		for (const item of ship?.inventory ?? []) {
			entries.push({
				key: `inventory-item:${item.id}`,
				kind: 'inventory-item',
				label: item.displayName || item.itemType,
				severity: item.damageStatus,
				summary: `Ship inventory item is ${item.damageStatus} while ${item.state}.`,
				repairPriority: 100,
				shipId,
				itemId: item.id,
			});
		}

		return entries.sort((left, right) => (left.repairPriority ?? 1000) - (right.repairPriority ?? 1000));
	});

	protected filteredAssets = computed(() => {
		const filter = this.selectedFilter();
		if (filter === 'all') {
			return this.allAssets();
		}

		if (filter === 'needs-repair') {
			return this.allAssets().filter((asset) => asset.severity !== 'intact');
		}

		if (filter === 'critical-only') {
			return this.allAssets().filter((asset) => this.isCriticalSeverity(asset.severity));
		}

		return this.allAssets().filter((asset) => asset.severity === 'intact');
	});

	protected groupedAssets = computed<RepairAssetGroup[]>(() => {
		const grouping = this.selectedGrouping();
		const groups = new Map<string, RepairAssetEntry[]>();

		for (const asset of this.filteredAssets()) {
			const group = this.resolveGroupName(asset, grouping);
			const current = groups.get(group) ?? [];
			current.push(asset);
			groups.set(group, current);
		}

		return Array.from(groups.entries())
			.map(([group, entries]) => ({
				group,
				entries: entries.slice().sort((left, right) => (left.repairPriority ?? 1000) - (right.repairPriority ?? 1000)),
			}))
			.sort((left, right) => left.group.localeCompare(right.group));
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
				this.activeShip.set(
					nextShip
						? {
							...nextShip,
							inventory: coerceShipInventory(nextShip.inventory),
						}
						: null,
				);
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

	private isCriticalSeverity(severity: string): boolean {
		return severity === 'critical' || severity === 'disabled' || severity === 'destroyed';
	}

	private resolveGroupName(asset: RepairAssetEntry, grouping: RepairAssetGrouping): string {
		if (grouping === 'severity') {
			return asset.severity.toUpperCase();
		}

		if (grouping === 'priority-band') {
			const priority = asset.repairPriority ?? 1000;
			if (priority <= 1) {
				return 'Priority 1';
			}
			if (priority <= 3) {
				return 'Priority 2-3';
			}
			return 'Priority 4+';
		}

		if (asset.kind === 'ship') {
			return 'Ships';
		}

		if (asset.kind === 'ship-system') {
			return 'Ship Systems';
		}

		return 'Inventory Items';
	}

	protected setFilter(filter: RepairAssetFilter): void {
		this.selectedFilter.set(filter);
	}

	protected setGrouping(grouping: RepairAssetGrouping): void {
		this.selectedGrouping.set(grouping);
	}

	protected getGroupingLabel(): string {
		const grouping = this.selectedGrouping();
		if (grouping === 'severity') {
			return 'Severity';
		}

		if (grouping === 'priority-band') {
			return 'Priority';
		}

		return 'Asset Type';
	}

	protected navigateToRepairDetail(asset: RepairAssetEntry): void {
		const targetRoute = this.resolveDetailRoute(asset.kind);
		const state: RepairDetailNavigationState = {
			playerName: this.playerName(),
			joinCharacter: this.joinCharacter(),
			joinShip: this.activeShip(),
			damageProfile: this.damageProfile(),
			asset,
			selectedFilter: this.selectedFilter(),
			selectedGrouping: this.selectedGrouping(),
		};

		this.router.navigate([{ outlets: { right: [targetRoute], left: ['repair-retrofit'] } }], {
			preserveFragment: true,
			queryParams: { repairNav: Date.now() },
			state,
		});
	}

	private resolveDetailRoute(kind: RepairAssetKind): string {
		if (kind === 'ship-system') {
			return 'repair-retrofit-system-detail';
		}

		if (kind === 'inventory-item') {
			return 'repair-retrofit-item-detail';
		}

		return 'repair-retrofit-ship-detail';
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
