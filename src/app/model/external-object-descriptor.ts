export type ExternalObjectSchemaVersion = 'sw-13-m0-v1';

export type ExternalObjectDomain = 'debris' | 'ships' | 'gates' | 'stations' | 'asteroids';

export type ExternalObjectFallbackTier = 'hero' | 'standard' | 'minimal';

export interface ExternalObjectDescriptor {
  descriptorId: string;
  schemaVersion: ExternalObjectSchemaVersion;
  domain: ExternalObjectDomain;
  objectFamily: string;
  roleCue: string;
  factionCue: string;
  fallbackTier: ExternalObjectFallbackTier;
  displayLabel: string;
  silhouetteProfile: string;
  materialProfile: string;
  emissiveProfile: string;
}

export const EXTERNAL_OBJECT_SCHEMA_VERSION: ExternalObjectSchemaVersion = 'sw-13-m0-v1';

export const EXTERNAL_OBJECT_FALLBACK_TIERS: readonly ExternalObjectFallbackTier[] = ['hero', 'standard', 'minimal'];

const EXTERNAL_OBJECT_DOMAIN_FAMILIES: Readonly<Record<ExternalObjectDomain, readonly string[]>> = {
  debris: ['salvage-fragment', 'wreckage-panel', 'cargo-canister', 'field-shard'],
  ships: ['scout', 'hauler', 'frigate', 'interceptor', 'industrial'],
  gates: ['ring-gate', 'segmented-arch', 'relay-spindle'],
  stations: ['trade-hub', 'refinery', 'naval-outpost', 'research-platform'],
  asteroids: ['rocky-irregular', 'metallic-cluster', 'icy-body', 'cinematic-hero'],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isKnownDomain(value: string): value is ExternalObjectDomain {
  return Object.prototype.hasOwnProperty.call(EXTERNAL_OBJECT_DOMAIN_FAMILIES, value);
}

function isKnownFallbackTier(value: string): value is ExternalObjectFallbackTier {
  return (EXTERNAL_OBJECT_FALLBACK_TIERS as readonly string[]).includes(value);
}

export interface ExternalObjectDescriptorValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateExternalObjectDescriptor(
  descriptor: ExternalObjectDescriptor,
  expectedDomain?: ExternalObjectDomain,
): ExternalObjectDescriptorValidationResult {
  if (descriptor.schemaVersion !== EXTERNAL_OBJECT_SCHEMA_VERSION) {
    return {
      valid: false,
      reason: `schemaVersion must be ${EXTERNAL_OBJECT_SCHEMA_VERSION}`,
    };
  }

  if (expectedDomain && descriptor.domain !== expectedDomain) {
    return {
      valid: false,
      reason: `domain mismatch: expected ${expectedDomain}, received ${descriptor.domain}`,
    };
  }

  if (!isKnownFallbackTier(descriptor.fallbackTier)) {
    return {
      valid: false,
      reason: 'fallbackTier must be one of hero|standard|minimal',
    };
  }

  const allowedFamilies = EXTERNAL_OBJECT_DOMAIN_FAMILIES[descriptor.domain] ?? [];
  if (!allowedFamilies.includes(descriptor.objectFamily)) {
    return {
      valid: false,
      reason: `objectFamily ${descriptor.objectFamily} is invalid for domain ${descriptor.domain}`,
    };
  }

  return { valid: true };
}

export function coerceExternalObjectDescriptor(
  value: unknown,
  expectedDomain?: ExternalObjectDomain,
): { descriptor: ExternalObjectDescriptor | null; reason?: string } {
  const input = asRecord(value);
  if (!input) {
    return {
      descriptor: null,
      reason: 'descriptor must be an object',
    };
  }

  const descriptorId = asTrimmed(input['descriptorId']);
  const schemaVersion = asTrimmed(input['schemaVersion']);
  const domain = asTrimmed(input['domain']);
  const objectFamily = asTrimmed(input['objectFamily']);
  const roleCue = asTrimmed(input['roleCue']);
  const factionCue = asTrimmed(input['factionCue']);
  const fallbackTier = asTrimmed(input['fallbackTier']);
  const displayLabel = asTrimmed(input['displayLabel']);
  const silhouetteProfile = asTrimmed(input['silhouetteProfile']);
  const materialProfile = asTrimmed(input['materialProfile']);
  const emissiveProfile = asTrimmed(input['emissiveProfile']);

  if (
    !descriptorId ||
    !schemaVersion ||
    !domain ||
    !objectFamily ||
    !roleCue ||
    !factionCue ||
    !fallbackTier ||
    !displayLabel ||
    !silhouetteProfile ||
    !materialProfile ||
    !emissiveProfile
  ) {
    return {
      descriptor: null,
      reason: 'descriptor is missing required fields',
    };
  }

  if (!isKnownDomain(domain)) {
    return {
      descriptor: null,
      reason: `domain ${domain} is not supported`,
    };
  }

  if (!isKnownFallbackTier(fallbackTier)) {
    return {
      descriptor: null,
      reason: 'fallbackTier must be one of hero|standard|minimal',
    };
  }

  if (schemaVersion !== EXTERNAL_OBJECT_SCHEMA_VERSION) {
    return {
      descriptor: null,
      reason: `schemaVersion must be ${EXTERNAL_OBJECT_SCHEMA_VERSION}`,
    };
  }

  const descriptor: ExternalObjectDescriptor = {
    descriptorId,
    schemaVersion,
    domain,
    objectFamily,
    roleCue,
    factionCue,
    fallbackTier,
    displayLabel,
    silhouetteProfile,
    materialProfile,
    emissiveProfile,
  };

  const validation = validateExternalObjectDescriptor(descriptor, expectedDomain);
  if (!validation.valid) {
    return {
      descriptor: null,
      reason: validation.reason,
    };
  }

  return { descriptor };
}
