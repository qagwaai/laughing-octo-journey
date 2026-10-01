import { computed, Injectable, signal } from '@angular/core';
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import { fbm3 } from '../../model/planet/planet-noise';
import { fnv1a32 } from '../../model/planet/planet-seed';
import { directionFromEquirect, smoothstep } from '../../model/planet/planet-surface';

export const DEFAULT_CLOUD_COVERAGE = 25;
export const DEFAULT_THICK_CLOUD_COVERAGE = 98;
export const DEFAULT_STORM_ACTIVITY = 60;
export const CLOUD_DRIFT_RADIANS_PER_SECOND = (Math.PI * 2) / 600;
export type PlanetCloudStyle = 'thin' | 'thick';

@Injectable({ providedIn: 'root' })
export class PlanetCloudSettings {
  readonly enabled = signal(true);
  readonly style = signal<PlanetCloudStyle>('thin');
  readonly thinCoverage = signal(DEFAULT_CLOUD_COVERAGE);
  readonly thickCoverage = signal(DEFAULT_THICK_CLOUD_COVERAGE);
  /** How strongly the cloud layer organizes into vortices, independent of cloud coverage. */
  readonly stormActivity = signal(DEFAULT_STORM_ACTIVITY);
  readonly coverage = computed(() => (this.style() === 'thin' ? this.thinCoverage() : this.thickCoverage()));

  setCoverage(percent: number): void {
    if (this.style() === 'thin') this.thinCoverage.set(percent);
    else this.thickCoverage.set(percent);
  }
}

export interface PlanetCloudTexture {
  texture: DataTexture;
  setCoverage(percent: number): void;
}

/** An independently seeded, reusable mask; adjusting coverage never resamples noise. */
export function createPlanetCloudTexture(
  bodyId: string,
  width: number,
  height: number,
  style: PlanetCloudStyle = 'thin',
): PlanetCloudTexture {
  const samples = new Uint8Array(width * height);
  const pixels = new Uint8Array(width * height * 4);
  const histogram = new Float64Array(256);
  const seed = fnv1a32(style === 'thin' ? `terran-clouds-v1|${bodyId}` : `terran-clouds-v1|thick|${bodyId}`);
  let totalWeight = 0;

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    const weight = Math.sin(Math.PI * v);
    for (let x = 0; x < width; x++) {
      const [dx, dy, dz] = directionFromEquirect((x + 0.5) / width, v);
      const warp = style === 'thick' ? fbm3(dx * 2.3, dy * 2.3, dz * 2.3, seed, 3) : 0;
      const detail = fbm3(
        dx * (style === 'thin' ? 4.5 : 5),
        dy * (style === 'thin' ? 8 : 5),
        dz * (style === 'thin' ? 4.5 : 5),
        style === 'thin' ? seed : seed ^ 0x7feb352d,
        3,
      );
      const swirl = style === 'thick' ? Math.sin(dy * 18 + (warp - 0.5) * 10) : 0;
      const value = Math.round((style === 'thin' ? detail : 0.5 + swirl * 0.22 + (detail - 0.5) * 0.28) * 255);
      const index = y * width + x;
      samples[index] = value;
      histogram[value] += weight;
      totalWeight += weight;
      const shade = 0.5 + swirl * 0.25 + (warp - 0.5) * 0.4;
      pixels[index * 4] = style === 'thin' ? 255 : Math.round(150 + 70 * shade);
      pixels[index * 4 + 1] = style === 'thin' ? 255 : Math.round(129 + 78 * shade);
      pixels[index * 4 + 2] = style === 'thin' ? 255 : Math.round(108 + 80 * shade);
    }
  }

  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;

  return {
    texture,
    setCoverage(percent: number): void {
      const coverage = Math.max(0, Math.min(100, percent));
      let threshold = 255;
      let area = 0;
      for (let value = 255; value >= 0; value--) {
        area += histogram[value];
        if (area >= (coverage / 100) * totalWeight) {
          threshold = value;
          break;
        }
      }
      for (let index = 0; index < samples.length; index++) {
        pixels[index * 4 + 3] =
          coverage === 0
            ? 0
            : coverage === 100
              ? 255
              : Math.round(
                  smoothstep(
                    threshold - (style === 'thin' ? 10 : 6),
                    threshold + (style === 'thin' ? 10 : 6),
                    samples[index],
                  ) * (style === 'thin' ? 210 : 255),
                );
      }
      texture.needsUpdate = true;
    },
  };
}
