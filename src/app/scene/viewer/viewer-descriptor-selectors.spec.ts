import type { ExternalObjectDescriptor } from '../../model/external-object-descriptor';
import { resolveDescriptorRenderProfile } from './viewer-descriptor-selectors';

function descriptor(domain: ExternalObjectDescriptor['domain'], objectFamily: string): ExternalObjectDescriptor {
  return {
    descriptorId: `${domain}-${objectFamily}`,
    schemaVersion: 'sw-13-m0-v1',
    domain,
    objectFamily,
    roleCue: 'test',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: `${domain} ${objectFamily}`,
    silhouetteProfile: 'test',
    materialProfile: 'test',
    emissiveProfile: 'test',
  };
}

describe('viewer-descriptor-selectors', () => {
  it('resolves deterministic debris family profiles', () => {
    const salvage = resolveDescriptorRenderProfile(descriptor('debris', 'salvage-fragment'));
    const wreckage = resolveDescriptorRenderProfile(descriptor('debris', 'wreckage-panel'));
    const cargo = resolveDescriptorRenderProfile(descriptor('debris', 'cargo-canister'));
    const shard = resolveDescriptorRenderProfile(descriptor('debris', 'field-shard'));

    expect(salvage).toEqual(
      jasmine.objectContaining({ domain: 'debris', objectFamily: 'salvage-fragment', geometrySegments: 10 }),
    );
    expect(wreckage).toEqual(
      jasmine.objectContaining({ domain: 'debris', objectFamily: 'wreckage-panel', geometrySegments: 12 }),
    );
    expect(cargo).toEqual(
      jasmine.objectContaining({ domain: 'debris', objectFamily: 'cargo-canister', geometrySegments: 14 }),
    );
    expect(shard).toEqual(
      jasmine.objectContaining({ domain: 'debris', objectFamily: 'field-shard', geometrySegments: 16 }),
    );
  });

  it('resolves deterministic asteroid family profiles', () => {
    const rocky = resolveDescriptorRenderProfile(descriptor('asteroids', 'rocky-irregular'));
    const metallic = resolveDescriptorRenderProfile(descriptor('asteroids', 'metallic-cluster'));
    const icy = resolveDescriptorRenderProfile(descriptor('asteroids', 'icy-body'));
    const hero = resolveDescriptorRenderProfile(descriptor('asteroids', 'cinematic-hero'));

    expect(rocky).toEqual(
      jasmine.objectContaining({ domain: 'asteroids', objectFamily: 'rocky-irregular', geometrySegments: 20 }),
    );
    expect(metallic).toEqual(
      jasmine.objectContaining({ domain: 'asteroids', objectFamily: 'metallic-cluster', geometrySegments: 22 }),
    );
    expect(icy).toEqual(
      jasmine.objectContaining({ domain: 'asteroids', objectFamily: 'icy-body', geometrySegments: 24 }),
    );
    expect(hero).toEqual(
      jasmine.objectContaining({ domain: 'asteroids', objectFamily: 'cinematic-hero', geometrySegments: 28 }),
    );
  });

  it('resolves deterministic ship family profiles', () => {
    const scout = resolveDescriptorRenderProfile(descriptor('ships', 'scout'));
    const hauler = resolveDescriptorRenderProfile(descriptor('ships', 'hauler'));
    const frigate = resolveDescriptorRenderProfile(descriptor('ships', 'frigate'));
    const interceptor = resolveDescriptorRenderProfile(descriptor('ships', 'interceptor'));
    const industrial = resolveDescriptorRenderProfile(descriptor('ships', 'industrial'));

    expect(scout).toEqual(jasmine.objectContaining({ domain: 'ships', objectFamily: 'scout' }));
    expect(hauler).toEqual(jasmine.objectContaining({ domain: 'ships', objectFamily: 'hauler' }));
    expect(frigate).toEqual(jasmine.objectContaining({ domain: 'ships', objectFamily: 'frigate' }));
    expect(interceptor).toEqual(jasmine.objectContaining({ domain: 'ships', objectFamily: 'interceptor' }));
    expect(industrial).toEqual(jasmine.objectContaining({ domain: 'ships', objectFamily: 'industrial' }));
  });

  it('resolves deterministic station family profiles', () => {
    const tradeHub = resolveDescriptorRenderProfile(descriptor('stations', 'trade-hub'));
    const refinery = resolveDescriptorRenderProfile(descriptor('stations', 'refinery'));
    const navalOutpost = resolveDescriptorRenderProfile(descriptor('stations', 'naval-outpost'));
    const researchPlatform = resolveDescriptorRenderProfile(descriptor('stations', 'research-platform'));

    expect(tradeHub).toEqual(jasmine.objectContaining({ domain: 'stations', objectFamily: 'trade-hub' }));
    expect(refinery).toEqual(jasmine.objectContaining({ domain: 'stations', objectFamily: 'refinery' }));
    expect(navalOutpost).toEqual(jasmine.objectContaining({ domain: 'stations', objectFamily: 'naval-outpost' }));
    expect(researchPlatform).toEqual(
      jasmine.objectContaining({ domain: 'stations', objectFamily: 'research-platform' }),
    );
  });

  it('applies fallbackTier behavior for hero, standard, and minimal', () => {
    const hero = resolveDescriptorRenderProfile({ ...descriptor('ships', 'frigate'), fallbackTier: 'hero' });
    const standard = resolveDescriptorRenderProfile({ ...descriptor('ships', 'frigate'), fallbackTier: 'standard' });
    const minimal = resolveDescriptorRenderProfile({ ...descriptor('ships', 'frigate'), fallbackTier: 'minimal' });

    expect(hero).not.toBeNull();
    expect(standard).not.toBeNull();
    expect(minimal).not.toBeNull();

    expect(hero!.recognitionDistanceKm).toBeGreaterThan(standard!.recognitionDistanceKm);
    expect(standard!.recognitionDistanceKm).toBeGreaterThan(minimal!.recognitionDistanceKm);
    expect(hero!.emissiveIntensity).toBeGreaterThan(standard!.emissiveIntensity);
    expect(minimal!.geometrySegments).toBeLessThan(standard!.geometrySegments);
  });

  it('returns identical profiles for identical inputs', () => {
    const input = descriptor('asteroids', 'rocky-irregular');
    const first = resolveDescriptorRenderProfile(input);
    const second = resolveDescriptorRenderProfile(input);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it('does not resolve unknown families or non-target domains', () => {
    expect(resolveDescriptorRenderProfile(descriptor('asteroids', 'unknown-family'))).toBeNull();
    expect(resolveDescriptorRenderProfile(descriptor('gates', 'ring-gate'))).toBeNull();
    expect(resolveDescriptorRenderProfile(undefined)).toBeNull();
  });
});
