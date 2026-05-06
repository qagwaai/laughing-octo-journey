import {
	coerceDriveProfile,
	estimateTravelHours,
	QUANTUM_FOLD_DRIVE_PROFILE,
	RAPID_TRANSIT_DRIVE_PROFILE,
	resolveMinimumDriveProfileForDistance,
	resolveDriveProfileForShip,
	STANDARD_CRUISE_DRIVE_PROFILE,
} from './drive-profile';

describe('drive-profile model', () => {
	it('returns standard drive for null ship', () => {
		expect(resolveDriveProfileForShip(null)).toEqual(STANDARD_CRUISE_DRIVE_PROFILE);
	});

	it('returns standard drive for low-tier scavenger ship', () => {
		expect(resolveDriveProfileForShip({ model: 'Scavenger Pod', tier: 1 } as any)).toEqual(
			STANDARD_CRUISE_DRIVE_PROFILE,
		);
	});

	it('returns rapid transit drive for tier 3 ships', () => {
		expect(resolveDriveProfileForShip({ model: 'Freighter Mk II', tier: 3 } as any)).toEqual(
			RAPID_TRANSIT_DRIVE_PROFILE,
		);
	});

	it('returns quantum fold drive for high-tier ships', () => {
		expect(resolveDriveProfileForShip({ model: 'Carrier Prime', tier: 6 } as any)).toEqual(
			QUANTUM_FOLD_DRIVE_PROFILE,
		);
	});

	it('returns quantum fold drive when model implies quantum engine', () => {
		expect(resolveDriveProfileForShip({ model: 'Quantum Scout', tier: 2 } as any)).toEqual(
			QUANTUM_FOLD_DRIVE_PROFILE,
		);
	});

	it('uses explicit drive profile payload when provided by server', () => {
		expect(
			resolveDriveProfileForShip({
				model: 'Scavenger Pod',
				tier: 1,
				driveProfile: {
					id: 'rapid-transit',
					name: 'Rapid Transit Thruster',
					rangeAu: 18,
					cruiseSpeedAuPerHour: 2.1,
					fuelCostPerAu: 5,
				},
			}),
		).toEqual({
			id: 'rapid-transit',
			name: 'Rapid Transit Thruster',
			rangeAu: 18,
			cruiseSpeedAuPerHour: 2.1,
			fuelCostPerAu: 5,
		});
	});

	it('falls back to heuristic drive when explicit payload is invalid', () => {
		expect(
			resolveDriveProfileForShip({
				model: 'Scavenger Pod',
				tier: 3,
				driveProfile: {
					name: '',
					rangeAu: -1,
					cruiseSpeedAuPerHour: 0,
					fuelCostPerAu: -1,
				},
			}),
		).toEqual(RAPID_TRANSIT_DRIVE_PROFILE);
	});

	it('coerces a valid drive profile payload', () => {
		expect(
			coerceDriveProfile({
				id: 'quantum-fold',
				name: 'Quantum Fold Engine',
				rangeAu: 100,
				cruiseSpeedAuPerHour: 12,
				fuelCostPerAu: 20,
			}),
		).toEqual(QUANTUM_FOLD_DRIVE_PROFILE);
	});

	it('resolves minimum required drive by distance bands', () => {
		expect(resolveMinimumDriveProfileForDistance(0.2)).toEqual(STANDARD_CRUISE_DRIVE_PROFILE);
		expect(resolveMinimumDriveProfileForDistance(10)).toEqual(RAPID_TRANSIT_DRIVE_PROFILE);
		expect(resolveMinimumDriveProfileForDistance(60)).toEqual(QUANTUM_FOLD_DRIVE_PROFILE);
	});

	it('computes travel hours from distance and speed', () => {
		const hours = estimateTravelHours(2.3, STANDARD_CRUISE_DRIVE_PROFILE);
		expect(hours).toBeCloseTo(7.666, 2);
	});

	it('returns 0 hours for non-positive distances', () => {
		expect(estimateTravelHours(0, STANDARD_CRUISE_DRIVE_PROFILE)).toBe(0);
		expect(estimateTravelHours(-1, STANDARD_CRUISE_DRIVE_PROFILE)).toBe(0);
	});
});
