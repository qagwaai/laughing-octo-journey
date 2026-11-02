import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_BODY_COLOR,
  recoverCanonicalBodyCollection,
  validateCanonicalBodyClassification,
  validateCanonicalBodyCollection,
} from './celestial-classification';

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

  it.each(['super-earth', 'sub-neptune', 'hot-neptune', 'hot-jupiter', 'super-jupiter'])(
    'accepts the %s planet archetype and rejects it on stars',
    (surfaceArchetype) => {
      expect(validateCanonicalBodyClassification(body({ bodyType: 'planet', surfaceArchetype }))).toBeNull();
      expect(validateCanonicalBodyClassification(body({ surfaceArchetype }))).toContain('incompatible');
    },
  );
});

describe('canonical body recovery', () => {
  it('keeps valid bodies and turns an unknown archetype into a neutral placeholder', () => {
    const star = body();
    const unknown = body({ id: 'planet-x', bodyType: 'planet', surfaceArchetype: 'chthonian', displayName: 'X' });
    const result = recoverCanonicalBodyCollection<{ id: string }>([star, unknown]);
    expect(result.conflict).toBeNull();
    expect(result.bodies[0]).toBe(star);
    expect(result.bodies[1]).toMatchObject({
      id: 'planet-x',
      bodyType: 'planet',
      displayName: 'X',
      surfaceArchetype: null,
      placeholder: true,
      visualization: { colorHex: PLACEHOLDER_BODY_COLOR },
    });
    expect(result.rejected).toEqual([{ id: 'planet-x', reason: expect.stringContaining('surfaceArchetype') }]);
  });

  it('never renders a placeholder as a star and drops bodies without a usable position', () => {
    const badStar = body({ id: 'bad-star', surfaceArchetype: 'rocky' });
    const noPosition = body({ id: 'lost', surfaceArchetype: 'nope', spatial: {} });
    const result = recoverCanonicalBodyCollection<{ id: string }>([badStar, noPosition]);
    expect(result.bodies).toHaveLength(1);
    expect(result.bodies[0]).toMatchObject({ id: 'bad-star', bodyType: 'planet', placeholder: true });
    expect(result.rejected.map((entry) => entry.id)).toEqual(['bad-star', 'lost']);
  });

  it('still fails the whole collection on conflicting duplicates', () => {
    const result = recoverCanonicalBodyCollection([body(), body({ surfaceArchetype: 'rocky', bodyType: 'planet' })]);
    expect(result.conflict).toContain('conflicting canonical records');
    expect(result.bodies).toEqual([]);
  });
});
