import { expect, type Page } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import { SocketIOMock } from '../fixtures/socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-fab-cue';

function registerFirstTargetCueMock(mock: SocketIOMock): void {
  configureFirstTargetCueMock(mock);
}

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
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
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
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
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

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
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
          owningCharacterId: item.owningCharacterId ?? TEST_CHARACTER_ID,
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

async function waitForShipExteriorTestApi(sharedPage: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        sharedPage.evaluate(() => {
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
      { timeout: 15000 },
    )
    .toBe(true);
}

async function advanceMissionToManufactureStep(sharedPage: Page): Promise<void> {
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

  await expect
    .poll(async () =>
      sharedPage.evaluate(() => {
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

const test = createJoinedGameTest({
  registerSessionHandlers: registerFirstTargetCueMock,
  joinButtonText: 'Join Game in Progress',
});

test('shows fabrication lab menu cue after dart launch unlocks manufacture step', async ({ sharedPage }) => {

  await waitForShipExteriorTestApi(sharedPage);
  await advanceMissionToManufactureStep(sharedPage);

  const fabricationLabButton = sharedPage.locator('button[aria-label="Fabrication Lab"]');
  const overlay = sharedPage.locator('.left-pane-mission-guidance-overlay');
  await expect(fabricationLabButton).toHaveClass(/is-guided-target/);
  await expect(fabricationLabButton.locator('.menu-badge')).toHaveText('NEXT');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('Continue first-target by opening Fabrication Lab.')).toBeVisible();
  await expect(overlay.locator('.overlay-target strong')).toHaveText('Fabrication Lab');

  await overlay.locator('button.overlay-open').click();
  await expect(sharedPage).toHaveURL(/left:fabrication-lab/);
});

test('shows repair & retrofit menu cue after manufacture unlocks repair step', async ({ sharedPage }) => {

  await waitForShipExteriorTestApi(sharedPage);
  await advanceMissionToManufactureStep(sharedPage);

  await expect
    .poll(async () =>
      sharedPage.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorTestUtils?: {
              simulateManufacture?: (itemType: string) => unknown;
              getMissionGateState?: () => {
                steps?: Array<{ key?: string; status?: string }>;
              } | null;
            };
          }
        ).__shipExteriorTestUtils;
        api?.simulateManufacture?.('hull-patch-kit');
        const gateState = api?.getMissionGateState?.();
        const repairStep = gateState?.steps?.find((step) => step.key === 'repair_scavenger_pod');
        return repairStep?.status ?? null;
      }),
      { timeout: 10000 },
    )
    .toBe('active');

  const repairRetrofitButton = sharedPage.locator('button[aria-label="Repair & Retrofit"]');
  const overlay = sharedPage.locator('.left-pane-mission-guidance-overlay');
  await expect
    .poll(async () => {
      const className = await repairRetrofitButton.getAttribute('class');
      return className?.includes('is-guided-target') ?? false;
    }, { timeout: 10000 })
    .toBe(true);
  await expect(repairRetrofitButton.locator('.menu-badge')).toHaveText('NEXT', { timeout: 10000 });
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect
    .poll(
      async () => {
        return sharedPage.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                simulateManufacture?: (itemType: string) => unknown;
                getMissionGateState?: () => {
                  steps?: Array<{ key?: string; status?: string }>;
                } | null;
              };
            }
          ).__shipExteriorTestUtils;
          api?.simulateManufacture?.('hull-patch-kit');

          const gateState = api?.getMissionGateState?.();
          const repairStep = gateState?.steps?.find((step) => step.key === 'repair_scavenger_pod');

          return {
            repairStepStatus: repairStep?.status ?? null,
            targetLabel: document.querySelector('.left-pane-mission-guidance-overlay .overlay-target strong')?.textContent?.trim() ?? '',
            instruction:
              document.querySelector('.left-pane-mission-guidance-overlay .overlay-instruction')?.textContent?.trim() ?? '',
          };
        });
      },
      { timeout: 15000 },
    )
    .toEqual(
      expect.objectContaining({
        repairStepStatus: 'active',
        targetLabel: 'Repair & Retrofit',
        instruction: expect.stringMatching(/opening Repair\s*(?:&|and)\s*Retrofit\.?/i),
      }),
    );

  await repairRetrofitButton.click();
  await expect(sharedPage).toHaveURL(/left:repair-retrofit/);
});

test('keeps overlay dismissed for the same step across refresh, then shows again when step changes', async ({
  sharedPage,
  prepareJoinedPage,
}) => {
  await prepareJoinedPage();

  await waitForShipExteriorTestApi(sharedPage);
  await advanceMissionToManufactureStep(sharedPage);

  const overlay = sharedPage.locator('.left-pane-mission-guidance-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.overlay-target strong')).toHaveText('Fabrication Lab');

  await overlay.locator('button.overlay-dismiss').click();
  await expect(overlay).toHaveCount(0);

  // Reset to game-main (fixture pattern instead of reload + re-login)
  await prepareJoinedPage();

  await waitForShipExteriorTestApi(sharedPage);
  await expect(sharedPage.locator('.left-pane-mission-guidance-overlay')).toHaveCount(0);

  await expect
    .poll(async () =>
      sharedPage.evaluate(() => {
        const api = (
          window as Window & {
            __shipExteriorTestUtils?: {
              simulateManufacture?: (itemType: string) => unknown;
              getMissionGateState?: () => {
                steps?: Array<{ key?: string; status?: string }>;
              } | null;
            };
          }
        ).__shipExteriorTestUtils;
        api?.simulateManufacture?.('hull-patch-kit');
        const gateState = api?.getMissionGateState?.();
        const repairStep = gateState?.steps?.find((step) => step.key === 'repair_scavenger_pod');
        return repairStep?.status ?? null;
      }),
      { timeout: 10000 },
    )
    .toBe('active');

  const repairOverlay = sharedPage.locator('.left-pane-mission-guidance-overlay');
  await expect(repairOverlay).toBeVisible();
  await expect(repairOverlay.locator('.overlay-target strong')).toHaveText('Repair & Retrofit');
});
