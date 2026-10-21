import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketListByLocationResponse, MarketSummary } from '../../model/market-list';
import type { SolarSystemGetResponse, ViewerBody } from '../../model/solar-system-get';
import { appLogger } from '../../services/logger';
import { MarketService } from '../../services/market.service';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SolarSystemService } from '../../services/solar-system.service';
import StationViewPage from './station-view';

const station: ViewerBody = {
  id: 'sol-mars-orbit',
  bodyType: 'station',
  stationKind: 'market',
  displayName: 'Mars Market',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 10, y: 0, z: 0 }, epochMs: 0 },
};

function systemResponse(): SolarSystemGetResponse {
  return {
    success: true,
    message: '',
    playerName: 'Pilot',
    solarSystemId: 'sol',
    bodies: [],
    correlationId: 'd9e0d5bd-0bbf-4d25-94a8-894b7dcc916d',
    requestIdentity: { operation: 'solar-system-get', entityType: 'solar-system', containerId: 'sol' },
  };
}

function marketResponse(markets: MarketSummary[]): MarketListByLocationResponse {
  return {
    success: true,
    message: '',
    playerName: 'Pilot',
    solarSystemId: 'sol',
    markets,
    correlationId: 'fa4c732b-a644-48d1-b0b0-ac491f88bc38',
    requestIdentity: { operation: 'market-list-by-location', entityType: 'market', containerId: 'sol' },
  };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

function setup(bodies?: ViewerBody[], id = station.id) {
  const solar = { getSolarSystem: vi.fn<SolarSystemService['getSolarSystem']>() };
  const market = { listMarketsByLocation: vi.fn<MarketService['listMarketsByLocation']>() };
  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    imports: [StationViewPage],
    providers: [
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ solarSystemId: 'sol', bodyId: id })) } },
      {
        provide: Router,
        useValue: { getCurrentNavigation: () => ({ extras: { state: { playerName: 'Pilot', bodies } } }), navigate },
      },
      { provide: SessionService, useValue: { playerName: () => 'Pilot', getSessionKey: () => 'session' } },
      { provide: SolarSystemService, useValue: solar },
      { provide: MarketService, useValue: market },
      { provide: ShipService, useValue: { listShipsByOwner: vi.fn() } },
      { provide: SocketService, useValue: {} },
    ],
  }).overrideComponent(StationViewPage, { set: { template: '' } });
  const fixture = TestBed.createComponent(StationViewPage);
  return { fixture, page: fixture.componentInstance, solar, market, navigate };
}

describe('StationViewPage', () => {
  it('uses a preloaded exact station without a second system request and returns to its viewer', async () => {
    const { page, solar, navigate } = setup([station]);
    expect(page['selectedBody']()).toEqual(station);
    expect(solar.getSolarSystem).not.toHaveBeenCalled();
    page['retryModel']();
    expect(page['attempt']()).toBe(1);
    page['exitToViewer']();
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['viewer-scene', 'sol'] } }],
      expect.objectContaining({
        preserveFragment: true,
      }),
    );
  });

  it('rejects unregistered station identifiers rather than borrowing the Mars model', () => {
    const { page, solar } = setup(undefined, 'other-station');
    expect(page['selectedBody']()).toBeNull();
    expect(page['sceneError']()).toContain('No dedicated model');
    expect(solar.getSolarSystem).not.toHaveBeenCalled();
  });

  it('rehydrates the station through its market ID on direct entry', () => {
    const { page, solar, market } = setup();
    const systemCallback = solar.getSolarSystem.mock.calls[0][1];
    systemCallback(systemResponse());
    expect(page['sceneError']()).toBeNull();
    expect(page['selectedBody']()).toBeNull();
    const marketSummary: MarketSummary = {
      marketId: station.id,
      solarSystemId: 'sol',
      marketName: station.displayName,
      siteType: 'station',
      siteName: station.displayName,
      spatial: { ...station.spatial, frame: 'barycentric' },
      priceMultiplier: 1,
      driftPercentPerHour: 0,
      restockIntervalMinutes: 60,
    };
    market.listMarketsByLocation.mock.calls[0][1](marketResponse([marketSummary]));
    expect(page['selectedBody']()?.id).toBe(station.id);
    expect(page['sceneError']()).toBeNull();
  });

  it('reports a missing station after discovery completes instead of loading forever', () => {
    const { page, solar, market } = setup();
    solar.getSolarSystem.mock.calls[0][1](systemResponse());
    market.listMarketsByLocation.mock.calls[0][1](marketResponse([]));
    expect(page['sceneError']()).toContain('No dedicated model');
  });

  it('ignores pending system results after leaving the close-up', () => {
    const { fixture, page, solar, market } = setup();
    fixture.destroy();
    solar.getSolarSystem.mock.calls[0][1](systemResponse());
    expect(page['bodies']()).toEqual([]);
    expect(market.listMarketsByLocation).not.toHaveBeenCalled();
  });

  it('reports failed market discovery explicitly', () => {
    vi.spyOn(appLogger, 'error').mockImplementation(() => undefined);
    const { page, solar, market } = setup();
    solar.getSolarSystem.mock.calls[0][1](systemResponse());
    market.listMarketsByLocation.mock.calls[0][1]({
      ...marketResponse([]),
      success: false,
      message: 'MARKET_ANCHOR_UNRESOLVED',
    });
    expect(page['sceneError']()).toContain('MARKET_ANCHOR_UNRESOLVED');
    expect(appLogger.error).toHaveBeenCalled();
  });

  it('ignores pending market results after leaving the close-up', () => {
    const { fixture, page, solar, market } = setup();
    solar.getSolarSystem.mock.calls[0][1](systemResponse());
    const callback = market.listMarketsByLocation.mock.calls[0][1];
    fixture.destroy();
    callback(marketResponse([]));
    expect(page['sceneError']()).toBeNull();
  });
});
