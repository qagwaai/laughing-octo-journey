import type { ExternalObjectDescriptor } from '../../model/external-object-descriptor';

type DebrisFamily = 'salvage-fragment' | 'wreckage-panel' | 'cargo-canister' | 'field-shard';
type AsteroidFamily = 'rocky-irregular' | 'metallic-cluster' | 'icy-body' | 'cinematic-hero';
type ShipFamily = 'scout' | 'hauler' | 'frigate' | 'interceptor' | 'industrial';
type StationFamily = 'trade-hub' | 'refinery' | 'naval-outpost' | 'research-platform';

export interface DescriptorRenderProfile {
  domain: 'debris' | 'asteroids' | 'ships' | 'stations';
  objectFamily: DebrisFamily | AsteroidFamily | ShipFamily | StationFamily;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  radiusScale: number;
  geometrySegments: number;
  recognitionDistanceKm: number;
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
    recognitionDistanceKm: 10_000,
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
    recognitionDistanceKm: 12_000,
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
    recognitionDistanceKm: 16_000,
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
    recognitionDistanceKm: 20_000,
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
    recognitionDistanceKm: 26_000,
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
    recognitionDistanceKm: 28_000,
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
    recognitionDistanceKm: 30_000,
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
    recognitionDistanceKm: 34_000,
  },
};

const SHIP_RENDER_PROFILES: Readonly<Record<ShipFamily, DescriptorRenderProfile>> = {
  scout: {
    domain: 'ships',
    objectFamily: 'scout',
    color: '#38bdf8',
    emissive: '#0c4a6e',
    emissiveIntensity: 0.16,
    roughness: 0.45,
    metalness: 0.55,
    radiusScale: 0.9,
    geometrySegments: 20,
    recognitionDistanceKm: 90_000,
  },
  hauler: {
    domain: 'ships',
    objectFamily: 'hauler',
    color: '#f59e0b',
    emissive: '#78350f',
    emissiveIntensity: 0.17,
    roughness: 0.48,
    metalness: 0.52,
    radiusScale: 1,
    geometrySegments: 22,
    recognitionDistanceKm: 100_000,
  },
  frigate: {
    domain: 'ships',
    objectFamily: 'frigate',
    color: '#6366f1',
    emissive: '#312e81',
    emissiveIntensity: 0.18,
    roughness: 0.4,
    metalness: 0.6,
    radiusScale: 1.06,
    geometrySegments: 24,
    recognitionDistanceKm: 115_000,
  },
  interceptor: {
    domain: 'ships',
    objectFamily: 'interceptor',
    color: '#ef4444',
    emissive: '#7f1d1d',
    emissiveIntensity: 0.19,
    roughness: 0.36,
    metalness: 0.62,
    radiusScale: 0.88,
    geometrySegments: 24,
    recognitionDistanceKm: 108_000,
  },
  industrial: {
    domain: 'ships',
    objectFamily: 'industrial',
    color: '#14b8a6',
    emissive: '#134e4a',
    emissiveIntensity: 0.14,
    roughness: 0.52,
    metalness: 0.48,
    radiusScale: 1.14,
    geometrySegments: 22,
    recognitionDistanceKm: 110_000,
  },
};

const STATION_RENDER_PROFILES: Readonly<Record<StationFamily, DescriptorRenderProfile>> = {
  'trade-hub': {
    domain: 'stations',
    objectFamily: 'trade-hub',
    color: '#22c55e',
    emissive: '#14532d',
    emissiveIntensity: 0.2,
    roughness: 0.62,
    metalness: 0.34,
    radiusScale: 1.15,
    geometrySegments: 26,
    recognitionDistanceKm: 140_000,
  },
  refinery: {
    domain: 'stations',
    objectFamily: 'refinery',
    color: '#f97316',
    emissive: '#7c2d12',
    emissiveIntensity: 0.19,
    roughness: 0.66,
    metalness: 0.32,
    radiusScale: 1.2,
    geometrySegments: 24,
    recognitionDistanceKm: 135_000,
  },
  'naval-outpost': {
    domain: 'stations',
    objectFamily: 'naval-outpost',
    color: '#1d4ed8',
    emissive: '#1e3a8a',
    emissiveIntensity: 0.2,
    roughness: 0.54,
    metalness: 0.46,
    radiusScale: 1.12,
    geometrySegments: 26,
    recognitionDistanceKm: 150_000,
  },
  'research-platform': {
    domain: 'stations',
    objectFamily: 'research-platform',
    color: '#a855f7',
    emissive: '#581c87',
    emissiveIntensity: 0.21,
    roughness: 0.5,
    metalness: 0.44,
    radiusScale: 1.1,
    geometrySegments: 28,
    recognitionDistanceKm: 145_000,
  },
};

function cloneProfile(profile: DescriptorRenderProfile): DescriptorRenderProfile {
  return { ...profile };
}

function applyFallbackTierBehavior(
  profile: DescriptorRenderProfile,
  fallbackTier: ExternalObjectDescriptor['fallbackTier'],
): DescriptorRenderProfile {
  if (fallbackTier === 'hero') {
    return {
      ...profile,
      emissiveIntensity: +(profile.emissiveIntensity * 1.18).toFixed(4),
      radiusScale: +(profile.radiusScale * 1.08).toFixed(4),
      recognitionDistanceKm: Math.round(profile.recognitionDistanceKm * 1.22),
    };
  }

  if (fallbackTier === 'minimal') {
    return {
      ...profile,
      emissiveIntensity: +(profile.emissiveIntensity * 0.72).toFixed(4),
      geometrySegments: Math.max(8, Math.floor(profile.geometrySegments * 0.72)),
      radiusScale: +(profile.radiusScale * 0.92).toFixed(4),
      recognitionDistanceKm: Math.round(profile.recognitionDistanceKm * 0.74),
    };
  }

  return cloneProfile(profile);
}

export function resolveDescriptorRenderProfile(
  descriptor: ExternalObjectDescriptor | undefined,
): DescriptorRenderProfile | null {
  if (!descriptor) {
    return null;
  }

  if (descriptor.domain === 'debris') {
    const profile = DEBRIS_RENDER_PROFILES[descriptor.objectFamily as DebrisFamily];
    return profile ? applyFallbackTierBehavior(profile, descriptor.fallbackTier) : null;
  }

  if (descriptor.domain === 'asteroids') {
    const profile = ASTEROID_RENDER_PROFILES[descriptor.objectFamily as AsteroidFamily];
    return profile ? applyFallbackTierBehavior(profile, descriptor.fallbackTier) : null;
  }

  if (descriptor.domain === 'ships') {
    const profile = SHIP_RENDER_PROFILES[descriptor.objectFamily as ShipFamily];
    return profile ? applyFallbackTierBehavior(profile, descriptor.fallbackTier) : null;
  }

  if (descriptor.domain === 'stations') {
    const profile = STATION_RENDER_PROFILES[descriptor.objectFamily as StationFamily];
    return profile ? applyFallbackTierBehavior(profile, descriptor.fallbackTier) : null;
  }

  return null;
}
