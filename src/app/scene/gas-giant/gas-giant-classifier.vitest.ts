import { describe, expect, it } from 'vitest';
import { isGasGiantBody, parseGasGiantClassificationMode, resolveCatalogRadiusKm } from './gas-giant-classifier';

const jupiter = { id: 'jupiter', bodyType: 'planet', surfaceArchetype: 'gas-giant', physicalCatalog: { radiusKm: 69_911 } };
const earth = { id: 'earth', bodyType: 'planet', physicalCatalog: { radiusKm: 6_371 } };
const ganymede = { id: 'ganymede', bodyType: 'moon', physicalCatalog: { radiusKm: 2_634 } };

describe('gas giant classifier', () => {
  it('resolves radius from radiusKm or diameter', () => {
    expect(resolveCatalogRadiusKm(jupiter)).toBe(69_911);
    expect(resolveCatalogRadiusKm({ id: 'x', physicalCatalog: { estimatedDiameterM: 50_000_000 } })).toBe(25_000);
    expect(resolveCatalogRadiusKm({ id: 'x', physicalCatalog: { radiusKm: -1 } })).toBeNull();
    expect(resolveCatalogRadiusKm({ id: 'x' })).toBeNull();
  });

  it('uses canonical surface archetypes instead of catalog size heuristics', () => {
    expect(isGasGiantBody(jupiter)).toBe(true);
    expect(isGasGiantBody(earth)).toBe(false);
    expect(isGasGiantBody({ ...earth, surfaceArchetype: 'ice-giant' })).toBe(true);
    expect(isGasGiantBody({ id: 'unknown', bodyType: 'planet' })).toBe(false);
    expect(isGasGiantBody({ ...jupiter, bodyType: 'moon' })).toBe(false);
  });

  it('does not let preview modes override canonical body appearance', () => {
    expect(isGasGiantBody(earth, 'all')).toBe(false);
    expect(isGasGiantBody(jupiter, 'none')).toBe(true);
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
