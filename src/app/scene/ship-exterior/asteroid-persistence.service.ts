import { Injectable, inject } from '@angular/core';
import { ASTEROID_MATERIALS } from '../../model/catalog/asteroid-materials';
import { DEFAULT_SOLAR_SYSTEM_ID, type CelestialBodyUpsertRequest } from '../../model/celestial-body-upsert';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import type { ShipExteriorColdBootAsteroidSeedIntent } from './ship-exterior-cold-boot-asteroid-seed';
import type { ShipSceneAsteroidSample } from './ship-scene-types';

export interface AsteroidPersistenceContext {
  getAsteroidSamples(): readonly ShipSceneAsteroidSample[];
  setAsteroidSamples(samples: readonly ShipSceneAsteroidSample[]): void;
}

@Injectable({
  providedIn: 'root',
})
export class AsteroidPersistenceService {
  private readonly socketService = inject(SocketService);
  private readonly sessionService = inject(SessionService);

  buildCelestialBodyId(characterId: string, sampleId: string): string {
    const resolvedCharacterId = characterId.trim();
    const resolvedSampleId = sampleId.trim();
    return `cb-${resolvedCharacterId}-${FIRST_TARGET_MISSION_ID}-${resolvedSampleId}`;
  }

  persistSeededAsteroidsAsUnscanned(
    samples: readonly AsteroidScanSample[],
    intent: Extract<ShipExteriorColdBootAsteroidSeedIntent, { kind: 'starter-ship' | 'resume' }>,
  ): void {
    const playerName = intent.actor.playerName.trim();
    const characterId = intent.actor.characterId.trim();
    const sessionKey = intent.actor.sessionKey.trim();

    if (!sessionKey || !playerName || !characterId || characterId === 'unknown-character') {
      return;
    }

    for (const sample of samples) {
      const request: CelestialBodyUpsertRequest = {
        sessionKey,
        playerName,
        createdByCharacterId: characterId,
        celestialBody: {
          id: sample.serverCelestialBodyId?.trim() || this.buildCelestialBodyId(characterId, sample.id),
          catalogId: `sol-${characterId}-${FIRST_TARGET_MISSION_ID}-${sample.id}`,
          sourceScanId: sample.id,
          createdByCharacterId: characterId,
          bodyType: 'asteroid',
          displayName: `Asteroid ${sample.id}`,
          missionId: FIRST_TARGET_MISSION_ID,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          spatial: {
            solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
            frame: 'barycentric',
            positionKm: sample.solarSystemLocation.positionKm,
            epochMs: Date.now(),
          },
          motion: {
            velocityKmPerSec: sample.capturedKinematics.velocityKmPerSec,
            angularVelocityRadPerSec: sample.capturedKinematics.angularVelocityRadPerSec,
          },
          physical: {
            estimatedMassKg: sample.capturedKinematics.estimatedMassKg,
            estimatedDiameterM: sample.capturedKinematics.estimatedDiameterM,
          },
          physicalCatalog: {
            estimatedMassKg: sample.capturedKinematics.estimatedMassKg,
            estimatedDiameterM: sample.capturedKinematics.estimatedDiameterM,
            radiusKm: sample.capturedKinematics.estimatedDiameterM / 2000,
          },
          visualization: {
            colorHex: '#8f99a7',
            textureKey: null,
          },
          meshProfileKey: sample.meshProfileKey ?? null,
          composition: sample.revealedMaterial ?? undefined,
          observability: {
            visibility: 'visible',
            scanState: sample.scanned ? 'scanned' : 'unscanned',
          },
          state: sample.scanned ? 'active' : 'unscanned',
        },
      };

      this.socketService.upsertCelestialBody(request);
    }
  }

  persistScanComplete(
    sample: ShipSceneAsteroidSample,
    actor: { playerName?: string; characterId?: string; sessionKey?: string } = {},
  ): void {
    const sessionKey = (actor.sessionKey ?? this.sessionService.getSessionKey()?.trim() ?? '').trim();
    const playerName = (actor.playerName ?? this.sessionService.getPlayerName()?.trim() ?? '').trim();
    const characterId = (actor.characterId ?? this.sessionService.activeCharacter()?.id?.trim() ?? '').trim();

    if (!sessionKey || !playerName || !characterId || characterId === 'unknown-character') {
      return;
    }

    const kinematics = sample.revealedKinematics;
    const location = sample.solarSystemLocation;
    const nowIso = new Date().toISOString();
    const celestialBodyId = sample.serverCelestialBodyId?.trim() || this.buildCelestialBodyId(characterId, sample.id);

    const rawMaterial = sample.revealedMaterial;
    const composition = rawMaterial
      ? (ASTEROID_MATERIALS.find((material) => material.material === rawMaterial.material) ?? {
          material: rawMaterial.material,
          rarity: (rawMaterial.rarity as 'Common' | 'Uncommon' | 'Rare' | 'Exotic') ?? 'Common',
          textureColor: '#8f99a7',
        })
      : undefined;

    const request: CelestialBodyUpsertRequest = {
      sessionKey,
      playerName,
      createdByCharacterId: characterId,
      requestIdentity: {
        operation: 'scan-complete',
        entityType: 'celestial-body',
        containerId: sample.id,
        characterId,
      },
      celestialBody: {
        id: celestialBodyId,
        catalogId: `sol-${characterId}-${FIRST_TARGET_MISSION_ID}-${sample.id}`,
        sourceScanId: sample.id,
        createdByCharacterId: characterId,
        bodyType: 'asteroid',
        displayName: `Asteroid ${sample.id}`,
        missionId: FIRST_TARGET_MISSION_ID,
        createdAt: nowIso,
        updatedAt: nowIso,
        spatial: location
          ? {
              solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
              frame: 'barycentric',
              positionKm: location.positionKm,
              epochMs: Date.now(),
            }
          : {
              solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: Date.now(),
            },
        ...(kinematics && {
          motion: {
            velocityKmPerSec: kinematics.velocityKmPerSec,
            angularVelocityRadPerSec: kinematics.angularVelocityRadPerSec,
          },
          physical: {
            estimatedMassKg: kinematics.estimatedMassKg,
            estimatedDiameterM: kinematics.estimatedDiameterM,
          },
        }),
        composition,
        observability: {
          visibility: 'visible',
          scanState: 'scanned',
        },
        state: 'active',
      },
    };

    this.socketService.upsertCelestialBody(request);
  }

