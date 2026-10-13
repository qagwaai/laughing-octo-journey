import { describe, expect, it } from 'vitest';
import { createTitanHazeTexture, resolveDedicatedAtmosphere, resolveVenusAtmosphereUrl } from './planet-atmosphere';

describe('dedicated planet atmospheres', () => {
  it('selects treatments only from the exact Sol catalog identity', () => {
    expect(resolveDedicatedAtmosphere({ catalogIdentity: { namespace: 'sol', key: 'venus' } })).toBe('venus');
    expect(resolveDedicatedAtmosphere({ catalogIdentity: { namespace: 'sol', key: 'titan' } })).toBe('titan');
    expect(resolveDedicatedAtmosphere({ catalogIdentity: { namespace: 'other', key: 'venus' } })).toBeNull();
    expect(resolveDedicatedAtmosphere({ catalogIdentity: { namespace: 'sol', key: 'earth' } })).toBeNull();
  });

  it('selects the appropriately sized Venus WebP texture by view detail', () => {
    expect(resolveVenusAtmosphereUrl('overview')).toContain('venus-atmosphere-2k.webp');
    expect(resolveVenusAtmosphereUrl('detail')).toContain('venus-atmosphere-4k.webp');
  });

  it('creates deterministic opaque tan Titan haze textures matched to the Cassini reference', () => {
    const first = createTitanHazeTexture(32, 16);
    const second = createTitanHazeTexture(32, 16);
    expect(first.image.width).toBe(32);
    expect(first.image.height).toBe(16);
    const firstPixels = first.image.data;
    const secondPixels = second.image.data;
    expect(firstPixels).not.toBeNull();
    expect(secondPixels).not.toBeNull();
    if (!firstPixels || !secondPixels) throw new Error('Titan haze texture did not contain pixel data.');
    expect(Array.from(firstPixels)).toEqual(Array.from(secondPixels));
    expect(firstPixels.filter((_value, index) => index % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
    expect(firstPixels[0]).toBeGreaterThan(firstPixels[1]);
    expect(firstPixels[1]).toBeGreaterThan(firstPixels[2]);
    expect(new Set(firstPixels.filter((_value, index) => index % 4 === 0)).size).toBeGreaterThan(1);
    const pixelValues = Array.from(firstPixels as ArrayLike<number>);
    const channelMean = (channel: number) =>
      pixelValues.filter((_value, index) => index % 4 === channel).reduce((sum, value) => sum + value, 0) /
      (pixelValues.length / 4);
    const [r, g, b] = [channelMean(0), channelMean(1), channelMean(2)];
    // PIA06230 lit-disk median is about rgb(155, 129, 68): green stays close to red, unlike red-orange.
    expect(g / r).toBeGreaterThan(0.75);
    expect(g / r).toBeLessThan(0.9);
    expect(b / r).toBeGreaterThan(0.3);
    expect(b / r).toBeLessThan(0.5);
    first.dispose();
    second.dispose();
  });

  it('rejects invalid Titan haze texture dimensions', () => {
    expect(() => createTitanHazeTexture(1, 16)).toThrow(/dimensions/);
    expect(() => createTitanHazeTexture(16, Number.NaN)).toThrow(/dimensions/);
  });
});
