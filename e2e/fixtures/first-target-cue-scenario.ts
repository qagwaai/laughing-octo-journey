import { expect, type Page } from '@playwright/test';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';
import {
  registerMissionCharacterList,
  registerMissionGameJoin,
  registerMissionList,
  registerMissionShipListByOwner,
} from './mission-session-helpers';

const FIRST_TARGET_MISSION_ID = 'first-target';
const FAB_LAB_HINT_DISMISS_PREFIX = 'first-target:fabrication-lab-hint-dismissed';
const REPAIR_HINT_DISMISS_PREFIX = 'first-target:repair-retrofit-hint-dismissed';

export const FIRST_TARGET_CUE_CHARACTER_ID = 'char-fab-cue';

export function registerFirstTargetCueMock(mock: SocketIOMock): void {
  configureFirstTargetCueMock(mock);
}

export function configureFirstTargetCueMock(mock: SocketIOMock): void {
  registerMissionCharacterList(mock, [
    {
      id: FIRST_TARGET_CUE_CHARACTER_ID,
      characterName: 'Cue Tester',
      level: 2,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  ]);

  registerMissionGameJoin(mock);

  registerMissionList(mock, {
    characterId: FIRST_TARGET_CUE_CHARACTER_ID,
    missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
  });

  registerMissionShipListByOwner(mock, {
    characterId: FIRST_TARGET_CUE_CHARACTER_ID,
    ships: [
      {
        id: 'ship-cue-1',
        name: 'Starter Pod',
        model: 'Scavenger Pod',
        tier: 1,
        status: 'Damaged',
        inventory: [
          {
            id: 'item-drone-1',
            itemType: 'expendable-dart-drone',
            displayName: 'Expendable Dart Drone',
            launchable: true,
            state: 'contained',
            damageStatus: 'intact',
            container: { containerType: 'ship', containerId: 'ship-cue-1' },
            owningPlayerId: TEST_PLAYER,
            owningCharacterId: FIRST_TARGET_CUE_CHARACTER_ID,
            kinematics: null,
            destroyedAt: null,
            destroyedReason: null,
            discoveredAt: null,
            discoveredByCharacterId: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 1000000, y: 0, z: 0 },
          epochMs: Date.now(),
        },
        motion: {
          velocityKmPerSec: { x: 0, y: 0, z: 0 },
        },
        observability: {
          visibility: 'visible',
          scanState: 'scanned',
        },
      },
    ],
  });

  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: { x: 1000000, y: 0, z: 0 },
      distanceKm: 900000,
      celestialBodies: [],
    },
  }));

  mock.on('celestial-body-upsert-request', (request) => {
    const payload = request as {
      celestialBody?: {
        id?: string;
        sourceScanId?: string;
        catalogId?: string;
        createdByCharacterId?: string;
        createdAt?: string;
        updatedAt?: string;
        spatial?: unknown;
        motion?: unknown;
        physical?: unknown;
        composition?: unknown;
        observability?: unknown;
        state?: 'active' | 'destroyed';
      };
    };
    const celestialBody = payload.celestialBody ?? {};
    return {
      event: 'celestial-body-upsert-response',
      data: {
        success: true,
        message: '',
        celestialBody: {
          id: celestialBody.id ?? `cb-${celestialBody.sourceScanId ?? 'generated'}`,
          sourceScanId: celestialBody.sourceScanId ?? 'generated',
          catalogId: celestialBody.catalogId ?? `catalog-${Date.now()}`,
          createdByCharacterId: celestialBody.createdByCharacterId ?? FIRST_TARGET_CUE_CHARACTER_ID,
          createdAt: celestialBody.createdAt ?? '2026-05-01T00:00:00.000Z',
          updatedAt: celestialBody.updatedAt ?? '2026-05-01T00:00:00.000Z',
          spatial: celestialBody.spatial,
          motion: celestialBody.motion,
          physical: celestialBody.physical,
          composition: celestialBody.composition,
          observability: celestialBody.observability ?? { visibility: 'visible', scanState: 'unscanned' },
          state: celestialBody.state ?? 'active',
        },
      },
    };
  });

  mock.on('launch-item-request', (request) => {
    const payload = request as {
      shipId?: string;
      targetCelestialBodyId?: string;
      hotkey?: 1 | 2 | 3 | 4 | 5;
      itemId?: string;
      itemType?: string;
    };
    return {
      event: 'launch-item-response',
      data: {
        success: true,
        message: 'Target destroyed',
        playerName: TEST_PLAYER,
        characterId: FIRST_TARGET_CUE_CHARACTER_ID,
        shipId: payload.shipId ?? 'ship-cue-1',
        targetCelestialBodyId: payload.targetCelestialBodyId ?? 'cb-generated',
        hotkey: payload.hotkey ?? 1,
        itemId: payload.itemId ?? 'item-drone-1',
        itemType: payload.itemType ?? 'expendable-dart-drone',
        resolution: {
          outcome: 'target-destroyed',
          targetDestroyed: true,
          yieldedMaterials: [],
          yieldedItems: [],
          launchSeed: 42,
        },
      },
    };
  });

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: FIRST_TARGET_CUE_CHARACTER_ID,
    },
  }));

  mock.on('item-upsert-request', (request) => {
    const payload = request as {
      item?: {
        id?: string;
        itemType?: string;
        displayName?: string;
        launchable?: boolean;
        state?: string;
        damageStatus?: string;
        container?: { containerType: 'ship'; containerId: string } | null;
        owningPlayerId?: string;
        owningCharacterId?: string;
      };
    };
    const item = payload.item ?? {};
    return {
      event: 'item-upsert-response',
      data: {
        success: true,
        message: '',
        item: {
          id: item.id ?? `itm-${Date.now()}`,
          itemType: item.itemType ?? 'hull-patch-kit',
          displayName: item.displayName ?? 'Hull Patch Kit',
          launchable: item.launchable ?? false,
          state: item.state ?? 'contained',
          damageStatus: item.damageStatus ?? 'intact',
          container: item.container ?? { containerType: 'ship', containerId: 'ship-cue-1' },
          owningPlayerId: item.owningPlayerId ?? TEST_PLAYER,
          owningCharacterId: item.owningCharacterId ?? FIRST_TARGET_CUE_CHARACTER_ID,
          kinematics: null,
          destroyedAt: null,
          destroyedReason: null,
          discoveredAt: null,
          discoveredByCharacterId: null,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      },
    };
  });
}

