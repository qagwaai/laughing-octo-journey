import { describe, expect, it } from 'vitest';
import { derivePlanetClimate } from './planet-seed';
import { directionFromEquirect } from './planet-surface';
import { rasterizePlanet, sampleAlbedoAt } from './planet-texture';
import { superEarthAlbedo, superEarthElevation, superEarthMaterial } from './super-earth-surface';
import { SUPER_EARTH_SURFACE_GLSL } from '../../scene/planet/super-earth-shader';
import { buildPlanetShaderUniforms } from '../../scene/planet/planet-shader';

const preset = { width: 128, height: 64, includeNormal: true, includeMaterial: true, normalScale: 0.5 };

describe('super-earth surface', () => {
  it('is deterministic, seed-dependent and distinct from Terran and rocky-moon terrain', () => {
    const climate = derivePlanetClimate('super-test', 'super-earth');
    expect(climate.waterFraction).toBe(0);
    expect(climate.seaLevel).toBe(0);
    const raster = rasterizePlanet(climate, preset);
    expect(rasterizePlanet(climate, preset)).toEqual(raster);
    expect(rasterizePlanet(derivePlanetClimate('other', 'super-earth'), preset).signature).not.toBe(raster.signature);
    expect(rasterizePlanet(derivePlanetClimate('super-test'), preset).signature).not.toBe(raster.signature);
    expect(rasterizePlanet(derivePlanetClimate('super-test', 'rocky-moon'), preset).signature).not.toBe(
      raster.signature,
    );
    expect(raster.normal).toHaveLength(64 * 32 * 4);
    expect(raster.material).toHaveLength(64 * 32 * 4);
  });

  it('has dark basalt lowlands, brighter uplands and frost only near the poles', () => {
    const lowland = superEarthAlbedo(0.3, 0);
    const upland = superEarthAlbedo(0.7, 0);
    const pole = superEarthAlbedo(0.3, 0.95);
    expect(lowland[0]).toBeLessThan(0.2);
    expect(upland[0]).toBeGreaterThan(lowland[0] * 2);
    expect(pole.every((channel) => channel > 0.8)).toBe(true);
    expect(superEarthAlbedo(0.3, 0.5)).toEqual(lowland);
    expect(superEarthMaterial(0.3, 0)).toEqual([1, 0.8, 0]);
    expect(superEarthMaterial(0.3, 1)[1]).toBeCloseTo(0.62, 6);
  });

  it('has more relief than the rocky-moon range without dropping below zero', () => {
    const climate = derivePlanetClimate('relief', 'super-earth');
    const elevations: number[] = [];
    for (let row = 0; row < 48; row += 1) {
      for (let column = 0; column < 96; column += 1) {
        elevations.push(superEarthElevation(...directionFromEquirect(column / 96, row / 48), climate));
      }
    }
    expect(Math.min(...elevations)).toBeGreaterThan(0.15);
    expect(Math.max(...elevations) - Math.min(...elevations)).toBeGreaterThan(0.35);
  });

  it('stays continuous across the longitude seam and at both poles', () => {
    const climate = derivePlanetClimate('seam-test', 'super-earth');
    for (const v of [0, 0.1, 0.4, 0.5, 0.8, 1]) {
      const left = sampleAlbedoAt(climate, 0, v);
      sampleAlbedoAt(climate, 1, v).forEach((channel, index) => expect(channel).toBeCloseTo(left[index], 10));
    }
    for (const v of [0, 1]) {
      const first = sampleAlbedoAt(climate, 0, v);
      sampleAlbedoAt(climate, 0.7, v).forEach((channel, index) => expect(channel).toBeCloseTo(first[index], 10));
    }
  });

  it('mirrors the CPU constants in the GPU shader and selects it through a uniform', () => {
    for (const constant of ['0.7', '0.86', '0.42', '0.66', '0.13', '0.86', '0.62']) {
      expect(SUPER_EARTH_SURFACE_GLSL).toContain(constant);
    }
    expect(buildPlanetShaderUniforms(derivePlanetClimate('gpu', 'super-earth'), 0, 8, 4).uSuperEarth).toBe(1);
    expect(buildPlanetShaderUniforms(derivePlanetClimate('gpu'), 0, 8, 4).uSuperEarth).toBe(0);
  });
});