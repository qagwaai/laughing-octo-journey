import type { Sw13bGeneratedVisualSample } from './asteroid-visual-generator';

export type Sw13bCameraDistance = 'near' | 'mid' | 'far';

export interface Sw13bScreenshotCameraPreset {
  distance: Sw13bCameraDistance;
  fov: number;
  elevationDeg: number;
  azimuthDeg: number;
}

export interface Sw13bScreenshotManifestItem {
  fileName: string;
  seedId: string;
  surface: 'SV' | 'SEV';
  tier: 'B' | 'H';
  profileCode: string;
  cameraDistance: Sw13bCameraDistance;
  runIndex: number;
}

export const SW13B_CAMERA_PRESETS: readonly Sw13bScreenshotCameraPreset[] = [
  { distance: 'near', fov: 50, elevationDeg: 10, azimuthDeg: 25 },
  { distance: 'mid', fov: 45, elevationDeg: 14, azimuthDeg: 40 },
  { distance: 'far', fov: 40, elevationDeg: 18, azimuthDeg: 55 },
] as const;

function normalizeSeed(seedId: string): string {
  return seedId.toLowerCase();
}

export function buildSw13bDeterministicScreenshotManifest(params: {
  samples: readonly Sw13bGeneratedVisualSample[];
  runIndex?: number;
}): Sw13bScreenshotManifestItem[] {
  const runIndex = params.runIndex ?? 1;

  return params.samples.flatMap((sample) =>
    SW13B_CAMERA_PRESETS.map((preset) => ({
      fileName: [
        'sw13b',
        sample.descriptor.surface.toLowerCase(),
        normalizeSeed(sample.descriptor.seedId),
        sample.descriptor.profileCode.toLowerCase(),
        sample.descriptor.tier.toLowerCase(),
        preset.distance,
        `run${String(runIndex).padStart(2, '0')}`,
      ].join('_') + '.png',
      seedId: sample.descriptor.seedId,
      surface: sample.descriptor.surface,
      tier: sample.descriptor.tier,
      profileCode: sample.descriptor.profileCode,
      cameraDistance: preset.distance,
      runIndex,
    })),
  );
}
