import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import { ShipExteriorBootstrapController } from './ship-exterior-bootstrap-controller';

type Sample = { id: string; scanned: boolean; scanProgress: number };

function makeSamples(prefix: string): Sample[] {
  return [
    { id: `${prefix}-1`, scanned: false, scanProgress: 0 },
    { id: `${prefix}-2`, scanned: false, scanProgress: 0 },
  ];
}

function makeControllerHarness(overrides?: {
  playerName?: string;
  characterId?: string | null;
  sessionKey?: string | null;
  launchSeedHint?: number | null;
}) {
  const fallbackSamples = makeSamples('fallback');
  const resumedSamples = makeSamples('resumed');
  const newSamples = makeSamples('new');

  const createFallbackSamples = jasmine.createSpy('createFallbackSamples').and.returnValue(fallbackSamples);
  const createResumedSamples = jasmine.createSpy('createResumedSamples').and.returnValue(resumedSamples);
  const createNewSamples = jasmine.createSpy('createNewSamples').and.returnValue(newSamples);
  const setAsteroidSamples = jasmine.createSpy('setAsteroidSamples');
  const persistSeededAsteroidsAsUnscanned = jasmine.createSpy('persistSeededAsteroidsAsUnscanned');
  const updateTargetingCapabilityFromShipList = jasmine.createSpy('updateTargetingCapabilityFromShipList');

  const unsubscribeShipListResponse = jasmine.createSpy('unsubscribeShipListResponse');
  const unsubscribeCelestialBodyListResponse = jasmine.createSpy('unsubscribeCelestialBodyListResponse');

  const socketService = {
    listShipsByOwner: jasmine.createSpy('listShipsByOwner').and.returnValue(unsubscribeShipListResponse),
    listCelestialBodies: jasmine
      .createSpy('listCelestialBodies')
      .and.returnValue(unsubscribeCelestialBodyListResponse),
  } as any;

  const deps = {
    missionId: 'first-target',
    sessionService: {
      getSessionKey: () => (overrides?.sessionKey === undefined ? 'session-key' : overrides.sessionKey),
    } as any,
    socketService,
    getPlayerName: () => (overrides?.playerName === undefined ? 'Pioneer' : overrides.playerName),
    getCharacterId: () => (overrides?.characterId === undefined ? 'char-1' : overrides.characterId),
    getLaunchSeedHint: () => (overrides?.launchSeedHint === undefined ? 17 : overrides.launchSeedHint),
    missionScenePlugin: {
      seedPolicy: {
        createFallbackSamples,
        createResumedSamples,
        createNewSamples,
      },
    } as any,
    setAsteroidSamples,
    persistSeededAsteroidsAsUnscanned,
    updateTargetingCapabilityFromShipList,
  } as any;

  const controller = new ShipExteriorBootstrapController(deps);

  return {
    controller,
    deps,
    socketService,
    createFallbackSamples,
    createResumedSamples,
    createNewSamples,
    setAsteroidSamples,
    persistSeededAsteroidsAsUnscanned,
    updateTargetingCapabilityFromShipList,
    unsubscribeShipListResponse,
    unsubscribeCelestialBodyListResponse,
    fallbackSamples,
    resumedSamples,
    newSamples,
  };
}