  ensureLaunchTargetCelestialBodyId(params: {
    sample: ShipSceneAsteroidSample;
    playerName?: string;
    characterId?: string;
    basePositionKm?: { x: number; y: number; z: number };
    context?: AsteroidPersistenceContext;
    onResolved: (targetCelestialBodyId: string) => void;
    onMissingIdentity?: () => void;
    onUpsertFailure?: (message: string) => void;
  }): void {
    const existingTargetId = params.sample.serverCelestialBodyId?.trim();
    if (existingTargetId) {
      params.onResolved(existingTargetId);
      return;
    }

    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const resolvedPlayerName = (params.playerName ?? '').trim() || this.sessionService.getPlayerName()?.trim() || '';
    const resolvedCharacterId =
      (params.characterId ?? '').trim() || this.sessionService.activeCharacter()?.id?.trim() || '';
    const hasPlaceholderIdentity =
      resolvedPlayerName === 'unknown-player' || resolvedCharacterId === 'unknown-character';

    if (!sessionKey || !resolvedPlayerName || !resolvedCharacterId || hasPlaceholderIdentity) {
      params.onMissingIdentity?.();
      return;
    }

    const requestedCelestialBodyId = this.buildCelestialBodyId(resolvedCharacterId, params.sample.id);
    const fallbackPositionKm = this.resolveFallbackTargetPositionKm(
      params.sample.id,
      params.basePositionKm ?? { x: 0, y: 0, z: 0 },
    );
    const request: CelestialBodyUpsertRequest = {
      sessionKey,
      playerName: resolvedPlayerName,
      createdByCharacterId: resolvedCharacterId,
      requestIdentity: {
        operation: 'celestial-body-upsert',
        entityType: 'celestial-body',
        containerId: params.sample.id,
        characterId: resolvedCharacterId,
      },
      celestialBody: {
        id: requestedCelestialBodyId,
        catalogId: `sol-${resolvedCharacterId}-${FIRST_TARGET_MISSION_ID}-${params.sample.id}`,
        sourceScanId: params.sample.id,
        createdByCharacterId: resolvedCharacterId,
        bodyType: 'asteroid',
        displayName: `Asteroid ${params.sample.id}`,
        missionId: FIRST_TARGET_MISSION_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        spatial: {
          solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
          frame: 'barycentric',
          positionKm: fallbackPositionKm,
          epochMs: Date.now(),
        },
        motion: {
          velocityKmPerSec: { x: 0, y: 0, z: 0 },
          angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
        },
        physical: {
          estimatedMassKg: 1_000_000_000,
          estimatedDiameterM: 120,
        },
        physicalCatalog: {
          estimatedMassKg: 1_000_000_000,
          estimatedDiameterM: 120,
          radiusKm: 0.06,
        },
        visualization: {
          colorHex: '#8f99a7',
          textureKey: null,
        },
        composition: params.sample.revealedMaterial
          ? {
              material: params.sample.revealedMaterial.material,
              rarity: params.sample.revealedMaterial.rarity as 'Common' | 'Uncommon' | 'Rare' | 'Exotic',
              textureColor: '#8f99a7',
            }
          : undefined,
        observability: {
          visibility: 'visible',
          scanState: params.sample.scanned ? 'scanned' : 'unscanned',
        },
        state: params.sample.scanned ? 'active' : 'unscanned',
      },
    };

    this.socketService.upsertCelestialBody(request, (response) => {
      if (!response.success) {
        params.onUpsertFailure?.(response.message || 'Target registration failed.');
        return;
      }

      const persistedId = response.celestialBody?.id?.trim() || requestedCelestialBodyId;
      this.setAsteroidSampleServerCelestialBodyId(params.context ?? null, params.sample.id, persistedId);
      params.onResolved(persistedId);
    });
  }

  resolveFallbackTargetPositionKm(
    sampleId: string,
    basePositionKm: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  ): { x: number; y: number; z: number } {
    const hash = sampleId.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
    const offset = (Math.abs(hash) % 1500) + 300;
    return {
      x: basePositionKm.x + offset,
      y: basePositionKm.y + Math.floor(offset / 3),
      z: basePositionKm.z - Math.floor(offset / 2),
    };
  }

  setAsteroidSampleServerCelestialBodyId(
    context: AsteroidPersistenceContext | null,
    sampleId: string,
    serverCelestialBodyId: string,
  ): void {
    if (!context) {
      return;
    }

    const nextSamples = context.getAsteroidSamples().map((sample) =>
      sample.id === sampleId
        ? {
            ...sample,
            serverCelestialBodyId,
          }
        : sample,
    );
    context.setAsteroidSamples(nextSamples);
  }
}
