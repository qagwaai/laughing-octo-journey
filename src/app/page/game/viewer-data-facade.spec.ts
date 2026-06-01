import { ViewerDataFacade } from './viewer-data-facade';
import type { ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemService } from '../../services/solar-system.service';
import type { MarketService } from '../../services/market.service';
import type { ShipService } from '../../services/ship.service';
import type { SocketService } from '../../services/socket.service';

interface FacadeHarness {
  facade: ViewerDataFacade;
  state: {
    playerName: string;
    sessionKey: string | null;
    activeCharacterId: string | null;
    currentSolarSystemId: string | null;
    bodies: ViewerBody[];
    ships: unknown[];
    isLoading: boolean;
    sceneError: string | null;
    solarSystem: unknown | null;
    resetCount: number;
    setBodiesCount: number;
    setShipsCount: number;
  };
  services: {
    solarSystemService: { getSolarSystem: jasmine.Spy };
    marketService: { listMarketsByLocation: jasmine.Spy };
    shipService: { listShipsByOwner: jasmine.Spy };
    socketService: { upsertShip: jasmine.Spy };
  };
}

function starBody(id: string, solarSystemId = 'sol'): ViewerBody {
  return {
    id,
    bodyType: 'star',
    displayName: id,
    spatial: {
      solarSystemId,
      frame: 'icrs',
      positionKm: { x: 1, y: 2, z: 3 },
      epochMs: 0,
    },
  };
}

function stationBody(id: string, solarSystemId = 'sol'): ViewerBody {
  return {
    id,
    bodyType: 'station',
    stationKind: 'market',
    displayName: id,
    spatial: {
      solarSystemId,
      frame: 'icrs',
      positionKm: { x: 5, y: 6, z: 7 },
      epochMs: 0,
    },
  };
}

function asteroidBodyWithDescriptor(id: string): ViewerBody {
  return {
    id,
    bodyType: 'asteroid',
    displayName: id,
    spatial: {
      solarSystemId: 'sol',
      frame: 'icrs',
      positionKm: { x: 10, y: 20, z: 30 },
      epochMs: 0,
    },
    externalObjectDescriptor: {
      descriptorId: `${id}-descriptor`,
      schemaVersion: 'sw-13-m0-v1',
      domain: 'asteroids',
      objectFamily: 'rocky-irregular',
      roleCue: 'hazard',
      factionCue: 'neutral',
      fallbackTier: 'standard',
      displayLabel: id,
      silhouetteProfile: 'irregular',
      materialProfile: 'rocky',
      emissiveProfile: 'none',
    },
  };
}

function debrisBodyWithDescriptor(id: string): ViewerBody {
  return {
    id,
    bodyType: 'debris',
    displayName: id,
    spatial: {
      solarSystemId: 'sol',
      frame: 'icrs',
      positionKm: { x: 14, y: 24, z: 34 },
      epochMs: 0,
    },
    externalObjectDescriptor: {
      descriptorId: `${id}-descriptor`,
      schemaVersion: 'sw-13-m0-v1',
      domain: 'debris',
      objectFamily: 'cargo-canister',
      roleCue: 'salvage',
      factionCue: 'neutral',
      fallbackTier: 'standard',
      displayLabel: id,
      silhouetteProfile: 'canister',
      materialProfile: 'industrial',
      emissiveProfile: 'none',
    },
  };
}

function gateBodyWithDescriptor(id: string, objectFamily: 'ring-gate' | 'segmented-arch' | 'relay-spindle'): ViewerBody {
  return {
    id,
    bodyType: 'gate',
    displayName: id,
    spatial: {
      solarSystemId: 'sol',
      frame: 'icrs',
      positionKm: { x: 40, y: 50, z: 60 },
      epochMs: 0,
    },
    externalObjectDescriptor: {
      descriptorId: `${id}-descriptor`,
      schemaVersion: 'sw-13-m0-v1',
      domain: 'gates',
      objectFamily,
      roleCue: 'navigation',
      factionCue: 'neutral',
      fallbackTier: 'standard',
      displayLabel: id,
      silhouetteProfile: 'gate',
      materialProfile: 'infrastructure',
      emissiveProfile: 'navigation',
    },
  };
}

