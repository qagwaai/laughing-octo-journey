import {
	coerceShipInventory,
	coerceShipModel,
	coerceShipTier,
	coerceShipStatus,
	coerceShipDamageProfileOrNull,
	DEFAULT_SHIP_MODEL,
	DEFAULT_SHIP_TIER,
	MIN_SHIP_TIER,
	MAX_SHIP_TIER,
} from './ship-list';
import { EXPENDABLE_DART_DRONE_ITEM_TYPE, EXPENDABLE_DART_DRONE_DISPLAY_NAME } from './expendable-dart-drone';

describe('ship-list inventory helpers', () => {
	it('coerces valid ShipItem objects and supported display-name strings in inventory', () => {
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
		const result = coerceShipInventory([
			validItem,
			null,
			EXPENDABLE_DART_DRONE_DISPLAY_NAME,
			42,
		] as unknown);

		expect(result.length).toBe(2);
		expect(result[0].id).toBe('item-1');
		expect(result[0].itemType).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
		expect(result[0].displayName).toBe(EXPENDABLE_DART_DRONE_DISPLAY_NAME);
		expect(result[0].launchable).toBe(true);
		expect(result[1].itemType).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
		expect(result[1].displayName).toBe(EXPENDABLE_DART_DRONE_DISPLAY_NAME);
		expect(result[1].launchable).toBe(true);
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
		] as unknown);

		expect(result.length).toBe(0);
	});

	it('falls back to itemType when displayName is empty', () => {
		const result = coerceShipInventory([
			{ id: 'y', itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE, displayName: '' },
		] as unknown);

		expect(result.length).toBe(1);
		expect(result[0].displayName).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
	});

	it('respects explicit launchable false and defaults missing launchable to true', () => {
		const result = coerceShipInventory([
			{ id: 'a', itemType: 'probe', displayName: 'Probe', launchable: false },
			{ id: 'b', itemType: 'drone', displayName: 'Drone' },
		] as unknown);

		expect(result.length).toBe(2);
		expect(result[0].launchable).toBe(false);
		expect(result[1].launchable).toBe(true);
	});
});

describe('DEFAULT_SHIP_MODEL', () => {
	it('is defined', () => {
		expect(typeof DEFAULT_SHIP_MODEL).toBe('string');
		expect(DEFAULT_SHIP_MODEL.length).toBeGreaterThan(0);
	});
});

describe('coerceShipModel', () => {
	it('returns the value when a valid string is provided', () => {
		expect(coerceShipModel('Scavenger Pod')).toBe('Scavenger Pod');
	});

	it('returns DEFAULT_SHIP_MODEL for non-string input', () => {
		expect(coerceShipModel(null)).toBe(DEFAULT_SHIP_MODEL);
		expect(coerceShipModel(42)).toBe(DEFAULT_SHIP_MODEL);
		expect(coerceShipModel(undefined)).toBe(DEFAULT_SHIP_MODEL);
	});

	it('returns DEFAULT_SHIP_MODEL for empty or whitespace string', () => {
		expect(coerceShipModel('')).toBe(DEFAULT_SHIP_MODEL);
		expect(coerceShipModel('   ')).toBe(DEFAULT_SHIP_MODEL);
	});
});

describe('coerceShipTier', () => {
	it('returns the tier when within valid range', () => {
		expect(coerceShipTier(MIN_SHIP_TIER)).toBe(MIN_SHIP_TIER);
		expect(coerceShipTier(MAX_SHIP_TIER)).toBe(MAX_SHIP_TIER);
		expect(coerceShipTier(5)).toBe(5);
	});

	it('returns DEFAULT_SHIP_TIER for non-integer inputs', () => {
		expect(coerceShipTier(null)).toBe(DEFAULT_SHIP_TIER);
		expect(coerceShipTier('3')).toBe(DEFAULT_SHIP_TIER);
		expect(coerceShipTier(1.5)).toBe(DEFAULT_SHIP_TIER);
		expect(coerceShipTier(undefined)).toBe(DEFAULT_SHIP_TIER);
	});

	it('returns DEFAULT_SHIP_TIER when tier is below MIN_SHIP_TIER', () => {
		expect(coerceShipTier(MIN_SHIP_TIER - 1)).toBe(DEFAULT_SHIP_TIER);
	});

	it('returns DEFAULT_SHIP_TIER when tier exceeds MAX_SHIP_TIER', () => {
		expect(coerceShipTier(MAX_SHIP_TIER + 1)).toBe(DEFAULT_SHIP_TIER);
	});
});

describe('coerceShipStatus', () => {
	it('returns trimmed string for valid input', () => {
		expect(coerceShipStatus('docked')).toBe('docked');
		expect(coerceShipStatus('  docked  ')).toBe('docked');
	});

	it('returns null for null input', () => {
		expect(coerceShipStatus(null)).toBeNull();
	});

	it('returns null for non-string input', () => {
		expect(coerceShipStatus(42)).toBeNull();
		expect(coerceShipStatus({})).toBeNull();
	});

	it('returns null for empty or whitespace string', () => {
		expect(coerceShipStatus('')).toBeNull();
		expect(coerceShipStatus('   ')).toBeNull();
	});
});

describe('coerceShipDamageProfileOrNull', () => {
	it('returns null for null input', () => {
		expect(coerceShipDamageProfileOrNull(null)).toBeNull();
	});

	it('returns a damage profile for valid input', () => {
		const result = coerceShipDamageProfileOrNull({
			overallStatus: 'damaged',
			summary: 'test damage',
			systems: [],
		});
		expect(result).not.toBeNull();
		expect(result!.overallStatus).toBe('damaged');
	});
});