describe('ShipExteriorBootstrapController', () => {
  it('uses fallback samples for in-progress mission when identity/session context is missing', () => {
    const harness = makeControllerHarness({ playerName: '  ', characterId: null, sessionKey: null });

    harness.controller.seedAsteroidsForInProgressMission();

    expect(harness.createFallbackSamples).toHaveBeenCalled();
    expect(harness.setAsteroidSamples).toHaveBeenCalledWith(harness.fallbackSamples);
    expect(harness.socketService.listShipsByOwner).not.toHaveBeenCalled();
  });

  it('falls back when in-progress mission ship list has no usable center', () => {
    const harness = makeControllerHarness();
    harness.socketService.listShipsByOwner.and.callFake((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships: [{ id: 'starter-1', spatial: null }] });
      return harness.unsubscribeShipListResponse;
    });

    harness.controller.seedAsteroidsForInProgressMission();

    expect(harness.updateTargetingCapabilityFromShipList).toHaveBeenCalled();
    expect(harness.createFallbackSamples).toHaveBeenCalled();
    expect(harness.setAsteroidSamples).toHaveBeenCalledWith(harness.fallbackSamples);
    expect(harness.socketService.listCelestialBodies).not.toHaveBeenCalled();
  });

  it('hydrates resumed samples from celestial bodies for in-progress mission', () => {
    const harness = makeControllerHarness({ launchSeedHint: 42 });
    const center = { x: 10, y: 20, z: 30 };
    const existingBodies = [{ id: 'cb-1', state: 'active' }, { id: 'cb-2', state: 'destroyed' }];

    harness.socketService.listShipsByOwner.and.callFake((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships: [{ id: 'starter-1', spatial: { positionKm: center } }] });
      return harness.unsubscribeShipListResponse;
    });
    harness.socketService.listCelestialBodies.and.callFake((request: any, callback: (response: any) => void) => {
      expect(request.solarSystemId).toBe(DEFAULT_SOLAR_SYSTEM_ID);
      expect(request.distanceKm).toBe(DEFAULT_CLUSTER_SPREAD_KM * 2);
      expect(request.missionId).toBe('first-target');
      expect(request.positionKm).toEqual(center);
      callback({ success: true, celestialBodies: existingBodies });
      return harness.unsubscribeCelestialBodyListResponse;
    });

    harness.controller.seedAsteroidsForInProgressMission();

    expect(harness.createResumedSamples).toHaveBeenCalledWith(
      jasmine.objectContaining({
        playerName: 'Pioneer',
        characterId: 'char-1',
        center,
        launchSeedHint: 42,
        existingBodies,
      }),
    );
    expect(harness.setAsteroidSamples).toHaveBeenCalledWith(harness.resumedSamples);
    expect(harness.persistSeededAsteroidsAsUnscanned).toHaveBeenCalledWith(harness.resumedSamples);
  });

  it('uses fallback samples when starter-ship list request fails', () => {
    const harness = makeControllerHarness();
    harness.socketService.listShipsByOwner.and.callFake((_request: unknown, callback: (response: any) => void) => {
      callback({ success: false, message: 'ship-list failed' });
      return harness.unsubscribeShipListResponse;
    });

    harness.controller.seedAsteroidsAroundStarterShip();

    expect(harness.createFallbackSamples).toHaveBeenCalled();
    expect(harness.setAsteroidSamples).toHaveBeenCalledWith(harness.fallbackSamples);
    expect(harness.persistSeededAsteroidsAsUnscanned).not.toHaveBeenCalled();
  });

  it('seeds new samples around starter ship center when ship lookup succeeds', () => {
    const harness = makeControllerHarness({ launchSeedHint: 99 });
    const center = { x: 400, y: 500, z: 600 };
    const ships = [{ id: 'starter-ship', spatial: { positionKm: center } }];

    harness.socketService.listShipsByOwner.and.callFake((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships });
      return harness.unsubscribeShipListResponse;
    });

    harness.controller.seedAsteroidsAroundStarterShip();

    expect(harness.updateTargetingCapabilityFromShipList).toHaveBeenCalledWith(ships);
    expect(harness.createNewSamples).toHaveBeenCalledWith(
      jasmine.objectContaining({
        playerName: 'Pioneer',
        characterId: 'char-1',
        center,
        launchSeedHint: 99,
      }),
    );
    expect(harness.setAsteroidSamples).toHaveBeenCalledWith(harness.newSamples);
    expect(harness.persistSeededAsteroidsAsUnscanned).toHaveBeenCalledWith(harness.newSamples);
  });

  it('unsubscribes ship and celestial-body listeners on dispose', () => {
    const harness = makeControllerHarness();
    harness.socketService.listShipsByOwner.and.callFake((_request: unknown, callback: (response: any) => void) => {
      callback({ success: true, ships: [{ id: 'starter-1', spatial: { positionKm: { x: 1, y: 2, z: 3 } } }] });
      return harness.unsubscribeShipListResponse;
    });
    harness.socketService.listCelestialBodies.and.callFake((_request: unknown, _callback: (response: any) => void) =>
      harness.unsubscribeCelestialBodyListResponse,
    );

    harness.controller.seedAsteroidsForInProgressMission();
    harness.controller.dispose();

    expect(harness.unsubscribeShipListResponse).toHaveBeenCalled();
    expect(harness.unsubscribeCelestialBodyListResponse).toHaveBeenCalled();
  });
});
