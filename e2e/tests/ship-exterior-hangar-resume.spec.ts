import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import {
  configureShipExteriorResumeMock,
  SHIP_EXTERIOR_RESUME_CHARACTER_ID,
  SHIP_EXTERIOR_RESUME_SHIP_ID,
} from '../fixtures/ship-exterior-resume-scenario';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

const SHIP_EXTERIOR_VIEW_URL_PATTERN = /(?:right:ship-exterior-view|\/ship-exterior-view(?:\(|$))/;

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

    await shipHangarPage.openAndWaitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
        shipId: SHIP_EXTERIOR_RESUME_SHIP_ID,
      },
    });

    await shipHangarPage.openSpecsForShip(0);
    await expect(page).toHaveURL(/right:item-view-specs/);

    await shipHangarPage.openExteriorForShip(0);
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

    await shipHangarPage.openAndWaitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_RESUME_CHARACTER_ID,
        shipId: SHIP_EXTERIOR_RESUME_SHIP_ID,
      },
    });

    await shipHangarPage.openExteriorForShip(0);
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
