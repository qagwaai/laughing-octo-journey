import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-first-target';

function configureFirstTargetFlowMock(
  mock: SocketIOMock,
  missionUpsertRequests: Array<{ status?: string }>,
  options?: { includeIronInShipInventory?: boolean },
): void {
  const shipInventory = [
    {
      id: 'item-drone-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      launchable: true,
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship' as const, containerId: 'ship-1' },
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

  if (options?.includeIronInShipInventory) {
    shipInventory.push({
      id: 'item-iron-1',
      itemType: 'iron-raw-material',
      displayName: 'Iron (raw material)',
      launchable: false,
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship' as const, containerId: 'ship-1' },
      owningPlayerId: TEST_PLAYER,
      owningCharacterId: TEST_CHARACTER_ID,
      kinematics: null,
      destroyedAt: null,
      destroyedReason: null,
      discoveredAt: null,
      discoveredByCharacterId: null,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
  }

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
      missions: [
        {
          missionId: FIRST_TARGET_MISSION_ID,
          status: 'started',
        },
      ],
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
          inventory: shipInventory,
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
        shipId: payload.shipId ?? 'ship-1',
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

  mock.on('mission-upsert-request', (request) => {
    missionUpsertRequests.push(request as { status?: string });
    return {
      event: 'mission-upsert-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
      },
    };
  });

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
          container: item.container ?? { containerType: 'ship', containerId: 'ship-1' },
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

test.describe('First Target Mission Flow', () => {
  test('validates all first-target mission gate steps in order', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    const missionUpsertRequests: Array<{ status?: string }> = [];

    configureFirstTargetFlowMock(mock, missionUpsertRequests);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
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

    await expect.poll(() => missionUpsertRequests.some((request) => request.status === 'in-progress')).toBe(true);
    expect(missionUpsertRequests.some((request) => request.status === 'completed')).toBe(false);

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
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    const missionUpsertRequests: Array<{ status?: string }> = [];

    configureFirstTargetFlowMock(mock, missionUpsertRequests);

    await loginViaUI(page, mock);

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
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    const missionUpsertRequests: Array<{ status?: string }> = [];

    configureFirstTargetFlowMock(mock, missionUpsertRequests, { includeIronInShipInventory: true });

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
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
