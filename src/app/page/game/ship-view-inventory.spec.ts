import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import ShipViewInventoryPage from './ship-view-inventory';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import {
	createMockSocketService,
	type MockSocketService,
	createMockSessionService,
	type MockSessionService,
} from '../../../testing';

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

function makeItem(overrides?: Partial<ItemStub>): ItemStub {
	return {
		id: overrides?.id ?? 'item-1',
		itemType: overrides?.itemType ?? 'expendable-dart-drone',
		displayName: overrides?.displayName ?? 'Expendable Dart Drone',
	};
}

function setup(options: {
	socketService: MockSocketService;
	sessionService: MockSessionService;
	navigationState?: NavigationState;
}) {
	const mockRouter = {
		getCurrentNavigation: () =>
			options.navigationState ? { extras: { state: options.navigationState } } : null,
		navigate: jasmine.createSpy('navigate'),
	};

	TestBed.configureTestingModule({
		imports: [ShipViewInventoryPage],
		providers: [
			{ provide: SocketService, useValue: options.socketService },
			{ provide: SessionService, useValue: options.sessionService },
			{ provide: Router, useValue: mockRouter },
		],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(ShipViewInventoryPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('ShipViewInventoryPage', () => {
	let socketService: MockSocketService;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
	});

	it('should initialize context from navigation state', () => {
		const { component } = setup({
			socketService,
			sessionService,
			navigationState: {
				playerName: 'Pioneer',
				joinCharacter: { id: 'c-1', characterName: 'Nova' },
				joinShip: { id: 's-1', name: 'Scavenger I', model: 'Scavenger Pod', tier: 1, inventory: [makeItem()] },
			},
		});

		expect(component['playerName']()).toBe('Pioneer');
		expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(component['joinShip']()?.id).toBe('s-1');
	});

	it('should group inventory items by item type with quantity counts', () => {
		const { component } = setup({
			socketService,
			sessionService,
			navigationState: {
				joinShip: {
					id: 's-1',
					name: 'Scavenger I',
					inventory: [
						makeItem({ id: 'item-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone' }),
						makeItem({ id: 'item-2', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone Mk II' }),
						makeItem({ id: 'item-3', itemType: 'basic-mining-laser', displayName: 'Basic Mining Laser' }),
					],
				},
			},
		});

		const groups = component['inventoryGroups']() as InventoryGroup[];

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
		const { component, mockRouter } = setup({
			socketService,
			sessionService,
			navigationState: {
				playerName: 'Pioneer',
				joinCharacter: character,
			},
		});

		component.navigateToItemSpecs({
			itemType: groupedItem.itemType,
			name: groupedItem.displayName,
			quantity: 3,
			item: groupedItem as any,
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
		const { component } = setup({
			socketService,
			sessionService,
			navigationState: {
				joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
			},
		});

		expect(component['inventoryGroups']()).toEqual([]);
	});

	it('should return empty inventory groups when no ship is selected', () => {
		const { component } = setup({ socketService, sessionService });

		expect(component['inventoryGroups']()).toEqual([]);
	});

	it('should navigate back to ship-hangar with player and character state', () => {
		const character = { id: 'c-1', characterName: 'Nova' };
		const { component, mockRouter } = setup({
			socketService,
			sessionService,
			navigationState: {
				playerName: 'Pioneer',
				joinCharacter: character,
				joinShip: { id: 's-1', name: 'Scavenger I', inventory: [] },
			},
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
		const { component } = setup({
			socketService,
			sessionService,
			navigationState: {
				joinShip: { id: 's-2', name: 'Dart Runner' },
			},
		});

		expect(component['getShipDisplayName']()).toBe('Dart Runner');
	});

	it('should fall back to ship id when name is blank', () => {
		const { component } = setup({
			socketService,
			sessionService,
			navigationState: {
				joinShip: { id: 's-3', name: '  ' },
			},
		});

		expect(component['getShipDisplayName']()).toBe('s-3');
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({
				socketService,
				sessionService,
				navigationState: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'c-1', characterName: 'Nova' },
					joinShip: { id: 's-1', name: 'Scavenger I', inventory: [makeItem()] },
				},
			});
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});
