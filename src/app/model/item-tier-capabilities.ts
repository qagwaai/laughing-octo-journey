export type ScannerDetailBand =
  | 'basic'
  | 'basic+'
  | 'standard'
  | 'standard+'
  | 'advanced'
  | 'advanced+'
  | 'expert'
  | 'expert+'
  | 'elite'
  | 'elite+'
  | 'apex';

export interface ItemTierCapabilities {
  tier: number;
  scanDurationMs: number;
  scanTickMs: number;
  scanDetailBand: ScannerDetailBand;
  qualityConfidence: number;
}

export const SENSOR_ARRAY_MIN_TIER = 1;
export const SENSOR_ARRAY_MAX_TIER = 20;

const SENSOR_ARRAY_BASE_SCAN_DURATION_MS = 10_000;
const SENSOR_ARRAY_SCAN_DURATION_STEP_MS = 400;
const SENSOR_ARRAY_SCAN_TICK_MS = 100;

export function clampSensorArrayTier(tier: number): number {
  if (!Number.isFinite(tier)) {
    return SENSOR_ARRAY_MIN_TIER;
  }

  return Math.max(SENSOR_ARRAY_MIN_TIER, Math.min(SENSOR_ARRAY_MAX_TIER, Math.trunc(tier)));
}

export function resolveSensorArrayCapabilities(tier: number): ItemTierCapabilities {
  const clampedTier = clampSensorArrayTier(tier);
  const scanDurationMs = SENSOR_ARRAY_BASE_SCAN_DURATION_MS - (clampedTier - 1) * SENSOR_ARRAY_SCAN_DURATION_STEP_MS;

  return {
    tier: clampedTier,
    scanDurationMs,
    scanTickMs: SENSOR_ARRAY_SCAN_TICK_MS,
    scanDetailBand: resolveScanDetailBand(clampedTier),
    qualityConfidence: resolveQualityConfidence(clampedTier),
  };
}

function resolveScanDetailBand(tier: number): ScannerDetailBand {
  if (tier >= 20) return 'apex';
  if (tier >= 18) return 'elite+';
  if (tier >= 17) return 'elite';
  if (tier >= 16) return 'expert+';
  if (tier >= 14) return 'expert';
  if (tier >= 12) return 'advanced+';
  if (tier >= 10) return 'advanced';
  if (tier >= 8) return 'standard+';
  if (tier >= 6) return 'standard';
  if (tier >= 4) return 'basic+';
  return 'basic';
}

function resolveQualityConfidence(tier: number): number {
  const progress = (tier - SENSOR_ARRAY_MIN_TIER) / (SENSOR_ARRAY_MAX_TIER - SENSOR_ARRAY_MIN_TIER);
  const confidence = 0.45 + progress * 0.48;
  return Math.round(confidence * 1000) / 1000;
}