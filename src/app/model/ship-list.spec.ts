import {
	coerceShipInventory,
	DEFAULT_SHIP_MODEL,
} from './ship-list';
import { EXPENDABLE_DART_DRONE_ITEM_TYPE, EXPENDABLE_DART_DRONE_DISPLAY_NAME } from './expendable-dart-drone';

describe('ship-list inventory helpers', () => {
	it('coerces valid ShipItem objects in the inventory array', () => {
		const validItem = {
			id: 'item-1',
			itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
			displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
			state: 'contained',
			damageStatus: 'intact',
			container: null,
			owningPlayerId: null,
			owningCharacterId: null,
			kinematics: null,
			destroyedAt: null,
			destroyedReason: null,
			discoveredAt: null,
			discoveredByCharacterId: null,
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
		};
		const result = coerceShipInventory([validItem, null, 'invalid', 42] as unknown);

		expect(result.length).toBe(1);
		expect(result[0].id).toBe('item-1');
		expect(result[0].itemType).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
		expect(result[0].displayName).toBe(EXPENDABLE_DART_DRONE_DISPLAY_NAME);
	});

	it('returns an empty array for non-array input', () => {
		expect(coerceShipInventory(null)).toEqual([]);
		expect(coerceShipInventory(undefined)).toEqual([]);
		expect(coerceShipInventory('string')).toEqual([]);
	});

	it('returns an empty array for an empty array input', () => {
		expect(coerceShipInventory([])).toEqual([]);
	});

	it('skips items missing required fields', () => {
		const result = coerceShipInventory([
			{ id: '', itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE, displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME },
			{ id: 'x', itemType: '', displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME },
			{ id: 'y', itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE, displayName: '' },
		] as unknown);

		expect(result.length).toBe(0);
	});
});

describe('DEFAULT_SHIP_MODEL', () => {
	it('is defined', () => {
		expect(typeof DEFAULT_SHIP_MODEL).toBe('string');
		expect(DEFAULT_SHIP_MODEL.length).toBeGreaterThan(0);
	});
});
