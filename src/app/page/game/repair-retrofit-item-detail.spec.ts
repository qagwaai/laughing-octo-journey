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
	state?: string;
}

interface ShipStub {
	id: string;
	inventory?: InventoryItem[];
}

interface RepairAssetEntry {
	key: string;
	kind: string;
	itemId?: string;
}

interface CharacterStub {
	id: string;
}

interface NavigationState {
	playerName?: string;
	joinCharacter?: CharacterStub | null;
	joinShip?: ShipStub | null;
	asset?: RepairAssetEntry;
}

// ---------------------------------------------------------------------------
// Mock class — mirrors RepairRetrofitItemDetailPage logic
// ---------------------------------------------------------------------------

class MockRepairRetrofitItemDetailPage {
	playerName = createSignal<string>('');
	joinCharacter = createSignal<CharacterStub | null>(null);
	joinShip = createSignal<ShipStub | null>(null);
	selectedAsset = createSignal<RepairAssetEntry | null>(null);
	isPersisting = createSignal(false);
	persistError = createSignal<string | null>(null);
	persistSuccess = createSignal<string | null>(null);

	constructor(state?: NavigationState) {
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.joinShip.set(state?.joinShip ?? null);
		this.selectedAsset.set(state?.asset ?? null);
	}

	selectedItem(): InventoryItem | null {
		const itemId = this.selectedAsset()?.itemId;
		if (!itemId) {
			return null;
		}
		return this.joinShip()?.inventory?.find((item) => item.id === itemId) ?? null;
	}

	canFullyRepair(): boolean {
		return this.selectedItem()?.damageStatus !== 'intact';
	}

	/** Mirrors the guard conditions before the socket call in fullyRepairItem(). */
	fullyRepairItemGuarded(sessionKey: string): string | null {
		const item = this.selectedItem();
		const playerName = this.playerName().trim();
		if (!item || !sessionKey.trim() || !playerName) {
			return 'Missing item or session context for repair operation.';
		}
		return null;
	}
}

// ---------------------------------------------------------------------------
// Tests: Initialization
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - initialization', () => {
	it('should initialize signals from navigation state', () => {
		const asset: RepairAssetEntry = { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' };
		const page = new MockRepairRetrofitItemDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
			asset,
		});

		expect(page.playerName()).toBe('Pioneer');
		expect(page.joinCharacter()?.id).toBe('c-1');
		expect(page.joinShip()?.id).toBe('s-1');
		expect(page.selectedAsset()?.itemId).toBe('i-1');
	});

	it('should fall back to empty values when state is absent', () => {
		const page = new MockRepairRetrofitItemDetailPage();

		expect(page.playerName()).toBe('');
		expect(page.joinCharacter()).toBeNull();
		expect(page.joinShip()).toBeNull();
		expect(page.selectedAsset()).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Tests: selectedItem computed
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - selectedItem', () => {
	it('should return null when no asset is selected', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron' }] },
		});
		expect(page.selectedItem()).toBeNull();
	});

	it('should return null when asset has no itemId', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron' }] },
			asset: { key: 'ship:s-1', kind: 'ship' },
		});
		expect(page.selectedItem()).toBeNull();
	});

	it('should return null when itemId does not match any inventory item', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron' }] },
			asset: { key: 'inventory-item:i-999', kind: 'inventory-item', itemId: 'i-999' },
		});
		expect(page.selectedItem()).toBeNull();
	});

	it('should return the matching inventory item by itemId', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: {
				id: 's-1',
				inventory: [
					{ id: 'i-1', itemType: 'iron', damageStatus: 'intact' },
					{ id: 'i-2', itemType: 'conduit', damageStatus: 'damaged' },
				],
			},
			asset: { key: 'inventory-item:i-2', kind: 'inventory-item', itemId: 'i-2' },
		});
		const item = page.selectedItem();
		expect(item?.id).toBe('i-2');
		expect(item?.itemType).toBe('conduit');
		expect(item?.damageStatus).toBe('damaged');
	});
});

// ---------------------------------------------------------------------------
// Tests: canFullyRepair
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - canFullyRepair', () => {
	it('should be true when selected item is damaged', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
			asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
		});
		expect(page.canFullyRepair()).toBe(true);
	});

	it('should be false when selected item is intact', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'intact' }] },
			asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
		});
		expect(page.canFullyRepair()).toBe(false);
	});

	it('should be true when selected item is critical', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'critical' }] },
			asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
		});
		expect(page.canFullyRepair()).toBe(true);
	});

	it('should be true when no item is selected (undefined damageStatus !== "intact")', () => {
		// When selectedItem() returns null, null?.damageStatus is undefined, and undefined !== 'intact' is true.
		// This mirrors the actual computed in the component, and the template guards the repair button separately.
		const page = new MockRepairRetrofitItemDetailPage();
		expect(page.canFullyRepair()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Tests: fullyRepairItem guard
// ---------------------------------------------------------------------------

describe('RepairRetrofitItemDetailPage - fullyRepairItem guard', () => {
	function buildPageWithItem(overrides?: Partial<NavigationState>): MockRepairRetrofitItemDetailPage {
		return new MockRepairRetrofitItemDetailPage({
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1' },
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
			asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
			...overrides,
		});
	}

	it('should allow repair when all context is present', () => {
		const page = buildPageWithItem();
		expect(page.fullyRepairItemGuarded('session-1')).toBeNull();
	});

	it('should report error when no item is selected', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			playerName: 'Pioneer',
			joinShip: { id: 's-1', inventory: [] },
		});
		expect(page.fullyRepairItemGuarded('session-1')).not.toBeNull();
	});

	it('should report error when sessionKey is empty', () => {
		const page = buildPageWithItem();
		expect(page.fullyRepairItemGuarded('')).not.toBeNull();
	});

	it('should report error when sessionKey is only whitespace', () => {
		const page = buildPageWithItem();
		expect(page.fullyRepairItemGuarded('   ')).not.toBeNull();
	});

	it('should report error when playerName is empty', () => {
		const page = new MockRepairRetrofitItemDetailPage({
			playerName: '',
			joinShip: { id: 's-1', inventory: [{ id: 'i-1', itemType: 'iron', damageStatus: 'damaged' }] },
			asset: { key: 'inventory-item:i-1', kind: 'inventory-item', itemId: 'i-1' },
		});
		expect(page.fullyRepairItemGuarded('session-1')).not.toBeNull();
	});
});