function createHarness(): FacadeHarness {
  const solarSystemService = {
    getSolarSystem: jasmine.createSpy('getSolarSystem'),
  };
  const marketService = {
    listMarketsByLocation: jasmine.createSpy('listMarketsByLocation'),
  };
  const shipService = {
    listShipsByOwner: jasmine.createSpy('listShipsByOwner'),
  };
  const socketService = {
    upsertShip: jasmine.createSpy('upsertShip'),
  };

  const state: FacadeHarness['state'] = {
    playerName: 'Pioneer',
    sessionKey: 'session-key',
    activeCharacterId: 'char-1',
    currentSolarSystemId: 'sol',
    bodies: [],
    ships: [],
    isLoading: false,
    sceneError: null,
    solarSystem: null,
    resetCount: 0,
    setBodiesCount: 0,
    setShipsCount: 0,
  };

  const facade = new ViewerDataFacade({
    solarSystemService: solarSystemService as unknown as SolarSystemService,
    marketService: marketService as unknown as MarketService,
    shipService: shipService as unknown as ShipService,
    socketService: socketService as unknown as SocketService,
    getPlayerName: () => state.playerName,
    getSessionKey: () => state.sessionKey,
    getActiveCharacterId: () => state.activeCharacterId,
    getCurrentSolarSystemId: () => state.currentSolarSystemId,
    getBodies: () => state.bodies,
    setSolarSystem: (solarSystem) => {
      state.solarSystem = solarSystem;
    },
    setBodies: (bodies) => {
      state.bodies = bodies;
      state.setBodiesCount += 1;
    },
    setShips: (ships) => {
      state.ships = ships;
      state.setShipsCount += 1;
    },
    setIsLoading: (value) => {
      state.isLoading = value;
    },
    setSceneError: (value) => {
      state.sceneError = value;
    },
    resetSelectionState: () => {
      state.resetCount += 1;
    },
  });

  return {
    facade,
    state,
    services: {
      solarSystemService,
      marketService,
      shipService,
      socketService,
    },
  };
}

