import type { GasGiantProfile, GasGiantRingProfile } from './gas-giant-profile';

export const SATURN_BODY_ID = 'sol-saturn';
export const SATURN_RENDERER_VERSION = 'sol-saturn-v1';
export const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
export const SATURN_POLAR_RADIUS_KM = 54_364;

export const SATURN_REFERENCE_LINKS = [
  { href: 'https://science.nasa.gov/saturn/facts/', text: 'NASA Saturn' },
  { href: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html', text: 'NASA Saturn fact sheet' },
  { href: 'https://pds-rings.seti.org/saturn/saturn_rings_table.html', text: 'NASA PDS ring data' },
] as const;

/** Representative optical depths, not a reconstruction of a particular Cassini observation. */
export const SATURN_RING_REGIONS = [
  { innerKm: 66_900, outerKm: 74_491, opticalDepth: 0.001 },
  { innerKm: 74_491, outerKm: 91_975, opticalDepth: 0.16 },
  { innerKm: 91_975, outerKm: 117_500, opticalDepth: 1.8 },
  { innerKm: 117_500, outerKm: 122_050, opticalDepth: 0.045 },
  { innerKm: 122_050, outerKm: 136_770, opticalDepth: 0.65 },
  { innerKm: 136_770, outerKm: 139_826, opticalDepth: 0.0001 },
  { innerKm: 139_826, outerKm: 140_612, opticalDepth: 0.08 },
] as const;

export const SATURN_RING_GAPS = [
  { innerKm: 77_748, outerKm: 77_926 },
  { innerKm: 87_343, outerKm: 87_610 },
  { innerKm: 133_423, outerKm: 133_745 },
  { innerKm: 136_487, outerKm: 136_522 },
] as const;

export function canonicalSaturnProfile(base: GasGiantProfile): GasGiantProfile {
  const innerKm = SATURN_RING_REGIONS[0].innerKm;
  const outerKm = SATURN_RING_REGIONS[SATURN_RING_REGIONS.length - 1].outerKm;
  const rings: GasGiantRingProfile = {
    style: 'broad',
    innerRadius: innerKm / SATURN_EQUATORIAL_RADIUS_KM,
    outerRadius: outerKm / SATURN_EQUATORIAL_RADIUS_KM,
    opacity: 1,
    color: [0.9, 0.86, 0.76],
    seed: base.seed,
    radialSamples: 8192,
    regions: SATURN_RING_REGIONS.map((region) => ({
      inner: (region.innerKm - innerKm) / (outerKm - innerKm),
      outer: (region.outerKm - innerKm) / (outerKm - innerKm),
      opticalDepth: region.opticalDepth,
    })),
    gaps: SATURN_RING_GAPS.map((gap) => ({
      center: ((gap.innerKm + gap.outerKm) / 2 - innerKm) / (outerKm - innerKm),
      width: (gap.outerKm - gap.innerKm) / (outerKm - innerKm),
    })),
  };
  return {
    ...base,
    canonical: 'saturn',
    polarRadiusRatio: SATURN_POLAR_RADIUS_KM / SATURN_EQUATORIAL_RADIUS_KM,
    axialTilt: (26.73 * Math.PI) / 180,
    turbulence: 0.18,
    polarColor: [0.57, 0.6, 0.5],
    bands: base.bands.map((band) => ({
      ...band,
      color: [
        0.87 + (band.color[0] - 0.84) * 0.35,
        0.79 + (band.color[1] - 0.75) * 0.35,
        0.61 + (band.color[2] - 0.55) * 0.35,
      ],
    })),
    anticyclone: null,
    ovals: [],
    swirls: [],
    rings,
  };
}
