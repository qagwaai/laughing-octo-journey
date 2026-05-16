import { AsyncSerialQueue } from './async-serial-queue';
import { DEFAULT_SOLAR_SYSTEM_ID, type CelestialBodyUpsertRequest, type CelestialBodyUpsertResponse } from '../../model/celestial-body-upsert';
import { type AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import { type AsteroidMaterialProfile } from '../../model/catalog/asteroid-materials';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';

interface CelestialBodyUpsertQueueItem {
  sampleId: string;
  state: 'unscanned' | 'active' | 'destroyed';
  revealedMaterial: AsteroidMaterialProfile | null;
  revealedKinematics: AsteroidKinematics | null;
}

interface ShipExteriorCelestialBodyControllerDeps {
  missionId: string;
  socketService: SocketService;
  sessionService: SessionService;
  getPlayerName: () => string;
  getCharacterId: () => string | null;
  getSampleById: (sampleId: string) => AsteroidScanSample | undefined;
  hasPendingActiveStateUpsert: (sampleId: string) => boolean;
  clearPendingActiveStateUpsert: (sampleId: string) => void;
  updateSampleServerCelestialBodyId: (sampleId: string, persistedId: string) => void;
  persistAsteroidSamples: () => void;
}

/**
 * Owns the asteroid-to-celestial-body upsert queue for ship-exterior.
 *
 * The controller keeps request shaping, dedupe, and callback handling outside
 * the scene component while the component retains sample state ownership.
 */
export class ShipExteriorCelestialBodyController {
  private readonly celestialBodyUpsertQueue = new AsyncSerialQueue<CelestialBodyUpsertQueueItem>((item) =>
    this.processCelestialBodyUpsert(item),
  );

  constructor(private readonly deps: ShipExteriorCelestialBodyControllerDeps) {}

  enqueueCelestialBodyUpsert(
    sample: AsteroidScanSample,
    state: 'unscanned' | 'active' | 'destroyed',
    revealedMaterial: AsteroidMaterialProfile | null,
    revealedKinematics: AsteroidKinematics | null,
  ): void {
    this.celestialBodyUpsertQueue.enqueue(
      {
        sampleId: sample.id,
        state,
        revealedMaterial,
        revealedKinematics,
      },
      (existing) => existing.sampleId === sample.id && existing.state === state,
    );
  }

  private async processCelestialBodyUpsert(item: CelestialBodyUpsertQueueItem): Promise<void> {
    return new Promise<void>((resolve) => {
      const sample = this.deps.getSampleById(item.sampleId);
      if (!sample) {
        resolve();
        return;
      }

      const sessionKey = this.deps.sessionService.getSessionKey();
      const playerName = this.deps.getPlayerName().trim();
      const createdByCharacterId = this.deps.getCharacterId();
      if (!sessionKey || !playerName || !createdByCharacterId) {
        appLogger.warn('Skipping celestial body upsert due to missing actor/session context.');
        resolve();
        return;
      }

      const nowIso = new Date().toISOString();
      const deterministicId = `cb-${createdByCharacterId}-${this.deps.missionId}-${sample.id}`;
      const deterministicCatalogId = `sol-${createdByCharacterId}-${this.deps.missionId}-${sample.id}`;
      const requestedCelestialBodyId = sample.serverCelestialBodyId ?? deterministicId;
      const resolvedKinematics = item.revealedKinematics ?? sample.capturedKinematics;
      const material = item.revealedMaterial ?? sample.revealedMaterial;
      const estimatedMassKg = resolvedKinematics.estimatedMassKg;
      const estimatedDiameterM = resolvedKinematics.estimatedDiameterM;
      const radiusKm =
        typeof estimatedDiameterM === 'number' && Number.isFinite(estimatedDiameterM) && estimatedDiameterM > 0
          ? +(estimatedDiameterM / 2000).toFixed(3)
          : undefined;
      const displayNamePrefix = material?.material?.trim() || 'Asteroid';
      const displayName = `${displayNamePrefix} ${sample.id}`;
      const request: CelestialBodyUpsertRequest = {
        sessionKey,
        playerName,
        createdByCharacterId,
        celestialBody: {
          id: requestedCelestialBodyId,
          catalogId: deterministicCatalogId,
          sourceScanId: sample.id,
          createdByCharacterId,
          bodyType: 'asteroid',
          displayName,
          missionId: this.deps.missionId,
          createdAt: nowIso,
          updatedAt: nowIso,
          spatial: {
            solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
            frame: 'barycentric',
            positionKm: sample.solarSystemLocation.positionKm,
            epochMs: Date.now(),
          },
          motion: {
            velocityKmPerSec: resolvedKinematics.velocityKmPerSec,
            angularVelocityRadPerSec: resolvedKinematics.angularVelocityRadPerSec,
          },
          physical: {
            estimatedMassKg,
            estimatedDiameterM,
          },
          physicalCatalog: {
            estimatedMassKg,
            estimatedDiameterM,
            radiusKm,
          },
          visualization: {
            colorHex: material?.textureColor,
            textureKey: null,
          },
          composition: material ?? undefined,
          observability: {
            visibility: 'visible',
            scanState: item.state === 'unscanned' ? 'unscanned' : 'scanned',
          },
          state: item.state === 'destroyed' ? 'destroyed' : 'active',
        },
      };

      this.deps.socketService.upsertCelestialBody(request, (response: CelestialBodyUpsertResponse) => {
        if (!response.success) {
          appLogger.warn('Celestial body upsert failed:', response.message);
          resolve();
          return;
        }

        const responseCelestialBodyId = response.celestialBody?.id?.trim();
        const persistedId =
          responseCelestialBodyId && responseCelestialBodyId.length > 0
            ? responseCelestialBodyId
            : requestedCelestialBodyId;
        this.deps.updateSampleServerCelestialBodyId(sample.id, persistedId);

        if (item.state === 'unscanned' && this.deps.hasPendingActiveStateUpsert(sample.id)) {
          const latest = this.deps.getSampleById(sample.id);
          if (latest) {
            this.deps.clearPendingActiveStateUpsert(sample.id);
            this.enqueueCelestialBodyUpsert(
              latest,
              'active',
              latest.revealedMaterial,
              latest.revealedKinematics ?? latest.capturedKinematics,
            );
          }
        }
        this.deps.persistAsteroidSamples();
        resolve();
      });
    });
  }
}