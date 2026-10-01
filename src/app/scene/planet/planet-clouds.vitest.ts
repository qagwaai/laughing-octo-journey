import { describe, expect, it } from 'vitest';
import {
  CLOUD_DRIFT_RADIANS_PER_SECOND,
  createPlanetCloudTexture,
  DEFAULT_CLOUD_COVERAGE,
  DEFAULT_THICK_CLOUD_COVERAGE,
  PlanetCloudSettings,
} from './planet-clouds';

describe('terran cloud mask', () => {
  it('drifts by one revolution in ten minutes of rendered time', () => {
    expect(CLOUD_DRIFT_RADIANS_PER_SECOND * 600).toBeCloseTo(2 * Math.PI, 10);
    expect(CLOUD_DRIFT_RADIANS_PER_SECOND * 60).toBeCloseTo(Math.PI / 5, 10);
  });

  it('is repeatable for a body and varies by body id', () => {
    const first = createPlanetCloudTexture('world-1', 128, 64);
    const second = createPlanetCloudTexture('world-1', 128, 64);
    const other = createPlanetCloudTexture('world-2', 128, 64);
    first.setCoverage(25);
    second.setCoverage(25);
    other.setCoverage(25);
    expect(first.texture.image.data).toEqual(second.texture.image.data);
    expect(first.texture.image.data).not.toEqual(other.texture.image.data);
    first.texture.dispose();
    second.texture.dispose();
    other.texture.dispose();
  });

  it('adjusts opacity without changing the seeded field or texture identity', () => {
    const clouds = createPlanetCloudTexture('coverage-world', 128, 64);
    const pixels = clouds.texture.image.data as Uint8Array;
    const texture = clouds.texture;
    clouds.setCoverage(0);
    expect(pixels.every((value, index) => index % 4 !== 3 || value === 0)).toBe(true);
    clouds.setCoverage(25);
    const quarter = pixels.filter((value, index) => index % 4 === 3 && value > 100).length;
    expect(quarter / (128 * 64)).toBeGreaterThan(0.12);
    expect(quarter / (128 * 64)).toBeLessThan(0.4);
    clouds.setCoverage(70);
    const dense = pixels.filter((value, index) => index % 4 === 3 && value > 100).length;
    expect(dense).toBeGreaterThan(quarter);
    clouds.setCoverage(100);
    expect(pixels.every((value) => value === 255)).toBe(true);
    expect(clouds.texture).toBe(texture);
    clouds.texture.dispose();
  });

  it('retains independent coverage settings when styles are switched', () => {
    const settings = new PlanetCloudSettings();
    expect(settings.coverage()).toBe(DEFAULT_CLOUD_COVERAGE);
    settings.setCoverage(40);
    settings.style.set('thick');
    expect(settings.coverage()).toBe(DEFAULT_THICK_CLOUD_COVERAGE);
    settings.setCoverage(87);
    settings.style.set('thin');
    expect(settings.coverage()).toBe(40);
    settings.style.set('thick');
    expect(settings.coverage()).toBe(87);
  });

  it('makes a seeded pale, varied deck that obscures most of the globe at its default coverage', () => {
    const first = createPlanetCloudTexture('venus-like', 256, 128, 'thick');
    const second = createPlanetCloudTexture('venus-like', 256, 128, 'thick');
    const different = createPlanetCloudTexture('other-world', 256, 128, 'thick');
    first.setCoverage(DEFAULT_THICK_CLOUD_COVERAGE);
    second.setCoverage(DEFAULT_THICK_CLOUD_COVERAGE);
    different.setCoverage(DEFAULT_THICK_CLOUD_COVERAGE);
    const pixels = first.texture.image.data as Uint8Array;
    const alpha = Array.from({ length: pixels.length / 4 }, (_, index) => pixels[index * 4 + 3]);
    expect(alpha.filter((value) => value >= 220).length / alpha.length).toBeGreaterThan(0.9);
    expect(new Set(alpha).size).toBeGreaterThan(2);
    const greens = Array.from({ length: alpha.length }, (_, index) => pixels[index * 4 + 1]);
    expect(Math.max(...greens) - Math.min(...greens)).toBeGreaterThan(20);
    expect(pixels[0]).toBeGreaterThan(pixels[2]);
    expect(first.texture.image.data).toEqual(second.texture.image.data);
    expect(first.texture.image.data).not.toEqual(different.texture.image.data);
    first.setCoverage(0);
    expect(alpha.every((_, index) => pixels[index * 4 + 3] === 0)).toBe(true);
    first.setCoverage(100);
    expect(alpha.every((_, index) => pixels[index * 4 + 3] === 255)).toBe(true);
    first.texture.dispose();
    second.texture.dispose();
    different.texture.dispose();
  });
});
