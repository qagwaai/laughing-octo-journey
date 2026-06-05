import { FloatingDebrisStateService } from '../../services/floating-debris-state.service';
import type {
  ItemListByLocationRequest,
  ItemListByLocationResponse,
} from '../../model/item-list-by-location';
import type { ShipItem } from '../../model/ship-item';
import type { Triple } from '../../model/triple';
import { FloatingDebrisController, FLOATING_DEBRIS_POLL_INTERVAL_MS } from './floating-debris-controller';

interface CapturedRequest {
  request: ItemListByLocationRequest;
  onResponse: (response: ItemListByLocationResponse) => void;
  unsubscribe: jasmine.Spy;
}

function createDeps(overrides: Partial<{
  playerName: string;
  shipId: string | null;
  hasTractorBeamInInventory: boolean;
  sessionKey: string | null;
  positionKm: Triple | null;
  solarSystemId: string;
}> = {}) {
  const calls: CapturedRequest[] = [];
  const intervals: Array<{ handler: () => void; intervalMs: number; handle: number }> = [];
  let nextHandle = 1;
  const cleared: number[] = [];
  const stateService = new FloatingDebrisStateService();

  const socketService = {
    listNearbyDeployedItems: jasmine
      .createSpy('listNearbyDeployedItems')
      .and.callFake(
        (request: ItemListByLocationRequest, onResponse: (response: ItemListByLocationResponse) => void) => {
          const unsubscribe = jasmine.createSpy('unsubscribe');
          calls.push({ request, onResponse, unsubscribe });
          return unsubscribe;
        },
      ),
  };

  const sessionService = {
    getSessionKey: () => overrides.sessionKey ?? 'session-abc',
  };

  const controller = new FloatingDebrisController({
    socketService: socketService as never,
    sessionService: sessionService as never,
    stateService,
    getPlayerName: () => overrides.playerName ?? 'Pilot',
    getCharacterId: () => 'char-1',
    getActiveShipId: () => (overrides.shipId === undefined ? 'ship-1' : overrides.shipId),
    getHasTractorBeamInInventory: () => overrides.hasTractorBeamInInventory ?? false,
    getShipPositionKm: () => (overrides.positionKm === undefined ? { x: 1, y: 2, z: 3 } : overrides.positionKm),
    getSolarSystemId: () => overrides.solarSystemId ?? 'sol-1',
    setInterval: (handler, intervalMs) => {
      const handle = nextHandle++;
      intervals.push({ handler, intervalMs, handle });
      return handle;
    },
    clearInterval: (handle) => {
      cleared.push(handle);
    },
  });

  return { controller, stateService, socketService, calls, intervals, cleared };
}

const TEST_CORRELATION_ID = '00000000-0000-4000-8000-000000000006';
const TEST_REQUEST_IDENTITY = {
  operation: 'test-op',
  entityType: 'test-entity',
  containerId: 'test-container',
};

