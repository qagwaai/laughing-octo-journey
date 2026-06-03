import { ASTEROID_MATERIALS } from '../catalog/asteroid-materials';

export type Sw13bVisualSurface = 'SV' | 'SEV';
export type Sw13bVisualTier = 'B' | 'H';

export interface Sw13bVisualSeedDescriptor {
  seedId: string;
  surface: Sw13bVisualSurface;
  tier: Sw13bVisualTier;
  materialSlug: string;
  profileCode: string;
  ordinal: number;
  revision: string;
}

export interface Sw13bVisualParameterBundle {
  silhouetteAmplitude: number;
  ridgeAmplitude: number;
  craterDensity: number;
  fractureIntensity: number;
  erosionStrength: number;
  baseRadiusMeters: number;
}

export interface Sw13bGeneratedVisualSample {
  descriptor: Sw13bVisualSeedDescriptor;
  generatorVersion: string;
  parameterBundleHash: string;
  radialProfile: number[];
  featureMask: number[];
  signature: string;
}

const BASELINE_PROFILE_CODES = ['RK', 'SH', 'FR', 'DS', 'PN', 'NK'];
const HERO_PROFILE_CODES = ['CR', 'FR', 'MT', 'SP', 'BR', 'HO', 'GL', 'NK'];

function hashFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function seededRandom(seed: string): () => number {
  let state = parseInt(hashFnv1a(seed), 16) >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function materialSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function parseTier(raw: string): Sw13bVisualTier {
  return raw === 'H' ? 'H' : 'B';
}

export function parseSw13bVisualSeed(seedId: string, surface: Sw13bVisualSurface): Sw13bVisualSeedDescriptor {
  const tokens = seedId.split('-');
  const tier = parseTier(tokens[2] ?? 'B');
  const material = tokens[3] ?? 'carbon';
  const profileCode = tokens[4] ?? (tier === 'H' ? 'CR' : 'RK');
  const ordinal = Number.parseInt(tokens[5] ?? '1', 10);
  const revision = tokens[6] ?? 'r1';

  return {
    seedId,
    surface,
    tier,
    materialSlug: material,
    profileCode,
    ordinal: Number.isFinite(ordinal) ? ordinal : 1,
    revision,
  };
}

function profileBias(profileCode: string): number {
  switch (profileCode) {
    case 'SH':
      return 0.06;
    case 'FR':
      return 0.12;
    case 'DS':
      return 0.03;
    case 'PN':
      return 0.08;
    case 'NK':
      return 0.1;
    case 'CR':
      return 0.14;
    case 'MT':
      return 0.11;
    case 'SP':
      return 0.15;
    case 'BR':
      return 0.13;
    case 'HO':
      return 0.12;
    case 'GL':
      return 0.09;
    default:
      return 0.07;
  }
}

function buildBundle(descriptor: Sw13bVisualSeedDescriptor, random: () => number): Sw13bVisualParameterBundle {
  const tierBoost = descriptor.tier === 'H' ? 0.28 : 0;
  const heroShapeBoost = descriptor.tier === 'H' ? 0.12 : 0;
  const bias = profileBias(descriptor.profileCode);

  return {
    silhouetteAmplitude: 0.16 + tierBoost + heroShapeBoost + bias + random() * 0.07,
    ridgeAmplitude: 0.09 + tierBoost * 0.9 + heroShapeBoost * 1.05 + random() * 0.06,
    craterDensity: 0.18 + tierBoost * 1.1 + heroShapeBoost * 0.95 + random() * 0.1,
    fractureIntensity: 0.16 + tierBoost * 1.25 + heroShapeBoost + random() * 0.1,
    erosionStrength: 0.1 + random() * 0.08,
    baseRadiusMeters: (descriptor.tier === 'H' ? 170 : 70) + descriptor.ordinal * 2 + random() * 12,
  };
}

function buildRadialProfile(bundle: Sw13bVisualParameterBundle, random: () => number, samples: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const macro = Math.sin(t * 1.9 + random() * 0.8) * bundle.silhouetteAmplitude;
    const meso = Math.sin(t * 4.8 + random() * 0.6) * bundle.ridgeAmplitude;
    const crater = (random() - 0.5) * bundle.craterDensity * 0.5;
    const fracture = Math.sin(t * 9.5 + random() * 0.9) * bundle.fractureIntensity * 0.35;
    const erosion = (random() - 0.5) * bundle.erosionStrength * 0.3;
    const radial = 1 + macro + meso + crater + fracture - erosion;

    result.push(Number(radial.toFixed(6)));
  }

  return result;
}

