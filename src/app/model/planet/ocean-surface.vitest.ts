import { describe, expect, it } from 'vitest';
import { derivePlanetClimate } from './planet-seed';
import { rasterizePlanet, sampleAlbedoAt } from './planet-texture';

const PRESET = { width: 128, height: 64, includeNormal: false, includeMaterial: false, normalScale: 1 };

describe('ocean planetary surface', () => {
  it('creates a deep-blue global ocean with sparse land and no emissive texture', () => {
    const climate = derivePlanetClimate('ocean-sample', 'ocean');
    const raster = rasterizePlanet(climate, PRESET);
    const brightness = Array.from({ length: 64 }, (_, index) =>
      sampleAlbedoAt(climate, ((index * 37) % 64) / 64, ((index * 19) % 62 + 1) / 64),
    );
    const blueSamples = brightness.filter(([red, green, blue]) => blue > green * 1.35 && blue > red * 1.5);

    expect(climate.waterFraction).toBeGreaterThanOrEqual(0.82);
    expect(climate.waterFraction).toBeLessThanOrEqual(0.9);
    expect(raster.emissive).toBeUndefined();
    expect(blueSamples.length).toBeGreaterThan(40);
    expect(Math.max(...brightness.map(([, , blue]) => blue))).toBeGreaterThan(0.45);
  });
});
