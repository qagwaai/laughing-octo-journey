import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { locale } from '../../i18n/locale';
import { DEFAULT_SHIP_MODEL, type ShipSummary } from '../../model/ship-list';
import { type ShipItem } from '../../model/ship-item';
import { type ShipUpsertResponse } from '../../model/ship-upsert';
import { type ItemUpsertResponse } from '../../model/item-upsert';
import { coerceShipDamageProfile, type ShipDamageProfile } from '../../model/ship-damage';
import { SessionService, SocketService } from '../../services';
import { PrinterStateService } from '../../services/printer-state.service';
import {
	describePrintableMaterials,
	findConsumableMaterialsForPrintableItem,
	formatPrintableDuration,
	getMissingPrintableMaterials,
	hasPrintableItemInInventory,
	isPrintableItemQueued,
	type PrintableConsumedMaterial,
	resolvePrintableItemDefinition,
	type PrintableItemDefinition,
} from '../../model/printable-item';
import {
	evaluateMissionGateOnRepair,
	resolveShipExteriorMission,
} from '../../mission/ship-exterior-mission';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import {
	describeSummaryForSystems,
	mapOverallStatusToShipStatus,
	resolveOverallStatusFromSystems,
	type RepairAssetEntry,
	type RepairAssetKind,
	type RepairAssetGrouping,
	type RepairAssetFilter,
	type RepairDetailNavigationState,
} from './repair-retrofit-state';

interface RepairAssetGroup {
	group: string;
	entries: RepairAssetEntry[];
}

