import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import { ShipExteriorBootstrapController } from './ship-exterior-bootstrap-controller';

function makeControllerHarness(overrides?: {
  playerName?: string;
  characterId?: string | null;
  sessionKey?: string | null;
  launchSeedHint?: number | null;
  preferredShipId?: string | null;
  activeShip?: unknown;
  detectionRangeKm?: number;
}) {
  const emitColdBootAsteroidSeedIntent = vi.fn();
  const updateTargetingCapabilityFromShipList = vi.fn();
  const emitLocalCelestialBodies = vi.fn();

  const unsubscribeShipListResponse = vi.fn();
  const unsubscribeCelestialBodyListResponse = vi.fn();

  const socketService = {
    listShipsByOwner: vi.fn().mockReturnValue(unsubscribeShipListResponse),
    listCelestialBodies: vi.fn().mockReturnValue(unsubscribeCelestialBodyListResponse),
  } as any;

  const activeShip =
    overrides?.activeShip === undefined
      ? { id: 'ship-1', spatial: { solarSystemId: 'sol', positionKm: { x: 100, y: 0, z: 0 } } }
      : overrides.activeShip;

  const deps = {
    missionId: 'first-target',
    sessionService: {
      getSessionKey: () => (overrides?.sessionKey === undefined ? 'session-key' : overrides.sessionKey),
      activeShip: () => activeShip,
    } as any,
    socketService,
    getPlayerName: () => (overrides?.playerName === undefined ? 'Pioneer' : overrides.playerName),
    getCharacterId: () => (overrides?.characterId === undefined ? 'char-1' : overrides.characterId),
    getPreferredShipId: () => (overrides?.preferredShipId === undefined ? null : overrides.preferredShipId),
    getLaunchSeedHint: () => (overrides?.launchSeedHint === undefined ? 17 : overrides.launchSeedHint),
    updateTargetingCapabilityFromShipList,
    emitColdBootAsteroidSeedIntent,
    getDetectionRangeKm: () => overrides?.detectionRangeKm ?? 100,
    emitLocalCelestialBodies,
  } as any;

  const controller = new ShipExteriorBootstrapController(deps);

  return {
    controller,
    deps,
    socketService,
    emitColdBootAsteroidSeedIntent,
    updateTargetingCapabilityFromShipList,
    emitLocalCelestialBodies,
    unsubscribeShipListResponse,
    unsubscribeCelestialBodyListResponse,
  };
}

