import { describe, expect, it } from 'vitest';
import { derivePlanetClimate } from './planet-seed';
import { directionFromEquirect } from './planet-surface';
import { rasterizePlanet, sampleAlbedoAt } from './planet-texture';
import { rockyMoonAlbedo, rockyMoonElevation, rockyMoonMaterial } from './rocky-moon-surface';

const preset = { width: 128, height: 64, includeNormal: true, includeMaterial: true, normalScale: 0.5 };

function normalRelief(normal: Uint8ClampedArray | undefined): number {
  if (!normal) throw new Error('Expected a normal map');
  let relief = 0;
  for (let index = 0; index < normal.length; index += 4) {
    relief += Math.hypot(normal[index] - 127.5, normal[index + 1] - 127.5);
  }
  return relief / (normal.length / 4);
}

describe('rocky-moon surface', () => {
  it('is deterministic, seed-dependent and distinct from icy and Terran terrain', () => {
    const climate = derivePlanetClimate('rock-test', 'rocky-moon');
    expect(climate.waterFraction).toBe(0);
    expect(climate.seaLevel).toBe(0);
    const raster = rasterizePlanet(climate, preset);
    expect(rasterizePlanet(climate, preset)).toEqual(raster);
    expect(rasterizePlanet(derivePlanetClimate('other', 'rocky-moon'), preset).signature).not.toBe(raster.signature);
    expect(rasterizePlanet(derivePlanetClimate('rock-test'), preset).signature).not.toBe(raster.signature);
    const ice = rasterizePlanet(derivePlanetClimate('rock-test', 'icy-moon'), preset);
    expect(ice.signature).not.toBe(raster.signature);
    expect(normalRelief(raster.normal)).toBeGreaterThan(normalRelief(ice.normal) * 1.3);
    expect(raster.normal).toHaveLength(64 * 32 * 4);
    expect(raster.material).toHaveLength(64 * 32 * 4);
    if (!raster.material) throw new Error('Expected rocky-moon material');
    for (let index = 0; index < raster.material.length; index += 4) {
      expect(raster.material[index + 1]).toBeGreaterThanOrEqual(224);
      expect(raster.material[index + 2]).toBe(0);
      expect(raster.material[index + 3]).toBe(255);
    }
  });

  it('has dark regolith plains and brighter gray-brown highlands without ice or vegetation', () => {
    expect(rockyMoonAlbedo(0.34)).toEqual([0.22, 0.215, 0.21]);
    expect(rockyMoonAlbedo(0.6)).toEqual([0.57, 0.55, 0.52]);
    expect(rockyMoonAlbedo(0.72)).toEqual([0.7, 0.68, 0.65]);
    expect(rockyMoonMaterial(0.34)).toEqual([1, 0.88, 0]);
    expect(rockyMoonMaterial(0.65)).toEqual([1, 0.98, 0]);
    const climate = derivePlanetClimate('rock-test', 'rocky-moon');
    const elevations: number[] = [];
    for (let row = 0; row < 64; row += 1) {
      for (let column = 0; column < 128; column += 1) {
        elevations.push(rockyMoonElevation(...directionFromEquirect(column / 128, row / 64), climate));
      }
    }
    expect(Math.min(...elevations)).toBeGreaterThan(0);
    expect(Math.min(...elevations)).toBeLessThan(0.3);
    expect(Math.max(...elevations)).toBeGreaterThan(0.64);
    expect(elevations.filter((elevation) => elevation < 0.4).length / elevations.length).toBeGreaterThan(0.05);
  });

  it('stays continuous across the longitude seam and at both poles', () => {
    const climate = derivePlanetClimate('seam-test', 'rocky-moon');
    for (const v of [0, 0.1, 0.4, 0.5, 0.8, 1]) {
      const left = sampleAlbedoAt(climate, 0, v);
      sampleAlbedoAt(climate, 1, v).forEach((channel, index) => expect(channel).toBeCloseTo(left[index], 10));
    }
    for (const v of [0, 1]) {
      const first = sampleAlbedoAt(climate, 0, v);
      sampleAlbedoAt(climate, 0.7, v).forEach((channel, index) => expect(channel).toBeCloseTo(first[index], 10));
    }
  });
});
