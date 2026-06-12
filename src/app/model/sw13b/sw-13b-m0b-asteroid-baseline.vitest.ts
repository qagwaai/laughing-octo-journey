import { ASTEROID_MATERIALS } from '../catalog/asteroid-materials';
import { buildSw13bM0bPublishedArtifacts } from './sw-13b-m0b-asteroid-baseline';

describe('SW-13B M0B asteroid baseline artifacts', () => {
  it('includes every canonical material in the registry', () => {
    const artifacts = buildSw13bM0bPublishedArtifacts({
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-01',
    });

    const expected = new Set(ASTEROID_MATERIALS.map((row) => row.material.toLowerCase()));
    const actual = new Set(
      artifacts.registry
        .map((entry) => entry.seedId.split('-')[3] ?? 'unknown')
        .map((token) => token.toLowerCase()),
    );

    expect(actual).toEqual(expected);
  });

  it('maintains balanced baseline and hero coverage across SV and SEV', () => {
    const artifacts = buildSw13bM0bPublishedArtifacts({
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-01',
    });

    const baseline = artifacts.registry.filter((entry) => entry.seedId.includes('-B-'));
    const hero = artifacts.registry.filter((entry) => entry.seedId.includes('-H-'));

    expect(baseline.length).toBeGreaterThan(0);
    expect(hero.length).toBeGreaterThan(0);
    expect(baseline.length).toEqual(hero.length);

    for (const row of artifacts.registry) {
      expect(row.targetSurfaces).toEqual(['SV', 'SEV']);
    }
  });

  it('produces strict deterministic signatures across repeated and environment runs', () => {
    const artifacts = buildSw13bM0bPublishedArtifacts({
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-01',
    });

    const signatures = artifacts.determinismEvidencePack.repeatedRunSignatures;
    expect(signatures.length).toBe(3);
    expect(new Set(signatures).size).toBe(1);

    const env = artifacts.determinismEvidencePack.crossEnvironmentConsistency;
    expect(env.stableAcrossEnvironments).toBe(true);
    expect(new Set([env.windowsSignature, env.linuxSignature, env.macSignature]).size).toBe(1);
  });

  it('applies soft-warning performance gate and flags dense scenes', () => {
    const artifacts = buildSw13bM0bPublishedArtifacts({
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-01',
    });

    const flagged = artifacts.runtimePerformanceBaseline.filter((row) => row.flagged);

    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.some((row) => row.sceneId === 'sv-m0b-dense-hero-mix-01')).toBe(true);
  });

  it('requires gap ownership and reviewer assignments for every unresolved gap', () => {
    const artifacts = buildSw13bM0bPublishedArtifacts({
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-01',
    });

    expect(artifacts.initialGapList.length).toBeGreaterThan(0);

    for (const gap of artifacts.initialGapList) {
      expect(gap.owner).toBe('qagwaai');
      expect(gap.contentReviewer).toBe('qagwaai');
      expect(gap.targetClosureDate).toBe('2026-06-01');
    }
  });

  it('confirms no marketplace or commissioned asteroid dependencies', () => {
    const artifacts = buildSw13bM0bPublishedArtifacts({
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-01',
    });

    expect(artifacts.confirmations.noMarketplaceAsteroidDependencies).toBe(true);
    expect(artifacts.confirmations.noCommissionedAsteroidDependencies).toBe(true);
  });
});
