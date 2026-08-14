import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import { ShipExteriorBootstrapController } from './ship-exterior-bootstrap-controller';

function makeControllerHarness(overrides?: {
  playerName?: string;
  characterId?: string | null;
  sessionKey?: string | null;
  launchSeedHint?: number | null;
  preferredShipId?: string | null;
}) {
  const emitColdBootAsteroidSeedIntent = vi.fn();
  const updateTargetingCapabilityFromShipList = vi.fn();

  const unsubscribeShipListResponse = vi.fn();
  const unsubscribeCelestialBodyListResponse = vi.fn();

  const socketService = {
    listShipsByOwner: vi.fn().mockReturnValue(unsubscribeShipListResponse),
    listCelestialBodies: vi.fn().mockReturnValue(unsubscribeCelestialBodyListResponse),
  } as any;

  const deps = {
    missionId: 'first-target',
    sessionService: {
      getSessionKey: () => (overrides?.sessionKey === undefined ? 'session-key' : overrides.sessionKey),
    } as any,
    socketService,
    getPlayerName: () => (overrides?.playerName === undefined ? 'Pioneer' : overrides.playerName),
    getCharacterId: () => (overrides?.characterId === undefined ? 'char-1' : overrides.characterId),
    getPreferredShipId: () => (overrides?.preferredShipId === undefined ? null : overrides.preferredShipId),
    getLaunchSeedHint: () => (overrides?.launchSeedHint === undefined ? 17 : overrides.launchSeedHint),
    updateTargetingCapabilityFromShipList,
    emitColdBootAsteroidSeedIntent,
  } as any;

  const controller = new ShipExteriorBootstrapController(deps);

  return {
    controller,
    deps,
    socketService,
    emitColdBootAsteroidSeedIntent,
    updateTargetingCapabilityFromShipList,
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
    harness.socketService.listShipsByOwner.mockImplementation((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships: [{ id: 'starter-1', spatial: null }] });
      return harness.unsubscribeShipListResponse;
    });
    harness.controller.seedAsteroidsForInProgressMission();
    expect(harness.updateTargetingCapabilityFromShipList).toHaveBeenCalled();
    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({ kind: 'fallback' });
    expect(harness.socketService.listCelestialBodies).not.toHaveBeenCalled();
  });

  it('hydrates resumed samples from celestial bodies for in-progress mission', () => {
    const harness = makeControllerHarness({ launchSeedHint: 42 });
    const center = { x: 10, y: 20, z: 30 };
    const existingBodies = [{ id: 'cb-1', state: 'active' }, { id: 'cb-2', state: 'destroyed' }];

    harness.socketService.listShipsByOwner.mockImplementation((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships: [{ id: 'starter-1', spatial: { positionKm: center } }] });
      return harness.unsubscribeShipListResponse;
    });
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
    harness.socketService.listShipsByOwner.mockImplementation((_request: unknown, callback: (response: any) => void) => {
      callback({ success: false, message: 'ship-list failed' });
      return harness.unsubscribeShipListResponse;
    });

    harness.controller.seedAsteroidsAroundStarterShip();

    expect(harness.emitColdBootAsteroidSeedIntent).toHaveBeenCalledWith({ kind: 'fallback' });
  });

  it('seeds new samples around starter ship center when ship lookup succeeds', () => {
    const harness = makeControllerHarness({ launchSeedHint: 99 });
    const center = { x: 400, y: 500, z: 600 };
    const ships = [{ id: 'starter-ship', spatial: { positionKm: center } }];

    harness.socketService.listShipsByOwner.mockImplementation((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships });
      return harness.unsubscribeShipListResponse;
    });

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
    harness.socketService.listShipsByOwner.mockImplementation((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships: [{ id: 'starter-1', spatial: { positionKm: { x: 1, y: 2, z: 3 } } }] });
      return harness.unsubscribeShipListResponse;
    });
    harness.socketService.listCelestialBodies.mockImplementation((_request: unknown, _callback: (response: any) => void) =>
      harness.unsubscribeCelestialBodyListResponse,
    );

    harness.controller.seedAsteroidsForInProgressMission();
    harness.controller.dispose();

    expect(harness.unsubscribeShipListResponse).toHaveBeenCalled();
    expect(harness.unsubscribeCelestialBodyListResponse).toHaveBeenCalled();
  });
});
