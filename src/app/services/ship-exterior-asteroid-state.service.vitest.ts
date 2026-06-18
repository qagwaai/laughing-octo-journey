import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import { ShipExteriorAsteroidStateService } from './ship-exterior-asteroid-state.service';

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

  it('should isolate state by celestial body when provided and ignore ship identity', () => {
    const bodyScopedContext = {
      ...context,
      celestialBodyId: 'cb-1',
    };
    const samples: AsteroidScanSample[] = [
      {
        id: 'sample-body-1',
        serverCelestialBodyId: null,
        position: [1, 2, 3],
        basePosition: [1, 2, 3],
        scanProgress: 10,
        scanned: false,
        revealedMaterial: null,
        revealedKinematics: null,
        solarSystemLocation: { positionKm: { x: 1, y: 2, z: 3 } },
        clusterCenterKm: { x: 1, y: 2, z: 3 },
        capturedKinematics: {
          velocityKmPerSec: { x: 0, y: 0, z: 0 },
          angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
          estimatedMassKg: 1_000,
          estimatedDiameterM: 10,
        },
        motionPhase: 0,
        motionRate: 0.1,
        motionRadius: 0.2,
        bobAmplitude: 0.03,
      },
    ];

    service.saveSamples(bodyScopedContext, samples);

    expect(
      service.loadSamples({
        ...context,
        celestialBodyId: 'cb-2',
      }),
    ).toBeNull();
    expect(
      service.loadSamples({
        ...context,
        celestialBodyId: 'cb-1',
      }),
    ).toEqual(samples);
  });

  it('should save and restore targeted asteroid sample id', () => {
    service.saveTargetedSampleId(context, 'sample-a1');

    expect(service.loadTargetedSampleId(context)).toBe('sample-a1');
  });

  it('should clear targeted asteroid sample id when null is saved', () => {
    service.saveTargetedSampleId(context, 'sample-a1');
    expect(service.loadTargetedSampleId(context)).toBe('sample-a1');

    service.saveTargetedSampleId(context, null);
    expect(service.loadTargetedSampleId(context)).toBeNull();
  });

  it('should clear targeted asteroid sample id explicitly', () => {
    service.saveTargetedSampleId(context, 'sample-a1');
    service.clearTargetedSampleId(context);

    expect(service.loadTargetedSampleId(context)).toBeNull();
  });

  it('should isolate targeted asteroid id by mission/player/character context', () => {
    service.saveTargetedSampleId(context, 'sample-a1');

    expect(
      service.loadTargetedSampleId({
        missionId: 'first-target',
        playerName: 'OtherPilot',
        characterId: 'char-1',
      }),
    ).toBeNull();
  });
});
