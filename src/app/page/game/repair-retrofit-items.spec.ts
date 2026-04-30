import {
	HULL_PATCH_KIT_PRINTABLE_ITEM,
	findConsumableMaterialsForPrintableItem,
	hasPrintableItemInInventory,
	isPrintableItemQueued,
} from '../../model/printable-item';
import { DEFAULT_SHIP_MODEL } from '../../model/ship-list';
import {
	type RepairAssetEntry,
	type RepairAssetFilter,
	type RepairAssetGrouping,
} from './repair-retrofit-state';

export {};

// ---------------------------------------------------------------------------
// Minimal signal factory (avoids Angular DI in unit tests)
// ---------------------------------------------------------------------------

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => { value = v; };
	return sig;
}

// ---------------------------------------------------------------------------
// Local type stubs
// ---------------------------------------------------------------------------

interface InventoryItem {
	id: string;
	itemType: string;
	displayName?: string;
	damageStatus?: string;
	state?: string;
}

interface ShipSubsystem {
	code: string;
	label: string;
	severity: string;
	summary: string;
	repairPriority: number;
}

interface DamageProfile {
	overallStatus: 'intact' | 'damaged' | 'disabled' | 'destroyed';
	summary: string;
	systems: ShipSubsystem[];
}

interface ShipStub {
	id: string;
	name?: string;
	model?: string;
	inventory?: InventoryItem[];
}

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string; characterName?: string } | null;
	joinShip?: ShipStub | null;
	damageProfile?: DamageProfile | null;
	selectedFilter?: RepairAssetFilter;
	selectedGrouping?: RepairAssetGrouping;
	searchQuery?: string;
	missionId?: string;
}

// ---------------------------------------------------------------------------
// Mock class — mirrors RepairRetrofitItemsPage computed / helper logic
// ---------------------------------------------------------------------------

class MockRepairRetrofitItemsPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter']>(null);
	joinShip = createSignal<ShipStub | null>(null);
	damageProfile = createSignal<DamageProfile | null>(null);
	selectedFilter = createSignal<RepairAssetFilter>('all');
	selectedGrouping = createSignal<RepairAssetGrouping>('asset-type');
	searchQuery = createSignal<string>('');
	missionId = createSignal<string>('');
	activeRepairKey = createSignal<string | null>(null);
	persistError = createSignal<string | null>(null);
	persistSuccess = createSignal<string | null>(null);

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.joinShip.set(state?.joinShip ?? null);
		this.damageProfile.set(state?.damageProfile ?? null);
		this.selectedFilter.set(state?.selectedFilter ?? 'all');
		this.selectedGrouping.set(state?.selectedGrouping ?? 'asset-type');
		this.searchQuery.set(state?.searchQuery ?? '');
		this.missionId.set(state?.missionId ?? '');
	}

	hasHullPatchKit(): boolean {
		return hasPrintableItemInInventory(this.joinShip()?.inventory as any, HULL_PATCH_KIT_PRINTABLE_ITEM);
	}

	isHullPatchKitQueued(): boolean {
		return isPrintableItemQueued([] as any, HULL_PATCH_KIT_PRINTABLE_ITEM);
	}

	canQueueHullPatchKit(): boolean {
		return !this.hasHullPatchKit()
			&& !this.isHullPatchKitQueued()
			&& !!findConsumableMaterialsForPrintableItem(this.joinShip()?.inventory as any, HULL_PATCH_KIT_PRINTABLE_ITEM);
	}

	allAssets(): RepairAssetEntry[] {
		const entries: RepairAssetEntry[] = [];
		const ship = this.joinShip();
		const profile = this.damageProfile();
		const shipName = ship?.name?.trim() || ship?.model?.trim() || DEFAULT_SHIP_MODEL;
		const shipId = ship?.id?.trim() || 'active';

		entries.push({
			key: `ship:${shipId}`,
			kind: 'ship',
			label: shipName,
			severity: profile?.overallStatus ?? 'intact',
			summary: profile?.summary ?? 'No active damage profile found.',
			repairPriority: 0,
			shipId,
		});

		for (const system of (profile?.systems ?? []).slice().sort((l, r) => l.repairPriority - r.repairPriority)) {
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
				severity: item.damageStatus ?? 'intact',
				summary: `Ship inventory item is ${item.damageStatus ?? 'intact'} while ${item.state ?? 'contained'}.`,
				repairPriority: 100,
				shipId,
				itemId: item.id,
			});
		}

		return entries.sort((l, r) => (l.repairPriority ?? 1000) - (r.repairPriority ?? 1000));
	}

	isCriticalSeverity(severity: string): boolean {
		return severity === 'critical' || severity === 'disabled' || severity === 'destroyed';
	}

	filteredAssets(): RepairAssetEntry[] {
		const filter = this.selectedFilter();
		const normalizedSearch = this.searchQuery().trim().toLowerCase();

		const byFilter = (() => {
			if (filter === 'needs-repair') {
				return this.allAssets().filter((a) => a.severity !== 'intact');
			}
			if (filter === 'critical-only') {
				return this.allAssets().filter((a) => this.isCriticalSeverity(a.severity));
			}
			if (filter === 'intact-only') {
				return this.allAssets().filter((a) => a.severity === 'intact');
			}
			return this.allAssets();
		})();

		if (!normalizedSearch) {
			return byFilter;
		}

		return byFilter.filter(
			(a) =>
				a.label.toLowerCase().includes(normalizedSearch) ||
				a.summary.toLowerCase().includes(normalizedSearch) ||
				a.kind.toLowerCase().includes(normalizedSearch),
		);
	}

	groupedAssets(): Array<{ group: string; entries: RepairAssetEntry[] }> {
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
				entries: entries
					.slice()
					.sort((l, r) => (l.repairPriority ?? 1000) - (r.repairPriority ?? 1000)),
			}))
			.sort((l, r) => l.group.localeCompare(r.group));
	}

	resolveGroupName(asset: RepairAssetEntry, grouping: RepairAssetGrouping): string {
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

	setFilter(filter: RepairAssetFilter): void {
		this.selectedFilter.set(filter);
	}

	setGrouping(grouping: RepairAssetGrouping): void {
		this.selectedGrouping.set(grouping);
	}

	setSearchQuery(query: string): void {
		this.searchQuery.set(query);
	}

	canOpenDetail(asset: RepairAssetEntry): boolean {
		return asset.severity !== 'intact';
	}

	canRepairAsset(asset: RepairAssetEntry): boolean {
		return asset.severity !== 'intact';
	}

	getRepairLabel(asset: RepairAssetEntry): string {
		if (asset.kind === 'ship-system') {
			return 'Fully Repair System';
		}
		if (asset.kind === 'inventory-item') {
			return 'Fully Repair Item';
		}
		return 'Fully Repair Ship';
	}

	getRequiredMaterials(asset: RepairAssetEntry): string {
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

	getEstimatedWindow(asset: RepairAssetEntry): string {
		if (this.isCriticalSeverity(asset.severity)) {
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

	getEstimatedCost(asset: RepairAssetEntry): string {
		if (this.isCriticalSeverity(asset.severity)) {
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

	getActionAvailability(asset: RepairAssetEntry): string {
		if (asset.severity === 'intact') {
			return 'No action needed';
		}
		return 'Ready';
	}

	isRepairing(asset: RepairAssetEntry): boolean {
		return this.activeRepairKey() === asset.key;
	}
}

// ---------------------------------------------------------------------------
// Tests: Initialization
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - initialization', () => {
	it('should initialize signals from navigation state', () => {
		const page = new MockRepairRetrofitItemsPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			selectedFilter: 'needs-repair',
			selectedGrouping: 'severity',
			searchQuery: 'hull',
			missionId: 'first-target',
		});

		expect(page.playerName()).toBe('Pioneer');
		expect(page.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(page.selectedFilter()).toBe('needs-repair');
		expect(page.selectedGrouping()).toBe('severity');
		expect(page.searchQuery()).toBe('hull');
		expect(page.missionId()).toBe('first-target');
	});

	it('should fall back to default values when navigation state is absent', () => {
		const page = new MockRepairRetrofitItemsPage();

		expect(page.playerName()).toBe('');
		expect(page.joinCharacter()).toBeNull();
		expect(page.joinShip()).toBeNull();
		expect(page.damageProfile()).toBeNull();
		expect(page.selectedFilter()).toBe('all');
		expect(page.selectedGrouping()).toBe('asset-type');
		expect(page.searchQuery()).toBe('');
		expect(page.missionId()).toBe('');
	});
});

// ---------------------------------------------------------------------------
// Tests: allAssets computed
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - allAssets', () => {
	it('should always produce at least one entry (ship placeholder) even with no ship', () => {
		const page = new MockRepairRetrofitItemsPage();
		const assets = page.allAssets();

		expect(assets.length).toBe(1);
		expect(assets[0].kind).toBe('ship');
		expect(assets[0].label).toBe(DEFAULT_SHIP_MODEL);
		expect(assets[0].shipId).toBe('active');
		expect(assets[0].severity).toBe('intact');
	});

	it('should use ship model as label when ship has no name', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: { id: 's-1', model: 'Scavenger Pod' },
		});

		expect(page.allAssets()[0].label).toBe('Scavenger Pod');
	});

	it('should use ship name over model as label', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: { id: 's-1', name: 'The Iron Nomad', model: 'Scavenger Pod' },
		});

		expect(page.allAssets()[0].label).toBe('The Iron Nomad');
	});

	it('should reflect damage profile severity in ship entry', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: { id: 's-1' },
			damageProfile: {
				overallStatus: 'damaged',
				summary: 'Minor hull breach.',
				systems: [],
			},
		});

		expect(page.allAssets()[0].severity).toBe('damaged');
		expect(page.allAssets()[0].summary).toBe('Minor hull breach.');
	});

	it('should include ship-system entries sorted by repairPriority', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: { id: 's-1' },
			damageProfile: {
				overallStatus: 'damaged',
				summary: 'Two systems damaged.',
				systems: [
					{ code: 'navigation', label: 'Navigation', severity: 'minor', summary: 'Off-course.', repairPriority: 3 },
					{ code: 'propulsion', label: 'Propulsion', severity: 'critical', summary: 'Thrust failure.', repairPriority: 1 },
				],
			},
		});

		const assets = page.allAssets();
		// ship(0), propulsion(1), navigation(3), sorted by repairPriority
		const shipSystemEntries = assets.filter((a) => a.kind === 'ship-system');
		expect(shipSystemEntries.length).toBe(2);
		expect(shipSystemEntries[0].systemCode).toBe('propulsion');
		expect(shipSystemEntries[1].systemCode).toBe('navigation');
	});

	it('should include inventory-item entries for each inventory item', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [
					{ id: 'item-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit', damageStatus: 'intact', state: 'contained' },
					{ id: 'item-2', itemType: 'iron', displayName: 'Iron', damageStatus: 'damaged', state: 'contained' },
				],
			},
		});

		const itemEntries = page.allAssets().filter((a) => a.kind === 'inventory-item');
		expect(itemEntries.length).toBe(2);
		expect(itemEntries.find((a) => a.itemId === 'item-1')?.severity).toBe('intact');
		expect(itemEntries.find((a) => a.itemId === 'item-2')?.severity).toBe('damaged');
	});

	it('should assign repairPriority 100 to inventory items', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'intact' }],
			},
		});

		const itemEntry = page.allAssets().find((a) => a.kind === 'inventory-item');
		expect(itemEntry?.repairPriority).toBe(100);
	});
});

