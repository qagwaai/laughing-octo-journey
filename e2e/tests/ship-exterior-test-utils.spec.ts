import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-ship-exterior';

test.describe('Ship Exterior Test Utilities', () => {
  test('supports deterministic mission progression without real 3D pointer raycast', async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();

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
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'active',
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
            inventory: [
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
            ],
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

    await loginViaUI(page, mock);
    await new GameShellPage(page).joinGame('Join Game in Progress');

    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15000 });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: { getMissionGateState?: () => unknown };
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
              __shipExteriorTestUtils?: { getAsteroidSamples?: () => unknown[] };
            }
          ).__shipExteriorTestUtils;
          return api?.getAsteroidSamples?.().length ?? 0;
        }),
      )
      .toBeGreaterThan(0);

    const initialGate = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { getMissionGateState: () => unknown };
        }
      ).__shipExteriorTestUtils;
      return api!.getMissionGateState() as {
        steps: Array<{ key: string; status: string }>;
      };
    });

    expect(initialGate.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
    expect(initialGate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('locked');

    const gateAfterForcedScan = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { forceCompleteIronScan: () => unknown | null };
        }
      ).__shipExteriorTestUtils;
      return api!.forceCompleteIronScan() as {
        steps: Array<{ key: string; status: string }>;
      } | null;
    });

    expect(gateAfterForcedScan).not.toBeNull();

    expect(gateAfterForcedScan!.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
    expect(gateAfterForcedScan!.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe(
      'active',
    );

    const manufactureWithoutLaunch = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { simulateManufacture: (itemType: string) => unknown };
        }
      ).__shipExteriorTestUtils;
      return api!.simulateManufacture('hull-patch-kit') as {
        steps: Array<{ key: string; status: string }>;
      };
    });

    expect(manufactureWithoutLaunch.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).not.toBe(
      'completed',
    );
    expect(manufactureWithoutLaunch.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('locked');
  });

  test('completes deterministic mission flow and emits completed mission status', async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();
    const missionUpsertRequests: Array<{ status?: string }> = [];

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
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'active',
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
            inventory: [
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
            ],
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

    await loginViaUI(page, mock);
    await new GameShellPage(page).joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15000 });

    await expect
      .poll(
        async () =>
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
        { timeout: 15000 },
      )
      .toBe(true);

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
        page.evaluate((sampleId) => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => { steps: Array<{ key: string; status: string }> };
                getAsteroidSamples: () => Array<{ id: string; serverCelestialBodyId: string | null }>;
              };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState();
          const neutralizeStatus = gate.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status;
          const sample = api!.getAsteroidSamples().find((entry) => entry.id === sampleId);
          return {
            neutralizeStatus,
            hasServerId: Boolean(sample?.serverCelestialBodyId),
          };
        }, firstSampleId),
      )
      .toEqual({ neutralizeStatus: 'active', hasServerId: true });

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
                getMissionGateState: () => { steps: Array<{ key: string; status: string }> };
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

    await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { simulateDebrisCollection: (remainingDebrisCount?: number) => unknown };
        }
      ).__shipExteriorTestUtils;
      api!.simulateDebrisCollection(0);
    });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => { steps: Array<{ key: string; status: string }> };
              };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState();
          return {
            manufacture: gate.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status,
            repair: gate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status,
          };
        }),
      )
      .toEqual({ manufacture: 'active', repair: 'locked' });

    await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { simulateManufacture: (itemType: string) => unknown };
        }
      ).__shipExteriorTestUtils;
      api!.simulateManufacture('hull-patch-kit');
    });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => { steps: Array<{ key: string; status: string }> };
              };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState();
          return {
            manufacture: gate.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status,
            repair: gate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status,
          };
        }),
      )
      .toEqual({ manufacture: 'completed', repair: 'active' });

    const finalGate = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: {
            simulateRepair: (repairKind: string) => {
              steps: Array<{ key: string; status: string }>;
              activeObjectiveText: string;
            } | null;
          };
        }
      ).__shipExteriorTestUtils;
      return api!.simulateRepair('ship');
    });

    expect(finalGate).not.toBeNull();
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
          const gate = api!.getMissionGateState();
          const statuses = new Map(gate.steps.map((step) => [step.key, step.status]));
          return {
            identify: statuses.get('identify_iron_asteroid') ?? null,
            neutralize: statuses.get('neutralize_identified_asteroid') ?? null,
            manufacture: statuses.get('manufacture_hull_patch_kit') ?? null,
            repair: statuses.get('repair_scavenger_pod') ?? null,
            objective: gate.activeObjectiveText,
          };
        }),
      )
      .toMatchObject({
        identify: 'completed',
        neutralize: 'completed',
        manufacture: 'completed',
        repair: 'completed',
      });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: {
                getMissionGateState: () => {
                  activeObjectiveText: string;
                };
              };
            }
          ).__shipExteriorTestUtils;
          return api!.getMissionGateState().activeObjectiveText;
        }),
      )
      .toContain('Mission objectives complete');

    await expect.poll(() => missionUpsertRequests.some((request) => request.status === 'active')).toBe(true);
  });

  test('preserves completed local gate when backend reports started without statusDetail', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();

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
            inventory: [
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
            ],
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
              { key: 'repair_scavenger_pod', status: 'completed' },
            ],
          }),
        );
      },
      { missionId: FIRST_TARGET_MISSION_ID, characterId: TEST_CHARACTER_ID, playerName: TEST_PLAYER },
    );

    await new GameShellPage(page).joinGame();
    await expect(page).toHaveURL(/opening-cold-boot/, { timeout: 15000 });
    await page.getByRole('button', { name: /Start Scanning/i }).click();
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15000 });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: { getMissionGateState?: () => unknown };
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
              __shipExteriorTestUtils?: { getMissionGateState: () => unknown };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState() as {
            steps: Array<{ key: string; status: string }>;
          };
          return gate.steps.find((step) => step.key === 'identify_iron_asteroid')?.status ?? 'missing';
        }),
      )
      .toBe('completed');

    const gateAfterBackendRefresh = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { getMissionGateState: () => unknown };
        }
      ).__shipExteriorTestUtils;
      return api!.getMissionGateState() as {
        steps: Array<{ key: string; status: string }>;
        activeObjectiveText: string;
      };
    });

    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe(
      'completed',
    );
    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe(
      'completed',
    );
    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe(
      'completed',
    );
    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe(
      'completed',
    );
    expect(gateAfterBackendRefresh.activeObjectiveText).toContain('Mission objectives complete');
  });

  test('preserves completed gate when backend reports active without statusDetail and local gate is fully completed', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();

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
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'active',
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
            inventory: [
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
            ],
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
              { key: 'repair_scavenger_pod', status: 'completed' },
            ],
          }),
        );
      },
      { missionId: FIRST_TARGET_MISSION_ID, characterId: TEST_CHARACTER_ID, playerName: TEST_PLAYER },
    );

    await new GameShellPage(page).joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15000 });

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const api = (
            window as Window & {
              __shipExteriorTestUtils?: { getMissionGateState?: () => unknown };
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
              __shipExteriorTestUtils?: { getMissionGateState: () => unknown };
            }
          ).__shipExteriorTestUtils;
          const gate = api!.getMissionGateState() as {
            steps: Array<{ key: string; status: string }>;
          };
          return gate.steps.find((step) => step.key === 'repair_scavenger_pod')?.status ?? 'missing';
        }),
      )
      .toBe('completed');

    const gateAfterBackendRefresh = await page.evaluate(() => {
      const api = (
        window as Window & {
          __shipExteriorTestUtils?: { getMissionGateState: () => unknown };
        }
      ).__shipExteriorTestUtils;
      return api!.getMissionGateState() as {
        steps: Array<{ key: string; status: string }>;
        activeObjectiveText: string;
      };
    });

    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe(
      'completed',
    );
    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe(
      'completed',
    );
    expect(gateAfterBackendRefresh.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('completed');
    expect(gateAfterBackendRefresh.activeObjectiveText).toContain('Mission objectives complete');
  });
});
