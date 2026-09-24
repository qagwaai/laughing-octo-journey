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
  detectionRangeKm: number;
}

export interface TractorBeamTierCapabilities {
  tier: number;
  maxRangeKm: number;
  pullDurationMs: number;
}

export const SENSOR_ARRAY_MIN_TIER = 1;
export const SENSOR_ARRAY_MAX_TIER = 20;

const SENSOR_ARRAY_BASE_SCAN_DURATION_MS = 10_000;
const SENSOR_ARRAY_SCAN_DURATION_STEP_MS = 400;
const SENSOR_ARRAY_SCAN_TICK_MS = 100;

/**
 * Maximum detection range, in km, for each sensor array tier.
 *
 * Sourced verbatim from `docs/Sensor Array Master Progression Table.md`, which is the
 * design authority for the tier 1-20 progression. The scene renders at a 1:1
 * scene-unit-to-km scale, so these values are directly comparable to in-scene distances.
 */
const SENSOR_ARRAY_DETECTION_RANGE_KM_BY_TIER: readonly number[] = Object.freeze([
  100, // T1  Surface Optical Scanner
  250, // T2  Photonic Pulse Array
  750, // T3  Coherent Silver Aperture
  2_500, // T4  Thermal Beam Scanner
  7_500, // T5  Cobalt Magnetic Doppler
  25_000, // T6  Cryo-Cooled Infrared Array
  75_000, // T7  Solid-State Photonic Sensor
  250_000, // T8  Phase-Shifted Ion Scanner
  750_000, // T9  Lithographic Radar Array
  2_000_000, // T10 Terahertz Superconducting Array
  5_000_000, // T11 AI-Enhanced Deep Array
  12_000_000, // T12 Resonance Ion Scanner
  25_000_000, // T13 Cryo-Superconducting Matrix
  45_000_000, // T14 Atomic Layered Interferometer
  70_000_000, // T15 Gravimetric Flux Sensor
  95_000_000, // T16 Entangled Quantum Relay Array
  115_000_000, // T17 Molecular Synthesis Array
  130_000_000, // T18 Dark Matter Flux Scanner
  142_000_000, // T19 Quantum Matrix Array
  150_000_000, // T20 Hive-Mind Sensor Network
]);

const TRACTOR_BEAM_BASE_RANGE_KM = 10;
const TRACTOR_BEAM_MAX_RANGE_KM = 25;
const TRACTOR_BEAM_BASE_PULL_DURATION_MS = 10_000;
const TRACTOR_BEAM_MIN_PULL_DURATION_MS = 1_200;

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
    detectionRangeKm: resolveSensorArrayDetectionRangeKm(clampedTier),
  };
}

/**
 * Maximum distance, in km, at which a sensor array of the given tier can detect
 * celestial bodies. Drives the proximity radius used to hydrate the ship exterior
 * scene with nearby bodies from the backend.
 */
export function resolveSensorArrayDetectionRangeKm(tier: number): number {
  const clampedTier = clampSensorArrayTier(tier);
  return SENSOR_ARRAY_DETECTION_RANGE_KM_BY_TIER[clampedTier - 1] ?? SENSOR_ARRAY_DETECTION_RANGE_KM_BY_TIER[0];
}

export function resolveSensorArrayTargetLockHoldMs(tier: number): number {
  return resolveSensorArrayCapabilities(tier).scanDurationMs;
}

export function resolveTractorBeamCapabilities(tier: number): TractorBeamTierCapabilities {
  const clampedTier = clampSensorArrayTier(tier);
  const progress = (clampedTier - SENSOR_ARRAY_MIN_TIER) / (SENSOR_ARRAY_MAX_TIER - SENSOR_ARRAY_MIN_TIER);

  return {
    tier: clampedTier,
    maxRangeKm: roundCapabilityValue(
      TRACTOR_BEAM_BASE_RANGE_KM + (TRACTOR_BEAM_MAX_RANGE_KM - TRACTOR_BEAM_BASE_RANGE_KM) * progress,
    ),
    pullDurationMs: Math.round(
      TRACTOR_BEAM_BASE_PULL_DURATION_MS +
        (TRACTOR_BEAM_MIN_PULL_DURATION_MS - TRACTOR_BEAM_BASE_PULL_DURATION_MS) * progress,
    ),
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

function roundCapabilityValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}
