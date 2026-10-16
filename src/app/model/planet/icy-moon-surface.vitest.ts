import { describe, expect, it } from 'vitest';
import { icyMoonAlbedo, icyMoonElevation, icyMoonMaterial } from './icy-moon-surface';
import { derivePlanetClimate } from './planet-seed';
import { directionFromEquirect } from './planet-surface';
import { rasterizePlanet, sampleAlbedoAt } from './planet-texture';

const preset = { width: 128, height: 64, includeNormal: true, includeMaterial: true, normalScale: 0.5 };

describe('icy-moon surface', () => {
  it('is versioned, deterministic, seed-dependent and distinct from Terran terrain', () => {
    const climate = derivePlanetClimate('ice-test', 'icy-moon', 'icy-moon');
    expect(climate.waterFraction).toBe(0);
    const raster = rasterizePlanet(climate, preset);
    expect(rasterizePlanet(climate, preset)).toEqual(raster);
    expect(rasterizePlanet(derivePlanetClimate('other', 'icy-moon', 'icy-moon'), preset).signature).not.toBe(
      raster.signature,
    );
    expect(rasterizePlanet(derivePlanetClimate('ice-test'), preset).signature).not.toBe(raster.signature);
    expect(raster.normal).toHaveLength(64 * 32 * 4);
    expect(raster.material).toHaveLength(64 * 32 * 4);
    expect(new Set(raster.normal).size).toBeGreaterThan(32);
    if (!raster.material) throw new Error('Expected an icy-moon material map');
    for (let index = 2; index < raster.material.length; index += 4) {
      expect(raster.material[index]).toBe(0);
    }
  });

  it('has dark mineral fractures, blue ice and bright snowy mountain elevations', () => {
    expect(icyMoonAlbedo(0.42)).toEqual([0.29, 0.25, 0.23]);
    expect(icyMoonAlbedo(0.515)).toEqual([0.72, 0.83, 0.9]);
    expect(icyMoonAlbedo(0.59)).toEqual([0.94, 0.96, 0.98]);
    expect(icyMoonMaterial(0.42)).toEqual([1, 0.48, 0]);
    expect(icyMoonMaterial(0.59)).toEqual([1, 0.88, 0]);

    const climate = derivePlanetClimate('ice-test', 'icy-moon', 'icy-moon');
    const elevations: number[] = [];
    for (let row = 0; row < 64; row += 1) {
      for (let column = 0; column < 128; column += 1) {
        elevations.push(icyMoonElevation(...directionFromEquirect(column / 128, row / 64), climate));
      }
    }
    expect(Math.min(...elevations)).toBeLessThan(0.44);
    expect(Math.max(...elevations)).toBeGreaterThan(0.55);
  });

  it('is continuous across the longitude seam and independent of longitude at the poles', () => {
    const climate = derivePlanetClimate('seam-test', 'icy-moon', 'icy-moon');
    for (const v of [0, 0.1, 0.4, 0.5, 0.8, 1]) {
      const left = sampleAlbedoAt(climate, 0, v);
      const right = sampleAlbedoAt(climate, 1, v);
      left.forEach((channel, index) => expect(channel).toBeCloseTo(right[index], 10));
    }
    for (const v of [0, 1]) {
      const first = sampleAlbedoAt(climate, 0, v);
      sampleAlbedoAt(climate, 0.7, v).forEach((channel, index) => expect(channel).toBeCloseTo(first[index], 10));
    }
  });
});
