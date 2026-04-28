import { ShipExteriorAsteroidStateService } from './ship-exterior-asteroid-state.service';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';

describe('ShipExteriorAsteroidStateService', () => {
	let service: ShipExteriorAsteroidStateService;

	const context = {
		missionId: 'first-target',
		playerName: 'Pioneer',
		characterId: 'char-1',
	};

	beforeEach(() => {
		sessionStorage.clear();
		service = new ShipExteriorAsteroidStateService();
	});

	it('should return null when no samples are stored', () => {
		expect(service.loadSamples(context)).toBeNull();
	});

	it('should save and restore asteroid samples', () => {
		const samples: AsteroidScanSample[] = [
			{
				id: 'sample-a1',
				serverCelestialBodyId: null,
				position: [1, 2, 3],
				basePosition: [1, 2, 3],
				scanProgress: 40,
				scanned: false,
				revealedMaterial: null,
				revealedKinematics: null,
				solarSystemLocation: { positionKm: { x: 100, y: 200, z: 300 } },
				clusterCenterKm: { x: 100, y: 200, z: 300 },
				capturedKinematics: {
					velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
					angularVelocityRadPerSec: { x: 0.01, y: 0.02, z: 0.03 },
					estimatedMassKg: 1_000_000,
					estimatedDiameterM: 120,
				},
				motionPhase: 0.5,
				motionRate: 0.3,
				motionRadius: 0.8,
				bobAmplitude: 0.1,
			},
		];

		service.saveSamples(context, samples);

		const restored = service.loadSamples(context);
		expect(restored).toEqual(samples);
	});

	it('should clear previously saved samples', () => {
		service.saveSamples(context, []);
		expect(service.loadSamples(context)).toEqual([]);

		service.clearSamples(context);
		expect(service.loadSamples(context)).toBeNull();
	});

	it('should isolate state by mission/player/character context', () => {
		service.saveSamples(context, []);

		expect(
			service.loadSamples({
				missionId: 'first-target',
				playerName: 'OtherPilot',
				characterId: 'char-1',
			}),
		).toBeNull();
	});
});
