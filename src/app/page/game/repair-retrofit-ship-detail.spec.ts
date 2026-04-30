import {
	HULL_PATCH_KIT_PRINTABLE_ITEM,
	hasPrintableItemInInventory,
} from '../../model/printable-item';
import { describeSummaryForSystems } from './repair-retrofit-state';

export {};

// ---------------------------------------------------------------------------
// Minimal signal factory
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
}

interface ShipStub {
	id?: string;
	name?: string;
	model?: string;
	inventory?: InventoryItem[];
}

interface DamageProfile {
	overallStatus: 'intact' | 'damaged' | 'disabled' | 'destroyed';
	summary: string;
	systems: Array<{ code: string; label: string; severity: string; summary: string; repairPriority: number }>;
}

interface CharacterStub {
	id: string;
}

interface NavigationState {
	playerName?: string;
	joinCharacter?: CharacterStub | null;
	joinShip?: ShipStub | null;
	damageProfile?: DamageProfile | null;
	missionId?: string;
}

// ---------------------------------------------------------------------------
// Mock class — mirrors RepairRetrofitShipDetailPage logic
// ---------------------------------------------------------------------------

class MockRepairRetrofitShipDetailPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<CharacterStub | null>(null);
	joinShip = createSignal<ShipStub | null>(null);
	damageProfile = createSignal<DamageProfile | null>(null);
	missionId = createSignal<string>('first-target');
	isPersisting = createSignal(false);
	persistError = createSignal<string | null>(null);
	persistSuccess = createSignal<string | null>(null);

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.joinShip.set(state?.joinShip ?? null);
		this.damageProfile.set(state?.damageProfile ?? null);
		this.missionId.set(state?.missionId ?? 'first-target');
	}

	hasHullPatchKit(): boolean {
		return hasPrintableItemInInventory(this.joinShip()?.inventory as any, HULL_PATCH_KIT_PRINTABLE_ITEM);
	}

	canFullyRepair(): boolean {
		const profile = this.damageProfile();
		return !!profile && profile.overallStatus !== 'intact' && this.hasHullPatchKit();
	}

	getShipName(): string {
		const ship = this.joinShip();
		return ship?.name?.trim() || ship?.model?.trim() || (ship?.id ?? '') || 'Ship';
	}

	/** Mirrors the guard conditions before the socket call in fullyRepairShip(). */
	canInitiateRepair(sessionKey: string): boolean {
		const profile = this.damageProfile();
		const ship = this.joinShip();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const playerName = this.playerName().trim();
		return !!profile && !!ship?.id && !!characterId && !!playerName && !!sessionKey.trim();
	}

	fullyRepairShipGuarded(sessionKey: string): string | null {
		if (!this.canInitiateRepair(sessionKey)) {
			return 'Missing ship or session context for repair operation.';
		}
		return null;
	}

	buildRepairedProfile(): DamageProfile | null {
		const profile = this.damageProfile();
		if (!profile) {
			return null;
		}
		return {
			...profile,
			overallStatus: 'intact',
			summary: describeSummaryForSystems([]),
			systems: [],
		};
	}
}

// ---------------------------------------------------------------------------
// Tests: Initialization
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - initialization', () => {
	it('should initialize signals from navigation state', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', model: 'Scavenger Pod' },
		});

		expect(page.playerName()).toBe('Pioneer');
		expect(page.joinCharacter()?.id).toBe('c-1');
		expect(page.joinShip()?.id).toBe('s-1');
	});

	it('should fall back to default values when state is absent', () => {
		const page = new MockRepairRetrofitShipDetailPage();

		expect(page.playerName()).toBe('');
		expect(page.joinCharacter()).toBeNull();
		expect(page.joinShip()).toBeNull();
		expect(page.damageProfile()).toBeNull();
		expect(page.missionId()).toBe('first-target');
	});
});

