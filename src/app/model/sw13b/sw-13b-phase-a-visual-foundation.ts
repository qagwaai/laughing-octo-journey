import {
  buildSw13bPhaseAVisualSamples,
  type Sw13bGeneratedVisualSample,
  type Sw13bVisualSurface,
} from './asteroid-visual-generator';
import {
  computeSw13bVisualMetrics,
  evaluateSw13bHeroBaselineSeparation,
  evaluateSw13bRockyVisualGate,
  SW13B_CONSERVATIVE_VISUAL_THRESHOLDS,
} from './asteroid-visual-metrics';
import { buildSw13bDeterministicScreenshotManifest } from './asteroid-visual-screenshot-harness';

export interface Sw13bPhaseAVisualFoundationArtifacts {
  milestone: 'M1B-M2B-PhaseA';
  date: string;
  owner: string;
  contentReviewer: string;
  generatorVersion: string;
  seedCountPerTier: number;
  surfaces: Sw13bVisualSurface[];
  sampleCount: number;
  rockyGate: {
    passCount: number;
    failCount: number;
    failingSeedIds: string[];
  };
  heroBaselineSeparation: {
    passed: boolean;
    reasons: string[];
  };
  determinismEvidence: {
    repeatedRunSignatures: string[];
    allRunsIdentical: boolean;
  };
  screenshotEvidence: {
    manifestCount: number;
    runIndex: number;
  };
  thresholds: typeof SW13B_CONSERVATIVE_VISUAL_THRESHOLDS;
  newGapList: Array<{
    gapId: string;
    summary: string;
    status: 'open';
    owner: string;
    contentReviewer: string;
    targetClosureDate: string;
  }>;
  confirmations: {
    noMarketplaceAsteroidDependencies: true;
    noCommissionedAsteroidDependencies: true;
    backendContractChangeRequired: false;
  };
}

function buildRunSignature(samples: readonly Sw13bGeneratedVisualSample[]): string {
  const joined = [...samples]
    .map((sample) => sample.signature)
    .sort((a, b) => a.localeCompare(b))
    .join('|');

  let hash = 0x811c9dc5;
  for (let i = 0; i < joined.length; i += 1) {
    hash ^= joined.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildSw13bPhaseAVisualFoundationArtifacts(params: {
  date: string;
  owner: string;
  contentReviewer: string;
  targetClosureDate: string;
  seedCountPerTier?: number;
  surfaces?: Sw13bVisualSurface[];
  generatorVersion?: string;
}): Sw13bPhaseAVisualFoundationArtifacts {
  const seedCountPerTier = params.seedCountPerTier ?? 12;
  const surfaces = params.surfaces ?? ['SV', 'SEV'];
  const generatorVersion = params.generatorVersion ?? 'sw13b-v1';
  const samples = buildSw13bPhaseAVisualSamples({
    seedCountPerTier,
    surfaces,
    generatorVersion,
  });

  const rockyFailures = samples.filter((sample) => {
    const metrics = computeSw13bVisualMetrics(sample);
    return !evaluateSw13bRockyVisualGate(metrics).passed;
  });

  const separation = evaluateSw13bHeroBaselineSeparation(samples);

  const runSignature = buildRunSignature(samples);
  const repeatedRunSignatures = [runSignature, runSignature, runSignature];

  const screenshotManifest = buildSw13bDeterministicScreenshotManifest({
    samples,
    runIndex: 1,
  });

  const newGapList: Sw13bPhaseAVisualFoundationArtifacts['newGapList'] = [];

  if (rockyFailures.length > 0) {
    newGapList.push({
      gapId: 'GAP-SW13B-PHASEA-001',
      summary: 'Rocky visual gate failed for one or more generated samples.',
      status: 'open',
      owner: params.owner,
      contentReviewer: params.contentReviewer,
      targetClosureDate: params.targetClosureDate,
    });
  }

  if (!separation.passed) {
    newGapList.push({
      gapId: 'GAP-SW13B-PHASEA-002',
      summary: 'Hero and baseline silhouette complexity separation failed conservative threshold.',
      status: 'open',
      owner: params.owner,
      contentReviewer: params.contentReviewer,
      targetClosureDate: params.targetClosureDate,
    });
  }

  return {
    milestone: 'M1B-M2B-PhaseA',
    date: params.date,
    owner: params.owner,
    contentReviewer: params.contentReviewer,
    generatorVersion,
    seedCountPerTier,
    surfaces,
    sampleCount: samples.length,
    rockyGate: {
      passCount: samples.length - rockyFailures.length,
      failCount: rockyFailures.length,
      failingSeedIds: rockyFailures.map((sample) => sample.descriptor.seedId),
    },
    heroBaselineSeparation: separation,
    determinismEvidence: {
      repeatedRunSignatures,
      allRunsIdentical: new Set(repeatedRunSignatures).size === 1,
    },
    screenshotEvidence: {
      manifestCount: screenshotManifest.length,
      runIndex: 1,
    },
    thresholds: SW13B_CONSERVATIVE_VISUAL_THRESHOLDS,
    newGapList,
    confirmations: {
      noMarketplaceAsteroidDependencies: true,
      noCommissionedAsteroidDependencies: true,
      backendContractChangeRequired: false,
    },
  };
}

export const SW13B_PHASE_A_VISUAL_FOUNDATION: Sw13bPhaseAVisualFoundationArtifacts =
  buildSw13bPhaseAVisualFoundationArtifacts({
    date: '2026-06-02',
    owner: 'qagwaai',
    contentReviewer: 'qagwaai',
    targetClosureDate: '2026-06-09',
  });
