/**
 * Maps backend celestial bodies into renderable asteroid samples.
 *
 * This is the mission-agnostic counterpart to the scripted cold-boot seeding path.
 * It renders exactly what the backend reported and never fabricates contacts, so an
 * empty sweep stays empty instead of being padded with procedurally generated rocks.
 *
 * The ship exterior scene renders at a 1:1 scene-unit-to-km scale
 * (`sceneUnitToKm: 1`), so a body's render position is simply its offset in km from
 * the sweep center.
 */
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import type { CelestialBodyListItem } from '../../model/celestial-body-list';
import type { Triple } from '../../model/triple';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import { resolveAsteroidExternalObjectDescriptor } from '../../model/ship-exterior-descriptors';

const DEFAULT_ESTIMATED_DIAMETER_M = 120;
const DEFAULT_ESTIMATED_MASS_KG = 1.2e9;

function roundRenderUnit(value: number): number {
  return +value.toFixed(2);
}

function resolveKinematics(body: CelestialBodyListItem): AsteroidKinematics {
  return {
    velocityKmPerSec: body.motion?.velocityKmPerSec ?? { x: 0, y: 0, z: 0 },
    angularVelocityRadPerSec: body.motion?.angularVelocityRadPerSec ?? { x: 0, y: 0, z: 0 },
    estimatedMassKg: body.physical?.estimatedMassKg ?? DEFAULT_ESTIMATED_MASS_KG,
    estimatedDiameterM: body.physical?.estimatedDiameterM ?? DEFAULT_ESTIMATED_DIAMETER_M,
  };
}

/**
 * Converts a backend celestial body list into asteroid samples positioned relative
 * to `centerKm` (normally the active ship's position).
 */
export function mapLocalCelestialBodiesToSamples(
  bodies: readonly CelestialBodyListItem[],
  centerKm: Triple,
): AsteroidScanSample[] {
  return bodies
    .filter((body) => body.state !== 'destroyed' && !!body.spatial?.positionKm)
    .map((body, index) => {
      const positionKm = body.spatial.positionKm;
      const basePosition: [number, number, number] = [
        roundRenderUnit(positionKm.x - centerKm.x),
        roundRenderUnit(positionKm.y - centerKm.y),
        roundRenderUnit(positionKm.z - centerKm.z),
      ];

      const scanned = body.observability?.scanState === 'scanned';
      const capturedKinematics = resolveKinematics(body);
      const revealedMaterial = body.composition ?? null;
      const sampleId = body.sourceScanId?.trim() || body.id || `local-body-${index + 1}`;

      return {
        id: sampleId,
        serverCelestialBodyId: body.id,
        meshProfileKey: body.meshProfileKey ?? null,
        estimatedDiameterM: capturedKinematics.estimatedDiameterM,
        sw13bSeedId: null,
        sw13bGeneratorVersion: null,
        sw13bParameterBundleHash: null,
        sw13bProfilePreset: null,
        sw13bTargetSurfaces: null,
        sw13bValidationStatus: null,
        position: [...basePosition] as [number, number, number],
        basePosition,
        scanProgress: scanned ? 100 : 0,
        scanned,
        externalObjectDescriptor: resolveAsteroidExternalObjectDescriptor({
          sampleId,
          revealedMaterial,
          fallbackTier: scanned ? 'hero' : 'standard',
        }),
        revealedMaterial,
        revealedKinematics: scanned ? capturedKinematics : null,
        capturedKinematics,
        solarSystemLocation: { positionKm: { ...positionKm } },
        clusterCenterKm: { ...centerKm },
      } satisfies AsteroidScanSample;
    });
}
