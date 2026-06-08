import {
  buildSw13bGeneratedVisualSample,
  buildSw13bDeterministicScreenshotManifest,
  buildSw13bPhaseASeedSet,
  buildSw13bPhaseAVisualSamples,
  computeSw13bVisualMetrics,
  evaluateSw13bHeroBaselineSeparation,
  evaluateSw13bRockyVisualGate,
  parseSw13bVisualSeed,
  SW13B_CAMERA_PRESETS,
} from './asteroid-visual-foundation';

describe('SW-13B visual foundation (Phase A)', () => {
  it('builds a deterministic 24-seed set (12 baseline + 12 hero)', () => {
    const seeds = buildSw13bPhaseASeedSet(12);
    const baseline = seeds.filter((seed) => seed.includes('-B-'));
    const hero = seeds.filter((seed) => seed.includes('-H-'));

    expect(seeds.length).toBe(24);
    expect(baseline.length).toBe(12);
    expect(hero.length).toBe(12);
  });

  it('parses seed identifiers into tier/profile/material metadata', () => {
    const parsed = parseSw13bVisualSeed('AST-DS-H-gold-CR-011-r1', 'SV');

    expect(parsed.tier).toBe('H');
    expect(parsed.profileCode).toBe('CR');
    expect(parsed.materialSlug).toBe('gold');
    expect(parsed.ordinal).toBe(11);
    expect(parsed.surface).toBe('SV');
  });

  it('produces deterministic sample signatures for same seed and surface', () => {
    const first = buildSw13bGeneratedVisualSample({
      seedId: 'AST-DS-B-carbon-RK-001-r1',
      surface: 'SV',
      generatorVersion: 'sw13b-v1',
    });

    const second = buildSw13bGeneratedVisualSample({
      seedId: 'AST-DS-B-carbon-RK-001-r1',
      surface: 'SV',
      generatorVersion: 'sw13b-v1',
    });

    expect(first.signature).toBe(second.signature);
    expect(first.parameterBundleHash).toBe(second.parameterBundleHash);
    expect(first.radialProfile).toEqual(second.radialProfile);
  });

  it('computes rocky metrics and passes conservative rocky gate for baseline samples', () => {
    const sample = buildSw13bGeneratedVisualSample({
      seedId: 'AST-DS-B-carbon-RK-001-r1',
      surface: 'SEV',
    });
    const metrics = computeSw13bVisualMetrics(sample);
    const gate = evaluateSw13bRockyVisualGate(metrics);

    expect(metrics.sphericityProxy).toBeLessThan(0.9);
    expect(metrics.featureDensity).toBeGreaterThan(0.14);
    expect(gate.passed).toBeTrue();
  });

  it('maintains hero-vs-baseline complexity separation over a 24-seed set', () => {
    const samples = buildSw13bPhaseAVisualSamples({
      seedCountPerTier: 12,
      surfaces: ['SV'],
    });

    const separation = evaluateSw13bHeroBaselineSeparation(samples);
    expect(separation.passed).toBeTrue();
  });

  it('builds deterministic screenshot manifest entries for all camera presets', () => {
    const samples = buildSw13bPhaseAVisualSamples({
      seedCountPerTier: 12,
      surfaces: ['SV', 'SEV'],
    });

    const manifest = buildSw13bDeterministicScreenshotManifest({
      samples,
      runIndex: 1,
    });

    expect(manifest.length).toBe(samples.length * SW13B_CAMERA_PRESETS.length);
    expect(manifest[0]?.fileName.endsWith('.png')).toBeTrue();
    expect(manifest.some((row) => row.cameraDistance === 'near')).toBeTrue();
    expect(manifest.some((row) => row.cameraDistance === 'mid')).toBeTrue();
    expect(manifest.some((row) => row.cameraDistance === 'far')).toBeTrue();
  });
});