export async function waitForShipExteriorTestApi(
  sharedPage: Page,
  recover?: () => Promise<void>,
): Promise<void> {
  const isShipExteriorApiReady = async (): Promise<boolean> =>
    sharedPage
      .evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorTestUtils?: {
              getMissionGateState?: () => unknown;
              getAsteroidSamples?: () => unknown[];
            };
          }
        ).__shipExteriorTestUtils;
        return typeof api?.getMissionGateState === 'function';
      })
      .catch(() => false);

  await expect
    .poll(
      async () => {
        const apiReadyAtStart = await isShipExteriorApiReady();
        if (apiReadyAtStart) {
          return true;
        }

        const isLoginVisible = await sharedPage
          .getByRole('textbox', { name: 'Player Name' })
          .isVisible({ timeout: 500 })
          .catch(() => false);
        const isOnLoginRoute = /(?:\bleft:login\b|\/login(?:[?#(]|$))/.test(sharedPage.url());

        if ((isOnLoginRoute || isLoginVisible) && recover) {
          await recover();
          // Let routing/state settle after recovery and retry in the next poll tick.
          return false;
        }

        const targetIronButton = sharedPage.getByRole('button', { name: 'TARGET IRON' });
        const canOpenShipExterior = await targetIronButton
          .isVisible({ timeout: 500 })
          .catch(() => false);
        if (canOpenShipExterior) {
          await targetIronButton.click();
        } else if (!sharedPage.url().includes('right:opening-cold-boot-scan')) {
          await sharedPage.goto('/(left:game-main//right:opening-cold-boot-scan)').catch(() => null);
        }

        const apiReadyAfterRouteAttempt = await isShipExteriorApiReady();

        if (apiReadyAfterRouteAttempt) {
          return true;
        }

        return false;
      },
      { timeout: 20000, intervals: [250, 500, 1000] },
    )
    .toBe(true);
}

export async function advanceMissionToManufactureStep(sharedPage: Page): Promise<void> {
  await sharedPage.evaluate(() => {
    const api = (
      window as Window & {
        __shipExteriorTestUtils?: {
          forceCompleteIronScan?: () => unknown;
          getAsteroidSamples?: () => Array<{
            id: string;
            scanned?: boolean;
            revealedMaterial?: { material?: string } | null;
          }>;
          forceTargetAsteroid?: (sampleId: string) => boolean;
        };
      }
    ).__shipExteriorTestUtils;

    api?.forceCompleteIronScan?.();

    const ironSample = api
      ?.getAsteroidSamples?.()
      ?.find((sample) => sample.scanned && sample.revealedMaterial?.material === 'Iron');
    if (ironSample?.id) {
      api?.forceTargetAsteroid?.(ironSample.id);
    }
  });

  await sharedPage.evaluate(() => {
    const api = (
      window as Window & {
        __shipExteriorTestUtils?: {
          launchFromHotkey?: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
        };
      }
    ).__shipExteriorTestUtils;
    api?.launchFromHotkey?.(1);
  });

  await expect
    .poll(async () =>
      sharedPage.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorTestUtils?: {
              getMissionGateState?: () => {
                steps?: Array<{ key?: string; status?: string }>;
              } | null;
            };
          }
        ).__shipExteriorTestUtils;
        const gateState = api?.getMissionGateState?.();
        const manufactureStep = gateState?.steps?.find((step) => step.key === 'manufacture_hull_patch_kit');
        return manufactureStep?.status ?? null;
      }),
    )
    .toBe('active');
}

export async function resetFirstTargetCuePersistence(sharedPage: Page): Promise<void> {
  await sharedPage.evaluate(
    ({ missionId, playerName, characterId, fabricationDismissPrefix, repairDismissPrefix }) => {
      window.localStorage.removeItem(`ship-exterior-mission-state::${missionId}::${playerName}::${characterId}`);
      window.localStorage.removeItem(`${fabricationDismissPrefix}::${playerName}::${characterId}`);
      window.localStorage.removeItem(`${repairDismissPrefix}::${playerName}::${characterId}`);
    },
    {
      missionId: FIRST_TARGET_MISSION_ID,
      playerName: TEST_PLAYER,
      characterId: FIRST_TARGET_CUE_CHARACTER_ID,
      fabricationDismissPrefix: FAB_LAB_HINT_DISMISS_PREFIX,
      repairDismissPrefix: REPAIR_HINT_DISMISS_PREFIX,
    },
  );
}