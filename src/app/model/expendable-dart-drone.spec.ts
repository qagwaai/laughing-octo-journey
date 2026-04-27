import {
	coerceExpendableDartDrone,
	createExpendableDartDrone,
	isExpendableDartDrone,
	EXPENDABLE_DART_DRONE_ITEM_TYPE,
	EXPENDABLE_DART_DRONE_DISPLAY_NAME,
} from './expendable-dart-drone';

describe('expendable-dart-drone model', () => {
	describe('createExpendableDartDrone', () => {
		it('creates a drone with correct itemType and displayName', () => {
			const drone = createExpendableDartDrone();

			expect(drone.itemType).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
			expect(drone.displayName).toBe(EXPENDABLE_DART_DRONE_DISPLAY_NAME);
			expect(drone.launchable).toBe(true);
			expect(typeof drone.id).toBe('string');
			expect(drone.id.length).toBeGreaterThan(0);
		});

		it('creates a drone with default state and damageStatus', () => {
			const drone = createExpendableDartDrone();

			expect(drone.state).toBe('contained');
			expect(drone.damageStatus).toBe('intact');
		});

		it('creates a drone with null owning fields and kinematics', () => {
			const drone = createExpendableDartDrone();

			expect(drone.container).toBeNull();
			expect(drone.owningPlayerId).toBeNull();
			expect(drone.owningCharacterId).toBeNull();
			expect(drone.kinematics).toBeNull();
		});

		it('creates a drone with null lifecycle timestamps', () => {
			const drone = createExpendableDartDrone();

			expect(drone.destroyedAt).toBeNull();
			expect(drone.destroyedReason).toBeNull();
			expect(drone.discoveredAt).toBeNull();
			expect(drone.discoveredByCharacterId).toBeNull();
		});

		it('creates a drone with createdAt and updatedAt timestamps', () => {
			const drone = createExpendableDartDrone();

			expect(typeof drone.createdAt).toBe('string');
			expect(drone.createdAt.length).toBeGreaterThan(0);
			expect(typeof drone.updatedAt).toBe('string');
			expect(drone.updatedAt.length).toBeGreaterThan(0);
		});

		it('generates a unique id per drone', () => {
			const a = createExpendableDartDrone();
			const b = createExpendableDartDrone();

			expect(a.id).not.toBe(b.id);
		});
	});

	describe('isExpendableDartDrone', () => {
		it('returns true for an expendable dart drone item', () => {
			expect(isExpendableDartDrone(createExpendableDartDrone())).toBe(true);
		});

		it('returns false for a different item type', () => {
			const other = { ...createExpendableDartDrone(), itemType: 'repair-kit' };
			expect(isExpendableDartDrone(other)).toBe(false);
		});
	});

	describe('coerceExpendableDartDrone', () => {
		it('returns null for null input', () => {
			expect(coerceExpendableDartDrone(null)).toBeNull();
		});

		it('returns null for undefined input', () => {
			expect(coerceExpendableDartDrone(undefined)).toBeNull();
		});

		it('returns null for a primitive', () => {
			expect(coerceExpendableDartDrone(42)).toBeNull();
			expect(coerceExpendableDartDrone('expendable-dart-drone')).toBeNull();
		});

		it('returns null for an array', () => {
			expect(coerceExpendableDartDrone([])).toBeNull();
		});

		it('returns null for an object missing id', () => {
			expect(coerceExpendableDartDrone({ itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE, displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME })).toBeNull();
		});

		it('returns null for an object missing itemType', () => {
			expect(coerceExpendableDartDrone({ id: 'x', displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME })).toBeNull();
		});

		it('returns null for an object with a different itemType', () => {
			expect(coerceExpendableDartDrone({ id: 'x', itemType: 'repair-kit', displayName: 'Repair Kit' })).toBeNull();
		});

		it('coerces a valid drone object', () => {
			const drone = coerceExpendableDartDrone({
				id: 'drone-abc',
				itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
				displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
				launchable: true,
				state: 'contained',
				damageStatus: 'intact',
				container: null,
				owningPlayerId: 'player-1',
				owningCharacterId: 'char-1',
				kinematics: null,
				destroyedAt: null,
				destroyedReason: null,
				discoveredAt: null,
				discoveredByCharacterId: null,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			expect(drone).not.toBeNull();
			expect(drone!.id).toBe('drone-abc');
			expect(drone!.itemType).toBe(EXPENDABLE_DART_DRONE_ITEM_TYPE);
			expect(drone!.displayName).toBe(EXPENDABLE_DART_DRONE_DISPLAY_NAME);
			expect(drone!.launchable).toBe(true);
			expect(drone!.state).toBe('contained');
			expect(drone!.damageStatus).toBe('intact');
		});

		it('coerces a drone with a ship container', () => {
			const drone = coerceExpendableDartDrone({
				id: 'drone-xyz',
				itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
				displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
				state: 'contained',
				damageStatus: 'damaged',
				container: { containerType: 'ship', containerId: 'ship-99' },
				owningPlayerId: null,
				owningCharacterId: null,
				kinematics: null,
				destroyedAt: null,
				destroyedReason: null,
				discoveredAt: null,
				discoveredByCharacterId: null,
				createdAt: '2024-01-01T00:00:00.000Z',
				updatedAt: '2024-01-01T00:00:00.000Z',
			});

			expect(drone).not.toBeNull();
			expect(drone!.container).toEqual({ containerType: 'ship', containerId: 'ship-99' });
			expect(drone!.damageStatus).toBe('damaged');
		});

		it('falls back to default state when state is invalid', () => {
			const drone = coerceExpendableDartDrone({
				id: 'drone-1',
				itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
				displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
				state: 'unknown-state',
				damageStatus: 'intact',
			});

			expect(drone).not.toBeNull();
			expect(drone!.state).toBe('contained');
		});

		it('falls back to default damageStatus when damageStatus is invalid', () => {
			const drone = coerceExpendableDartDrone({
				id: 'drone-1',
				itemType: EXPENDABLE_DART_DRONE_ITEM_TYPE,
				displayName: EXPENDABLE_DART_DRONE_DISPLAY_NAME,
				state: 'deployed',
				damageStatus: 'exploded',
			});

			expect(drone).not.toBeNull();
			expect(drone!.damageStatus).toBe('intact');
		});
	});
});
