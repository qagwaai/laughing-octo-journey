import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-fab-cue';

function configureFirstTargetCueMock(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: TEST_CHARACTER_ID,
          characterName: 'Cue Tester',
          level: 2,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
    },
  }));

  mock.on('ship-list-request', () => ({
    event: 'ship-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
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
              owningCharacterId: TEST_CHARACTER_ID,
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
    },
  }));

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
          createdByCharacterId: celestialBody.createdByCharacterId ?? TEST_CHARACTER_ID,
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
        characterId: TEST_CHARACTER_ID,
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

  mock.on('add-mission-request', () => ({
    event: 'add-mission-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
    },
  }));
}

async function waitForShipExteriorTestApi(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorTestUtils?: {
              getMissionGateState?: () => unknown;
              getAsteroidSamples?: () => unknown[];
            };
          }
        ).__shipExteriorTestUtils;
        return typeof api?.getMissionGateState === 'function' && (api?.getAsteroidSamples?.().length ?? 0) > 0;
      }),
    )
    .toBe(true);
}

test('shows fabrication lab menu cue after dart launch unlocks manufacture step', async ({ page }) => {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();
  configureFirstTargetCueMock(mock);

  await loginViaUI(page, mock);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 15000 });

  await waitForShipExteriorTestApi(page);

  await page.evaluate(() => {
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
          launchFromHotkey?: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
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

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorTestUtils?: {
              getAsteroidSamples?: () => Array<{
                scanned?: boolean;
                revealedMaterial?: { material?: string } | null;
                serverCelestialBodyId?: string | null;
              }>;
            };
          }
        ).__shipExteriorTestUtils;
        const ironSample = api
          ?.getAsteroidSamples?.()
          ?.find((sample) => sample.scanned && sample.revealedMaterial?.material === 'Iron');
        return !!ironSample?.serverCelestialBodyId;
      }),
    )
    .toBe(true);

  await page.evaluate(() => {
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
      page.evaluate(() => {
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

  const fabricationLabButton = page.locator('button[aria-label="Fabrication Lab"]');
  await expect(fabricationLabButton).toHaveClass(/is-guided-target/);
  await expect(fabricationLabButton.locator('.menu-badge')).toHaveText('NEXT');
  await expect(page.getByText('Mission objective updated. Open Fabrication Lab to continue first-target.')).toBeVisible();

  await page.locator('button.menu-coachmark-open', { hasText: 'Open' }).click();
  await expect(page).toHaveURL(/left:fabrication-lab/);
});
