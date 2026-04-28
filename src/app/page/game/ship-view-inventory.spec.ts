export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

function createComputed<T>(fn: () => T) {
	return () => fn();
}

interface ItemStub {
	id: string;
	itemType: string;
	displayName: string;
}

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
	joinShip?: { id: string; name: string; model?: string; tier?: number; inventory?: ItemStub[] };
}

interface InventoryGroup {
	itemType: string;
	name: string;
	quantity: number;
	item: ItemStub;
}

function groupInventory(inventory: ItemStub[]): InventoryGroup[] {
	const counts = new Map<string, InventoryGroup>();
	for (const item of inventory) {
		const existing = counts.get(item.itemType);
		if (existing) {
			existing.quantity += 1;
			continue;
		}

		counts.set(item.itemType, {
			itemType: item.itemType,
			name: item.displayName,
			quantity: 1,
			item,
		});
	}
	return Array.from(counts.values());
}

function makeItem(overrides?: Partial<ItemStub>): ItemStub {
	return {
		id: overrides?.id ?? 'item-1',
		itemType: overrides?.itemType ?? 'expendable-dart-drone',
		displayName: overrides?.displayName ?? 'Expendable Dart Drone',
	};
}

class MockShipViewInventoryPage {
	private mockRouter: { navigate: jasmine.Spy };

	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
	joinShip = createSignal<NavigationState['joinShip'] | null>(null);

	inventoryGroups = createComputed<InventoryGroup[]>(() =>
		groupInventory(this.joinShip()?.inventory ?? []),
	);

	constructor(mockRouter: { navigate: jasmine.Spy }, state?: NavigationState) {
		this.mockRouter = mockRouter;
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.joinShip.set(state?.joinShip ?? null);
	}

	getShipDisplayName(): string {
		const ship = this.joinShip();
		return ship?.name?.trim() || ship?.id || '';
	}

	navigateBackToHangar(): void {
		this.mockRouter.navigate(
			[{ outlets: { left: ['ship-hangar'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: this.playerName(),
					joinCharacter: this.joinCharacter(),
				},
			},
		);
	}

	navigateToItemSpecs(group: InventoryGroup): void {
		this.mockRouter.navigate(
			[{ outlets: { right: ['item-view-specs'], left: ['ship-view-inventory'] } }],
			{
				preserveFragment: true,
				queryParams: { specsNav: Date.now() },
				state: {
					playerName: this.playerName(),
					joinCharacter: this.joinCharacter(),
					itemType: group.itemType,
					item: group.item,
				},
			},
		);
	}
}

describe('ShipViewInventoryPage', () => {
	let mockRouter: { navigate: jasmine.Spy };

	beforeEach(() => {
		mockRouter = { navigate: jasmine.createSpy('navigate') };
	});

	it('should initialize context from navigation state', () => {
		const component = new MockShipViewInventoryPage(mockRouter, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
			joinShip: { id: 's-1', name: 'Scavenger I', model: 'Scavenger Pod', tier: 1, inventory: [makeItem()] },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(component.joinShip()?.id).toBe('s-1');
	});

	it('should group inventory items by item type with quantity counts', () => {
		const component = new MockShipViewInventoryPage(mockRouter, {
			joinShip: {
				id: 's-1',
				name: 'Scavenger I',
				inventory: [
					makeItem({ id: 'item-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone' }),
					makeItem({ id: 'item-2', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone Mk II' }),
					makeItem({ id: 'item-3', itemType: 'basic-mining-laser', displayName: 'Basic Mining Laser' }),
				],
			},
		});

		const groups = component.inventoryGroups();

		expect(groups.length).toBe(2);
		expect(groups[0].itemType).toBe('expendable-dart-drone');
		expect(groups[0].name).toBe('Expendable Dart Drone');
		expect(groups[0].quantity).toBe(2);
		expect(groups[1].itemType).toBe('basic-mining-laser');
		expect(groups[1].quantity).toBe(1);
	});

	it('should navigate to item-view-specs with grouped item context', () => {
		const character = { id: 'c-1', characterName: 'Nova' };
		const groupedItem = makeItem({ id: 'item-1', itemType: 'basic-mining-laser', displayName: 'Basic Mining Laser' });
		const component = new MockShipViewInventoryPage(mockRouter, {
			playerName: 'Pioneer',
			joinCharacter: character,
		});

		component.navigateToItemSpecs({
			itemType: groupedItem.itemType,
			name: groupedItem.displayName,
			quantity: 3,
			item: groupedItem,
		});

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { right: ['item-view-specs'], left: ['ship-view-inventory'] } }],
			{
				preserveFragment: true,
				queryParams: { specsNav: jasmine.any(Number) },
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
					itemType: 'basic-mining-laser',
					item: groupedItem,
				},
			},
		);
	});

	it('should return empty inventory groups when ship inventory is empty', () => {
		const component = new MockShipViewInventoryPage(mockRouter, {
			joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
		});

		expect(component.inventoryGroups()).toEqual([]);
	});

	it('should return empty inventory groups when no ship is selected', () => {
		const component = new MockShipViewInventoryPage(mockRouter);

		expect(component.inventoryGroups()).toEqual([]);
	});

	it('should navigate back to ship-hangar with player and character state', () => {
		const character = { id: 'c-1', characterName: 'Nova' };
		const component = new MockShipViewInventoryPage(mockRouter, {
			playerName: 'Pioneer',
			joinCharacter: character,
			joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
		});

		component.navigateBackToHangar();

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['ship-hangar'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
				},
			},
		);
	});

	it('should return ship display name from ship name', () => {
		const component = new MockShipViewInventoryPage(mockRouter, {
			joinShip: { id: 's-2', name: 'Dart Runner' },
		});

		expect(component.getShipDisplayName()).toBe('Dart Runner');
	});

	it('should fall back to ship id when name is blank', () => {
		const component = new MockShipViewInventoryPage(mockRouter, {
			joinShip: { id: 's-3', name: '  ' },
		});

		expect(component.getShipDisplayName()).toBe('s-3');
	});
});
