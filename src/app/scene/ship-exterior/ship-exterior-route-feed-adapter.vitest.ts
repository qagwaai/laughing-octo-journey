import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketSummary } from '../../model/market-list';
import { collectShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';

function buildRouteMarket(overrides: Partial<MarketSummary> = {}): MarketSummary {
  return {
    marketId: 'market-1',
    solarSystemId: 'sol',
    marketName: 'Ceres Exchange',
    siteType: 'station',
    siteName: 'Ceres Main',
    isStarterMarket: true,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 100, y: 0, z: 0 },
      epochMs: 1,
    },
    trajectory: {
      kind: 'orbital-elements',
      orbit: {
        anchorBodyId: 'sol-star',
        semiMajorAxisKm: 100,
        eccentricity: 0,
        inclinationDeg: 0,
        longitudeOfAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 0,
        meanAnomalyAtEpochDeg: 0,
        orbitalPeriodSec: 100,
        epoch: '2026-01-01T00:00:00.000Z',
      },
    },
    distanceAu: 0.01,
    isDocked: false,
    priceMultiplier: 1,
    driftPercentPerHour: 0,
    restockIntervalMinutes: 60,
    ...overrides,
  };
}

describe('collectShipExteriorRouteFeeds', () => {
  it('collects gates, stations, and encounter ships from route payloads', () => {
    const markets: MarketSummary[] = [
      buildRouteMarket({
        route: {
          kind: 'gate-route',
          hops: 2,
          gates: [
            {
              gateId: 'gate-sol-ceres',
              sourceSystemId: 'sol',
              destSystemId: 'ceres',
              traversalCostAu: 0.5,
              traversalTimeHours: 1,
              spatial: {
                solarSystemId: 'sol',
                frame: 'barycentric',
                positionKm: { x: 1000, y: 2000, z: -500 },
                epochMs: 1,
              },
              descriptor: {
                descriptorId: 'gates-ring-gate',
                schemaVersion: 'sw-13-m0-v1',
                domain: 'gates',
                objectFamily: 'ring-gate',
                roleCue: 'navigation',
                factionCue: 'neutral',
                fallbackTier: 'standard',
                displayLabel: 'Sol Ceres Gate',
                silhouetteProfile: 'ring',
                materialProfile: 'infrastructure',
                emissiveProfile: 'navigation',
              },
              approachMetadata: {
                approachCue: 'direct-centerline',
                landmarkFraming: 'full-ring',
                navBeaconCue: 'continuous',
                hazardCue: 'low',
                warningEscalation: 'none',
                recommendedStandOffKm: 1400,
                approachWindowKm: {
                  min: 1000,
                  max: 2200,
                },
              },
            },
          ],
          stations: [
            {
              marketId: 'station-sol-main',
              solarSystemId: 'sol',
              marketName: 'Sol Main Exchange',
              siteType: 'station',
              siteName: 'Sol Main',
              spatial: {
                solarSystemId: 'sol',
                frame: 'barycentric',
                positionKm: { x: 500, y: 0, z: 0 },
                epochMs: 1,
              },
              descriptor: {
                descriptorId: 'stations-trade-hub',
                schemaVersion: 'sw-13-m0-v1',
                domain: 'stations',
                objectFamily: 'trade-hub',
                roleCue: 'landmark',
                factionCue: 'neutral',
                fallbackTier: 'standard',
                displayLabel: 'Sol Main',
                silhouetteProfile: 'hub',
                materialProfile: 'industrial',
                emissiveProfile: 'station',
              },
            },
          ],
          encounterShips: [
            {
              shipId: 'encounter-1',
              shipName: 'Corsair',
              model: 'Raider',
              tier: 2,
              ownership: {
                ownerType: 'npc-pirate',
                npcId: 'npc-1',
                factionId: 'faction-pirate',
              },
              spatial: {
                solarSystemId: 'sol',
                frame: 'barycentric',
                positionKm: { x: 1500, y: 200, z: -100 },
                epochMs: 1,
              },
              descriptor: {
                descriptorId: 'ships-frigate',
                schemaVersion: 'sw-13-m0-v1',
                domain: 'ships',
                objectFamily: 'frigate',
                roleCue: 'threat',
                factionCue: 'pirate',
                fallbackTier: 'standard',
                displayLabel: 'Corsair',
                silhouetteProfile: 'frigate',
                materialProfile: 'military',
                emissiveProfile: 'combat',
              },
            },
          ],
        },
      }),
    ];

    const feeds = collectShipExteriorRouteFeeds(markets);

    expect(feeds.gates.length).toBe(1);
    expect(feeds.stations.length).toBe(1);
    expect(feeds.encounterShips.length).toBe(1);
    expect(feeds.gates[0].gateId).toBe('gate-sol-ceres');
    expect(feeds.stations[0].marketId).toBe('station-sol-main');
    expect(feeds.encounterShips[0].shipId).toBe('encounter-1');
  });

  it('deduplicates feed rows by stable ids across markets', () => {
    const sharedGate = {
      gateId: 'gate-shared',
      sourceSystemId: 'sol',
      destSystemId: 'ceres',
      traversalCostAu: 0.5,
      traversalTimeHours: 1,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric' as const,
        positionKm: { x: 1000, y: 2000, z: -500 },
        epochMs: 1,
      },
      descriptor: {
        descriptorId: 'gates-ring-gate',
        schemaVersion: 'sw-13-m0-v1' as const,
        domain: 'gates' as const,
        objectFamily: 'ring-gate',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'standard' as const,
        displayLabel: 'Gate',
        silhouetteProfile: 'ring',
        materialProfile: 'infrastructure',
        emissiveProfile: 'navigation',
      },
      approachMetadata: {
        approachCue: 'direct-centerline',
        landmarkFraming: 'full-ring',
        navBeaconCue: 'continuous',
        hazardCue: 'low',
        warningEscalation: 'none',
        recommendedStandOffKm: 1400,
        approachWindowKm: { min: 1000, max: 2200 },
      },
    };

    const markets: MarketSummary[] = [
      buildRouteMarket({ route: { kind: 'gate-route', gates: [sharedGate] } }),
      buildRouteMarket({ marketId: 'market-2', route: { kind: 'gate-route', gates: [sharedGate] } }),
    ];

    const feeds = collectShipExteriorRouteFeeds(markets);

    expect(feeds.gates.length).toBe(1);
    expect(feeds.gates[0].gateId).toBe('gate-shared');
  });

  it('returns empty feeds when route payloads are absent', () => {
    const feeds = collectShipExteriorRouteFeeds([buildRouteMarket({ route: undefined })]);

    expect(feeds).toEqual({
      gates: [],
      stations: [],
      encounterShips: [],
    });
  });
});