describe('ShipExteriorBootstrapController', () => {
  it('uses fallback samples for in-progress mission when identity/session context is missing', () => {
    const harness = makeControllerHarness({ playerName: '  ', characterId: null, sessionKey: null });

    harness.controller.seedAsteroidsForInProgressMission();

    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({ kind: 'fallback' });
    expect(harness.socketService.listShipsByOwner).not.toHaveBeenCalled();
  });

  it('falls back when in-progress mission ship list has no usable center', () => {
    const harness = makeControllerHarness();
    harness.socketService.listShipsByOwner.mockImplementation(
      (_request: unknown, callback: (response: any) => void) => {
        callback({ success: true, ships: [{ id: 'starter-1', spatial: null }] });
        return harness.unsubscribeShipListResponse;
      },
    );
    harness.controller.seedAsteroidsForInProgressMission();
    expect(harness.updateTargetingCapabilityFromShipList).toHaveBeenCalled();
    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({ kind: 'fallback' });
    expect(harness.socketService.listCelestialBodies).not.toHaveBeenCalled();
  });

  it('hydrates resumed samples from celestial bodies for in-progress mission', () => {
    const harness = makeControllerHarness({ launchSeedHint: 42 });
    const center = { x: 10, y: 20, z: 30 };
    const existingBodies = [
      { id: 'cb-1', state: 'active' },
      { id: 'cb-2', state: 'destroyed' },
    ];

    harness.socketService.listShipsByOwner.mockImplementation(
      (_request: unknown, callback: (response: any) => void) => {
        callback({ success: true, ships: [{ id: 'starter-1', spatial: { positionKm: center } }] });
        return harness.unsubscribeShipListResponse;
      },
    );
    harness.socketService.listCelestialBodies.mockImplementation((request: any, callback: (response: any) => void) => {
      expect(request.solarSystemId).toBe(DEFAULT_SOLAR_SYSTEM_ID);
      expect(request.distanceKm).toBe(DEFAULT_CLUSTER_SPREAD_KM * 2);
      expect(request.missionId).toBe('first-target');
      expect(request.positionKm).toEqual(center);
      callback({ success: true, celestialBodies: existingBodies });
      return harness.unsubscribeCelestialBodyListResponse;
    });

    harness.controller.seedAsteroidsForInProgressMission();

    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({
      kind: 'resume',
      actor: {
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-key',
      },
      context: expect.objectContaining({
        playerName: 'Pioneer',
        characterId: 'char-1',
        center,
        launchSeedHint: 42,
        existingBodies,
      }),
    });
  });

  it('uses fallback samples when starter-ship list request fails', () => {
    const harness = makeControllerHarness();
    harness.socketService.listShipsByOwner.mockImplementation(
      (_request: unknown, callback: (response: any) => void) => {
        callback({ success: false, message: 'ship-list failed' });
        return harness.unsubscribeShipListResponse;
      },
    );

    harness.controller.seedAsteroidsAroundStarterShip();

    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({ kind: 'fallback' });
  });

  it('seeds new samples around starter ship center when ship lookup succeeds', () => {
    const harness = makeControllerHarness({ launchSeedHint: 99 });
    const center = { x: 400, y: 500, z: 600 };
    const ships = [{ id: 'starter-ship', spatial: { positionKm: center } }];

    harness.socketService.listShipsByOwner.mockImplementation(
      (_request: unknown, callback: (response: any) => void) => {
        callback({ success: true, ships });
        return harness.unsubscribeShipListResponse;
      },
    );

    harness.controller.seedAsteroidsAroundStarterShip();

    expect(harness.updateTargetingCapabilityFromShipList).toHaveBeenCalledWith(ships);
    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({
      kind: 'starter-ship',
      actor: {
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-key',
      },
      context: expect.objectContaining({
        playerName: 'Pioneer',
        characterId: 'char-1',
        center,
        launchSeedHint: 99,
      }),
    });
  });

  it('unsubscribes ship and celestial-body listeners on dispose', () => {
    const harness = makeControllerHarness();
    harness.socketService.listShipsByOwner.mockImplementation(
      (_request: unknown, callback: (response: any) => void) => {
        callback({ success: true, ships: [{ id: 'starter-1', spatial: { positionKm: { x: 1, y: 2, z: 3 } } }] });
        return harness.unsubscribeShipListResponse;
      },
    );
    harness.socketService.listCelestialBodies.mockImplementation(
      (_request: unknown, _callback: (response: any) => void) => harness.unsubscribeCelestialBodyListResponse,
    );

    harness.controller.seedAsteroidsForInProgressMission();
    harness.controller.dispose();

    expect(harness.unsubscribeShipListResponse).toHaveBeenCalled();
    expect(harness.unsubscribeCelestialBodyListResponse).toHaveBeenCalled();
  });

  describe('loadLocalCelestialBodies', () => {
    it('queries without mission or owner filters using the sensor detection range', () => {
      const harness = makeControllerHarness({ detectionRangeKm: 750 });

      harness.controller.loadLocalCelestialBodies();

      const request = harness.socketService.listCelestialBodies.mock.calls[0][0];
      expect(request.distanceKm).toBe(750);
      expect(request.positionKm).toEqual({ x: 100, y: 0, z: 0 });
      expect(request).not.toHaveProperty('missionId');
      expect(request).not.toHaveProperty('createdByCharacterId');
    });

    // Two sweeps in flight each attach their own correlated listener, and every listener
    // drops the other's response as unmatched - which surfaced a contract variance warning
    // when bootstrap and the active-ship effect both fired during a join.
    it('coalesces an identical sweep that is still in flight', () => {
      const harness = makeControllerHarness();
      harness.socketService.listCelestialBodies.mockImplementation(
        () => harness.unsubscribeCelestialBodyListResponse,
      );

      harness.controller.loadLocalCelestialBodies();
      harness.controller.loadLocalCelestialBodies();

      expect(harness.socketService.listCelestialBodies).toHaveBeenCalledTimes(1);
    });

    it('leaves the in-flight listener subscribed when a duplicate sweep is coalesced', () => {
      const harness = makeControllerHarness();
      let deliverResponse: ((response: any) => void) | undefined;
      harness.socketService.listCelestialBodies.mockImplementation(
        (_request: unknown, callback: (response: any) => void) => {
          deliverResponse = callback;
          return harness.unsubscribeCelestialBodyListResponse;
        },
      );

      harness.controller.loadLocalCelestialBodies();
      harness.controller.loadLocalCelestialBodies();

      expect(harness.unsubscribeCelestialBodyListResponse).not.toHaveBeenCalled();

      deliverResponse?.({ success: true, celestialBodies: [{ id: 'a', state: 'unscanned' }] });

      expect(harness.emitLocalCelestialBodies).toHaveBeenCalledWith(expect.objectContaining({ status: 'loaded' }));
    });

    it('allows a new sweep once the in-flight request has resolved', () => {
      const harness = makeControllerHarness();
      harness.socketService.listCelestialBodies.mockImplementation(
        (_request: unknown, callback: (response: any) => void) => {
          callback({ success: true, celestialBodies: [] });
          return harness.unsubscribeCelestialBodyListResponse;
        },
      );

      harness.controller.loadLocalCelestialBodies();
      harness.controller.loadLocalCelestialBodies();

      expect(harness.socketService.listCelestialBodies).toHaveBeenCalledTimes(2);
    });

    it('issues a fresh sweep when the ship position changes', () => {
      const harness = makeControllerHarness();
      harness.socketService.listCelestialBodies.mockImplementation(
        () => harness.unsubscribeCelestialBodyListResponse,
      );

      harness.controller.loadLocalCelestialBodies();
      harness.controller.loadLocalCelestialBodies({ x: 900, y: 0, z: 0 });

      expect(harness.socketService.listCelestialBodies).toHaveBeenCalledTimes(2);
    });

    it('reports loaded contacts and filters destroyed bodies', () => {
      const harness = makeControllerHarness();
      harness.socketService.listCelestialBodies.mockImplementation(
        (_request: unknown, callback: (response: any) => void) => {
          callback({
            success: true,
            celestialBodies: [{ id: 'a', state: 'unscanned' }, { id: 'b', state: 'destroyed' }],
          });
          return harness.unsubscribeCelestialBodyListResponse;
        },
      );

      harness.controller.loadLocalCelestialBodies();

      const result = harness.emitLocalCelestialBodies.mock.calls[0][0];
      expect(result.status).toBe('loaded');
      expect(result.bodies.map((body: any) => body.id)).toEqual(['a']);
    });

    it('reports an empty sweep without fabricating contacts', () => {
      const harness = makeControllerHarness();
      harness.socketService.listCelestialBodies.mockImplementation(
        (_request: unknown, callback: (response: any) => void) => {
          callback({ success: true, celestialBodies: [] });
          return harness.unsubscribeCelestialBodyListResponse;
        },
      );

      harness.controller.loadLocalCelestialBodies();

      expect(harness.emitLocalCelestialBodies).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'empty', bodies: [] }),
      );
    });

    it('reports unavailable when the ship has no known position', () => {
      const harness = makeControllerHarness({ activeShip: null });

      harness.controller.loadLocalCelestialBodies();

      expect(harness.socketService.listCelestialBodies).not.toHaveBeenCalled();
      expect(harness.emitLocalCelestialBodies).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unavailable', bodies: [] }),
      );
    });

    it('reports unavailable when the backend sweep fails', () => {
      const harness = makeControllerHarness();
      harness.socketService.listCelestialBodies.mockImplementation(
        (_request: unknown, callback: (response: any) => void) => {
          callback({ success: false, message: 'boom' });
          return harness.unsubscribeCelestialBodyListResponse;
        },
      );

      harness.controller.loadLocalCelestialBodies();

      expect(harness.emitLocalCelestialBodies).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unavailable', bodies: [] }),
      );
    });
  });
});
