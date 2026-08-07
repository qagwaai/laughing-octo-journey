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

  it('derives stable asteroid visuals per ship and target state', () => {
    const first = deriveAsteroidVisuals('ship-a', samples, 'asteroid-b');
    const second = deriveAsteroidVisuals('ship-a', samples, 'asteroid-b');

    expect(first).toEqual(second);
    expect(first[1].isTargeted).toBe(true);
    expect(first[0].position).not.toEqual(first[1].position);
  });
});
