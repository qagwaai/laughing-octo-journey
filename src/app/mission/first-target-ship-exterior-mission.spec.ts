import { FIRST_TARGET_SHIP_EXTERIOR_MISSION } from './first-target-ship-exterior-mission';

describe('FIRST_TARGET_SHIP_EXTERIOR_MISSION', () => {
	it('should only allow asteroid targeting for scavenger pod with expendable dart drone', () => {
		expect(
			FIRST_TARGET_SHIP_EXTERIOR_MISSION.canTargetAsteroids({
				shipModel: 'Scavenger Pod',
				hasExpendableDartDrone: true,
			}),
		).toBe(true);

		expect(
			FIRST_TARGET_SHIP_EXTERIOR_MISSION.canTargetAsteroids({
				shipModel: 'Scavenger Pod',
				hasExpendableDartDrone: false,
			}),
		).toBe(false);

		expect(
			FIRST_TARGET_SHIP_EXTERIOR_MISSION.canTargetAsteroids({
				shipModel: 'Expendable Dart Ship',
				hasExpendableDartDrone: true,
			}),
		).toBe(false);
	});

	it('should generate deterministic asteroid samples for the same mission seed inputs', () => {
		const first = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 1_000, y: 2_000, z: 3_000 },
			launchSeedHint: 42,
		});
		const second = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 1_000, y: 2_000, z: 3_000 },
			launchSeedHint: 42,
		});

		expect(first).toEqual(second);
	});

	it('should project active celestial bodies back into resumed asteroid samples', () => {
		const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createResumedAsteroidSamples({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 10_000, y: 0, z: -10_000 },
			existingBodies: [
				{
					id: 'cb-1',
					catalogId: 'cat-1',
					solarSystemId: 'sol',
					sourceScanId: 'sample-a1',
					createdByCharacterId: 'char-1',
					createdAt: '2026-04-28T00:00:00.000Z',
					updatedAt: '2026-04-28T00:00:00.000Z',
					location: { positionKm: { x: 1, y: 2, z: 3 } },
					kinematics: {
						velocityKmPerSec: { x: 1, y: 2, z: 3 },
						angularVelocityRadPerSec: { x: 0.1, y: 0.2, z: 0.3 },
						estimatedMassKg: 10,
						estimatedDiameterM: 20,
					},
					composition: { material: 'Silicate', rarity: 'Common', textureColor: '#9ca8b8' },
					distanceKm: 12,
					state: 'active',
				},
				{
					id: 'cb-destroyed',
					catalogId: 'cat-2',
					solarSystemId: 'sol',
					sourceScanId: 'sample-a2',
					createdByCharacterId: 'char-1',
					createdAt: '2026-04-28T00:00:00.000Z',
					updatedAt: '2026-04-28T00:00:00.000Z',
					location: { positionKm: { x: 4, y: 5, z: 6 } },
					kinematics: {
						velocityKmPerSec: { x: 1, y: 1, z: 1 },
						angularVelocityRadPerSec: { x: 0.1, y: 0.1, z: 0.1 },
						estimatedMassKg: 30,
						estimatedDiameterM: 40,
					},
					composition: { material: 'Iron', rarity: 'Rare', textureColor: '#8f99a7' },
					distanceKm: 18,
					state: 'destroyed',
				},
			],
			launchSeedHint: 99,
		});

		const restored = samples.find((sample) => sample.id === 'sample-a1');
		const destroyed = samples.find((sample) => sample.serverCelestialBodyId === 'cb-destroyed');

		expect(restored?.serverCelestialBodyId).toBe('cb-1');
		expect(restored?.scanned).toBe(true);
		expect(restored?.revealedMaterial).toEqual({
			material: 'Silicate',
			rarity: 'Common',
			textureColor: '#9ca8b8',
		});
		expect(destroyed).toBeUndefined();
	});

	it('should remove the matching asteroid samples when the target is destroyed', () => {
		const resolution = FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveLaunchItemResponse({
			response: {
				success: true,
				message: 'Target destroyed',
				playerName: 'Pioneer',
				characterId: 'char-1',
				shipId: 'ship-1',
				targetCelestialBodyId: 'cb-1',
				hotkey: 1,
				itemId: 'item-1',
				itemType: 'expendable-dart-drone',
				resolution: {
					outcome: 'target-destroyed',
					targetDestroyed: true,
					yieldedMaterials: [],
					yieldedItems: [],
					launchSeed: 42,
				},
			},
			asteroidSamples: [
				{
					id: 'sample-a1',
					serverCelestialBodyId: 'cb-1',
					position: [0, 0, 0],
					basePosition: [0, 0, 0],
					scanProgress: 100,
					scanned: true,
					revealedMaterial: null,
					revealedKinematics: null,
					capturedKinematics: {
						velocityKmPerSec: { x: 0, y: 0, z: 0 },
						angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
						estimatedMassKg: 1,
						estimatedDiameterM: 1,
					},
					solarSystemLocation: { positionKm: { x: 0, y: 0, z: 0 } },
					clusterCenterKm: { x: 0, y: 0, z: 0 },
					motionPhase: 0,
					motionRate: 0,
					motionRadius: 0,
					bobAmplitude: 0,
				},
				{
					id: 'sample-a2',
					serverCelestialBodyId: 'cb-2',
					position: [1, 1, 1],
					basePosition: [1, 1, 1],
					scanProgress: 100,
					scanned: true,
					revealedMaterial: null,
					revealedKinematics: null,
					capturedKinematics: {
						velocityKmPerSec: { x: 0, y: 0, z: 0 },
						angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
						estimatedMassKg: 1,
						estimatedDiameterM: 1,
					},
					solarSystemLocation: { positionKm: { x: 0, y: 0, z: 0 } },
					clusterCenterKm: { x: 0, y: 0, z: 0 },
					motionPhase: 0,
					motionRate: 0,
					motionRadius: 0,
					bobAmplitude: 0,
				},
			],
		});

		expect(resolution.removeAsteroidSampleIds).toEqual(['sample-a1']);
		expect(resolution.shouldRefreshAfterLaunch).toBe(true);
	});

	it('should keep asteroid samples intact and skip refresh for failed launches', () => {
		const resolution = FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveLaunchItemResponse({
			response: {
				success: false,
				message: 'Launch failed',
				playerName: 'Pioneer',
				characterId: 'char-1',
				shipId: 'ship-1',
				targetCelestialBodyId: 'cb-1',
				hotkey: 1,
				itemId: 'item-1',
				itemType: 'expendable-dart-drone',
			},
			asteroidSamples: [],
		});

		expect(resolution.removeAsteroidSampleIds).toEqual([]);
		expect(resolution.shouldRefreshAfterLaunch).toBe(false);
	});
});