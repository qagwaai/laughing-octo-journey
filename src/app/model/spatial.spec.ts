import {
  assertSameSpatialFrame,
  distanceKm,
  distanceSquaredKm,
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
    expect(isWithinRange(origin, target, 13)).toBeTrue();
    expect(isWithinRange(origin, target, 12.99)).toBeFalse();
  });

  it('rejects frame mismatches', () => {
    expect(() => assertSameSpatialFrame(origin, { ...target, solarSystemId: 'alpha-centauri' })).toThrowError(
      /matching solarSystemId/,
    );
  });
});
