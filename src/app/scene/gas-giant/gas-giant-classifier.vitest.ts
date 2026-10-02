import { describe, expect, it } from 'vitest';
import { isGasGiantBody, parseGasGiantClassificationMode, resolveCatalogRadiusKm } from './gas-giant-classifier';

const jupiter = { id: 'jupiter', bodyType: 'planet', physicalCatalog: { radiusKm: 69_911 } };
const earth = { id: 'earth', bodyType: 'planet', physicalCatalog: { radiusKm: 6_371 } };
const ganymede = { id: 'ganymede', bodyType: 'moon', physicalCatalog: { radiusKm: 2_634 } };

describe('gas giant classifier', () => {
  it('resolves radius from radiusKm or diameter', () => {
    expect(resolveCatalogRadiusKm(jupiter)).toBe(69_911);
    expect(resolveCatalogRadiusKm({ id: 'x', physicalCatalog: { estimatedDiameterM: 50_000_000 } })).toBe(25_000);
    expect(resolveCatalogRadiusKm({ id: 'x', physicalCatalog: { radiusKm: -1 } })).toBeNull();
    expect(resolveCatalogRadiusKm({ id: 'x' })).toBeNull();
  });

  it('classifies large planets as giants in auto mode', () => {
    expect(isGasGiantBody(jupiter)).toBe(true);
    expect(isGasGiantBody(earth)).toBe(false);
    expect(isGasGiantBody({ id: 'unknown', bodyType: 'planet' })).toBe(false);
    expect(isGasGiantBody({ ...jupiter, bodyType: 'moon' })).toBe(false);
  });

  it('honours forced modes for planets only', () => {
    expect(isGasGiantBody(earth, 'all')).toBe(true);
    expect(isGasGiantBody(jupiter, 'none')).toBe(false);
    expect(isGasGiantBody(ganymede, 'all')).toBe(false);
    expect(isGasGiantBody(null, 'all')).toBe(false);
  });

  it('parses the query override', () => {
    expect(parseGasGiantClassificationMode('?gasGiants=all')).toBe('all');
    expect(parseGasGiantClassificationMode('?gasGiants=NONE')).toBe('none');
    expect(parseGasGiantClassificationMode('?gasGiants=bogus')).toBe('auto');
    expect(parseGasGiantClassificationMode('')).toBe('auto');
  });
});
