import type { ExternalObjectDescriptor } from '../../model/external-object-descriptor';

type DebrisFamily = 'salvage-fragment' | 'wreckage-panel' | 'cargo-canister' | 'field-shard';
type AsteroidFamily = 'rocky-irregular' | 'metallic-cluster' | 'icy-body' | 'cinematic-hero';

export interface DescriptorRenderProfile {
  domain: 'debris' | 'asteroids';
  objectFamily: DebrisFamily | AsteroidFamily;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  radiusScale: number;
  geometrySegments: number;
}

const DEBRIS_RENDER_PROFILES: Readonly<Record<DebrisFamily, DescriptorRenderProfile>> = {
  'salvage-fragment': {
    domain: 'debris',
    objectFamily: 'salvage-fragment',
    color: '#9ca3af',
    emissive: '#111827',
    emissiveIntensity: 0.04,
    roughness: 0.86,
    metalness: 0.14,
    radiusScale: 0.58,
    geometrySegments: 10,
  },
  'wreckage-panel': {
    domain: 'debris',
    objectFamily: 'wreckage-panel',
    color: '#f97316',
    emissive: '#431407',
    emissiveIntensity: 0.08,
    roughness: 0.72,
    metalness: 0.3,
    radiusScale: 0.62,
    geometrySegments: 12,
  },
  'cargo-canister': {
    domain: 'debris',
    objectFamily: 'cargo-canister',
    color: '#14b8a6',
    emissive: '#042f2e',
    emissiveIntensity: 0.12,
    roughness: 0.55,
    metalness: 0.46,
    radiusScale: 0.65,
    geometrySegments: 14,
  },
  'field-shard': {
    domain: 'debris',
    objectFamily: 'field-shard',
    color: '#7dd3fc',
    emissive: '#082f49',
    emissiveIntensity: 0.17,
    roughness: 0.38,
    metalness: 0.58,
    radiusScale: 0.52,
    geometrySegments: 16,
  },
};

const ASTEROID_RENDER_PROFILES: Readonly<Record<AsteroidFamily, DescriptorRenderProfile>> = {
  'rocky-irregular': {
    domain: 'asteroids',
    objectFamily: 'rocky-irregular',
    color: '#8b6f56',
    emissive: '#1f160f',
    emissiveIntensity: 0.05,
    roughness: 0.92,
    metalness: 0.04,
    radiusScale: 1,
    geometrySegments: 20,
  },
  'metallic-cluster': {
    domain: 'asteroids',
    objectFamily: 'metallic-cluster',
    color: '#9ca3af',
    emissive: '#111827',
    emissiveIntensity: 0.11,
    roughness: 0.5,
    metalness: 0.68,
    radiusScale: 0.96,
    geometrySegments: 22,
  },
  'icy-body': {
    domain: 'asteroids',
    objectFamily: 'icy-body',
    color: '#bae6fd',
    emissive: '#0c4a6e',
    emissiveIntensity: 0.19,
    roughness: 0.3,
    metalness: 0.08,
    radiusScale: 1.04,
    geometrySegments: 24,
  },
  'cinematic-hero': {
    domain: 'asteroids',
    objectFamily: 'cinematic-hero',
    color: '#f59e0b',
    emissive: '#78350f',
    emissiveIntensity: 0.21,
    roughness: 0.35,
    metalness: 0.2,
    radiusScale: 1.18,
    geometrySegments: 28,
  },
};

function cloneProfile(profile: DescriptorRenderProfile): DescriptorRenderProfile {
  return { ...profile };
}

export function resolveDescriptorRenderProfile(
  descriptor: ExternalObjectDescriptor | undefined,
): DescriptorRenderProfile | null {
  if (!descriptor) {
    return null;
  }

  if (descriptor.domain === 'debris') {
    const profile = DEBRIS_RENDER_PROFILES[descriptor.objectFamily as DebrisFamily];
    return profile ? cloneProfile(profile) : null;
  }

  if (descriptor.domain === 'asteroids') {
    const profile = ASTEROID_RENDER_PROFILES[descriptor.objectFamily as AsteroidFamily];
    return profile ? cloneProfile(profile) : null;
  }

  return null;
}