describe('FloatingDebrisController', () => {
  it('emits one location request on start with the supplied ship context', () => {
    const { controller, calls } = createDeps();

    controller.start();

    expect(calls.length).toBe(1);
    expect(calls[0].request).toEqual({
      sessionKey: 'session-abc',
      playerName: 'Pilot',
      solarSystemId: 'sol-1',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceKm: 50,
    });
  });

  it('schedules a poll at the configured interval', () => {
    const { controller, intervals } = createDeps();
    controller.start();
    expect(intervals.length).toBe(1);
    expect(intervals[0].intervalMs).toBe(FLOATING_DEBRIS_POLL_INTERVAL_MS);
  });

  it('seeds a Tractor Beam when the first response is empty', () => {
    const { controller, calls, stateService } = createDeps();
    controller.start();
    calls[0].onResponse({ success: true, correlationId: TEST_CORRELATION_ID, requestIdentity: TEST_REQUEST_IDENTITY, items: [] });

    const all = stateService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].itemType).toBe('ship-tractor-beam');
    expect(all[0].displayName).toBe('Tractor Beam');
    expect(all[0].positionKm).toEqual({ x: 6, y: 2, z: 8 });
  });

  it('does not seed when the response contains items', () => {
    const { controller, calls, stateService } = createDeps();
    controller.start();
    const item: ShipItem = {
      id: 'server-1',
      itemType: 'crate',
      displayName: 'Crate',
      launchable: false,
      state: 'deployed',
      damageStatus: 'intact',
      container: null,
      owningPlayerId: null,
      owningCharacterId: null,
      spatial: {
        solarSystemId: 'sol-1',
        frame: 'barycentric',
        positionKm: { x: 9, y: 8, z: 7 },
        epochMs: Date.now(),
      },
      motion: null,
      destroyedAt: null,
      destroyedReason: null,
      discoveredAt: null,
      discoveredByCharacterId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    calls[0].onResponse({ success: true, correlationId: TEST_CORRELATION_ID, requestIdentity: TEST_REQUEST_IDENTITY, items: [item] });

    const all = stateService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('server-1');
  });

  it('does not seed a fallback Tractor Beam when the ship already has one in inventory', () => {
    const { controller, calls, stateService } = createDeps({ hasTractorBeamInInventory: true });

    controller.start();

    expect(stateService.getAll().length).toBe(0);

    calls[0].onResponse({ success: true, correlationId: TEST_CORRELATION_ID, requestIdentity: TEST_REQUEST_IDENTITY, items: [] });

    expect(stateService.getAll().length).toBe(0);
  });

  it('does not seed again on a subsequent empty response', () => {
    const { controller, intervals, calls, stateService } = createDeps();
    controller.start();
    calls[0].onResponse({ success: true, correlationId: TEST_CORRELATION_ID, requestIdentity: TEST_REQUEST_IDENTITY, items: [] });
    expect(stateService.getAll().length).toBe(1);

    // Simulate the timer tick that fires another request.
    intervals[0].handler();
    expect(calls.length).toBe(2);
    calls[1].onResponse({ success: true, correlationId: TEST_CORRELATION_ID, requestIdentity: TEST_REQUEST_IDENTITY, items: [] });

    expect(stateService.getAll().length).toBe(1);
  });

  it('does not emit a request when sessionKey is missing (negative)', () => {
    const { controller, calls } = createDeps({ sessionKey: '' });
    controller.start();
    expect(calls.length).toBe(0);
  });

  it('does not emit a request when ship position is unknown (negative)', () => {
    const { controller, calls } = createDeps({ positionKm: null });
    controller.start();
    expect(calls.length).toBe(0);
  });

  it('unsubscribes the previous listener when a new poll fires', () => {
    const { controller, intervals, calls } = createDeps();
    controller.start();
    expect(calls[0].unsubscribe).not.toHaveBeenCalled();

    intervals[0].handler();
    expect(calls.length).toBe(2);
    expect(calls[0].unsubscribe).toHaveBeenCalled();
  });

  it('stop() clears the interval and unsubscribes the active listener', () => {
    const { controller, intervals, calls, cleared } = createDeps();
    controller.start();
    expect(intervals.length).toBe(1);

    controller.stop();
    expect(cleared).toEqual([intervals[0].handle]);
    expect(calls[0].unsubscribe).toHaveBeenCalled();
  });

  it('start() is idempotent', () => {
    const { controller, calls, intervals } = createDeps();
    controller.start();
    controller.start();
    expect(calls.length).toBe(1);
    expect(intervals.length).toBe(1);
  });

  it('ignores list responses that report failure (negative)', () => {
    const { controller, calls, stateService } = createDeps();
    controller.start();
    // Proactive cold-boot seed runs immediately on start(), so the local
    // Tractor Beam is already present. A failed list response must not add
    // or remove anything beyond that seed.
    const seededIds = stateService.getAll().map((d) => d.id);
    calls[0].onResponse({ success: false, message: 'boom', correlationId: TEST_CORRELATION_ID, requestIdentity: TEST_REQUEST_IDENTITY });
    expect(stateService.getAll().map((d) => d.id)).toEqual(seededIds);
  });
});
