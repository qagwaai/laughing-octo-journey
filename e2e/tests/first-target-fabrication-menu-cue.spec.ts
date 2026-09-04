import { expect } from '@playwright/test';
import {
  advanceMissionToManufactureStep,
  registerFirstTargetCueMock,
  waitForShipExteriorTestApi,
} from '../fixtures/first-target-cue-scenario';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';

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

  await waitForShipExteriorTestApi(sharedPage, prepareJoinedPage);
  await advanceMissionToManufactureStep(sharedPage);

  await sharedPage.locator('button[aria-label="Fabrication Lab"]').click();
  await expect(sharedPage).toHaveURL(/left:fabrication-lab/);
  await sharedPage.getByRole('button', { name: 'View Print Queue' }).click();
  await expect(sharedPage).toHaveURL(/right:print-queue/);

  const printHullPatchKitButton = sharedPage.getByRole('button', { name: 'Print Hull Patch Kit' });
  await expect(printHullPatchKitButton).toBeVisible();
  await expect(printHullPatchKitButton).toBeEnabled();
  await printHullPatchKitButton.click();
  await expect(sharedPage.locator('.status-line--success')).toContainText('queued for printing');

  const finishPrintButton = sharedPage.getByRole('button', { name: 'Finish (dev)' });
  await expect(finishPrintButton).toBeVisible();
  await finishPrintButton.click();
  await expect(sharedPage.getByText('Hull Patch Kit print complete', { exact: false })).toBeVisible({ timeout: 10000 });

  const repairRetrofitButton = sharedPage.locator('button[aria-label="Repair & Retrofit"]');
  const overlay = sharedPage.locator('.left-pane-mission-guidance-overlay');
  await expect
    .poll(
      async () => {
        const className = await repairRetrofitButton.getAttribute('class');
        return className?.includes('is-guided-target') ?? false;
      },
      { timeout: 10000 },
    )
    .toBe(true);
  await expect(repairRetrofitButton.locator('.menu-badge')).toHaveText('NEXT', { timeout: 10000 });
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect
    .poll(
      async () => {
        return sharedPage.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorBareSceneTestUtils?: {
                legacy?: {
                  getMissionGateState?: () => {
                    steps?: Array<{ key?: string; status?: string }>;
                  } | null;
                };
              };
            }
          ).__shipExteriorBareSceneTestUtils?.legacy;
          const gateState = api?.getMissionGateState?.();
          const repairStep = gateState?.steps?.find((step) => step.key === 'repair_scavenger_pod');

          return {
            repairStepStatus: repairStep?.status ?? null,
            targetLabel:
              document
                .querySelector('.left-pane-mission-guidance-overlay .overlay-target strong')
                ?.textContent?.trim() ?? '',
            instruction:
              document.querySelector('.left-pane-mission-guidance-overlay .overlay-instruction')?.textContent?.trim() ??
              '',
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