// ---------------------------------------------------------------------------
// Tests: filteredAssets
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - filteredAssets', () => {
	function buildPageWithMixedAssets(): MockRepairRetrofitItemsPage {
		return new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [
					{ id: 'item-intact', itemType: 'iron', damageStatus: 'intact' },
					{ id: 'item-damaged', itemType: 'conduit', damageStatus: 'damaged' },
					{ id: 'item-critical', itemType: 'fuse', damageStatus: 'critical' },
				],
			},
			damageProfile: {
				overallStatus: 'damaged',
				summary: 'Minor breach.',
				systems: [
					{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 2 },
				],
			},
		});
	}

	it('should return all assets when filter is "all"', () => {
		const page = buildPageWithMixedAssets();
		page.setFilter('all');
		expect(page.filteredAssets().length).toBe(page.allAssets().length);
	});

	it('should return only non-intact assets when filter is "needs-repair"', () => {
		const page = buildPageWithMixedAssets();
		page.setFilter('needs-repair');
		const filtered = page.filteredAssets();
		expect(filtered.every((a) => a.severity !== 'intact')).toBe(true);
		expect(filtered.some((a) => a.severity === 'damaged' || a.severity === 'critical')).toBe(true);
	});

	it('should return only critical/disabled/destroyed assets when filter is "critical-only"', () => {
		const page = buildPageWithMixedAssets();
		page.setFilter('critical-only');
		const filtered = page.filteredAssets();
		expect(filtered.length).toBeGreaterThan(0);
		expect(filtered.every((a) => page.isCriticalSeverity(a.severity))).toBe(true);
	});

	it('should return only intact assets when filter is "intact-only"', () => {
		const page = buildPageWithMixedAssets();
		page.setFilter('intact-only');
		const filtered = page.filteredAssets();
		expect(filtered.length).toBeGreaterThan(0);
		expect(filtered.every((a) => a.severity === 'intact')).toBe(true);
	});

	it('should filter by search query against label', () => {
		const page = buildPageWithMixedAssets();
		page.setSearchQuery('Navigation');
		const filtered = page.filteredAssets();
		expect(filtered.length).toBeGreaterThan(0);
		expect(filtered.every((a) => a.label.toLowerCase().includes('navigation'))).toBe(true);
	});

	it('should filter by search query against kind', () => {
		const page = buildPageWithMixedAssets();
		page.setSearchQuery('ship-system');
		const filtered = page.filteredAssets();
		expect(filtered.every((a) => a.kind === 'ship-system')).toBe(true);
	});

	it('should return empty array when search query matches nothing', () => {
		const page = buildPageWithMixedAssets();
		page.setSearchQuery('zzznomatch');
		expect(page.filteredAssets().length).toBe(0);
	});

	it('should combine filter and search query', () => {
		const page = buildPageWithMixedAssets();
		page.setFilter('needs-repair');
		page.setSearchQuery('iron');
		// iron item is intact → should be excluded by needs-repair filter
		expect(page.filteredAssets().filter((a) => a.itemId === 'item-intact').length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Tests: groupedAssets
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - groupedAssets', () => {
	function buildPageWithSystems(): MockRepairRetrofitItemsPage {
		return new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'item-1', itemType: 'iron', damageStatus: 'intact' }],
			},
			damageProfile: {
				overallStatus: 'damaged',
				summary: 'Breach.',
				systems: [
					{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 2 },
				],
			},
		});
	}

	it('should group by asset type by default', () => {
		const page = buildPageWithSystems();
		const groups = page.groupedAssets();
		const groupNames = groups.map((g) => g.group);
		expect(groupNames).toContain('Ships');
		expect(groupNames).toContain('Ship Systems');
		expect(groupNames).toContain('Inventory Items');
	});

	it('should group by severity label (uppercase)', () => {
		const page = buildPageWithSystems();
		page.setGrouping('severity');
		const groups = page.groupedAssets();
		const groupNames = groups.map((g) => g.group);
		expect(groupNames).toContain('DAMAGED');
		expect(groupNames).toContain('CRITICAL');
		expect(groupNames).toContain('INTACT');
	});

	it('should group by priority band', () => {
		const page = buildPageWithSystems();
		page.setGrouping('priority-band');
		const groups = page.groupedAssets();
		const groupNames = groups.map((g) => g.group);
		// ship entry (priority 0) → Priority 1; system (priority 2) → Priority 2-3; inventory (priority 100) → Priority 4+
		expect(groupNames).toContain('Priority 1');
		expect(groupNames).toContain('Priority 2-3');
		expect(groupNames).toContain('Priority 4+');
	});

	it('should sort groups alphabetically', () => {
		const page = buildPageWithSystems();
		const groups = page.groupedAssets();
		const names = groups.map((g) => g.group);
		const sorted = [...names].sort((a, b) => a.localeCompare(b));
		expect(names).toEqual(sorted);
	});
});

