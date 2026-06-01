/**
 * Asteroid scan sample shape persisted and rendered by ship exterior view flows.
 */
import type { AsteroidKinematics } from './asteroid-kinematics';
import type { AsteroidMaterialProfile } from './asteroid-materials';
import type { CelestialBodyLocation } from './celestial-body-location';
import type { ExternalObjectDescriptor } from './external-object-descriptor';
import type { Triple } from './triple';

export interface AsteroidScanSample {
  id: string;
  serverCelestialBodyId: string | null;
  meshProfileKey?: string | null;
  position: [number, number, number];
  basePosition: [number, number, number];
  scanProgress: number;
  scanned: boolean;
  externalObjectDescriptor?: ExternalObjectDescriptor | null;
  revealedMaterial: AsteroidMaterialProfile | null;
  revealedKinematics: AsteroidKinematics | null;
  capturedKinematics: AsteroidKinematics;
  solarSystemLocation: CelestialBodyLocation;
  clusterCenterKm: Triple;
  motionPhase: number;
  motionRate: number;
  motionRadius: number;
  bobAmplitude: number;
}
