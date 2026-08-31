import { TestBed } from '@angular/core/testing';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { AsteroidPersistenceService } from './asteroid-persistence.service';
import type { ShipSceneAsteroidSample } from './ship-scene-types';

describe('AsteroidPersistenceService', () => {
  let service: AsteroidPersistenceService;
  let socketService: { upsertCelestialBody: ReturnType<typeof vi.fn> };
  let sessionService: {
    getSessionKey: ReturnType<typeof vi.fn>;
    getPlayerName: ReturnType<typeof vi.fn>;
    activeCharacter: ReturnType<typeof vi.fn>;
  };

  const baseSample: ShipSceneAsteroidSample = {
    id: 'sample-a1',
    serverCelestialBodyId: null,
    scanned: false,
    scanProgress: 33,
    revealedMaterial: { material: 'Iron', rarity: 'Common' },
    revealedKinematics: {
      velocityKmPerSec: { x: 0.1, y: 0.2, z: 0.3 },
      angularVelocityRadPerSec: { x: 0.01, y: 0.02, z: 0.03 },
      estimatedMassKg: 12_345,
      estimatedDiameterM: 16,
    },
    solarSystemLocation: {
      positionKm: { x: 1, y: 2, z: 3 },
    },
    clusterCenterKm: { x: 0, y: 0, z: 0 },
  };

  beforeEach(() => {
    socketService = {
      upsertCelestialBody: vi.fn(),
    };
    sessionService = {
      getSessionKey: vi.fn(() => 'session-123'),
      getPlayerName: vi.fn(() => 'PilotOne'),
      activeCharacter: vi.fn(() => ({ id: 'char-42' })),
    };

    TestBed.configureTestingModule({
      providers: [
        AsteroidPersistenceService,
        { provide: SocketService, useValue: socketService },
        { provide: SessionService, useValue: sessionService },
      ],
    });

    service = TestBed.inject(AsteroidPersistenceService);
  });

  it('builds a deterministic celestial-body id', () => {
    expect(service.buildCelestialBodyId('char-42', 'sample-a1')).toBe(
      `cb-char-42-${FIRST_TARGET_MISSION_ID}-sample-a1`,
    );
  });

  it('skips persistence when identity data is missing', () => {
    sessionService.getSessionKey.mockReturnValue('');
    sessionService.getPlayerName.mockReturnValue('');
    sessionService.activeCharacter.mockReturnValue({ id: 'unknown-character' });

    service.persistScanComplete({ ...baseSample, serverCelestialBodyId: null });

    expect(socketService.upsertCelestialBody).not.toHaveBeenCalled();
  });

  it('short-circuits when a server celestial-body id already exists', () => {
    const context = {
      getAsteroidSamples: () => [{ ...baseSample, serverCelestialBodyId: null }],
      setAsteroidSamples: vi.fn(),
    };
    const onResolved = vi.fn();

    service.ensureLaunchTargetCelestialBodyId({
      sample: { ...baseSample, serverCelestialBodyId: 'cb-existing-target' },
      context,
      onResolved,
    });

    expect(onResolved).toHaveBeenCalledWith('cb-existing-target');
    expect(socketService.upsertCelestialBody).not.toHaveBeenCalled();
    expect(context.setAsteroidSamples).not.toHaveBeenCalled();
  });

  it('keeps the fallback position hash stable for a given sample id', () => {
    const basePosition = { x: 12.5, y: -8, z: 4 };

    const first = service.resolveFallbackTargetPositionKm('sample-a1', basePosition);
    const second = service.resolveFallbackTargetPositionKm('sample-a1', basePosition);

    expect(first).toEqual(second);
    expect(first).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    });
  });

  it('persists a completed asteroid scan when identity is present', () => {
    service.persistScanComplete({
      ...baseSample,
      serverCelestialBodyId: null,
      scanned: true,
      revealedMaterial: { material: 'Iron', rarity: 'Common' },
    });

    expect(socketService.upsertCelestialBody).toHaveBeenCalledTimes(1);
    const request = socketService.upsertCelestialBody.mock.calls[0][0];
    expect(request.celestialBody.id).toBe(`cb-char-42-${FIRST_TARGET_MISSION_ID}-sample-a1`);
    expect(request.celestialBody.observability.scanState).toBe('scanned');
    expect(request.celestialBody.state).toBe('active');
  });
});
