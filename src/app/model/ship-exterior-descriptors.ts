import type {
  ExternalObjectDescriptor,
  ExternalObjectDomain,
  ExternalObjectFallbackTier,
} from './external-object-descriptor';
import type { AsteroidMaterialProfile } from './catalog/asteroid-materials';

export interface ShipExteriorSw13FamilyBaseline {
  debris: readonly string[];
  asteroids: readonly string[];
  ships: readonly string[];
  stations: readonly string[];
  gates: readonly string[];
}

export const SHIP_EXTERIOR_SW13_FAMILY_BASELINE: ShipExteriorSw13FamilyBaseline = {
  debris: ['salvage-fragment', 'wreckage-panel', 'cargo-canister', 'field-shard'],
  asteroids: ['rocky-irregular', 'metallic-cluster', 'icy-body', 'cinematic-hero'],
  ships: ['scout', 'hauler', 'frigate', 'interceptor', 'industrial'],
  stations: ['trade-hub', 'refinery', 'naval-outpost', 'research-platform'],
  gates: ['ring-gate', 'segmented-arch', 'relay-spindle'],
};

function normalizeToken(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function fallbackTierFromToken(token: string, defaultTier: ExternalObjectFallbackTier): ExternalObjectFallbackTier {
  if (token === 'hero' || token === 'standard' || token === 'minimal') {
    return token;
  }
  return defaultTier;
}

function buildDescriptor(params: {
  domain: ExternalObjectDomain;
  objectFamily: string;
  descriptorId: string;
  displayLabel: string;
  roleCue: string;
  factionCue: string;
  silhouetteProfile: string;
  materialProfile: string;
  emissiveProfile: string;
  fallbackTier: ExternalObjectFallbackTier;
}): ExternalObjectDescriptor {
  return {
    descriptorId: params.descriptorId,
    schemaVersion: 'sw-13-m0-v1',
    domain: params.domain,
    objectFamily: params.objectFamily,
    roleCue: params.roleCue,
    factionCue: params.factionCue,
    fallbackTier: params.fallbackTier,
    displayLabel: params.displayLabel,
    silhouetteProfile: params.silhouetteProfile,
    materialProfile: params.materialProfile,
    emissiveProfile: params.emissiveProfile,
  };
}

function resolveAsteroidFamilyFromMaterial(material: AsteroidMaterialProfile | null): string {
  const token = normalizeToken(material?.material);
  const rarity = normalizeToken(material?.rarity);

  if (token.includes('ice')) {
    return 'icy-body';
  }

  if (token.includes('iron') || token.includes('nickel') || token.includes('metal')) {
    return 'metallic-cluster';
  }

  if (rarity === 'rare' || rarity === 'exotic') {
    return 'cinematic-hero';
  }

  return 'rocky-irregular';
}

export function resolveAsteroidExternalObjectDescriptor(params: {
  sampleId: string;
  revealedMaterial: AsteroidMaterialProfile | null;
  fallbackTier?: ExternalObjectFallbackTier | null;
}): ExternalObjectDescriptor {
  const objectFamily = resolveAsteroidFamilyFromMaterial(params.revealedMaterial);
  const fallbackTier = fallbackTierFromToken(params.fallbackTier ?? '', 'standard');

  return buildDescriptor({
    domain: 'asteroids',
    objectFamily,
    descriptorId: `asteroids-${objectFamily}-${normalizeToken(params.sampleId) || 'sample'}`,
    displayLabel: `Asteroid ${objectFamily}`,
    roleCue: 'resource-node',
    factionCue: 'unattributed',
    silhouetteProfile: objectFamily,
    materialProfile: objectFamily,
    emissiveProfile: objectFamily === 'cinematic-hero' ? 'high' : 'low',
    fallbackTier,
  });
}

export function resolveDebrisExternalObjectDescriptor(params: {
  itemType: string;
  displayName?: string | null;
  fallbackTier?: ExternalObjectFallbackTier | null;
}): ExternalObjectDescriptor {
  const itemType = normalizeToken(params.itemType);
  const displayName = normalizeToken(params.displayName);

  let objectFamily = 'field-shard';
  if (itemType.includes('tractor-beam') || itemType.includes('canister') || displayName.includes('canister')) {
    objectFamily = 'cargo-canister';
  } else if (
    itemType.includes('panel') ||
    itemType.includes('plate') ||
    itemType.includes('hull') ||
    displayName.includes('panel')
  ) {
    objectFamily = 'wreckage-panel';
  } else if (itemType.includes('scrap') || itemType.includes('fragment') || displayName.includes('scrap')) {
    objectFamily = 'salvage-fragment';
  }

  const fallbackTier = fallbackTierFromToken(params.fallbackTier ?? '', 'standard');
  return buildDescriptor({
    domain: 'debris',
    objectFamily,
    descriptorId: `debris-${objectFamily}-${itemType || 'unknown'}`,
    displayLabel: params.displayName?.trim() || params.itemType,
    roleCue: 'salvage',
    factionCue: 'unattributed',
    silhouetteProfile: objectFamily,
    materialProfile: objectFamily,
    emissiveProfile: objectFamily === 'field-shard' ? 'medium' : 'low',
    fallbackTier,
  });
}

export function resolveShipExternalObjectDescriptorFromModel(params: {
  model: string;
  fallbackTier?: ExternalObjectFallbackTier | null;
}): ExternalObjectDescriptor {
  const modelToken = normalizeToken(params.model);
  let objectFamily = 'scout';

  if (modelToken.includes('hauler')) {
    objectFamily = 'hauler';
  } else if (modelToken.includes('frigate')) {
    objectFamily = 'frigate';
  } else if (modelToken.includes('interceptor')) {
    objectFamily = 'interceptor';
  } else if (modelToken.includes('industrial')) {
    objectFamily = 'industrial';
  }

  const fallbackTier = fallbackTierFromToken(params.fallbackTier ?? '', 'standard');
  return buildDescriptor({
    domain: 'ships',
    objectFamily,
    descriptorId: `ships-${objectFamily}`,
    displayLabel: params.model.trim() || 'Ship',
    roleCue: objectFamily,
    factionCue: 'unattributed',
    silhouetteProfile: objectFamily,
    materialProfile: objectFamily,
    emissiveProfile: objectFamily === 'interceptor' ? 'high' : 'medium',
    fallbackTier,
  });
}
