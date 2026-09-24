import { describe, expect, it } from 'vitest';

import type { CelestialBodyListItem } from '../../model/celestial-body-list';
import { mapLocalCelestialBodiesToSamples } from './ship-exterior-local-body-samples';

function buildBody(overrides: Partial<CelestialBodyListItem> = {}): CelestialBodyListItem {
  return {
    id: 'body-1',
    state: 'unscanned',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 110, y: 20, z: -5 },
      epochMs: 1700000000000,
    },
    ...overrides,
  } as CelestialBodyListItem;
}

describe('mapLocalCelestialBodiesToSamples', () => {
  const center = { x: 100, y: 0, z: 0 };

  it('should position samples relative to the sweep center at a 1:1 km scale', () => {
    const [sample] = mapLocalCelestialBodiesToSamples([buildBody()], center);

    expect(sample.basePosition).toEqual([10, 20, -5]);
    expect(sample.position).toEqual([10, 20, -5]);
  });

  it('should preserve the backend identity and absolute km location', () => {
    const [sample] = mapLocalCelestialBodiesToSamples([buildBody()], center);

    expect(sample.serverCelestialBodyId).toBe('body-1');
    expect(sample.solarSystemLocation.positionKm).toEqual({ x: 110, y: 20, z: -5 });
    expect(sample.clusterCenterKm).toEqual(center);
  });

  it('should return an empty list when the backend reported no bodies', () => {
    expect(mapLocalCelestialBodiesToSamples([], center)).toEqual([]);
  });

  it('should drop destroyed bodies', () => {
    const bodies = [buildBody({ id: 'kept' }), buildBody({ id: 'gone', state: 'destroyed' })];

    const samples = mapLocalCelestialBodiesToSamples(bodies, center);

    expect(samples.map((sample) => sample.serverCelestialBodyId)).toEqual(['kept']);
  });

  it('should mark scanned bodies as scanned and reveal their kinematics', () => {
    const body = buildBody({ observability: { scanState: 'scanned' } } as Partial<CelestialBodyListItem>);

    const [sample] = mapLocalCelestialBodiesToSamples([body], center);

    expect(sample.scanned).toBe(true);
    expect(sample.scanProgress).toBe(100);
    expect(sample.revealedKinematics).not.toBeNull();
  });

  it('should leave unscanned bodies unrevealed', () => {
    const [sample] = mapLocalCelestialBodiesToSamples([buildBody()], center);

    expect(sample.scanned).toBe(false);
    expect(sample.scanProgress).toBe(0);
    expect(sample.revealedKinematics).toBeNull();
  });
});