@Component({
	selector: 'app-repair-retrofit-items-page',
	templateUrl: './repair-retrofit-items.html',
	styleUrls: ['./repair-retrofit-items.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class RepairRetrofitItemsPage {
	protected readonly t = locale;
	private router = inject(Router);
	private socketService = inject(SocketService);
	private sessionService = inject(SessionService);
	private missionStateService = inject(ShipExteriorMissionStateService);
	private printerService = inject(PrinterStateService);
	private navigationState: RepairDetailNavigationState =
		(this.router.getCurrentNavigation()?.extras.state as RepairDetailNavigationState | undefined) ??
		(history.state as RepairDetailNavigationState | undefined) ??
		{};

	protected playerName = signal<string>(this.navigationState.playerName ?? '');
	protected joinCharacter = signal(this.navigationState.joinCharacter ?? null);
	protected joinShip = signal<ShipSummary | null>(this.navigationState.joinShip ?? null);
	protected damageProfile = signal<ShipDamageProfile | null>(coerceShipDamageProfile(this.navigationState.damageProfile));
	protected selectedFilter = signal<RepairAssetFilter>(this.navigationState.selectedFilter ?? 'all');
	protected selectedGrouping = signal<RepairAssetGrouping>(this.navigationState.selectedGrouping ?? 'asset-type');
	protected searchQuery = signal<string>(this.navigationState.searchQuery ?? '');
	protected missionId = signal<string>(this.navigationState.missionId ?? '');
	protected activeRepairKey = signal<string | null>(null);
	protected persistError = signal<string | null>(null);
	protected persistSuccess = signal<string | null>(null);
	private hullPatchKitPrintableItem: PrintableItemDefinition = resolvePrintableItemDefinition('hull-patch-kit')!;

	protected shipName = computed(
		() => this.joinShip()?.name?.trim() || this.joinShip()?.model?.trim() || DEFAULT_SHIP_MODEL,
	);

	protected hasHullPatchKit = computed(
		() => hasPrintableItemInInventory(this.joinShip()?.inventory, this.hullPatchKitPrintableItem),
	);

	protected isHullPatchKitQueued = computed(() =>
		isPrintableItemQueued(this.printerService.queue(), this.hullPatchKitPrintableItem),
	);

	protected canQueueHullPatchKit = computed(
		() => !this.hasHullPatchKit()
			&& !this.isHullPatchKitQueued()
			&& !!findConsumableMaterialsForPrintableItem(this.joinShip()?.inventory, this.hullPatchKitPrintableItem),
	);

	constructor() {
		this.socketService.connect(this.socketService.serverUrl);
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		if (playerName && characterId) {
			this.printerService.loadQueue(playerName, characterId);
		}
	}

	protected allAssets = computed<RepairAssetEntry[]>(() => {
		const entries: RepairAssetEntry[] = [];
		const ship = this.joinShip();
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
		const normalizedSearch = this.searchQuery().trim().toLowerCase();
		const byFilter = (() => {
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
		})();

		if (!normalizedSearch) {
			return byFilter;
		}

		return byFilter.filter((asset) =>
			asset.label.toLowerCase().includes(normalizedSearch) ||
			asset.summary.toLowerCase().includes(normalizedSearch) ||
			asset.kind.toLowerCase().includes(normalizedSearch),
		);
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

	protected setFilter(filter: RepairAssetFilter): void {
		this.selectedFilter.set(filter);
	}

	protected setGrouping(grouping: RepairAssetGrouping): void {
		this.selectedGrouping.set(grouping);
	}

	protected setSearchQuery(searchQuery: string): void {
		this.searchQuery.set(searchQuery);
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

	protected getRequiredMaterials(asset: RepairAssetEntry): string {
		if (asset.severity === 'intact') {
			return 'No materials required';
		}

		if (asset.kind === 'ship') {
			return 'Hull patch kit, conduit seals, coolant cells';
		}

		if (asset.kind === 'ship-system') {
			return 'Subsystem relay, fiber coupling, calibration gel';
		}

		return 'Spare casing, micro-fuse, alignment screws';
	}

	protected getEstimatedWindow(asset: RepairAssetEntry): string {
		if (asset.severity === 'critical' || asset.severity === 'disabled' || asset.severity === 'destroyed') {
			return '2h 30m';
		}

		if (asset.severity === 'major' || asset.severity === 'damaged') {
			return '1h 20m';
		}

		if (asset.severity === 'minor') {
			return '35m';
		}

		return '0m';
	}

	protected getEstimatedCost(asset: RepairAssetEntry): string {
		if (asset.severity === 'critical' || asset.severity === 'disabled' || asset.severity === 'destroyed') {
			return '980 CR';
		}

		if (asset.severity === 'major' || asset.severity === 'damaged') {
			return '560 CR';
		}

		if (asset.severity === 'minor') {
			return '210 CR';
		}

		return '0 CR';
	}

	protected getBlockedReason(asset: RepairAssetEntry): string {
		if (asset.severity === 'intact') {
			return 'No repair action required';
		}

		if (asset.kind === 'ship' && (asset.severity === 'critical' || asset.severity === 'disabled' || asset.severity === 'destroyed')) {
			return 'Dock lock and bay supervisor authorization required';
		}

		return 'None';
	}

	protected getActionAvailability(asset: RepairAssetEntry): string {
		if (asset.severity === 'intact') {
			return 'No action needed';
		}

		return 'Ready';
	}

	protected canOpenDetail(asset: RepairAssetEntry): boolean {
		return asset.severity !== 'intact';
	}

	protected canRepairAsset(asset: RepairAssetEntry): boolean {
		return asset.severity !== 'intact';
	}

	protected isRepairing(asset: RepairAssetEntry): boolean {
		return this.activeRepairKey() === asset.key;
	}

	protected getRepairLabel(asset: RepairAssetEntry): string {
		if (asset.kind === 'ship-system') {
			return 'Fully Repair System';
		}

		if (asset.kind === 'inventory-item') {
			return 'Fully Repair Item';
		}

		return 'Fully Repair Ship';
	}

	protected repairAsset(asset: RepairAssetEntry): void {
		if (!this.canRepairAsset(asset)) {
			return;
		}

		if (asset.kind === 'ship-system') {
			this.repairSystemAsset(asset);
			return;
		}

		if (asset.kind === 'inventory-item') {
			this.repairInventoryAsset(asset);
			return;
		}

		this.repairShipAsset(asset);
	}

	protected queueForPrinting(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const ship = this.joinShip();
		const consumedMaterials = findConsumableMaterialsForPrintableItem(ship?.inventory, this.hullPatchKitPrintableItem);
		if (!playerName || !characterId || !sessionKey || !ship?.id || !consumedMaterials) {
			this.persistError.set(this.getHullPatchKitRequirementMessage());
			return;
		}

		this.persistError.set(null);
		this.persistSuccess.set(null);

		this.consumePrintableMaterials(playerName, sessionKey, consumedMaterials, 0, () => {
			this.joinShip.update((current) => {
				if (!current) {
					return current;
				}

				const consumedMaterialIds = new Set(consumedMaterials.map((material) => material.id));
				return {
					...current,
					inventory: (current.inventory ?? []).filter((item) => !consumedMaterialIds.has(item.id)),
				};
			});

			this.printerService.addToQueue(playerName, characterId, {
				itemType: this.hullPatchKitPrintableItem.itemType,
				label: this.hullPatchKitPrintableItem.displayName,
				durationMs: this.hullPatchKitPrintableItem.durationMs,
				consumedMaterials,
			});
			this.persistSuccess.set(
				`${this.hullPatchKitPrintableItem.displayName} sent to the 3D Fabricator. Estimated time: ${formatPrintableDuration(this.hullPatchKitPrintableItem.durationMs)}. Check the printer on the main page.`,
			);
		});
	}

	protected navigateToRepairDetail(asset: RepairAssetEntry): void {
		const targetRoute = this.resolveDetailRoute(asset.kind);
		const state: RepairDetailNavigationState = {
			playerName: this.playerName(),
			joinCharacter: this.joinCharacter(),
			joinShip: this.joinShip(),
			damageProfile: this.damageProfile(),
			asset,
			selectedFilter: this.selectedFilter(),
			selectedGrouping: this.selectedGrouping(),
			searchQuery: this.searchQuery(),
			missionId: this.missionId(),
		};

		this.router.navigate([{ outlets: { right: [targetRoute], left: ['repair-retrofit'] } }], {
			preserveFragment: true,
			queryParams: { repairNav: Date.now() },
			state,
		});
	}

	private isCriticalSeverity(severity: string): boolean {
		return severity === 'critical' || severity === 'disabled' || severity === 'destroyed';
	}

	private repairShipAsset(asset: RepairAssetEntry): void {
		const profile = this.damageProfile();
		const ship = this.joinShip();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!profile || !ship?.id || !characterId || !playerName || !sessionKey) {
			this.persistError.set('Missing ship or session context for repair operation.');
			return;
		}

		const nextProfile: ShipDamageProfile = {
			...profile,
			overallStatus: 'intact',
			summary: describeSummaryForSystems([]),
			systems: [],
			updatedAt: new Date().toISOString(),
		};

		this.startPersistForAsset(asset.key);
		this.socketService.upsertShip(
			{
				playerName,
				characterId,
				sessionKey,
				ship: {
					id: ship.id,
					status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
					damageProfile: nextProfile,
				},
			},
			(response: ShipUpsertResponse) => {
				this.finishPersist();
				if (!response.success) {
					this.persistError.set(response.message || 'Ship repair update failed to persist.');
					return;
				}

				this.damageProfile.set(nextProfile);
				this.joinShip.update((current) => (current ? { ...current, damageProfile: nextProfile } : current));
				this.persistSuccess.set(`${asset.label} fully repaired and synchronized.`);
				this.advanceMissionGateOnRepair(characterId, 'ship');
			},
		);
	}

	private repairSystemAsset(asset: RepairAssetEntry): void {
		const profile = this.damageProfile();
		const ship = this.joinShip();
		const code = asset.systemCode;
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!profile || !ship?.id || !code || !characterId || !playerName || !sessionKey) {
			this.persistError.set('Missing system or session context for repair operation.');
			return;
		}

		const nextSystems = profile.systems.filter((system) => system.code !== code);
		const nextProfile: ShipDamageProfile = {
			...profile,
			overallStatus: resolveOverallStatusFromSystems(nextSystems),
			summary: describeSummaryForSystems(nextSystems),
			systems: nextSystems,
			updatedAt: new Date().toISOString(),
		};

		this.startPersistForAsset(asset.key);
		this.socketService.upsertShip(
			{
				playerName,
				characterId,
				sessionKey,
				ship: {
					id: ship.id,
					status: mapOverallStatusToShipStatus(nextProfile.overallStatus),
					damageProfile: nextProfile,
				},
			},
			(response: ShipUpsertResponse) => {
				this.finishPersist();
				if (!response.success) {
					this.persistError.set(response.message || 'Subsystem repair update failed to persist.');
					return;
				}

				this.damageProfile.set(nextProfile);
				this.joinShip.update((current) => (current ? { ...current, damageProfile: nextProfile } : current));
				this.persistSuccess.set(`${asset.label} fully repaired and synchronized.`);
			},
		);
	}

	private repairInventoryAsset(asset: RepairAssetEntry): void {
		const ship = this.joinShip();
		const itemId = asset.itemId;
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const item = (ship?.inventory ?? []).find((entry) => entry.id === itemId) as ShipItem | undefined;

		if (!item || !playerName || !sessionKey) {
			this.persistError.set('Missing item or session context for repair operation.');
			return;
		}

		this.startPersistForAsset(asset.key);
		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					id: item.id,
					damageStatus: 'intact',
				},
			},
			(response: ItemUpsertResponse) => {
				this.finishPersist();
				if (!response.success || !response.item) {
					this.persistError.set(response.message || 'Item repair update failed to persist.');
					return;
				}

				this.joinShip.update((current) => {
					if (!current) {
						return current;
					}

					return {
						...current,
						inventory: (current.inventory ?? []).map((entry) => (entry.id === response.item!.id ? response.item! : entry)),
					};
				});
				this.persistSuccess.set(`${asset.label} fully repaired and synchronized.`);
			},
		);
	}

	private advanceMissionGateOnRepair(characterId: string, repairKind: string): void {
		const missionId = this.missionId().trim();
		const playerName = this.playerName().trim();
		if (!missionId || !playerName || !characterId) {
			return;
		}

		const mission = resolveShipExteriorMission(missionId);
		const context = { missionId, playerName, characterId };
		const stored = this.missionStateService.loadState(context);
		if (!stored) {
			return;
		}

		const evaluation = evaluateMissionGateOnRepair({
			mission,
			gateState: stored,
			repairKind,
		});

		if (evaluation.changed) {
			this.missionStateService.saveState(context, evaluation.gateState);
		}
	}

	private consumePrintableMaterials(
		playerName: string,
		sessionKey: string,
		consumedMaterials: readonly PrintableConsumedMaterial[],
		index: number,
		onComplete: () => void,
	): void {
		const nextMaterial = consumedMaterials[index];
		if (!nextMaterial) {
			onComplete();
			return;
		}

		this.socketService.upsertItem(
			{
				playerName,
				sessionKey,
				item: {
					id: nextMaterial.id,
					state: 'destroyed',
					damageStatus: 'destroyed',
					container: null,
					destroyedAt: new Date().toISOString(),
					destroyedReason: `Consumed by 3D printer job: ${this.hullPatchKitPrintableItem.itemType}`,
				},
			},
			(response) => {
				if (!response.success) {
					this.persistError.set(response.message || `Unable to consume ${nextMaterial.label} for print job.`);
					return;
				}

				this.consumePrintableMaterials(playerName, sessionKey, consumedMaterials, index + 1, onComplete);
			},
		);
	}

	protected getHullPatchKitRequirementMessage(): string {
		const missingMaterials = getMissingPrintableMaterials(this.hullPatchKitPrintableItem, this.joinShip()?.inventory);
		return missingMaterials.length > 0
			? `${missingMaterials.join(', ')} required in ship inventory to start this print job.`
			: `${describePrintableMaterials(this.hullPatchKitPrintableItem).join(', ')} required in ship inventory to start this print job.`;
	}

	protected getHullPatchKitMaterialLabels(): string {
		return describePrintableMaterials(this.hullPatchKitPrintableItem).join(', ');
	}

	protected getHullPatchKitDurationLabel(): string {
		return formatPrintableDuration(this.hullPatchKitPrintableItem.durationMs);
	}

	private startPersistForAsset(assetKey: string): void {
		this.activeRepairKey.set(assetKey);
		this.persistError.set(null);
		this.persistSuccess.set(null);
	}

	private finishPersist(): void {
		this.activeRepairKey.set(null);
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

	private resolveDetailRoute(kind: RepairAssetKind): string {
		if (kind === 'ship-system') {
			return 'repair-retrofit-system-detail';
		}

		if (kind === 'inventory-item') {
			return 'repair-retrofit-item-detail';
		}

		return 'repair-retrofit-ship-detail';
	}
}
