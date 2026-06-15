import { FIRST_TARGET_SHIP_EXTERIOR_MISSION } from '../../mission/first-target-ship-exterior-mission';
import type { AsteroidScanSample } from '../ship-exterior-asteroid-sample';
import type { CelestialBodyListItem } from '../celestial-body-list';
import type { ExternalObjectFallbackTier } from '../external-object-descriptor';
import type { Sw13bGapItem, Sw13bTier } from './sw-13b-m0b-asteroid-baseline';

export interface Sw13bM2bDeterminismEvidence {
  repeatedRunSignatures: string[];
  allRunsIdentical: boolean;
  orderStableForSameSeedAndBundle: boolean;
}

export interface Sw13bM2bReadabilityNotes {
  baselineProfileReadable: boolean;
  heroProfileReadable: boolean;
  metadataCompleteCount: number;
  totalSamples: number;
  baselineCount: number;
  heroCount: number;
  baselineProfilePresetCount: number;
  heroProfilePresetCount: number;
  notes: string[];
}

export interface Sw13bM2bFallbackNotes {
  fallbackMetadataCompleteCount: number;
  fallbackTotalSamples: number;
  fallbackBaselineCount: number;
  fallbackHeroCount: number;
  resumedFallbackTierCounts: Record<ExternalObjectFallbackTier, number>;
  fallbackBehaviorConfirmed: boolean;
  notes: string[];
}

export interface Sw13bM2bShipExternalViewValidationArtifacts {
  milestone: 'M2B';
  date: string;
  owner: string;
  contentReviewer: string;
  deterministicEvidence: Sw13bM2bDeterminismEvidence;
  readabilityNotes: Sw13bM2bReadabilityNotes;
  fallbackNotes: Sw13bM2bFallbackNotes;
  newGapList: Sw13bGapItem[];
  confirmations: {
    noMarketplaceAsteroidDependencies: true;
    noCommissionedAsteroidDependencies: true;
    backendContractChangeRequired: false;
    openApiContractDrift: 'none';
  };
}

function hashFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function resolveTier(seedId: string | null | undefined): Sw13bTier | '---' {
  if (!seedId) {
    return '---';
  }

  const token = seedId.split('-')[2]?.trim().toUpperCase();
  if (token === 'B' || token === 'H') {
    return token;
  }

  return '---';
}

function sampleMetadataComplete(sample: AsteroidScanSample): boolean {
  return (
    !!sample.sw13bSeedId &&
    !!sample.sw13bGeneratorVersion &&
    !!sample.sw13bParameterBundleHash &&
    !!sample.sw13bProfilePreset &&
    (sample.sw13bTargetSurfaces?.length ?? 0) > 0 &&
    !!sample.sw13bValidationStatus
  );
}

function computeDeterministicSignature(samples: readonly AsteroidScanSample[]): string {
  const normalized = samples
    .map((sample) =>
      [
        sample.id,
        sample.sw13bSeedId ?? '',
        sample.sw13bGeneratorVersion ?? '',
        sample.sw13bParameterBundleHash ?? '',
        sample.sw13bProfilePreset ?? '',
        (sample.sw13bTargetSurfaces ?? []).join(','),
        sample.sw13bValidationStatus ?? '',
      ].join('|'),
    )
    .join('||');

  return hashFnv1a(normalized);
}

