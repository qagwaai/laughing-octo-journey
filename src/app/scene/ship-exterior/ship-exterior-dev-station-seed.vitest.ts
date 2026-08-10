import { describe, expect, it } from 'vitest';
import { createDevGateSeed, createDevStationSeed, seedRouteFeedsWithDevStation } from './ship-exterior-dev-station-seed';

describe('ship-exterior dev station seed', () => {
  it('creates a readable station seed for validation', () => {
    const station = createDevStationSeed({
      shipId: 'ship-a',
      solarSystemId: 'sol',
      positionKm: { x: 10, y: 20, z: 30 },
    });

    expect(station.marketId).toBe('dev-station-ship-a');
    expect(station.solarSystemId).toBe('sol');
    expect(station.siteType).toBe('station');
    expect(station.descriptor.domain).toBe('stations');
    expect(station.descriptor.objectFamily).toBe('research-platform');
  });

  it('creates a readable gate seed for validation', () => {
    const gate = createDevGateSeed({
      shipId: 'ship-a',
      solarSystemId: 'sol',
      positionKm: { x: 10, y: 20, z: 30 },
    });

    expect(gate.gateId).toBe('dev-gate-ship-a');
    expect(gate.sourceSystemId).toBe('sol');
    expect(gate.descriptor.domain).toBe('gates');
    expect(gate.descriptor.objectFamily).toBe('ring-gate');
  });

  it('adds a fallback station only when route feeds are empty', () => {
    const seeded = seedRouteFeedsWithDevStation(
      {
        gates: [],
        stations: [],
        encounterShips: [],
      },
      {
        shipId: 'ship-a',
        solarSystemId: 'sol',
        positionKm: { x: 10, y: 20, z: 30 },
      },
    );

    expect(seeded.stations).toHaveLength(1);
    expect(seeded.stations[0].marketId).toBe('dev-station-ship-a');

    const existing = seedRouteFeedsWithDevStation(
      {
        gates: [],
        stations: [
          {
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
          },
        ],
        encounterShips: [],
      },
      {
        shipId: 'ship-a',
        solarSystemId: 'sol',
        positionKm: { x: 10, y: 20, z: 30 },
      },
    );

    expect(existing.stations).toHaveLength(1);
    expect(existing.stations[0].marketId).toBe('station-1');
  });
});
