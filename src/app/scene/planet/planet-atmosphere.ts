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
import { directionFromEquirect } from '../../model/planet/planet-surface';

export type DedicatedAtmosphereBody = 'venus' | 'titan';
export type AtmosphereQuality = 'overview' | 'detail';

/** Butterscotch-tan endpoints bracketing the PIA06230 lit-disk median of about rgb(155, 129, 68). */
export const TITAN_HAZE_DARK = [124, 96, 40] as const;
export const TITAN_HAZE_BRIGHT = [200, 166, 80] as const;

export function resolveDedicatedAtmosphere(body: {
  catalogIdentity?: { namespace: string; key: string } | null;
}): DedicatedAtmosphereBody | null {
  if (body.catalogIdentity?.namespace !== 'sol') return null;
  return body.catalogIdentity.key === 'venus' || body.catalogIdentity.key === 'titan' ? body.catalogIdentity.key : null;
}

export function resolveVenusAtmosphereUrl(quality: AtmosphereQuality): string {
  const filename = quality === 'detail' ? 'venus-atmosphere-4k.webp' : 'venus-atmosphere-2k.webp';
  return `textures/sol/atmospheres/venus-scope-v1/${filename}`;
}

export function createTitanHazeTexture(width: number, height: number): DataTexture {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error(`Titan haze texture dimensions must be integers greater than one; received ${width}x${height}.`);
  }

  const pixels = new Uint8Array(width * height * 4);
  const seed = 0x71a71;
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const [dx, dy, dz] = directionFromEquirect((x + 0.5) / width, v);
      const broad = fbm3(dx * 3.5, dy * 3.5, dz * 3.5, seed, 4);
      const wisps = fbm3(dx * 11, dy * 18, dz * 11, seed ^ 0x4f1bbcdc, 3);
      const bands = Math.sin(dy * 15 + (broad - 0.5) * 5 + (wisps - 0.5) * 2);
      // Muted, low-contrast haze with a slightly darker north, sampled against Cassini ISS PIA06230.
      const northDimming = Math.max(0, dy) * 0.14;
      const shade = Math.max(
        0,
        Math.min(1, 0.56 + (broad - 0.5) * 0.45 + (wisps - 0.5) * 0.18 + bands * 0.04 - northDimming),
      );
      const index = (y * width + x) * 4;
      pixels[index] = Math.round(TITAN_HAZE_DARK[0] + shade * (TITAN_HAZE_BRIGHT[0] - TITAN_HAZE_DARK[0]));
      pixels[index + 1] = Math.round(TITAN_HAZE_DARK[1] + shade * (TITAN_HAZE_BRIGHT[1] - TITAN_HAZE_DARK[1]));
      pixels[index + 2] = Math.round(TITAN_HAZE_DARK[2] + shade * (TITAN_HAZE_BRIGHT[2] - TITAN_HAZE_DARK[2]));
      pixels[index + 3] = 255;
    }
  }

  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
