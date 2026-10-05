import { describe, expect, it } from 'vitest';
import { validateCanonicalBodyClassification, validateCanonicalBodyCollection } from './celestial-classification';

function body(overrides: Record<string, unknown> = {}) {
  return {
    id: 'body-1',
    bodyType: 'star',
    surfaceArchetype: 'star',
    state: 'active',
    spatial: { positionKm: { x: 0, y: 0, z: 0 } },
    composition: { material: 'hydrogen', rarity: 'Common', textureColor: '#ffffff' },
    ...overrides,
  };
}

describe('canonical celestial contract validation', () => {
  it('accepts unknown nullable stellar values and preserves zero luminosity', () => {
    expect(validateCanonicalBodyClassification(body({ spectralClass: null, luminositySolar: null }))).toBeNull();
    expect(validateCanonicalBodyClassification(body({ spectralClass: undefined, luminositySolar: 0 }))).toBeNull();
  });

  it('rejects missing archetypes, incompatible classifications, and negative luminosity', () => {
    expect(validateCanonicalBodyClassification(body({ surfaceArchetype: undefined }))).toContain('surfaceArchetype');
    expect(validateCanonicalBodyClassification(body({ surfaceArchetype: 'rocky' }))).toContain('incompatible');
    expect(validateCanonicalBodyClassification(body({ luminositySolar: -1 }))).toContain('luminositySolar');
  });

  it('rejects active bodies without composition and incomplete orbital elements', () => {
    expect(validateCanonicalBodyClassification(body({ composition: undefined }))).toContain('composition');
    expect(validateCanonicalBodyClassification(body({
      orbitalElements: { semiMajorAxisKm: 1 },
    }))).toContain('orbitalElements');
  });

  it('rejects conflicting duplicate canonical records independent of their ordering', () => {
    const star = body();
    const conflicting = body({ surfaceArchetype: 'rocky', bodyType: 'planet' });
    expect(validateCanonicalBodyCollection([star, conflicting])).toContain('conflicting canonical records');
    expect(validateCanonicalBodyCollection([conflicting, star])).toContain('conflicting canonical records');
  });
});
