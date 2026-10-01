import { describe, expect, it } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import {
  DEFAULT_STAR_COLOR,
  resolveStarColor,
  resolveStarFillColor,
  resolveStarLightColor,
  resolveStarLights,
  spectralClassColor,
  STAR_LIGHT_DECAY,
  STAR_LIGHT_DISTANCE,
  STAR_TINT_STRENGTH,
  temperColor,
  VIEWER_SCENE_STAR_LIGHT_INTENSITY,
} from './star-lighting';

function starBody(overrides: Partial<ViewerBody> = {}): ViewerBody {
  return {
    id: 'star-1',
    bodyType: 'star',
    displayName: 'Star One',
    spatial: { positionKm: { x: 0, y: 0, z: 0 } },
    ...overrides,
  } as unknown as ViewerBody;
}

function channels(hex: string): [number, number, number] {
  return [
    parseInt(hex.substring(1, 3), 16),
    parseInt(hex.substring(3, 5), 16),
    parseInt(hex.substring(5, 7), 16),
  ];
}

describe('star colour resolution', () => {
  it('maps spectral classes from hot blue to cool red', () => {
    const [, , blueB] = channels(spectralClassColor('B')!);
    const [redM] = channels(spectralClassColor('M')!);
    const [blueMr, , blueMb] = channels(spectralClassColor('M')!);
    const [redBr] = channels(spectralClassColor('B')!);

    // A B-class star must be bluer than it is red; an M-class the reverse.
    expect(blueB).toBeGreaterThan(redBr);
    expect(redM).toBeGreaterThan(blueMb);
    expect(blueMr).toBeGreaterThan(blueMb);
  });

  it('reads the class letter from a full type such as G2V', () => {
    expect(spectralClassColor('G2V')).toBe(spectralClassColor('G'));
    expect(spectralClassColor('m5')).toBe(spectralClassColor('M'));
  });

  it('returns null for an unknown or missing class', () => {
    expect(spectralClassColor('X')).toBeNull();
    expect(spectralClassColor('')).toBeNull();
    expect(spectralClassColor(undefined)).toBeNull();
  });

  it('prefers explicit art direction over the spectral class', () => {
    const body = starBody({
      visualization: { colorHex: '#ff0000', spectralClass: 'B' },
      spectralClass: 'B',
    } as Partial<ViewerBody>);

    expect(resolveStarColor(body)).toBe('#ff0000');
  });

  it('falls back through visualization, body class, then the default', () => {
    expect(resolveStarColor(starBody({ visualization: { spectralClass: 'M' } } as Partial<ViewerBody>))).toBe(
      spectralClassColor('M'),
    );
    expect(resolveStarColor(starBody({ spectralClass: 'K' } as Partial<ViewerBody>))).toBe(spectralClassColor('K'));
    expect(resolveStarColor(starBody())).toBe(DEFAULT_STAR_COLOR);
  });

  it('ignores a malformed colorHex rather than rendering the star black', () => {
    const body = starBody({ visualization: { colorHex: 'not-a-colour' }, spectralClass: 'M' } as Partial<ViewerBody>);
    expect(resolveStarColor(body)).toBe(spectralClassColor('M'));
  });
});

describe('star light tempering', () => {
  it('leaves a colour untouched at full strength and neutralises it at zero', () => {
    expect(temperColor('#ff0000', 1)).toBe('#ff0000');
    expect(temperColor('#ff0000', 0)).toBe('#ffffff');
  });

  it('pulls a saturated star toward neutral so surfaces stay readable', () => {
    const trueColor = channels(spectralClassColor('M')!);
    const cast = channels(resolveStarLightColor(starBody({ spectralClass: 'M' } as Partial<ViewerBody>)));

    // The blue channel is what a red star starves, so it is the honest measure.
    expect(cast[2]).toBeGreaterThan(trueColor[2]);
    expect(cast[2]).toBeLessThan(255);
    expect(STAR_TINT_STRENGTH).toBeLessThan(1);
  });

  it('keeps a sunlike star essentially unchanged', () => {    // A G-class system must still look like the plain white light the scenes
    // used before star colour existed, otherwise this change would have quietly
    // restyled Sol. Every channel stays within 6% of white.
    const cast = channels(resolveStarLightColor(starBody({ spectralClass: 'G' } as Partial<ViewerBody>)));
    for (const channel of cast) {
      expect(255 - channel).toBeLessThanOrEqual(16);
    }
  });
});

