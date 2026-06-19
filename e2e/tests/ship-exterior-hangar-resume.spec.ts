import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-hangar-resume';
const SHIP_EXTERIOR_VIEW_URL_PATTERN = /(?:right:ship-exterior-view|\/ship-exterior-view(?:\(|$))/;

interface ShipExteriorResumeMockOptions {
  missionStatus?: 'active' | 'completed';
  inventory?: unknown[];
}

function configureShipExteriorResumeMock(mock: SocketIOMock, options: ShipExteriorResumeMockOptions = {}): void {
  const missionStatus = options.missionStatus ?? 'active';
  const inventory =
    options.inventory ??
    [
      {
        id: 'item-drone-1',
        itemType: 'expendable-dart-drone',
        displayName: 'Expendable Dart Drone',
        launchable: true,
        state: 'contained',
        damageStatus: 'intact',
        container: { containerType: 'ship', containerId: 'ship-1' },
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
    ];

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: TEST_CHARACTER_ID,
          characterName: 'Scout Alpha',
          level: 2,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: missionStatus }],
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
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: missionStatus }],
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
          id: 'ship-1',
          name: 'Starter Pod',
          model: 'Scavenger Pod',
          status: 'Damaged',
          inventory,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 1_000_000, y: 0, z: 0 },
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
      positionKm: { x: 1_000_000, y: 0, z: 0 },
      distanceKm: 900_000,
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

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
    },
  }));
}

test.describe('Ship Exterior scan persistence via Hangar', () => {
  test('keeps scanned asteroid state after ship specs and View Exterior round-trip', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const shipHangarPage = new ShipHangarPage(page);
    await mock.setup();
    configureShipExteriorResumeMock(mock);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const api = (
              window as Window & {
                __shipExteriorTestUtils?: {
                  getAsteroidSamples?: () => Array<{ id: string }>;
                  forceCompleteIronScan?: (sampleId?: string) => unknown;
                };
              }
            ).__shipExteriorTestUtils;
            return typeof api?.getAsteroidSamples === 'function' && api.getAsteroidSamples().length > 0;
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    const scannedSampleId = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: {
            getAsteroidSamples: () => Array<{ id: string }>;
            forceCompleteIronScan: (sampleId?: string) => unknown;
          };
        }
      ).__shipExteriorTestUtils;
      const firstSampleId = api?.getAsteroidSamples()?.[0]?.id;
      if (firstSampleId) {
        api?.forceCompleteIronScan(firstSampleId);
      }
      return firstSampleId ?? null;
    });

    expect(scannedSampleId).not.toBeNull();

    await expect
      .poll(async () =>
        page.evaluate((sampleId) => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getAsteroidSamples: () => Array<{ id: string; scanned: boolean; scanProgress: number }>;
              };
            }
          ).__shipExteriorTestUtils;
          const sample = api?.getAsteroidSamples().find((candidate) => candidate.id === sampleId);
          return sample ? { scanned: sample.scanned, scanProgress: sample.scanProgress } : null;
        }, scannedSampleId),
      )
      .toEqual({ scanned: true, scanProgress: 100 });

    await gameShell.openShipHangar();

    const shipRow = shipHangarPage.shipItem(0);
    await expect(shipRow).toBeVisible({ timeout: 10_000 });

    await shipRow.locator('button', { hasText: 'View Specs' }).click();
    await expect(page).toHaveURL(/right:item-view-specs/);

    await shipRow.locator('button', { hasText: 'View Exterior' }).click();
    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN);

    await expect(
      page.getByText('Objective unlocked: Neutralize the identified asteroid using a launchable payload.').first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'TARGET IRON' })).toBeVisible({ timeout: 15_000 });
  });

  test('keeps asteroid target lock available after first-target completion from Ship Hangar exterior view', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const shipHangarPage = new ShipHangarPage(page);
    await mock.setup();
    configureShipExteriorResumeMock(mock, {
      missionStatus: 'completed',
      inventory: [
        {
          id: 'item-mining-1',
          itemType: 'basic-mining-laser',
          displayName: 'Basic Mining Laser',
          launchable: false,
        },
      ],
    });

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:mission-board/, { timeout: 15_000 });

    await gameShell.openShipHangar();
    const shipRow = shipHangarPage.shipItem(0);
    await expect(shipRow).toBeVisible({ timeout: 10_000 });

    await shipRow.locator('button', { hasText: 'View Exterior' }).click();
    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN);

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const api = (
              window as Window & {
                __shipExteriorTestUtils?: {
                  getAsteroidSamples?: () => Array<{ id: string }>;
                };
              }
            ).__shipExteriorTestUtils;
            return typeof api?.getAsteroidSamples === 'function' && api.getAsteroidSamples().length > 0;
          }),
        { timeout: 15_000 },
      )
      .toBe(true);

    const interactionResult = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: {
            getAsteroidSamples: () => Array<{ id: string }>;
            forceTargetAsteroid: (sampleId: string) => boolean;
            getTargetedAsteroidId: () => string | null;
            launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
            getActiveLaunchToast: () => { message: string; tone: string } | null;
          };
        }
      ).__shipExteriorTestUtils;

      const sampleId = api?.getAsteroidSamples()?.[0]?.id;
      if (!api || !sampleId) {
        return null;
      }

      const targetLocked = api.forceTargetAsteroid(sampleId);
      const targetedBeforeLaunch = api.getTargetedAsteroidId();
      api.launchFromHotkey(1);
      const toast = api.getActiveLaunchToast();
      const targetedAfterLaunchAttempt = api.getTargetedAsteroidId();

      return {
        sampleId,
        targetLocked,
        targetedBeforeLaunch,
        targetedAfterLaunchAttempt,
        toast,
      };
    });

    expect(interactionResult).not.toBeNull();
    expect(interactionResult?.targetLocked).toBe(true);
    expect(interactionResult?.targetedBeforeLaunch).toBe(interactionResult?.sampleId);
    expect(interactionResult?.targetedAfterLaunchAttempt).toBe(interactionResult?.sampleId);
    expect(interactionResult?.toast).toEqual(
      expect.objectContaining({
        tone: 'error',
      }),
    );
    expect(interactionResult?.toast?.message).toContain('no launchable item');
  });
});
