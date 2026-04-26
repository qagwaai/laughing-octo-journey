import {
	coerceShipInventory,
	coerceShipInventoryWithBackfill,
	DEFAULT_SHIP_MODEL,
	EXPENDABLE_DART_DRONE_INVENTORY_ITEM,
	getDefaultInventoryForShipModel,
} from './ship-list';

describe('ship-list inventory helpers', () => {
	it('coerces inventory to a trimmed string list', () => {
		expect(coerceShipInventory([' Expendable Dart Drone ', '', 123, null] as unknown)).toEqual([
			'Expendable Dart Drone',
		]);
	});

	it('returns scavenger pod default inventory', () => {
		expect(getDefaultInventoryForShipModel(DEFAULT_SHIP_MODEL)).toEqual([
			EXPENDABLE_DART_DRONE_INVENTORY_ITEM,
		]);
	});

	it('returns empty default inventory for non-starter models', () => {
		expect(getDefaultInventoryForShipModel('Heavy Hauler')).toEqual([]);
	});

	it('backfills missing inventory for scavenger pod', () => {
		expect(coerceShipInventoryWithBackfill(undefined, DEFAULT_SHIP_MODEL)).toEqual([
			EXPENDABLE_DART_DRONE_INVENTORY_ITEM,
		]);
	});

	it('does not overwrite explicitly provided empty inventory', () => {
		expect(coerceShipInventoryWithBackfill([], DEFAULT_SHIP_MODEL)).toEqual([]);
	});
});