// ---------------------------------------------------------------------------
// Tests: hasHullPatchKit
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - hasHullPatchKit', () => {
	it('should be false when inventory is empty', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: { id: 's-1', inventory: [] },
		});
		expect(page.hasHullPatchKit()).toBe(false);
	});

	it('should be true when hull-patch-kit is in inventory', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit', displayName: 'Hull Patch Kit' }],
			},
		});
		expect(page.hasHullPatchKit()).toBe(true);
	});

	it('should be false when inventory has other items but no hull patch kit', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'iron-1', itemType: 'iron', displayName: 'Iron' }],
			},
		});
		expect(page.hasHullPatchKit()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Tests: canFullyRepair
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - canFullyRepair', () => {
	it('should be false when damage profile is null', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			},
		});
		expect(page.canFullyRepair()).toBe(false);
	});

	it('should be false when ship is intact even with hull patch kit', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			},
			damageProfile: { overallStatus: 'intact', summary: 'Nominal.', systems: [] },
		});
		expect(page.canFullyRepair()).toBe(false);
	});

	it('should be false when ship is damaged but hull patch kit is missing', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: { id: 's-1', inventory: [] },
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.canFullyRepair()).toBe(false);
	});

	it('should be true when ship is damaged and hull patch kit is present', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			},
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.canFullyRepair()).toBe(true);
	});

	it('should be true when ship is disabled and hull patch kit is present', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [{ id: 'kit-1', itemType: 'hull-patch-kit' }],
			},
			damageProfile: { overallStatus: 'disabled', summary: 'Total failure.', systems: [] },
		});
		expect(page.canFullyRepair()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Tests: getShipName
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - getShipName', () => {
	it('should prefer name over model and id', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: { id: 's-1', name: 'The Iron Nomad', model: 'Scavenger Pod' },
		});
		expect(page.getShipName()).toBe('The Iron Nomad');
	});

	it('should fall back to model when name is absent', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: { id: 's-1', model: 'Scavenger Pod' },
		});
		expect(page.getShipName()).toBe('Scavenger Pod');
	});

	it('should fall back to id when name and model are absent', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			joinShip: { id: 's-1' },
		});
		expect(page.getShipName()).toBe('s-1');
	});

	it('should return "Ship" when no ship context is set', () => {
		const page = new MockRepairRetrofitShipDetailPage();
		expect(page.getShipName()).toBe('Ship');
	});
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairShip guard conditions
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - fullyRepairShip guard', () => {
	it('should report error when damage profile is missing', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1' },
		});
		expect(page.fullyRepairShipGuarded('session-1')).not.toBeNull();
	});

	it('should report error when ship id is missing', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: '' },
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.fullyRepairShipGuarded('session-1')).not.toBeNull();
	});

	it('should report error when characterId is missing', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: '' },
			joinShip: { id: 's-1' },
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.fullyRepairShipGuarded('session-1')).not.toBeNull();
	});

	it('should report error when playerName is missing', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: '',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1' },
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.fullyRepairShipGuarded('session-1')).not.toBeNull();
	});

	it('should report error when sessionKey is missing', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1' },
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.fullyRepairShipGuarded('')).not.toBeNull();
	});

	it('should allow repair when all context is present', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1' },
			damageProfile: { overallStatus: 'damaged', summary: 'Breach.', systems: [] },
		});
		expect(page.fullyRepairShipGuarded('session-1')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Tests: buildRepairedProfile
// ---------------------------------------------------------------------------

describe('RepairRetrofitShipDetailPage - buildRepairedProfile', () => {
	it('should return null when there is no current damage profile', () => {
		const page = new MockRepairRetrofitShipDetailPage();
		expect(page.buildRepairedProfile()).toBeNull();
	});

	it('should produce an intact profile with no systems', () => {
		const page = new MockRepairRetrofitShipDetailPage({
			damageProfile: {
				overallStatus: 'damaged',
				summary: 'Breach.',
				systems: [
					{ code: 'nav', label: 'Navigation', severity: 'critical', summary: 'Failed.', repairPriority: 1 },
				],
			},
		});

		const repaired = page.buildRepairedProfile();
		expect(repaired?.overallStatus).toBe('intact');
		expect(repaired?.systems.length).toBe(0);
		expect(repaired?.summary).toBe(describeSummaryForSystems([]));
	});
});
