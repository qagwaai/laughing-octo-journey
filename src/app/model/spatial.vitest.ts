import {
  assertSameSpatialFrame,
  distanceKm,
  distanceSquaredKm,
  isValidShipSpatial,
  isWithinRange,
  relativePositionKm,
  type SpatialState,
} from './spatial';

describe('spatial helpers', () => {
  const origin: SpatialState = {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 0, y: 0, z: 0 },
    epochMs: 1000,
  };

  const target: SpatialState = {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 3, y: 4, z: 12 },
    epochMs: 1000,
  };

  it('computes relative position', () => {
    expect(relativePositionKm(origin, target)).toEqual({ x: 3, y: 4, z: 12 });
  });

  it('computes squared distance', () => {
    expect(distanceSquaredKm(origin, target)).toBe(169);
  });

  it('computes distance', () => {
    expect(distanceKm(origin, target)).toBe(13);
  });

  it('checks range with squared distance', () => {
    expect(isWithinRange(origin, target, 13)).toBe(true);
    expect(isWithinRange(origin, target, 12.99)).toBe(false);
  });

  it('rejects frame mismatches', () => {
    expect(() => assertSameSpatialFrame(origin, { ...target, solarSystemId: 'alpha-centauri' })).toThrowError(
      /matching solarSystemId/,
    );
  });

  describe('isValidShipSpatial', () => {
    it('rejects null/undefined', () => {
      expect(isValidShipSpatial(null)).toBe(false);
      expect(isValidShipSpatial(undefined)).toBe(false);
    });

    it('rejects sun-origin (0,0,0) placeholders', () => {
      expect(isValidShipSpatial(origin)).toBe(false);
    });

    it('accepts a real off-origin barycentric position', () => {
      expect(isValidShipSpatial(target)).toBe(true);
    });

    it('rejects empty solarSystemId', () => {
      expect(isValidShipSpatial({ ...target, solarSystemId: '' })).toBe(false);
    });

    it('rejects malformed positionKm', () => {
      expect(
        isValidShipSpatial({
          ...target,
          positionKm: { x: NaN as unknown as number, y: 0, z: 0 } as SpatialState['positionKm'],
        }),
      ).toBe(false);
    });
  });
});
