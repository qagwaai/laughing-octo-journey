import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShipSummary } from '../model/ship-list';
import { SessionService } from './session.service';
import { ShipFlightPositionPersistenceService } from './ship-flight-position-persistence.service';
import { SocketService } from './socket.service';

describe('ShipFlightPositionPersistenceService', () => {
  const ship: ShipSummary = {
    id: 'ship-1',
    name: 'Test Ship',
    model: 'Scavenger Pod',
    tier: 1,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 10, y: 20, z: 30 },
      epochMs: 1,
    },
  };

  let service: ShipFlightPositionPersistenceService;
  let sessionService: {
    activeShip: ReturnType<typeof vi.fn>;
    getSessionKey: ReturnType<typeof vi.fn>;
    forceUpdateActiveShipSpatial: ReturnType<typeof vi.fn>;
  };
  let socketService: {
    upsertShip: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sessionService = {
      activeShip: vi.fn(() => ship),
      getSessionKey: vi.fn(() => 'session-1'),
      forceUpdateActiveShipSpatial: vi.fn(),
    };
    socketService = {
      upsertShip: vi.fn((_request, onResponse) => {
        onResponse({
          success: true,
          message: '',
          playerName: 'Pilot',
          characterId: 'char-1',
          correlationId: 'correlation-1',
          requestIdentity: {
            operation: 'ship-upsert',
            entityType: 'ship',
            containerId: 'ship-1',
          },
        });
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        ShipFlightPositionPersistenceService,
        { provide: SessionService, useValue: sessionService },
        { provide: SocketService, useValue: socketService },
      ],
    });
    service = TestBed.inject(ShipFlightPositionPersistenceService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists the first checkpoint immediately and updates local active-ship spatial', async () => {
    service.queuePosition({
      playerName: 'Pilot',
      characterId: 'char-1',
      shipId: 'ship-1',
      positionKm: { x: 11, y: 22, z: 33 },
    });
    await vi.runAllTimersAsync();

    expect(sessionService.forceUpdateActiveShipSpatial).toHaveBeenCalledWith(
      'ship-1',
      expect.objectContaining({ positionKm: { x: 11, y: 22, z: 33 } }),
    );
    expect(socketService.upsertShip).toHaveBeenCalledTimes(1);
    expect(socketService.upsertShip.mock.calls[0][0]).toMatchObject({
      correlationSource: 'ship-flight-position-persistence',
      ship: {
        id: 'ship-1',
        spatial: {
          positionKm: { x: 11, y: 22, z: 33 },
        },
      },
    });
  });

  it('coalesces movement checkpoints and sends at most once per two seconds while moving', async () => {
    service.queuePosition({
      playerName: 'Pilot',
      characterId: 'char-1',
      shipId: 'ship-1',
      positionKm: { x: 11, y: 20, z: 30 },
    });
    await vi.advanceTimersByTimeAsync(250);

    for (let x = 12; x <= 17; x += 1) {
      service.queuePosition({
        playerName: 'Pilot',
        characterId: 'char-1',
        shipId: 'ship-1',
        positionKm: { x, y: 20, z: 30 },
      });
      await vi.advanceTimersByTimeAsync(250);
    }

    expect(socketService.upsertShip).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(socketService.upsertShip).toHaveBeenCalledTimes(2);
    expect(socketService.upsertShip.mock.calls[1][0].ship.spatial.positionKm).toEqual({ x: 17, y: 20, z: 30 });
  });

  it('flushes the latest coalesced position when movement stops', async () => {
    service.queuePosition({
      playerName: 'Pilot',
      characterId: 'char-1',
      shipId: 'ship-1',
      positionKm: { x: 11, y: 20, z: 30 },
    });
    await vi.advanceTimersByTimeAsync(250);
    service.queuePosition({
      playerName: 'Pilot',
      characterId: 'char-1',
      shipId: 'ship-1',
      positionKm: { x: 12, y: 20, z: 30 },
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(socketService.upsertShip).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(socketService.upsertShip).toHaveBeenCalledTimes(2);
    expect(socketService.upsertShip.mock.calls[1][0].ship.spatial.positionKm).toEqual({ x: 12, y: 20, z: 30 });
  });

  it('retains a rejected update so an explicit flush can retry it', async () => {
    socketService.upsertShip.mockImplementationOnce((_request, onResponse) => {
      onResponse({
        success: false,
        message: 'save failed',
        playerName: 'Pilot',
        characterId: 'char-1',
        correlationId: 'correlation-1',
        requestIdentity: {
          operation: 'ship-upsert',
          entityType: 'ship',
          containerId: 'ship-1',
        },
      });
    });

    service.queuePosition({
      playerName: 'Pilot',
      characterId: 'char-1',
      shipId: 'ship-1',
      positionKm: { x: 11, y: 20, z: 30 },
    });
    await vi.runAllTimersAsync();

    await expect(service.flushPending()).resolves.toBeUndefined();
    expect(socketService.upsertShip).toHaveBeenCalledTimes(2);
  });
});