describe('ViewerDataFacade', () => {
  it('sets missing-session scene error when required context is absent', () => {
    const { facade, state, services } = createHarness();
    state.sessionKey = null;

    facade.loadSystem('sol');

    expect(state.sceneError).toBe('viewer-scene-error missing-session');
    expect(services.solarSystemService.getSolarSystem).not.toHaveBeenCalled();
  });

  it('does not reload the same system id twice', () => {
    const { facade, services } = createHarness();
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({ success: false, message: 'boom' });
    });

    facade.loadSystem('sol');
    facade.loadSystem('sol');

    expect(services.solarSystemService.getSolarSystem).toHaveBeenCalledTimes(1);
  });

  it('dedupes body ids, resets selection, and clears ships when active character is missing', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [starBody('sol-star'), stationBody('station-a')],
      });
    });

    facade.loadSystem('sol');

    expect(state.isLoading).toBeFalse();
    expect(state.sceneError).toBeNull();
    expect(state.resetCount).toBe(1);
    expect(state.bodies.map((body) => body.id)).toEqual(['sol-star', 'station-a']);
    expect(state.ships).toEqual([]);
    expect(services.shipService.listShipsByOwner).not.toHaveBeenCalled();
  });

  it('rejects payloads with invalid SW-13 descriptors', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [
          {
            ...asteroidBodyWithDescriptor('asteroid-a'),
            externalObjectDescriptor: {
              ...asteroidBodyWithDescriptor('asteroid-a').externalObjectDescriptor,
              schemaVersion: 'legacy-v0',
            },
          },
        ],
      });
    });

    facade.loadSystem('sol');

    expect(state.sceneError).toContain('viewer-scene-error descriptor-contract');
    expect(state.bodies).toEqual([]);
    expect(state.ships).toEqual([]);
  });

  it('accepts valid SW-13 descriptors and preserves sanitized bodies', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [asteroidBodyWithDescriptor('asteroid-a')],
      });
    });

    facade.loadSystem('sol');

    const asteroid = state.bodies.find((body) => body.id === 'asteroid-a');
    expect(state.sceneError).toBeNull();
    expect(asteroid?.externalObjectDescriptor?.schemaVersion).toBe('sw-13-m0-v1');
    expect(asteroid?.externalObjectDescriptor?.domain).toBe('asteroids');
  });

  it('accepts valid SW-13 debris descriptors and preserves sanitized bodies', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [debrisBodyWithDescriptor('debris-a')],
      });
    });

    facade.loadSystem('sol');

    const debris = state.bodies.find((body) => body.id === 'debris-a');
    expect(state.sceneError).toBeNull();
    expect(debris?.externalObjectDescriptor?.schemaVersion).toBe('sw-13-m0-v1');
    expect(debris?.externalObjectDescriptor?.domain).toBe('debris');
    expect(debris?.externalObjectDescriptor?.objectFamily).toBe('cargo-canister');
  });

  it('accepts M4 dense-scene envelope with 16 descriptors and 3 gate entries', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;

    const asteroidDescriptors = Array.from({ length: 16 }, (_, index) => asteroidBodyWithDescriptor(`asteroid-${index}`));
    const gates = [
      gateBodyWithDescriptor('gate-ring', 'ring-gate'),
      gateBodyWithDescriptor('gate-segmented', 'segmented-arch'),
      gateBodyWithDescriptor('gate-relay', 'relay-spindle'),
    ];

    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [...asteroidDescriptors, ...gates],
      });
    });

    facade.loadSystem('sol');

    expect(state.sceneError).toBeNull();
    expect(state.bodies.length).toBe(20);
  });

  it('rejects payloads that exceed the M4 descriptor envelope cap', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;

    const asteroidDescriptors = Array.from({ length: 17 }, (_, index) => asteroidBodyWithDescriptor(`asteroid-${index}`));

    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: asteroidDescriptors,
      });
    });

    facade.loadSystem('sol');

    expect(state.sceneError).toContain('viewer-scene-error descriptor-contract');
    expect(state.sceneError).toContain('descriptor entries exceed max 16');
    expect(state.bodies).toEqual([]);
  });

  it('rejects payloads that exceed the M4 gate entry cap', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;

    const gates = [
      gateBodyWithDescriptor('gate-ring', 'ring-gate'),
      gateBodyWithDescriptor('gate-segmented', 'segmented-arch'),
      gateBodyWithDescriptor('gate-relay', 'relay-spindle'),
      gateBodyWithDescriptor('gate-ring-two', 'ring-gate'),
    ];

    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: gates,
      });
    });

    facade.loadSystem('sol');

    expect(state.sceneError).toContain('viewer-scene-error descriptor-contract');
    expect(state.sceneError).toContain('gate descriptor entries exceed max 3');
    expect(state.bodies).toEqual([]);
  });

  it('rejects gate descriptors that exceed M4 max byte size 328', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;

    const oversizedGate = gateBodyWithDescriptor('gate-oversized', 'ring-gate');
    oversizedGate.externalObjectDescriptor = {
      ...oversizedGate.externalObjectDescriptor!,
      displayLabel: 'gate-oversized-' + 'x'.repeat(300),
    };

    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [oversizedGate],
      });
    });

    facade.loadSystem('sol');

    expect(state.sceneError).toContain('viewer-scene-error descriptor-contract');
    expect(state.sceneError).toContain('exceeds max byte size 328');
    expect(state.bodies).toEqual([]);
  });

  it('hydrates market stations when none exist and drops stale responses', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;

    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [],
      });
    });

    let marketCallback: ((response: any) => void) | null = null;
    services.marketService.listMarketsByLocation.and.callFake((request: any, cb: (response: any) => void) => {
      marketCallback = cb;
      expect(request.positionKm).toEqual({ x: 1, y: 2, z: 3 });
      expect(request.locationTypes).toEqual(['station', 'free-floating']);
    });

    facade.loadSystem('sol');

    expect(services.marketService.listMarketsByLocation).toHaveBeenCalledTimes(1);
    state.currentSolarSystemId = 'other-system';
    if (!marketCallback) {
      fail('Expected market callback to be captured.');
      return;
    }
    (marketCallback as any)({
      success: true,
      markets: [{ marketId: 'market-sol-a', marketName: 'Sol Market', spatial: starBody('x').spatial }],
    });

    expect(state.setBodiesCount).toBe(1);
    expect(state.bodies.map((body) => body.id)).toEqual(['sol-star']);
  });

  it('maps market names and merges market stations into current bodies', () => {
    const { facade, state, services } = createHarness();
    state.activeCharacterId = null;

    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [],
      });
    });

    let marketCallback: ((response: any) => void) | null = null;
    services.marketService.listMarketsByLocation.and.callFake((_request: any, cb: (response: any) => void) => {
      marketCallback = cb;
    });

    facade.loadSystem('sol');

    if (!marketCallback) {
      fail('Expected market callback to be captured.');
      return;
    }
    (marketCallback as any)({
      success: true,
      markets: [
        {
          marketId: 'market-alpha',
          siteName: '  ',
          marketName: 'Alpha Market',
          spatial: starBody('x').spatial,
        },
        {
          marketId: 'market-beta',
          spatial: starBody('x').spatial,
        },
      ],
    });

    expect(state.setBodiesCount).toBe(2);
    expect(state.bodies.find((body) => body.id === 'market-alpha')?.displayName).toBe('Alpha Market');
    expect(state.bodies.find((body) => body.id === 'market-beta')?.displayName).toBe('market-beta');
    expect(state.bodies.find((body) => body.id === 'market-alpha')?.bodyType).toBe('station');
  });

  it('filters ships by current system and keeps ships without spatial', () => {
    const { facade, services, state } = createHarness();
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [stationBody('station-a')],
      });
    });

    services.shipService.listShipsByOwner.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        ships: [
          { id: 'ship-1', spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 } },
          { id: 'ship-2', spatial: { solarSystemId: 'alpha', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 } },
          { id: 'ship-3' },
        ],
      });
    });

    facade.loadSystem('sol');

    expect(state.ships).toEqual([
      { id: 'ship-1', spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 } },
      { id: 'ship-3' },
    ]);
  });

  it('clears ships when ship list fails or system changed', () => {
    const { facade, services, state } = createHarness();
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [stationBody('station-a')],
      });
    });

    services.shipService.listShipsByOwner.and.callFake((_request: unknown, cb: (response: any) => void) => {
      state.currentSolarSystemId = 'different';
      cb({ success: true, ships: [{ id: 'ship-1' }] });
    });

    facade.loadSystem('sol');

    expect(state.ships).toEqual([]);
  });

  it('repairs invalid ship spatial once and reloads ships on successful upsert', () => {
    const { facade, services } = createHarness();
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [stationBody('station-a')],
      });
    });

    let listCalls = 0;
    services.shipService.listShipsByOwner.and.callFake((_request: unknown, cb: (response: any) => void) => {
      listCalls += 1;
      if (listCalls === 1) {
        cb({
          success: true,
          ships: [
            { id: 'ship-invalid', spatial: { solarSystemId: 'sol' } },
            {
              id: 'ship-valid',
              spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
            },
          ],
        });
        return;
      }

      cb({
        success: true,
        ships: [
          {
            id: 'ship-valid',
            spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
          },
        ],
      });
    });

    services.socketService.upsertShip.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({ success: true, ship: { id: 'ship-invalid' } });
    });

    facade.loadSystem('sol');

    expect(services.socketService.upsertShip).toHaveBeenCalledTimes(1);
    expect(services.shipService.listShipsByOwner).toHaveBeenCalledTimes(2);
  });

  it('does not reload ships when invalid-spatial upsert fails', () => {
    const { facade, services } = createHarness();
    services.solarSystemService.getSolarSystem.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({
        success: true,
        solarSystem: { id: 'sol', displayName: 'Sol', source: 'curated' },
        stars: [starBody('sol-star')],
        bodies: [stationBody('station-a')],
      });
    });

    services.shipService.listShipsByOwner.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({ success: true, ships: [{ id: 'ship-invalid', spatial: { solarSystemId: 'sol' } }] });
    });

    services.socketService.upsertShip.and.callFake((_request: unknown, cb: (response: any) => void) => {
      cb({ success: false, message: 'upsert-failed' });
    });

    facade.loadSystem('sol');

    expect(services.socketService.upsertShip).toHaveBeenCalledTimes(1);
    expect(services.shipService.listShipsByOwner).toHaveBeenCalledTimes(1);
  });
});