// ---------------------------------------------------------------------------
// Tests: hasHullPatchKit / canQueueHullPatchKit
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - hull patch kit state', () => {
	it('should report no hull patch kit when inventory is empty', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: { id: 's-1', inventory: [] },
		});
		expect(page.hasHullPatchKit()).toBe(false);
	});

	it('should report hull patch kit present when inventory contains it', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit' }],
			},
		});
		expect(page.hasHullPatchKit()).toBe(true);
	});

	it('should allow queuing hull patch kit when iron is in inventory and kit is absent', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }],
			},
		});
		expect(page.canQueueHullPatchKit()).toBe(true);
	});

	it('should not allow queuing when kit already present', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [
					{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' },
					{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit' },
				],
			},
		});
		expect(page.canQueueHullPatchKit()).toBe(false);
	});

	it('should not allow queuing when no compatible materials in inventory', () => {
		const page = new MockRepairRetrofitItemsPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'crystal-1', itemType: 'crystal', displayName: 'Crystal' }],
			},
		});
		expect(page.canQueueHullPatchKit()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Tests: action helpers
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - action helpers', () => {
	const shipEntry: RepairAssetEntry = { key: 'ship:s-1', kind: 'ship', label: 'Scavenger Pod', severity: 'damaged', summary: 'Breach.', repairPriority: 0, shipId: 's-1' };
	const intactEntry: RepairAssetEntry = { key: 'ship:s-2', kind: 'ship', label: 'Ship', severity: 'intact', summary: 'Nominal.', repairPriority: 0, shipId: 's-2' };
	const systemCritical: RepairAssetEntry = { key: 'ship-system:nav', kind: 'ship-system', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 2, shipId: 's-1' };
	const itemEntry: RepairAssetEntry = { key: 'inventory-item:i-1', kind: 'inventory-item', label: 'Iron', severity: 'damaged', summary: 'Damaged.', repairPriority: 100, shipId: 's-1', itemId: 'i-1' };

	const page = new MockRepairRetrofitItemsPage();

	it('should allow opening detail when severity is not intact', () => {
		expect(page.canOpenDetail(shipEntry)).toBe(true);
		expect(page.canOpenDetail(intactEntry)).toBe(false);
	});

	it('should allow repair when severity is not intact', () => {
		expect(page.canRepairAsset(shipEntry)).toBe(true);
		expect(page.canRepairAsset(intactEntry)).toBe(false);
	});

	it('should provide correct repair label by asset kind', () => {
		expect(page.getRepairLabel(shipEntry)).toBe('Fully Repair Ship');
		expect(page.getRepairLabel(systemCritical)).toBe('Fully Repair System');
		expect(page.getRepairLabel(itemEntry)).toBe('Fully Repair Item');
	});

	it('should return no materials for intact assets', () => {
		expect(page.getRequiredMaterials(intactEntry)).toBe('No materials required');
	});

	it('should return correct materials per asset kind', () => {
		expect(page.getRequiredMaterials(shipEntry)).toContain('Hull patch kit');
		expect(page.getRequiredMaterials(systemCritical)).toContain('Subsystem relay');
		expect(page.getRequiredMaterials(itemEntry)).toContain('Spare casing');
	});

	it('should estimate 2h 30m for critical severity', () => {
		expect(page.getEstimatedWindow(systemCritical)).toBe('2h 30m');
	});

	it('should estimate 1h 20m for major/damaged severity', () => {
		const major: RepairAssetEntry = { ...shipEntry, severity: 'major' };
		expect(page.getEstimatedWindow(major)).toBe('1h 20m');
	});

	it('should estimate 35m for minor severity', () => {
		const minor: RepairAssetEntry = { ...shipEntry, severity: 'minor' };
		expect(page.getEstimatedWindow(minor)).toBe('35m');
	});

	it('should estimate 0m for intact assets', () => {
		expect(page.getEstimatedWindow(intactEntry)).toBe('0m');
	});

	it('should cost 980 CR for critical severity', () => {
		expect(page.getEstimatedCost(systemCritical)).toBe('980 CR');
	});

	it('should cost 560 CR for damaged severity', () => {
		expect(page.getEstimatedCost(shipEntry)).toBe('560 CR');
	});

	it('should cost 0 CR for intact assets', () => {
		expect(page.getEstimatedCost(intactEntry)).toBe('0 CR');
	});

	it('should show "Ready" availability for damaged assets', () => {
		expect(page.getActionAvailability(shipEntry)).toBe('Ready');
	});

	it('should show "No action needed" for intact assets', () => {
		expect(page.getActionAvailability(intactEntry)).toBe('No action needed');
	});

	it('should track the active repair key per asset', () => {
		expect(page.isRepairing(shipEntry)).toBe(false);
		page.activeRepairKey.set(shipEntry.key);
		expect(page.isRepairing(shipEntry)).toBe(true);
		expect(page.isRepairing(systemCritical)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Tests: setFilter / setGrouping / setSearchQuery
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemsPage - filter / grouping / search controls', () => {
	it('should update filter via setFilter', () => {
		const page = new MockRepairRetrofitItemsPage();
		page.setFilter('needs-repair');
		expect(page.selectedFilter()).toBe('needs-repair');
	});

	it('should update grouping via setGrouping', () => {
		const page = new MockRepairRetrofitItemsPage();
		page.setGrouping('priority-band');
		expect(page.selectedGrouping()).toBe('priority-band');
	});

	it('should update search query via setSearchQuery', () => {
		const page = new MockRepairRetrofitItemsPage();
		page.setSearchQuery('hull');
		expect(page.searchQuery()).toBe('hull');
	});
});
