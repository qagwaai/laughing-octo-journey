/**
 * Pure formatting and small helper utilities used by the ship exterior scene HUD.
 *
 * Extracted from ship-exterior-view.ts so that they can be unit-tested in isolation
 * (no Angular TestBed, no DOM, no signals) and reused across mission plugins.
 */
import type { CelestialBodyLocation } from '../../model/math/celestial-body-location';
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import type { ShipItem } from '../../model/ship-item';
import type { Triple } from '../../model/shared/triple';

/** One astronomical unit in kilometers (IAU). */
export const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

/** Default ship-to-sun distance used when no live position is available. */
export const DEFAULT_SHIP_SUN_DISTANCE_KM = 395_000_000;

/** Visual configuration for a solar system's sun rendering. */
export interface SolarSystemSunConfig {
  color: string;
  radius: number;
}

/** Per-solar-system sun configs; falls back to {@link DEFAULT_SUN_CONFIG} when unmapped. */
export const SOLAR_SYSTEM_SUN_CONFIGS: Record<string, SolarSystemSunConfig> = {
  sol: {
    color: '#f5ff6b',
    radius: 1,
  },
};

/** Default sun configuration used when no solar-system-specific config matches. */
export const DEFAULT_SUN_CONFIG: SolarSystemSunConfig = {
  color: '#f5ff6b',
  radius: 1,
};

/** Resolves the visual sun configuration for a given solar system id. */
export function resolveSunConfigForSolarSystem(solarSystemId: string): SolarSystemSunConfig {
  const normalizedId = solarSystemId.trim().toLowerCase();
  return SOLAR_SYSTEM_SUN_CONFIGS[normalizedId] ?? DEFAULT_SUN_CONFIG;
}

/**
 * Returns a unit vector in the same direction as `vector`, falling back to
 * `fallback` (then to the negative X axis) when the input has zero magnitude.
 */
export function normalizeDirection(vector: Triple, fallback: Triple): Triple {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude <= 0) {
    return normalizeDirection(fallback, { x: -1, y: 0, z: 0 });
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

/** Formats asteroid linear speed from scan kinematics for HUD display. */
export function formatVelocityText(k: AsteroidKinematics | null): string {
  if (!k) {
    return 'VEL: ---';
  }

  const { x, y, z } = k.velocityKmPerSec;
  const speed = Math.sqrt(x * x + y * y + z * z);
  return `VEL: ${speed.toFixed(1)} km/s`;
}

/** Formats asteroid angular speed from scan kinematics for HUD display. */
export function formatSpinText(k: AsteroidKinematics | null): string {
  if (!k) {
    return 'SPIN: ---';
  }

  const { x, y, z } = k.angularVelocityRadPerSec;
  const spin = Math.sqrt(x * x + y * y + z * z);
  return `SPIN: ${spin.toFixed(4)} rad/s`;
}

/** Formats estimated asteroid mass with compact scientific-style suffixes. */
export function formatMassText(k: AsteroidKinematics | null): string {
  if (!k) {
    return 'MASS: ---';
  }

  const kg = k.estimatedMassKg;
  if (kg >= 1e12) {
    return `MASS: ${(kg / 1e12).toFixed(2)}e12 kg`;
  }
  if (kg >= 1e9) {
    return `MASS: ${(kg / 1e9).toFixed(2)}e9 kg`;
  }
  return `MASS: ${kg.toFixed(0)} kg`;
}

/** Formats estimated asteroid diameter in meters or kilometers based on scale. */
export function formatDiameterText(k: AsteroidKinematics | null): string {
  if (!k) {
    return 'DIAM: ---';
  }

  return k.estimatedDiameterM >= 1000
    ? `DIAM: ${(k.estimatedDiameterM / 1000).toFixed(2)} km`
    : `DIAM: ${k.estimatedDiameterM} m`;
}

/** Formats absolute world position (Mkm) for cockpit telemetry readout. */
export function formatLocationText(location: CelestialBodyLocation | null): string {
  if (!location) {
    return 'LOC(Mkm): ---';
  }

  const { x, y, z } = location.positionKm;
  const xM = (x / 1e6).toFixed(3);
  const yM = (y / 1e6).toFixed(3);
  const zM = (z / 1e6).toFixed(3);
  return `LOC(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
}

/** Formats cluster-center position (Mkm) used by the seeded asteroid field. */
export function formatClusterText(center: Triple | null): string {
  if (!center) {
    return 'CLUSTER(Mkm): ---';
  }

  const xM = (center.x / 1e6).toFixed(3);
  const yM = (center.y / 1e6).toFixed(3);
  const zM = (center.z / 1e6).toFixed(3);
  return `CLUSTER(Mkm): X ${xM} | Y ${yM} | Z ${zM}`;
}

/** Formats offset from cluster center with radial distance for targeting context. */
export function formatOffsetText(location: CelestialBodyLocation | null, center: Triple | null): string {
  if (!location || !center) {
    return 'OFFSET(km): ---';
  }

  const dx = location.positionKm.x - center.x;
  const dy = location.positionKm.y - center.y;
  const dz = location.positionKm.z - center.z;
  const distance = Math.hypot(dx, dy, dz);
  return `OFFSET(km): dX ${dx.toFixed(0)} dY ${dy.toFixed(0)} dZ ${dz.toFixed(0)} | R ${distance.toFixed(0)}`;
}

/** Returns a short, fixed-width-friendly label for a launchable inventory item. */
export function getLaunchableLabel(item: ShipItem): string {
  const preferred = item.displayName?.trim() || item.itemType?.trim() || 'Unknown';
  if (preferred.length <= 12) {
    return preferred;
  }

  return `${preferred.slice(0, 9)}...`;
}

/**
 * Maps a keyboard event to a 1–5 hotkey slot (top-row digits and numpad).
 * Returns null when the event does not correspond to a launch hotkey.
 */
export function resolveHotkeyNumber(event: KeyboardEvent): 1 | 2 | 3 | 4 | 5 | null {
  if (event.key >= '1' && event.key <= '5') {
    return Number(event.key) as 1 | 2 | 3 | 4 | 5;
  }

  switch (event.code) {
    case 'Numpad1':
      return 1;
    case 'Numpad2':
      return 2;
    case 'Numpad3':
      return 3;
    case 'Numpad4':
      return 4;
    case 'Numpad5':
      return 5;
    default:
      return null;
  }
}

/** Deep-clones a JSON-serializable value for test assertion isolation. */
export function cloneForTest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