function buildReadabilityNotes(samples: readonly AsteroidScanSample[]): Sw13bM2bReadabilityNotes {
  let baselineCount = 0;
  let heroCount = 0;
  let metadataCompleteCount = 0;

  const baselineProfiles = new Set<string>();
  const heroProfiles = new Set<string>();

  for (const sample of samples) {
    const tier = resolveTier(sample.sw13bSeedId);
    const profile = sample.sw13bProfilePreset?.trim() ?? '';

    if (tier === 'B') {
      baselineCount += 1;
      if (profile.length > 0) {
        baselineProfiles.add(profile);
      }
    }

    if (tier === 'H') {
      heroCount += 1;
      if (profile.length > 0) {
        heroProfiles.add(profile);
      }
    }

    if (sampleMetadataComplete(sample)) {
      metadataCompleteCount += 1;
    }
  }

  const baselineProfileReadable = baselineCount > 0 && baselineProfiles.size > 0;
  const heroProfileReadable = heroCount > 0 && heroProfiles.size > 0;

  return {
    baselineProfileReadable,
    heroProfileReadable,
    metadataCompleteCount,
    totalSamples: samples.length,
    baselineCount,
    heroCount,
    baselineProfilePresetCount: baselineProfiles.size,
    heroProfilePresetCount: heroProfiles.size,
    notes: [
      baselineProfileReadable
        ? 'Baseline profile readability confirmed in ship-external-view generation sample set.'
        : 'Baseline profile readability not confirmed from ship-external-view generated sample set.',
      heroProfileReadable
        ? 'Hero profile readability confirmed in ship-external-view generation sample set.'
        : 'Hero profile readability not confirmed from ship-external-view generated sample set.',
      `Metadata completeness ${metadataCompleteCount}/${samples.length} for SW-13B ship-external-view cues.`,
    ],
  };
}

function buildFallbackNotes(): Sw13bM2bFallbackNotes {
  const fallbackSamples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createFallbackAsteroidSamples();

  let fallbackMetadataCompleteCount = 0;
  let fallbackBaselineCount = 0;
  let fallbackHeroCount = 0;

  for (const sample of fallbackSamples) {
    const tier = resolveTier(sample.sw13bSeedId);
    if (tier === 'B') {
      fallbackBaselineCount += 1;
    }
    if (tier === 'H') {
      fallbackHeroCount += 1;
    }
    if (sampleMetadataComplete(sample)) {
      fallbackMetadataCompleteCount += 1;
    }
  }

  const resumedBodies: CelestialBodyListItem[] = [
    {
      id: 'sev-probe-cb-1',
      catalogId: 'sev-probe-cat-1',
      sourceScanId: 'sample-a1',
      createdByCharacterId: 'm2b-probe-char',
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 8, y: 3, z: -2 },
        epochMs: 1715000000000,
      },
      observability: {
        visibility: 'visible',
        scanState: 'scanned',
      },
      distanceKm: 12,
      state: 'active',
    },
    {
      id: 'sev-probe-cb-2',
      catalogId: 'sev-probe-cat-2',
      sourceScanId: 'sample-a2',
      createdByCharacterId: 'm2b-probe-char',
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: -4, y: 5, z: 9 },
        epochMs: 1715000000000,
      },
      observability: {
        visibility: 'visible',
        scanState: 'unscanned',
      },
      distanceKm: 19,
      state: 'active',
    },
  ];

  const resumedSamples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createResumedAsteroidSamples({
    playerName: 'm2b-probe-user',
    characterId: 'm2b-probe-char',
    center: { x: -420, y: 90, z: 1330 },
    launchSeedHint: 23,
    existingBodies: resumedBodies,
  });

  const resumedFallbackTierCounts: Record<ExternalObjectFallbackTier, number> = {
    hero: 0,
    standard: 0,
    minimal: 0,
  };

  for (const sample of resumedSamples) {
    const tier = sample.externalObjectDescriptor?.fallbackTier;
    if (tier === 'hero' || tier === 'standard' || tier === 'minimal') {
      resumedFallbackTierCounts[tier] += 1;
    }
  }

  const fallbackBehaviorConfirmed =
    fallbackMetadataCompleteCount === fallbackSamples.length &&
    fallbackBaselineCount > 0 &&
    fallbackHeroCount > 0 &&
    resumedFallbackTierCounts.hero > 0;

  return {
    fallbackMetadataCompleteCount,
    fallbackTotalSamples: fallbackSamples.length,
    fallbackBaselineCount,
    fallbackHeroCount,
    resumedFallbackTierCounts,
    fallbackBehaviorConfirmed,
    notes: [
      `Fallback sample metadata completeness ${fallbackMetadataCompleteCount}/${fallbackSamples.length}.`,
      `Fallback sample tier mix B ${fallbackBaselineCount} / H ${fallbackHeroCount}.`,
      `Resumed sample fallback tiers hero ${resumedFallbackTierCounts.hero}, standard ${resumedFallbackTierCounts.standard}, minimal ${resumedFallbackTierCounts.minimal}.`,
    ],
  };
}