function buildFeatureMask(bundle: Sw13bVisualParameterBundle, random: () => number, count: number): number[] {
  const features: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const feature = bundle.craterDensity * (0.6 + random() * 0.8) + bundle.fractureIntensity * (0.4 + random() * 0.6);
    features.push(Number(feature.toFixed(6)));
  }

  return features;
}

export function buildSw13bGeneratedVisualSample(params: {
  seedId: string;
  surface: Sw13bVisualSurface;
  generatorVersion?: string;
  radialSamples?: number;
  featureSamples?: number;
}): Sw13bGeneratedVisualSample {
  const generatorVersion = params.generatorVersion ?? 'sw13b-v1';
  const radialSamples = params.radialSamples ?? 96;
  const featureSamples = params.featureSamples ?? 24;
  const descriptor = parseSw13bVisualSeed(params.seedId, params.surface);
  const random = seededRandom(`${generatorVersion}|${descriptor.seedId}|${descriptor.surface}`);
  const bundle = buildBundle(descriptor, random);
  const radialProfile = buildRadialProfile(bundle, random, radialSamples);
  const featureMask = buildFeatureMask(bundle, random, featureSamples);
  const parameterBundleHash = hashFnv1a(
    [
      generatorVersion,
      descriptor.seedId,
      descriptor.surface,
      descriptor.tier,
      descriptor.profileCode,
      bundle.silhouetteAmplitude.toFixed(4),
      bundle.ridgeAmplitude.toFixed(4),
      bundle.craterDensity.toFixed(4),
      bundle.fractureIntensity.toFixed(4),
      bundle.erosionStrength.toFixed(4),
      bundle.baseRadiusMeters.toFixed(2),
    ].join('|'),
  );

  const signature = hashFnv1a(
    [
      descriptor.seedId,
      descriptor.surface,
      parameterBundleHash,
      radialProfile.join(','),
      featureMask.join(','),
    ].join('|'),
  );

  return {
    descriptor,
    generatorVersion,
    parameterBundleHash,
    radialProfile,
    featureMask,
    signature,
  };
}

export function buildSw13bPhaseASeedSet(seedCountPerTier: number = 12): string[] {
  const materialSlugs = ASTEROID_MATERIALS.map((entry) => materialSlug(entry.material));
  const baselineSeeds: string[] = [];
  const heroSeeds: string[] = [];

  for (let i = 0; i < seedCountPerTier; i += 1) {
    const material = materialSlugs[i % materialSlugs.length] ?? 'carbon';
    const baselineProfile = BASELINE_PROFILE_CODES[i % BASELINE_PROFILE_CODES.length] ?? 'RK';
    const heroProfile = HERO_PROFILE_CODES[i % HERO_PROFILE_CODES.length] ?? 'CR';
    const ordinal = String(i + 1).padStart(3, '0');

    baselineSeeds.push(`AST-DS-B-${material}-${baselineProfile}-${ordinal}-r1`);
    heroSeeds.push(`AST-DS-H-${material}-${heroProfile}-${ordinal}-r1`);
  }

  return [...baselineSeeds, ...heroSeeds];
}

export function buildSw13bPhaseAVisualSamples(params?: {
  seedCountPerTier?: number;
  surfaces?: Sw13bVisualSurface[];
  generatorVersion?: string;
}): Sw13bGeneratedVisualSample[] {
  const seedCountPerTier = params?.seedCountPerTier ?? 12;
  const surfaces = params?.surfaces ?? ['SV', 'SEV'];
  const generatorVersion = params?.generatorVersion ?? 'sw13b-v1';
  const seeds = buildSw13bPhaseASeedSet(seedCountPerTier);

  return seeds.flatMap((seedId) =>
    surfaces.map((surface) =>
      buildSw13bGeneratedVisualSample({
        seedId,
        surface,
        generatorVersion,
      }),
    ),
  );
}
