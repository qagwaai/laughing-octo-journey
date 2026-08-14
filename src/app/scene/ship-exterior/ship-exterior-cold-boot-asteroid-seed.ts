import type { CelestialBodyListItem } from '../../model/celestial-body-list';
import type { Triple } from '../../model/shared/triple';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import type { MissionScenePluginSeedPolicy } from '../../mission/mission-scene-plugin';
import { FIRST_TARGET_SHIP_EXTERIOR_MISSION } from '../../mission/first-target-ship-exterior-mission';

export interface ShipExteriorColdBootAsteroidSeedContext {
  playerName: string;
  characterId: string;
  center: Triple;
  launchSeedHint?: number | null;
  existingBodies?: CelestialBodyListItem[];
}

export type ShipExteriorColdBootAsteroidSeedIntent =
  | {
      kind: 'fallback';
    }
  | {
      kind: 'starter-ship';
      actor: {
        playerName: string;
        characterId: string;
        sessionKey: string;
      };
      context: Pick<
        ShipExteriorColdBootAsteroidSeedContext,
        'playerName' | 'characterId' | 'center' | 'launchSeedHint'
      >;
    }
  | {
      kind: 'resume';
      actor: {
        playerName: string;
        characterId: string;
        sessionKey: string;
      };
      context: Pick<
        ShipExteriorColdBootAsteroidSeedContext,
        'playerName' | 'characterId' | 'center' | 'launchSeedHint' | 'existingBodies'
      >;
    };

function resolveSeedPolicy(
  seedPolicy?: Partial<MissionScenePluginSeedPolicy>,
): MissionScenePluginSeedPolicy {
  const defaultSeedPolicy: MissionScenePluginSeedPolicy = {
    createFallbackSamples: () => FIRST_TARGET_SHIP_EXTERIOR_MISSION.createFallbackAsteroidSamples(),
    createNewSamples: ({ playerName, characterId, center, launchSeedHint }) =>
      FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip({
        playerName,
        characterId,
        center,
        launchSeedHint,
      }),
    createResumedSamples: ({ playerName, characterId, center, existingBodies, launchSeedHint }) =>
      FIRST_TARGET_SHIP_EXTERIOR_MISSION.createResumedAsteroidSamples({
        playerName,
        characterId,
        center,
        existingBodies,
        launchSeedHint,
      }),
  };

  return { ...defaultSeedPolicy, ...seedPolicy };
}

/**
 * Temporary parity seam for cold-boot asteroid seeding.
 *
 * This is intentionally isolated so the scene can keep the current external-view
 * bootstrap behavior while making the seed path explicit and easy to deprecate
 * once the backend contract is updated to hydrate the scene directly.
 */
export function createColdBootAsteroidFallbackSamples(
  seedPolicy?: Partial<MissionScenePluginSeedPolicy>,
): AsteroidScanSample[] {
  return resolveSeedPolicy(seedPolicy).createFallbackSamples();
}

export function createColdBootAsteroidSamplesForStarterShip(
  context: Pick<ShipExteriorColdBootAsteroidSeedContext, 'playerName' | 'characterId' | 'center' | 'launchSeedHint'>,
  seedPolicy?: Partial<MissionScenePluginSeedPolicy>,
): AsteroidScanSample[] {
  return resolveSeedPolicy(seedPolicy).createNewSamples({
    playerName: context.playerName,
    characterId: context.characterId,
    center: context.center,
    launchSeedHint: context.launchSeedHint,
  });
}

export function createColdBootAsteroidSamplesForResume(
  context: Pick<ShipExteriorColdBootAsteroidSeedContext, 'playerName' | 'characterId' | 'center' | 'launchSeedHint' | 'existingBodies'>,
  seedPolicy?: Partial<MissionScenePluginSeedPolicy>,
): AsteroidScanSample[] {
  return resolveSeedPolicy(seedPolicy).createResumedSamples({
    playerName: context.playerName,
    characterId: context.characterId,
    center: context.center,
    existingBodies: context.existingBodies ?? [],
    launchSeedHint: context.launchSeedHint,
  });
}

export function seedColdBootAsteroids(
  intent: ShipExteriorColdBootAsteroidSeedIntent,
  seedPolicy?: Partial<MissionScenePluginSeedPolicy>,
): AsteroidScanSample[] {
  switch (intent.kind) {
    case 'fallback':
      return createColdBootAsteroidFallbackSamples(seedPolicy);
    case 'resume':
      return createColdBootAsteroidSamplesForResume(intent.context, seedPolicy);
    case 'starter-ship':
      return createColdBootAsteroidSamplesForStarterShip(intent.context, seedPolicy);
  }
}
