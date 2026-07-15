import { expect, test } from '@playwright/test';
import {
  configureFirstTargetFlowMock,
  FIRST_TARGET_MISSION_ID,
  setupFirstTargetFlowTest,
  TEST_CHARACTER_ID,
} from '../fixtures/first-target-full-mission-flow-scenario';
import { TEST_PLAYER } from '../helpers/auth-helper';

test.describe('First Target Mission Flow', () => {
  test('validates all first-target mission gate steps in order', async ({ page }) => {
    await setupFirstTargetFlowTest(page);
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'TARGET IRON' })).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState?: () => unknown;
              };
            }
          ).__shipExteriorTestUtils;
          return typeof api?.getMissionGateState === 'function';
        }),
      )
      .toBe(true);

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

    const initialGate = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: {
            getMissionGateState: () => {
              steps: Array<{ key: string; status: string }>;
            };
          };
        }
      ).__shipExteriorTestUtils;
      return api!.getMissionGateState();
    });

    expect(initialGate.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
    expect(initialGate.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe('locked');
    expect(initialGate.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('locked');
    expect(initialGate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('locked');

    const firstSampleId = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { getAsteroidSamples: () => Array<{ id: string }> };
        }
      ).__shipExteriorTestUtils;
      return api!.getAsteroidSamples()[0]?.id ?? null;
    });

    expect(firstSampleId).not.toBeNull();

    await page.evaluate((sampleId) => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { forceCompleteIronScan: (id?: string) => unknown };
        }
      ).__shipExteriorTestUtils;
      api!.forceCompleteIronScan(sampleId ?? undefined);
    }, firstSampleId);

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => {
                  steps: Array<{ key: string; status: string }>;
                };
              };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState();
          return {
            identify: gate.steps.find((step) => step.key === 'identify_iron_asteroid')?.status,
            neutralize: gate.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status,
          };
        }),
      )
      .toEqual({ identify: 'completed', neutralize: 'active' });

    await page.evaluate((sampleId) => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: {
            forceTargetAsteroid: (id: string) => boolean;
            launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
          };
        }
      ).__shipExteriorTestUtils;
      if (sampleId && api?.forceTargetAsteroid(sampleId)) {
        api.launchFromHotkey(1);
      }
    }, firstSampleId);

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => {
                  steps: Array<{ key: string; status: string }>;
                };
              };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState();
          return {
            neutralize: gate.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status,
            manufacture: gate.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status,
          };
        }),
      )
      .toEqual({ neutralize: 'completed', manufacture: 'active' });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getActiveShipInventoryItemTypes?: () => string[];
              };
            }
          ).__shipExteriorTestUtils;
          return api?.getActiveShipInventoryItemTypes?.() ?? [];
        }),
      )
      .toContain('iron');

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                simulateManufacture: (itemType: string) => unknown;
                getMissionGateState: () => {
                  steps: Array<{ key: string; status: string }>;
                };
              };
            }
          ).__shipExteriorTestUtils;
          api!.simulateManufacture('hull-patch-kit');
          const gate = api!.getMissionGateState();
          return {
            manufacture: gate.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status,
            repair: gate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status,
          };
        }),
      )
      .toEqual({ manufacture: 'completed', repair: 'active' });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const api = (
              window as Window & {
                __shipExteriorTestUtils?: {
                  simulateRepair: (repairKind: string) => unknown;
                  getMissionGateState: () => {
                    steps: Array<{ key: string; status: string }>;
                    activeObjectiveText: string;
                  };
                };
              }
            ).__shipExteriorTestUtils;
            if (!api?.simulateRepair || !api?.getMissionGateState) {
              return { allCompleted: false, hasCompletionObjective: false, hasDebrisObjective: false };
            }
            api.simulateRepair('ship');
            const gate = api.getMissionGateState();
            return {
              allCompleted: Boolean(gate?.steps.every((step) => step.status === 'completed')),
              hasCompletionObjective: Boolean(gate?.activeObjectiveText.includes('Mission objectives complete')),
              hasDebrisObjective: Boolean(gate?.activeObjectiveText.includes('collect the floating debris')),
            };
          }),
        { timeout: 30_000 },
      )
      .toEqual({ allCompleted: true, hasCompletionObjective: true, hasDebrisObjective: false });

  });

  test('normalizes legacy 3-step persisted gate into active repair step', async ({ page }) => {
    const { gameShell, missionUpsertRequests } = await setupFirstTargetFlowTest(page, { autoJoin: false });

    await page.evaluate(
      ({ missionId, characterId, playerName }) => {
        window.localStorage.setItem(
          `ship-exterior-mission-state::${missionId}::${playerName}::${characterId}`,
          JSON.stringify({
            missionId,
            characterId,
            activeObjectiveText: 'Mission objectives complete. Await further directives.',
            updatedAt: '2026-05-01T00:00:00.000Z',
            steps: [
              { key: 'identify_iron_asteroid', status: 'completed' },
              { key: 'neutralize_identified_asteroid', status: 'completed' },
              { key: 'manufacture_hull_patch_kit', status: 'completed' },
            ],
          }),
        );
      },
      { missionId: FIRST_TARGET_MISSION_ID, characterId: TEST_CHARACTER_ID, playerName: TEST_PLAYER },
    );

    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'TARGET IRON' })).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => {
                  steps: Array<{ key: string; status: string }>;
                  activeObjectiveText: string;
                };
              };
            }
          ).__shipExteriorTestUtils;
          if (!api?.getMissionGateState) {
            return { repair: '', objective: '' };
          }
          const gate = api!.getMissionGateState();
          return {
            repair: gate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status,
            objective: gate.activeObjectiveText,
          };
        }),
      )
      .toEqual({
        repair: 'active',
        objective: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      });

    expect(missionUpsertRequests.some((request) => request.status === 'completed')).toBe(false);
  });

  test('shows Hull Patch Kit print button from Fabrication Lab print queue when iron exists in inventory', async ({
    page,
  }) => {
    const { gameShell } = await setupFirstTargetFlowTest(page, { includeIronInShipInventory: true });
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'TARGET IRON' })).toBeVisible({ timeout: 15_000 });

    await page.locator('button[aria-label="Fabrication Lab"]').click();
    await expect(page).toHaveURL(/left:fabrication-lab/);

    await page.getByRole('button', { name: 'View Print Queue' }).click();
    await expect(page).toHaveURL(/right:print-queue/);

    const printHullPatchKitButton = page.getByRole('button', { name: /Print Hull Patch Kit/i });
    await expect(printHullPatchKitButton).toBeVisible();
    await expect(printHullPatchKitButton).toBeEnabled();
  });
});
