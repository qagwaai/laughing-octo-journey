import { describe, expect, it } from 'vitest';
import {
  buildAsteroidLayoutSignature,
  deriveAsteroidVisuals,
  resolveAsteroidDiameterRadius,
} from './ship-exterior-asteroid-visuals';

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

  it('changes the layout signature when persisted visual inputs change', () => {
    const base = buildAsteroidLayoutSignature('ship-a', samples, null);
    const changed = buildAsteroidLayoutSignature(
      'ship-a',
      [
        {
          ...samples[0],
          meshProfileKey: 'v1|pv=icosahedron:1|rv=rock:2|s=1.00,1.00,1.00',
          estimatedDiameterM: 42,
        },
        samples[1],
      ],
      null,
    );

    expect(changed).not.toBe(base);
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

  it('uses the catalog profile for scanned asteroid materials', () => {
    const [visual] = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'iron',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
        },
      ],
      null,
    );

    expect(visual.materialProfile?.material).toBe('Iron');
    expect(visual.color).toBe(0x8f99a7);
  });

  it('keeps the revealed catalog material color when a scanned asteroid is targeted', () => {
    const sample = {
      id: 'iron',
      scanned: true,
      scanProgress: 100,
      revealedMaterial: { material: 'Iron', rarity: 'Common' as const },
    };

    const [untargeted] = deriveAsteroidVisuals('ship-a', [sample], null);
    const [targeted] = deriveAsteroidVisuals('ship-a', [sample], 'iron');

    expect(targeted.isTargeted).toBe(true);
    expect(targeted.color).toBe(untargeted.color);
    expect(targeted.emissive).toBe(untargeted.emissive);
  });

  it('does not expose catalog material data before scan completion', () => {
    const [visual] = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'iron',
          scanned: false,
          scanProgress: 0,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
        },
      ],
      null,
    );

    expect(visual.materialProfile).toBeNull();
  });

  describe('resolveAsteroidDiameterRadius', () => {
    it('returns null for missing or invalid diameters so callers fall back to legacy sizing', () => {
      expect(resolveAsteroidDiameterRadius(null)).toBeNull();
      expect(resolveAsteroidDiameterRadius(undefined)).toBeNull();
      expect(resolveAsteroidDiameterRadius(0)).toBeNull();
      expect(resolveAsteroidDiameterRadius(-50)).toBeNull();
      expect(resolveAsteroidDiameterRadius(Number.NaN)).toBeNull();
    });

    it('clamps to the minimum radius at or below the lower diameter boundary', () => {
      expect(resolveAsteroidDiameterRadius(40)).toBeCloseTo(0.16, 5);
      expect(resolveAsteroidDiameterRadius(1)).toBeCloseTo(0.16, 5);
    });

    it('clamps to the maximum radius at or above the upper diameter boundary', () => {
      expect(resolveAsteroidDiameterRadius(9400)).toBeCloseTo(0.62, 5);
      expect(resolveAsteroidDiameterRadius(50000)).toBeCloseTo(0.62, 5);
    });

    it('maps typical diameters to a value between the boundaries on a log curve', () => {
      const small = resolveAsteroidDiameterRadius(100);
      const mid = resolveAsteroidDiameterRadius(1000);
      const large = resolveAsteroidDiameterRadius(5000);

      expect(small).toBeGreaterThan(0.16);
      expect(small).toBeLessThan(mid!);
      expect(mid).toBeLessThan(large!);
      expect(large).toBeLessThan(0.62);
    });

    it('resolves deterministically for repeated calls with the same diameter', () => {
      const first = resolveAsteroidDiameterRadius(2200);
      const second = resolveAsteroidDiameterRadius(2200);

      expect(first).toBe(second);
    });
  });

  it('makes diameter the dominant driver of scanned asteroid size, regardless of rarity', () => {
    const visuals = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'asteroid-small-legendary',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Legendary' },
          estimatedDiameterM: 294,
        },
        {
          id: 'asteroid-large-common',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
          estimatedDiameterM: 5250,
        },
      ],
      null,
    );

    // A much larger diameter must render larger even when the smaller asteroid is a rarer tier,
    // since diameter is the authoritative physical-size signal and rarity/jitter are secondary.
    expect(visuals[1].radius).toBeGreaterThan(visuals[0].radius);
  });

  it('does not apply diameter-driven radius before scan completion', () => {
    const unscanned = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'asteroid-huge',
          scanned: false,
          scanProgress: 0,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
          estimatedDiameterM: 9400,
        },
      ],
      null,
    );
    const scanned = deriveAsteroidVisuals(
      'ship-a',
      [
        {
          id: 'asteroid-huge',
          scanned: true,
          scanProgress: 100,
          revealedMaterial: { material: 'Iron', rarity: 'Common' },
          estimatedDiameterM: 9400,
        },
      ],
      null,
    );

    // Pre-scan radius stays within the legacy jitter range, well below the diameter-driven radius.
    expect(unscanned[0].radius).toBeLessThan(0.5);
    expect(scanned[0].radius).toBeGreaterThan(unscanned[0].radius);
  });
});
