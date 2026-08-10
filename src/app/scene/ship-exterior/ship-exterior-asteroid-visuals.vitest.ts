import { describe, expect, it } from 'vitest';
import { buildAsteroidLayoutSignature, deriveAsteroidVisuals } from './ship-exterior-asteroid-visuals';

describe('ship-exterior asteroid visuals', () => {
  const samples = [
    {
      id: 'asteroid-a',
      scanned: false,
      scanProgress: 0,
      revealedMaterial: { material: 'Iron', rarity: 'Common' },
    },
    {
      id: 'asteroid-b',
      scanned: true,
      scanProgress: 100,
      revealedMaterial: { material: 'Nickel', rarity: 'Rare' },
    },
  ] as const;

  it('builds ship-specific layout signatures', () => {
    const first = buildAsteroidLayoutSignature('ship-a', samples, 'asteroid-a');
    const second = buildAsteroidLayoutSignature('ship-b', samples, 'asteroid-a');

    expect(first).not.toBe(second);
  });

  it('changes the layout signature when rarity changes', () => {
    const common = buildAsteroidLayoutSignature('ship-a', samples, 'asteroid-a');
    const rare = buildAsteroidLayoutSignature(
      'ship-a',
      [
        samples[0],
        {
          ...samples[1],
          revealedMaterial: { material: 'Nickel', rarity: 'Legendary' },
        },
      ],
      'asteroid-a',
    );

    expect(rare).not.toBe(common);
  });

  it('derives stable asteroid visuals per ship and target state', () => {
    const first = deriveAsteroidVisuals('ship-a', samples, 'asteroid-b');
    const second = deriveAsteroidVisuals('ship-a', samples, 'asteroid-b');

    expect(first).toEqual(second);
    expect(first[1].isTargeted).toBe(true);
    expect(first[0].position).not.toEqual(first[1].position);
  });

  it('makes rarer scanned asteroids more detailed and prominent', () => {
    const visuals = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'asteroid-common',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
        },
        {
          id: 'asteroid-legendary',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Legendary' },
        },
      ],
      null,
    );

    expect(visuals[1].radius).toBeGreaterThan(visuals[0].radius);
    expect(visuals[1].detail).toBeGreaterThanOrEqual(visuals[0].detail);
    expect(visuals[1].emissiveIntensity).toBeGreaterThan(visuals[0].emissiveIntensity);
  });

  it('makes hovered asteroids brighter and larger than non-hovered asteroids', () => {
    const visuals = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'asteroid-idle',
          scanned: false,
          scanProgress: 0,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
        },
        {
          id: 'asteroid-hovered',
          scanned: false,
          scanProgress: 0,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
        },
      ],
      null,
      'asteroid-hovered',
    );

    expect(visuals[1].isHovered).toBe(true);
    expect(visuals[1].scale).toBeGreaterThan(visuals[0].scale);
    expect(visuals[1].emissiveIntensity).toBeGreaterThan(visuals[0].emissiveIntensity);
  });
});