function buildDeterminismEvidence(runCount: number): {
  deterministicEvidence: Sw13bM2bDeterminismEvidence;
  firstRunSamples: AsteroidScanSample[];
} {
  const signatures: string[] = [];
  const runs: AsteroidScanSample[][] = [];

  for (let i = 0; i < runCount; i += 1) {
    const samples = FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
      playerName: 'm2b-probe-user',
      characterId: 'm2b-probe-char',
      center: { x: -420, y: 90, z: 1330 },
      launchSeedHint: 23,
    });

    runs.push(samples);
    signatures.push(computeDeterministicSignature(samples));
  }

  const baselineSignature = signatures[0] ?? '';
  const allRunsIdentical = signatures.every((signature) => signature === baselineSignature);

  return {
    deterministicEvidence: {
      repeatedRunSignatures: signatures,
      allRunsIdentical,
      orderStableForSameSeedAndBundle: allRunsIdentical,
    },
    firstRunSamples: runs[0] ?? [],
  };
}

function buildGapList(params: {
  owner: string;
  contentReviewer: string;
  targetClosureDate: string;
  deterministicEvidence: Sw13bM2bDeterminismEvidence;
  readabilityNotes: Sw13bM2bReadabilityNotes;
  fallbackNotes: Sw13bM2bFallbackNotes;
}): Sw13bGapItem[] {
  const gaps: Sw13bGapItem[] = [];

  if (!params.deterministicEvidence.allRunsIdentical) {
    gaps.push({
      gapId: 'GAP-SW13B-M2B-001',
      summary: 'Determinism mismatch detected for repeated ship-external-view seed/bundle runs.',
      status: 'open',
      owner: params.owner,
      contentReviewer: params.contentReviewer,
      targetClosureDate: params.targetClosureDate,
    });
  }

  if (!params.readabilityNotes.baselineProfileReadable || !params.readabilityNotes.heroProfileReadable) {
    gaps.push({
      gapId: 'GAP-SW13B-M2B-002',
      summary: 'Baseline/hero readability evidence is incomplete for ship-external-view M2B sample set.',
      status: 'open',
      owner: params.owner,
      contentReviewer: params.contentReviewer,
      targetClosureDate: params.targetClosureDate,
    });
  }

  if (!params.fallbackNotes.fallbackBehaviorConfirmed) {
    gaps.push({
      gapId: 'GAP-SW13B-M2B-003',
      summary: 'Fallback behavior evidence is incomplete for ship-external-view M2B sample set.',
      status: 'open',
      owner: params.owner,
      contentReviewer: params.contentReviewer,
      targetClosureDate: params.targetClosureDate,
    });
  }

  return gaps;
}

export function buildSw13bM2bShipExternalViewValidationArtifacts(params: {
  date: string;
  owner: string;
  contentReviewer: string;
  targetClosureDate: string;
  runCount?: number;
}): Sw13bM2bShipExternalViewValidationArtifacts {
  const runCount = Math.max(3, params.runCount ?? 3);
  const { deterministicEvidence, firstRunSamples } = buildDeterminismEvidence(runCount);
  const readabilityNotes = buildReadabilityNotes(firstRunSamples);
  const fallbackNotes = buildFallbackNotes();

  return {
    milestone: 'M2B',
    date: params.date,
    owner: params.owner,
    contentReviewer: params.contentReviewer,
    deterministicEvidence,
    readabilityNotes,
    fallbackNotes,
    newGapList: buildGapList({
      owner: params.owner,
      contentReviewer: params.contentReviewer,
      targetClosureDate: params.targetClosureDate,
      deterministicEvidence,
      readabilityNotes,
      fallbackNotes,
    }),
    confirmations: {
      noMarketplaceAsteroidDependencies: true,
      noCommissionedAsteroidDependencies: true,
      backendContractChangeRequired: false,
      openApiContractDrift: 'none',
    },
  };
}

export const SW13B_M2B_SHIP_EXTERNAL_VIEW_VALIDATION: Sw13bM2bShipExternalViewValidationArtifacts =
  buildSw13bM2bShipExternalViewValidationArtifacts({
    date: '2026-06-02',
    owner: 'qagwaai',
    contentReviewer: 'qagwaai',
    targetClosureDate: '2026-06-09',
    runCount: 3,
  });
