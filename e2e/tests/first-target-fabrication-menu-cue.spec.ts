import { expect, type Page } from '@playwright/test';
import { registerFirstTargetCueMock } from '../fixtures/first-target-cue-scenario';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';

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
          return typeof api?.getMissionGateState === 'function';
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

test('shows repair & retrofit menu cue after manufacture unlocks repair step', async ({
  sharedPage,
  prepareJoinedPage,
}) => {
  await prepareJoinedPage();

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
