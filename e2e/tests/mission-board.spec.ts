import { expect, test } from '@playwright/test';
import { setupMissionBoardTest } from '../fixtures/mission-board-scenario';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MissionBoardPage } from '../page-objects/mission-board.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

// ── Shared test data ───────────────────────────────────────────────────────────

const FIRST_TARGET_MISSION_ID = 'first-target';

const characterWithStartedMission = {
  id: 'char-3',
  characterName: 'Scout Alpha',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
};

const characterWithCompletedMission = {
  id: 'char-4',
  characterName: 'Scout Beta',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

const completedMissionGateState = {
  missionId: FIRST_TARGET_MISSION_ID,
  characterId: 'char-3',
  activeObjectiveText: 'Mission objectives complete. Await further directives.',
  updatedAt: '2026-04-30T00:00:00.000Z',
  steps: [
    { key: 'identify_iron_asteroid', status: 'completed' },
    { key: 'neutralize_identified_asteroid', status: 'completed' },
    { key: 'manufacture_hull_patch_kit', status: 'completed' },
    { key: 'repair_scavenger_pod', status: 'completed' },
  ],
};

// ── Tests: mission board ───────────────────────────────────────────────────────

test.describe('Mission Board — mission progress display', () => {
  test('shows completed mission status and stage on mission board after joining in-progress game', async ({ page }) => {
    const { mock } = await setupMissionBoardTest(page, [characterWithStartedMission]);
    const gameShell = new GameShellPage(page);
    const missionBoardPage = new MissionBoardPage(page);

    mock.on('game-join-request', () => null);
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-3',
        ships: [
          {
            id: 'ship-1',
            name: 'Nomad',
            model: 'Scavenger Pod',
            tier: 1,
            status: 'ACTIVE',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 350000000, y: 0, z: 10000000 },
              epochMs: 1715000000000,
            },
          },
        ],
      },
    }));
    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-3',
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'completed',
            statusDetail: JSON.stringify(completedMissionGateState),
            startedAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
        ],
      },
    }));

    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });

    await gameShell.openMissionBoard();

    const leftMissionBoard = page.locator('app-mission-board-page .ops-page-container').first();
    await expect(leftMissionBoard.locator('button[aria-label="Mission Board"]')).toHaveCount(0);

    const completedLane = missionBoardPage.lane('completed');
    await expect(completedLane).toContainText('Your First Target');
    await expect(completedLane.locator('.mission-status[data-status="completed"]')).toHaveCount(1);
    await expect(completedLane).toContainText('Stage 4 of 4 — Complete');
    await expect(completedLane).toContainText('Mission objectives complete. Await further directives.');
  });

  test('right mission-board does not render guarded menu items after first-target completion', async ({ page }) => {
    const { mock } = await setupMissionBoardTest(page, [characterWithCompletedMission]);
    const gameShell = new GameShellPage(page);

    mock.on('game-join-request', () => null);
    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-4',
        missions: [
          {
            missionId: FIRST_TARGET_MISSION_ID,
            status: 'completed',
            statusDetail: JSON.stringify(completedMissionGateState),
            startedAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
        ],
      },
    }));

    await gameShell.joinGame();
    await expect(page).toHaveURL(/right:mission-board/);

    const rightMissionBoard = page.locator('app-mission-board-page .ops-page-container').first();
    await expect(rightMissionBoard).toBeVisible();
    await expect(rightMissionBoard.locator('app-guarded-left-menu')).toHaveCount(0);
    await expect(rightMissionBoard.locator('button[aria-label="Mission Board"]')).toHaveCount(0);
    await expect(rightMissionBoard.locator('button[aria-label="Viewer"]')).toHaveCount(0);
  });

  test('shows contract violation badge when backend sends unknown mission status', async ({ page }) => {
    const { mock } = await setupMissionBoardTest(page, [characterWithCompletedMission]);
    const gameShell = new GameShellPage(page);

    mock.on('game-join-request', () => null);
    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-4',
        missions: [
          {
            missionId: 'sw01-completed-control',
            status: 'completed',
            startedAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
          {
            missionId: 'sw01-unknown',
            status: 'abandoned',
            startedAt: '2026-04-02T10:00:00.000Z',
            updatedAt: '2026-04-29T00:00:00.000Z',
          },
        ],
      },
    }));

    await gameShell.joinGame();
    await expect(page).toHaveURL(/right:mission-board/);

    const rightMissionBoard = page.locator('app-mission-board-page .ops-page-container').first();
    await expect(rightMissionBoard).toBeVisible();

    const violationBadge = rightMissionBoard.locator('.mission-status[data-status="contract-violation"]');
    await expect(violationBadge).toHaveCount(0);
    await expect(rightMissionBoard.locator('.contract-violation')).toContainText('Contract Violation Detected');
    await expect(rightMissionBoard.locator('.contract-violation')).toContainText('sw01-unknown');
  });

  test('keeps mission lane filter stable across route navigation', async ({ page }) => {
    const { mock } = await setupMissionBoardTest(page, [characterWithCompletedMission]);
    const gameShell = new GameShellPage(page);
    const missionBoardPage = new MissionBoardPage(page);
    const shipHangarPage = new ShipHangarPage(page);

    mock.on('game-join-request', () => null);
    mock.on('list-missions-request', () => ({
      event: 'list-missions-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-4',
        missions: [
          {
            missionId: 'sw01-completed-smoke',
            status: 'completed',
            startedAt: '2026-04-01T10:00:00.000Z',
            updatedAt: '2026-04-30T00:00:00.000Z',
          },
          {
            missionId: 'sw01-active-smoke',
            status: 'active',
            startedAt: '2026-04-18T10:00:00.000Z',
            updatedAt: '2026-04-19T10:00:00.000Z',
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
        characterId: 'char-4',
        ships: [
          {
            id: 'ship-2',
            name: 'Pathfinder',
            model: 'Scavenger Pod',
            tier: 1,
            status: 'ACTIVE',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 350000000, y: 0, z: 10000000 },
              epochMs: 1715000000000,
            },
          },
        ],
      },
    }));

    await gameShell.joinGame();
    await expect(page).toHaveURL(/right:mission-board/);

    await missionBoardPage.filterButton('completed').click();
    await expect(page).toHaveURL(/missionStatusFilter=completed/);
    await expect(missionBoardPage.filterButton('completed')).toHaveAttribute('aria-pressed', 'true');
    await expect(missionBoardPage.laneItems('completed')).toHaveCount(1);

    await gameShell.openShipHangar();
    await shipHangarPage.waitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: 'char-4',
        shipId: 'ship-2',
      },
    });
    await gameShell.openMissionBoard();

    await expect(missionBoardPage.filterButton('completed')).toHaveAttribute('aria-pressed', 'true');
    await expect(missionBoardPage.laneItems('completed')).toHaveCount(1);
  });
});
