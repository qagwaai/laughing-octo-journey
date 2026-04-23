import {
	DEFAULT_CLUSTER_SPREAD_KM,
	generateRandomAsteroidBeltClusterCenterKm,
	generateRandomCelestialBodyLocationNear,
} from './celestial-body-location';

describe('celestial-body-location', () => {
	it('generates asteroid-belt cluster center near expected radius range', () => {
		const center = generateRandomAsteroidBeltClusterCenterKm(() => 0.5);
		const radius = Math.hypot(center.x, center.z);

		expect(radius).toBeGreaterThanOrEqual(3.29e8);
		expect(radius).toBeLessThanOrEqual(4.79e8);
		expect(Math.abs(center.y)).toBeLessThanOrEqual(2.5e6);
	});

	it('generates a nearby location within configured spread on each axis', () => {
		const center = { x: 400_000_000, y: 10_000, z: -350_000_000 };
		const location = generateRandomCelestialBodyLocationNear(
			center,
			DEFAULT_CLUSTER_SPREAD_KM,
			() => 1,
		);

		expect(Math.abs(location.positionKm.x - center.x)).toBeLessThanOrEqual(DEFAULT_CLUSTER_SPREAD_KM);
		expect(Math.abs(location.positionKm.y - center.y)).toBeLessThanOrEqual(DEFAULT_CLUSTER_SPREAD_KM);
		expect(Math.abs(location.positionKm.z - center.z)).toBeLessThanOrEqual(DEFAULT_CLUSTER_SPREAD_KM);
	});

	it('supports a custom spread for tighter or wider local clusters', () => {
		const center = { x: 410_000_000, y: 0, z: 320_000_000 };
		const customSpread = 1_200;
		const location = generateRandomCelestialBodyLocationNear(center, customSpread, () => 1);

		expect(Math.abs(location.positionKm.x - center.x)).toBeLessThanOrEqual(customSpread);
		expect(Math.abs(location.positionKm.y - center.y)).toBeLessThanOrEqual(customSpread);
		expect(Math.abs(location.positionKm.z - center.z)).toBeLessThanOrEqual(customSpread);
	});
});
