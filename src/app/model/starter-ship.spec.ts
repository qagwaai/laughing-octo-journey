import { generateDeterministicStarterShipUpdate } from './starter-ship';
import {
	DEFAULT_SHIP_MODEL,
	DEFAULT_SHIP_TIER,
	EXPENDABLE_DART_DRONE_INVENTORY_ITEM,
} from './ship-list';

describe('starter-ship model', () => {
	it('creates a scavenger pod starter ship with default inventory', () => {
		const starter = generateDeterministicStarterShipUpdate('Pioneer', 'char-1', 'starter-char-1');

		expect(starter.id).toBe('starter-char-1');
		expect(starter.model).toBe(DEFAULT_SHIP_MODEL);
		expect(starter.tier).toBe(DEFAULT_SHIP_TIER);
		expect(starter.inventory).toEqual([EXPENDABLE_DART_DRONE_INVENTORY_ITEM]);
		expect(starter.location).toBeDefined();
		expect(starter.kinematics).toBeDefined();
	});
});
