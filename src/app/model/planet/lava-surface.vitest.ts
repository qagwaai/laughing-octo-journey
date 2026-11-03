import { describe, expect, it } from 'vitest';
import { derivePlanetClimate } from './planet-seed';
import { rasterizePlanet } from './planet-texture';

const PRESET = { width: 128, height: 64, includeNormal: false, includeMaterial: false, normalScale: 1 };

describe('lava planetary surface', () => {
  it('creates deterministic basalt maps with localized emissive magma fissures', () => {
    const climate = derivePlanetClimate('lava-sample', 'lava');
    const first = rasterizePlanet(climate, PRESET);
    const second = rasterizePlanet(climate, PRESET);
    const emissive = first.emissive;
    if (!emissive) throw new Error('Expected lava emissive map');

    let activePixels = 0;
    for (let offset = 0; offset < emissive.length; offset += 4) {
      if (emissive[offset] > 0) activePixels += 1;
    }

    expect(first.albedo).toEqual(second.albedo);
    expect(emissive).toEqual(second.emissive);
    expect(activePixels).toBeGreaterThan(first.width * first.height * 0.01);
    expect(activePixels).toBeLessThan(first.width * first.height * 0.5);
  });
});
