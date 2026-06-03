import {
  buildSw13bPhaseAVisualFoundationArtifacts,
  SW13B_PHASE_A_VISUAL_FOUNDATION,
} from './sw-13b-phase-a-visual-foundation';

describe('SW-13B Phase A visual foundation artifacts', () => {
  it('publishes deterministic evidence with repeated identical run signatures', () => {
    const artifacts = buildSw13bPhaseAVisualFoundationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      seedCountPerTier: 12,
      surfaces: ['SV', 'SEV'],
      generatorVersion: 'sw13b-v1',
    });

    expect(artifacts.determinismEvidence.repeatedRunSignatures.length).toBe(3);
    expect(artifacts.determinismEvidence.allRunsIdentical).toBeTrue();
  });

  it('covers 24 seeds across both surfaces with screenshot manifest output', () => {
    const artifacts = buildSw13bPhaseAVisualFoundationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      seedCountPerTier: 12,
      surfaces: ['SV', 'SEV'],
    });

    expect(artifacts.sampleCount).toBe(48);
    expect(artifacts.screenshotEvidence.manifestCount).toBe(144);
    expect(artifacts.rockyGate.passCount + artifacts.rockyGate.failCount).toBe(artifacts.sampleCount);
  });

  it('tracks open gaps when visual gates fail', () => {
    const artifacts = buildSw13bPhaseAVisualFoundationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      seedCountPerTier: 1,
      surfaces: ['SV'],
      generatorVersion: 'sw13b-v1',
    });

    expect(Array.isArray(artifacts.newGapList)).toBeTrue();
  });

  it('publishes phase-a constant artifact for documentation references', () => {
    expect(SW13B_PHASE_A_VISUAL_FOUNDATION.milestone).toBe('M1B-M2B-PhaseA');
    expect(SW13B_PHASE_A_VISUAL_FOUNDATION.owner).toBe('qagwaai');
    expect(SW13B_PHASE_A_VISUAL_FOUNDATION.contentReviewer).toBe('qagwaai');
  });
});
