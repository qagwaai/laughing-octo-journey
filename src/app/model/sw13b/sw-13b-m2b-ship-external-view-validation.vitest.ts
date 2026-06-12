import {
  buildSw13bM2bShipExternalViewValidationArtifacts,
  SW13B_M2B_SHIP_EXTERNAL_VIEW_VALIDATION,
} from './sw-13b-m2b-ship-external-view-validation';

describe('SW-13B M2B ship-external-view validation artifacts', () => {
  it('should publish deterministic evidence with repeated identical run signatures', () => {
    const artifacts = buildSw13bM2bShipExternalViewValidationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      runCount: 3,
    });

    expect(artifacts.deterministicEvidence.repeatedRunSignatures.length).toBe(3);
    expect(artifacts.deterministicEvidence.allRunsIdentical).toBe(true);
    expect(artifacts.deterministicEvidence.orderStableForSameSeedAndBundle).toBe(true);
  });

  it('should confirm baseline and hero readability cues in ship-external-view sample sets', () => {
    const artifacts = buildSw13bM2bShipExternalViewValidationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      runCount: 3,
    });

    expect(artifacts.readabilityNotes.baselineProfileReadable).toBe(true);
    expect(artifacts.readabilityNotes.heroProfileReadable).toBe(true);
    expect(artifacts.readabilityNotes.metadataCompleteCount).toBe(artifacts.readabilityNotes.totalSamples);
  });

  it('should confirm fallback behavior with metadata completeness and tier coverage', () => {
    const artifacts = buildSw13bM2bShipExternalViewValidationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      runCount: 3,
    });

    expect(artifacts.fallbackNotes.fallbackBehaviorConfirmed).toBe(true);
    expect(artifacts.fallbackNotes.fallbackMetadataCompleteCount).toBe(artifacts.fallbackNotes.fallbackTotalSamples);
    expect(artifacts.fallbackNotes.fallbackBaselineCount).toBeGreaterThan(0);
    expect(artifacts.fallbackNotes.fallbackHeroCount).toBeGreaterThan(0);
    expect(artifacts.fallbackNotes.resumedFallbackTierCounts.hero).toBeGreaterThan(0);
    expect(artifacts.fallbackNotes.resumedFallbackTierCounts.standard).toBeGreaterThan(0);
  });

  it('should require no new gaps when all M2B checks pass', () => {
    const artifacts = buildSw13bM2bShipExternalViewValidationArtifacts({
      date: '2026-06-02',
      owner: 'qagwaai',
      contentReviewer: 'qagwaai',
      targetClosureDate: '2026-06-09',
      runCount: 3,
    });

    expect(artifacts.newGapList).toEqual([]);
    expect(artifacts.confirmations.noMarketplaceAsteroidDependencies).toBe(true);
    expect(artifacts.confirmations.noCommissionedAsteroidDependencies).toBe(true);
    expect(artifacts.confirmations.backendContractChangeRequired).toBe(false);
    expect(artifacts.confirmations.openApiContractDrift).toBe('none');
  });

  it('should expose a published M2B artifact constant for documentation references', () => {
    expect(SW13B_M2B_SHIP_EXTERNAL_VIEW_VALIDATION.milestone).toBe('M2B');
    expect(SW13B_M2B_SHIP_EXTERNAL_VIEW_VALIDATION.owner).toBe('qagwaai');
    expect(SW13B_M2B_SHIP_EXTERNAL_VIEW_VALIDATION.contentReviewer).toBe('qagwaai');
  });
});
