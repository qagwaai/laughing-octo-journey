import { generateDeterministicStarterShipUpdate } from './starter-ship';
import { DEFAULT_SHIP_MODEL, DEFAULT_SHIP_TIER } from './ship-list';

describe('starter-ship model', () => {
	it('creates a scavenger pod starter ship without inventory (server-managed)', () => {
		const starter = generateDeterministicStarterShipUpdate('Pioneer', 'char-1', 'starter-char-1');

		expect(starter.id).toBe('starter-char-1');
		expect(starter.model).toBe(DEFAULT_SHIP_MODEL);
		expect(starter.tier).toBe(DEFAULT_SHIP_TIER);
		expect((starter as { inventory?: unknown }).inventory).toBeUndefined();
		expect(starter.location).toBeDefined();
		expect(starter.kinematics).toBeDefined();
	});
});
