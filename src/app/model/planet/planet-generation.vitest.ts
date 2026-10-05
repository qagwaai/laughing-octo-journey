import { describe, expect, it } from 'vitest';
import { fbm3, hashCell, lowbias32, ridged3, valueNoise3 } from './planet-noise';
import { createSeededRng, derivePlanetClimate, fnv1a32, PLANET_GENERATOR_VERSION } from './planet-seed';
import { directionFromEquirect, planetAlbedo, planetElevation, planetMaterial } from './planet-surface';
import { PLANET_LOD, type PlanetLodPreset, rasterizePlanet, sampleAlbedoAt, signatureOf } from './planet-texture';

const SMALL_PRESET: PlanetLodPreset = {
  width: 64,
  height: 32,
  includeNormal: false,
  includeMaterial: false,
  normalScale: 1,
};
const SMALL_NORMAL_PRESET: PlanetLodPreset = {
  width: 64,
  height: 32,
  includeNormal: true,
  includeMaterial: true,
  normalScale: 0.5,
};

describe('planet seeding', () => {
  it('produces a stable 32-bit hash', () => {
    expect(fnv1a32('planet-a')).toBe(fnv1a32('planet-a'));
    expect(fnv1a32('planet-a')).not.toBe(fnv1a32('planet-b'));
    expect(fnv1a32('planet-a')).toBeGreaterThanOrEqual(0);
    expect(fnv1a32('planet-a')).toBeLessThan(2 ** 32);
  });

  it('produces a seeded sequence in [0, 1)', () => {
    const first = createSeededRng(12345);
    const second = createSeededRng(12345);
    const samples = Array.from({ length: 32 }, () => first());

    expect(samples).toEqual(Array.from({ length: 32 }, () => second()));
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThan(1);
    }
  });

  it('derives identical climate for the same body id', () => {
    expect(derivePlanetClimate('body-42')).toEqual(derivePlanetClimate('body-42'));
  });

  it('derives different climate for different body ids', () => {
    expect(derivePlanetClimate('body-42').seed).not.toBe(derivePlanetClimate('body-43').seed);
  });

  it('keeps every climate scalar inside its documented range', () => {
    for (let index = 0; index < 200; index += 1) {
      const climate = derivePlanetClimate(`body-${index}`);
      expect(climate.archetype).toBe('terran');
      expect(climate.waterFraction).toBeGreaterThanOrEqual(0.45);
      expect(climate.waterFraction).toBeLessThanOrEqual(0.75);
      expect(climate.iceLatitudeDeg).toBeGreaterThanOrEqual(55);
      expect(climate.iceLatitudeDeg).toBeLessThanOrEqual(80);
      expect(climate.continentFrequency).toBeGreaterThanOrEqual(1.4);
      expect(climate.continentFrequency).toBeLessThanOrEqual(2.6);
      expect(climate.warpStrength).toBeGreaterThanOrEqual(0.15);
      expect(climate.warpStrength).toBeLessThanOrEqual(0.45);
      expect(climate.mountainAmplitude).toBeGreaterThanOrEqual(0.18);
      expect(climate.mountainAmplitude).toBeLessThanOrEqual(0.38);
      expect(climate.aridity).toBeGreaterThanOrEqual(0.15);
      expect(climate.aridity).toBeLessThanOrEqual(0.7);
      expect(Math.abs(climate.hueBias)).toBeLessThanOrEqual(0.06);
    }
  });

  it('changes the seed when the generator version changes', () => {
    expect(derivePlanetClimate('body-42').seed).toBe(
      fnv1a32(`${PLANET_GENERATOR_VERSION}|rocky|terran|body-42`),
    );
  });
});

