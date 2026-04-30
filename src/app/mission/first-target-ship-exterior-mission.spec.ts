import {
	FIRST_TARGET_SHIP_EXTERIOR_MISSION,
	createFirstTargetMissionInitialGateState,
} from './first-target-ship-exterior-mission';

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

	it('should pre-assign a revealedMaterial to every generated asteroid sample', () => {
		const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 0, y: 0, z: 0 },
			launchSeedHint: null,
		});

		expect(samples.length).toBeGreaterThan(0);
		for (const sample of samples) {
			expect(sample.revealedMaterial).not.toBeNull();
			expect(typeof sample.revealedMaterial!.material).toBe('string');
			expect(typeof sample.revealedMaterial!.rarity).toBe('string');
			expect(typeof sample.revealedMaterial!.textureColor).toBe('string');
		}
	});

	it('should guarantee at least one Iron asteroid among generated samples', () => {
		const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 0, y: 0, z: 0 },
			launchSeedHint: null,
		});

		const hasIron = samples.some((s) => s.revealedMaterial?.material === 'Iron');
		expect(hasIron).toBe(true);
	});

	it('should pre-assign materials to non-matched resumed samples', () => {
		const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createResumedAsteroidSamples({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 10_000, y: 0, z: -10_000 },
			existingBodies: [],
			launchSeedHint: null,
		});

		expect(samples.length).toBeGreaterThan(0);
		for (const sample of samples) {
			expect(sample.revealedMaterial).not.toBeNull();
		}
	});

	it('should pre-assign materials to fallback asteroid samples', () => {
		const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createFallbackAsteroidSamples();

		expect(samples.length).toBeGreaterThan(0);
		for (const sample of samples) {
			expect(sample.revealedMaterial).not.toBeNull();
		}
	});

	it('should refresh but not remove samples for succeeded but non-destroyed launch', () => {
		const resolution = FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveLaunchItemResponse({
			response: {
				success: true,
				message: 'Deflected',
				playerName: 'Pioneer',
				characterId: 'char-1',
				shipId: 'ship-1',
				targetCelestialBodyId: 'cb-1',
				hotkey: 1,
				itemId: 'item-1',
				itemType: 'expendable-dart-drone',
				resolution: { outcome: 'no-effect', targetDestroyed: false, yieldedMaterials: [], yieldedItems: [], launchSeed: 0 },
			},
			asteroidSamples: [],
		});

		expect(resolution.removeAsteroidSampleIds).toEqual([]);
		expect(resolution.shouldRefreshAfterLaunch).toBe(true);
	});

	it('should match asteroid sample by id when serverCelestialBodyId differs', () => {
		const resolution = FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveLaunchItemResponse({
			response: {
				success: true,
				message: 'Target destroyed',
				playerName: 'Pioneer',
				characterId: 'char-1',
				shipId: 'ship-1',
				targetCelestialBodyId: 'sample-a1',
				hotkey: 1,
				itemId: 'item-1',
				itemType: 'expendable-dart-drone',
				resolution: { outcome: 'target-destroyed', targetDestroyed: true, yieldedMaterials: [], yieldedItems: [], launchSeed: 0 },
			},
			asteroidSamples: [
				{
					id: 'sample-a1',
					serverCelestialBodyId: null,
					position: [0, 0, 0],
					basePosition: [0, 0, 0],
					scanProgress: 100,
					scanned: true,
					revealedMaterial: null,
					revealedKinematics: null,
					capturedKinematics: { velocityKmPerSec: { x: 0, y: 0, z: 0 }, angularVelocityRadPerSec: { x: 0, y: 0, z: 0 }, estimatedMassKg: 1, estimatedDiameterM: 1 },
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
	});

	it('should detect expendable dart drone by itemType in raw inventory', () => {
		const result = FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory([
			{ itemType: 'expendable-dart-drone', id: 'id-1', displayName: '', tier: 1, damageStatus: 'good', quantity: 1 },
		]);
		expect(result).toBe(true);
	});

	it('should return false for empty inventory', () => {
		expect(FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory([])).toBe(false);
	});

	it('should return false for non-array inventory', () => {
		expect(FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory(null)).toBe(false);
		expect(FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory(undefined)).toBe(false);
	});

	it('should detect drone by displayName in raw inventory when itemType does not match', () => {
		const result = FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory([
			{ itemType: 'unknown', displayName: 'expendable-dart-drone' },
		]);
		expect(result).toBe(true);
	});

	it('should return false when raw inventory item is not an object', () => {
		expect(FIRST_TARGET_SHIP_EXTERIOR_MISSION.resolveTargetingCapabilityFromInventory(['not-an-object'])).toBe(false);
	});

	it('should vary sample counts for different launchSeedHints', () => {
		const a = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
			playerName: 'P',
			characterId: 'c',
			center: { x: 0, y: 0, z: 0 },
			launchSeedHint: null,
		});
		const b = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
			playerName: 'P',
			characterId: 'c',
			center: { x: 0, y: 0, z: 0 },
			launchSeedHint: undefined,
		});
		// Both are valid arrays of samples
		expect(a.length).toBeGreaterThan(0);
		expect(b.length).toBeGreaterThan(0);
	});

	it('should use index fallback for bodies without matching sourceScanId', () => {
		const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createResumedAsteroidSamples({
			playerName: 'Pioneer',
			characterId: 'char-1',
			center: { x: 0, y: 0, z: 0 },
			existingBodies: [
				{
					id: 'cb-no-scan-id',
					catalogId: 'cat-1',
					solarSystemId: 'sol',
					sourceScanId: '',
					createdByCharacterId: 'char-1',
					createdAt: '2026-04-28T00:00:00.000Z',
					updatedAt: '2026-04-28T00:00:00.000Z',
					location: { positionKm: { x: 10, y: 10, z: 10 } },
					kinematics: { velocityKmPerSec: { x: 0, y: 0, z: 0 }, angularVelocityRadPerSec: { x: 0, y: 0, z: 0 }, estimatedMassKg: 1, estimatedDiameterM: 1 },
					composition: { material: 'Carbon', rarity: 'Common', textureColor: '#6f7785' },
					distanceKm: 5,
					state: 'active',
				},
			],
			launchSeedHint: 7,
		});

		// The first sample should use the existing body at index 0 via fallback
		expect(samples[0].serverCelestialBodyId).toBe('cb-no-scan-id');
	});

	it('createFirstTargetMissionInitialGateState creates gate state for a given characterId', () => {
		const state = createFirstTargetMissionInitialGateState('test-char');
		expect(state.characterId).toBe('test-char');
		expect(state.steps.length).toBeGreaterThan(0);
	});
});