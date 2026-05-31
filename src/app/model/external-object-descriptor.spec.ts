import {
  coerceExternalObjectDescriptor,
  EXTERNAL_OBJECT_SCHEMA_VERSION,
  validateExternalObjectDescriptor,
  type ExternalObjectDescriptor,
} from './external-object-descriptor';

function makeDescriptor(overrides: Partial<ExternalObjectDescriptor> = {}): ExternalObjectDescriptor {
  return {
    descriptorId: 'gates-ring-gate',
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    domain: 'gates',
    objectFamily: 'ring-gate',
    roleCue: 'navigation',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Ring Gate',
    silhouetteProfile: 'ring',
    materialProfile: 'infrastructure',
    emissiveProfile: 'navigation',
    ...overrides,
  };
}

describe('external-object-descriptor model', () => {
  it('coerces a valid descriptor', () => {
    const result = coerceExternalObjectDescriptor(makeDescriptor());
    expect(result.descriptor).not.toBeNull();
    expect(result.reason).toBeUndefined();
  });

  it('rejects mismatched schema versions', () => {
    const result = coerceExternalObjectDescriptor(
      makeDescriptor({
        schemaVersion: 'legacy-v0' as ExternalObjectDescriptor['schemaVersion'],
      }),
    );
    expect(result.descriptor).toBeNull();
    expect(result.reason).toContain(EXTERNAL_OBJECT_SCHEMA_VERSION);
  });

  it('rejects invalid fallback tiers', () => {
    const result = coerceExternalObjectDescriptor(
      makeDescriptor({
        fallbackTier: 'ultra' as ExternalObjectDescriptor['fallbackTier'],
      }),
    );
    expect(result.descriptor).toBeNull();
    expect(result.reason).toContain('fallbackTier');
  });

  it('enforces domain-specific objectFamily enums', () => {
    const result = coerceExternalObjectDescriptor(
      makeDescriptor({
        domain: 'gates',
        objectFamily: 'trade-hub',
      }),
    );
    expect(result.descriptor).toBeNull();
    expect(result.reason).toContain('invalid for domain gates');
  });

  it('validates expected domain constraints', () => {
    const descriptor = makeDescriptor({ domain: 'stations', objectFamily: 'trade-hub' });
    const validation = validateExternalObjectDescriptor(descriptor, 'gates');
    expect(validation.valid).toBeFalse();
    expect(validation.reason).toContain('domain mismatch');
  });
});