describe('planet noise parity contract', () => {
  it('keeps the integer hash inside 32 unsigned bits', () => {
    for (const value of [0, 1, 0xffffffff, 0x7feb352d, 123456789]) {
      const hashed = lowbias32(value);
      expect(Number.isInteger(hashed)).toBe(true);
      expect(hashed).toBeGreaterThanOrEqual(0);
      expect(hashed).toBeLessThan(2 ** 32);
    }
  });

  it('avalanches adjacent inputs', () => {
    expect(lowbias32(1)).not.toBe(lowbias32(2));
    expect(hashCell(1, 0, 0, 7)).not.toBe(hashCell(0, 1, 0, 7));
  });

  it('handles negative lattice coordinates without collapsing', () => {
    expect(hashCell(-1, -2, -3, 9)).not.toBe(hashCell(1, 2, 3, 9));
    expect(hashCell(-1, -2, -3, 9)).toBeGreaterThanOrEqual(0);
  });

  /** Lattice values must stay float32-exact or the GPU mirror cannot match. */
  it('quantises lattice values to multiples of 1/65536', () => {
    for (let index = 0; index < 64; index += 1) {
      const value = valueNoise3(index, 0, 0, 1);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    const exact = (hashCell(3, 4, 5, 11) >>> 16) / 65536;
    expect(Number.isInteger(exact * 65536)).toBe(true);
    expect(Math.fround(exact)).toBe(exact);
  });

  it('is continuous across cell boundaries', () => {
    const before = valueNoise3(1.999999, 0.5, 0.5, 3);
    const after = valueNoise3(2.000001, 0.5, 0.5, 3);
    expect(Math.abs(before - after)).toBeLessThan(1e-4);
  });

  it('keeps fbm and ridged output normalised', () => {
    for (let index = 0; index < 50; index += 1) {
      const x = index * 0.37;
      expect(fbm3(x, x * 0.5, x * 0.25, 5, 6)).toBeGreaterThanOrEqual(0);
      expect(fbm3(x, x * 0.5, x * 0.25, 5, 6)).toBeLessThanOrEqual(1);
      expect(ridged3(x, x * 0.5, x * 0.25, 5, 4)).toBeGreaterThanOrEqual(0);
      expect(ridged3(x, x * 0.5, x * 0.25, 5, 4)).toBeLessThanOrEqual(1);
    }
  });
});

describe('planet surface model', () => {
  it('maps equirect coordinates onto the unit sphere', () => {
    for (const [u, v] of [
      [0, 0.5],
      [0.25, 0.5],
      [0.5, 0],
      [0.75, 1],
    ]) {
      const [x, y, z] = directionFromEquirect(u, v);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    }
  });

  it('places v=0 at the north pole and v=1 at the south pole', () => {
    expect(directionFromEquirect(0.5, 0)[1]).toBeCloseTo(1, 6);
    expect(directionFromEquirect(0.5, 1)[1]).toBeCloseTo(-1, 6);
  });

  it('keeps elevation within 0..1', () => {
    const climate = derivePlanetClimate('elevation-body');
    for (let index = 0; index < 200; index += 1) {
      const [x, y, z] = directionFromEquirect((index % 20) / 20, Math.floor(index / 20) / 10);
      const elevation = planetElevation(x, y, z, climate);
      expect(elevation).toBeGreaterThanOrEqual(0);
      expect(elevation).toBeLessThanOrEqual(1);
    }
  });

  it('renders ocean below sea level and land above it', () => {
    const climate = derivePlanetClimate('ocean-body');
    const ocean = planetAlbedo(climate.seaLevel - climate.oceanSpan * 0.5, 0, climate);
    const land = planetAlbedo(climate.seaLevel + climate.landSpan * 0.1, 0, climate);

    expect(ocean[2]).toBeGreaterThan(ocean[0]);
    expect(land[0] + land[1]).toBeGreaterThan(ocean[0] + ocean[1]);
  });

  it('caps the poles with ice', () => {
    const climate = derivePlanetClimate('ice-body');
    const pole = planetAlbedo(climate.seaLevel + climate.landSpan * 0.1, 1, climate);
    expect(pole[0]).toBeGreaterThan(0.8);
    expect(pole[1]).toBeGreaterThan(0.8);
    expect(pole[2]).toBeGreaterThan(0.8);
  });

  it('delivers the requested ocean coverage as an area fraction', () => {
    // waterFraction used to be compared directly against the continent field,
    // which is roughly Gaussian rather than uniform, so the requested value
    // bore little relation to the ocean area actually rendered: one body asked
    // for 47% water and got 29%, another asked for 68% and got 94%.
    for (const bodyId of ['coverage-a', 'coverage-b', 'coverage-c', 'coverage-d']) {
      const climate = derivePlanetClimate(bodyId);
      const width = 128;
      const height = 64;
      let area = 0;
      let water = 0;

      for (let y = 0; y < height; y += 1) {
        const v = (y + 0.5) / height;
        // Equirectangular rows shrink towards the poles, so weight by cos(lat)
        // or the caps dominate the average.
        const weight = Math.cos((0.5 - v) * Math.PI);
        for (let x = 0; x < width; x += 1) {
          const [dx, dy, dz] = directionFromEquirect((x + 0.5) / width, v);
          area += weight;
          if (planetElevation(dx, dy, dz, climate) < climate.seaLevel) water += weight;
        }
      }

      expect(water / area).toBeCloseTo(climate.waterFraction, 1);
    }
  });

  it('makes water smoother and land rougher', () => {
    const climate = derivePlanetClimate('material-body');
    const water = planetMaterial(climate.seaLevel - climate.oceanSpan * 0.5, 0, climate);
    const land = planetMaterial(climate.seaLevel + climate.landSpan * 0.3, 0, climate);

    expect(water[1]).toBeLessThan(0.4);
    expect(land[1]).toBeGreaterThan(0.8);
    expect(water[1]).toBeLessThan(land[1]);
    // Water reflects more of the sun than dirt does, which is what sells it as wet.
    expect(water[2]).toBeGreaterThan(land[2]);
  });

  it('keeps material channels inside 0..1', () => {
    const climate = derivePlanetClimate('material-clamp-body');
    for (let index = 0; index <= 20; index += 1) {
      for (const channel of planetMaterial(index / 20, index / 10 - 1, climate)) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps albedo channels inside 0..1', () => {
    const climate = derivePlanetClimate('clamp-body');
    for (let index = 0; index <= 20; index += 1) {
      const color = planetAlbedo(index / 20, index / 20 - 0.5, climate);
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('planet rasterisation', () => {
  it('fills an opaque albedo buffer of the requested size', () => {
    const raster = rasterizePlanet(derivePlanetClimate('raster-body'), SMALL_PRESET);

    expect(raster.width).toBe(64);
    expect(raster.height).toBe(32);
    expect(raster.albedo).toHaveLength(64 * 32 * 4);
    expect(raster.normal).toBeUndefined();
    for (let index = 3; index < raster.albedo.length; index += 4) {
      expect(raster.albedo[index]).toBe(255);
    }
  });

  it('emits a half-resolution normal map when the preset asks for one', () => {
    const raster = rasterizePlanet(derivePlanetClimate('normal-body'), SMALL_NORMAL_PRESET);

    expect(raster.normalWidth).toBe(32);
    expect(raster.normalHeight).toBe(16);
    expect(raster.normal).toHaveLength(32 * 16 * 4);
  });

  it('encodes normals pointing predominantly outward', () => {
    const raster = rasterizePlanet(derivePlanetClimate('normal-body'), SMALL_NORMAL_PRESET);
    const normal = raster.normal;
    if (!normal) throw new Error('expected a normal map');

    for (let index = 2; index < normal.length; index += 4) {
      expect(normal[index]).toBeGreaterThan(127);
    }
  });

  it('encodes a flat normal over open water', () => {
    const climate = derivePlanetClimate('normal-body');
    const preset: PlanetLodPreset = {
      width: 128,
      height: 64,
      includeNormal: true,
      includeMaterial: false,
      normalScale: 1,
    };
    const raster = rasterizePlanet(climate, preset);
    const normal = raster.normal;
    if (!normal) throw new Error('expected a normal map');

    // An ocean is an equipotential surface, so any texel whose own elevation
    // and that of its four neighbours all sit below sea level must encode a
    // perfectly flat normal regardless of the seafloor relief underneath.
    const { normalWidth: width, normalHeight: height } = raster;
    if (width === undefined || height === undefined) throw new Error('expected normal map dimensions');
    const elevationAt = (x: number, y: number): number => {
      const v = (y + 0.5) / height;
      const u = (x + 0.5) / width;
      const [dx, dy, dz] = directionFromEquirect(u, v);
      return planetElevation(dx, dy, dz, climate);
    };

    let checked = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const submerged =
          elevationAt(x, y) < climate.seaLevel &&
          elevationAt(x - 1, y) < climate.seaLevel &&
          elevationAt(x + 1, y) < climate.seaLevel &&
          elevationAt(x, y - 1) < climate.seaLevel &&
          elevationAt(x, y + 1) < climate.seaLevel;
        if (!submerged) continue;

        const index = (y * width + x) * 4;
        expect(normal[index]).toBe(128);
        expect(normal[index + 1]).toBe(128);
        expect(normal[index + 2]).toBe(255);
        checked += 1;
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  it('bakes a material map whose water reads smoother than its land', () => {
    const climate = derivePlanetClimate('normal-body');
    const raster = rasterizePlanet(climate, SMALL_NORMAL_PRESET);
    const material = raster.material;
    const { normalWidth: width, normalHeight: height } = raster;
    if (!material || width === undefined || height === undefined) {
      throw new Error('expected a material map');
    }

    expect(material).toHaveLength(width * height * 4);

    let waterRoughness = 0;
    let waterCount = 0;
    let landRoughness = 0;
    let landCount = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [dx, dy, dz] = directionFromEquirect((x + 0.5) / width, (y + 0.5) / height);
        const roughness = material[(y * width + x) * 4 + 1];
        if (planetElevation(dx, dy, dz, climate) < climate.seaLevel) {
          waterRoughness += roughness;
          waterCount += 1;
        } else {
          landRoughness += roughness;
          landCount += 1;
        }
      }
    }

    expect(waterCount).toBeGreaterThan(0);
    expect(landCount).toBeGreaterThan(0);
    expect(waterRoughness / waterCount).toBeLessThan(landRoughness / landCount);
  });

  it('is deterministic for a given body id', () => {
    const first = rasterizePlanet(derivePlanetClimate('stable-body'), SMALL_PRESET);
    const second = rasterizePlanet(derivePlanetClimate('stable-body'), SMALL_PRESET);

    expect(second.signature).toBe(first.signature);
    expect(Array.from(second.albedo)).toEqual(Array.from(first.albedo));
  });

  it('produces different imagery for different body ids', () => {
    const first = rasterizePlanet(derivePlanetClimate('body-alpha'), SMALL_PRESET);
    const second = rasterizePlanet(derivePlanetClimate('body-beta'), SMALL_PRESET);

    expect(second.signature).not.toBe(first.signature);
  });

  it('changes signature when pixels change', () => {
    const raster = rasterizePlanet(derivePlanetClimate('signature-body'), SMALL_PRESET);
    const mutated = Uint8ClampedArray.from(raster.albedo);
    mutated[0] = mutated[0] ^ 0xff;

    expect(signatureOf(mutated)).not.toBe(signatureOf(raster.albedo));
  });

  it('exposes the documented LOD budget', () => {
    expect(PLANET_LOD.l0).toEqual({
      width: 256,
      height: 128,
      includeNormal: false,
      includeMaterial: false,
      normalScale: 1,
    });
    expect(PLANET_LOD.l1).toEqual({
      width: 2048,
      height: 1024,
      includeNormal: true,
      includeMaterial: true,
      normalScale: 0.5,
    });
  });

  it('matches the rasteriser when sampled directly', () => {
    const climate = derivePlanetClimate('sample-body');
    const raster = rasterizePlanet(climate, SMALL_PRESET);
    const u = (10 + 0.5) / SMALL_PRESET.width;
    const v = (6 + 0.5) / SMALL_PRESET.height;
    const [r, g, b] = sampleAlbedoAt(climate, u, v);
    const offset = (6 * SMALL_PRESET.width + 10) * 4;

    expect(Math.round(r * 255)).toBe(raster.albedo[offset]);
    expect(Math.round(g * 255)).toBe(raster.albedo[offset + 1]);
    expect(Math.round(b * 255)).toBe(raster.albedo[offset + 2]);
  });
});