describe('star light placement', () => {
  it('casts star light without distance falloff', () => {
    // Regression guard. The scenes originally used physically correct falloff,
    // but a solar system is compressed into roughly thirty scene units, so a
    // star ~38 units out delivered about 0.6% of its nominal intensity: the
    // star lit nothing and the fill lights carried the whole scene, which made
    // star colour invisible no matter how correctly it was computed. Unit tests
    // cannot see three.js, so the falloff is pinned here and bound from here by
    // both scene templates.
    expect(STAR_LIGHT_DECAY).toBe(0);
    expect(STAR_LIGHT_DISTANCE).toBe(0);
  });

  it('returns no lights for a system without stars', () => {
    expect(resolveStarLights([], 3)).toEqual([]);
  });

  it('gives a single star the whole budget at its own position', () => {
    const lights = resolveStarLights(
      [{ id: 'star-1', position: [4, 1, -2], body: starBody({ luminositySolar: 1 } as Partial<ViewerBody>) }],
      VIEWER_SCENE_STAR_LIGHT_INTENSITY,
    );

    expect(lights).toHaveLength(1);
    expect(lights[0].intensity).toBeCloseTo(VIEWER_SCENE_STAR_LIGHT_INTENSITY, 5);
    expect(lights[0].position).toEqual([4, 1, -2]);
  });

  it('splits a fixed budget across a binary instead of doubling the light', () => {
    // Adding a companion must redistribute light: a binary should look
    // differently lit, not twice as bright.
    const lights = resolveStarLights(
      [
        { id: 'primary', position: [10, 0, 0], body: starBody({ luminositySolar: 4 } as Partial<ViewerBody>) },
        { id: 'companion', position: [-10, 0, 0], body: starBody({ luminositySolar: 1 } as Partial<ViewerBody>) },
      ],
      VIEWER_SCENE_STAR_LIGHT_INTENSITY,
    );

    const total = lights.reduce((sum, light) => sum + light.intensity, 0);
    expect(total).toBeCloseTo(VIEWER_SCENE_STAR_LIGHT_INTENSITY, 5);
    expect(lights[0].intensity).toBeGreaterThan(lights[1].intensity);
    // sqrt weighting keeps the companion visible rather than crushing it 4:1.
    expect(lights[0].intensity / lights[1].intensity).toBeCloseTo(2, 5);
  });

  it('treats a missing luminosity as sunlike rather than as zero', () => {
    const lights = resolveStarLights(
      [
        { id: 'a', position: [1, 0, 0], body: starBody() },
        { id: 'b', position: [-1, 0, 0], body: starBody() },
      ],
      2,
    );

    expect(lights[0].intensity).toBeCloseTo(1, 5);
    expect(lights[1].intensity).toBeCloseTo(1, 5);
  });
});

describe('star fill colour', () => {
  it('blends a binary toward the brighter member', () => {
    const fill = channels(
      resolveStarFillColor([
        {
          id: 'primary',
          position: [0, 0, 0],
          body: starBody({ spectralClass: 'M', luminositySolar: 100 } as Partial<ViewerBody>),
        },
        {
          id: 'companion',
          position: [0, 0, 0],
          body: starBody({ spectralClass: 'B', luminositySolar: 1 } as Partial<ViewerBody>),
        },
      ]),
    );

    // Dominated by the red primary, so red must still outrun blue.
    expect(fill[0]).toBeGreaterThan(fill[2]);
  });

  it('falls back to a neutral sunlike fill with no stars', () => {
    expect(resolveStarFillColor([])).toBe(temperColor(DEFAULT_STAR_COLOR, 0.3));
  });
});
