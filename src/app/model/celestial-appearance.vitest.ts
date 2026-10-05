import { describe, expect, it } from 'vitest';
import { celestialAppearanceKey, resolveCelestialAppearance } from './celestial-appearance';
import type { CanonicalBodyType, SurfaceArchetype } from './celestial-classification';

const cases: Array<[CanonicalBodyType, SurfaceArchetype, string, string | undefined]> = [
  ['planet', 'rocky', 'terran', undefined],
  ['planet', 'lava', 'terran', 'lava'],
  ['planet', 'ocean', 'terran', 'ocean'],
  ['planet', 'gas-giant', 'gas-giant', undefined],
  ['planet', 'ice-giant', 'gas-giant', undefined],
  ['star', 'star', 'star', undefined],
  ['moon', 'rocky-moon', 'terran', 'rocky-moon'],
  ['moon', 'icy-moon', 'terran', 'icy-moon'],
  ['asteroid', 'asteroid', 'asteroid', undefined],
];

describe('canonical celestial appearance resolver', () => {
  it.each(cases)('maps %s/%s to %s', (bodyType, surfaceArchetype, renderer, fallback) => {
    const result = resolveCelestialAppearance({
      source: 'canonical',
      bodyId: 'body-1',
      bodyType,
      surfaceArchetype,
    });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.input.renderer).toBe(renderer);
    if (fallback) expect(result.input.fallbackReason).toContain(fallback);
    else expect(result.input.fallbackReason).toBeUndefined();
    expect(result.input.surfaceArchetype).toBe(surfaceArchetype);
  });

  it('forces the ice palette for ice giants and treats splash fixtures as demo inputs', () => {
    const result = resolveCelestialAppearance({
      source: 'demo',
      bodyId: 'preview-ice',
      bodyType: 'planet',
      surfaceArchetype: 'ice-giant',
    });

    expect(result).toMatchObject({
      valid: true,
      input: { source: 'demo', renderer: 'gas-giant', gasGiantPalette: 'ice' },
    });
  });

  it('rejects invalid classifications instead of applying a fallback', () => {
    expect(
      resolveCelestialAppearance({
        source: 'canonical',
        bodyId: 'bad-body',
        bodyType: 'star',
        surfaceArchetype: 'rocky',
      }),
    ).toMatchObject({ valid: false });
  });

  it('keys appearance by generator version, archetype, and canonical identity', () => {
    expect(celestialAppearanceKey('body', 'rocky', 'terran-v2')).not.toBe(
      celestialAppearanceKey('body', 'ocean', 'terran-v2'),
    );
    expect(celestialAppearanceKey('body', 'rocky', 'terran-v2')).not.toBe(
      celestialAppearanceKey('body', 'rocky', 'terran-v3'),
    );
    expect(celestialAppearanceKey('body', 'rocky', 'terran-v2')).not.toBe(
      celestialAppearanceKey('other', 'rocky', 'terran-v2'),
    );
  });
});
