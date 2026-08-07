import { describe, expect, it } from 'vitest';
import type {
  MarketRouteFeedEncounterShip,
  MarketRouteFeedGate,
  MarketRouteFeedStation,
} from '../../model/market-list';
import {
  formatShipExteriorRouteFeedSummary,
  summarizeShipExteriorRouteFeeds,
} from './ship-exterior-route-feed-summary';

describe('ship-exterior route feed summary', () => {
  it('summarizes gate, station, and encounter ship counts', () => {
    const gate: MarketRouteFeedGate = {
      gateId: 'gate-1',
      sourceSystemId: 'sol',
      destSystemId: 'ceres',
      traversalCostAu: 0.5,
      traversalTimeHours: 1,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: 1,
      },
      descriptor: {
        descriptorId: 'gate-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'gates',
        objectFamily: 'ring-gate',
        roleCue: 'navigation',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Gate 1',
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
        recommendedStandOffKm: 1000,
        approachWindowKm: { min: 500, max: 1500 },
      },
    };
    const station: MarketRouteFeedStation = {
      marketId: 'station-1',
      solarSystemId: 'sol',
      marketName: 'Station 1',
      siteType: 'station',
      siteName: 'Station 1',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 1, y: 2, z: 3 },
        epochMs: 1,
      },
      descriptor: {
        descriptorId: 'station-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'stations',
        objectFamily: 'trade-hub',
        roleCue: 'landmark',
        factionCue: 'neutral',
        fallbackTier: 'standard',
        displayLabel: 'Station 1',
        silhouetteProfile: 'hub',
        materialProfile: 'industrial',
        emissiveProfile: 'station',
      },
    };
    const encounterShip: MarketRouteFeedEncounterShip = {
      shipId: 'ship-1',
      shipName: 'Ship 1',
      model: 'Raider',
      tier: 2,
      ownership: {
        ownerType: 'npc-pirate',
        npcId: 'npc-1',
        factionId: 'faction-1',
      },
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 4, y: 5, z: 6 },
        epochMs: 1,
      },
      descriptor: {
        descriptorId: 'ship-1',
        schemaVersion: 'sw-13-m0-v1',
        domain: 'ships',
        objectFamily: 'frigate',
        roleCue: 'threat',
        factionCue: 'pirate',
        fallbackTier: 'standard',
        displayLabel: 'Ship 1',
        silhouetteProfile: 'frigate',
        materialProfile: 'military',
        emissiveProfile: 'combat',
      },
    };

    expect(
      summarizeShipExteriorRouteFeeds({
        gates: [gate],
        stations: [station],
        encounterShips: [encounterShip],
      }),
    ).toEqual({
      gates: 1,
      stations: 1,
      encounterShips: 1,
    });
  });

  it('formats a readable route feed line', () => {
    expect(formatShipExteriorRouteFeedSummary({ gates: 2, stations: 3, encounterShips: 4 })).toBe(
      'ROUTE // G 2 S 3 E 4',
    );
  });

  it('uses a placeholder when route feed counts are unavailable', () => {
    expect(formatShipExteriorRouteFeedSummary(null)).toBe('ROUTE // ---');
  });
});
