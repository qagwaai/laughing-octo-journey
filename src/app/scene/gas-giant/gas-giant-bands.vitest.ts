import { describe, expect, it } from 'vitest';
import { deriveGasGiantProfile } from '../../model/planet/gas-giant-profile';
import { createGasGiantBandTexture, rasterizeGasGiantBands } from './gas-giant-bands';

describe('gas giant band bake', () => {
  const profile = deriveGasGiantProfile('bands-test', { palette: 'jovian' });

  it('rasterizes an opaque RGBA image of the requested size', () => {
    const data = rasterizeGasGiantBands(profile, { width: 64, height: 32 });
    expect(data.length).toBe(64 * 32 * 4);
    for (let index = 3; index < data.length; index += 4) expect(data[index]).toBe(255);
  });

  it('is deterministic', () => {
    const a = rasterizeGasGiantBands(profile, { width: 32, height: 16 });
    const b = rasterizeGasGiantBands(profile, { width: 32, height: 16 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('varies colour by latitude', () => {
    const width = 16;
    const height = 64;
    const data = rasterizeGasGiantBands(profile, { width, height });
    const rows = new Set<string>();
    for (let row = 0; row < height; row++) {
      const offset = row * width * 4;
      rows.add(`${data[offset] >> 4},${data[offset + 1] >> 4},${data[offset + 2] >> 4}`);
    }
    expect(rows.size).toBeGreaterThan(3);
  });

  it('creates a horizontally repeating texture', () => {
    const texture = createGasGiantBandTexture(profile, { width: 32, height: 16 });
    expect(texture.image.width).toBe(32);
    expect(texture.image.height).toBe(16);
    texture.dispose();
  });
});
