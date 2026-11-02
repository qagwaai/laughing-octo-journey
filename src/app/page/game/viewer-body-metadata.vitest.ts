import { describe, expect, it } from 'vitest';
import {
  APPROXIMATE_PREFIX,
  approximatePrefix,
  areRingsApproximate,
  hasCatalogMetadata,
  isApproximateField,
  isLikelyBodyType,
  secondaryCatalogName,
} from './viewer-body-metadata';

describe('viewer body catalog metadata', () => {
  const body = { approximateFields: ['atmosphere', 'orbit.inclinationDeg', 'physical'] };

  it('discloses server rings as estimates from either the ring flag or approximateFields', () => {
    const rings = {
      innerRadiusKm: 90_000,
      outerRadiusKm: 180_000,
      tiltDeg: 3,
      colorHex: '#c8b89a',
      opacity: 0.6,
      approximate: false,
    };
    expect(areRingsApproximate({ approximateFields: [], rings })).toBe(false);
    expect(areRingsApproximate({ approximateFields: ['rings'], rings })).toBe(true);
    expect(areRingsApproximate({ approximateFields: [], rings: { ...rings, approximate: true } })).toBe(true);
    expect(areRingsApproximate({ approximateFields: ['rings'], rings: null })).toBe(false);
    expect(hasCatalogMetadata({ displayName: 'X', rings })).toBe(true);
  });

  it('marks exact paths and everything under an approximate parent', () => {
    expect(isApproximateField(body, 'orbit.inclinationDeg')).toBe(true);
    expect(isApproximateField(body, 'physical.massKg')).toBe(true);
    expect(isApproximateField(body, 'orbit.eccentricity')).toBe(false);
    expect(isApproximateField(body, 'orbitX')).toBe(false);
    expect(isApproximateField({}, 'physical.massKg')).toBe(false);
    expect(approximatePrefix(body, 'orbit.inclinationDeg')).toBe(APPROXIMATE_PREFIX);
    expect(APPROXIMATE_PREFIX).toBe('≈ ');
    expect(approximatePrefix(body, 'orbit.eccentricity')).toBe('');
  });

  it('labels the type likely only when the archetype was inferred', () => {
    expect(isLikelyBodyType({ approximateFields: ['surfaceArchetype'] })).toBe(true);
    expect(isLikelyBodyType({ approximateFields: ['planetType'] })).toBe(true);
    expect(isLikelyBodyType(body)).toBe(false);
  });

  it('shows the catalog name only when it differs from the display name', () => {
    expect(secondaryCatalogName({ displayName: '55 Cnc e', catalogName: '55 Cnc e' })).toBeNull();
    expect(secondaryCatalogName({ displayName: 'Janssen', catalogName: ' 55 Cnc e ' })).toBe('55 Cnc e');
    expect(secondaryCatalogName({ displayName: 'Earth', catalogName: null })).toBeNull();
  });

  it('shows the catalog section only for catalog-backed or flagged bodies', () => {
    expect(hasCatalogMetadata({ displayName: 'Earth' })).toBe(false);
    expect(hasCatalogMetadata({ displayName: 'X', catalogSource: 'exoplanet-catalog' })).toBe(true);
    expect(hasCatalogMetadata({ displayName: 'X', controversial: true })).toBe(true);
    expect(hasCatalogMetadata({ displayName: 'X', circumbinary: true })).toBe(true);
  });
});
